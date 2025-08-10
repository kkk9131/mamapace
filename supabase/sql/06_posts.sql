-- Phase: Posts/Reactions/Comments
-- Tables, Indexes, and RLS policies for posts feature

-- 1) Tables
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists idx_posts_created_at on public.posts(created_at desc);
create index if not exists idx_posts_user_id_created_at on public.posts(user_id, created_at desc);

create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
create index if not exists idx_post_reactions_post_id on public.post_reactions(post_id);
create index if not exists idx_post_reactions_user_id_created_at on public.post_reactions(user_id, created_at desc);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists idx_post_comments_post_id_created_at on public.post_comments(post_id, created_at desc);
create index if not exists idx_post_comments_user_id_created_at on public.post_comments(user_id, created_at desc);

-- 2) RLS
alter table public.posts enable row level security;
alter table public.post_reactions enable row level security;
alter table public.post_comments enable row level security;

-- Posts policies
create policy if not exists posts_select_authenticated on public.posts
  for select using (auth.role() = 'authenticated');
create policy if not exists posts_insert_own on public.posts
  for insert with check (auth.uid() = user_id);

-- Reactions policies
create policy if not exists post_reactions_select_authenticated on public.post_reactions
  for select using (auth.role() = 'authenticated');
create policy if not exists post_reactions_insert_own on public.post_reactions
  for insert with check (auth.uid() = user_id);
create policy if not exists post_reactions_delete_own on public.post_reactions
  for delete using (auth.uid() = user_id);

-- Comments policies
create policy if not exists post_comments_select_authenticated on public.post_comments
  for select using (auth.role() = 'authenticated');
create policy if not exists post_comments_insert_own on public.post_comments
  for insert with check (auth.uid() = user_id);
create policy if not exists post_comments_delete_own on public.post_comments
  for delete using (auth.uid() = user_id);

-- 3) Helper RPCs (optional)
-- Basic feed RPC for future optimization; client can also directly query with ordering & ranges.
create or replace function public.get_home_feed(p_limit int default 20, p_before timestamptz default null)
returns table (
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

create or replace function public.get_user_posts(p_user_id uuid, p_limit int default 20, p_before timestamptz default null)
returns table (
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
  where p.user_id = p_user_id and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

-- Count user's posts without Supabase Auth
create or replace function public.get_user_post_count(p_user_id uuid)
returns bigint language sql stable security definer as $$
  select count(*)::bigint from public.posts where user_id = p_user_id;
$$;

create or replace function public.get_liked_posts(p_user_id uuid, p_limit int default 20, p_before timestamptz default null)
returns table (
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
  where r.user_id = p_user_id and (p_before is null or r.created_at < p_before)
  order by r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

-- Optional RPCs for when client does not use Supabase Auth user
create or replace function public.create_post(p_user_id uuid, p_body text)
returns public.posts
language plpgsql security definer as $$
declare
  v_post public.posts%rowtype;
begin
  insert into public.posts(user_id, body) values (p_user_id, p_body) returning * into v_post;
  return v_post;
end; $$;

create or replace function public.add_reaction(p_user_id uuid, p_post_id uuid)
returns boolean language plpgsql security definer as $$
begin
  insert into public.post_reactions(post_id, user_id)
  values (p_post_id, p_user_id)
  on conflict do nothing;
  return found; -- true if inserted, false if existed
end; $$;

create or replace function public.remove_reaction(p_user_id uuid, p_post_id uuid)
returns boolean language plpgsql security definer as $$
begin
  delete from public.post_reactions where post_id = p_post_id and user_id = p_user_id;
  return found; -- true if deleted
end; $$;

create or replace function public.create_comment(p_user_id uuid, p_post_id uuid, p_body text)
returns public.post_comments language plpgsql security definer as $$
declare
  v_comment public.post_comments%rowtype;
begin
  insert into public.post_comments(post_id, user_id, body) values (p_post_id, p_user_id, p_body) returning * into v_comment;
  return v_comment;
end; $$;

-- Comments fetch RPC for clients without Supabase Auth
create or replace function public.get_post_comments(
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

-- Secure deletions without Supabase Auth (owner check via parameters)
create or replace function public.delete_post(p_user_id uuid, p_post_id uuid)
returns boolean language plpgsql security definer as $$
begin
  delete from public.posts where id = p_post_id and user_id = p_user_id;
  return found; -- true if deleted
end; $$;

create or replace function public.delete_comment(p_user_id uuid, p_comment_id uuid)
returns boolean language plpgsql security definer as $$
begin
  delete from public.post_comments where id = p_comment_id and user_id = p_user_id;
  return found; -- true if deleted
end; $$;
