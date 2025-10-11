-- Phase: Room System RPCs
-- API functions for space management, messaging, and anonymous rooms

-- =====================================================
-- SPACE MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to create a new space with automatic channel creation
CREATE OR REPLACE FUNCTION public.create_space(
  p_name text,
  p_description text DEFAULT NULL,
  p_tags text[] DEFAULT '{}',
  p_is_public boolean DEFAULT true,
  p_max_members int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_space_id uuid;
  v_channel_id uuid;
  v_default_max_members int;
  v_result jsonb;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  -- Set default max_members based on space type
  v_default_max_members := CASE 
    WHEN p_is_public THEN COALESCE(p_max_members, 500)
    ELSE COALESCE(p_max_members, 50)
  END;

  -- Validate max_members
  IF (p_is_public AND v_default_max_members > 500) OR 
     (NOT p_is_public AND v_default_max_members > 50) THEN
    RETURN jsonb_build_object('error', 'Max members exceeds limit for space type');
  END IF;

  -- Insert space
  INSERT INTO public.spaces (
    name, 
    description, 
    tags, 
    is_public, 
    owner_id, 
    max_members
  ) VALUES (
    p_name,
    p_description,
    COALESCE(p_tags, '{}'),
    p_is_public,
    auth.uid(),
    v_default_max_members
  ) RETURNING id INTO v_space_id;

  -- Create default 'general' channel
  INSERT INTO public.channels (
    space_id,
    name,
    description
  ) VALUES (
    v_space_id,
    'general',
    'General discussion channel'
  ) RETURNING id INTO v_channel_id;

  -- Add owner as channel member with owner role
  INSERT INTO public.channel_members (
    channel_id,
    user_id,
    role
  ) VALUES (
    v_channel_id,
    auth.uid(),
    'owner'
  );

  -- Return success with space and channel info
  v_result := jsonb_build_object(
    'success', true,
    'space_id', v_space_id,
    'channel_id', v_channel_id,
    'message', 'Space created successfully'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', 'Failed to create space: ' || SQLERRM
    );
END;
$$;

-- Function to search public spaces
CREATE OR REPLACE FUNCTION public.search_public_spaces(
  p_query text DEFAULT NULL,
  p_tags text[] DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  tags text[],
  owner_id uuid,
  owner_username text,
  owner_display_name text,
  member_count int,
  max_members int,
  created_at timestamptz,
  can_join boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT 
    s.id,
    s.name,
    s.description,
    s.tags,
    s.owner_id,
    u.username as owner_username,
    u.display_name as owner_display_name,
    s.member_count,
    s.max_members,
    s.created_at,
    (s.member_count < s.max_members AND NOT EXISTS (
      SELECT 1 FROM public.channel_members cm
      JOIN public.channels c ON c.id = cm.channel_id
      WHERE c.space_id = s.id 
        AND cm.user_id = auth.uid()
        AND cm.is_active = true
    )) as can_join
  FROM public.spaces s
  JOIN public.user_profiles u ON u.id = s.owner_id
  WHERE s.is_public = true
    AND (p_query IS NULL OR (
      s.name ILIKE '%' || p_query || '%' OR
      s.description ILIKE '%' || p_query || '%'
    ))
    AND (p_tags IS NULL OR s.tags && p_tags)
  ORDER BY s.member_count DESC, s.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 50))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
$$;

