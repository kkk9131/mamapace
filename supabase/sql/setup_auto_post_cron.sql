-- Enable the required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the 'goods-poster' function to run every hour
-- REPLACE THE PLACEHOLDERS BELOW!
-- <PROJECT_REF>: Your Supabase Project Reference ID (e.g., 'abcdefghijklm')
-- <ANON_KEY> or <SERVICE_ROLE_KEY>: Your API Key (Service Role Key recommended for backend tasks)

select
  cron.schedule(
    'auto-post-goods',           -- Job name
    '0 * * * *',                 -- Schedule (Cron format: Every hour at minute 0)
    $$
    select
      net.http_post(
        url:='https://<PROJECT_REF>.supabase.co/functions/v1/goods-poster',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
      ) as request_id;
    $$
  );

-- To check scheduled jobs:
-- select * from cron.job;

-- To un-schedule (stop):
-- select cron.unschedule('auto-post-goods');
