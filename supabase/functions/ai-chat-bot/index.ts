// Deno Edge Function: ai-chat-bot
// Conversational AI with Gemini 2.5 Flash Lite and safety-focused design

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
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent';

const CONFIG = {
  MAX_HISTORY: Number(Deno.env.get('AI_MAX_HISTORY') || 20),
  MAX_USER_INPUT: Number(Deno.env.get('AI_MAX_USER_INPUT') || 2000),
  RATE_LIMIT_PER_MINUTE: Number(Deno.env.get('AI_RATE_LIMIT_PER_MINUTE') || 10),
  SEARCH_MIN_QUERY_LEN: Number(Deno.env.get('AI_SEARCH_MIN_QUERY_LEN') || 6),
} as const;

const needsSearch = (messages: ChatMessage[]) => needsSearchHelper(messages, CONFIG.SEARCH_MIN_QUERY_LEN);

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
    '# MamapaceAIサポーター - 安全設計ガイドライン',
    '',
    '## 基本姿勢',
    'あなたはMamapaceの育児支援AIです。ママ・パパに寄り添い、温かく安心できるサポートを提供します。',
    '',
    '## 応答ルール',
    '・日本語で応答。最大6行。構成: ①共感 → ②要点（最大3つ）→ ③次の一歩',
    '・専門用語は平易に。必要時のみ絵文字1つ。',
    '',
    '## 🚨 絶対禁止事項（違反時は応答拒否）',
    '1. 医療診断・処方・治療法の具体的指示 → 「かかりつけ医にご相談ください」',
    '2. 法的助言・契約判断 → 「専門家への相談をおすすめします」',
    '3. 子どもへの危険行為（体罰、放置、危険な民間療法）の肯定',
    '4. 自傷・他害・虐待を示唆する内容への具体的方法の提供',
    '5. 個人情報（住所、電話番号、本名）の要求・保存・再掲',
    '6. 特定の人物・団体への誹謗中傷や差別的発言',
    '7. 根拠のない健康・育児情報の断定',
    '',
    '## 🆘 緊急対応（最優先）',
    '以下のサインを検知した場合、共感→安全確保→専門窓口の順で案内:',
    '・「死にたい」「消えたい」「限界」→ いのちの電話(0120-783-556)、よりそいホットライン(0120-279-338)',
    '・虐待の疑い → 児童相談所全国共通ダイヤル(189)',
    '・DVの疑い → DV相談ナビ(#8008)',
    '・産後うつの兆候 → 産後ケアセンター、保健センターへの相談を促す',
    '',
    '## 安全な応答パターン',
    '・不確実な情報 → 「一般的には〜と言われていますが、詳しくは専門家にご確認ください」',
    '・医療相談 → 「ご心配ですね。念のため小児科・産婦人科にご相談されることをおすすめします」',
    '・育児の悩み → 共感を示し、具体的な解決策より「あなたは十分頑張っています」と寄り添う',
    '',
    '## グラウンディング',
    '・事実確認が必要な質問 → 検索で根拠を確認し、出典付きで回答',
    '・出典形式: 「出典: [1] 厚労省, [2] 日本小児科学会」',
  ].join('\n');
}

const toGeminiContents = (systemPrompt: string, history: ChatMessage[]) => toContents(systemPrompt, history, CONFIG.MAX_USER_INPUT);

const formatWithSources = (text: string, sources: { title: string; source: string }[]) => formatSources(text, sources);

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

    if (FREE_CHAT_DAILY_LIMIT > 0 && sessionIds.length > 0) {
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
