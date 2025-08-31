/**
 * SECURE CHAT SERVICE
 *
 * CRITICAL SECURITY RULES:
 * 1. NEVER log message content or participant information
 * 2. Always sanitize data before logging
 * 3. Validate all inputs before processing
 * 4. Implement proper rate limiting
 * 5. Use existing authentication and session management
 * 6. Handle errors without exposing system details
 */

import { getSupabaseClient } from './supabaseClient';
import { authService } from './authService';
import { secureLogger } from '../utils/privacyProtection';
import {
  Chat,
  ChatWithParticipants,
  Message,
  MessageWithSender,
  CreateChatRequest,
  SendMessageRequest,
  EditMessageRequest,
  DeleteMessageRequest,
  MarkAsReadRequest,
  UpdateTypingRequest,
  ChatResponse,
  ChatErrorCode,
  ChatPaginationParams,
  PaginatedChats,
  PaginatedMessages,
  MessageType,
  ChatEventType,
  ChatEvent,
  MessageEvent,
  TypingEvent,
  ReadStatusEvent,
  ChatSearchParams,
  MessageSearchParams,
  MessageValidation,
  ChatValidation,
  ChatConstraints,
  sanitizeChatForLogging,
  sanitizeMessageForLogging,
} from '../types/chat';
import { PublicUserProfile } from '../types/auth';

// =====================================================
// CONFIGURATION
// =====================================================

// Chat service configuration
const CHAT_CONFIG = {
  MAX_MESSAGE_LENGTH: ChatConstraints.message.maxLength,
  MIN_MESSAGE_LENGTH: ChatConstraints.message.minLength,
  RATE_LIMIT_MESSAGES_PER_MINUTE: ChatConstraints.rateLimit.messagesPerMinute,
  RATE_LIMIT_CHATS_PER_HOUR: ChatConstraints.rateLimit.chatsPerHour,
  PAGINATION_DEFAULT_LIMIT: 20,
  PAGINATION_MAX_LIMIT: 100,
  TYPING_TIMEOUT_MS: 5000, // Auto-stop typing after 5 seconds
  MESSAGE_RETRY_ATTEMPTS: 3,
  CONNECTION_TIMEOUT_MS: 10000,
} as const;

// =====================================================
// RATE LIMITING STATE
// =====================================================

interface RateLimit {
  count: number;
  resetTime: number;
}

class RateLimitManager {
  private messageLimits = new Map<string, RateLimit>();
  private chatLimits = new Map<string, RateLimit>();

  checkMessageRateLimit(userId: string): boolean {
    const now = Date.now();
    const key = `msg_${userId}`;
    const limit = this.messageLimits.get(key);

    if (!limit || now > limit.resetTime) {
      this.messageLimits.set(key, {
        count: 1,
        resetTime: now + 60 * 1000, // 1 minute
      });
      return true;
    }

    if (limit.count >= CHAT_CONFIG.RATE_LIMIT_MESSAGES_PER_MINUTE) {
      return false;
    }

    limit.count++;
    return true;
  }

  checkChatRateLimit(userId: string): boolean {
    const now = Date.now();
    const key = `chat_${userId}`;
    const limit = this.chatLimits.get(key);

    if (!limit || now > limit.resetTime) {
      this.chatLimits.set(key, {
        count: 1,
        resetTime: now + 60 * 60 * 1000, // 1 hour
      });
      return true;
    }

    if (limit.count >= CHAT_CONFIG.RATE_LIMIT_CHATS_PER_HOUR) {
      return false;
    }

    limit.count++;
    return true;
  }
}

// =====================================================
// CHAT SERVICE CLASS
// =====================================================

// =====================================================
// CACHE MANAGER
// =====================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000; // Maximum number of entries
  private readonly MAX_MEMORY_MB = 50; // Maximum memory usage in MB
  private currentMemoryUsage = 0;

  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    // Check cache size limit
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldest();
    }

    // Estimate memory usage (rough approximation)
    const dataSize = this.estimateSize(data);

    // Check memory limit
    while (
      this.currentMemoryUsage + dataSize >
      this.MAX_MEMORY_MB * 1024 * 1024
    ) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttl,
    });

    this.currentMemoryUsage += dataSize;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  delete(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentMemoryUsage -= this.estimateSize(entry.data);
      this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
    this.currentMemoryUsage = 0;
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.currentMemoryUsage -= this.estimateSize(entry.data);
        this.cache.delete(key);
      }
    }
  }

  // Evict oldest entry when cache is full
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  // Rough estimation of object size in bytes
  private estimateSize(obj: any): number {
    const str = JSON.stringify(obj);
    return str ? str.length * 2 : 0; // UTF-16 characters are ~2 bytes
  }

  getStats() {
    const now = Date.now();
    const total = this.cache.size;
    const expired = Array.from(this.cache.values()).filter(
      entry => now > entry.expiry
    ).length;

    return {
      total,
      active: total - expired,
      expired,
    };
  }

  // Get all cache keys that match a pattern
  getKeysMatching(pattern: string): string[] {
    return Array.from(this.cache.keys()).filter(key => key.includes(pattern));
  }

  // Clear all cache entries matching a pattern
  clearMatching(pattern: string): void {
    const keysToDelete = this.getKeysMatching(pattern);
    keysToDelete.forEach(key => this.delete(key));
  }
}

class ChatService {
  private rateLimitManager = new RateLimitManager();
  private realtimeSubscriptions = new Map<string, any>();
  private typingTimeouts = new Map<string, NodeJS.Timeout>();
  private cacheManager = new CacheManager();

  constructor() {
    // Setup periodic cache cleanup
    setInterval(() => {
      this.cacheManager.cleanup();
    }, 60000); // Cleanup every minute
  }

  // =====================================================
  // CACHE MANAGEMENT METHODS
  // =====================================================

  /**
   * Invalidates message cache for a specific chat
   */
  private invalidateMessageCache(chatId: string): void {
    // Clear cache entries for this chat using public API
    const pattern = `messages_${chatId}_`;
    const keysToDelete = this.cacheManager.getKeysMatching(pattern);
    this.cacheManager.clearMatching(pattern);

    if (keysToDelete.length > 0) {
      secureLogger.info('Invalidated message cache', {
        chatId,
        deletedKeys: keysToDelete.length,
      });
    }
  }

