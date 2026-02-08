import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.6";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const HCAPTCHA_SECRET = Deno.env.get('HCAPTCHA_SECRET') ?? '';
const AUTH_DOMAIN = Deno.env.get('AUTH_DOMAIN') ?? 'app.local';

const LOCK_DURATIONS_MS = [1, 5, 15, 30, 60].map((m) => m * 60 * 1000);
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

const normalizeUsername = (value: string) => (value || '').toString().trim().toLowerCase();

const usernameToEmail = (username: string) => {
  const normalized = normalizeUsername(username);
  if (!normalized) return '';
  return normalized.includes('@') ? normalized : `${normalized}@${AUTH_DOMAIN}`;
};

const getIp = (req: Request) => {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim();
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || '';
};

async function verifyCaptcha(token: string, ip: string) {
  if (!HCAPTCHA_SECRET) return false;
  const body = new URLSearchParams();
  body.set('secret', HCAPTCHA_SECRET);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);

  const resp = await fetch('https://hcaptcha.com/siteverify', {
    method: 'POST',
    body
  });
  const result = await resp.json();
  return !!result?.success;
}

async function getSecurityRow(keyType: 'username' | 'ip', key: string) {
  if (!key) return null;
  const { data } = await adminClient
    .from('auth_login_security')
    .select('*')
    .eq('key_type', keyType)
    .eq('key', key)
    .maybeSingle();
  return data || null;
}

async function upsertSecurityRow(payload: Record<string, unknown>) {
  const { error } = await adminClient
    .from('auth_login_security')
    .upsert(payload, { onConflict: 'key_type,key' });
  if (error) console.warn('auth_login_security upsert failed', error);
}

async function logAttempt(payload: Record<string, unknown>) {
  const { error } = await adminClient
    .from('auth_login_attempts')
    .insert(payload);
  if (error) console.warn('auth_login_attempts insert failed', error);
}

async function recordFailure(keyType: 'username' | 'ip', key: string) {
  if (!key) return null;
  const current = await getSecurityRow(keyType, key);
  const now = new Date();
  let failedCount = Number(current?.failed_count || 0) + 1;
  let lockLevel = Number(current?.lock_level || 0);
  let lockUntil = current?.lock_until ? new Date(current.lock_until) : null;
  let challengeRequired = Boolean(current?.challenge_required);

  if (failedCount >= 4) {
    challengeRequired = true;
    lockLevel = Math.min(lockLevel + 1, LOCK_DURATIONS_MS.length);
    const duration = LOCK_DURATIONS_MS[Math.min(lockLevel - 1, LOCK_DURATIONS_MS.length - 1)];
    lockUntil = new Date(now.getTime() + duration);
    failedCount = 0;
  }

  await upsertSecurityRow({
    key_type: keyType,
    key,
    failed_count: failedCount,
    lock_level: lockLevel,
    lock_until: lockUntil ? lockUntil.toISOString() : null,
    challenge_required: challengeRequired,
    last_failed_at: now.toISOString(),
    updated_at: now.toISOString()
  });

  return lockUntil;
}

async function recordSuccess(keyType: 'username' | 'ip', key: string) {
  if (!key) return;
  const now = new Date();
  await upsertSecurityRow({
    key_type: keyType,
    key,
    failed_count: 0,
    lock_level: 0,
    lock_until: null,
    challenge_required: false,
    last_success_at: now.toISOString(),
    updated_at: now.toISOString()
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    const username = normalizeUsername(body?.username || '');
    const password = (body?.password || '').toString();
    const captchaToken = body?.captchaToken || null;
    const ip = getIp(req);
    const userAgent = req.headers.get('user-agent') || '';

    if (!username || !password) {
      return new Response(JSON.stringify({ ok: false, error: 'Username and password required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (ip) {
      const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
      const { count } = await adminClient
        .from('auth_login_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('ip', ip)
        .gte('created_at', since);

      if (count && count >= RATE_LIMIT_MAX) {
        await logAttempt({ username, ip, user_agent: userAgent, success: false, reason: 'rate_limited' });
        return new Response(JSON.stringify({
          ok: false,
          error: 'Too many attempts. Please wait a minute and try again.',
          retryAfterSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const [userSec, ipSec] = await Promise.all([
      getSecurityRow('username', username),
      getSecurityRow('ip', ip)
    ]);

    const now = Date.now();
    const lockUntilUser = userSec?.lock_until ? new Date(userSec.lock_until).getTime() : 0;
    const lockUntilIp = ipSec?.lock_until ? new Date(ipSec.lock_until).getTime() : 0;
    const lockUntil = Math.max(lockUntilUser, lockUntilIp);
    const challengeRequired = Boolean(userSec?.challenge_required || ipSec?.challenge_required);

    if (lockUntil && lockUntil > now) {
      const retryAfterSeconds = Math.ceil((lockUntil - now) / 1000);
      await logAttempt({ username, ip, user_agent: userAgent, success: false, reason: 'locked' });
      return new Response(JSON.stringify({
        ok: false,
        error: 'Account temporarily locked',
        lockUntil: new Date(lockUntil).toISOString(),
        retryAfterSeconds,
        challengeRequired
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (challengeRequired) {
      if (!captchaToken) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'Verification required',
          challengeRequired: true
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const captchaOk = await verifyCaptcha(captchaToken, ip);
      if (!captchaOk) {
        await logAttempt({ username, ip, user_agent: userAgent, success: false, reason: 'captcha_failed' });
        return new Response(JSON.stringify({
          ok: false,
          error: 'Verification failed',
          challengeRequired: true
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const email = usernameToEmail(username);
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });

    if (error || !data?.session) {
      const lockUser = await recordFailure('username', username);
      const lockIp = await recordFailure('ip', ip);
      await logAttempt({ username, ip, user_agent: userAgent, success: false, reason: 'invalid_credentials' });

      const lockUntilFinal = [lockUser, lockIp]
        .filter(Boolean)
        .map((d) => new Date(d as Date).getTime())
        .reduce((a, b) => Math.max(a, b), 0);

      return new Response(JSON.stringify({
        ok: false,
        error: 'Invalid username or password',
        lockUntil: lockUntilFinal ? new Date(lockUntilFinal).toISOString() : null,
        retryAfterSeconds: lockUntilFinal ? Math.ceil((lockUntilFinal - Date.now()) / 1000) : null,
        challengeRequired: true
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    await recordSuccess('username', username);
    await recordSuccess('ip', ip);
    await logAttempt({ username, ip, user_agent: userAgent, success: true });

    return new Response(JSON.stringify({
      ok: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        token_type: data.session.token_type
      },
      user: {
        id: data.user?.id,
        email: data.user?.email
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('auth-login error', err);
    return new Response(JSON.stringify({ ok: false, error: 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
