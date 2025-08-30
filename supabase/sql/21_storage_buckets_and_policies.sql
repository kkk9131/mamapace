-- Storage buckets and RLS policies for image support
-- Buckets: avatars, post-images, chat-images, room-images

-- 1) Create buckets (id == name) and ensure they are public
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('post-images', 'post-images', true),
  ('chat-images', 'chat-images', true),
  ('room-images', 'room-images', true)
on conflict (id) do update set public = excluded.public;

-- 2) Ensure RLS is enabled on storage.objects (should already be enabled by default)
alter table if exists storage.objects enable row level security;

-- 3) Drop conflicting policies if they already exist (so this file is idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Allow read for authenticated on image buckets'
  ) THEN
    DROP POLICY "Allow read for authenticated on image buckets" ON storage.objects;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Allow insert to own folder on image buckets'
  ) THEN
    DROP POLICY "Allow insert to own folder on image buckets" ON storage.objects;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Allow delete own files on image buckets'
  ) THEN
    DROP POLICY "Allow delete own files on image buckets" ON storage.objects;
  END IF;
END
$$;

-- 4) Policies
-- View: allow all authenticated users to select objects in these buckets
create policy "Allow read for authenticated on image buckets"
  on storage.objects
  for select
  using (
    bucket_id in ('avatars','post-images','chat-images','room-images')
    and auth.role() = 'authenticated'
  );

-- Upload: allow authenticated users to upload only into their own top-level folder (/{uid}/...)
create policy "Allow insert to own folder on image buckets"
  on storage.objects
  for insert
  with check (
    bucket_id in ('avatars','post-images','chat-images','room-images')
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Delete: allow authenticated users to delete only their own files (top-level folder matches uid)
create policy "Allow delete own files on image buckets"
  on storage.objects
  for delete
  using (
    bucket_id in ('avatars','post-images','chat-images','room-images')
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
