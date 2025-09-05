import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import * as ImageManipulator from 'expo-image-manipulator';

import { secureLogger } from '../utils/privacyProtection';

import { getSupabaseClient } from './supabaseClient';

/**
 * Uploads a user avatar image to Supabase Storage and returns a public URL.
 * Assumes a public bucket named 'avatars' exists.
 */
export async function uploadAvatarImage(
  userId: string,
  uri: string,
): Promise<string> {
  const client = getSupabaseClient();

  // Best-effort detect extension and content type
  const clean = uri.split('?')[0].split('#')[0];
  const ext = clean.split('.').pop()?.toLowerCase();
  const contentType =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  // Build storage path (do not prefix with bucket name)
  const path = `${userId}/${Date.now()}.${ext || 'jpg'}`;

  // Use direct HTTP upload to Supabase Storage (works reliably in Expo/RN)
  const env = ((global as any)?.process?.env ?? {}) as Record<
    string,
    string | undefined
  >;
  const supaUrl =
    (Constants as any)?.expoConfig?.extra?.SUPABASE_URL ||
    (Constants as any)?.manifestExtra?.SUPABASE_URL ||
    env.EXPO_PUBLIC_SUPABASE_URL ||
    env.SUPABASE_URL;
  if (!supaUrl) {
    throw new Error('SupabaseのURLが設定されていません');
  }

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
  if (!data?.publicUrl) {
    throw new Error('アイコン画像URLの取得に失敗しました');
  }
  return data.publicUrl;
}

/**
 * Upload up to 4 post images to Supabase Storage and return attachment metadata.
 * - Resizes long edge to 1080px, compress quality ~0.8
 * - Accepts jpg/png/webp
 */
