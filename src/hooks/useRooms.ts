/**
 * ROOM HOOKS
 *
 * React hooks for room system state management
 * Handles spaces, channels, messages, and real-time updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';

import { getSupabaseClient } from '../services/supabaseClient';
import { roomService } from '../services/roomService';
import {
  Space,
  SpaceWithOwner,
  Channel,
  ChannelMemberWithUser,
  ChannelWithSpace,
  RoomMessageWithSender,
  AnonymousRoom,
  AnonymousMessage,
  ChatListItem,
  CreateSpaceRequest,
  SendChannelMessageRequest,
  SendAnonymousMessageRequest,
  SpaceSearchParams,
  MessagePaginationParams,
  ReportMessageRequest,
  MessageEvent,
  MemberEvent,
  TypingEvent,
  RoomEventType,
  OptimisticRoomMessage,
  getCurrentAnonymousSlotId,
} from '../types/room';

// =====================================================
// SPACE HOOKS
// =====================================================

/**
 * Hook for managing user's spaces
 */
export function useUserSpaces() {
  const [spaces, setSpaces] = useState<ChannelWithSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSpaces = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await roomService.getUserSpaces();
    if (response.success) {
      setSpaces(response.data || []);
    } else {
      setError(response.error);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  const refresh = useCallback(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  return {
    spaces,
    loading,
    error,
    refresh,
  };
}

/**
 * Hook for searching public spaces
 */
export function useSpaceSearch() {
  const [spaces, setSpaces] = useState<SpaceWithOwner[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchSpaces = useCallback(async (params: SpaceSearchParams) => {
    setLoading(true);
    setError(null);

    const response = await roomService.searchPublicSpaces(params);
    if (response.success) {
      setSpaces(response.data || []);
    } else {
      setError(response.error);
      setSpaces([]);
    }

    setLoading(false);
  }, []);

  const clearResults = useCallback(() => {
    setSpaces([]);
    setError(null);
  }, []);

  return {
    spaces,
    loading,
    error,
    searchSpaces,
    clearResults,
  };
}

/**
 * Hook for popular spaces (sorted by member count)
 */
export function usePopularSpaces() {
  const [spaces, setSpaces] = useState<SpaceWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPopularSpaces = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Search with empty query to get all public spaces, sorted by popularity
    const response = await roomService.searchPublicSpaces({
      query: '',
      limit: 50,
    });

    if (response.success) {
      // Sort by member count descending (most popular first)
      const sortedSpaces = (response.data || []).sort(
        (a, b) => b.member_count - a.member_count
      );
      setSpaces(sortedSpaces);
    } else {
      setError(response.error);
      setSpaces([]);
    }

    setLoading(false);
  }, []);

  const refresh = useCallback(() => {
    fetchPopularSpaces();
  }, [fetchPopularSpaces]);

  useEffect(() => {
    fetchPopularSpaces();
  }, [fetchPopularSpaces]);

  return {
    spaces,
    loading,
    error,
    refresh,
  };
}

/**
 * Hook for space operations (create, join, leave)
 */
export function useSpaceOperations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSpace = useCallback(async (request: CreateSpaceRequest) => {
    setLoading(true);
    setError(null);

    const response = await roomService.createSpace(request);
    setLoading(false);

    if (!response.success) {
      setError(response.error);
      return null;
    }

    return response.data;
  }, []);

  const joinSpace = useCallback(async (spaceId: string) => {
    setLoading(true);
    setError(null);

    const response = await roomService.joinPublicSpace(spaceId);
    setLoading(false);

    if (!response.success) {
      setError(response.error);
      return null;
    }

    return response.data;
  }, []);

  const leaveSpace = useCallback(async (spaceId: string) => {
    setLoading(true);
    setError(null);

    const response = await roomService.leaveSpace(spaceId);
    setLoading(false);

    if (!response.success) {
      setError(response.error);
      return false;
    }

    return true;
  }, []);

  return {
    loading,
    error,
    createSpace,
    joinSpace,
    leaveSpace,
  };
}

// =====================================================
// MESSAGING HOOKS
// =====================================================

/**
 * Hook for channel messages with real-time updates
 */
