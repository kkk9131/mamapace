import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

type VerifyPayload = {
  platform: 'apple' | 'google';
  productId: string;
  receipt: string; // Apple: base64; Google: purchaseToken
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Server not configured');
  return createClient(url, key);
}

// --- Apple App Store Server API helpers ---
function base64urlEncode(data: Uint8Array): string {
  let str = btoa(String.fromCharCode(...data));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64urlFromString(s: string): string {
  return base64urlEncode(new TextEncoder().encode(s));
}

function base64urlDecodeToString(s: string): string {
  const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : '';
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return b;
}

function base64urlJsonDecode<T = any>(jws: string): T {
  const parts = jws.split('.');
  if (parts.length < 2) throw new Error('Invalid JWS');
  const json = base64urlDecodeToString(parts[1]);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(json, c => c.charCodeAt(0))));
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const lines = pem.trim().split(/\r?\n/);
  const base64 = lines.filter(l => !l.includes('BEGIN') && !l.includes('END')).join('');
  const raw = atob(base64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

function derToJose(der: Uint8Array, keySize = 32): Uint8Array {
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error('Invalid DER');
  /* skip seq len */
  if (der[offset] & 0x80) offset += 1 + (der[offset] & 0x7f); else offset += 1;
  if (der[offset++] !== 0x02) throw new Error('Invalid DER');
  let rLen = der[offset++] & 0xff;
  if (der[offset] === 0x00) { offset++; rLen--; }
  const r = der.slice(offset, offset + rLen);
  offset += rLen;
  if (der[offset++] !== 0x02) throw new Error('Invalid DER');
  let sLen = der[offset++] & 0xff;
  if (der[offset] === 0x00) { offset++; sLen--; }
  const s = der.slice(offset, offset + sLen);
  const out = new Uint8Array(keySize * 2);
  out.set(rLen > keySize ? r.slice(rLen - keySize) : new Uint8Array([...new Array(keySize - rLen).fill(0), ...r]), 0);
  out.set(sLen > keySize ? s.slice(sLen - keySize) : new Uint8Array([...new Array(keySize - sLen).fill(0), ...s]), keySize);
  return out;
}

async function generateAppleJWT() {
  const issuer = Deno.env.get('APPLE_ISSUER_ID');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY');
  if (!issuer || !keyId || !privateKey) throw new Error('APPLE credentials not configured');

  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' } as const;
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: issuer, iat: now, exp: now + 1800, aud: 'appstoreconnect-v1' } as const;
  const input = `${base64urlFromString(JSON.stringify(header))}.${base64urlFromString(JSON.stringify(payload))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const sigDer = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(input)));
  const sigJose = derToJose(sigDer);
  const token = `${input}.${base64urlEncode(sigJose)}`;
  return token;
}

async function fetchAppleSubscriptionStatus(originalTransactionId: string) {
  const token = await generateAppleJWT();
  const headers = { Authorization: `Bearer ${token}` };
  const prodUrl = `https://api.storekit.itunes.apple.com/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`;
  const sbxUrl = `https://api.storekit-sandbox.itunes.apple.com/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`;
  let res = await fetch(prodUrl, { headers });
  if (!res.ok) {
    const sbx = await fetch(sbxUrl, { headers });
    if (!sbx.ok) {
      const t1 = await res.text().catch(() => '');
      const t2 = await sbx.text().catch(() => '');
      throw new Error(`Apple API failed: ${res.status} ${t1} | SBX ${sbx.status} ${t2}`);
    }
    res = sbx;
  }
  return await res.json();
}

function pickLatestTransactionForProduct(statuses: any, targetProductId?: string) {
  const groups: any[] = Array.isArray(statuses?.data) ? statuses.data : [];
  let best: { tx: any; renew: any; exp: number; prod?: string; purchaseDate?: number; graceExp?: number } | null = null;
  for (const g of groups) {
    const last = Array.isArray(g?.lastTransactions) ? g.lastTransactions : [];
    for (const t of last) {
      const tx = t?.signedTransactionInfo ? base64urlJsonDecode(t.signedTransactionInfo) : null;
      const rn = t?.signedRenewalInfo ? base64urlJsonDecode(t.signedRenewalInfo) : null;
      if (!tx) continue;
      const prod = String(tx.productId || '');
      if (targetProductId && prod && prod !== targetProductId) continue;
      const exp = Number(tx.expiresDate || 0);
      const purchaseDate = Number(tx.purchaseDate || 0);
      const grace = rn && rn.gracePeriodExpiresDate ? Number(rn.gracePeriodExpiresDate) : undefined;
      if (!best || exp > best.exp) {
        best = { tx, renew: rn, exp, prod, purchaseDate, graceExp: grace };
      }
    }
  }
  return best;
}

