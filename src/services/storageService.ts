import { getSupabaseClient } from './supabaseClient';
import { secureLogger } from '../utils/privacyProtection';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

/**
 * Uploads a user avatar image to Supabase Storage and returns a public URL.
 * Assumes a public bucket named 'avatars' exists.
 */
export async function uploadAvatarImage(userId: string, uri: string): Promise<string> {
  const client = getSupabaseClient();

  // Best-effort detect extension and content type
  const clean = uri.split('?')[0].split('#')[0];
  const ext = clean.split('.').pop()?.toLowerCase();
  const contentType =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  // Build storage path (do not prefix with bucket name)
  const path = `${userId}/${Date.now()}.${ext || 'jpg'}`;

  // Use direct HTTP upload to Supabase Storage (works reliably in Expo/RN)
  const supaUrl =
    (Constants as any)?.expoConfig?.extra?.SUPABASE_URL ||
    (Constants as any)?.manifestExtra?.SUPABASE_URL;
  if (!supaUrl) throw new Error('SupabaseのURLが設定されていません');

  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session?.access_token) {
    throw new Error('ログインが必要です');
  }

  const uploadUrl = `${supaUrl}/storage/v1/object/${encodeURIComponent('avatars')}/${path}`;
  const result = await FileSystem.uploadAsync(uploadUrl, uri, {
    httpMethod: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });

  if (result.status >= 300) {
    secureLogger.error('Avatar upload failed', {
      status: result.status,
      body: result.body?.slice?.(0, 200),
    });
    throw new Error('アイコン画像のアップロードに失敗しました');
  }

  // Get public URL
  const { data } = client.storage.from('avatars').getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('アイコン画像URLの取得に失敗しました');
  return data.publicUrl;
}
