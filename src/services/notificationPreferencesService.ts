import { getSupabaseClient } from './supabaseClient';
import { secureLogger } from '../utils/privacyProtection';

export type NotificationPreferences = {
  allow_message: boolean;
  allow_room: boolean;
  allow_like: boolean;
  allow_comment: boolean;
  allow_follow: boolean;
  allow_system: boolean;
};

const defaultPrefs: NotificationPreferences = {
  allow_message: true,
  allow_room: true,
  allow_like: true,
  allow_comment: true,
  allow_follow: true,
  allow_system: true,
};

export const notificationPreferencesService = {
  async get(userId: string): Promise<NotificationPreferences> {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return defaultPrefs;
      const { allow_message, allow_room, allow_like, allow_comment, allow_follow, allow_system } = data as any;
      return {
        allow_message: allow_message ?? true,
        allow_room: allow_room ?? true,
        allow_like: allow_like ?? true,
        allow_comment: allow_comment ?? true,
        allow_follow: allow_follow ?? true,
        allow_system: allow_system ?? true,
      };
    } catch (e) {
      secureLogger.error('Failed to load notification preferences', { error: String(e) });
      return defaultPrefs;
    }
  },

  async update(userId: string, patch: Partial<NotificationPreferences>): Promise<boolean> {
    try {
      const client = getSupabaseClient();
      const payload = { user_id: userId, ...patch, updated_at: new Date().toISOString() } as any;
      const { error } = await client
        .from('notification_preferences')
        .upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      return true;
    } catch (e) {
      secureLogger.error('Failed to update notification preferences', { error: String(e) });
      return false;
    }
  },
};

export default notificationPreferencesService;

