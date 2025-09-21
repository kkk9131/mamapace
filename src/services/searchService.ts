import { getSupabaseClient } from './supabaseClient';

export type QueryKind = 'user' | 'hashtag' | 'none';

export type SearchUserItem = {
  id: string;
  username: string;
  displayName?: string | null;
  // Emoji-based avatar used in this app's schema
  avatarEmoji?: string | null;
  // Optional URL avatar for future support; not used currently
  avatarUrl?: string | null;
};

export type SearchPostItem = {
  id: string;
  author: SearchUserItem;
  contentPreview: string;
  createdAt: string;
};

export function parseQuery(q: string): { kind: QueryKind; term: string } {
  const raw = (q || '').trim();
  if (!raw) {
    return { kind: 'none', term: '' };
  }

  if (raw.startsWith('@')) {
    // @ ではユーザー名だけでなく表示名も検索対象にするため
    // 文字種を制限せず、Unicode 正規化 + トリムのみ行う
    const term = raw
      .slice(1)
      .normalize('NFKC')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 48);
    return { kind: term ? 'user' : 'none', term };
  }
  if (raw.startsWith('#')) {
    // 日本語タグ対応: 全角含む文字を許容（Unicodeの文字/数字、_、中点・長音）
    const normalized = raw.slice(1).normalize('NFKC');
    const term = (normalized.match(/[\p{L}\p{N}_ー・]+/gu)?.join('') || '')
      .trim()
      .slice(0, 48);
    return { kind: term ? 'hashtag' : 'none', term };
  }

  return { kind: 'none', term: '' };
}

export async function searchUsers(
  term: string,
  opts?: { limit?: number; cursor?: string }
): Promise<{ items: SearchUserItem[]; nextCursor?: string | null }> {
  const client = getSupabaseClient();
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);
  const q = `%${term}%`;

  // username と display_name を両方対象に検索
  const makeBase = () =>
    client.from('user_profiles').select('id, username, display_name, avatar_emoji');

  const [byUsername, byDisplayName] = await Promise.all([
    makeBase().ilike('username', q).order('username', { ascending: true }),
    makeBase().ilike('display_name', q).order('display_name', { ascending: true }),
  ]);

  if (byUsername.error) throw byUsername.error;
  if (byDisplayName.error) throw byDisplayName.error;

  const seen = new Set<string>();
  const merged: any[] = [];
  for (const r of byUsername.data || []) {
    const id = String(r.id);
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(r);
    }
  }
  for (const r of byDisplayName.data || []) {
    const id = String(r.id);
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(r);
    }
  }

  const items: SearchUserItem[] = merged.slice(0, limit).map((r: any) => ({
    id: String(r.id),
    username: String(r.username),
    displayName: r.display_name ?? null,
    avatarEmoji: r.avatar_emoji ?? null,
    avatarUrl: null,
  }));
  return { items, nextCursor: null };
}

export async function searchPostsByHashtag(
  tag: string,
  opts?: { limit?: number; cursor?: string }
): Promise<{ items: SearchPostItem[]; nextCursor?: string | null }> {
  const client = getSupabaseClient();
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);

  // 1) hashtag から post_id 群を取得
  const { data: ids, error: idErr } = await client
    .from('post_hashtags')
    .select('post_id')
    .eq('tag', tag)
    .limit(200);
  if (idErr) {
    throw idErr;
  }
  const postIds = (ids || []).map(x => x.post_id);
  if (!postIds.length) {
    return { items: [], nextCursor: null };
  }

  // 2) posts_filtered ビューから投稿を取得（RLS/権限下で読める）
  const { data: posts, error: postErr } = await client
    .from('posts_filtered')
    .select('id, user_id, body, created_at')
    .in('id', postIds)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (postErr) {
    throw postErr;
  }

  const authorsNeeded = Array.from(
    new Set((posts || []).map((p: any) => String(p.user_id))),
  );

  // 3) 著者プロフィールをまとめて取得
  let authorMap = new Map<string, any>();
  if (authorsNeeded.length) {
    const { data: authors, error: authorErr } = await client
      .from('user_profiles')
      .select('id, username, display_name, avatar_emoji')
      .in('id', authorsNeeded);
    if (authorErr) {
      throw authorErr;
    }
    authorMap = new Map((authors || []).map((a: any) => [String(a.id), a]));
  }

  const items: SearchPostItem[] = (posts || []).map((p: any) => {
    const a = authorMap.get(String(p.user_id)) || {};
    return {
      id: String(p.id),
      contentPreview: String(p.body || '').slice(0, 120),
      createdAt: String(p.created_at),
      author: {
        id: String(a.id || ''),
        username: String(a.username || ''),
        displayName: a.display_name ?? null,
        avatarEmoji: a.avatar_emoji ?? null,
        avatarUrl: null,
      },
    };
  });

  return { items, nextCursor: null };
}
