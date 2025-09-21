-- Add btree index for equality search on tag (Japanese-friendly)
create index if not exists idx_post_hashtags_tag on public.post_hashtags(tag);
