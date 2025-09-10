-- Block and Report feature tables and RLS

-- block_relationships
create table if not exists public.block_relationships (
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz not null default now(),
  constraint block_no_self check (blocker_id <> blocked_id),
  constraint block_unique unique (blocker_id, blocked_id)
);

alter table public.block_relationships enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'block_relationships' and policyname = 'block_rel_insert'
  ) then
    create policy block_rel_insert on public.block_relationships
      for insert with check (auth.uid() = blocker_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'block_relationships' and policyname = 'block_rel_delete'
  ) then
    create policy block_rel_delete on public.block_relationships
      for delete using (auth.uid() = blocker_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'block_relationships' and policyname = 'block_rel_select'
  ) then
    create policy block_rel_select on public.block_relationships
      for select using (auth.uid() = blocker_id);
  end if;
end $$;

create index if not exists idx_blocker_id on public.block_relationships(blocker_id);
create index if not exists idx_blocked_id on public.block_relationships(blocked_id);

-- reports
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  target_type text not null check (target_type in ('user','post','comment','message','room')),
  target_id text not null,
  reason_code text not null,
  reason_text text null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','triaged','closed')),
  handled_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reports enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reports' and policyname = 'reports_insert'
  ) then
    create policy reports_insert on public.reports
      for insert with check (auth.uid() = reporter_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reports' and policyname = 'reports_select_own'
  ) then
    create policy reports_select_own on public.reports
      for select using (auth.uid() = reporter_id);
  end if;
end $$;

create index if not exists idx_reports_target on public.reports(target_type, target_id);
create index if not exists idx_reports_reporter on public.reports(reporter_id);
create index if not exists idx_reports_status on public.reports(status);

