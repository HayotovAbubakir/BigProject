import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.6";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const normalizeUsername = (value: string) => (value || '').toString().trim().toLowerCase();

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
    const targetId = body?.userId || null;

    if (!username && !targetId) {
      return new Response(JSON.stringify({ ok: false, error: 'Username or userId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let target = null;
    if (targetId) {
      const { data } = await adminClient
        .from('user_profiles')
        .select('id, role, username')
        .eq('id', targetId)
        .maybeSingle();
      target = data;
    } else {
      const { data } = await adminClient
        .from('user_profiles')
        .select('id, role, username')
        .eq('username', username)
        .maybeSingle();
      target = data;
    }

    if (!target) {
      return new Response(JSON.stringify({ ok: false, error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (role === 'admin' && target.role !== 'user') {
      return new Response(JSON.stringify({ ok: false, error: 'Admins may only delete user accounts' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(target.id);
    if (deleteErr) {
      return new Response(JSON.stringify({ ok: false, error: deleteErr.message || 'Failed to delete user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    await adminClient.from('user_profiles').delete().eq('id', target.id);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('admin-delete-user error', err);
    return new Response(JSON.stringify({ ok: false, error: 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
