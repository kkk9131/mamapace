import { getSupabaseClient } from './supabaseClient';
import { PublicUserProfile } from '../types/auth';
import { secureLogger } from '../utils/privacyProtection';

// Types for follow features
export interface FollowUser {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_emoji: string | null;
  followed_at: string;
}

export interface FollowCounts {
  followers: number;
  following: number;
}

export interface ProfileUpdateInput {
  display_name?: string;
  bio?: string;
  avatar_emoji?: string;
}

// Profile management functions

export async function getMyProfile(): Promise<PublicUserProfile> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('get_my_profile_v2');
  
  if (error) {
    secureLogger.error('Failed to fetch profile:', error);
    throw new Error('プロフィールの取得に失敗しました');
  }
  
  if (!data) {
    throw new Error('プロフィールが見つかりません');
  }
  
  return data as PublicUserProfile;
}

export async function getUserProfile(userId: string): Promise<PublicUserProfile> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('get_user_profile_v2', {
    p_user_id: userId
  });
  
  if (error) {
    secureLogger.error('Failed to fetch user profile:', error);
    throw new Error('ユーザープロフィールの取得に失敗しました');
  }
  
  if (!data) {
    throw new Error('ユーザーが見つかりません');
  }
  
  return data as PublicUserProfile;
}

export async function updateMyProfile(input: ProfileUpdateInput): Promise<PublicUserProfile> {
  // Validate inputs
  if (input.display_name !== undefined) {
    if (input.display_name.length < 1 || input.display_name.length > 30) {
      throw new Error('表示名は1〜30文字で入力してください');
    }
  }
  
  if (input.bio !== undefined && input.bio.length > 500) {
    throw new Error('自己紹介は500文字以内で入力してください');
  }
  
  if (input.avatar_emoji !== undefined && input.avatar_emoji.length > 10) {
    throw new Error('絵文字が無効です');
  }
  
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('update_my_profile_v2', {
    p_display_name: input.display_name ?? null,
    p_bio: input.bio ?? null,
    p_avatar_emoji: input.avatar_emoji ?? null
  });
  
  if (error) {
    secureLogger.error('Failed to update profile:', error);
    throw new Error('プロフィールの更新に失敗しました');
  }
  
  if (!data) {
    throw new Error('プロフィールの更新に失敗しました');
  }
  
  return data as PublicUserProfile;
}

// Follow management functions

export async function getFollowers(
  userId: string,
  options?: { before?: string | null; limit?: number }
): Promise<{ items: FollowUser[]; nextCursor: string | null }> {
  const client = getSupabaseClient();
  const limit = options?.limit ?? 20;
  const before = options?.before ?? null;
  
  const { data, error } = await client.rpc('get_followers_v2', {
    p_user_id: userId,
    p_limit: limit,
    p_before: before
  });
  
  if (error) {
    secureLogger.error('Failed to fetch followers:', error);
    throw new Error('フォロワーの取得に失敗しました');
  }
  
  const items = (data ?? []) as FollowUser[];
  const nextCursor = items.length > 0 ? items[items.length - 1].followed_at : null;
  
  return { items, nextCursor };
}

export async function getFollowing(
  userId: string,
  options?: { before?: string | null; limit?: number }
): Promise<{ items: FollowUser[]; nextCursor: string | null }> {
  const client = getSupabaseClient();
  const limit = options?.limit ?? 20;
  const before = options?.before ?? null;
  
  const { data, error } = await client.rpc('get_following_v2', {
    p_user_id: userId,
    p_limit: limit,
    p_before: before
  });
  
  if (error) {
    secureLogger.error('Failed to fetch following:', error);
    throw new Error('フォロー中の取得に失敗しました');
  }
  
  const items = (data ?? []) as FollowUser[];
  const nextCursor = items.length > 0 ? items[items.length - 1].followed_at : null;
  
  return { items, nextCursor };
}

export async function followUser(targetUserId: string): Promise<boolean> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('follow_user_v2', {
    p_target_user_id: targetUserId
  });
  
  if (error) {
    secureLogger.error('Failed to follow user:', error);
    throw new Error('フォローに失敗しました');
  }
  
  return !!data;
}

export async function unfollowUser(targetUserId: string): Promise<boolean> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('unfollow_user_v2', {
    p_target_user_id: targetUserId
  });
  
  if (error) {
    secureLogger.error('Failed to unfollow user:', error);
    throw new Error('フォロー解除に失敗しました');
  }
  
  return !!data;
}

export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('get_follow_counts_v2', {
    p_user_id: userId
  });
  
  if (error) {
    secureLogger.error('Failed to fetch follow counts:', error);
    throw new Error('フォロー数の取得に失敗しました');
  }
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return { followers: 0, following: 0 };
  }
  
  const counts = data[0];
  return {
    followers: Number(counts.followers ?? 0),
    following: Number(counts.following ?? 0)
  };
}

export async function isFollowing(targetUserId: string): Promise<boolean> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('is_following_v2', {
    p_target_user_id: targetUserId
  });
  
  if (error) {
    secureLogger.error('Failed to check follow status:', error);
    return false;
  }
  
  return !!data;
}