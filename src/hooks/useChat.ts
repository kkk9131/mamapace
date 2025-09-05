/**
 * SECURE CHAT HOOK
 *
 * React hook for managing individual chat conversations with:
 * - Real-time message updates
 * - Typing indicators
 * - Read status management
 * - Message sending/editing/deletion
 * - Optimistic updates with rollback
 * - Error handling and retry logic
 */

import { useState, useEffect, useCallback, useRef } from 'react';

import { chatService } from '../services/chatService';
import { secureLogger } from '../utils/privacyProtection';
import {
  ChatWithParticipants,
  MessageWithSender,
  SendMessageRequest,
  EditMessageRequest,
  DeleteMessageRequest,
  ChatResponse,
  ChatEvent,
  ChatEventType,
  MessageEvent,
  TypingEvent,
  ReadStatusEvent,
  MessageType,
  PaginatedMessages,
  ChatPaginationParams,
  OptimisticMessage,
  sanitizeChatForLogging,
  sanitizeMessageForLogging,
  createSendMessageRequest,
} from '../types/chat';
import { useAuth } from '../contexts/AuthContext';

// =====================================================
// HOOK STATE TYPES
// =====================================================

interface ChatState {
  chat: ChatWithParticipants | null;
  messages: MessageWithSender[];
  isLoading: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  error: string | null;
  hasMoreMessages: boolean;
  nextCursor?: string;
  typingUsers: string[]; // User IDs currently typing
}

// OptimisticMessage type is now imported from types/chat

// =====================================================
// HOOK CONFIGURATION
// =====================================================

const HOOK_CONFIG = {
  MESSAGE_PAGE_SIZE: 20,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
  TYPING_DEBOUNCE_MS: 500,
  OPTIMISTIC_TIMEOUT_MS: 10000, // Remove optimistic message after 10s if no response
  AUTO_READ_DELAY_MS: 1000, // Mark as read after 1s of viewing
} as const;

// =====================================================
// CHAT HOOK
// =====================================================

// 軽量なメモリキャッシュ（画面遷移時の一時消失防止）
const chatStateCache = new Map<
  string,
  {
    messages: MessageWithSender[];
    chat: ChatWithParticipants | null;
    nextCursor?: string;
  }
>();

