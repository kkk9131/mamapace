import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

type ReportPayload = {
  target_type: 'user' | 'post' | 'message';
  target_id: string;
  reason_code?: string; // one of app-level codes
  reason_text?: string; // optional free text
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  let payload: ReportPayload | null = null;
  try {
    payload = (await req.json()) as ReportPayload;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!payload || !payload.target_type || !payload.target_id) {
    return jsonResponse({ error: 'Missing fields' }, 400);
  }
  if (!['user', 'post', 'message'].includes(payload.target_type)) {
    return jsonResponse({ error: 'Invalid target_type' }, 400);
  }
  // Basic input hardening
  if (payload.target_id.length > 255) {
    return jsonResponse({ error: 'target_id too long' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseKey) {
    return jsonResponse({ error: 'Server not configured' }, 500);
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  });

  // Minimal draft: record into reports table; enforcement via RLS
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

  // Insert report (dummy notification can be added later)
  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id,
    target_type: payload.target_type,
    target_id: payload.target_id,
    reason_code: payload.reason_code || 'other',
    reason_text: payload.reason_text || null,
  });
  if (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  return jsonResponse({ ok: true });
});
