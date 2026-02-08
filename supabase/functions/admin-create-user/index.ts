import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.6";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AUTH_DOMAIN = Deno.env.get('AUTH_DOMAIN') ?? 'app.local';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const normalizeUsername = (value: string) => (value || '').toString().trim().toLowerCase();
const usernameToEmail = (username: string) => {
  const normalized = normalizeUsername(username);
  return normalized.includes('@') ? normalized : `${normalized}@${AUTH_DOMAIN}`;
};

async function getCallerProfile(jwt: string) {
  const { data: userData, error } = await adminClient.auth.getUser(jwt);
  if (error || !userData?.user) return null;
  const { data: profile } = await adminClient
    .from('user_profiles')
    .select('id, role')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (!profile) return null;
  return { user: userData.user, profile };
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
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const caller = await getCallerProfile(token);
    if (!caller) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const role = caller.profile.role || 'user';
    if (!['admin', 'developer'].includes(role)) {
      return new Response(JSON.stringify({ ok: false, error: 'Not authorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const username = normalizeUsername(body?.username || '');
    const password = (body?.password || '').toString();
    const targetRole = (body?.role || 'user').toString();
    const permissions = body?.permissions || {};

    if (!username || !password) {
      return new Response(JSON.stringify({ ok: false, error: 'Username and password required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (role === 'admin' && targetRole !== 'user') {
      return new Response(JSON.stringify({ ok: false, error: 'Admins may only create user accounts' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const email = usernameToEmail(username);
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (createErr || !created?.user) {
      return new Response(JSON.stringify({ ok: false, error: createErr?.message || 'Failed to create user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { error: profileErr } = await adminClient
      .from('user_profiles')
      .insert({
        id: created.user.id,
        username,
        role: targetRole,
        permissions,
        created_by: caller.user.id
      });

    if (profileErr) {
      return new Response(JSON.stringify({ ok: false, error: profileErr.message || 'Profile creation failed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true, userId: created.user.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('admin-create-user error', err);
    return new Response(JSON.stringify({ ok: false, error: 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
