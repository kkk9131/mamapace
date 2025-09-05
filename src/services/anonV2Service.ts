import { getSupabaseClient } from './supabaseClient';

export interface AnonV2Message {
  id: string;
  content: string;
  display_name: string;
  created_at: string;
  expires_at?: string;
}

export async function fetchLiveMessages(): Promise<AnonV2Message[]> {
  const client = getSupabaseClient();
  // 1) Try view (V2 path)
  const { data, error } = await client
    .from('anon_messages_live')
    .select('id, content, display_name, created_at, expires_at')
    .order('created_at', { ascending: true });
  if (!error && Array.isArray(data)) {
    return (data || []).map(row => ({
      id: String((row as any).id),
      content: String((row as any).content ?? ''),
      display_name: String((row as any).display_name ?? ''),
      created_at: String((row as any).created_at ?? ''),
      expires_at: (row as any).expires_at ? String((row as any).expires_at) : undefined,
    }));
  }

  // 2) Fallback to existing RPCs (pre-V2)
  try {
    // Use server-side slot to avoid timezone drift
    const { data: roomInfo, error: e1 } = await client.rpc(
      'get_or_create_current_anon_room'
    );
    if (e1 || !roomInfo || (roomInfo as any).error) {
      return [];
    }
    const slotId = (roomInfo as any).room_id as string;
    const { data: rows, error: err2 } = await client.rpc(
      'get_anonymous_messages',
      {
        p_room_id: slotId,
        p_limit: 100,
      }
    );
    if (err2 || !Array.isArray(rows)) {
      return [];
    }
    return (rows as any[]).map(r => ({
      id: String(r.id),
      content: String(r.content ?? ''),
      display_name: String(r.display_name ?? ''),
      created_at: String(r.created_at ?? ''),
      expires_at: r.expires_at ? String(r.expires_at) : undefined,
    }));
  } catch {
    return [];
  }
}

export type SendAnonResult =
  | { ok: true; data: AnonV2Message }
  | { ok: false; retryAfterSeconds?: number; message?: string };

export async function sendAnonMessage(
  content: string
): Promise<SendAnonResult> {
  const client = getSupabaseClient();

  try {
    // Prefer structured RPC to preserve retry seconds
    const { data: roomInfo, error: e1 } = await client.rpc(
      'get_or_create_current_anon_room'
    );
    if (e1 || !roomInfo || (roomInfo as any).error) {
      return {
        ok: false,
        message:
          (e1 && (e1 as any).message) ||
          (roomInfo as any)?.error ||
          'Failed to get room',
      };
    }
    const roomId = (roomInfo as any).room_id as string;
    const name = ((roomInfo as any).ephemeral_name as string) || 'Anonymous';

    const { data: sent, error: e2 } = await client.rpc(
      'send_anonymous_message',
      {
        p_room_id: roomId,
        p_content: content,
        p_display_name: name,
      }
    );

    if (!e2 && sent) {
      if ((sent as any).error) {
        const secs = (sent as any).retry_after_seconds as number | undefined;
        return {
          ok: false,
          retryAfterSeconds: secs,
          message: (sent as any).error,
        };
      }
      const id =
        ((sent as any).message_id as string) ||
        Math.random().toString(36).slice(2);
      return {
        ok: true,
        data: {
          id,
          content,
          display_name: name,
          created_at: new Date().toISOString(),
        },
      };
    }
  } catch {
    // fall through to V2 RPC
  }

  // Fallback: V2 RPC that returns created message row
  const { data, error } = await client.rpc('anon_send_message', {
    p_content: content,
  });
  if (!error) {
    const row = Array.isArray(data) ? (data[0] as any) : (data as any);
    if (!row) {
      return { ok: false, message: 'No data returned' };
    }
    return {
      ok: true,
      data: {
        id: row.id,
        content: row.content,
        display_name: row.display_name,
        created_at: row.created_at,
      },
    };
  }

  return { ok: false, message: (error as any)?.message || 'Failed to send' };
}

// Reactions (like) API
export type ToggleReactionResult = { reacted: boolean; count: number };

export async function toggleAnonReaction(
  messageId: string
): Promise<ToggleReactionResult | null> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('toggle_anonymous_reaction', {
    p_message_id: messageId,
  });
  if (error || !data) {
    return null;
  }
  return {
    reacted: !!(data as any).reacted,
    count: Number((data as any).count || 0),
  };
}

export interface AnonMessageMeta {
  reaction_count: number;
  comment_count: number;
  reacted: boolean;
}

export async function getAnonMessageMeta(messageId: string): Promise<AnonMessageMeta | null> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('get_anonymous_message_meta', {
    p_message_id: messageId,
  });
  if (error || !data) {
    return null;
  }
  return {
    reaction_count: Number((data as any).reaction_count || 0),
    comment_count: Number((data as any).comment_count || 0),
    reacted: !!(data as any).reacted,
  };
}

// Comments API
export type AnonComment = {
  id: string;
  message_id: string;
  display_name: string;
  content: string;
  created_at: string;
};

export async function addAnonComment(
  messageId: string,
  content: string
): Promise<AnonComment | null> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('add_anonymous_comment', {
    p_message_id: messageId,
    p_content: content,
  });
  if (error || !data) {
    return null;
  }
  return {
    id: String((data as any).id),
    message_id: String((data as any).message_id),
    display_name: String((data as any).display_name ?? ''),
    content: String((data as any).content ?? ''),
    created_at: String((data as any).created_at ?? ''),
  } as AnonComment;
}

export async function getAnonComments(
  messageId: string,
  limit = 50
): Promise<AnonComment[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('get_anonymous_comments', {
    p_message_id: messageId,
    p_limit: limit,
  });
  if (error || !data) {
    return [];
  }
  return (data as any[]).map(row => ({
    id: String(row.id),
    message_id: String(row.message_id),
    display_name: String(row.display_name ?? ''),
    content: String(row.content ?? ''),
    created_at: String(row.created_at ?? ''),
  }));
}
