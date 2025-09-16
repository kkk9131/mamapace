import { ServiceError } from '../utils/errors';

import { getSupabaseClient } from './supabaseClient';

export async function blockUser(blockedUserId: string) {
  const supabase = getSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    throw new ServiceError('NOT_AUTHENTICATED', 'Not authenticated');
  }

  const { error } = await supabase
    .from('block_relationships')
    .insert({ blocker_id: user.id, blocked_id: blockedUserId });

  if (error) {
    throw new ServiceError(
      'BLOCK_INSERT_FAILED',
      `[blockUser] ${error.message || 'block insert failed'}`,
      error
    );
  }
}

export async function unblockUser(blockedUserId: string) {
  const supabase = getSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    throw new ServiceError('NOT_AUTHENTICATED', 'Not authenticated');
  }

  const { error } = await supabase
    .from('block_relationships')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedUserId);

  if (error) {
    throw new ServiceError(
      'BLOCK_DELETE_FAILED',
      `[unblockUser] ${error.message || 'block delete failed'}`,
      error
    );
  }
}

export async function listBlockedUsers(): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    throw new ServiceError('NOT_AUTHENTICATED', 'Not authenticated');
  }

  const { data, error } = await supabase
    .from('block_relationships')
    .select('blocked_id')
    .eq('blocker_id', user.id);

  if (error) {
    throw new ServiceError(
      'BLOCK_LIST_FAILED',
      `[listBlockedUsers] ${error.message || 'block list failed'}`,
      error
    );
  }
  return (data ?? []).map(r => r.blocked_id);
}

export async function isBlocked(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    return false;
  }

  const { count, error } = await supabase
    .from('block_relationships')
    .select('*', { count: 'exact', head: true })
    .eq('blocker_id', user.id)
    .eq('blocked_id', userId);

  if (error) {
    throw new ServiceError(
      'BLOCK_CHECK_FAILED',
      `[isBlocked] ${error.message || 'block check failed'}`,
      error
    );
  }
  return (count ?? 0) > 0;
}

export async function isBlockedBatch(userIds: string[]): Promise<Set<string>> {
  const supabase = getSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user || userIds.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from('block_relationships')
    .select('blocked_id')
    .eq('blocker_id', user.id)
    .in('blocked_id', userIds);

  if (error) {
    throw new ServiceError(
      'BLOCK_CHECK_FAILED',
      `[isBlockedBatch] ${error.message || 'block batch check failed'}`,
      error
    );
  }
  return new Set((data ?? []).map((r: any) => r.blocked_id as string));
}