  /**
   * Invalidates all message caches
   */
  private invalidateAllMessageCaches(): void {
    this.cacheManager.clear();
    secureLogger.info('Invalidated all message caches');
  }

  // =====================================================
  // VALIDATION METHODS
  // =====================================================

  /**
   * Validates message content
   */
  private validateMessage(
    content: string,
    messageType: MessageType = MessageType.TEXT,
    hasAttachments: boolean = false
  ): MessageValidation {
    const checks = {
      length:
        hasAttachments
          ? content.length <= CHAT_CONFIG.MAX_MESSAGE_LENGTH // allow empty, still enforce max
          : content.length >= CHAT_CONFIG.MIN_MESSAGE_LENGTH &&
            content.length <= CHAT_CONFIG.MAX_MESSAGE_LENGTH,
      content_type:
        messageType === MessageType.TEXT ||
        messageType === MessageType.IMAGE ||
        messageType === MessageType.FILE,
      mentions: true, // TODO: Implement mention validation
      profanity: true, // TODO: Implement profanity filter
    };

    const isValid = Object.values(checks).every(check => check);
    let error: string | undefined;

    if (!checks.length) {
      error = `メッセージは${CHAT_CONFIG.MIN_MESSAGE_LENGTH}文字以上${CHAT_CONFIG.MAX_MESSAGE_LENGTH}文字以下で入力してください。`;
    } else if (!checks.content_type) {
      error = '無効なメッセージタイプです。';
    }

    return {
      isValid,
      error,
      checks,
    };
  }

  /**
   * Validates chat creation request
   */
  private async validateChatCreation(
    request: CreateChatRequest
  ): Promise<ChatValidation> {
    const currentUser = authService.getCurrentUser();

    if (!currentUser) {
      return {
        isValid: false,
        error: '認証が必要です。',
        checks: { participants: false, permissions: false, rate_limit: false },
      };
    }

    const checks = {
      participants:
        !!request.participant_id && request.participant_id !== currentUser.id,
      permissions: true, // TODO: Check if user can create chat with participant
      rate_limit: this.rateLimitManager.checkChatRateLimit(currentUser.id),
    };

    const isValid = Object.values(checks).every(check => check);
    let error: string | undefined;

    if (!checks.participants) {
      error = '有効な相手を選択してください。';
    } else if (!checks.rate_limit) {
      error =
        'チャット作成の制限を超えています。しばらく待ってからお試しください。';
    }

    return {
      isValid,
      error,
      checks,
    };
  }

  // =====================================================
  // CHAT MANAGEMENT
  // =====================================================

  /**
   * Creates a new chat conversation
   */
  async createChat(
    request: CreateChatRequest
  ): Promise<ChatResponse<ChatWithParticipants>> {
    try {
      secureLogger.info('Creating new chat', sanitizeChatForLogging(request));

      const client = getSupabaseClient();

      // Get current user from Supabase session
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          error: '認証が必要です。',
          error_code: ChatErrorCode.ACCESS_DENIED,
        };
      }

      // Create conversation using the database function
      const { data: conversationId, error } = await client.rpc(
        'get_or_create_conversation',
        {
          p_user1_id: user.id,
          p_user2_id: request.participant_id,
        }
      );

      if (error) {
        secureLogger.error('Create chat RPC error', { error });
        return {
          success: false,
          error: 'チャットの作成に失敗しました。',
          error_code: ChatErrorCode.SYSTEM_ERROR,
        };
      }

      if (!conversationId) {
        return {
          success: false,
          error: 'チャットの作成に失敗しました。',
          error_code: ChatErrorCode.SYSTEM_ERROR,
        };
      }

      // Send initial message if provided
      if (request.initial_message && request.initial_message.trim()) {
        await client.rpc('send_message', {
          p_sender_id: user.id,
          p_recipient_id: request.participant_id,
          p_content: request.initial_message.trim(),
          p_message_type: 'text',
        });
      }

      secureLogger.info('Chat created successfully', {
        chatId: conversationId,
        participantIds: [request.participant_id],
      });

