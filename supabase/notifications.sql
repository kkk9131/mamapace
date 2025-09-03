-- User-facing notifications table (per-recipient)

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  type text not null check (type in ('like','comment','system','follow','message','room')),
  content text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

alter table public.notifications enable row level security;

-- RLS policies: users can read, update (mark read) and delete their own notifications
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'Allow select own notifications'
  ) then
    create policy "Allow select own notifications" on public.notifications
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'Allow update own notifications'
  ) then
    create policy "Allow update own notifications" on public.notifications
      for update using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'Allow delete own notifications'
  ) then
    create policy "Allow delete own notifications" on public.notifications
      for delete using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);
