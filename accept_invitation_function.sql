-- Function to accept an invitation to a private space
-- This function bypasses RLS policies using SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.accept_space_invitation(
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

  -- Get space info and validate (including private spaces)
  SELECT * INTO v_space_record
  FROM public.spaces 
  WHERE id = p_space_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Space not found');
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

  -- Add user as member (this bypasses RLS because of SECURITY DEFINER)
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
    'message', 'Successfully joined space via invitation',
    'channel_id', v_channel_id,
    'space_name', v_space_record.name
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', 'Failed to accept invitation: ' || SQLERRM
    );
END;
$$;