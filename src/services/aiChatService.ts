import { getSupabaseClient } from './supabaseClient';

export type AIMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export interface AIChatSuccessResponse {
  ok: true;
  text: string;
  session_id?: string;
}

export interface AIChatErrorResponse {
  ok: false;
  error: string;
  code?: 'rate_limited' | 'unauthorized' | 'internal_error' | 'bad_request';
}

export type AIChatResponse = AIChatSuccessResponse | AIChatErrorResponse;

export async function sendAIChat(
  messages: AIMessage[],
  sessionId?: string
): Promise<AIChatResponse> {
  const client = getSupabaseClient();
  try {
    const { data, error } = await client.functions.invoke('ai-chat-bot', {
      body: { messages, session_id: sessionId },
    });
    if (error) {
      const msg = (error as any)?.message || 'invoke_error';
      return { ok: false, error: msg };
    }
    const d = data as {
      ok?: boolean;
      text?: string;
      session_id?: string;
      error?: string;
    };
    if (!d || d.ok !== true || !d.text) {
      return { ok: false, error: d?.error || 'internal_error' };
    }
    return { ok: true, text: d.text, session_id: d.session_id };
  } catch (e: any) {
    const msg = String(e?.message || e);
    return { ok: false, error: msg };
  }
}
