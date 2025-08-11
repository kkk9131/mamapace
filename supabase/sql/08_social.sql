-- Phase: Social Features - User Follows (JWT + RLS + auth.uid())
-- This migration creates user_follows table and v2 RPCs for social features
-- All RPCs use auth.uid() and are granted only to authenticated role

-- 1) Create user_follows table
create table if not exists public.user_follows (
  follower_id uuid not null references public.user_profiles(id) on delete cascade,
  followee_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_follows_pkey primary key (follower_id, followee_id),
  constraint user_follows_no_self_follow check (follower_id != followee_id)
);

-- Create indexes for performance
create index if not exists idx_user_follows_follower on public.user_follows(follower_id);
create index if not exists idx_user_follows_followee on public.user_follows(followee_id);
create index if not exists idx_user_follows_created_at on public.user_follows(created_at desc);

-- 2) Enable RLS
alter table public.user_follows enable row level security;

-- 3) RLS Policies
-- Select: authenticated users can see all follows
create policy "user_follows_select_policy" on public.user_follows
  for select using (auth.role() = 'authenticated');

-- Insert: users can only create follows for themselves
create policy "user_follows_insert_policy" on public.user_follows
  for insert with check (auth.uid() = follower_id);

-- Delete: users can only delete their own follows
create policy "user_follows_delete_policy" on public.user_follows
  for delete using (auth.uid() = follower_id);

-- 4) Revoke direct table access
revoke select, insert, update, delete on table public.user_follows from anon, authenticated;

-- 5) Profile management RPCs

-- Update my profile
create or replace function public.update_my_profile_v2(
  p_display_name text,
  p_bio text,
  p_avatar_emoji text
) returns public.user_profiles
language plpgsql security definer
as $$
declare
  v_profile public.user_profiles;
begin
  -- Validate inputs
  if p_display_name is not null and (length(p_display_name) < 1 or length(p_display_name) > 30) then
    raise exception 'Invalid display name length';
  end if;
  
  if p_bio is not null and length(p_bio) > 500 then
    raise exception 'Bio too long';
  end if;
  
  if p_avatar_emoji is not null and length(p_avatar_emoji) > 10 then
    raise exception 'Invalid avatar emoji';
  end if;

  -- Update profile
  update public.user_profiles
  set 
    display_name = coalesce(p_display_name, display_name),
    bio = coalesce(p_bio, bio),
    avatar_emoji = coalesce(p_avatar_emoji, avatar_emoji),
    updated_at = now()
  where id = auth.uid()
  returning * into v_profile;
  
  if v_profile.id is null then
    raise exception 'Profile not found';
  end if;
  
  return v_profile;
end;
$$;

-- Get my profile
create or replace function public.get_my_profile_v2()
returns public.user_profiles
language sql stable security definer
as $$
  select * from public.user_profiles where id = auth.uid();
$$;

-- 6) Follow management RPCs

-- Follow a user
create or replace function public.follow_user_v2(
  p_target_user_id uuid
) returns boolean
language plpgsql security definer
as $$
begin
  -- Check if target user exists
  if not exists(select 1 from public.user_profiles where id = p_target_user_id) then
    raise exception 'User not found';
  end if;
  
  -- Check for self-follow
  if p_target_user_id = auth.uid() then
    raise exception 'Cannot follow yourself';
  end if;
  
  -- Insert follow relationship (on conflict do nothing)
  insert into public.user_follows (follower_id, followee_id)
  values (auth.uid(), p_target_user_id)
  on conflict (follower_id, followee_id) do nothing;
  
  return found;
end;
$$;

-- Unfollow a user
create or replace function public.unfollow_user_v2(
  p_target_user_id uuid
) returns boolean
language plpgsql security definer
as $$
begin
  delete from public.user_follows
  where follower_id = auth.uid() and followee_id = p_target_user_id;
  
  return found;
end;
$$;

-- Get followers of a user
create or replace function public.get_followers_v2(
  p_user_id uuid,
  p_limit int default 20,
  p_before timestamptz default null
) returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_emoji text,
  followed_at timestamptz
)
language sql stable security definer
as $$
  select 
    up.id as user_id,
    up.username,
    up.display_name,
    up.avatar_emoji,
    uf.created_at as followed_at
  from public.user_follows uf
  join public.user_profiles up on up.id = uf.follower_id
  where uf.followee_id = p_user_id
    and (p_before is null or uf.created_at < p_before)
  order by uf.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

-- Get users that a user is following
create or replace function public.get_following_v2(
  p_user_id uuid,
  p_limit int default 20,
  p_before timestamptz default null
) returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_emoji text,
  followed_at timestamptz
)
language sql stable security definer
as $$
  select 
    up.id as user_id,
    up.username,
    up.display_name,
    up.avatar_emoji,
    uf.created_at as followed_at
  from public.user_follows uf
  join public.user_profiles up on up.id = uf.followee_id
  where uf.follower_id = p_user_id
    and (p_before is null or uf.created_at < p_before)
  order by uf.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

-- Get follow counts for a user
create or replace function public.get_follow_counts_v2(
  p_user_id uuid
) returns table (
  followers bigint,
  following bigint
)
language sql stable security definer
as $$
  select 
    (select count(*) from public.user_follows where followee_id = p_user_id)::bigint as followers,
    (select count(*) from public.user_follows where follower_id = p_user_id)::bigint as following;
$$;

-- Check if current user follows a target user
create or replace function public.is_following_v2(
  p_target_user_id uuid
) returns boolean
language sql stable security definer
as $$
  select exists(
    select 1 from public.user_follows 
    where follower_id = auth.uid() and followee_id = p_target_user_id
  );
$$;

-- 7) Grant execute permissions to authenticated role only
grant execute on function public.update_my_profile_v2 to authenticated;
grant execute on function public.get_my_profile_v2 to authenticated;
grant execute on function public.follow_user_v2 to authenticated;
grant execute on function public.unfollow_user_v2 to authenticated;
grant execute on function public.get_followers_v2 to authenticated;
grant execute on function public.get_following_v2 to authenticated;
grant execute on function public.get_follow_counts_v2 to authenticated;
grant execute on function public.is_following_v2 to authenticated;

-- Note: We do NOT grant to anon role as per requirements