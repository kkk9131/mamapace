-- Phase: Room System Realtime
-- Realtime subscriptions setup for spaces, channels, and messaging

-- =====================================================
-- REALTIME PUBLICATIONS
-- =====================================================

-- Enable realtime for room-related tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.spaces;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.anonymous_slots;

-- =====================================================
-- REALTIME TRIGGER FUNCTIONS
-- =====================================================

-- Function to broadcast space events
CREATE OR REPLACE FUNCTION public.broadcast_space_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_event_type text;
  v_payload jsonb;
BEGIN
  -- Determine event type
  v_event_type := CASE 
    WHEN TG_OP = 'INSERT' THEN 'space_created'
    WHEN TG_OP = 'UPDATE' THEN 'space_updated'
    WHEN TG_OP = 'DELETE' THEN 'space_deleted'
  END;

  -- Build payload
  v_payload := jsonb_build_object(
    'event_type', v_event_type,
    'space_id', COALESCE(NEW.id, OLD.id),
    'timestamp', extract(epoch from now()),
    'data', CASE 
      WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
      ELSE to_jsonb(NEW)
    END
  );

  -- Broadcast to space channel
  PERFORM pg_notify(
    'space_events',
    v_payload::text
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Function to broadcast channel events
CREATE OR REPLACE FUNCTION public.broadcast_channel_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_event_type text;
  v_payload jsonb;
BEGIN
  -- Determine event type
  v_event_type := CASE 
    WHEN TG_OP = 'INSERT' THEN 'channel_created'
    WHEN TG_OP = 'UPDATE' THEN 'channel_updated'
    WHEN TG_OP = 'DELETE' THEN 'channel_deleted'
  END;

  -- Build payload
  v_payload := jsonb_build_object(
    'event_type', v_event_type,
    'channel_id', COALESCE(NEW.id, OLD.id),
    'space_id', COALESCE(NEW.space_id, OLD.space_id),
    'timestamp', extract(epoch from now()),
    'data', CASE 
      WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
      ELSE to_jsonb(NEW)
    END
  );

  -- Broadcast to channel events
  PERFORM pg_notify(
    'channel_events',
    v_payload::text
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Function to broadcast member events
CREATE OR REPLACE FUNCTION public.broadcast_member_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_event_type text;
  v_payload jsonb;
  v_space_id uuid;
BEGIN
  -- Get space_id from channel
  SELECT space_id INTO v_space_id
  FROM public.channels
  WHERE id = COALESCE(NEW.channel_id, OLD.channel_id);

  -- Determine event type
  v_event_type := CASE 
    WHEN TG_OP = 'INSERT' THEN 'member_joined'
    WHEN TG_OP = 'UPDATE' AND NEW.is_active = false AND OLD.is_active = true THEN 'member_left'
    WHEN TG_OP = 'UPDATE' AND NEW.role != OLD.role THEN 'member_role_changed'
    WHEN TG_OP = 'UPDATE' AND NEW.last_seen_at != OLD.last_seen_at THEN 'member_seen_updated'
    WHEN TG_OP = 'DELETE' THEN 'member_removed'
    ELSE 'member_updated'
  END;

  -- Build payload
  v_payload := jsonb_build_object(
    'event_type', v_event_type,
    'channel_id', COALESCE(NEW.channel_id, OLD.channel_id),
    'space_id', v_space_id,
    'user_id', COALESCE(NEW.user_id, OLD.user_id),
    'timestamp', extract(epoch from now()),
    'data', CASE 
      WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
      ELSE to_jsonb(NEW)
    END
  );

  -- Broadcast to member events
  PERFORM pg_notify(
    'member_events',
    v_payload::text
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Function to broadcast message events
CREATE OR REPLACE FUNCTION public.broadcast_message_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_event_type text;
  v_payload jsonb;
  v_space_id uuid;
  v_sender_profile jsonb;
BEGIN
  -- Skip if message is deleted or expired
  IF (NEW.deleted_at IS NOT NULL) OR 
     (NEW.expires_at IS NOT NULL AND NEW.expires_at <= now()) THEN
    RETURN NEW;
  END IF;

  -- Get space_id if this is a channel message
  IF NEW.channel_id IS NOT NULL THEN
    SELECT space_id INTO v_space_id
    FROM public.channels
    WHERE id = NEW.channel_id;
  END IF;

  -- Get sender profile for enriched payload
  SELECT jsonb_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'avatar_emoji', u.avatar_emoji
  ) INTO v_sender_profile
  FROM public.user_profiles u
  WHERE u.id = NEW.sender_id;

  -- Determine event type
  v_event_type := CASE 
    WHEN TG_OP = 'INSERT' THEN 'message_sent'
    WHEN TG_OP = 'UPDATE' AND NEW.is_edited = true AND OLD.is_edited = false THEN 'message_edited'
    WHEN TG_OP = 'UPDATE' AND NEW.is_masked = true AND OLD.is_masked = false THEN 'message_masked'
    WHEN TG_OP = 'UPDATE' THEN 'message_updated'
    WHEN TG_OP = 'DELETE' THEN 'message_deleted'
  END;

  -- Build payload
  v_payload := jsonb_build_object(
    'event_type', v_event_type,
    'message_id', NEW.id,
    'channel_id', NEW.channel_id,
    'anonymous_room_id', NEW.anonymous_room_id,
    'space_id', v_space_id,
    'sender_id', NEW.sender_id,
    'timestamp', extract(epoch from now()),
    'data', jsonb_build_object(
      'id', NEW.id,
      'content', CASE 
        WHEN NEW.is_masked THEN '[This message has been hidden due to reports]'
        ELSE NEW.content 
      END,
      'message_type', NEW.message_type,
      'display_name', NEW.display_name,
      'attachments', NEW.attachments,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at,
      'is_edited', NEW.is_edited,
      'is_masked', NEW.is_masked,
      'sender', v_sender_profile
    )
  );

  -- Broadcast to appropriate channels
  IF NEW.channel_id IS NOT NULL THEN
    -- Channel message
    PERFORM pg_notify(
      'channel_messages:' || NEW.channel_id::text,
      v_payload::text
    );
  ELSIF NEW.anonymous_room_id IS NOT NULL THEN
    -- Anonymous room message
    PERFORM pg_notify(
      'anonymous_messages:' || NEW.anonymous_room_id,
      v_payload::text
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Function to broadcast typing events
CREATE OR REPLACE FUNCTION public.broadcast_typing_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_payload jsonb;
  v_space_id uuid;
  v_user_profile jsonb;
BEGIN
  -- Get space_id from channel
  SELECT space_id INTO v_space_id
  FROM public.channels
  WHERE id = NEW.conversation_id; -- Assuming this is for channel typing

  -- Get user profile
  SELECT jsonb_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'avatar_emoji', u.avatar_emoji
  ) INTO v_user_profile
  FROM public.user_profiles u
  WHERE u.id = NEW.user_id;

  -- Build payload
  v_payload := jsonb_build_object(
    'event_type', CASE WHEN NEW.is_typing THEN 'typing_start' ELSE 'typing_stop' END,
    'channel_id', NEW.conversation_id,
    'space_id', v_space_id,
    'user_id', NEW.user_id,
    'timestamp', extract(epoch from now()),
    'data', jsonb_build_object(
      'is_typing', NEW.is_typing,
      'user', v_user_profile
    )
  );

  -- Broadcast typing event
  PERFORM pg_notify(
    'typing_events:' || NEW.conversation_id::text,
    v_payload::text
  );

  RETURN NEW;
END;
$$;

-- =====================================================
-- REALTIME TRIGGERS
-- =====================================================

-- Triggers for space events
CREATE TRIGGER trigger_broadcast_space_event
  AFTER INSERT OR UPDATE OR DELETE ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_space_event();

-- Triggers for channel events
CREATE TRIGGER trigger_broadcast_channel_event
  AFTER INSERT OR UPDATE OR DELETE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_channel_event();

-- Triggers for member events
CREATE TRIGGER trigger_broadcast_member_event
  AFTER INSERT OR UPDATE OR DELETE ON public.channel_members
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_member_event();

-- Triggers for message events
CREATE TRIGGER trigger_broadcast_message_event
  AFTER INSERT OR UPDATE ON public.room_messages
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_message_event();

-- =====================================================
-- REALTIME HELPER FUNCTIONS
-- =====================================================

-- Function to get realtime channel name for a channel
CREATE OR REPLACE FUNCTION public.get_realtime_channel_name(
  p_channel_id uuid,
  p_event_type text DEFAULT 'messages'
)
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT p_event_type || ':' || p_channel_id::text;
$$;

-- Function to get realtime channel name for anonymous room
CREATE OR REPLACE FUNCTION public.get_realtime_anonymous_channel_name(
  p_room_id text
)
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT 'anonymous_messages:' || p_room_id;
$$;

-- Function to subscribe to channel events (for client reference)
CREATE OR REPLACE FUNCTION public.get_user_realtime_channels(
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  channel_name text,
  channel_type text,
  space_id uuid,
  space_name text
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT 
    'channel_messages:' || cm.channel_id::text as channel_name,
    'channel' as channel_type,
    s.id as space_id,
    s.name as space_name
  FROM public.channel_members cm
  JOIN public.channels c ON c.id = cm.channel_id
  JOIN public.spaces s ON s.id = c.space_id
  WHERE cm.user_id = COALESCE(p_user_id, auth.uid())
    AND cm.is_active = true
    AND c.is_active = true
  
  UNION ALL
  
  SELECT 
    'anonymous_messages:' || public.get_current_anon_slot_id() as channel_name,
    'anonymous' as channel_type,
    NULL as space_id,
    'Anonymous Room' as space_name
  WHERE COALESCE(p_user_id, auth.uid()) IS NOT NULL;
$$;

-- =====================================================
-- REALTIME SECURITY
-- =====================================================

-- Function to check if user can subscribe to channel
CREATE OR REPLACE FUNCTION public.can_subscribe_to_channel(
  p_channel_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members cm
    WHERE cm.channel_id = p_channel_id 
      AND cm.user_id = COALESCE(p_user_id, auth.uid())
      AND cm.is_active = true
  );
$$;

-- Function to check if user can subscribe to anonymous room
CREATE OR REPLACE FUNCTION public.can_subscribe_to_anonymous_room(
  p_room_id text,
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT p_room_id = public.get_current_anon_slot_id() 
    AND COALESCE(p_user_id, auth.uid()) IS NOT NULL;
$$;