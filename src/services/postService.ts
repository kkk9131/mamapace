import { getSupabaseClient } from './supabaseClient';
import { Post, PostWithMeta, PaginatedResult, Comment } from '../types/post';

const PAGE_SIZE_DEFAULT = 20;

function computeNextCursor<T extends { created_at: string }>(items: T[]): string | null {
  if (!items || items.length === 0) return null;
  const last = items[items.length - 1];
  return last.created_at;
}

export async function fetchHomeFeed(options: { before?: string | null; limit?: number; currentUserId?: string } = {}): Promise<PaginatedResult<PostWithMeta>> {
  const client = getSupabaseClient();
  const before = options.before ?? null;
  const limit = options.limit ?? PAGE_SIZE_DEFAULT;
  const { data, error } = await client.rpc('get_home_feed', { p_before: before, p_limit: limit });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const items: PostWithMeta[] = rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    body: row.body,
    created_at: row.created_at,
    reaction_summary: { count: Number(row.reaction_count ?? 0), reactedByMe: false },
    comment_summary: { count: Number(row.comment_count ?? 0) },
    user: {
      id: row.user_id,
      username: row.user_username,
      display_name: row.user_display_name,
      avatar_emoji: row.user_avatar_emoji
    }
  }));
  return { items, nextCursor: computeNextCursor(items) };
}

export async function fetchUserPosts(userId: string, options?: { before?: string | null; limit?: number }): Promise<PaginatedResult<PostWithMeta>> {
  const client = getSupabaseClient();
  const before = options?.before ?? null;
  const limit = options?.limit ?? PAGE_SIZE_DEFAULT;
  const { data, error } = await client.rpc('get_user_posts', { p_user_id: userId, p_before: before, p_limit: limit });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const items: PostWithMeta[] = rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    body: row.body,
    created_at: row.created_at,
    reaction_summary: { count: Number(row.reaction_count ?? 0), reactedByMe: false },
    comment_summary: { count: Number(row.comment_count ?? 0) },
    user: {
      id: row.user_id,
      username: row.user_username,
      display_name: row.user_display_name,
      avatar_emoji: row.user_avatar_emoji
    }
  }));
  return { items, nextCursor: computeNextCursor(items) };
}

export async function fetchLikedPosts(options: { before?: string | null; limit?: number; userId: string }): Promise<PaginatedResult<PostWithMeta>> {
  const client = getSupabaseClient();
  const before = options.before ?? null;
  const limit = options.limit ?? PAGE_SIZE_DEFAULT;
  const userId = options.userId;
  const { data, error } = await client.rpc('get_liked_posts', { p_user_id: userId, p_before: before, p_limit: limit });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const items: PostWithMeta[] = rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    body: row.body,
    created_at: row.created_at,
    reaction_summary: { count: Number(row.reaction_count ?? 0), reactedByMe: true },
    comment_summary: { count: Number(row.comment_count ?? 0) },
    user: {
      id: row.user_id,
      username: row.user_username,
      display_name: row.user_display_name,
      avatar_emoji: row.user_avatar_emoji
    }
  }));
  return { items, nextCursor: computeNextCursor(items) };
}

export async function createPost(userId: string, body: string): Promise<Post> {
  if (!body || body.trim().length === 0) throw new Error('投稿が空です');
  if (body.length > 300) throw new Error('投稿は300文字以内にしてください');
  const client = getSupabaseClient();
  if (!userId) throw new Error('ログインが必要です');
  // Prefer RPC to bypass RLS when not using Supabase Auth
  try {
    const { data, error } = await client.rpc('create_post', { p_user_id: userId, p_body: body });
    if (error) throw error;
    return data as Post;
  } catch {
    const { data, error } = await client.from('posts').insert({ body, user_id: userId }).select().single();
    if (error) throw error;
    return data as Post;
  }
}

export async function toggleReaction(userId: string, postId: string, reacted: boolean): Promise<{ reacted: boolean; countDelta: number }> {
  const client = getSupabaseClient();
  if (!userId) throw new Error('ログインが必要です');

  if (reacted) {
    // remove reaction
    try {
      const { data, error } = await client.rpc('remove_reaction', { p_user_id: userId, p_post_id: postId });
      if (error) throw error;
    } catch {
      const { error } = await client.from('post_reactions').delete().eq('post_id', postId).eq('user_id', userId);
      if (error) throw error;
    }
    return { reacted: false, countDelta: -1 };
  } else {
    try {
      const { data, error } = await client.rpc('add_reaction', { p_user_id: userId, p_post_id: postId });
      if (error) throw error;
      if (data === false) {
        // already reacted, no change
        return { reacted: true, countDelta: 0 };
      }
    } catch (rpcErr) {
      const { error } = await client.from('post_reactions').insert({ post_id: postId, user_id: userId });
      if (error) {
        // unique violation -> already reacted
        if ((error as any).code === '23505') {
          return { reacted: true, countDelta: 0 };
        }
        throw error;
      }
    }
    return { reacted: true, countDelta: +1 };
  }
}

export async function fetchComments(postId: string, options?: { before?: string | null; limit?: number }): Promise<PaginatedResult<Comment>> {
  const client = getSupabaseClient();
  const limit = options?.limit ?? PAGE_SIZE_DEFAULT;
  const before = options?.before ?? null;
  const { data, error } = await client.rpc('get_post_comments', { p_post_id: postId, p_before: before, p_limit: limit });
  if (error) throw error;
  const items = (data ?? []).map((row: any) => ({
    id: row.id,
    post_id: row.post_id,
    user_id: row.user_id,
    body: row.body,
    created_at: row.created_at,
    user: {
      id: row.user_id,
      username: row.user_username,
      display_name: row.user_display_name,
      avatar_emoji: row.user_avatar_emoji
    }
  })) as Comment[];
  return { items, nextCursor: computeNextCursor(items) };
}

export async function createComment(userId: string, postId: string, body: string): Promise<Comment> {
  if (!body || body.trim().length === 0) throw new Error('コメントが空です');
  if (body.length > 300) throw new Error('コメントは300文字以内にしてください');
  const client = getSupabaseClient();
  if (!userId) throw new Error('ログインが必要です');
  try {
    const { data, error } = await client.rpc('create_comment', { p_user_id: userId, p_post_id: postId, p_body: body });
    if (error) throw error;
    return data as Comment;
  } catch {
    const { data, error } = await client
      .from('post_comments')
      .insert({ post_id: postId, user_id: userId, body })
      .select()
      .single();
    if (error) throw error;
    return data as Comment;
  }
}

export async function deletePost(userId: string, postId: string): Promise<boolean> {
  const client = getSupabaseClient();
  try {
    const { data, error } = await client.rpc('delete_post', { p_user_id: userId, p_post_id: postId });
    if (error) throw error;
    return !!data;
  } catch {
    const { error } = await client.from('posts').delete().eq('id', postId).eq('user_id', userId);
    if (error) throw error;
    return true;
  }
}

export async function deleteComment(userId: string, commentId: string): Promise<boolean> {
  const client = getSupabaseClient();
  try {
    const { data, error } = await client.rpc('delete_comment', { p_user_id: userId, p_comment_id: commentId });
    if (error) throw error;
    return !!data;
  } catch {
    const { error } = await client.from('post_comments').delete().eq('id', commentId).eq('user_id', userId);
    if (error) throw error;
    return true;
  }
}
