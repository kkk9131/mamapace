-- Phase: Room System (V1)
-- Implementation of Discord-like spaces (servers) with channels for community chat
-- References: user_profiles table from 02_schema.sql

-- =====================================================
-- CORE TABLES
-- =====================================================

-- 1) Spaces table - Discord-like servers/communities
DROP TABLE IF EXISTS public.spaces CASCADE;
CREATE TABLE public.spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description text CHECK (char_length(description) <= 500),
  tags text[] DEFAULT '{}' CHECK (array_length(tags, 1) <= 20),
  is_public boolean NOT NULL DEFAULT true,
  owner_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  max_members int NOT NULL DEFAULT 500 CHECK (max_members > 0 AND max_members <= 10000),
  member_count int NOT NULL DEFAULT 0 CHECK (member_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT spaces_public_max_members CHECK (
    (is_public = true AND max_members <= 500) OR 
    (is_public = false AND max_members <= 50)
  )
);

-- Indexes for spaces
CREATE INDEX idx_spaces_is_public ON public.spaces(is_public) WHERE is_public = true;
CREATE INDEX idx_spaces_owner_id ON public.spaces(owner_id);
CREATE INDEX idx_spaces_created_at ON public.spaces(created_at DESC);
CREATE INDEX idx_spaces_member_count ON public.spaces(member_count DESC);
CREATE INDEX idx_spaces_name_gin ON public.spaces USING gin(to_tsvector('english', name));
CREATE INDEX idx_spaces_tags_gin ON public.spaces USING gin(tags);

-- 2) Channels table - Timeline within each space (V1: 1 channel per space)
DROP TABLE IF EXISTS public.channels CASCADE;
CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'general' CHECK (char_length(name) BETWEEN 1 AND 50),
  description text CHECK (char_length(description) <= 200),
  channel_type text NOT NULL DEFAULT 'text' CHECK (channel_type IN ('text', 'voice', 'announcement')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- V1: One channel per space constraint
  UNIQUE(space_id, name)
);

-- Indexes for channels
CREATE INDEX idx_channels_space_id ON public.channels(space_id);
CREATE INDEX idx_channels_is_active ON public.channels(is_active) WHERE is_active = true;

-- 3) Channel members table - User membership and roles in channels
DROP TABLE IF EXISTS public.channel_members CASCADE;
CREATE TABLE public.channel_members (
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  
  PRIMARY KEY (channel_id, user_id)
);

-- Indexes for channel_members
CREATE INDEX idx_channel_members_channel_id ON public.channel_members(channel_id);
CREATE INDEX idx_channel_members_user_id ON public.channel_members(user_id);
CREATE INDEX idx_channel_members_role ON public.channel_members(role);
CREATE INDEX idx_channel_members_last_seen_at ON public.channel_members(last_seen_at);

-- 4) Room messages table - Messages within channels and anonymous rooms
DROP TABLE IF EXISTS public.room_messages CASCADE;
CREATE TABLE public.room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
  anonymous_room_id text NULL, -- For anonymous rooms: 'anon_YYYYMMDD_HH'
  sender_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  display_name text, -- For anonymous rooms, stores ephemeral name
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  attachments jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  expires_at timestamptz NULL, -- For anonymous rooms: created_at + 1 hour
  is_edited boolean NOT NULL DEFAULT false,
  report_count int NOT NULL DEFAULT 0 CHECK (report_count >= 0),
  is_masked boolean NOT NULL DEFAULT false, -- Auto-masked when report_count >= 3
  
  -- Either channel_id or anonymous_room_id must be set, but not both
  CONSTRAINT room_messages_channel_or_anon CHECK (
    (channel_id IS NOT NULL AND anonymous_room_id IS NULL) OR
    (channel_id IS NULL AND anonymous_room_id IS NOT NULL)
  )
);

-- Indexes for room_messages
CREATE INDEX idx_room_messages_channel_id_created_at ON public.room_messages(channel_id, created_at ASC, id ASC) WHERE channel_id IS NOT NULL;
CREATE INDEX idx_room_messages_anonymous_room_id_created_at ON public.room_messages(anonymous_room_id, created_at ASC, id ASC) WHERE anonymous_room_id IS NOT NULL;
CREATE INDEX idx_room_messages_sender_id ON public.room_messages(sender_id);
CREATE INDEX idx_room_messages_expires_at ON public.room_messages(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_room_messages_deleted_at ON public.room_messages(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_room_messages_report_count ON public.room_messages(report_count) WHERE report_count > 0;

-- 6) Anonymous slots table (optional) - Time-based anonymous room management
DROP TABLE IF EXISTS public.anonymous_slots CASCADE;
CREATE TABLE public.anonymous_slots (
  id text PRIMARY KEY, -- Format: 'anon_YYYYMMDD_HH'
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz NOT NULL DEFAULT now() + interval '1 hour',
  participant_count int NOT NULL DEFAULT 0 CHECK (participant_count >= 0),
  message_count int NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for anonymous_slots
CREATE INDEX idx_anonymous_slots_closed_at ON public.anonymous_slots(closed_at);
CREATE INDEX idx_anonymous_slots_opened_at ON public.anonymous_slots(opened_at);