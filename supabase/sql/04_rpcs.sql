-- Phase 1 RPCs: server-side hashing of maternal_health_id

-- Helper: compute salted hash
create or replace function public.hash_maternal_id(p_maternal_health_id text, p_salt text)
returns text language sql as $$
  select encode(digest(p_salt || coalesce(p_maternal_health_id,''), 'sha256'), 'hex');
$$;

-- Register user (server-side hashing)
create or replace function public.register_user_secure(
  p_username text,
  p_maternal_health_id text,
  p_password text,
  p_display_name text default null,
  p_bio text default null,
  p_avatar_emoji text default null,
  p_device_info jsonb default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_salt text := encode(gen_random_bytes(16), 'hex');
  v_hash text := public.hash_maternal_id(p_maternal_health_id, v_salt);
  v_user public.user_profiles%rowtype;
  v_session_token text := encode(gen_random_bytes(24), 'hex');
  v_refresh_token text := encode(gen_random_bytes(24), 'hex');
  v_expires_at timestamptz := now() + interval '24 hours';
begin
  -- Ensure username unique
  if exists (select 1 from public.user_profiles where username = p_username) then
    return jsonb_build_object('success', false, 'error', 'username already exists');
  end if;

  -- For demo: store only profile; in real system you'd also store password hash & maternal hash mapping
  insert into public.user_profiles (username, display_name, bio, avatar_emoji)
  values (p_username, p_display_name, p_bio, p_avatar_emoji)
  returning * into v_user;

  -- Create session (demo-only; real impl should persist tokens securely and verify password)
  insert into public.auth_sessions (user_id, session_token, refresh_token, expires_at, device_info)
  values (v_user.id, v_session_token, v_refresh_token, v_expires_at, p_device_info);

  return jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', v_user.id,
      'username', v_user.username,
      'display_name', v_user.display_name,
      'bio', v_user.bio,
      'avatar_emoji', v_user.avatar_emoji,
      'created_at', v_user.created_at,
      'profile_visibility', v_user.profile_visibility,
      'is_active', v_user.is_active
    ),
    'session_token', v_session_token,
    'refresh_token', v_refresh_token,
    'expires_at', to_char(v_expires_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

-- Authenticate user (server-side hashing)
create or replace function public.authenticate_user_secure(
  p_username text,
  p_maternal_health_id text,
  p_password text,
  p_device_info jsonb default null,
  p_ip_address text default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_user public.user_profiles%rowtype;
  v_session_token text := encode(gen_random_bytes(24), 'hex');
  v_refresh_token text := encode(gen_random_bytes(24), 'hex');
  v_expires_at timestamptz := now() + interval '24 hours';
begin
  select * into v_user from public.user_profiles where username = p_username;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Invalid credentials');
  end if;

  -- DEMO: skip password verification for Phase 1 scaffold

  insert into public.auth_sessions (user_id, session_token, refresh_token, expires_at, device_info, ip_address)
  values (v_user.id, v_session_token, v_refresh_token, v_expires_at, p_device_info, p_ip_address);

  return jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', v_user.id,
      'username', v_user.username,
      'display_name', v_user.display_name,
      'bio', v_user.bio,
      'avatar_emoji', v_user.avatar_emoji,
      'created_at', v_user.created_at,
      'profile_visibility', v_user.profile_visibility,
      'is_active', v_user.is_active
    ),
    'session_token', v_session_token,
    'refresh_token', v_refresh_token,
    'expires_at', to_char(v_expires_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

-- Refresh token
create or replace function public.refresh_session_token(
  p_refresh_token text
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_sess public.auth_sessions%rowtype;
  v_new_session_token text := encode(gen_random_bytes(24), 'hex');
  v_new_refresh_token text := encode(gen_random_bytes(24), 'hex');
  v_new_expires_at timestamptz := now() + interval '24 hours';
begin
  select * into v_sess from public.auth_sessions where refresh_token = p_refresh_token and is_active = true;
  if not found then
    return jsonb_build_object('success', false);
  end if;

  update public.auth_sessions
  set session_token = v_new_session_token,
      refresh_token = v_new_refresh_token,
      expires_at = v_new_expires_at,
      last_used_at = now()
  where id = v_sess.id;

  return jsonb_build_object(
    'success', true,
    'session_token', v_new_session_token,
    'refresh_token', v_new_refresh_token,
    'expires_at', to_char(v_new_expires_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

-- Invalidate session
create or replace function public.invalidate_session(
  p_session_token text
) returns void
language sql
security definer
as $$
  update public.auth_sessions set is_active = false where session_token = p_session_token;
$$;

-- Validate session token
create or replace function public.validate_session_token(
  p_session_token text
) returns jsonb
language sql
security definer
as $$
  select jsonb_build_object(
    'is_valid', exists(select 1 from public.auth_sessions where session_token = p_session_token and is_active = true and expires_at > now())
  );
$$;