-- Function to join a public space
CREATE OR REPLACE FUNCTION public.join_public_space(
  p_space_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_channel_id uuid;
  v_space_record record;
  v_is_already_member boolean;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  -- Get space info and validate
  SELECT * INTO v_space_record
  FROM public.spaces 
  WHERE id = p_space_id AND is_public = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Public space not found');
  END IF;

  -- Check if space is at capacity
  IF v_space_record.member_count >= v_space_record.max_members THEN
    RETURN jsonb_build_object('error', 'Space is at maximum capacity');
  END IF;

  -- Get channel ID (V1: only one channel per space)
  SELECT id INTO v_channel_id
  FROM public.channels 
  WHERE space_id = p_space_id
  LIMIT 1;

  IF v_channel_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No channel found for this space');
  END IF;

  -- Check if user is already a member
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_id = v_channel_id 
      AND user_id = auth.uid()
      AND is_active = true
  ) INTO v_is_already_member;

  IF v_is_already_member THEN
    RETURN jsonb_build_object('error', 'Already a member of this space');
  END IF;

  -- Add user as member
  INSERT INTO public.channel_members (
    channel_id,
    user_id,
    role
  ) VALUES (
    v_channel_id,
    auth.uid(),
    'member'
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Successfully joined space',
    'channel_id', v_channel_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', 'Failed to join space: ' || SQLERRM
    );
END;
$$;

-- Function to request joining a private space
CREATE OR REPLACE FUNCTION public.request_join_private_space(
  p_space_id uuid,
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_space_record record;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  -- Get space info and validate
  SELECT * INTO v_space_record
  FROM public.spaces 
  WHERE id = p_space_id AND is_public = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Private space not found');
  END IF;

  -- TODO: Implement join request system in V1.1
  -- For now, return that feature is not implemented
  RETURN jsonb_build_object(
    'error', 'Private space join requests will be implemented in V1.1'
  );
END;
$$;

-- =====================================================
-- MESSAGING FUNCTIONS
-- =====================================================

-- Function to send a message to a channel
CREATE OR REPLACE FUNCTION public.send_channel_message(
  p_channel_id uuid,
  p_content text,
  p_message_type text DEFAULT 'text',
  p_attachments jsonb DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_message_id uuid;
  v_is_member boolean;
  v_result jsonb;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  -- Validate message content
  IF p_content IS NULL OR char_length(trim(p_content)) = 0 THEN
    RETURN jsonb_build_object('error', 'Message content cannot be empty');
  END IF;

  IF char_length(p_content) > 2000 THEN
    RETURN jsonb_build_object('error', 'Message content too long (max 2000 characters)');
  END IF;

  -- Check if user is a member of the channel
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_id = p_channel_id 
      AND user_id = auth.uid()
      AND is_active = true
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RETURN jsonb_build_object('error', 'Not a member of this channel');
  END IF;

  -- Insert message
  INSERT INTO public.room_messages (
    channel_id,
    sender_id,
    message_type,
    content,
    attachments
  ) VALUES (
    p_channel_id,
    auth.uid(),
    p_message_type,
    p_content,
    COALESCE(p_attachments, '[]')
  ) RETURNING id INTO v_message_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message_id', v_message_id,
    'message', 'Message sent successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', 'Failed to send message: ' || SQLERRM
    );
END;
$$;

-- Function to get chat list with NEW badge information
CREATE OR REPLACE FUNCTION public.get_chat_list_with_new(
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  channel_id uuid,
  space_id uuid,
  space_name text,
  space_is_public boolean,
  channel_name text,
  member_role text,
  last_seen_at timestamptz,
  latest_message_at timestamptz,
  latest_message_content text,
  latest_message_sender_id uuid,
  latest_message_sender_username text,
  has_new boolean,
  unread_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT 
    cm.channel_id,
    s.id as space_id,
    s.name as space_name,
    s.is_public as space_is_public,
    c.name as channel_name,
    cm.role as member_role,
    cm.last_seen_at,
    latest_msg.created_at as latest_message_at,
    latest_msg.content as latest_message_content,
    latest_msg.sender_id as latest_message_sender_id,
    latest_sender.username as latest_message_sender_username,
    COALESCE(
      EXISTS (
        SELECT 1 FROM public.room_messages rm
        WHERE rm.channel_id = cm.channel_id
          AND rm.sender_id != auth.uid()
          AND rm.created_at > cm.last_seen_at
          AND rm.deleted_at IS NULL
      ), 
      false
    ) as has_new,
    COALESCE(
      (SELECT count(*)::bigint
       FROM public.room_messages rm
       WHERE rm.channel_id = cm.channel_id
         AND rm.sender_id != auth.uid()
         AND rm.created_at > cm.last_seen_at
         AND rm.deleted_at IS NULL
      ), 0
    ) as unread_count
  FROM public.channel_members cm
  JOIN public.channels c ON c.id = cm.channel_id
  JOIN public.spaces s ON s.id = c.space_id
  LEFT JOIN public.room_messages latest_msg ON latest_msg.id = (
    SELECT id FROM public.room_messages rm2
    WHERE rm2.channel_id = cm.channel_id
      AND rm2.deleted_at IS NULL
    ORDER BY rm2.created_at DESC, rm2.id DESC
    LIMIT 1
  )
  LEFT JOIN public.user_profiles latest_sender ON latest_sender.id = latest_msg.sender_id
  WHERE cm.user_id = auth.uid()
    AND cm.is_active = true
    AND c.is_active = true
  ORDER BY 
    COALESCE(latest_msg.created_at, cm.joined_at) DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));
