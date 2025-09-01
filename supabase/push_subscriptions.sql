-- Push notification subscriptions table
-- Stores Expo push tokens per device per user

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  expo_push_token text not null,
  device_os text,
  device_model text,
  last_active_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (user_id, device_id)
);

alter table public.push_subscriptions enable row level security;

-- Policies: users can manage their own device registrations
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'Allow select own'
  ) then
    create policy "Allow select own" on public.push_subscriptions
      for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'Allow insert self'
  ) then
    create policy "Allow insert self" on public.push_subscriptions
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'Allow update own'
  ) then
    create policy "Allow update own" on public.push_subscriptions
      for update using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'Allow delete own'
  ) then
    create policy "Allow delete own" on public.push_subscriptions
      for delete using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

