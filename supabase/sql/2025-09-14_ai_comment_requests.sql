-- AI comment usage logging table for enforcing free tier limits

create extension if not exists pgcrypto with schema public;

create table if not exists public.ai_comment_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists ai_comment_requests_requester_created_idx
  on public.ai_comment_requests(requester_id, created_at);

alter table public.ai_comment_requests enable row level security;
