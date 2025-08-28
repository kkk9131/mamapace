import { getSupabaseClient } from './supabaseClient';
import { secureLogger } from '../utils/privacyProtection';

/**
 * Uploads a user avatar image to Supabase Storage and returns a public URL.
 * Assumes a public bucket named 'avatars' exists.
 */
export async function uploadAvatarImage(
  userId: string,
  uri: string
): Promise<string> {
  const client = getSupabaseClient();

  // Derive file extension/content type from uri (best-effort)
  const ext = uri.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
  const contentType =
    ext === 'png'
      ? 'image/png'
      : ext === 'webp'
      ? 'image/webp'
      : 'image/jpeg';

  // Fetch the file as a blob
  const res = await fetch(uri);
  const blob = await res.blob();

  const path = `avatars/${userId}/${Date.now()}.${ext || 'jpg'}`;

  const { error: uploadError } = await client.storage
    .from('avatars')
    .upload(path, blob, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    secureLogger.error('Failed to upload avatar image', { uploadError });
    throw new Error('アイコン画像のアップロードに失敗しました');
  }

  const { data } = client.storage.from('avatars').getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error('アイコン画像URLの取得に失敗しました');
  }
  return data.publicUrl;
}

