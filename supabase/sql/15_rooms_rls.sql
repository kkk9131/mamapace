-- Phase: Room System RLS Policies
-- Row Level Security policies for spaces, channels, and room messaging

-- =====================================================
-- ENABLE RLS
-- =====================================================

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SPACES POLICIES
-- =====================================================

-- SELECT: Public spaces visible to all authenticated users, private spaces only to members
CREATE POLICY "spaces_select_policy" ON public.spaces
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      -- Public spaces: visible to all authenticated users
      is_public = true OR
      -- Private spaces: only visible to members
      (is_public = false AND EXISTS (
        SELECT 1 FROM public.channel_members cm
        JOIN public.channels c ON c.id = cm.channel_id
        WHERE c.space_id = spaces.id 
          AND cm.user_id = auth.uid()
          AND cm.is_active = true
      ))
    )
  );

-- INSERT: Authenticated users can create spaces
CREATE POLICY "spaces_insert_policy" ON public.spaces
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    auth.uid() = owner_id
  );

-- UPDATE: Only owner or space moderators can update
CREATE POLICY "spaces_update_policy" ON public.spaces
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      auth.uid() = owner_id OR
      EXISTS (
        SELECT 1 FROM public.channel_members cm
        JOIN public.channels c ON c.id = cm.channel_id
        WHERE c.space_id = spaces.id 
          AND cm.user_id = auth.uid()
          AND cm.role IN ('owner', 'moderator')
          AND cm.is_active = true
      )
    )
  );

-- DELETE: Only owner can delete spaces
CREATE POLICY "spaces_delete_policy" ON public.spaces
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    auth.uid() = owner_id
  );

-- =====================================================
-- CHANNELS POLICIES
-- =====================================================

-- SELECT: Follow space visibility rules
CREATE POLICY "channels_select_policy" ON public.channels
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.spaces s
      WHERE s.id = channels.space_id AND (
        -- Public spaces: visible to all authenticated users
        s.is_public = true OR
        -- Private spaces: only visible to members
        (s.is_public = false AND EXISTS (
          SELECT 1 FROM public.channel_members cm
          WHERE cm.channel_id = channels.id 
            AND cm.user_id = auth.uid()
            AND cm.is_active = true
        ))
      )
    )
  );

-- INSERT: Only space owners/moderators (V1: auto-created during space creation)
CREATE POLICY "channels_insert_policy" ON public.channels
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.spaces s
      WHERE s.id = channels.space_id 
        AND s.owner_id = auth.uid()
    )
  );

-- UPDATE: Only space owners/moderators
CREATE POLICY "channels_update_policy" ON public.channels
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.channel_members cm
      WHERE cm.channel_id = channels.id 
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'moderator')
        AND cm.is_active = true
    )
  );

-- DELETE: Only space owners
CREATE POLICY "channels_delete_policy" ON public.channels
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.spaces s
      WHERE s.id = channels.space_id 
        AND s.owner_id = auth.uid()
    )
  );

-- =====================================================
-- CHANNEL_MEMBERS POLICIES
-- =====================================================

-- SELECT: Members of the same space can see each other
CREATE POLICY "channel_members_select_policy" ON public.channel_members
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      -- User can see their own membership
      user_id = auth.uid() OR
      -- Members can see other members in the same space
      EXISTS (
        SELECT 1 FROM public.channel_members cm
        JOIN public.channels c ON c.id = cm.channel_id
        WHERE cm.user_id = auth.uid()
          AND c.space_id = (
            SELECT space_id FROM public.channels 
            WHERE id = channel_members.channel_id
          )
          AND cm.is_active = true
      )
    )
  );

-- INSERT: Public spaces - self join, Private spaces - approval required (handled by RPC)
CREATE POLICY "channel_members_insert_policy" ON public.channel_members
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND (
      -- User can join themselves to public spaces
      (user_id = auth.uid() AND EXISTS (
        SELECT 1 FROM public.spaces s
        JOIN public.channels c ON c.space_id = s.id
        WHERE c.id = channel_members.channel_id 
          AND s.is_public = true
          AND s.member_count < s.max_members
      )) OR
      -- Owners/moderators can add members
      EXISTS (
        SELECT 1 FROM public.channel_members cm
        WHERE cm.channel_id = channel_members.channel_id 
          AND cm.user_id = auth.uid()
          AND cm.role IN ('owner', 'moderator')
          AND cm.is_active = true
      )
    )
  );

-- UPDATE: Users can update their own record (last_seen_at), owners/moderators can update roles
CREATE POLICY "channel_members_update_policy" ON public.channel_members
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      -- User can update their own last_seen_at
      user_id = auth.uid() OR
      -- Owners/moderators can update member roles
      EXISTS (
        SELECT 1 FROM public.channel_members cm
        WHERE cm.channel_id = channel_members.channel_id 
          AND cm.user_id = auth.uid()
          AND cm.role IN ('owner', 'moderator')
          AND cm.is_active = true
      )
    )
  );

-- DELETE: Users can leave themselves, owners/moderators can remove members
CREATE POLICY "channel_members_delete_policy" ON public.channel_members
  FOR DELETE USING (
    auth.role() = 'authenticated' AND (
      -- User can remove themselves
      user_id = auth.uid() OR
      -- Owners/moderators can remove members
      EXISTS (
        SELECT 1 FROM public.channel_members cm
        WHERE cm.channel_id = channel_members.channel_id 
          AND cm.user_id = auth.uid()
          AND cm.role IN ('owner', 'moderator')
          AND cm.is_active = true
      )
    )
  );