export async function uploadPostImages(
  userId: string,
  uris: string[]
): Promise<{ url: string; width?: number; height?: number; mime?: string }[]> {
  if (!uris || uris.length === 0) {
    return [];
  }
  const limit = Math.min(uris.length, 4);

  const client = getSupabaseClient();
  const env = ((global as any)?.process?.env ?? {}) as Record<
    string,
    string | undefined
  >;
  const supaUrl =
    (Constants as any)?.expoConfig?.extra?.SUPABASE_URL ||
    (Constants as any)?.manifestExtra?.SUPABASE_URL ||
    env.EXPO_PUBLIC_SUPABASE_URL ||
    env.SUPABASE_URL;
  if (!supaUrl) {
    throw new Error('SupabaseのURLが設定されていません');
  }

  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session?.access_token) {
    throw new Error('ログインが必要です');
  }

  const results: {
    url: string;
    width?: number;
    height?: number;
    mime?: string;
  }[] = [];

  for (let i = 0; i < limit; i++) {
    const src = uris[i];
    // Resize/Compress
    const manipulated = await ImageManipulator.manipulateAsync(
      src,
      [{ resize: { width: 1080 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );

    const clean = manipulated.uri.split('?')[0].split('#')[0];
    const ext = clean.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType =
      ext === 'png'
        ? 'image/png'
        : ext === 'webp'
          ? 'image/webp'
          : 'image/jpeg';
    const path = `${userId}/${Date.now()}_${i}.${ext}`;
    const uploadUrl = `${supaUrl}/storage/v1/object/${encodeURIComponent('post-images')}/${path}`;

    const resp = await FileSystem.uploadAsync(uploadUrl, manipulated.uri, {
      httpMethod: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });
    if (resp.status >= 300) {
      secureLogger.error('Post image upload failed', {
        status: resp.status,
        body: resp.body?.slice?.(0, 200),
      });
      throw new Error('画像のアップロードに失敗しました');
    }

    const { data } = client.storage.from('post-images').getPublicUrl(path);
    if (!data?.publicUrl) {
      throw new Error('画像URLの取得に失敗しました');
    }

    results.push({
      url: data.publicUrl,
      width: manipulated.width,
      height: manipulated.height,
      mime: contentType,
    });
  }

  return results;
}

export async function uploadChatImages(
  userId: string,
  uris: string[]
): Promise<{ url: string; width?: number; height?: number; mime?: string }[]> {
  // same as uploadPostImages but target bucket is 'chat-images'
  const client = getSupabaseClient();
  const env = ((global as any)?.process?.env ?? {}) as Record<
    string,
    string | undefined
  >;
  const supaUrl =
    (Constants as any)?.expoConfig?.extra?.SUPABASE_URL ||
    (Constants as any)?.manifestExtra?.SUPABASE_URL ||
    env.EXPO_PUBLIC_SUPABASE_URL ||
    env.SUPABASE_URL;
  if (!supaUrl) {
    throw new Error('SupabaseのURLが設定されていません');
  }
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session?.access_token) {
    throw new Error('ログインが必要です');
  }
  const limit = Math.min(uris.length || 0, 4);
  const results: {
    url: string;
    width?: number;
    height?: number;
    mime?: string;
  }[] = [];
  for (let i = 0; i < limit; i++) {
    const manipulated = await ImageManipulator.manipulateAsync(
      uris[i],
      [{ resize: { width: 1080 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );
    const ext = 'jpg';
    const contentType = 'image/jpeg';
    const path = `${userId}/${Date.now()}_${i}.${ext}`;
    const uploadUrl = `${supaUrl}/storage/v1/object/${encodeURIComponent('chat-images')}/${path}`;
    const resp = await FileSystem.uploadAsync(uploadUrl, manipulated.uri, {
      httpMethod: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });
    if (resp.status >= 300) {
      throw new Error('画像のアップロードに失敗しました');
    }
    const { data } = client.storage.from('chat-images').getPublicUrl(path);
    if (!data?.publicUrl) {
      throw new Error('画像URLの取得に失敗しました');
    }
    results.push({
      url: data.publicUrl,
      width: manipulated.width,
      height: manipulated.height,
      mime: contentType,
    });
  }
  return results;
}

export async function uploadRoomImages(
  userId: string,
  uris: string[]
): Promise<{ url: string; width?: number; height?: number; mime?: string }[]> {
  // same as uploadPostImages but target bucket is 'room-images'
  const client = getSupabaseClient();
  const env = ((global as any)?.process?.env ?? {}) as Record<
    string,
    string | undefined
  >;
  const supaUrl =
    (Constants as any)?.expoConfig?.extra?.SUPABASE_URL ||
    (Constants as any)?.manifestExtra?.SUPABASE_URL ||
    env.EXPO_PUBLIC_SUPABASE_URL ||
    env.SUPABASE_URL;
  if (!supaUrl) {
    throw new Error('SupabaseのURLが設定されていません');
  }
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session?.access_token) {
    throw new Error('ログインが必要です');
  }
  const limit = Math.min(uris.length || 0, 4);
  const results: {
    url: string;
    width?: number;
    height?: number;
    mime?: string;
  }[] = [];
  for (let i = 0; i < limit; i++) {
    const manipulated = await ImageManipulator.manipulateAsync(
      uris[i],
      [{ resize: { width: 1080 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );
    const ext = 'jpg';
    const contentType = 'image/jpeg';
    const path = `${userId}/${Date.now()}_${i}.${ext}`;
    const uploadUrl = `${supaUrl}/storage/v1/object/${encodeURIComponent('room-images')}/${path}`;
    const resp = await FileSystem.uploadAsync(uploadUrl, manipulated.uri, {
      httpMethod: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });
    if (resp.status >= 300) {
      throw new Error('画像のアップロードに失敗しました');
    }
    const { data } = client.storage.from('room-images').getPublicUrl(path);
    if (!data?.publicUrl) {
      throw new Error('画像URLの取得に失敗しました');
    }
    results.push({
      url: data.publicUrl,
      width: manipulated.width,
      height: manipulated.height,
      mime: contentType,
    });
  }
  return results;
}
