// Deno Edge Function: ai-compassionate-comment
// Generates a gentle, empathetic comment using Gemini and posts it as a system user

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GEMINI_API_KEY: string;
  SYSTEM_USER_ID: string; // user_profiles.id used to post AI comments
  DAILY_LIMIT?: string; // optional override, default 3
};

interface RequestBody {
  postId: string;
  body: string;
}

// Basic utilities
function jsonResponse(status: number, data: unknown, corsOrigin?: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (corsOrigin) headers['Access-Control-Allow-Origin'] = corsOrigin;
  return new Response(JSON.stringify(data), { status, headers });
}

function clampText(input: string, maxLen = 280): string {
  if (input.length <= maxLen) return input;
  return input.slice(0, maxLen - 1) + '…';
}

// Security/perf constants
const DEFAULT_DAILY_LIMIT = 3;
const RATE_LIMIT_QUERY_LIMIT = 200;
const MAX_INPUT_LEN = 800; // limit prompt input size to Gemini

function sanitizeInput(text: string): string {
  try {
    // Remove control characters except common whitespace, trim and clamp
    const cleaned = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
    return cleaned.length > MAX_INPUT_LEN ? cleaned.slice(0, MAX_INPUT_LEN) + '…' : cleaned;
  } catch {
    return text;
  }
}

