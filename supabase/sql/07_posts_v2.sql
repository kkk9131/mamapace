-- Phase: Posts/Reactions/Comments - V2 (JWT + RLS + auth.uid())
-- This migration creates v2 RPCs that remove p_user_id parameters
-- and rely on auth.uid() under RLS. It also revokes direct table privileges
-- and grants EXECUTE only to the required RPCs for role `authenticated`.

-- 0) Safety: ensure RLS is enabled (idempotent)
alter table if exists public.posts enable row level security;
alter table if exists public.post_reactions enable row level security;
alter table if exists public.post_comments enable row level security;

-- 1) Revoke direct table privileges from anon/authenticated
revoke select, insert, update, delete on table public.posts from anon, authenticated;
revoke select, insert, update, delete on table public.post_reactions from anon, authenticated;
revoke select, insert, update, delete on table public.post_comments from anon, authenticated;

-- 2) v2 RPCs (auth.uid() based)

-- Feed (authenticated can read all via RLS policy)
create or replace function public.get_home_feed_v2(
  p_limit int default 20,
  p_before timestamptz default null
) returns table (
  id uuid,
  user_id uuid,
  body text,
  created_at timestamptz,
  user_username text,
  user_display_name text,
  user_avatar_emoji text,
  reaction_count bigint,
  comment_count bigint
) language sql stable security definer as $$
  select p.id,
         p.user_id,
         p.body,
         p.created_at,
         u.username as user_username,
         u.display_name as user_display_name,
         u.avatar_emoji as user_avatar_emoji,
         (select count(*) from public.post_reactions r where r.post_id = p.id) as reaction_count,
         (select count(*) from public.post_comments c where c.post_id = p.id) as comment_count
  from public.posts p
  join public.user_profiles u on u.id = p.user_id
  where (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

-- My posts (current user)
create or replace function public.get_user_posts_v2(
  p_limit int default 20,
  p_before timestamptz default null
) returns table (
  id uuid,
  user_id uuid,
  body text,
  created_at timestamptz,
  user_username text,
  user_display_name text,
  user_avatar_emoji text,
  reaction_count bigint,
  comment_count bigint
) language sql stable security definer as $$
  select p.id,
         p.user_id,
         p.body,
         p.created_at,
         u.username as user_username,
         u.display_name as user_display_name,
         u.avatar_emoji as user_avatar_emoji,
         (select count(*) from public.post_reactions r where r.post_id = p.id) as reaction_count,
         (select count(*) from public.post_comments c where c.post_id = p.id) as comment_count
  from public.posts p
  join public.user_profiles u on u.id = p.user_id
  where p.user_id = auth.uid() and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

-- My posts count
create or replace function public.get_user_post_count_v2()
returns bigint language sql stable security definer as $$
  select count(*)::bigint from public.posts where user_id = auth.uid();
$$;

-- Posts I liked
create or replace function public.get_liked_posts_v2(
  p_limit int default 20,
  p_before timestamptz default null
) returns table (
  id uuid,
  user_id uuid,
  body text,
  created_at timestamptz,
  user_username text,
  user_display_name text,
  user_avatar_emoji text,
  reaction_count bigint,
  comment_count bigint
) language sql stable security definer as $$
  select p.id,
         p.user_id,
         p.body,
         p.created_at,
         u.username as user_username,
         u.display_name as user_display_name,
         u.avatar_emoji as user_avatar_emoji,
         (select count(*) from public.post_reactions r2 where r2.post_id = p.id) as reaction_count,
         (select count(*) from public.post_comments c2 where c2.post_id = p.id) as comment_count
  from public.post_reactions r
  join public.posts p on p.id = r.post_id
  join public.user_profiles u on u.id = p.user_id
  where r.user_id = auth.uid() and (p_before is null or r.created_at < p_before)
  order by r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

-- Create post (sets user_id from auth)
create or replace function public.create_post_v2(p_body text)
returns public.posts
language plpgsql security definer as $$
declare
  v_post public.posts%rowtype;
begin
  insert into public.posts(user_id, body) values (auth.uid(), p_body) returning * into v_post;
  return v_post;
end; $$;

-- Toggle reactions
create or replace function public.add_reaction_v2(p_post_id uuid)
returns boolean language plpgsql security definer as $$
begin
  insert into public.post_reactions(post_id, user_id)
  values (p_post_id, auth.uid())
  on conflict do nothing;
  return found; -- true if inserted, false if existed
end; $$;

create or replace function public.remove_reaction_v2(p_post_id uuid)
returns boolean language plpgsql security definer as $$
begin
  delete from public.post_reactions where post_id = p_post_id and user_id = auth.uid();
  return found; -- true if deleted
end; $$;

-- Comments
create or replace function public.create_comment_v2(p_post_id uuid, p_body text)
returns public.post_comments language plpgsql security definer as $$
declare
  v_comment public.post_comments%rowtype;
begin
  insert into public.post_comments(post_id, user_id, body)
  values (p_post_id, auth.uid(), p_body)
  returning * into v_comment;
  return v_comment;
end; $$;

create or replace function public.get_post_comments_v2(
  p_post_id uuid,
  p_limit int default 20,
  p_before timestamptz default null
) returns table (
  id uuid,
  post_id uuid,
  user_id uuid,
  body text,
  created_at timestamptz,
  user_username text,
  user_display_name text,
  user_avatar_emoji text
) language sql stable security definer as $$
  select c.id,
         c.post_id,
         c.user_id,
         c.body,
         c.created_at,
         u.username as user_username,
         u.display_name as user_display_name,
         u.avatar_emoji as user_avatar_emoji
  from public.post_comments c
  join public.user_profiles u on u.id = c.user_id
  where c.post_id = p_post_id and (p_before is null or c.created_at < p_before)
  order by c.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

-- Deletions
create or replace function public.delete_post_v2(p_post_id uuid)
returns boolean language plpgsql security definer as $$
begin
  delete from public.posts where id = p_post_id and user_id = auth.uid();
  return found; -- true if deleted
end; $$;

create or replace function public.delete_comment_v2(p_comment_id uuid)
returns boolean language plpgsql security definer as $$
begin
  delete from public.post_comments where id = p_comment_id and user_id = auth.uid();
  return found; -- true if deleted
end; $$;

-- 3) Privileges: grant only to authenticated
grant execute on function public.get_home_feed_v2(int, timestamptz) to authenticated;
grant execute on function public.get_user_posts_v2(int, timestamptz) to authenticated;
grant execute on function public.get_user_post_count_v2() to authenticated;
grant execute on function public.get_liked_posts_v2(int, timestamptz) to authenticated;
grant execute on function public.create_post_v2(text) to authenticated;
grant execute on function public.add_reaction_v2(uuid) to authenticated;
grant execute on function public.remove_reaction_v2(uuid) to authenticated;
grant execute on function public.create_comment_v2(uuid, text) to authenticated;
grant execute on function public.get_post_comments_v2(uuid, int, timestamptz) to authenticated;
grant execute on function public.delete_post_v2(uuid) to authenticated;
grant execute on function public.delete_comment_v2(uuid) to authenticated;

-- 4) Remove execute from legacy RPCs (p_user_id-based)
-- These statements are idempotent in Supabase deployments where functions exist
revoke execute on function public.create_post(uuid, text) from authenticated;
revoke execute on function public.add_reaction(uuid, uuid) from authenticated;
revoke execute on function public.remove_reaction(uuid, uuid) from authenticated;
revoke execute on function public.create_comment(uuid, uuid, text) from authenticated;
revoke execute on function public.delete_post(uuid, uuid) from authenticated;
revoke execute on function public.delete_comment(uuid, uuid) from authenticated;
revoke execute on function public.get_user_posts(uuid, int, timestamptz) from authenticated;
revoke execute on function public.get_user_post_count(uuid) from authenticated;
revoke execute on function public.get_liked_posts(uuid, int, timestamptz) from authenticated;
revoke execute on function public.get_post_comments(uuid, int, timestamptz) from authenticated;
