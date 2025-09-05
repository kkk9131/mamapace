-- Anonymous Room V2 support: view + RPC used by anonV2Service

-- View: anon_messages_live
-- Returns current-slot, non-deleted, non-expired, non-masked anonymous messages
CREATE OR REPLACE VIEW public.anon_messages_live AS
SELECT 
  rm.id,
  rm.content,
  rm.display_name,
  rm.created_at,
  rm.expires_at
FROM public.room_messages rm
WHERE rm.anonymous_room_id IS NOT NULL
  AND rm.deleted_at IS NULL
  AND (rm.expires_at IS NULL OR rm.expires_at > now())
  AND COALESCE(rm.is_masked, false) = false
ORDER BY rm.created_at ASC, rm.id ASC;

-- RPC: anon_send_message(p_content)
-- Creates/uses current anonymous slot, generates ephemeral name, sends message,
-- then returns the created message fields for immediate UI append.
CREATE OR REPLACE FUNCTION public.anon_send_message(
  p_content text
)
RETURNS TABLE (
  id uuid,
  content text,
  display_name text,
  created_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room jsonb;
  v_room_id text;
  v_ephemeral_name text;
  v_send jsonb;
  v_message_id uuid;
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get or create current room + ephemeral name
  v_room := public.get_or_create_current_anon_room();
  IF (v_room ? 'error') THEN
    RAISE EXCEPTION '%', v_room->>'error';
  END IF;
  v_room_id := v_room->>'room_id';
  v_ephemeral_name := COALESCE(v_room->>'ephemeral_name', public.generate_ephemeral_name());

  -- Send message (includes rate limiting + TTL)
  v_send := public.send_anonymous_message(v_room_id, p_content, v_ephemeral_name);
  IF (v_send ? 'error') THEN
    RAISE EXCEPTION '%', v_send->>'error';
  END IF;

  v_message_id := (v_send->>'message_id')::uuid;

  RETURN QUERY
  SELECT rm.id, rm.content, rm.display_name, rm.created_at, rm.expires_at
  FROM public.room_messages rm
  WHERE rm.id = v_message_id
  LIMIT 1;
END;
$$;