-- =====================================================
-- ROOM_MESSAGES POLICIES
-- =====================================================

-- SELECT: Channel messages - follow membership rules, Anonymous messages - all authenticated users
CREATE POLICY "room_messages_select_policy" ON public.room_messages
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      -- Channel messages: only members can see
      (channel_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.channel_members cm
        WHERE cm.channel_id = room_messages.channel_id 
          AND cm.user_id = auth.uid()
          AND cm.is_active = true
      )) OR
      -- Anonymous messages: all authenticated users can see if not expired
      (anonymous_room_id IS NOT NULL AND (
        expires_at IS NULL OR expires_at > now()
      ))
    )
  );

-- INSERT: Channel messages - only members, Anonymous messages - all authenticated users
CREATE POLICY "room_messages_insert_policy" ON public.room_messages
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    auth.uid() = sender_id AND (
      -- Channel messages: only members can post
      (channel_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.channel_members cm
        WHERE cm.channel_id = room_messages.channel_id 
          AND cm.user_id = auth.uid()
          AND cm.is_active = true
      )) OR
      -- Anonymous messages: all authenticated users can post
      (anonymous_room_id IS NOT NULL)
    )
  );

-- UPDATE: Users can edit their own messages, moderators can mask/delete
CREATE POLICY "room_messages_update_policy" ON public.room_messages
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      -- User can edit their own messages (content only)
      auth.uid() = sender_id OR
      -- Channel moderators can mask/delete messages
      (channel_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.channel_members cm
        WHERE cm.channel_id = room_messages.channel_id 
          AND cm.user_id = auth.uid()
          AND cm.role IN ('owner', 'moderator')
          AND cm.is_active = true
      ))
      -- Note: Anonymous messages cannot be moderated by users (only automatic)
    )
  );

-- DELETE: Users can delete their own messages, moderators can delete any
CREATE POLICY "room_messages_delete_policy" ON public.room_messages
  FOR DELETE USING (
    auth.role() = 'authenticated' AND (
      -- User can delete their own messages
      auth.uid() = sender_id OR
      -- Channel moderators can delete messages
      (channel_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.channel_members cm
        WHERE cm.channel_id = room_messages.channel_id 
          AND cm.user_id = auth.uid()
          AND cm.role IN ('owner', 'moderator')
          AND cm.is_active = true
      ))
      -- Note: Anonymous messages auto-delete via TTL
    )
  );

-- =====================================================
-- ANONYMOUS_SLOTS POLICIES
-- =====================================================

-- SELECT: All authenticated users can see anonymous slots
CREATE POLICY "anonymous_slots_select_policy" ON public.anonymous_slots
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

-- INSERT/UPDATE/DELETE: Only through server functions (security definer)
-- No direct user policies needed for INSERT/UPDATE/DELETE

-- =====================================================
-- RATE_LIMITS POLICIES
-- =====================================================

-- SELECT: Users can only see their own rate limits
CREATE POLICY "rate_limits_select_policy" ON public.rate_limits
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    user_id = auth.uid()
  );

-- INSERT/UPDATE/DELETE: Only through server functions (security definer)
-- No direct user policies needed for INSERT/UPDATE/DELETE

-- =====================================================
-- MESSAGE_REPORTS POLICIES
-- =====================================================

-- SELECT: Users can see their own reports, moderators can see reports for their channels
CREATE POLICY "message_reports_select_policy" ON public.message_reports
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      -- User can see their own reports
      reporter_id = auth.uid() OR
      -- Channel moderators can see reports for their channels
      EXISTS (
        SELECT 1 FROM public.room_messages rm
        JOIN public.channel_members cm ON cm.channel_id = rm.channel_id
        WHERE rm.id = message_reports.message_id
          AND cm.user_id = auth.uid()
          AND cm.role IN ('owner', 'moderator')
          AND cm.is_active = true
      )
    )
  );

-- INSERT: Users can report messages they can see
CREATE POLICY "message_reports_insert_policy" ON public.message_reports
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    auth.uid() = reporter_id AND
    -- User can only report messages they can see
    EXISTS (
      SELECT 1 FROM public.room_messages rm
      WHERE rm.id = message_reports.message_id AND (
        -- Channel messages: only members can report
        (rm.channel_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.channel_members cm
          WHERE cm.channel_id = rm.channel_id 
            AND cm.user_id = auth.uid()
            AND cm.is_active = true
        )) OR
        -- Anonymous messages: all authenticated users can report
        (rm.anonymous_room_id IS NOT NULL AND (
          rm.expires_at IS NULL OR rm.expires_at > now()
        ))
      )
    )
  );

-- UPDATE/DELETE: Only moderators can update/delete reports
CREATE POLICY "message_reports_update_policy" ON public.message_reports
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.room_messages rm
      JOIN public.channel_members cm ON cm.channel_id = rm.channel_id
      WHERE rm.id = message_reports.message_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'moderator')
        AND cm.is_active = true
    )
  );

CREATE POLICY "message_reports_delete_policy" ON public.message_reports
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.room_messages rm
      JOIN public.channel_members cm ON cm.channel_id = rm.channel_id
      WHERE rm.id = message_reports.message_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'moderator')
        AND cm.is_active = true
    )
  );
