-- Basic schema for Phase 1 authentication

-- Public user profile
drop table if exists public.user_profiles cascade;
create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  display_name text,
  bio text,
  avatar_emoji text,
  created_at timestamptz not null default now(),
  profile_visibility text not null default 'public',
  is_active boolean not null default true
);

-- Auth sessions
drop table if exists public.auth_sessions cascade;
create table public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  session_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  device_info jsonb,
  ip_address text,
  is_active boolean not null default true
);
create index on public.auth_sessions(user_id);
create index on public.auth_sessions(session_token);
create index on public.auth_sessions(refresh_token);

-- Security audit log
drop table if exists public.security_audit_log cascade;
create table public.security_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action_type text not null,
  ip_address text,
  user_agent text,
  success boolean not null,
  failure_reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index on public.security_audit_log(user_id);
create index on public.security_audit_log(action_type);
