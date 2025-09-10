import { getSupabaseClient } from './supabaseClient';

export async function blockUser(blockedUserId: string) {
  const supabase = getSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('block_relationships')
    .insert({ blocker_id: user.id, blocked_id: blockedUserId });

  if (error) {
    throw new Error(`[blockUser] failed: ${error.message || 'unknown error'}`);
  }
}

export async function unblockUser(blockedUserId: string) {
  const supabase = getSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('block_relationships')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedUserId);

  if (error) {
    throw new Error(`[unblockUser] failed: ${error.message || 'unknown error'}`);
  }
}

export async function listBlockedUsers(): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('block_relationships')
    .select('blocked_id')
    .eq('blocker_id', user.id);

  if (error) {
    throw new Error(`[listBlockedUsers] failed: ${error.message || 'unknown error'}`);
  }
  return (data ?? []).map(r => r.blocked_id);
}

export async function isBlocked(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return false;

  const { count, error } = await supabase
    .from('block_relationships')
    .select('*', { count: 'exact', head: true })
    .eq('blocker_id', user.id)
    .eq('blocked_id', userId);

  if (error) {
    throw new Error(`[isBlocked] failed: ${error.message || 'unknown error'}`);
  }
  return (count ?? 0) > 0;
}