export function useChat(chatId: string) {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<ChatState>({
    chat: null,
    messages: [],
    isLoading: false,
    isLoadingMessages: false,
    isSending: false,
    error: null,
    hasMoreMessages: true,
    typingUsers: [],
  });

  // Refs for managing subscriptions and timeouts
  const subscriptionRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoReadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  // =====================================================
  // STATE MANAGEMENT HELPERS
  // =====================================================

  const updateState = useCallback((updates: Partial<ChatState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const setError = useCallback(
    (error: string | null) => {
      updateState({
        error,
        isLoading: false,
        isLoadingMessages: false,
        isSending: false,
      });
    },
    [updateState]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  // =====================================================
  // MESSAGE MANAGEMENT
  // =====================================================

  /**
   * Adds a message to the state (with deduplication)
   */
  const addMessage = useCallback((message: MessageWithSender) => {
    setState(prev => {
      const existingIndex = prev.messages.findIndex(m => m.id === message.id);
      if (existingIndex >= 0) {
        // Update existing message
        const newMessages = [...prev.messages];
        newMessages[existingIndex] = message;
        return { ...prev, messages: newMessages };
      } else {
        // Add new message in chronological order
        const newMessages = [...prev.messages, message].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        return { ...prev, messages: newMessages };
      }
    });
  }, []);

  /**
   * Updates a message in the state
   */
  const updateMessage = useCallback(
    (messageId: string, updates: Partial<MessageWithSender>) => {
      setState(prev => {
        const newMessages = prev.messages.map(msg =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        );
        return { ...prev, messages: newMessages };
      });
    },
    []
  );

  /**
   * Removes a message from the state
   */
  const removeMessage = useCallback((messageId: string) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.filter(msg => msg.id !== messageId),
    }));
  }, []);

  /**
   * Adds an optimistic message (before server confirmation)
   */
  const addOptimisticMessage = useCallback(
    (tempMessage: OptimisticMessage): string => {
      const tempId = `temp_${Date.now()}_${Math.random()}`;
      const optimisticMessage: OptimisticMessage = {
        ...tempMessage,
        id: tempId,
        tempId,
        isOptimistic: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      addMessage(optimisticMessage);

      // Remove optimistic message after timeout if not confirmed
      setTimeout(() => {
        setState(prev => {
          const stillOptimistic = prev.messages.find(
            m =>
              'tempId' in m &&
              m.tempId === tempId &&
              'isOptimistic' in m &&
              m.isOptimistic
          );
          if (stillOptimistic) {
            return {
              ...prev,
              messages: prev.messages.filter(
                m => !('tempId' in m) || m.tempId !== tempId
              ),
            };
          }
          return prev;
        });
      }, HOOK_CONFIG.OPTIMISTIC_TIMEOUT_MS);

      return tempId;
    },
    [addMessage]
  );

  // =====================================================
  // REAL-TIME EVENT HANDLERS
  // =====================================================

  /**
   * Handles incoming chat events
   */
  const handleChatEvent = useCallback(
    (event: ChatEvent) => {
      try {
        switch (event.type) {
          case ChatEventType.NEW_MESSAGE: {
            const messageEvent = event as MessageEvent;

            // Check if this message already exists (prevent duplicates)
            setState(prev => {
              const existingMessage = prev.messages.find(
                m => m.id === messageEvent.data.id
              );
              if (existingMessage) {
                // Already exists, don't add again
                return prev;
              }

              // Remove optimistic message with same content if exists
              const optimisticIndex = prev.messages.findIndex(
                m =>
                  'isOptimistic' in m &&
                  m.isOptimistic &&
                  m.content === messageEvent.data.content &&
                  m.sender_id === messageEvent.data.sender_id
              );

              const newMessages = [...prev.messages];
              if (optimisticIndex >= 0) {
                newMessages.splice(optimisticIndex, 1);
              }

              // Add real message
              newMessages.push(messageEvent.data);
              newMessages.sort(
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime()
              );

              return { ...prev, messages: newMessages };
            });

            // Don't use addMessage to avoid double processing

            break;
          }

          case ChatEventType.MESSAGE_UPDATED: {
            const messageEvent = event as MessageEvent;
            updateMessage(messageEvent.data.id, messageEvent.data);
            break;
          }

          case ChatEventType.MESSAGE_DELETED: {
            const messageEvent = event as MessageEvent;
            if (messageEvent.data.deleted_at) {
              // Soft delete - update message to show as deleted
              updateMessage(messageEvent.data.id, {
                content: 'このメッセージは削除されました',
                message_type: MessageType.DELETED,
                deleted_at: messageEvent.data.deleted_at,
              });
            } else {
              // Hard delete - remove from list
              removeMessage(messageEvent.data.id);
            }
            break;
          }

          case ChatEventType.TYPING_STARTED: {
            const typingEvent = event as TypingEvent;
            if (typingEvent.data.user.id !== user?.id) {
              setState(prev => ({
                ...prev,
                typingUsers: Array.from(
                  new Set([...prev.typingUsers, typingEvent.data.user.id])
                ),
              }));
            }
            break;
          }

          case ChatEventType.TYPING_STOPPED: {
            const typingEvent = event as TypingEvent;
            setState(prev => ({
              ...prev,
              typingUsers: prev.typingUsers.filter(
                id => id !== typingEvent.data.user.id
              ),
            }));
            break;
          }

          case ChatEventType.MESSAGE_READ: {
            const readEvent = event as ReadStatusEvent;
            // Use setState to access current messages
            setState(prev => {
              const message = prev.messages.find(
                m => m.id === readEvent.data.message_id
              );
              if (message) {
                const newMessages = prev.messages.map(msg =>
                  msg.id === readEvent.data.message_id
                    ? {
                        ...msg,
                        is_read: true,
                        read_by: [
                          ...(msg.read_by || []),
                          {
                            id: readEvent.data.reader.id,
                            message_id: readEvent.data.message_id,
                            user_id: readEvent.data.reader.id,
                            read_at: readEvent.data.read_at,
                            created_at: readEvent.data.read_at,
                          },
                        ],
                      }
                    : msg
                );
                return { ...prev, messages: newMessages };
              }
              return prev;
            });
            break;
          }

          default:
            secureLogger.info('Unhandled chat event type', {
              type: event.type,
            });
        }
      } catch (error) {
        secureLogger.error('Error handling chat event', {
          error,
          eventType: event.type,
        });
      }
    },
    [user?.id, addMessage, updateMessage, removeMessage]
  );

  // =====================================================
  // CORE FUNCTIONS
  // =====================================================

  /**
   * Loads chat details and initial messages
   */
  const loadChat = useCallback(async () => {
    if (!isAuthenticated || !user || !chatId) {
      return;
    }

    try {
      updateState({ isLoading: true, error: null });

      // Load chat details
      const chatResponse = await chatService.getChat(chatId);
      if (!chatResponse.success) {
        setError(chatResponse.error);
        return;
      }

      // Load initial messages
      const messagesResponse = await chatService.getMessages(chatId, {
        limit: HOOK_CONFIG.MESSAGE_PAGE_SIZE,
        order: 'desc',
      });

      if (!messagesResponse.success) {
        setError(messagesResponse.error);
        return;
      }

      updateState({
        chat: chatResponse.data,
        messages: messagesResponse.data.messages, // データベースの順序をそのまま使用
        hasMoreMessages: messagesResponse.data.has_more,
        nextCursor: messagesResponse.data.next_cursor,
        isLoading: false,
      });

      // Subscribe to real-time updates
      const subscriptionResponse = await chatService.subscribeToChat(
        chatId,
        handleChatEvent
      );
      if (subscriptionResponse.success) {
        subscriptionRef.current = subscriptionResponse.data;
      }

      secureLogger.info('Chat loaded successfully', {
        chatId,
        messageCount: messagesResponse.data.messages.length,
      });
    } catch (error) {
      secureLogger.error('Error loading chat', { error, chatId });
      setError('チャットの読み込み中にエラーが発生しました。');
    }
  }, [isAuthenticated, user, chatId, updateState, setError, handleChatEvent]);

  /**
   * Loads more messages (pagination)
   */
  const loadMoreMessages = useCallback(async () => {
    if (!state.hasMoreMessages || state.isLoadingMessages) {
      return;
    }

    try {
      updateState({ isLoadingMessages: true });

      const response = await chatService.getMessages(chatId, {
        limit: HOOK_CONFIG.MESSAGE_PAGE_SIZE,
        cursor: state.nextCursor,
        order: 'desc',
      });

      if (response.success) {
        setState(prev => ({
          ...prev,
          messages: [...response.data.messages, ...prev.messages], // データベースの順序をそのまま使用
          hasMoreMessages: response.data.has_more,
          nextCursor: response.data.next_cursor,
          isLoadingMessages: false,
        }));
      } else {
        setError(response.error);
      }
    } catch (error) {
      secureLogger.error('Error loading more messages', { error, chatId });
      setError('メッセージの読み込み中にエラーが発生しました。');
    }
  }, [
    chatId,
    state.hasMoreMessages,
    state.isLoadingMessages,
    state.nextCursor,
    updateState,
    setError,
  ]);

  /**
   * Sends a new message with optimistic updates
   */
  const sendMessage = useCallback(
    async (
      content: string,
      messageType: MessageType = MessageType.TEXT,
      replyToMessageId?: string,
      metadata?: Partial<MessageMetadata>
    ) => {
      if (!user || !state.chat || state.isSending) {
        return;
      }

      if (!content.trim()) {
        // allow empty content if metadata (e.g., attachments) exists
        if (
          !metadata ||
          !('attachments' in metadata) ||
          !(metadata as any).attachments?.length
        ) {
          setError('メッセージを入力してください。');
          return;
        }
      }

      try {
        updateState({ isSending: true, error: null });

        // Create optimistic message
        const optimisticMessage: OptimisticMessage = {
          id: '',
          chat_id: chatId,
          sender_id: user.id,
          sender: user,
          content: content.trim(),
          message_type: messageType,
          created_at: '',
          updated_at: '',
          edited_at: null,
          deleted_at: null,
          reply_to_message_id: replyToMessageId || null,
          metadata: metadata || null,
          read_by: [],
          is_read: false, // Initially not read by anyone
          isOptimistic: true,
        };

        const tempId = addOptimisticMessage(optimisticMessage);

        // Send message to server
        const request = createSendMessageRequest({
          chat_id: chatId,
          content: content.trim(),
          message_type: messageType,
          reply_to_message_id: replyToMessageId,
          metadata,
        });

        const response = await chatService.sendMessage(request);

        updateState({ isSending: false });

        if (response.success) {
          // Replace optimistic message with real message immediately
          setState(prev => ({
            ...prev,
            messages: prev.messages.map(m =>
              'tempId' in m && m.tempId === tempId
                ? { ...response.data, isOptimistic: false }
                : m
            ),
          }));

          secureLogger.info('Message sent successfully', {
            messageId: response.data.id,
            chatId,
          });
        } else {
          // Mark optimistic message as failed - cast to OptimisticMessage
          const errorUpdate = {
            isOptimistic: false,
          } as Partial<OptimisticMessage>;
          setState(prev => ({
            ...prev,
            messages: prev.messages.map(m =>
              'tempId' in m && m.tempId === tempId
                ? { ...m, ...errorUpdate, error: response.error }
                : m
            ),
          }));
          setError(response.error);
        }
      } catch (error) {
        updateState({ isSending: false });
        secureLogger.error('Error sending message', { error, chatId });
        setError('メッセージの送信中にエラーが発生しました。');
      }
    },
    [
      user,
      state.chat,
      state.isSending,
      chatId,
      updateState,
      setError,
      addOptimisticMessage,
      updateMessage,
    ]
  );

  /**
   * Edits an existing message
   */
  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!newContent.trim()) {
        setError('メッセージを入力してください。');
        return;
      }

      try {
        const request: EditMessageRequest = {
          message_id: messageId,
          content: newContent.trim(),
        };

        const response = await chatService.editMessage(request);

        if (response.success) {
          // Message will be updated via real-time event
          secureLogger.info('Message edited successfully', {
            messageId,
            chatId,
          });
        } else {
          setError(response.error);
        }
      } catch (error) {
        secureLogger.error('Error editing message', {
          error,
          messageId,
          chatId,
        });
        setError('メッセージの編集中にエラーが発生しました。');
      }
    },
    [chatId, setError]
  );

  /**
   * Deletes a message
   */
  const deleteMessage = useCallback(
    async (messageId: string, deleteForEveryone: boolean = false) => {
      try {
        const request: DeleteMessageRequest = {
          message_id: messageId,
          delete_for_everyone: deleteForEveryone,
        };

        const response = await chatService.deleteMessage(request);

        if (response.success) {
          // Remove immediately from UI
          removeMessage(messageId);
          secureLogger.info('Message deleted successfully', {
            messageId,
            chatId,
          });
        } else {
          setError(response.error);
        }
      } catch (error) {
        secureLogger.error('Error deleting message', {
          error,
          messageId,
          chatId,
        });
        setError('メッセージの削除中にエラーが発生しました。');
      }
    },
    [chatId, setError, removeMessage]
  );

  /**
   * Updates typing status with debouncing
   */
  const updateTypingStatus = useCallback(
    async (isTyping: boolean) => {
      try {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        if (isTyping) {
          // Debounce typing start
          typingTimeoutRef.current = setTimeout(async () => {
            await chatService.updateTypingStatus({
              chat_id: chatId,
              is_typing: true,
            });
          }, HOOK_CONFIG.TYPING_DEBOUNCE_MS);
        } else {
          // Stop typing immediately
          await chatService.updateTypingStatus({
            chat_id: chatId,
            is_typing: false,
          });
        }
      } catch (error) {
        secureLogger.error('Error updating typing status', { error, chatId });
      }
    },
    [chatId]
  );

  /**
   * Retries failed operations
   */
  const retry = useCallback(async () => {
    if (retryCountRef.current >= HOOK_CONFIG.RETRY_ATTEMPTS) {
      setError('再試行回数が上限に達しました。');
      return;
    }

    retryCountRef.current++;
    clearError();

    setTimeout(() => {
      loadChat();
    }, HOOK_CONFIG.RETRY_DELAY_MS * retryCountRef.current);
  }, [loadChat, setError, clearError]);

  // =====================================================
  // EFFECTS
  // =====================================================

  /**
   * Initialize chat on mount or when chatId changes
   */
  useEffect(() => {
    if (chatId && isAuthenticated) {
      retryCountRef.current = 0;
      // キャッシュがあれば即時反映（非同期ロード完了までのチラつき回避）
      const cached = chatStateCache.get(chatId);
      if (cached) {
        setState(prev => ({
          ...prev,
          chat: cached.chat,
          messages: cached.messages,
          nextCursor: cached.nextCursor,
        }));
      }
      loadChat();
    }

    // Cleanup on unmount or chatId change
    return () => {
      if (subscriptionRef.current) {
        chatService.unsubscribeFromChat(chatId);
        subscriptionRef.current = null;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (autoReadTimeoutRef.current) {
        clearTimeout(autoReadTimeoutRef.current);
      }

      // 現在の状態をキャッシュに保存（次回マウントで即時反映）
      chatStateCache.set(chatId, {
        chat: state.chat,
        messages: state.messages,
        nextCursor: state.nextCursor,
      });
    };
    // Remove loadChat from dependencies to prevent infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, isAuthenticated]);

  /**
   * Handle visibility change for auto-read
   */
  // Temporarily disable auto-mark as read to prevent infinite loops
  // This needs proper implementation later
  /*
  useEffect(() => {
    // Disabled to prevent infinite loop
  }, []);
  */

  // =====================================================
  // RETURN VALUES
  // =====================================================

  return {
    // State
    chat: state.chat,
    messages: state.messages,
    isLoading: state.isLoading,
    isLoadingMessages: state.isLoadingMessages,
    isSending: state.isSending,
    error: state.error,
    hasMoreMessages: state.hasMoreMessages,
    typingUsers: state.typingUsers,

    // Actions
    sendMessage,
    editMessage,
    deleteMessage,
    updateTypingStatus,
    loadMoreMessages,
    retry,
    clearError,

    // Utilities
    isConnected: !!subscriptionRef.current,
    canLoadMore: state.hasMoreMessages && !state.isLoadingMessages,
  };
}

export default useChat;
