-- Hashtag search support (idempotent, minimal privileges)
-- This migration creates a mapping table from posts to hashtags and an index for case-insensitive search.

-- 1) Table
create table if not exists public.post_hashtags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, tag)
);

-- 2) Index for case-insensitive matching
create index if not exists idx_post_hashtags_tag_lower on public.post_hashtags (lower(tag));
create index if not exists idx_post_hashtags_post_id on public.post_hashtags (post_id);

-- 3) RLS (keep permissive for now; rely on posts RLS for final visibility)
-- We do not enable RLS here to avoid accidental access blocking during rollout.
-- If needed later, enable RLS with policies that allow join through visible posts only.

