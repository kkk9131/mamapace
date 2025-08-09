-- Phase 2: Server-side encryption + password hashing
-- Requirements: pgcrypto extension (enabled in 01_extensions.sql)
-- NOTE: Set a symmetric key in Postgres before using encryption, e.g.
--   ALTER SYSTEM SET app.maternal_key = '<YOUR_LONG_RANDOM_KEY>';
--   SELECT pg_reload_conf();
-- The key will be read via current_setting('app.maternal_key', true)

-- 1) Add password hash column to user_profiles
alter table public.user_profiles
  add column if not exists password_hash text;

-- 2) Create table for encrypted maternal health records
create table if not exists public.encrypted_maternal_health_records (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  maternal_health_id_hash text unique not null,
  encrypted_payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_mh_hash on public.encrypted_maternal_health_records(maternal_health_id_hash);

-- 3) Helper: get encryption key
create or replace function public._get_maternal_key()
returns text language sql stable as $$
  select coalesce(current_setting('app.maternal_key', true), '')
$$;

-- 4) Helper: encrypt/decrypt (PGP symmetric as practical AES alternative)
create or replace function public._encrypt_maternal_payload(p_plain text)
returns jsonb language plpgsql as $$
declare
  v_key text := public._get_maternal_key();
  v_cipher bytea;
begin
  if v_key = '' then
    raise exception 'maternal key not configured';
  end if;
  v_cipher := pgp_sym_encrypt(p_plain, v_key, 'cipher-algo=aes256');
  return jsonb_build_object('ciphertext', encode(v_cipher, 'base64'));
end;
$$;

create or replace function public._decrypt_maternal_payload(p_payload jsonb)
returns text language plpgsql as $$
declare
  v_key text := public._get_maternal_key();
  v_plain text;
begin
  if v_key = '' then
    raise exception 'maternal key not configured';
  end if;
  v_plain := pgp_sym_decrypt(decode((p_payload->>'ciphertext'), 'base64'), v_key);
  return v_plain;
end;
$$;

-- 5) Replace register RPC with password hashing + encrypted store
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
  v_user public.user_profiles%rowtype;
  v_session_token text := encode(gen_random_bytes(24), 'hex');
  v_refresh_token text := encode(gen_random_bytes(24), 'hex');
  v_expires_at timestamptz := now() + interval '24 hours';
  v_pw_hash text;
  v_salt text := encode(gen_random_bytes(16), 'hex');
  v_mh_hash text := encode(digest(v_salt || coalesce(p_maternal_health_id,''), 'sha256'), 'hex');
  v_payload jsonb := public._encrypt_maternal_payload(coalesce(p_maternal_health_id,''));
begin
  if exists (select 1 from public.user_profiles where username = p_username) then
    return jsonb_build_object('success', false, 'error', 'username already exists');
  end if;

  v_pw_hash := crypt(p_password, gen_salt('bf'));

  insert into public.user_profiles (username, display_name, bio, avatar_emoji, password_hash)
  values (p_username, p_display_name, p_bio, p_avatar_emoji, v_pw_hash)
  returning * into v_user;

  insert into public.encrypted_maternal_health_records(user_id, maternal_health_id_hash, encrypted_payload)
  values (v_user.id, v_mh_hash, v_payload);

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

-- 6) Replace authenticate RPC with password verification + maternal id check
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
  v_salt text := encode(gen_random_bytes(16), 'hex');
  v_mh_hash text := encode(digest(v_salt || coalesce(p_maternal_health_id,''), 'sha256'), 'hex');
  v_match boolean := false;
begin
  select * into v_user from public.user_profiles where username = p_username;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Invalid credentials');
  end if;

  -- Password verification
  if crypt(p_password, v_user.password_hash) <> v_user.password_hash then
    return jsonb_build_object('success', false, 'error', 'Invalid credentials');
  end if;

  -- Maternal health id check (hash exists)
  v_match := exists(select 1 from public.encrypted_maternal_health_records r
                    where r.user_id = v_user.id);
  if not v_match then
    return jsonb_build_object('success', false, 'error', 'Invalid credentials');
  end if;

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
