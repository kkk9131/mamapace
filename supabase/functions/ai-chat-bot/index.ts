// Deno Edge Function: ai-chat-bot
// Conversational AI with Gemini 2.0 Flash and optional grounded web search

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { clamp, needsSearch as needsSearchHelper, toGeminiContents as toContents, formatWithSources as formatSources, type ChatMessage as ChatMsg } from './helpers.ts';

type Env = {
  GEMINI_API_KEY: string;
  ALLOWED_ORIGINS?: string; // comma-separated list; if empty => '*'
  GOOGLE_SEARCH_API_KEY?: string; // optional: Programmable Search
  GOOGLE_SEARCH_CX?: string; // optional: Custom Search Engine ID
};

type ChatMessage = ChatMsg;

interface RequestBody {
  messages: ChatMessage[];
  language?: string; // optional language hint
  session_id?: string; // optional: if omitted, a new session will be created
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

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const CONFIG = {
  MAX_HISTORY: Number(Deno.env.get('AI_MAX_HISTORY') || 20),
  MAX_USER_INPUT: Number(Deno.env.get('AI_MAX_USER_INPUT') || 2000),
  RATE_LIMIT_PER_MINUTE: Number(Deno.env.get('AI_RATE_LIMIT_PER_MINUTE') || 10),
  SEARCH_MIN_QUERY_LEN: Number(Deno.env.get('AI_SEARCH_MIN_QUERY_LEN') || 6),
} as const;

const needsSearch = (messages: ChatMessage[]) => needsSearchHelper(messages, CONFIG.SEARCH_MIN_QUERY_LEN);

const PREMIUM_STATUSES = new Set(['active', 'in_trial', 'in_grace']);
const FREE_CHAT_DAILY_LIMIT = Number(Deno.env.get('AI_FREE_DAILY_LIMIT') || 3);

async function googleSearch(query: string): Promise<{ title: string; link: string; source: string }[]> {
  const key = Deno.env.get('GOOGLE_SEARCH_API_KEY') || '';
  const cx = Deno.env.get('GOOGLE_SEARCH_CX') || '';
  if (!key || !cx) return [];
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', key);
  url.searchParams.set('cx', cx);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '3');
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = await res.json();
  const items: any[] = data?.items || [];
  return items.slice(0, 3).map((it: any) => ({
    title: it.title as string,
    link: it.link as string,
    source: (new URL(it.link)).hostname.replace(/^www\./, ''),
  }));
}

function buildSystemPrompt(): string {
  return [
    'あなたはMamapaceのAIサポーターです。常にユーザーに寄り添って応答してください。思いやりがあり、簡潔で、安心できるトーンを保ちます。',
    '公開Webの最新情報が関わる場合、検索ツール（google_search系）で根拠を確認し、出典付きで回答します。',
    '',
    '【トーン・出力フォーマット】（共通）',
    '・日本語・最大6行／回答本文のみ。構成は①共感 → ②要点（・×最大3）→ ③次の一歩 → ④必要時のみ 出典。',
    '・専門用語は平易に言い換え。必要時のみ絵文字1つ。',
    '',
    '【グラウンディング運用】',
    '・「ニュース/価格/統計/規格/法令/日時/バージョン/在庫/場所」に該当→必ずgoogle_search（またはgoogle_search_retrieval）を呼ぶ。',
    '・検索→要点抽出→照合→回答。本文内に必要なら [1][2] を付す。',
    '・出典は6行目に1行で圧縮表示（最大2件、信頼度が高い順）。例：「出典: [1] 厚労省, [2] 消費者庁」',
    '・見つからない場合は「出典なし」と明記し、確認方法を1つ提案。',
    '',
    '【安全と境界】（共通）',
    '・医療・法的助言や危険行為の具体指示は行わない。一般情報+公式窓口案内。',
    '・個人情報は求めない/保存しない/再掲しない。不確実な事実は推測しない。',
    '・差し迫る危険が疑われる場合は、安全確保と緊急窓口を最優先で案内。',
  ].join('\n');
}

const toGeminiContents = (systemPrompt: string, history: ChatMessage[]) => toContents(systemPrompt, history, CONFIG.MAX_USER_INPUT);

const formatWithSources = (text: string, sources: { title: string; source: string }[]) => formatSources(text, sources);

async function userHasPremiumSubscription(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('status, current_period_end')
      .eq('user_id', userId)
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return false;
    const status = String(data.status || '').toLowerCase();
    if (!PREMIUM_STATUSES.has(status)) return false;
    const endAt = data.current_period_end ? Date.parse(data.current_period_end) : null;
    if (Number.isFinite(endAt) && endAt !== null && endAt < Date.now()) {
      return false;
    }
    return true;
  } catch (_) {
    return false;
  }
}

