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

async function sha256(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map(b => b.toString(16).padStart(2, '0')).join('');
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
  // UUID v4 format guard for target_id (all supported target types are UUID-backed)
  const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!UUID_V4_RE.test(payload.target_id)) {
    return jsonResponse({ error: 'invalid target_id format' }, 400);
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

  // Basic rate limiting (per reporter): max N in sliding 1-minute window
  const MAX_REPORTS_PER_MINUTE = 10;
  try {
    const sinceIso = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount, error: countErr } = await supabase
      .from('reports')
      .select('*', { head: true, count: 'exact' })
      .eq('reporter_id', user.id)
      .gte('created_at', sinceIso);
    if (!countErr && typeof recentCount === 'number' && recentCount >= MAX_REPORTS_PER_MINUTE) {
      return jsonResponse({ error: 'rate limited', code: 'RATE_LIMITED' }, 429);
    }
  } catch (_) {
    // On metering failure, proceed (fail-open). DB RLS still protects integrity.
  }

  // Duplicate guard: prevent the same reporter from reporting the same target repeatedly
  try {
    const { count: dupCount } = await supabase
      .from('reports')
      .select('*', { head: true, count: 'exact' })
      .eq('reporter_id', user.id)
      .eq('target_type', payload.target_type)
      .eq('target_id', payload.target_id);
    if ((dupCount ?? 0) > 0) {
      return jsonResponse({ error: 'already reported', code: 'ALREADY_REPORTED' }, 409);
    }
  } catch (_) {
    // Ignore and continue
  }

  // Insert report (dummy notification can be added later)
  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id,
    target_type: payload.target_type,
    target_id: payload.target_id,
    reason_code: payload.reason_code || 'other',
    reason_text: payload.reason_text || null,
  });
  if (error) {
    return jsonResponse({ error: error.message, code: 'REPORT_INSERT_FAILED' }, 400);
  }

  // Write audit event (fail-open)
  try {
    const ua = req.headers.get('user-agent') || '';
    const ip =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('cf-connecting-ip') ||
      '';
    const ua_hash = ua ? await sha256(ua) : null;
    const ip_hash = ip ? await sha256(ip) : null;
    await supabase.from('report_events').insert({
      reporter_id: user.id,
      target_type: payload.target_type,
      target_id: payload.target_id,
      reason_code: payload.reason_code || null,
      // Store only hashed values to minimize PII
      metadata: { ua_hash: ua_hash, ip_hash: ip_hash },
    });
  } catch (e) {
    // Emit a lightweight error log for visibility; do not block the response
    console.error('report_events audit insert failed', e);
  }

  return jsonResponse({ ok: true });
});
