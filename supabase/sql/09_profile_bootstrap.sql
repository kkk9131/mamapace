-- Profile Bootstrap Migration
-- Creates user_profiles automatically for new auth.users and backfills existing users
-- Adds missing updated_at column for v2 RPC compatibility

-- 1) Add missing updated_at column for v2 RPC compatibility
alter table public.user_profiles 
add column if not exists updated_at timestamptz default now();

-- 2) Create index for performance on updated_at
create index if not exists idx_user_profiles_updated_at on public.user_profiles(updated_at desc);

-- 3) Helper to generate a unique username from email local-part
create or replace function public.gen_available_username(p_email text)
returns text language plpgsql as $$
declare
  v_base text := lower(split_part(coalesce(p_email, 'user'), '@', 1));
  v_try text;
  v_i int := 0;
begin
  if v_base is null or length(v_base) = 0 then
    v_base := 'user';
  end if;
  loop
    if v_i = 0 then
      v_try := v_base;
    else
      v_try := v_base || '_' || substr(md5(random()::text), 1, 6);
    end if;
    exit when not exists (select 1 from public.user_profiles where username = v_try);
    v_i := v_i + 1;
  end loop;
  return v_try;
end; $$;

-- 4) Trigger function: create a profile row when a new auth user is created
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (id, username, display_name, bio, avatar_emoji, profile_visibility, is_active, updated_at)
  values (new.id, public.gen_available_username(new.email), null, null, '👶', 'public', true, now())
  on conflict (id) do nothing;
  return new;
end; $$;

-- 5) Create trigger on auth.users (drop if exists to avoid conflicts)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 6) Validation: Check current state before backfill
do $$
declare
  missing_profiles_count int;
  total_auth_users_count int;
begin
  select count(*) into total_auth_users_count from auth.users;
  select count(*) into missing_profiles_count 
  from auth.users u 
  left join public.user_profiles p on p.id = u.id 
  where p.id is null;
  
  raise notice 'Migration 09_profile_bootstrap validation:';
  raise notice '  Total auth.users: %', total_auth_users_count;
  raise notice '  Missing profiles: %', missing_profiles_count;
  
  if missing_profiles_count > 0 then
    raise notice '  Proceeding with backfill for % users', missing_profiles_count;
  else
    raise notice '  No backfill needed - all users have profiles';
  end if;
end $$;

-- 7) Backfill missing profiles for existing auth users
insert into public.user_profiles (id, username, display_name, bio, avatar_emoji, profile_visibility, is_active, updated_at)
select u.id,
       public.gen_available_username(u.email),
       null as display_name,
       null as bio,
       '👶' as avatar_emoji,
       'public' as profile_visibility,
       true as is_active,
       now() as updated_at
from auth.users u
left join public.user_profiles p on p.id = u.id
where p.id is null;

-- 8) Post-migration validation
do $$
declare
  final_missing_count int;
  total_profiles_count int;
begin
  select count(*) into final_missing_count 
  from auth.users u 
  left join public.user_profiles p on p.id = u.id 
  where p.id is null;
  
  select count(*) into total_profiles_count from public.user_profiles;
  
  raise notice 'Post-migration validation:';
  raise notice '  Total user_profiles: %', total_profiles_count;
  raise notice '  Missing profiles: %', final_missing_count;
  
  if final_missing_count = 0 then
    raise notice '  ✅ SUCCESS: All auth users have profiles';
  else
    raise warning '  ⚠️  WARNING: % auth users still missing profiles', final_missing_count;
  end if;
end $$;
