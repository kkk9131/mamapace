-- Audit log for report submissions
create table if not exists public.report_events (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  target_type text not null,
  target_id text not null,
  reason_code text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.report_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='report_events' and policyname='report_events_insert'
  ) then
    create policy report_events_insert on public.report_events
      for insert with check (auth.uid() = reporter_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='report_events' and policyname='report_events_select_own'
  ) then
    create policy report_events_select_own on public.report_events
      for select using (auth.uid() = reporter_id);
  end if;
end $$;

create index if not exists idx_report_events_reporter_created on public.report_events(reporter_id, created_at desc);

-- Performance index to support rate limit count on reports
create index if not exists idx_reports_reporter_created on public.reports(reporter_id, created_at desc);

