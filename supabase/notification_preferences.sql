-- User notification preferences (per user)

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  allow_message boolean not null default true,
  allow_room boolean not null default true,
  allow_like boolean not null default true,
  allow_comment boolean not null default true,
  allow_follow boolean not null default true,
  allow_system boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

-- Users can read/update/insert their own preferences
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='notification_preferences' and policyname='np_select_own'
  ) then
    create policy np_select_own on public.notification_preferences
      for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='notification_preferences' and policyname='np_upsert_own'
  ) then
    create policy np_upsert_own on public.notification_preferences
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='notification_preferences' and policyname='np_update_own'
  ) then
    create policy np_update_own on public.notification_preferences
      for update using (auth.uid() = user_id);
  end if;
end $$;
