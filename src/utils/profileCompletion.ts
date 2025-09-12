import { PostWithMeta } from '../types/post';

export async function fillMissingAvatarUrls(
  client: any,
  items: PostWithMeta[]
): Promise<PostWithMeta[]> {
  const missingAvatarUsers = Array.from(
    new Set(items.filter(it => !it.user?.avatar_url).map(it => it.user_id))
  );
  if (missingAvatarUsers.length === 0) return items;

  const { data: profiles } = await client
    .from('user_profiles')
    .select('id, avatar_url')
    .in('id', missingAvatarUsers);
  const map = new Map((profiles || []).map((p: any) => [p.id, p.avatar_url]));
  return items.map(it =>
    it.user
      ? { ...it, user: { ...it.user, avatar_url: it.user.avatar_url ?? map.get(it.user_id) ?? null } }
      : it
  );
}

export async function fillMaternalVerified(
  client: any,
  items: PostWithMeta[]
): Promise<PostWithMeta[]> {
  const ids = Array.from(new Set(items.map(it => it.user_id)));
  if (ids.length === 0) return items;
  const { data: pubs } = await client
    .from('user_profiles_public')
    .select('id, maternal_verified')
    .in('id', ids);
  const map = new Map((pubs || []).map((p: any) => [p.id, !!p.maternal_verified]));
  return items.map(it =>
    it.user ? { ...it, user: { ...it.user, maternal_verified: map.get(it.user_id) ?? false } } : it
  );
}

