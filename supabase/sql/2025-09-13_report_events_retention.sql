-- Report events retention helper
-- Deletes report_events older than given days (default 90)

create or replace function public.cleanup_report_events(p_days int default 90)
returns int
language plpgsql
security definer
as $$
declare
  v_deleted int;
begin
  delete from public.report_events
  where created_at < now() - (interval '1 day' * greatest(1, p_days));
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

grant execute on function public.cleanup_report_events(int) to authenticated;

-- Note: schedule this via Supabase Scheduler / pg_cron (daily)
-- Example (pg_cron): select cron.schedule('cleanup_report_events_daily', '0 3 * * *', $$select public.cleanup_report_events(90);$$);

