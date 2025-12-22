// Deno Edge Function: iap-verify
// Verifies IAP receipts from Apple App Store and Google Play

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

interface RequestBody {
  platform: 'apple' | 'google';
  productId: string;
  receipt: string; // Apple: originalTransactionId, Google: purchaseToken
}

interface VerifyResult {
  valid: boolean;
  expiresAt?: string;
  error?: string;
}

function json(status: number, data: unknown, origin?: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(data), { status, headers });
}

function resolveAllowedOrigin(req: Request): string | null {
  const conf = (Deno.env.get('ALLOWED_ORIGINS') || '').trim();
  if (!conf) return '*';
  const set = new Set(conf.split(',').map(s => s.trim()).filter(Boolean));
  const origin = req.headers.get('origin');
  if (origin && set.has(origin)) return origin;
  return null;
}

// Apple App Store Server API v2
async function verifyApple(
  originalTransactionId: string,
  _productId: string
): Promise<VerifyResult> {
  // Development mode: skip verification
  if (Deno.env.get('IAP_DEV_MODE') === 'true') {
    console.log('[IAP] Dev mode: skipping Apple verification');
    return {
      valid: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  const issuerId = Deno.env.get('APPLE_ISSUER_ID');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY');
  const bundleId = Deno.env.get('APPLE_BUNDLE_ID') || 'com.mamapace.app';

  if (!issuerId || !keyId || !privateKey) {
    console.error('[IAP] Apple credentials not configured');
    return { valid: false, error: 'Apple credentials not configured' };
  }

  try {
    // Generate JWT for App Store Server API
    const jwt = await generateAppleJWT(issuerId, keyId, privateKey, bundleId);

    // Get transaction info
    const baseUrl = Deno.env.get('APPLE_SANDBOX') === 'true'
      ? 'https://api.storekit-sandbox.itunes.apple.com'
      : 'https://api.storekit.itunes.apple.com';

    const response = await fetch(
      `${baseUrl}/inApps/v1/transactions/${originalTransactionId}`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[IAP] Apple API error:', response.status, errorText);
      return { valid: false, error: `Apple API error: ${response.status}` };
    }

    const data = await response.json();

    // Decode the signed transaction
    const signedTransaction = data.signedTransactionInfo;
    if (!signedTransaction) {
      return { valid: false, error: 'No transaction info' };
    }

    // Parse JWT payload (simplified - in production, verify signature)
    const payload = JSON.parse(atob(signedTransaction.split('.')[1]));

    const expiresAt = payload.expiresDate
      ? new Date(payload.expiresDate).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return { valid: true, expiresAt };
  } catch (e) {
    console.error('[IAP] Apple verification error:', e);
    return { valid: false, error: String(e) };
  }
}

// Generate Apple JWT
async function generateAppleJWT(
  issuerId: string,
  keyId: string,
  privateKey: string,
  bundleId: string
): Promise<string> {
  const header = {
    alg: 'ES256',
    kid: keyId,
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 3600,
    aud: 'appstoreconnect-v1',
    bid: bundleId,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '');
  const data = encoder.encode(`${headerB64}.${payloadB64}`);

  // Import private key and sign
  const keyData = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const key = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(keyData), c => c.charCodeAt(0)),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    data
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

// Google Play Developer API
async function verifyGoogle(
  purchaseToken: string,
  productId: string
): Promise<VerifyResult> {
  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  const packageName = Deno.env.get('GOOGLE_PACKAGE_NAME') || 'com.mamapace.app';

  if (!serviceAccountJson) {
    console.error('[IAP] Google credentials not configured');
    // Development fallback
    if (Deno.env.get('IAP_DEV_MODE') === 'true') {
      return {
        valid: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }
    return { valid: false, error: 'Google credentials not configured' };
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getGoogleAccessToken(serviceAccount);

    const response = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[IAP] Google API error:', response.status, errorText);
      return { valid: false, error: `Google API error: ${response.status}` };
    }

    const data = await response.json();

    // Check if subscription is active
    // paymentState: 0=pending, 1=received, 2=free trial, 3=deferred
    const isActive = data.paymentState === 1 || data.paymentState === 2;

    if (!isActive) {
      return { valid: false, error: 'Subscription not active' };
    }

    const expiresAt = new Date(parseInt(data.expiryTimeMillis)).toISOString();
    return { valid: true, expiresAt };
  } catch (e) {
    console.error('[IAP] Google verification error:', e);
    return { valid: false, error: String(e) };
  }
}

// Get Google OAuth2 access token
async function getGoogleAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '');
  const data = encoder.encode(`${headerB64}.${payloadB64}`);

  // Import RSA private key
  const keyData = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const key = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(keyData), c => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    data
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const jwt = `${headerB64}.${payloadB64}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

Deno.serve(async (req: Request) => {
  const origin = resolveAllowedOrigin(req);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' }, origin);
  }

  // Verify JWT auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json(401, { error: 'Unauthorized' }, origin);
  }

  const token = authHeader.slice(7);
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify user token
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return json(401, { error: 'Invalid token' }, origin);
  }

  const userId = userData.user.id;

  // Parse request body
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON' }, origin);
  }

  const { platform, productId, receipt } = body;

  if (!platform || !productId || !receipt) {
    return json(400, { error: 'Missing required fields' }, origin);
  }

  // Verify receipt with store
  let result: VerifyResult;
  if (platform === 'apple') {
    result = await verifyApple(receipt, productId);
  } else if (platform === 'google') {
    result = await verifyGoogle(receipt, productId);
  } else {
    return json(400, { error: 'Invalid platform' }, origin);
  }

  if (!result.valid) {
    return json(400, { error: result.error || 'Verification failed' }, origin);
  }

  // Get plan ID
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('id')
    .or(`product_id_ios.eq.${productId},product_id_android.eq.${productId}`)
    .single();

  if (!plan) {
    return json(400, { error: 'Unknown product' }, origin);
  }

  // Upsert subscription
  const { error: upsertError } = await supabase
    .from('user_subscriptions')
    .upsert(
      {
        user_id: userId,
        plan_id: plan.id,
        status: 'active',
        platform,
        original_transaction_id: receipt,
        current_period_start: new Date().toISOString(),
        current_period_end: result.expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (upsertError) {
    console.error('[IAP] Upsert error:', upsertError);
    return json(500, { error: 'Failed to update subscription' }, origin);
  }

  return json(200, { ok: true }, origin);
});