export function useChannelMessages(channelId: string | null) {
  const [messages, setMessages] = useState<RoomMessageWithSender[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const realtimeRef = useRef<any>(null);

  // Fetch initial messages
  const fetchMessages = useCallback(
    async (beforeMessageId?: string) => {
      if (!channelId) {
        return;
      }

      setLoading(true);
      if (!beforeMessageId) {
        setError(null);
      }

      const response = await roomService.getChannelMessages(channelId, {
        limit: 50,
        before_message_id: beforeMessageId,
      });

      if (response.success) {
        const newMessages = response.data || [];
        if (beforeMessageId) {
          setMessages(prev => [...newMessages, ...prev]);
        } else {
          setMessages(newMessages);
        }
        setHasMore(newMessages.length === 50);
      } else {
        if (!beforeMessageId) {
          setError(response.error);
        }
      }

      setLoading(false);
    },
    [channelId]
  );

  // Load more messages (pagination)
  const loadMore = useCallback(async () => {
    if (!hasMore || loading || messages.length === 0) {
      return;
    }

    const oldestMessage = messages[0];
    await fetchMessages(oldestMessage.id);
  }, [hasMore, loading, messages, fetchMessages]);

  // Send message
  const sendMessage = useCallback(
    async (
      content: string,
      messageType: 'text' | 'image' | 'file' = 'text',
      attachments: any[] = []
    ) => {
      if (!channelId) {
        return null;
      }

      // Validate only when no attachments
      if (!content?.trim()) {
        if (!attachments || attachments.length === 0) {
          setError('Invalid message');
          return null;
        }
      } else {
        const validation = roomService.validateMessageContent(content);
        if (!validation.isValid) {
          setError(validation.error || 'Invalid message');
          return null;
        }
      }

      // Add optimistic message
      const tempId = `temp_${Date.now()}`;
      const optimisticMessage: OptimisticRoomMessage = {
        id: tempId,
        channel_id: channelId,
        anonymous_room_id: null,
        sender_id:
          (await getSupabaseClient().auth.getUser()).data.user?.id || '',
        display_name: null,
        message_type: messageType,
        content,
        attachments: attachments || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        expires_at: null,
        is_edited: false,
        report_count: 0,
        is_masked: false,
        sender_username: 'You',
        sender_display_name: 'You',
        sender_avatar_emoji: null,
        isOptimistic: true,
        tempId,
      };

      setMessages(prev => [...prev, optimisticMessage]);

      const response = await roomService.sendChannelMessage({
        channel_id: channelId,
        content,
        message_type: messageType,
        attachments: attachments || [],
      });

      if (response.success) {
        // Remove optimistic message (real message will come via realtime)
        setMessages(prev =>
          prev.filter(msg => (msg as OptimisticRoomMessage).tempId !== tempId)
        );
        return response.data;
      } else {
        // Update optimistic message with error
        setMessages(prev =>
          prev.map(msg =>
            (msg as OptimisticRoomMessage).tempId === tempId
              ? { ...msg, error: response.error }
              : msg
          ),
        );
        return null;
      }
    },
    [channelId]
  );

  // Mark channel as seen
  const markSeen = useCallback(async () => {
    if (!channelId) {
      return;
    }

    await roomService.markChannelSeen(channelId);
  }, [channelId]);

  // Set up real-time subscription
  useEffect(() => {
    if (!channelId) {
      return;
    }

    const channel = getSupabaseClient()
      .channel(`channel_messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        payload => {
          const newMessage = payload.new as RoomMessageWithSender;
          setMessages(prev => {
            // Avoid duplicates
            if (prev.find(msg => msg.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'room_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        payload => {
          const updatedMessage = payload.new as RoomMessageWithSender;
          setMessages(prev =>
            prev.map(msg =>
              msg.id === updatedMessage.id ? updatedMessage : msg
            ),
          );
        }
      )
      .subscribe();

    realtimeRef.current = channel;

    return () => {
      if (realtimeRef.current) {
        getSupabaseClient().removeChannel(realtimeRef.current);
      }
    };
  }, [channelId]);

  // Initial fetch
  useEffect(() => {
    if (channelId) {
      fetchMessages();
    } else {
      setMessages([]);
      setError(null);
      setHasMore(true);
    }
  }, [channelId, fetchMessages]);

  return {
    messages,
    loading,
    error,
    hasMore,
    sendMessage,
    loadMore,
    markSeen,
    refresh: () => fetchMessages(),
  };
}

// =====================================================
// MEMBERS HOOKS
// =====================================================

/**
 * Hook to fetch channel members
 */
export function useChannelMembers(channelId: string | null) {
  const [members, setMembers] = useState<ChannelMemberWithUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!channelId) {
      return;
    }
    setLoading(true);
    setError(null);
    const res = await roomService.getChannelMembers(channelId);
    if (res.success) {
      setMembers(res.data || []);
    } else {
      setError(res.error);
      setMembers([]);
    }
    setLoading(false);
  }, [channelId]);

  useEffect(() => {
    if (channelId) {
      fetchMembers();
    } else {
      setMembers([]);
      setError(null);
    }
  }, [channelId, fetchMembers]);

  return {
    members,
    loading,
    error,
    refresh: fetchMembers,
  };
}

// =====================================================
// ANONYMOUS ROOM HOOKS
// =====================================================

/**
 * Hook for anonymous room functionality
 */
export function useAnonymousRoom() {
  const [room, setRoom] = useState<AnonymousRoom | null>(null);
  const [messages, setMessages] = useState<AnonymousMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const realtimeRef = useRef<any>(null);

  // Get current anonymous room
  const enterRoom = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await roomService.getCurrentAnonymousRoom();
    if (response.success) {
      setRoom(response.data);

      // Fetch messages for this room
      const messagesResponse = await roomService.getAnonymousMessages(
        response.data.room_id
      );
      if (messagesResponse.success) {
        setMessages(messagesResponse.data || []);
      }
    } else {
      setError(response.error);
    }

    setLoading(false);
  }, []);

  // Send anonymous message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!room) {
        return null;
      }

      const validation = roomService.validateMessageContent(content);
      if (!validation.isValid) {
        setError(validation.error || 'Invalid message');
        return null;
      }

      setRateLimitError(null);

      const response = await roomService.sendAnonymousMessage({
        room_id: room.room_id,
        content,
        display_name: `anon_${Date.now()}`,
      });

      if (response.success) {
        return response.data;
      } else {
        if (response.retry_after_seconds) {
          setRateLimitError(
            `Please wait ${response.retry_after_seconds} seconds before sending another message`
          );
        } else {
          setError(response.error);
        }
        return null;
      }
    },
    [room]
  );

  // Set up real-time subscription for current room
  useEffect(() => {
    if (!room) {
      return;
    }

    const channel = getSupabaseClient()
      .channel(`anonymous_messages:${room.room_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `anonymous_room_id=eq.${room.room_id}`,
        },
        payload => {
          const newMessage = payload.new as AnonymousMessage;
          setMessages(prev => {
            // Avoid duplicates
            if (prev.find(msg => msg.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    realtimeRef.current = channel;

    return () => {
      if (realtimeRef.current) {
        getSupabaseClient().removeChannel(realtimeRef.current);
      }
    };
  }, [room]);

  // Check for room expiry and refresh
  useEffect(() => {
    if (!room) {
      return;
    }

    const checkExpiry = () => {
      const now = new Date();
      const expiryTime = new Date(room.expires_at);

      if (now >= expiryTime) {
        // Room expired, get new room
        enterRoom();
      }
    };

    // Check every minute
    const interval = setInterval(checkExpiry, 60000);

    return () => clearInterval(interval);
  }, [room, enterRoom]);

  return {
    room,
    messages,
    loading,
    error,
    rateLimitError,
    enterRoom,
    sendMessage,
  };
}

// =====================================================
// CHAT LIST HOOK
// =====================================================

/**
 * Hook for chat list with NEW badges
 */
export function useChatList() {
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChatList = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await roomService.getChatListWithNew();
    if (response.success) {
      setChatList(response.data || []);
    } else {
      setError(response.error);
    }

    setLoading(false);
  }, []);

  // Mark a channel as seen and update local state
  const markChannelSeen = useCallback(async (channelId: string) => {
    const response = await roomService.markChannelSeen(channelId);
    if (response.success) {
      setChatList(prev =>
        prev.map(item =>
          item.channel_id === channelId
            ? { ...item, has_new: false, unread_count: 0 }
            : item
        ),
      );
    }
  }, []);

  useEffect(() => {
    fetchChatList();
  }, [fetchChatList]);

  return {
    chatList,
    loading,
    error,
    refresh: fetchChatList,
    markChannelSeen,
  };
}

// =====================================================
// SUBSCRIPTION HOOK - REMOVED
// All users can now create spaces and use all features
// =====================================================

/**
 * Hook for space creation permission - now always returns true
 */
export function useSpacePermissions() {
  return {
    canCreateSpaces: true,
    loading: false,
    error: null,
  };
}

// =====================================================
// MODERATION HOOK
// =====================================================

/**
 * Hook for message moderation (reporting)
 */
export function useModeration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportMessage = useCallback(async (request: ReportMessageRequest) => {
    setLoading(true);
    setError(null);

    const response = await roomService.reportMessage(request);
    setLoading(false);

    if (!response.success) {
      setError(response.error);
      return false;
    }

    return true;
  }, []);

  return {
    loading,
    error,
    reportMessage,
  };
}
