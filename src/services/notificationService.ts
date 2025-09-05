import { secureLogger } from '../utils/privacyProtection';

import { getSupabaseClient } from './supabaseClient';

export type NotificationItem = {
  id: string;
  type: 'like' | 'comment' | 'system' | 'follow' | 'message' | 'room';
  content: string;
  created_at: string;
  read: boolean;
};

export const notificationService = {
  async list(userId: string, opts?: { limit?: number; cursor?: string }) {
    try {
      const client = getSupabaseClient();
      let q = client
        .from('notifications')
        .select('id,type,content,created_at,read_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const limit = opts?.limit ?? 50;
      if (opts?.cursor) {
        q = q.lt('created_at', opts.cursor);
      }
      q = q.limit(limit);

      const { data, error } = await q;
      if (error) {
        throw error;
      }
      const items: NotificationItem[] = (data ?? []).map(n => ({
        id: n.id,
        type: n.type,
        content: n.content,
        created_at: n.created_at,
        read: Boolean(n.read_at),
      }));
      const nextCursor =
        items.length > 0 ? items[items.length - 1].created_at : null;
      return { data: items, nextCursor } as const;
    } catch (e) {
      secureLogger.error('notificationService.list failed', {
        error: String(e),
      });
      return { data: [] as NotificationItem[], error: 'list_failed' as const };
    }
  },

  async markRead(userId: string, id: string) {
    try {
      const client = getSupabaseClient();
      const { error } = await client
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) {
        throw error;
      }
      return { ok: true };
    } catch (e) {
      secureLogger.error('notificationService.markRead failed', {
        error: String(e),
      });
      return { ok: false };
    }
  },

  async remove(userId: string, id: string) {
    try {
      const client = getSupabaseClient();
      const { error } = await client
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) {
        throw error;
      }
      return { ok: true };
    } catch (e) {
      secureLogger.error('notificationService.remove failed', {
        error: String(e),
      });
      return { ok: false };
    }
  },
};

export default notificationService;
