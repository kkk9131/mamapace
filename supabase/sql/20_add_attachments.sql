-- Migration: Add attachments support to posts and comments
-- This enables Instagram-like image sharing across the SNS platform

-- =====================================================
-- 1. Add attachments column to posts table
-- =====================================================
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]';

-- Add index for posts with attachments
CREATE INDEX IF NOT EXISTS idx_posts_has_attachments 
ON public.posts((attachments IS NOT NULL AND attachments != '[]'::jsonb));

-- =====================================================
-- 2. Add attachments column to post_comments table
-- =====================================================
ALTER TABLE public.post_comments 
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]';

-- Add index for comments with attachments
CREATE INDEX IF NOT EXISTS idx_post_comments_has_attachments 
ON public.post_comments((attachments IS NOT NULL AND attachments != '[]'::jsonb));

-- =====================================================
-- 3. Update create_post_v2 function to accept attachments
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_post_v2(
  p_body text,
  p_attachments jsonb DEFAULT '[]'
)
RETURNS public.posts
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_post public.posts%rowtype;
BEGIN
  -- Validate attachments array (max 4 images)
  IF jsonb_array_length(COALESCE(p_attachments, '[]'::jsonb)) > 4 THEN
    RAISE EXCEPTION 'Maximum 4 images allowed per post';
  END IF;
  
  -- Body or attachments must be present
  IF (p_body IS NULL OR trim(p_body) = '') AND 
     (p_attachments IS NULL OR p_attachments = '[]'::jsonb) THEN
    RAISE EXCEPTION 'Post must have content or images';
  END IF;
  
  INSERT INTO public.posts(user_id, body, attachments) 
  VALUES (auth.uid(), COALESCE(p_body, ''), COALESCE(p_attachments, '[]'::jsonb)) 
  RETURNING * INTO v_post;
  
  RETURN v_post;
END; $$;

-- =====================================================
-- 4. Update create_comment_v2 function to accept attachments
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_comment_v2(
  p_post_id uuid,
  p_body text,
  p_attachments jsonb DEFAULT '[]'
)
RETURNS public.post_comments
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_comment public.post_comments%rowtype;
BEGIN
  -- Validate attachments array (max 4 images)
  IF jsonb_array_length(COALESCE(p_attachments, '[]'::jsonb)) > 4 THEN
    RAISE EXCEPTION 'Maximum 4 images allowed per comment';
  END IF;
  
  -- Body or attachments must be present
  IF (p_body IS NULL OR trim(p_body) = '') AND 
     (p_attachments IS NULL OR p_attachments = '[]'::jsonb) THEN
    RAISE EXCEPTION 'Comment must have content or images';
  END IF;
  
  INSERT INTO public.post_comments(post_id, user_id, body, attachments)
  VALUES (p_post_id, auth.uid(), COALESCE(p_body, ''), COALESCE(p_attachments, '[]'::jsonb))
  RETURNING * INTO v_comment;
  
  RETURN v_comment;
END; $$;

-- =====================================================
-- 5. Update feed functions to include attachments
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_home_feed_v2(
  p_limit int DEFAULT 20,
  p_offset_time timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  body text,
  attachments jsonb,
  created_at timestamptz,
  display_name text,
  avatar_emoji text,
  is_liked boolean,
  reaction_count bigint,
  comment_count bigint
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.body,
    p.attachments,
    p.created_at,
    u.display_name,
    u.avatar_emoji,
    EXISTS(SELECT 1 FROM public.post_reactions r WHERE r.post_id = p.id AND r.user_id = auth.uid()) AS is_liked,
    (SELECT count(*) FROM public.post_reactions r WHERE r.post_id = p.id) AS reaction_count,
    (SELECT count(*) FROM public.post_comments c WHERE c.post_id = p.id) AS comment_count
  FROM public.posts p
  JOIN public.user_profiles u ON p.user_id = u.id
  WHERE (p_offset_time IS NULL OR p.created_at < p_offset_time)
  ORDER BY p.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 20), 100));
END; $$;

CREATE OR REPLACE FUNCTION public.get_user_posts_v2(
  p_limit int DEFAULT 20,
  p_offset_time timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  body text,
  attachments jsonb,
  created_at timestamptz,
  display_name text,
  avatar_emoji text,
  is_liked boolean,
  reaction_count bigint,
  comment_count bigint
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.body,
    p.attachments,
    p.created_at,
    u.display_name,
    u.avatar_emoji,
    EXISTS(SELECT 1 FROM public.post_reactions r WHERE r.post_id = p.id AND r.user_id = auth.uid()) AS is_liked,
    (SELECT count(*) FROM public.post_reactions r WHERE r.post_id = p.id) AS reaction_count,
    (SELECT count(*) FROM public.post_comments c WHERE c.post_id = p.id) AS comment_count
  FROM public.posts p
  JOIN public.user_profiles u ON p.user_id = u.id
  WHERE p.user_id = auth.uid()
    AND (p_offset_time IS NULL OR p.created_at < p_offset_time)
  ORDER BY p.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 20), 100));
END; $$;

CREATE OR REPLACE FUNCTION public.get_liked_posts_v2(
  p_limit int DEFAULT 20,
  p_offset_time timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  body text,
  attachments jsonb,
  created_at timestamptz,
  display_name text,
  avatar_emoji text,
  is_liked boolean,
  reaction_count bigint,
  comment_count bigint
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.body,
    p.attachments,
    p.created_at,
    u.display_name,
    u.avatar_emoji,
    true AS is_liked,
    (SELECT count(*) FROM public.post_reactions r2 WHERE r2.post_id = p.id) AS reaction_count,
    (SELECT count(*) FROM public.post_comments c2 WHERE c2.post_id = p.id) AS comment_count
  FROM public.posts p
  JOIN public.user_profiles u ON p.user_id = u.id
  JOIN public.post_reactions r ON r.post_id = p.id AND r.user_id = auth.uid()
  WHERE (p_offset_time IS NULL OR r.created_at < p_offset_time)
  ORDER BY r.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 20), 100));
END; $$;

CREATE OR REPLACE FUNCTION public.get_post_comments_v2(
  p_post_id uuid,
  p_limit int DEFAULT 50,
  p_offset_time timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  post_id uuid,
  user_id uuid,
  body text,
  attachments jsonb,
  created_at timestamptz,
  display_name text,
  avatar_emoji text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.post_id,
    c.user_id,
    c.body,
    c.attachments,
    c.created_at,
    u.display_name,
    u.avatar_emoji
  FROM public.post_comments c
  JOIN public.user_profiles u ON c.user_id = u.id
  WHERE c.post_id = p_post_id
    AND (p_offset_time IS NULL OR c.created_at < p_offset_time)
  ORDER BY c.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 50), 100));
END; $$;

-- =====================================================
-- 6. Grant permissions for updated functions
-- =====================================================
GRANT EXECUTE ON FUNCTION public.create_post_v2(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_comment_v2(uuid, text, jsonb) TO authenticated;

-- =====================================================
-- 7. Create storage buckets if they don't exist
-- =====================================================
-- Note: These need to be created via Supabase Dashboard or CLI
-- as storage bucket creation is not supported via SQL

-- Required buckets:
-- - avatars (public)
-- - post-images (public)
-- - chat-images (public)
-- - room-images (public)