// Generic helpers that operate on any item having user_id and optional user fields
type UserLike = {
  avatar_url?: string | null;
  maternal_verified?: boolean | null;
};
type HasUser<TUser extends object = UserLike> = {
  user_id: string;
  user?: TUser;
};

export async function fillMissingAvatarUrls<T extends HasUser<UserLike>>(
  client: any,
  items: T[]
): Promise<T[]> {
  const missingAvatarUsers = Array.from(
    new Set(items.filter(it => !it.user?.avatar_url).map(it => it.user_id))
  );
  if (missingAvatarUsers.length === 0) {
    return items;
  }

  const { data: profiles } = await client
    .from('user_profiles')
    .select('id, avatar_url')
    .in('id', missingAvatarUsers);
  const map = new Map((profiles || []).map((p: any) => [p.id, p.avatar_url]));
  return items.map(it => {
    if (!it.user) {
      return it;
    }
    const avatar = it.user.avatar_url ?? map.get(it.user_id) ?? null;
    return { ...it, user: { ...it.user, avatar_url: avatar } } as T;
  });
}

export async function fillMaternalVerified<T extends HasUser<UserLike>>(
  client: any,
  items: T[]
): Promise<T[]> {
  const ids = Array.from(new Set(items.map(it => it.user_id)));
  if (ids.length === 0) {
    return items;
  }
  const { data: pubs } = await client
    .from('user_profiles_public')
    .select('id, maternal_verified')
    .in('id', ids);
  const map = new Map(
    (pubs || []).map((p: any) => [p.id, !!p.maternal_verified]),
  );
  return items.map(it => {
    if (!it.user) {
      return it;
    }
    const verified = map.get(it.user_id) ?? false;
    return { ...it, user: { ...it.user, maternal_verified: verified } } as T;
  });
}
