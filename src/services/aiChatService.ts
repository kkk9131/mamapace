import { getSupabaseClient } from './supabaseClient';

export type AIMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export async function sendAIChat(
  messages: AIMessage[],
  sessionId?: string
): Promise<{ ok: boolean; text?: string; error?: string; session_id?: string }>
{
  const client = getSupabaseClient();
  try {
    const { data, error } = await client.functions.invoke('ai-chat-bot', {
      body: { messages, session_id: sessionId },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, text: (data as any)?.text, session_id: (data as any)?.session_id };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}
