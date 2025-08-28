import { getSupabaseClient } from './supabaseClient';
import { Post, PostWithMeta, PaginatedResult, Comment } from '../types/post';

const PAGE_SIZE_DEFAULT = 20;

function computeNextCursor<T extends { created_at: string }>(
  items: T[]
): string | null {
  if (!items || items.length === 0) return null;
  const last = items[items.length - 1];
  return last.created_at;
}

export async function fetchHomeFeed(
  options: { before?: string | null; limit?: number } = {}
): Promise<PaginatedResult<PostWithMeta>> {
  const client = getSupabaseClient();
  const before = options.before ?? null;
  const limit = options.limit ?? PAGE_SIZE_DEFAULT;
  const { data, error } = await client.rpc('get_home_feed_v2', {
    p_before: before,
    p_limit: limit,
  });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const items: PostWithMeta[] = rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    body: row.body,
    created_at: row.created_at,
    reaction_summary: {
      count: Number(row.reaction_count ?? 0),
      reactedByMe: false,
    },
    comment_summary: { count: Number(row.comment_count ?? 0) },
    user: {
      id: row.user_id,
      username: row.user_username,
      display_name: row.user_display_name,
      avatar_emoji: row.user_avatar_emoji,
      avatar_url: row.user_avatar_url,
    },
  }));
  return { items, nextCursor: computeNextCursor(items) };
}

export async function fetchMyPosts(options?: {
  before?: string | null;
  limit?: number;
}): Promise<PaginatedResult<PostWithMeta>> {
  const client = getSupabaseClient();
  const before = options?.before ?? null;
  const limit = options?.limit ?? PAGE_SIZE_DEFAULT;
  const { data, error } = await client.rpc('get_user_posts_v2', {
    p_before: before,
    p_limit: limit,
  });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const items: PostWithMeta[] = rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    body: row.body,
    created_at: row.created_at,
    reaction_summary: {
      count: Number(row.reaction_count ?? 0),
      reactedByMe: false,
    },
    comment_summary: { count: Number(row.comment_count ?? 0) },
    user: {
      id: row.user_id,
      username: row.user_username,
      display_name: row.user_display_name,
      avatar_emoji: row.user_avatar_emoji,
      avatar_url: row.user_avatar_url,
    },
  }));
  return { items, nextCursor: computeNextCursor(items) };
}

export async function fetchLikedPosts(options: {
  before?: string | null;
  limit?: number;
}): Promise<PaginatedResult<PostWithMeta>> {
  const client = getSupabaseClient();
  const before = options.before ?? null;
  const limit = options.limit ?? PAGE_SIZE_DEFAULT;
  const { data, error } = await client.rpc('get_liked_posts_v2', {
    p_before: before,
    p_limit: limit,
  });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const items: PostWithMeta[] = rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    body: row.body,
    created_at: row.created_at,
    reaction_summary: {
      count: Number(row.reaction_count ?? 0),
      reactedByMe: true,
    },
    comment_summary: { count: Number(row.comment_count ?? 0) },
    user: {
      id: row.user_id,
      username: row.user_username,
      display_name: row.user_display_name,
      avatar_emoji: row.user_avatar_emoji,
      avatar_url: row.user_avatar_url,
    },
  }));
  return { items, nextCursor: computeNextCursor(items) };
}

export async function createPost(body: string): Promise<Post> {
  if (!body || body.trim().length === 0) throw new Error('投稿が空です');
  if (body.length > 300) throw new Error('投稿は300文字以内にしてください');
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('create_post_v2', { p_body: body });
  if (error) throw error;
  return data as Post;
}

export async function toggleReaction(
  postId: string,
  reacted: boolean
): Promise<{ reacted: boolean; countDelta: number }> {
  const client = getSupabaseClient();

  if (reacted) {
    const { error } = await client.rpc('remove_reaction_v2', {
      p_post_id: postId,
    });
    if (error) throw error;
    return { reacted: false, countDelta: -1 };
  } else {
    const { data, error } = await client.rpc('add_reaction_v2', {
      p_post_id: postId,
    });
    if (error) throw error;
    if (data === false) {
      return { reacted: true, countDelta: 0 };
    }
    return { reacted: true, countDelta: +1 };
  }
}

export async function fetchComments(
  postId: string,
  options?: { before?: string | null; limit?: number }
): Promise<PaginatedResult<Comment>> {
  const client = getSupabaseClient();
  const limit = options?.limit ?? PAGE_SIZE_DEFAULT;
  const before = options?.before ?? null;
  const { data, error } = await client.rpc('get_post_comments_v2', {
    p_post_id: postId,
    p_before: before,
    p_limit: limit,
  });
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
      avatar_emoji: row.user_avatar_emoji,
      avatar_url: row.user_avatar_url,
    },
  })) as Comment[];
  return { items, nextCursor: computeNextCursor(items) };
}

export async function createComment(
  postId: string,
  body: string
): Promise<Comment> {
  if (!body || body.trim().length === 0) throw new Error('コメントが空です');
  if (body.length > 300) throw new Error('コメントは300文字以内にしてください');
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('create_comment_v2', {
    p_post_id: postId,
    p_body: body,
  });
  if (error) throw error;
  return data as Comment;
}

export async function deletePost(postId: string): Promise<boolean> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('delete_post_v2', {
    p_post_id: postId,
  });
  if (error) throw error;
  return !!data;
}

export async function deleteComment(commentId: string): Promise<boolean> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('delete_comment_v2', {
    p_comment_id: commentId,
  });
  if (error) throw error;
  return !!data;
}
