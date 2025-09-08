-- AI Chat schema and RLS (matches applied migration ai_chat_sessions_schema_v2)

create extension if not exists pgcrypto with schema public;

create table if not exists public.ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_chat_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  sources jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_sessions_user_id_idx on public.ai_chat_sessions(user_id);
create index if not exists ai_chat_messages_session_id_created_at_idx on public.ai_chat_messages(session_id, created_at);

alter table public.ai_chat_sessions enable row level security;
alter table public.ai_chat_messages enable row level security;

do $$ begin
  create policy "ai_sessions_select_own" on public.ai_chat_sessions
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "ai_sessions_insert_own" on public.ai_chat_sessions
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "ai_sessions_update_own" on public.ai_chat_sessions
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "ai_sessions_delete_own" on public.ai_chat_sessions
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "ai_msgs_select_by_owner" on public.ai_chat_messages
    for select using (
      exists (
        select 1 from public.ai_chat_sessions s
        where s.id = ai_chat_messages.session_id and s.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "ai_msgs_insert_by_owner" on public.ai_chat_messages
    for insert with check (
      exists (
        select 1 from public.ai_chat_sessions s
        where s.id = ai_chat_messages.session_id and s.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "ai_msgs_delete_by_owner" on public.ai_chat_messages
    for delete using (
      exists (
        select 1 from public.ai_chat_sessions s
        where s.id = ai_chat_messages.session_id and s.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