      // Return basic chat info
      return {
        success: true,
        data: {
          id: conversationId,
          chat_type: 'direct',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_at: null,
          is_active: true,
          metadata: null,
          participants: [],
          participant_ids: [request.participant_id],
          unread_count: 0,
          participants_presence: [],
          typing_users: [],
        } as ChatWithParticipants,
      };
    } catch (error) {
      secureLogger.error('Create chat exception', { error });
      return {
        success: false,
        error: 'チャットの作成中にエラーが発生しました。',
        error_code: ChatErrorCode.SYSTEM_ERROR,
      };
    }
  }

  /**
   * Gets user's chat list with pagination
   */
  async getChats(
    params: ChatPaginationParams = {}
  ): Promise<ChatResponse<PaginatedChats>> {
    try {
      const client = getSupabaseClient();

      // Get current user from Supabase session
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          error: '認証が必要です。',
          error_code: ChatErrorCode.ACCESS_DENIED,
        };
      }

      const limit = Math.min(
        params.limit || CHAT_CONFIG.PAGINATION_DEFAULT_LIMIT,
        CHAT_CONFIG.PAGINATION_MAX_LIMIT
      );

      const { data, error } = await client.rpc('get_user_conversations', {
        p_user_id: user.id,
        p_limit: limit,
      });
      // RPC response received

      if (error) {
        secureLogger.error('Get chats RPC error', { error });
        return {
          success: false,
          error: 'チャット一覧の取得に失敗しました。',
          error_code: ChatErrorCode.SYSTEM_ERROR,
        };
      }

      // Transform conversations to ChatWithParticipants format
      const chats: ChatWithParticipants[] = (data || []).map(
        (conversation: any) => ({
          id: conversation.id,
          chat_type: 'direct',
          created_at: conversation.updated_at,
          updated_at: conversation.updated_at,
          last_message_at: conversation.last_message_created_at,
          is_active: true,
          metadata: null,
          // 最新メッセージ情報を追加
          last_message: conversation.last_message_content
            ? {
                id: 'temp-' + Date.now(), // 仮のID
                conversation_id: conversation.id,
                sender_id: conversation.last_message_sender_id || 'unknown',
                content: conversation.last_message_content,
                message_type: 'text',
                created_at:
                  conversation.last_message_created_at ||
                  conversation.updated_at,
                updated_at:
                  conversation.last_message_created_at ||
                  conversation.updated_at,
                is_edited: false,
                deleted_at: null,
                metadata: null,
              }
            : null,
          participants: [
            {
              id: conversation.participant_id,
              username: conversation.participant_username,
              display_name: conversation.participant_display_name,
              avatar_emoji: conversation.participant_avatar_emoji,
              bio: '',
              created_at: '',
              updated_at: '',
              profile_visibility: 'public',
              is_active: true,
            },
          ],
          participant_ids: [conversation.participant_id],
          unread_count: conversation.unread_count || 0,
          participants_presence: [],
          typing_users: [],
        })
      );

      return {
        success: true,
        data: {
          chats,
          total_count: chats.length,
          has_more: false, // Database function doesn't support pagination yet
          next_cursor: undefined,
        },
      };
    } catch (error) {
      secureLogger.error('Get chats exception', { error });
      return {
        success: false,
        error: 'チャット一覧の取得中にエラーが発生しました。',
        error_code: ChatErrorCode.SYSTEM_ERROR,
      };
    }
  }

  /**
   * Gets a specific chat by ID
   */
  async getChat(chatId: string): Promise<ChatResponse<ChatWithParticipants>> {
    try {
      const client = getSupabaseClient();

      // Get current user from Supabase session
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          error: '認証が必要です。',
          error_code: ChatErrorCode.ACCESS_DENIED,
        };
      }

      // Get conversation details from user conversations list
      const { data, error } = await client.rpc('get_user_conversations', {
        p_user_id: user.id,
        p_limit: 50,
      });

      if (error) {
        secureLogger.error('Get chat RPC error', { error, chatId });
        return {
          success: false,
          error: 'チャットの取得に失敗しました。',
          error_code: ChatErrorCode.SYSTEM_ERROR,
        };
      }

      // Find the specific conversation by ID
      const conversation = data?.find((c: any) => c.id === chatId);
      if (!conversation) {
        return {
          success: false,
          error: 'チャットが見つかりません。',
          error_code: ChatErrorCode.CHAT_NOT_FOUND,
        };
      }

      // Transform to ChatWithParticipants format
      const chatWithParticipants: ChatWithParticipants = {
        id: conversation.id,
        chat_type: 'direct',
        created_at: conversation.updated_at,
        updated_at: conversation.updated_at,
        last_message_at: conversation.last_message_created_at,
        is_active: true,
        metadata: null,
        participants: [
          {
            id: conversation.participant_id,
            username: conversation.participant_username,
            display_name: conversation.participant_display_name,
            avatar_emoji: conversation.participant_avatar_emoji,
            bio: '',
            created_at: '',
            updated_at: '',
            profile_visibility: 'public',
            is_active: true,
          },
        ],
        participant_ids: [conversation.participant_id],
        unread_count: conversation.unread_count || 0,
        participants_presence: [],
        typing_users: [],
      };

      return {
        success: true,
        data: chatWithParticipants,
      };
    } catch (error) {
      secureLogger.error('Get chat exception', { error, chatId });
      return {
        success: false,
        error: 'チャットの取得中にエラーが発生しました。',
        error_code: ChatErrorCode.SYSTEM_ERROR,
      };
    }
  }

  // =====================================================
  // MESSAGE MANAGEMENT
  // =====================================================

  /**
   * Sends a new message
   */
  async sendMessage(
    request: SendMessageRequest
  ): Promise<ChatResponse<MessageWithSender>> {
    try {
      secureLogger.info('Sending message', sanitizeMessageForLogging(request));

      const client = getSupabaseClient();

      // Get current user from Supabase session
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (authError || !user) {
        secureLogger.error('User authentication failed', { authError });
        return {
          success: false,
          error: '認証が必要です。',
          error_code: ChatErrorCode.AUTHENTICATION_REQUIRED,
        };
      }

      // Validate message
      const validation = this.validateMessage(
        request.content,
        request.message_type,
        !!(request.metadata && Array.isArray(request.metadata.attachments) && request.metadata.attachments.length > 0)
      );
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error || 'メッセージが無効です。',
          error_code: ChatErrorCode.INVALID_MESSAGE_TYPE,
        };
      }

      // First we need to get the participant ID from the conversation
      const { data: conversations, error: convError } = await client.rpc(
        'get_user_conversations',
        {
          p_user_id: user.id,
          p_limit: 50,
        }
      );

      if (convError || !conversations) {
        secureLogger.error('Failed to get conversation details', {
          error: convError,
        });
        return {
          success: false,
          error: 'メッセージの送信に失敗しました。',
          error_code: ChatErrorCode.SYSTEM_ERROR,
        };
      }

      const conversation = conversations.find(
        (c: any) => c.id === request.chat_id
      );
      if (!conversation) {
        return {
          success: false,
          error: 'チャットが見つかりません。',
          error_code: ChatErrorCode.CHAT_NOT_FOUND,
        };
      }

      // If content is empty but attachments exist, send placeholder to satisfy DB constraints
      const hasAttachments = !!(request.metadata && Array.isArray(request.metadata.attachments) && request.metadata.attachments.length > 0);
      const contentToSend = (request.content && request.content.trim().length > 0)
        ? request.content.trim()
        : (hasAttachments ? '[image]' : request.content);

      const { data, error } = await client.rpc('send_message', {
        p_sender_id: user.id,
        p_recipient_id: conversation.participant_id,
        p_content: contentToSend,
        p_message_type: request.message_type || MessageType.TEXT,
        p_metadata: request.metadata || {},
      });

      if (error) {
        secureLogger.error('Send message RPC error', {
          error,
          chatId: request.chat_id,
        });
        return {
          success: false,
          error: 'メッセージの送信に失敗しました。',
          error_code: ChatErrorCode.SYSTEM_ERROR,
        };
      }

      if (!data) {
        return {
          success: false,
          error: 'メッセージの送信に失敗しました。',
          error_code: ChatErrorCode.SYSTEM_ERROR,
        };
      }

      // Fetch sender profile for accurate display_name/username (avoid showing email)
      let senderProfile: any = null;
      try {
        const { data: profile } = await client
          .from('user_profiles')
          .select('id, username, display_name, avatar_emoji, avatar_url, profile_visibility, is_active, created_at, updated_at')
          .eq('id', user.id)
          .single();
        senderProfile = profile;
      } catch (_) {}

      // Transform message to MessageWithSender format
      const messageWithSender: MessageWithSender = {
        id: data.id,
        chat_id: data.conversation_id,
        sender_id: data.sender_id,
        content: data.content,
        message_type: data.message_type,
        created_at: data.created_at,
        updated_at: data.updated_at,
        edited_at: data.is_edited ? data.updated_at : null,
        deleted_at: data.deleted_at,
        reply_to_message_id: null,
        metadata: data.metadata,
        sender: senderProfile
          ? {
              id: senderProfile.id,
              username: senderProfile.username || '',
              display_name: senderProfile.display_name || '',
              avatar_emoji: senderProfile.avatar_emoji || '👤',
              avatar_url: senderProfile.avatar_url || null,
              bio: '',
              created_at: senderProfile.created_at || '',
              updated_at: senderProfile.updated_at || '',
              profile_visibility: senderProfile.profile_visibility || 'public',
              is_active: senderProfile.is_active ?? true,
            }
          : {
              id: user.id,
              username: user.user_metadata?.username || '',
              display_name: user.user_metadata?.display_name || '',
              avatar_emoji: user.user_metadata?.avatar_emoji || '👤',
              bio: '',
              created_at: '',
              updated_at: '',
              profile_visibility: 'public',
              is_active: true,
            },
        read_by: [],
        is_read: true,
        is_edited: data.is_edited || false,
        delivery_status: [],
        read_receipt_status: 'unread' as any,
      };

      // Invalidate message cache for this chat
      this.invalidateMessageCache(request.chat_id);

      secureLogger.info('Message sent successfully', {
        messageId: data.id,
        chatId: request.chat_id,
      });

      return {
        success: true,
        data: messageWithSender,
      };
    } catch (error) {
      secureLogger.error('Send message exception', {
        error,
        chatId: request.chat_id,
      });
      return {
        success: false,
        error: 'メッセージの送信中にエラーが発生しました。',
        error_code: ChatErrorCode.SYSTEM_ERROR,
      };
    }
  }

  /**
   * Gets messages for a chat with pagination
   */
  async getMessages(
    chatId: string,
    params: ChatPaginationParams = {}
  ): Promise<ChatResponse<PaginatedMessages>> {
    try {
      const client = getSupabaseClient();

      // Get current user from Supabase session
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          error: '認証が必要です。',
          error_code: ChatErrorCode.ACCESS_DENIED,
        };
      }

      // Create cache key based on parameters
      const cacheKey = `messages_${chatId}_${params.limit || CHAT_CONFIG.PAGINATION_DEFAULT_LIMIT}_${params.cursor || 'initial'}`;

      // Check cache first (only for initial loads, not pagination)
      if (!params.cursor) {
        const cachedMessages =
          this.cacheManager.get<PaginatedMessages>(cacheKey);
        if (cachedMessages) {
          secureLogger.info('Returning cached messages', {
            chatId,
            messageCount: cachedMessages.messages.length,
          });
          return {
            success: true,
            data: cachedMessages,
          };
        }
      }

      const limit = Math.min(
        params.limit || CHAT_CONFIG.PAGINATION_DEFAULT_LIMIT,
        CHAT_CONFIG.PAGINATION_MAX_LIMIT
      );
      const offset = params.offset || 0;
      const { data, error } = await client.rpc('get_conversation_messages', {
        p_conversation_id: chatId,
        p_limit: limit,
        p_before: params.cursor ? new Date(params.cursor).toISOString() : null,
      });

      if (error) {
        secureLogger.error('Get messages RPC error', { error, chatId });
        return {
          success: false,
          error: 'メッセージの取得に失敗しました。',
          error_code: ChatErrorCode.SYSTEM_ERROR,
        };
      }

      // Transform messages to MessageWithSender format
      let messages: MessageWithSender[] = (data || []).map((msg: any) => ({
        id: msg.id,
        chat_id: msg.conversation_id,
        sender_id: msg.sender_id,
        content: msg.content,
        message_type: msg.message_type,
        created_at: msg.created_at,
        updated_at: msg.updated_at,
        edited_at: msg.is_edited ? msg.updated_at : null,
        deleted_at: null,
        reply_to_message_id: null,
        metadata: msg.metadata,
        sender: {
          id: msg.sender_id,
          username: msg.sender_username,
          display_name: msg.sender_display_name,
          avatar_emoji: msg.sender_avatar_emoji,
          avatar_url: (msg as any).sender_avatar_url ?? null,
          bio: '',
          created_at: '',
          updated_at: '',
          profile_visibility: 'public',
          is_active: true,
        },
        read_by: msg.read_by || [], // Use actual read_by data from database
        is_read: msg.is_read || false, // Use actual is_read status
        is_edited: msg.is_edited || false,
        delivery_status: [],
        read_receipt_status: 'unread' as any,
      }));

      // 補完: avatar_url が欠けている送信者のプロフィールをまとめて取得
      {
        const missing = Array.from(
          new Set(messages.filter(m => !m.sender?.avatar_url).map(m => m.sender_id))
        );
        if (missing.length > 0) {
          const { data: profiles } = await client
            .from('user_profiles')
            .select('id, avatar_url')
            .in('id', missing);
          const map = new Map((profiles || []).map(p => [p.id, p.avatar_url]));
          messages = messages.map(m => ({
            ...m,
            sender: {
              ...m.sender,
              avatar_url: m.sender.avatar_url ?? map.get(m.sender_id) ?? null,
            },
          }));
        }
      }

      const result = {
        messages,
        total_count: messages.length,
        has_more: messages.length >= limit,
        next_cursor:
          messages.length > 0
            ? messages[messages.length - 1].created_at
            : undefined,
      };

      // Cache the result (only for initial loads, not pagination)
      if (!params.cursor) {
        this.cacheManager.set(cacheKey, result, 2 * 60 * 1000); // Cache for 2 minutes
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      secureLogger.error('Get messages exception', { error, chatId });
      return {
        success: false,
        error: 'メッセージの取得中にエラーが発生しました。',
        error_code: ChatErrorCode.SYSTEM_ERROR,
      };
    }
  }

  /**
   * Edits an existing message
   */
  async editMessage(
    request: EditMessageRequest
  ): Promise<ChatResponse<MessageWithSender>> {
    try {
      secureLogger.info('Editing message', sanitizeMessageForLogging(request));

      const client = getSupabaseClient();

      // Get current user from Supabase session
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          error: '認証が必要です。',
          error_code: ChatErrorCode.ACCESS_DENIED,
        };
      }

      // Validate message content
      const validation = this.validateMessage(request.content);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error || 'メッセージが無効です。',
          error_code: ChatErrorCode.INVALID_MESSAGE_TYPE,
        };
      }

      const { data, error } = await client.rpc('edit_message', {
        p_user_id: user.id,
        p_message_id: request.message_id,
        p_new_content: request.content,
      });

      if (error) {
        secureLogger.error('Edit message RPC error', {
          error,
          messageId: request.message_id,
        });
        return {
          success: false,
          error: 'メッセージの編集に失敗しました。',
          error_code: ChatErrorCode.SYSTEM_ERROR,
        };
      }

      if (!data?.success) {
        const errorMapping: Record<
          string,
          { error: string; code: ChatErrorCode }
        > = {
          'Message not found': {
            error: 'メッセージが見つかりません。',
            code: ChatErrorCode.MESSAGE_NOT_FOUND,
          },
          'Access denied': {
            error: 'このメッセージを編集する権限がありません。',
            code: ChatErrorCode.ACCESS_DENIED,
          },
          'Permission denied': {
            error: 'このメッセージを編集する権限がありません。',
            code: ChatErrorCode.ACCESS_DENIED,
          },
        };

        const mappedError = errorMapping[data?.error] || {
          error: 'メッセージの編集に失敗しました。',
          code: ChatErrorCode.SYSTEM_ERROR,
        };

        return {
          success: false,
          error: mappedError.error,
          error_code: mappedError.code,
        };
      }

      // Transform the response to MessageWithSender format
      const updatedMessage: MessageWithSender = {
        id: data.message.id,
        chat_id: data.message.conversation_id,
        sender_id: data.message.sender_id,
        content: data.message.content,
        message_type: data.message.message_type,
        created_at: data.message.created_at,
        updated_at: data.message.updated_at,
        edited_at: data.message.updated_at,
        deleted_at: null,
        reply_to_message_id: null,
        metadata: data.message.metadata,
        sender: {
          id: user.id,
          username: user.user_metadata?.username || user.email || '',
          display_name: user.user_metadata?.display_name || user.email || '',
          avatar_emoji: user.user_metadata?.avatar_emoji || '👤',
          bio: '',
          created_at: '',
          updated_at: '',
          profile_visibility: 'public',
          is_active: true,
        },
        read_by: [],
        is_read: true,
        is_edited: data.message.is_edited || true,
        delivery_status: [],
        read_receipt_status: 'unread' as any,
      };

      // Invalidate message cache for this chat
      this.invalidateMessageCache(data.message.conversation_id);

      return {
        success: true,
        data: updatedMessage,
      };
    } catch (error) {
      secureLogger.error('Edit message exception', {
        error,
        messageId: request.message_id,
      });
      return {
        success: false,
        error: 'メッセージの編集中にエラーが発生しました。',
        error_code: ChatErrorCode.SYSTEM_ERROR,
      };
    }
  }

  /**
   * Deletes a message
   */
  async deleteMessage(
    request: DeleteMessageRequest
  ): Promise<ChatResponse<boolean>> {
    try {
      secureLogger.info('Deleting message', { messageId: request.message_id });

      const client = getSupabaseClient();

      // Get current user from Supabase session
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          error: '認証が必要です。',
          error_code: ChatErrorCode.ACCESS_DENIED,
        };
      }

      const { data, error } = await client.rpc('delete_message', {
        p_user_id: user.id,
        p_message_id: request.message_id,
      });

      if (error) {
        secureLogger.error('Delete message RPC error', {
          error,
          messageId: request.message_id,
        });
        return {
          success: false,
          error: 'メッセージの削除に失敗しました。',
          error_code: ChatErrorCode.SYSTEM_ERROR,
        };
      }

      if (!data?.success) {
        const errorMapping: Record<
          string,
          { error: string; code: ChatErrorCode }
        > = {
          'Message not found': {
            error: 'メッセージが見つかりません。',
            code: ChatErrorCode.MESSAGE_NOT_FOUND,
          },
          'Access denied': {
            error: 'このメッセージを削除する権限がありません。',
            code: ChatErrorCode.ACCESS_DENIED,
          },
          'Permission denied': {
            error: 'このメッセージを削除する権限がありません。',
            code: ChatErrorCode.ACCESS_DENIED,
          },
        };

        const mappedError = errorMapping[data?.error] || {
          error: 'メッセージの削除に失敗しました。',
          code: ChatErrorCode.SYSTEM_ERROR,
        };

        return {
          success: false,
          error: mappedError.error,
          error_code: mappedError.code,
        };
      }

      secureLogger.info('Message deleted successfully', {
        messageId: request.message_id,
      });

      // Invalidate message cache - we don't have chat_id directly, so invalidate all caches
      // In a production app, we'd want to get the chat_id from the response or store it
      this.invalidateAllMessageCaches();

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      secureLogger.error('Delete message exception', {
        error,
        messageId: request.message_id,
      });
      return {
        success: false,
        error: 'メッセージの削除中にエラーが発生しました。',
        error_code: ChatErrorCode.SYSTEM_ERROR,
      };
    }
  }

  // =====================================================
  // READ STATUS MANAGEMENT
  // =====================================================

  /**
   * Marks messages as read
   */
  async markAsRead(request: MarkAsReadRequest): Promise<ChatResponse<boolean>> {
    try {
      const client = getSupabaseClient();

      // Get current user from Supabase session
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          error: '認証が必要です。',
          error_code: ChatErrorCode.ACCESS_DENIED,
        };
      }

      const { error } = await client.rpc('mark_conversation_read', {
        p_user_id: user.id,
        p_conversation_id: request.chat_id,
        p_last_message_id:
          request.message_ids && request.message_ids.length > 0
            ? request.message_ids[0]
            : null,
      });

      if (error) {
        secureLogger.error('Mark as read RPC error', {
          error,
          chatId: request.chat_id,
        });
        return {
          success: false,
          error: '既読状態の更新に失敗しました。',
          error_code: ChatErrorCode.SYSTEM_ERROR,
        };
      }

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      secureLogger.error('Mark as read exception', {
        error,
        chatId: request.chat_id,
      });
      return {
        success: false,
        error: '既読状態の更新中にエラーが発生しました。',
        error_code: ChatErrorCode.SYSTEM_ERROR,
      };
    }
  }

  // =====================================================
  // TYPING INDICATORS
  // =====================================================

  /**
   * Updates typing status
   */
  async updateTypingStatus(
    request: UpdateTypingRequest
  ): Promise<ChatResponse<boolean>> {
    try {
      const client = getSupabaseClient();

      // Get current user from Supabase session
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          error: '認証が必要です。',
          error_code: ChatErrorCode.ACCESS_DENIED,
        };
      }

      // Clear existing typing timeout
      const timeoutKey = `${request.chat_id}_${user.id}`;
      const existingTimeout = this.typingTimeouts.get(timeoutKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new timeout to auto-stop typing
      if (request.is_typing) {
        const timeout = setTimeout(() => {
          this.updateTypingStatus({
            chat_id: request.chat_id,
            is_typing: false,
          });
        }, CHAT_CONFIG.TYPING_TIMEOUT_MS);
        this.typingTimeouts.set(timeoutKey, timeout);
      }
      const { error } = await client.rpc('update_typing_status', {
        p_user_id: user.id,
        p_conversation_id: request.chat_id,
        p_is_typing: request.is_typing,
      });

      if (error) {
        secureLogger.error('Update typing status RPC error', {
          error,
          chatId: request.chat_id,
        });
        return {
          success: false,
          error: 'タイピング状態の更新に失敗しました。',
          error_code: ChatErrorCode.SYSTEM_ERROR,
        };
      }

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      secureLogger.error('Update typing status exception', {
        error,
        chatId: request.chat_id,
      });
      return {
        success: false,
        error: 'タイピング状態の更新中にエラーが発生しました。',
        error_code: ChatErrorCode.SYSTEM_ERROR,
      };
    }
  }

  // =====================================================
  // REAL-TIME SUBSCRIPTIONS
  // =====================================================

  /**
   * Subscribes to chat events for real-time updates
   */
  async subscribeToChat(
    chatId: string,
    onEvent: (event: ChatEvent) => void
  ): Promise<ChatResponse<string>> {
    try {
      const client = getSupabaseClient();

      // Get current user from Supabase session
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          error: '認証が必要です。',
          error_code: ChatErrorCode.ACCESS_DENIED,
        };
      }

      // Check if already subscribed
      const subscriptionKey = `chat_${chatId}`;
      if (this.realtimeSubscriptions.has(subscriptionKey)) {
        return {
          success: true,
          data: subscriptionKey,
        };
      }
      const subscription = client
        .channel(`chat:${chatId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${chatId}`,
          },
          payload => {
            const eventData = payload.new || payload.old || {};
            const event: MessageEvent = {
              type:
                payload.eventType === 'INSERT'
                  ? ChatEventType.NEW_MESSAGE
                  : payload.eventType === 'UPDATE'
                    ? ChatEventType.MESSAGE_UPDATED
                    : ChatEventType.MESSAGE_DELETED,
              chat_id: chatId,
              user_id: eventData.sender_id || '',
              timestamp: new Date().toISOString(),
              data: eventData as MessageWithSender,
            };
            onEvent(event);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'typing_status',
            filter: `chat_id=eq.${chatId}`,
          },
          payload => {
            const eventData = payload.new || {};
            const event: TypingEvent = {
              type: eventData.is_typing
                ? ChatEventType.TYPING_STARTED
                : ChatEventType.TYPING_STOPPED,
              chat_id: chatId,
              user_id: eventData.user_id || '',
              timestamp: new Date().toISOString(),
              data: {
                user: { id: eventData.user_id || '' } as PublicUserProfile, // Will be enriched by UI
                is_typing: eventData.is_typing || false,
              },
            };
            onEvent(event);
          }
        )
        .subscribe();

      this.realtimeSubscriptions.set(subscriptionKey, subscription);

      return {
        success: true,
        data: subscriptionKey,
      };
    } catch (error) {
      secureLogger.error('Subscribe to chat exception', { error, chatId });
      return {
        success: false,
        error: 'リアルタイム接続に失敗しました。',
        error_code: ChatErrorCode.SYSTEM_ERROR,
      };
    }
  }

  /**
   * Unsubscribes from chat events
   */
  async unsubscribeFromChat(chatId: string): Promise<void> {
    const subscriptionKey = `chat_${chatId}`;
    const subscription = this.realtimeSubscriptions.get(subscriptionKey);

    if (subscription) {
      await subscription.unsubscribe();
      this.realtimeSubscriptions.delete(subscriptionKey);
    }

    // Clear typing timeouts - we can't easily get current user here, so clear all for this chat
    const timeoutEntries = Array.from(this.typingTimeouts.entries());
    for (const [key, timeout] of timeoutEntries) {
      if (key.startsWith(`${chatId}_`)) {
        clearTimeout(timeout);
        this.typingTimeouts.delete(key);
      }
    }
  }

  // =====================================================
  // SEARCH FUNCTIONALITY
  // =====================================================

  /**
   * Searches chats
   */
  async searchChats(
    params: ChatSearchParams
  ): Promise<ChatResponse<ChatWithParticipants[]>> {
    try {
      const client = getSupabaseClient();

      // Get current user from Supabase session
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          error: '認証が必要です。',
          error_code: ChatErrorCode.ACCESS_DENIED,
        };
      }
      // Note: search_chats function doesn't exist, using get_user_conversations as fallback
      const { data, error } = await client.rpc('get_user_conversations', {
        p_user_id: user.id,
        p_limit: 50,
      });

      // Filter results based on search query if provided
      let filteredData = data;
      if (params.query && data) {
        filteredData = data.filter(
          (conv: any) =>
            conv.participant_display_name
              ?.toLowerCase()
              .includes(params.query.toLowerCase()) ||
            conv.participant_username
              ?.toLowerCase()
              .includes(params.query.toLowerCase())
        );
      }

      if (error) {
        secureLogger.error('Search chats RPC error', { error });
        return {
          success: false,
          error: 'チャット検索に失敗しました。',
          error_code: ChatErrorCode.SYSTEM_ERROR,
        };
      }

      // Transform to ChatWithParticipants format
      const chats: ChatWithParticipants[] = (filteredData || []).map(
        (conversation: any) => ({
          id: conversation.id,
          chat_type: 'direct',
          created_at: conversation.updated_at,
          updated_at: conversation.updated_at,
          last_message_at: conversation.last_message_created_at,
          is_active: true,
          metadata: null,
          participants: [
            {
              id: conversation.participant_id,
              username: conversation.participant_username,
              display_name: conversation.participant_display_name,
              avatar_emoji: conversation.participant_avatar_emoji,
              bio: '',
              created_at: '',
              updated_at: '',
              profile_visibility: 'public',
              is_active: true,
            },
          ],
          participant_ids: [conversation.participant_id],
          unread_count: conversation.unread_count || 0,
          participants_presence: [],
          typing_users: [],
        })
      );

      return {
        success: true,
        data: chats,
      };
    } catch (error) {
      secureLogger.error('Search chats exception', { error });
      return {
        success: false,
        error: 'チャット検索中にエラーが発生しました。',
        error_code: ChatErrorCode.SYSTEM_ERROR,
      };
    }
  }

  /**
   * Searches messages
   */
  async searchMessages(
    params: MessageSearchParams
  ): Promise<ChatResponse<MessageWithSender[]>> {
    try {
      const client = getSupabaseClient();

      // Get current user from Supabase session
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          error: '認証が必要です。',
          error_code: ChatErrorCode.ACCESS_DENIED,
        };
      }
      // Note: search_messages function doesn't exist
      // This would need to be implemented in the database
      return {
        success: false,
        error: 'メッセージ検索機能は現在利用できません。',
        error_code: ChatErrorCode.SYSTEM_ERROR,
      };

      if (error) {
        secureLogger.error('Search messages RPC error', { error });
        return {
          success: false,
          error: 'メッセージ検索に失敗しました。',
          error_code: ChatErrorCode.SYSTEM_ERROR,
        };
      }
    } catch (err) {
      secureLogger.error('Search messages exception', { error: err });
      return {
        success: false,
        error: 'メッセージ検索中にエラーが発生しました。',
        error_code: ChatErrorCode.SYSTEM_ERROR,
      };
    }
  }

  /**
   * Sends invitation message to multiple users
   */
  async sendInvitationMessage(request: {
    userIds: string[];
    spaceName: string;
    spaceId: string;
    inviterName: string;
  }): Promise<ChatResponse<{ successful: string[]; failed: string[] }>> {
    try {
      secureLogger.info('Sending invitation messages', {
        userCount: request.userIds.length,
        spaceName: request.spaceName,
      });

      const client = getSupabaseClient();

      // Get current user from Supabase session
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          error: '認証が必要です。',
          error_code: ChatErrorCode.AUTHENTICATION_REQUIRED,
        };
      }

      const successful: string[] = [];
      const failed: string[] = [];

      // Send invitation to each user
      for (const userId of request.userIds) {
        try {
          // Create or get conversation with this user
          console.log('🔍 Creating/getting conversation with user:', userId);
          
          // First try to find existing conversation
          const { data: existingConv, error: findError } = await client
            .from('conversations')
            .select('id')
            .or(`and(participant_1_id.eq.${user.id},participant_2_id.eq.${userId}),and(participant_1_id.eq.${userId},participant_2_id.eq.${user.id})`)
            .single();
          
          let conversationId;
          
          if (existingConv) {
            conversationId = existingConv.id;
            console.log('🔍 Found existing conversation:', conversationId);
          } else {
            // Create new conversation
            const { data: newConv, error: createError } = await client
              .from('conversations')
              .insert({
                participant_1_id: user.id,
                participant_2_id: userId,
              })
              .select('id')
              .single();
            
            if (createError || !newConv) {
              secureLogger.error('Failed to create conversation for invitation', {
                error: createError,
                userId,
              });
              console.log('❌ Failed to create conversation:', createError);
              failed.push(userId);
              continue;
            }
            
            conversationId = newConv.id;
            console.log('🔍 Created new conversation:', conversationId);
          }

          // Create database invitation record first (skip for development/testing)
          let invitationId = null;
          const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';
          
          if (!isDevelopment) {
            try {
              const { data: inviteData, error: inviteError } = await client.rpc('create_room_invitation', {
                p_space_id: request.spaceId,
                p_invitee_id: userId,
              });

              if (inviteData?.success) {
                invitationId = inviteData.invitation_id;
              } else {
                secureLogger.warn('Failed to create database invitation record', {
                  error: inviteError || inviteData?.error,
                  userId,
                });
                // Continue with message sending even if DB record fails
              }
            } catch (error) {
              secureLogger.warn('Exception creating database invitation record', {
                error,
                userId,
              });
              // Continue with message sending even if DB record fails
            }
          }

          // Send invitation message (add unique ID for testing)
          const timestamp = new Date().toLocaleString('ja-JP');
          const inviteId = Math.random().toString(36).substr(2, 9);
          const invitationMessage = `${request.inviterName}さんから非公開ルーム「${request.spaceName}」への招待が届きました。\n\n参加しますか？\n\n✅ 参加する\n❌ 参加しない\n\n送信時刻: ${timestamp}\nID: ${inviteId}`;
          
          // Debug log for invitation message sending
          console.log('🔍 Sending invitation to user:', userId);
          console.log('🔍 Conversation ID:', conversationId);
          
          // Direct database insertion instead of RPC
          const { data: messageData, error: messageError } = await client
            .from('messages')
            .insert({
              conversation_id: conversationId,
              sender_id: user.id,
              content: invitationMessage,
              message_type: 'text', // Use 'text' instead of 'system' for now
              metadata: {
                type: 'room_invitation',
                space_id: request.spaceId,
                space_name: request.spaceName,
                inviter_id: user.id,
                inviter_name: request.inviterName,
                status: 'pending',
                invitation_id: invitationId, // Link to database record
              },
            })
            .select()
            .single();
          
          console.log('🔍 Message sending result:', { data: messageData, error: messageError });

          // Update invitation record with message ID if both succeeded
          if (!messageError && messageData?.id && invitationId) {
            try {
              await client
                .from('room_invitations')
                .update({ message_id: messageData.id })
                .eq('id', invitationId);
            } catch (error) {
              secureLogger.warn('Failed to update invitation with message ID', {
                error,
                invitationId,
                messageId: messageData.id,
              });
            }
          }

          if (messageError) {
            secureLogger.error('Failed to send invitation message', {
              error: messageError,
              userId,
            });
            failed.push(userId);
          } else {
            successful.push(userId);
          }
        } catch (error) {
          secureLogger.error('Exception while sending invitation', {
            error,
            userId,
          });
          failed.push(userId);
        }
      }

      secureLogger.info('Invitation sending completed', {
        successful: successful.length,
        failed: failed.length,
        spaceName: request.spaceName,
      });

      return {
        success: true,
        data: { successful, failed },
      };
    } catch (error) {
      secureLogger.error('Send invitation messages exception', { error });
      return {
        success: false,
        error: '招待メッセージの送信中にエラーが発生しました。',
        error_code: ChatErrorCode.SYSTEM_ERROR,
      };
    }
  }

  /**
   * Creates a new chat or gets existing direct chat with user
   */
  async createOrGetChat(request: {
    participantIds: string[];
    type: 'direct' | 'group';
    metadata?: any;
  }): Promise<ChatResponse<ChatWithParticipants>> {
    try {
      if (request.type === 'direct' && request.participantIds.length === 1) {
        const otherUserId = request.participantIds[0];

        secureLogger.info('Creating/getting direct chat', { otherUserId });

        // Use the same pattern as postService - direct client call
        const client = getSupabaseClient();

        // Get current user from Supabase session
        const {
          data: { user },
          error: authError,
        } = await client.auth.getUser();
        if (authError || !user) {
          return {
            success: false,
            error: '認証が必要です。',
            error_code: ChatErrorCode.AUTHENTICATION_REQUIRED,
          };
        }

        const { data, error } = await client.rpc('get_or_create_conversation', {
          p_user1_id: user.id,
          p_user2_id: otherUserId,
        });

        if (error) {
          secureLogger.error('Failed to create/get conversation via RPC', {
            error,
          });
          return {
            success: false,
            error: 'チャットの作成に失敗しました',
            error_code: ChatErrorCode.SUPABASE_ERROR,
          };
        }

        if (!data) {
          return {
            success: false,
            error: 'チャットの作成に失敗しました',
            error_code: ChatErrorCode.SYSTEM_ERROR,
          };
        }

        // Successfully created/found chat
        secureLogger.info('Chat created/found successfully', { chatId: data });

        // Return basic chat info with the ID we have
        return {
          success: true,
          data: {
            id: data,
            chat_type: 'direct',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_message_at: null,
            is_active: true,
            metadata: null,
            participants: [],
            participant_ids: [otherUserId],
            unread_count: 0,
            participants_presence: [],
            typing_users: [],
          } as ChatWithParticipants,
        };
      }

      return {
        success: false,
        error: 'グループチャットはまだサポートされていません',
        error_code: ChatErrorCode.VALIDATION_ERROR,
      };
    } catch (error) {
      secureLogger.error('Error in createOrGetChat', { error });
      return {
        success: false,
        error: 'チャットの作成・取得に失敗しました',
        error_code: ChatErrorCode.SYSTEM_ERROR,
      };
    }
  }

  // =====================================================
  // CLEANUP AND UTILITIES
  // =====================================================

  /**
   * Cleans up all resources
   */
  async cleanup(): Promise<void> {
    // Unsubscribe from all real-time channels
    const subscriptions = Array.from(this.realtimeSubscriptions.values());
    for (const subscription of subscriptions) {
      await subscription.unsubscribe();
    }
    this.realtimeSubscriptions.clear();

    // Clear all typing timeouts
    const timeouts = Array.from(this.typingTimeouts.values());
    for (const timeout of timeouts) {
      clearTimeout(timeout);
    }
    this.typingTimeouts.clear();

    secureLogger.info('Chat service cleanup completed');
  }

  /**
   * Gets service statistics
   */
  getStats() {
    return {
      activeSubscriptions: this.realtimeSubscriptions.size,
      activeTypingTimeouts: this.typingTimeouts.size,
      cache: this.cacheManager.getStats(),
    };
  }

  /**
   * Test database connection and authentication
   */
  async testConnection(): Promise<ChatResponse<any>> {
    try {
      const client = getSupabaseClient();

      // Test authentication
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          error: 'Authentication failed',
          error_code: ChatErrorCode.ACCESS_DENIED,
        };
      }

      // Test database access with a simple query
      const { data, error } = await client
        .from('profiles')
        .select('id, username')
        .eq('id', user.id)
        .limit(1);

      if (error) {
        return {
          success: false,
          error: `Database error: ${error.message}`,
          error_code: ChatErrorCode.SYSTEM_ERROR,
        };
      }

      return {
        success: true,
        data: {
          user,
          profile: data?.[0] || null,
          message: 'Connection test successful',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Connection test failed: ${error}`,
        error_code: ChatErrorCode.SYSTEM_ERROR,
      };
    }
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const chatService = new ChatService();

export default chatService;
