-- Enable RLS for post_hashtags and add basic authenticated read policy

alter table if exists public.post_hashtags enable row level security;

create policy if not exists post_hashtags_select_authenticated
  on public.post_hashtags
  for select using (auth.role() = 'authenticated');

