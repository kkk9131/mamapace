import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: 'Server not configured' }, 500);
  }

  // Use anon key + forwarded Authorization to resolve current user from JWT
  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: req.headers.get('Authorization') || '' },
    },
  });
  const { data: userRes } = await supabaseAuth.auth.getUser();
  const user = userRes?.user;
  if (!user) return json({ error: 'Not authenticated' }, 401);

  // Use service role for privileged deletes (bypass RLS)
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  // Best-effort: delete profile first to cascade app data, then auth user
  try {
    const { error: delProfileErr } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', user.id);
    if (delProfileErr) {
      // Log but continue to auth delete; app data might remain
      console.error('delete-account: failed to delete profile', delProfileErr);
    }
  } catch (e) {
    console.error('delete-account: profile delete exception', e);
  }

  try {
    const { error: adminErr } = await (supabaseAdmin as any).auth.admin.deleteUser(
      user.id
    );
    if (adminErr) {
      return json({ error: adminErr.message || 'delete user failed' }, 400);
    }
  } catch (e: any) {
    return json({ error: e?.message || 'delete user failed' }, 400);
  }

  return json({ ok: true });
});

