-- Set user_profiles_public view to security invoker to avoid definer privileges
do $$
begin
  if exists (
    select 1 from pg_views where schemaname = 'public' and viewname = 'user_profiles_public'
  ) then
    execute 'alter view public.user_profiles_public set (security_invoker = true)';
  end if;
end $$;

-- Optional: ensure read access for expected roles
grant select on public.user_profiles_public to authenticated;
-- If anonymous read is intended, uncomment the line below
-- grant select on public.user_profiles_public to anon;