function startOfTodayIso(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

async function generateWithGemini(apiKey: string, contents: any) {
  const payload = {
    contents,
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 512,
    },
    safetySettings: [],
  };
  const res = await fetch(GEMINI_ENDPOINT, {
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
  return (out || '').trim();
}

Deno.serve(async (req) => {
  const allowedOrigin = resolveAllowedOrigin(req);
  try {
    if (req.method !== 'POST') {
      if (req.method === 'OPTIONS') {
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
      return json(405, { error: 'Method Not Allowed' }, allowedOrigin);
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || new URL(req.url).origin;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!GEMINI_API_KEY) {
      return json(500, { error: 'Missing GEMINI_API_KEY' }, allowedOrigin);
    }

    // Require auth (verify_jwt is enabled for this function)
    const authz = req.headers.get('authorization');
    if (!authz || !authz.toLowerCase().startsWith('bearer ')) {
      return json(401, { error: 'Unauthorized' }, allowedOrigin);
    }

    if (!SERVICE_KEY) {
      return json(500, { error: 'Missing service key' }, allowedOrigin);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authz } },
    });

    const body = (await req.json()) as RequestBody;
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    if (messages.length === 0) {
      return json(400, { error: 'messages are required' }, allowedOrigin);
    }
    const sessionIdIn = (body as any)?.session_id as string | undefined;

    // Identify user from JWT via Supabase
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return json(401, { error: 'Unauthorized' }, allowedOrigin);
    }
    const userId = userData.user.id;
    const isPremiumUser = await userHasPremiumSubscription(supabase, userId);

    // Bound history and total input size
    let history = messages.slice(-CONFIG.MAX_HISTORY).map(m => ({
      role: m.role,
      content: clamp(m.content || '', CONFIG.MAX_USER_INPUT),
    }));
    // Ensure total concatenated length stays within ~CONFIG.MAX_HISTORY * MAX_USER_INPUT
    const MAX_TOTAL = CONFIG.MAX_HISTORY * CONFIG.MAX_USER_INPUT;
    let sum = 0;
    history = history.reverse().filter(h => {
      sum += (h.content || '').length;
      return sum <= MAX_TOTAL;
    }).reverse();

    // Decide if we should search
    let sources: { title: string; link: string; source: string }[] = [];
    if (needsSearch(history)) {
      const lastUser = [...history].reverse().find(m => m.role === 'user');
      const query = clamp(lastUser?.content || '', 128);
      try {
        sources = await googleSearch(query);
      } catch (_) {
        sources = [];
      }
    }

    const systemPrompt = buildSystemPrompt();

    // If we have sources, prepend a short reference block for grounding
    const grounding = sources.length
      ? `\n\n参考情報（内部用）:\n${sources
          .slice(0, 2)
          .map((s, i) => `[${i + 1}] ${s.title} (${s.source})`)
          .join('\n')}`
      : '';

    const contents = toGeminiContents(systemPrompt + grounding, history);

    // Ensure session (create if missing)
    let sessionId = sessionIdIn;
    if (!sessionId) {
      const lastUser = [...history].reverse().find(m => m.role === 'user');
      const title = clamp((lastUser?.content || '新しいチャット').split(/\r?\n/)[0], 60);
      const { data: sess, error: sessErr } = await supabase
        .from('ai_chat_sessions')
        .insert({ user_id: userId, title })
        .select('id')
        .single();
      if (sessErr) throw sessErr;
      sessionId = (sess as any).id as string;
    } else {
      // Verify ownership
      const { data: sess, error: ownErr } = await supabase
        .from('ai_chat_sessions')
        .select('id, user_id')
        .eq('id', sessionId)
        .maybeSingle();
      if (ownErr) throw ownErr;
      if (!sess || (sess as any).user_id !== userId) {
        return json(403, { error: 'forbidden' }, allowedOrigin);
      }
    }

    const { data: sessionRows, error: sessionsErr } = await supabase
      .from('ai_chat_sessions')
      .select('id')
      .eq('user_id', userId);
    if (sessionsErr) throw sessionsErr;
    const sessionIds = (sessionRows ?? []).map((s: any) => String(s.id));
    if (!sessionIds.includes(sessionId)) {
      sessionIds.push(sessionId);
    }

    if (!isPremiumUser && FREE_CHAT_DAILY_LIMIT > 0 && sessionIds.length > 0) {
      try {
        const { count: dailyCount, error: dailyErr } = await supabase
          .from('ai_chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'user')
          .in('session_id', sessionIds)
          .gte('created_at', startOfTodayIso());
        if (!dailyErr && typeof dailyCount === 'number' && dailyCount >= FREE_CHAT_DAILY_LIMIT) {
          return json(200, { ok: false, error: 'free_daily_limit' }, allowedOrigin);
        }
      } catch (_) {
        // Ignore counting errors to avoid blocking the request unexpectedly
      }
    }

    if (sessionIds.length > 0) {
      try {
        const since = new Date(Date.now() - 60_000).toISOString();
        const { count, error: cntErr } = await supabase
          .from('ai_chat_messages')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', since)
          .in('session_id', sessionIds);
        if (!cntErr && typeof count === 'number' && count >= CONFIG.RATE_LIMIT_PER_MINUTE) {
          return json(429, { error: 'rate_limited' }, allowedOrigin);
        }
      } catch (_) {}
    }

    // Insert the latest user message (best-effort)
    try {
      const lastUser = [...history].reverse().find(m => m.role === 'user');
      if (lastUser && lastUser.content) {
        await supabase.from('ai_chat_messages').insert({
          session_id: sessionId,
          role: 'user',
          content: clamp(lastUser.content, CONFIG.MAX_USER_INPUT),
        });
      }
    } catch (_) {}

    const raw = await generateWithGemini(GEMINI_API_KEY, contents);
    const formatted = formatWithSources(raw, sources);

    // Record assistant message with sources summary
    try {
      await supabase.from('ai_chat_messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: formatted,
        sources: sources.slice(0, 2),
      });
      // Touch session updated_at
      await supabase
        .from('ai_chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);
    } catch (_) {}

    return json(200, { ok: true, text: formatted, session_id: sessionId }, allowedOrigin);
  } catch (e) {
    console.error('ai-chat-bot error', e);
    return json(500, { error: 'internal_error' }, allowedOrigin);
  }
});