$$;

-- Function to mark a channel as seen
CREATE OR REPLACE FUNCTION public.mark_seen(
  p_channel_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  -- Update last_seen_at for the user in this channel
  UPDATE public.channel_members
  SET last_seen_at = now()
  WHERE channel_id = p_channel_id 
    AND user_id = auth.uid()
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Not a member of this channel');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Channel marked as seen'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', 'Failed to mark channel as seen: ' || SQLERRM
    );
END;
$$;

-- Function to get channel messages with pagination
CREATE OR REPLACE FUNCTION public.get_channel_messages(
  p_channel_id uuid,
  p_limit int DEFAULT 50,
  p_before_message_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  sender_id uuid,
  sender_username text,
  sender_display_name text,
  sender_avatar_emoji text,
  content text,
  message_type text,
  attachments jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  is_edited boolean,
  is_masked boolean,
  report_count int
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT 
    rm.id,
    rm.sender_id,
    u.username as sender_username,
    u.display_name as sender_display_name,
    u.avatar_emoji as sender_avatar_emoji,
    CASE 
      WHEN rm.is_masked THEN '[This message has been hidden due to reports]'
      ELSE rm.content 
    END as content,
    rm.message_type,
    rm.attachments,
    rm.created_at,
    rm.updated_at,
    rm.is_edited,
    rm.is_masked,
    rm.report_count
  FROM public.room_messages rm
  JOIN public.user_profiles u ON u.id = rm.sender_id
  WHERE rm.channel_id = p_channel_id
    AND rm.deleted_at IS NULL
    AND (p_before_message_id IS NULL OR rm.id < p_before_message_id)
    -- Check user has access to this channel
    AND EXISTS (
      SELECT 1 FROM public.channel_members cm
      WHERE cm.channel_id = p_channel_id 
        AND cm.user_id = auth.uid()
        AND cm.is_active = true
    )
  ORDER BY rm.created_at ASC, rm.id ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));
$$;

-- =====================================================
-- ANONYMOUS ROOM FUNCTIONS
-- =====================================================

-- Function to get or create current anonymous room
CREATE OR REPLACE FUNCTION public.get_or_create_current_anon_room()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_slot_id text;
  v_slot_exists boolean;
  v_ephemeral_name text;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  -- Get current slot ID
  v_slot_id := public.get_current_anon_slot_id();

  -- Check if slot exists
  SELECT EXISTS (
    SELECT 1 FROM public.anonymous_slots 
    WHERE id = v_slot_id
  ) INTO v_slot_exists;

  -- Create slot if it doesn't exist
  IF NOT v_slot_exists THEN
    INSERT INTO public.anonymous_slots (id, opened_at, closed_at)
    VALUES (
      v_slot_id,
      date_trunc('hour', now()),
      date_trunc('hour', now()) + interval '1 hour'
    );
  END IF;

  -- Generate ephemeral name for this user in this slot
  v_ephemeral_name := public.generate_ephemeral_name();

  RETURN jsonb_build_object(
    'success', true,
    'room_id', v_slot_id,
    'ephemeral_name', v_ephemeral_name,
    'expires_at', date_trunc('hour', now()) + interval '1 hour'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', 'Failed to get anonymous room: ' || SQLERRM
    );