async function handleVerify(req: Request) {
  let payload: VerifyPayload | null = null;
  try {
    payload = (await req.json()) as VerifyPayload;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (!payload || !payload.platform || !payload.productId || !payload.receipt) {
    return json({ error: 'Missing fields' }, 400);
  }

  // Identify user from Authorization header if provided
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return json({ error: 'Server not configured' }, 500);
  const userScoped = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  });
  const { data: userRes } = await userScoped.auth.getUser();
  const user = userRes?.user;
  if (!user) return json({ error: 'Not authenticated' }, 401);

  // Maternal badge gating: only allow verified users to subscribe
  try {
    const svc = getServiceClient();
    const { data: profile, error: pErr } = await svc
      .from('user_profiles')
      .select('id, maternal_verified')
      .eq('id', user.id)
      .single();
    if (pErr || !profile || !profile.maternal_verified) {
      return json({ error: 'SUBSCRIPTION_NOT_ELIGIBLE' }, 403);
    }
  } catch (_) {
    return json({ error: 'Eligibility check failed' }, 500);
  }

  try {
    const svc = getServiceClient();

    // Resolve plan by productId or code mapping (productId may be null until configured)
    const { data: plan } = await svc
      .from('subscription_plans')
      .select('*')
      .or(`product_id.eq.${payload.productId},code.eq.premium_monthly`)
      .eq('active', true)
      .limit(1)
      .single();

    if (!plan) return json({ error: 'Plan not found' }, 404);

    if (payload.platform === 'apple') {
      const originalTransactionId = payload.receipt; // client sends originalTransactionId
      if (!originalTransactionId) return json({ error: 'Missing originalTransactionId' }, 400);

      const statuses = await fetchAppleSubscriptionStatus(originalTransactionId);
      const best = pickLatestTransactionForProduct(statuses, plan.product_id || undefined);
      if (!best) return json({ error: 'No subscription found for product' }, 404);

      const nowMs = Date.now();
      const isActive = best.exp && best.exp > nowMs;
      const inGrace = !isActive && best.graceExp && best.graceExp > nowMs;
      const trialDays = Number(plan.trial_days ?? 0) || 0;
      const inTrial = isActive && trialDays > 0 && best.purchaseDate && (best.purchaseDate + trialDays * 86400000) > nowMs;
      const status: string = inTrial ? 'in_trial' : isActive ? 'active' : inGrace ? 'in_grace' : 'expired';

      const periodEndIso = new Date(isActive ? best.exp : (best.graceExp || best.exp || nowMs)).toISOString();
      const periodStartIso = new Date(best.purchaseDate || nowMs).toISOString();

      const { error: upsertErr } = await svc.from('user_subscriptions').upsert(
        {
          user_id: user.id,
          plan_id: plan.id,
          status,
          current_period_start: periodStartIso,
          current_period_end: periodEndIso,
          last_receipt_snapshot: {
            platform: 'apple',
            originalTransactionId,
            productId: best.prod,
            expiresDate: best.exp,
            gracePeriodExpiresDate: best.graceExp || null,
          },
        },
        { onConflict: 'user_id,plan_id' },
      );
      if (upsertErr) return json({ error: upsertErr.message }, 400);
      return json({ ok: true });
    }

    // Google: not implemented yet
    return json({ error: 'Google verification not implemented' }, 400);
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
}

async function handleAppleNotifications() {
  // TODO: Implement App Store Server Notifications v2 verification and DB updates
  return json({ ok: true, note: 'apple notifications not implemented' }, 501);
}

async function handleGoogleNotifications() {
  // TODO: Implement Google RDN verification and DB updates
  return json({ ok: true, note: 'google notifications not implemented' }, 501);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/functions\/v1\/iap/, '');

  if (req.method === 'POST' && (path === '' || path === '/' || path === '/verify')) {
    return handleVerify(req);
  }
  if (req.method === 'POST' && path === '/notifications/apple') {
    return handleAppleNotifications();
  }
  if (req.method === 'POST' && path === '/notifications/google') {
    return handleGoogleNotifications();
  }
  return json({ error: 'Not Found' }, 404);
});