async function generateCompassionateText(apiKey: string, postText: string): Promise<string> {
  // Gemini 1.5 Flash REST API call
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
  const systemInstruction = [
    'You are a warm, empathetic assistant supporting parents.',
    'Write one short reply that feels kind, safe, and non-judgmental.',
    'Respond ONLY in Japanese (日本語のみで回答してください)。Do not use English or other languages.',
    'Avoid medical/legal advice, diagnoses, or commands.',
    "Gently mirror the poster's emotion: if low or struggling, softly encourage and validate; if happy or proud, celebrate with them.",
    'Include 1–3 emojis that naturally fit the tone; place them inline or at the end. Avoid irrelevant or repetitive emojis.',
    'If low/struggling, prefer gentle emojis like 💛 🤝 🌿 ☕️; if very negative (sad/grief/exhausted), it is okay to use 💧 😢 🥺 🫂 🌧️ softly; if happy/proud, prefer 🎉 😊 💐 ✨.',
    'Keep it specific to the post, with 1–2 sentences, about 80–200 characters (hard max ~280).',
    'No hashtags and no links.',
  ].join(' ');

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: `${systemInstruction}\n\nPost: ${sanitizeInput(postText)}` },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.8,
      topP: 0.9,
      maxOutputTokens: 200,
    },
    safetySettings: [
      // Keep defaults; we still expect a safe, gentle response
    ],
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${text}`);
  }
  interface GeminiPart { text?: string }
  interface GeminiContent { parts?: GeminiPart[] }
  interface GeminiCandidate { content?: GeminiContent }
  interface GeminiResponse { candidates?: GeminiCandidate[] }
  const data = (await res.json()) as GeminiResponse;
  const out = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return clampText((out || '').trim(), 280);
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      // CORS preflight support
      if (req.method === 'OPTIONS') {
        const allowedOrigin = resolveAllowedOrigin(req);
        if (!allowedOrigin) return new Response(null, { status: 403 });
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'authorization, content-type',
            'Access-Control-Max-Age': '86400',
          },
        });
      }
      return jsonResponse(405, { error: 'Method Not Allowed' }, resolveAllowedOrigin(req));
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || new URL(req.url).origin;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
    const SYSTEM_USER_ID = Deno.env.get('SYSTEM_USER_ID') || '';
    const DAILY_LIMIT = Number(Deno.env.get('DAILY_LIMIT') ?? String(DEFAULT_DAILY_LIMIT));
    const DEBUG_ERRORS = (Deno.env.get('DEBUG_ERRORS') || '').toLowerCase() === 'true';
    const allowedOrigin = resolveAllowedOrigin(req);

    if (!SERVICE_KEY || !GEMINI_API_KEY || !SYSTEM_USER_ID) {
      return jsonResponse(500, {
        error: 'Missing required secrets (SERVICE_ROLE_KEY/GEMINI_API_KEY/SYSTEM_USER_ID)',
        diag: {
          haveServiceKey: !!SERVICE_KEY,
          haveGeminiKey: !!GEMINI_API_KEY,
          haveSystemUser: !!SYSTEM_USER_ID,
        },
      }, allowedOrigin);
    }

    // Explicit auth presence check (verify_jwt also enabled at function level)
    const authz = req.headers.get('authorization');
    if (!authz || !authz.toLowerCase().startsWith('bearer ')) {
      return jsonResponse(401, { error: 'Unauthorized' }, allowedOrigin);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body: RequestBody = await req.json();
    const postId = body?.postId;
    const postText = (body?.body ?? '').toString();
    if (!postId || !postText) {
      return jsonResponse(400, { error: 'postId and body are required' }, allowedOrigin);
    }

    // Fetch post and its author
    const { data: post, error: postErr } = await supabase
      .from('posts')
      .select('id, user_id, created_at')
      .eq('id', postId)
      .maybeSingle();
    if (postErr) throw new Error(`db_fetch_post: ${postErr.message || JSON.stringify(postErr)}`);
    if (!post) return jsonResponse(404, { error: 'Post not found' }, allowedOrigin);

    // Rate limit: max N AI comments per author per day
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    // Fetch today's AI comments (by system user), then filter by target author's posts
    const { data: aiCommentsToday, error: aiErr } = await supabase
      .from('post_comments')
      .select('id, post_id, created_at')
      .eq('user_id', SYSTEM_USER_ID)
      .gte('created_at', since.toISOString())
      .limit(RATE_LIMIT_QUERY_LIMIT);
    if (aiErr) throw new Error(`db_fetch_ai_comments_today: ${aiErr.message || JSON.stringify(aiErr)}`);
    const postIds = Array.from(new Set((aiCommentsToday ?? []).map((c: any) => c.post_id)));
    let matchedCount = 0;
    if (postIds.length > 0) {
      const { data: postsForComments, error: postsErr } = await supabase
        .from('posts')
        .select('id, user_id')
        .in('id', postIds);
      if (postsErr) throw new Error(`db_fetch_posts_for_comments: ${postsErr.message || JSON.stringify(postsErr)}`);
      const mapOwner = new Map((postsForComments ?? []).map((p: any) => [p.id, p.user_id]));
      matchedCount = (aiCommentsToday ?? []).filter((c: any) => mapOwner.get(c.post_id) === post.user_id).length;
    }
    if (matchedCount >= DAILY_LIMIT) {
      return jsonResponse(429, { error: 'daily_limit_reached' }, allowedOrigin);
    }

    // Generate empathetic message
    let aiText = '';
    try {
      aiText = await generateCompassionateText(GEMINI_API_KEY, postText);
    } catch (_) {
      // Fallback message when model rejects/blocks or errors (always Japanese)
      aiText = 'ここにいてくれてありがとう。あなたの気持ちは大切です。無理せず、今できることからで大丈夫ですよ💛';
    }
    if (!aiText) return jsonResponse(200, { skipped: true, reason: 'empty_generation' });

    // Insert comment as system user
    const { data: newComment, error: insertErr } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        user_id: SYSTEM_USER_ID,
        body: aiText,
        attachments: [],
      })
      .select('*')
      .single();
    if (insertErr) throw new Error(`db_insert_comment: ${insertErr.message || JSON.stringify(insertErr)}`);

    return jsonResponse(200, { ok: true, comment: newComment }, allowedOrigin);
  } catch (e) {
    const msg = (e && typeof e === 'object' && 'message' in (e as any))
      ? (e as any).message
      : String(e);
    // Minimal diagnostics without leaking secrets
    const diag = {
      haveServiceKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      haveGeminiKey: !!Deno.env.get('GEMINI_API_KEY'),
      haveSystemUser: !!Deno.env.get('SYSTEM_USER_ID'),
    };
    console.error('ai-compassionate-comment error', msg, diag);
    const allowedOrigin = resolveAllowedOrigin(req);
    const body = (Deno.env.get('DEBUG_ERRORS') || '').toLowerCase() === 'true'
      ? { error: msg, diag }
      : { error: 'internal_error' };
    return jsonResponse(500, body, allowedOrigin);
  }
});

// CORS: resolve allowed origin based on env ALLOWED_ORIGINS (comma-separated). Default '*' if unset.
function resolveAllowedOrigin(req: Request): string | null {
  const conf = (Deno.env.get('ALLOWED_ORIGINS') || '').trim();
  if (!conf) return '*';
  const set = new Set(conf.split(',').map(s => s.trim()).filter(Boolean));
  const origin = req.headers.get('origin');
  if (origin && set.has(origin)) return origin;
  return null;
}