END;
$$;

-- Function to send message to anonymous room with rate limiting
CREATE OR REPLACE FUNCTION public.send_anonymous_message(
  p_room_id text,
  p_content text,
  p_display_name text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_message_id uuid;
  v_last_message_time timestamptz;
  v_message_count_1min int;
  v_message_count_10sec int;
  v_time_threshold_10sec timestamptz;
  v_time_threshold_1min timestamptz;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  -- Validate message content
  IF p_content IS NULL OR char_length(trim(p_content)) = 0 THEN
    RETURN jsonb_build_object('error', 'Message content cannot be empty');
  END IF;

  IF char_length(p_content) > 2000 THEN
    RETURN jsonb_build_object('error', 'Message content too long (max 2000 characters)');
  END IF;

  -- Validate room ID format
  IF p_room_id !~ '^anon_\d{8}_\d{2}$' THEN
    RETURN jsonb_build_object('error', 'Invalid anonymous room ID');
  END IF;

  -- Check rate limiting
  v_time_threshold_10sec := now() - interval '10 seconds';
  v_time_threshold_1min := now() - interval '1 minute';

  -- Get current rate limit info
  SELECT 
    last_message_at,
    COALESCE(message_count_1min, 0),
    COALESCE(message_count_10sec, 0)
  INTO 
    v_last_message_time,
    v_message_count_1min,
    v_message_count_10sec
  FROM public.rate_limits
  WHERE user_id = auth.uid() 
    AND room_type = 'anonymous'
    AND room_id = p_room_id;

  -- Check 10-second rate limit
  IF v_last_message_time IS NOT NULL AND v_last_message_time > v_time_threshold_10sec THEN
    RETURN jsonb_build_object(
      'error', 'Rate limit exceeded: Please wait 10 seconds between messages',
      'retry_after_seconds', 10 - extract(epoch from now() - v_last_message_time)::int
    );
  END IF;

  -- Check 1-minute rate limit (max 6 messages per minute)
  IF v_message_count_1min >= 6 AND v_last_message_time > v_time_threshold_1min THEN
    RETURN jsonb_build_object(
      'error', 'Rate limit exceeded: Maximum 6 messages per minute',
      'retry_after_seconds', 60 - extract(epoch from now() - (v_last_message_time - interval '1 minute'))::int
    );
  END IF;

  -- Insert message with TTL
  INSERT INTO public.room_messages (
    anonymous_room_id,
    sender_id,
    display_name,
    content,
    expires_at
  ) VALUES (
    p_room_id,
    auth.uid(),
    p_display_name,
    p_content,
    now() + interval '1 hour'
  ) RETURNING id INTO v_message_id;

  -- Update rate limiting
  INSERT INTO public.rate_limits (
    user_id,
    room_type,
    room_id,
    last_message_at,
    message_count_1min,
    message_count_10sec
  ) VALUES (
    auth.uid(),
    'anonymous',
    p_room_id,
    now(),
    CASE WHEN v_last_message_time IS NULL OR v_last_message_time <= v_time_threshold_1min THEN 1 ELSE v_message_count_1min + 1 END,
    CASE WHEN v_last_message_time IS NULL OR v_last_message_time <= v_time_threshold_10sec THEN 1 ELSE v_message_count_10sec + 1 END
  )
  ON CONFLICT (user_id, room_type, room_id)
  DO UPDATE SET
    last_message_at = now(),
    message_count_1min = CASE WHEN rate_limits.last_message_at <= v_time_threshold_1min THEN 1 ELSE rate_limits.message_count_1min + 1 END,
    message_count_10sec = CASE WHEN rate_limits.last_message_at <= v_time_threshold_10sec THEN 1 ELSE rate_limits.message_count_10sec + 1 END;

  -- Update anonymous slot message count
  UPDATE public.anonymous_slots
  SET message_count = message_count + 1
  WHERE id = p_room_id;

  RETURN jsonb_build_object(
    'success', true,
    'message_id', v_message_id,
    'message', 'Anonymous message sent successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', 'Failed to send anonymous message: ' || SQLERRM
    );
END;
$$;

-- Function to get anonymous room messages
CREATE OR REPLACE FUNCTION public.get_anonymous_messages(
  p_room_id text,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  display_name text,
  content text,
  created_at timestamptz,
  is_masked boolean,
  report_count int
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT 
    rm.id,
    rm.display_name,
    CASE 
      WHEN rm.is_masked THEN '[This message has been hidden due to reports]'
      ELSE rm.content 
    END as content,
    rm.created_at,
    rm.is_masked,
    rm.report_count
  FROM public.room_messages rm
  WHERE rm.anonymous_room_id = p_room_id
    AND rm.deleted_at IS NULL
    AND (rm.expires_at IS NULL OR rm.expires_at > now())
  ORDER BY rm.created_at ASC, rm.id ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));
