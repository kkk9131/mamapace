-- Add is_ad flag to posts table for ad filtering
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_ad BOOLEAN DEFAULT false;

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_posts_is_ad ON public.posts(is_ad) WHERE is_ad = true;

-- Comment
COMMENT ON COLUMN public.posts.is_ad IS 'Flag for affiliate/advertisement posts';
