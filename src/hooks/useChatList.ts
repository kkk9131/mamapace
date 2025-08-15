/**
 * SECURE CHAT LIST HOOK
 * 
 * React hook for managing chat list with:
 * - Real-time updates for new messages and chat changes
 * - Pagination and infinite scroll support
 * - Search and filtering capabilities
 * - Unread message counting
 * - Chat creation functionality
 * - Optimistic updates
 * - Error handling and retry logic
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { chatService } from '../services/chatService';
import { secureLogger } from '../utils/privacyProtection';
import {
  ChatWithParticipants,
  CreateChatRequest,
  ChatResponse,
  ChatEvent,
  ChatEventType,
  MessageEvent,
  PaginatedChats,
  ChatPaginationParams,
  ChatSearchParams,
  sanitizeChatForLogging,
  createChatRequest
} from '../types/chat';
import { PublicUserProfile } from '../types/auth';
import { useAuth } from '../contexts/AuthContext';

// =====================================================
// HOOK STATE TYPES
// =====================================================

interface ChatListState {
  chats: ChatWithParticipants[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isCreatingChat: boolean;
  error: string | null;
  hasMore: boolean;
  totalCount: number;
  nextCursor?: string;
  searchQuery: string;
  searchResults: ChatWithParticipants[];
  isSearching: boolean;
}

interface ChatListFilters {
  hasUnread?: boolean;
  chatType?: 'direct' | 'group';
  participantId?: string;
}

// =====================================================
// HOOK CONFIGURATION
// =====================================================

const HOOK_CONFIG = {
  PAGE_SIZE: 20,
  SEARCH_DEBOUNCE_MS: 300,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
  REFRESH_INTERVAL_MS: 30000, // Refresh chat list every 30 seconds
  UNREAD_UPDATE_DEBOUNCE_MS: 500
} as const;

// =====================================================
// CHAT LIST HOOK
// =====================================================

export function useChatList(filters: ChatListFilters = {}) {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<ChatListState>({
    chats: [],
    isLoading: false,
    isLoadingMore: false,
    isCreatingChat: false,
    error: null,
    hasMore: true,
    totalCount: 0,
    searchQuery: '',
    searchResults: [],
    isSearching: false
  });

  // Refs for managing timeouts and subscriptions
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionsRef = useRef<Map<string, string>>(new Map());
  const retryCountRef = useRef(0);

  // =====================================================
  // STATE MANAGEMENT HELPERS
  // =====================================================

  const updateState = useCallback((updates: Partial<ChatListState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const setError = useCallback((error: string | null) => {
    updateState({ 
      error, 
      isLoading: false, 
      isLoadingMore: false, 
      isCreatingChat: false,
      isSearching: false 
    });
  }, [updateState]);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  // =====================================================
  // CHAT MANAGEMENT HELPERS
  // =====================================================

  /**
   * Updates or adds a chat in the list (順序固定版)
   */
  const updateChatInList = useCallback((updatedChat: ChatWithParticipants) => {
    setState(prev => {
      const existingIndex = prev.chats.findIndex(chat => chat.id === updatedChat.id);
      
      if (existingIndex >= 0) {
        // 既存のチャットを同じ位置で更新（位置は変更しない）
        const newChats = [...prev.chats];
        newChats[existingIndex] = {
          ...newChats[existingIndex],
          // 重要な情報のみ更新して順序に影響するデータは更新しない
          last_message: updatedChat.last_message,
          last_message_at: newChats[existingIndex].last_message_at, // 既存の時刻を保持
          unread_count: updatedChat.unread_count
        };
        
        return { ...prev, chats: newChats };
      } else {
        // 新しいチャットは末尾に追加
        return {
          ...prev,
          chats: [...prev.chats, updatedChat],
          totalCount: prev.totalCount + 1
        };
      }
    });
  }, []);

  /**
   * Removes a chat from the list
   */
  const removeChatFromList = useCallback((chatId: string) => {
    setState(prev => ({
      ...prev,
      chats: prev.chats.filter(chat => chat.id !== chatId),
      totalCount: Math.max(0, prev.totalCount - 1)
    }));
  }, []);

  /**
   * Updates unread count for a chat
   */
  const updateUnreadCount = useCallback((chatId: string, unreadCount: number) => {
    setState(prev => ({
      ...prev,
      chats: prev.chats.map(chat =>
        chat.id === chatId ? { ...chat, unread_count: unreadCount } : chat
      )
    }));
  }, []);

  // =====================================================
  // REAL-TIME EVENT HANDLERS
  // =====================================================

  /**
   * Handles incoming chat events for list updates
   */
  const handleChatListEvent = useCallback((chatId: string) => {
    return async (event: ChatEvent) => {
      try {
        switch (event.type) {
          case ChatEventType.NEW_MESSAGE: {
            // リアルタイム更新を無効化（順序固定のため）
            console.log('新規メッセージイベント（順序固定のため無視）:', chatId);
            break;
          }

          case ChatEventType.MESSAGE_READ: {
            // 既読イベントも無効化（順序固定のため）
            console.log('既読イベント（順序固定のため無視）:', chatId);
            break;
          }

          case ChatEventType.CHAT_UPDATED: {
            // リアルタイム更新を無効化（順序固定のため）
            // 必要に応じて手動でリフレッシュしてもらう
            console.log('チャット更新イベント（順序固定のため無視）:', chatId);
            break;
          }

          default:
            // Handle other events as needed
            break;
        }
      } catch (error) {
        secureLogger.error('Error handling chat list event', { 
          error, 
          eventType: event.type, 
          chatId 
        });
      }
    };
  }, [user?.id, state.chats, updateChatInList, updateUnreadCount]);

  // =====================================================
  // CORE FUNCTIONS
  // =====================================================

  /**
   * Loads the initial chat list
   */
  const loadChats = useCallback(async (reset: boolean = false) => {
    if (!isAuthenticated || !user) {
      console.log('useChatList - 認証なし:', { isAuthenticated, userId: user?.id });
      return;
    }

    console.log('useChatList - loadChats開始:', { reset, userId: user.id });

    try {
      if (reset) {
        updateState({ isLoading: true, error: null, chats: [], hasMore: true });
      } else if (!reset && state.chats.length > 0) {
        updateState({ isLoadingMore: true, error: null });
      } else {
        updateState({ isLoading: true, error: null });
      }

      const params: ChatPaginationParams = {
        limit: HOOK_CONFIG.PAGE_SIZE,
        order: 'desc'
      };

      if (!reset && state.nextCursor) {
        params.cursor = state.nextCursor;
      }

      console.log('useChatList - API呼び出し中:', params);
      const response = await chatService.getChats(params);
      console.log('useChatList - API応答:', { 
        success: response.success, 
        chatsCount: response.success ? response.data.chats.length : 0,
        error: response.error
      });

      if (response.success) {
        const newChats = reset ? 
          response.data.chats : 
          [...state.chats, ...response.data.chats];

        updateState({
          chats: newChats,
          totalCount: response.data.total_count,
          hasMore: response.data.has_more,
          nextCursor: response.data.next_cursor,
          isLoading: false,
          isLoadingMore: false
        });

        // リアルタイム購読を無効化（順序固定のため）
        console.log('リアルタイム購読を無効化中（順序固定のため）');

        secureLogger.info('Chat list loaded successfully', {
          chatCount: newChats.length,
          totalCount: response.data.total_count,
          hasMore: response.data.has_more
        });

      } else {
        setError(response.error);
      }

    } catch (error) {
      console.error('useChatList - エラー発生:', error);
      secureLogger.warn('Chat list temporarily unavailable', { error });
      setError(`チャット一覧の読み込みエラー: ${error}`);
    }
    // Remove functions from dependencies to prevent infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, state.chats, state.nextCursor]);

  /**
   * Loads more chats (pagination)
   */
  const loadMoreChats = useCallback(async () => {
    if (!state.hasMore || state.isLoadingMore) {
      return;
    }

    await loadChats(false);
  }, [state.hasMore, state.isLoadingMore, loadChats]);

  /**
   * Refreshes the entire chat list
   */
  const refreshChats = useCallback(async () => {
    retryCountRef.current = 0;
    await loadChats(true);
    // Remove loadChats from dependencies to prevent infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Creates a new chat
   */
  const createChat = useCallback(async (
    participantId: string,
    initialMessage?: string
  ): Promise<ChatWithParticipants | null> => {
    if (!user || state.isCreatingChat) {
      return null;
    }

    try {
      updateState({ isCreatingChat: true, error: null });

      const request = createChatRequest({
        participant_id: participantId,
        initial_message: initialMessage,
        chat_type: 'direct'
      });

      const response = await chatService.createChat(request);

      updateState({ isCreatingChat: false });

      if (response.success) {
        // Add new chat to the top of the list
        updateChatInList(response.data);

        secureLogger.info('Chat created successfully', {
          chatId: response.data.id,
          participantId
        });

        return response.data;
      } else {
        setError(response.error);
        return null;
      }

    } catch (error) {
      updateState({ isCreatingChat: false });
      secureLogger.error('Error creating chat', { error, participantId });
      setError('チャットの作成中にエラーが発生しました。');
      return null;
    }
  }, [user, state.isCreatingChat, updateState, setError, updateChatInList]);

  /**
   * Searches chats
   */
  const searchChats = useCallback(async (query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    updateState({ searchQuery: query });

    if (!query.trim()) {
      updateState({ searchResults: [], isSearching: false });
      return;
    }

    updateState({ isSearching: true });

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const searchParams: ChatSearchParams = {
          query: query.trim(),
          ...filters
        };

        const response = await chatService.searchChats(searchParams);

        if (response.success) {
          updateState({
            searchResults: response.data,
            isSearching: false
          });
        } else {
          setError(response.error);
        }

      } catch (error) {
        secureLogger.error('Error searching chats', { error, query });
        setError('チャット検索中にエラーが発生しました。');
      }
    }, HOOK_CONFIG.SEARCH_DEBOUNCE_MS);
  }, [filters, updateState, setError]);

  /**
   * Clears search results
   */
  const clearSearch = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    updateState({
      searchQuery: '',
      searchResults: [],
      isSearching: false
    });
  }, [updateState]);

  /**
   * Retries loading chats
   */
  const retry = useCallback(async () => {
    if (retryCountRef.current >= HOOK_CONFIG.RETRY_ATTEMPTS) {
      setError('再試行回数が上限に達しました。');
      return;
    }

    retryCountRef.current++;
    clearError();
    
    setTimeout(() => {
      refreshChats();
    }, HOOK_CONFIG.RETRY_DELAY_MS * retryCountRef.current);
  }, [refreshChats, setError, clearError]);

  /**
   * Gets total unread message count
   */
  const getTotalUnreadCount = useCallback(() => {
    return state.chats.reduce((total, chat) => total + chat.unread_count, 0);
  }, [state.chats]);

  /**
   * Gets filtered chats based on current filters
   */
  const getFilteredChats = useCallback(() => {
    let filteredChats = state.searchQuery ? state.searchResults : state.chats;

    if (filters.hasUnread) {
      filteredChats = filteredChats.filter(chat => chat.unread_count > 0);
    }

    if (filters.chatType) {
      filteredChats = filteredChats.filter(chat => chat.chat_type === filters.chatType);
    }

    if (filters.participantId) {
      filteredChats = filteredChats.filter(chat => 
        chat.participant_ids.includes(filters.participantId!)
      );
    }

    return filteredChats;
  }, [state.chats, state.searchResults, state.searchQuery, filters]);

  // =====================================================
  // EFFECTS
  // =====================================================

  /**
   * Load chats on mount or when authentication changes
   */
  useEffect(() => {
    if (isAuthenticated && user) {
      retryCountRef.current = 0;
      loadChats(true);

      // Set up periodic refresh
      refreshIntervalRef.current = setInterval(() => {
        refreshChats();
      }, HOOK_CONFIG.REFRESH_INTERVAL_MS);
    }

    // Cleanup on unmount or auth change
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }

      // リアルタイム購読クリーンアップを無効化（順序固定のため）
      console.log('リアルタイム購読クリーンアップ無効化');

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
    // Remove loadChats and refreshChats from dependencies to prevent infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  /**
   * Update subscriptions when chat list changes (無効化)
   */
  /*
  useEffect(() => {
    // リアルタイム購読システムを完全無効化（順序固定のため）
    console.log('リアルタイム購読システム無効化中');
  }, [state.chats]);
  */

  // =====================================================
  // RETURN VALUES
  // =====================================================

  return {
    // State
    chats: getFilteredChats(),
    allChats: state.chats,
    isLoading: state.isLoading,
    isLoadingMore: state.isLoadingMore,
    isCreatingChat: state.isCreatingChat,
    error: state.error,
    hasMore: state.hasMore,
    totalCount: state.totalCount,
    searchQuery: state.searchQuery,
    searchResults: state.searchResults,
    isSearching: state.isSearching,

    // Actions
    createChat,
    searchChats,
    clearSearch,
    loadMoreChats,
    refreshChats,
    retry,
    clearError,

    // Utilities
    getTotalUnreadCount,
    canLoadMore: state.hasMore && !state.isLoadingMore,
    isEmpty: state.chats.length === 0 && !state.isLoading,
    isSearchActive: !!state.searchQuery,
    hasSearchResults: state.searchResults.length > 0
  };
}

/**
 * Hook for managing chat list with specific filters
 */
export function useChatListWithFilters(filters: ChatListFilters) {
  return useChatList(filters);
}

/**
 * Hook for unread chats only
 */
export function useUnreadChats() {
  return useChatList({ hasUnread: true });
}

/**
 * Hook for direct chats only
 */
export function useDirectChats() {
  return useChatList({ chatType: 'direct' });
}

export default useChatList;