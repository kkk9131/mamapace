import { getSupabaseClient } from './supabaseClient';
import { Post, PostWithMeta, PaginatedResult, Comment, Attachment } from '../types/post';

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
    p_offset_time: before,
    p_limit: limit,
  });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  let items: PostWithMeta[] = rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    body: row.body,
    created_at: row.created_at,
    attachments: row.attachments || [],
    reaction_summary: {
      count: Number(row.reaction_count ?? 0),
      reactedByMe: false,
    },
    comment_summary: { count: Number(row.comment_count ?? 0) },
    user: {
      id: row.user_id,
      // DBの関数によりカラム名が異なるケースに両対応
      username: row.user_username ?? row.username ?? '',
      display_name: row.user_display_name ?? row.display_name ?? null,
      avatar_emoji: row.user_avatar_emoji ?? row.avatar_emoji ?? null,
      avatar_url: row.user_avatar_url ?? row.avatar_url ?? null,
    },
  }));

  // avatar_url が欠けている場合は一括で取得して補完
  const missingAvatarUsers = Array.from(
    new Set(items.filter(it => !it.user?.avatar_url).map(it => it.user_id))
  );
  if (missingAvatarUsers.length > 0) {
    const { data: profiles } = await client
      .from('user_profiles')
      .select('id, avatar_url')
      .in('id', missingAvatarUsers);
    const map = new Map((profiles || []).map(p => [p.id, p.avatar_url]));
    items = items.map(it =>
      it.user
        ? { ...it, user: { ...it.user, avatar_url: it.user.avatar_url ?? map.get(it.user_id) ?? null } }
        : it
    );
  }
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
    p_offset_time: before,
    p_limit: limit,
  });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  let items: PostWithMeta[] = rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    body: row.body,
    created_at: row.created_at,
    attachments: row.attachments || [],
    reaction_summary: {
      count: Number(row.reaction_count ?? 0),
      reactedByMe: false,
    },
    comment_summary: { count: Number(row.comment_count ?? 0) },
    user: {
      id: row.user_id,
      username: row.user_username ?? row.username ?? '',
      display_name: row.user_display_name ?? row.display_name ?? null,
      avatar_emoji: row.user_avatar_emoji ?? row.avatar_emoji ?? null,
      avatar_url: row.user_avatar_url ?? row.avatar_url ?? null,
    },
  }));
  {
    const missing = Array.from(
      new Set(items.filter(it => !it.user?.avatar_url).map(it => it.user_id))
    );
    if (missing.length > 0) {
      const { data: profiles } = await client
        .from('user_profiles')
        .select('id, avatar_url')
        .in('id', missing);
      const map = new Map((profiles || []).map(p => [p.id, p.avatar_url]));
      items = items.map(it =>
        it.user
          ? { ...it, user: { ...it.user, avatar_url: it.user.avatar_url ?? map.get(it.user_id) ?? null } }
          : it
      );
    }
  }
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
    p_offset_time: before,
    p_limit: limit,
  });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  let items: PostWithMeta[] = rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    body: row.body,
    created_at: row.created_at,
    attachments: row.attachments || [],
    reaction_summary: {
      count: Number(row.reaction_count ?? 0),
      reactedByMe: true,
    },
    comment_summary: { count: Number(row.comment_count ?? 0) },
    user: {
      id: row.user_id,
      username: row.user_username ?? row.username ?? '',
      display_name: row.user_display_name ?? row.display_name ?? null,
      avatar_emoji: row.user_avatar_emoji ?? row.avatar_emoji ?? null,
      avatar_url: row.user_avatar_url ?? row.avatar_url ?? null,
    },
  }));
  {
    const missing = Array.from(
      new Set(items.filter(it => !it.user?.avatar_url).map(it => it.user_id))
    );
    if (missing.length > 0) {
      const { data: profiles } = await client
        .from('user_profiles')
        .select('id, avatar_url')
        .in('id', missing);
      const map = new Map((profiles || []).map(p => [p.id, p.avatar_url]));
      items = items.map(it =>
        it.user
          ? { ...it, user: { ...it.user, avatar_url: it.user.avatar_url ?? map.get(it.user_id) ?? null } }
          : it
      );
    }
  }
  return { items, nextCursor: computeNextCursor(items) };
}

export async function createPost(body: string, attachments?: Attachment[]): Promise<Post> {
  if ((!body || body.trim().length === 0) && (!attachments || attachments.length === 0)) {
    throw new Error('投稿内容または画像を追加してください');
  }
  if (body && body.length > 300) throw new Error('投稿は300文字以内にしてください');
  const client = getSupabaseClient();
  const bodyToSend = (body && body.trim().length > 0)
    ? body.trim()
    : ((attachments && attachments.length > 0) ? '[image]' : '');
  const { data, error } = await client.rpc('create_post_v2', {
    p_body: bodyToSend,
    p_attachments: attachments && attachments.length ? attachments : [],
  });
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
    p_offset_time: before,
    p_limit: limit,
  });
  if (error) throw error;
  let items = (data ?? []).map((row: any) => ({
    id: row.id,
    post_id: row.post_id,
    user_id: row.user_id,
    body: row.body,
    created_at: row.created_at,
    attachments: row.attachments || [],
    user: {
      id: row.user_id,
      username: row.user_username ?? row.username ?? '',
      display_name: row.user_display_name ?? row.display_name ?? null,
      avatar_emoji: row.user_avatar_emoji ?? row.avatar_emoji ?? null,
      avatar_url: row.user_avatar_url ?? row.avatar_url ?? null,
    },
  })) as Comment[];
  {
    const missing = Array.from(
      new Set(items.filter(it => !it.user?.avatar_url).map(it => it.user_id))
    );
    if (missing.length > 0) {
      const { data: profiles } = await client
        .from('user_profiles')
        .select('id, avatar_url')
        .in('id', missing);
      const map = new Map((profiles || []).map(p => [p.id, p.avatar_url]));
      items = items.map(it =>
        it.user
          ? { ...it, user: { ...it.user, avatar_url: it.user.avatar_url ?? map.get(it.user_id) ?? null } }
          : it
      ) as Comment[];
    }
  }
  return { items, nextCursor: computeNextCursor(items) };
}

export async function createComment(
  postId: string,
  body: string,
  attachments?: Attachment[]
): Promise<Comment> {
  if ((!body || body.trim().length === 0) && (!attachments || attachments.length === 0)) {
    throw new Error('コメント内容または画像を追加してください');
  }
  if (body && body.length > 300) throw new Error('コメントは300文字以内にしてください');
  const client = getSupabaseClient();
  const bodyToSend = (body && body.trim().length > 0)
    ? body.trim()
    : ((attachments && attachments.length > 0) ? '[image]' : '');
  // まずは新シグネチャ (uuid, text, jsonb) を試す。存在しない環境ではフォールバックする。
  const tryAttachments = async () =>
    await client.rpc('create_comment_v2', {
      p_post_id: postId,
      p_body: bodyToSend,
      p_attachments: attachments && attachments.length ? attachments : [],
    });
  const tryLegacy = async () =>
    await client.rpc('create_comment_v2', {
      p_post_id: postId,
      p_body: bodyToSend,
    } as any);

  let res = await tryAttachments();
  if (res.error) {
    const msg = String(res.error?.message || '');
    // 代表的なエラー: 関数が無い/引数数が合わない/attachments列が無い
    if (/does not exist|No function matches the given name|argument|attachments/i.test(msg) || (res as any).code === '42883') {
      res = await tryLegacy();
    }
  }
  if (res.error) throw res.error;
  return res.data as Comment;
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
