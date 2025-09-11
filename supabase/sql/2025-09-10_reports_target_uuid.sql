-- Draft: migrate reports.target_id from text to uuid for consistency
-- CAUTION: Validate that all target_id values are valid UUIDs before applying.
-- Example validation (manual):
--   select count(*) from public.reports where target_id !~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[1-5][0-9a-f-]{3}-[89ab][0-9a-f-]{3}-[0-9a-f-]{12}$';
-- If result is 0, proceed.

alter table public.reports
  alter column target_id type uuid using target_id::uuid;

-- Consider re-creating indexes if any are affected by the type change
-- Example: create index if not exists idx_reports_target on public.reports(target_type, target_id);

