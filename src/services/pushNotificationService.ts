import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { getSupabaseClient } from './supabaseClient';
import { secureLogger } from '../utils/privacyProtection';

// Local persistent device identifier for de-duplication
const DEVICE_ID_KEY = 'mamapace_device_id';

async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = `${Platform.OS}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
    return id;
  } catch (e) {
    // Fallback (non-persistent)
    return `${Platform.OS}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }
}

export type PushRegistrationResult = {
  success: boolean;
  reason?: string;
  token?: string;
};

// Configure foreground notification behavior (optional sane defaults)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  try {
    // Default/general notifications
    await Notifications.setNotificationChannelAsync('default', {
      name: '一般',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      showBadge: true,
      enableVibrate: true,
    });

    // Messages / room posts (more attention)
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'メッセージ・投稿',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      showBadge: true,
      enableVibrate: true,
    });
  } catch (e) {
    secureLogger.warn('Failed to configure Android notification channels', {
      error: String(e),
    });
  }
}

export async function ensurePushPermission(): Promise<
  Notifications.NotificationPermissionsStatus
> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return settings;
  }
  return await Notifications.requestPermissionsAsync();
}

/**
 * Registers the current device for push notifications and stores/upserts
 * the Expo push token in Supabase bound to the authenticated user.
 */
export async function registerDeviceForPush(userId: string): Promise<PushRegistrationResult> {
  try {
    if (!Device.isDevice) {
      return { success: false, reason: 'simulator_or_web' };
    }

    const perm = await ensurePushPermission();
    if (!perm.granted && perm.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
      return { success: false, reason: 'permission_denied' };
    }

    // Configure Android channels before requesting token
    await ensureAndroidChannels();

    // Newer Expo SDKs require projectId when outside of EAS runtime env
    const projectId = (Constants as any)?.expoConfig?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId || undefined;

    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined as any
    );
    const token = tokenResponse.data;

    const deviceId = await getOrCreateDeviceId();
    const platform = Platform.OS;
    const model = Device.modelName ?? 'unknown';

    const client = getSupabaseClient();
    const { error } = await client
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          device_id: deviceId,
          expo_push_token: token,
          device_os: platform,
          device_model: model,
          last_active_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,device_id' }
      );

    if (error) {
      secureLogger.error('Failed to upsert push token', { error });
      return { success: false, reason: 'store_failed' };
    }

    return { success: true, token };
  } catch (e) {
    secureLogger.error('registerDeviceForPush exception', { error: String(e) });
    return { success: false, reason: 'exception' };
  }
}

/**
 * Removes the current device registration from Supabase for the given user.
 */
export async function unregisterDeviceForPush(userId: string): Promise<boolean> {
  try {
    const deviceId = await getOrCreateDeviceId();
    const client = getSupabaseClient();
    const { error } = await client
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId);
    if (error) {
      secureLogger.error('Failed to delete push token', { error });
      return false;
    }
    return true;
  } catch (e) {
    secureLogger.error('unregisterDeviceForPush exception', { error: String(e) });
    return false;
  }
}

/**
 * Updates last_active_at for heartbeat-style presence on app focus.
 */
export async function touchPushRegistration(userId: string): Promise<void> {
  try {
    const deviceId = await getOrCreateDeviceId();
    const client = getSupabaseClient();
    await client
      .from('push_subscriptions')
      .update({ last_active_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('device_id', deviceId);
  } catch (e) {
    secureLogger.warn('touchPushRegistration failed', { error: String(e) });
  }
}