$$;

-- =====================================================
-- MODERATION FUNCTIONS
-- =====================================================

-- Function to report a message
CREATE OR REPLACE FUNCTION public.report_message(
  p_message_id uuid,
  p_reason text,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_message_exists boolean;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  -- Validate reason
  IF p_reason NOT IN ('spam', 'harassment', 'inappropriate', 'violence', 'other') THEN
    RETURN jsonb_build_object('error', 'Invalid report reason');
  END IF;

  -- Check if message exists and user has access to it
  SELECT EXISTS (
    SELECT 1 FROM public.room_messages rm
    WHERE rm.id = p_message_id 
      AND rm.deleted_at IS NULL
      AND (rm.expires_at IS NULL OR rm.expires_at > now())
      AND (
        -- Channel message: user must be member
        (rm.channel_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.channel_members cm
          WHERE cm.channel_id = rm.channel_id 
            AND cm.user_id = auth.uid()
            AND cm.is_active = true
        )) OR
        -- Anonymous message: all authenticated users can report
        rm.anonymous_room_id IS NOT NULL
      )
  ) INTO v_message_exists;

  IF NOT v_message_exists THEN
    RETURN jsonb_build_object('error', 'Message not found or access denied');
  END IF;

  -- Insert report (will trigger auto-masking if threshold reached)
  INSERT INTO public.message_reports (
    message_id,
    reporter_id,
    reason,
    description
  ) VALUES (
    p_message_id,
    auth.uid(),
    p_reason,
    p_description
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Message reported successfully'
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'You have already reported this message');
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', 'Failed to report message: ' || SQLERRM
    );
END;
$$;

-- =====================================================
-- CLEANUP FUNCTIONS
-- =====================================================

-- Function to cleanup expired data (to be called by cron job)
CREATE OR REPLACE FUNCTION public.cleanup_expired_data()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_messages_deleted int;
  v_slots_deleted int;
  v_rate_limits_cleaned int;
BEGIN
  -- Cleanup expired anonymous messages
  v_messages_deleted := public.cleanup_expired_anonymous_messages();
  
  -- Cleanup old anonymous slots
  v_slots_deleted := public.cleanup_old_anonymous_slots();
  
  -- Cleanup old rate limit records
  DELETE FROM public.rate_limits 
  WHERE last_message_at < now() - interval '1 hour';
  GET DIAGNOSTICS v_rate_limits_cleaned = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'messages_deleted', v_messages_deleted,
    'slots_deleted', v_slots_deleted,
    'rate_limits_cleaned', v_rate_limits_cleaned
  );
END;
$$;
