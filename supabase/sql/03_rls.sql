-- Enable RLS and set basic policies

alter table public.user_profiles enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.security_audit_log enable row level security;

-- Minimal public read for profiles (adjust as needed)
create policy user_profiles_select_public on public.user_profiles
for select using ( true );

-- Sessions accessible only by owning user (using token validation via RPC normally)
create policy auth_sessions_owner_select on public.auth_sessions
for select using ( auth.uid()::uuid = user_id );
create policy auth_sessions_owner_modify on public.auth_sessions
for all using ( auth.uid()::uuid = user_id );

-- Audit log insert allowed via RPC security definer, no direct access
revoke all on table public.security_audit_log from anon, authenticated;
