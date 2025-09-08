import { getSupabaseClient } from './supabaseClient';

export type AIChatSession = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type AIChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  sources?: any | null;
};

export async function listAISessions(): Promise<AIChatSession[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data || []) as AIChatSession[];
}

export async function fetchAIMessages(sessionId: string): Promise<AIChatMessage[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ai_chat_messages')
    .select('id, role, content, created_at, sources')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data || []) as AIChatMessage[];
}

export async function createAISession(title?: string): Promise<AIChatSession> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('認証が必要です');
  }
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .insert({ user_id: user.id, title: title ?? null })
    .select('id, title, created_at, updated_at')
    .single();
  if (error) throw new Error(error.message);
  return data as AIChatSession;
}

export async function deleteAISession(sessionId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('ai_chat_sessions')
    .delete()
    .eq('id', sessionId);
  if (error) throw new Error(error.message);
}

export async function updateAISessionTitle(
  sessionId: string,
  title: string | null
): Promise<AIChatSession> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select('id, title, created_at, updated_at')
    .single();
  if (error) throw new Error(error.message);
  return data as AIChatSession;
}

export async function getAISession(sessionId: string): Promise<AIChatSession | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .select('id, title, created_at, updated_at')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AIChatSession) || null;
}
