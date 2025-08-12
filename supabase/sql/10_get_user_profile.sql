-- Add RPC function to get any user's profile by user ID
-- This allows viewing other users' profiles including bio

-- Get user profile by user ID
create or replace function public.get_user_profile_v2(
  p_user_id uuid
) returns public.user_profiles
language sql stable security definer
as $$
  select * from public.user_profiles 
  where id = p_user_id 
  and is_active = true;
$$;

-- Grant execute permission to authenticated role
grant execute on function public.get_user_profile_v2 to authenticated;