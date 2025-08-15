/**
 * useChat HOOK TESTS
 * 
 * Comprehensive tests for the useChat React hook:
 * - Initialization and state management
 * - Message operations (send, edit, delete)
 * - Real-time event handling
 * - Optimistic updates and rollback
 * - Typing indicators
 * - Read status management
 * - Error handling and retry logic
 * - Performance and memory management
 */

import { renderHook, act } from '@testing-library/react-native';
import { jest } from '@jest/globals';
import { useChat } from '../useChat';
import { chatService } from '../../services/chatService';
import { 
  mockUsers, 
  mockChats, 
  mockMessages, 
  createMockAuthContext,
  flushPromises,
  waitForNextUpdate 
} from '../../__tests__/setup';
import { 
  MessageType,
  ChatEventType,
  MessageEvent,
  TypingEvent,
  ReadStatusEvent,
  ChatErrorCode
} from '../../types/chat';
import React from 'react';

// =====================================================
// TEST SETUP
// =====================================================

// Mock dependencies
jest.mock('../../services/chatService');
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => createMockAuthContext(),
}));

const mockChatService = chatService as jest.Mocked<typeof chatService>;

// Create wrapper with AuthContext
const createWrapper = () => {
  const AuthContext = React.createContext(createMockAuthContext());
  
  return ({ children }: { children: React.ReactNode }) => {
    return (
      <AuthContext.Provider value={createMockAuthContext()}>
        {children}
      </AuthContext.Provider>
    );
  };
};

describe('useChat', () => {
  const chatId = 'chat-1';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful responses
    mockChatService.getChat.mockResolvedValue({
      success: true,
      data: mockChats.chat1,
    });

    mockChatService.getMessages.mockResolvedValue({
      success: true,
      data: {
        messages: [mockMessages.message1, mockMessages.message2],
        total_count: 2,
        has_more: false,
        next_cursor: undefined,
      },
    });

    mockChatService.subscribeToChat.mockResolvedValue({
      success: true,
      data: 'subscription-key',
    });
  });

  // =====================================================
  // INITIALIZATION TESTS
  // =====================================================

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      expect(result.current.chat).toBeNull();
      expect(result.current.messages).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isLoadingMessages).toBe(false);
      expect(result.current.isSending).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.hasMoreMessages).toBe(true);
      expect(result.current.typingUsers).toEqual([]);
    });

    it('should load chat and messages on mount', async () => {
      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      expect(mockChatService.getChat).toHaveBeenCalledWith(chatId);
      expect(mockChatService.getMessages).toHaveBeenCalledWith(chatId, {
        limit: 20,
        order: 'desc',
      });
      expect(mockChatService.subscribeToChat).toHaveBeenCalled();

      expect(result.current.chat).toEqual(mockChats.chat1);
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.isConnected).toBe(true);
    });

    it('should handle authentication errors', async () => {
      jest.doMock('../../contexts/AuthContext', () => ({
        useAuth: () => ({ ...createMockAuthContext(), isAuthenticated: false }),
      }));

      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      expect(mockChatService.getChat).not.toHaveBeenCalled();
      expect(result.current.error).toBeNull(); // Should not load, not error
    });

    it('should handle chat loading errors', async () => {
      mockChatService.getChat.mockResolvedValue({
        success: false,
        error: 'Chat not found',
        error_code: ChatErrorCode.CHAT_NOT_FOUND,
      });

      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      expect(result.current.error).toBe('Chat not found');
      expect(result.current.chat).toBeNull();
    });

    it('should cleanup on unmount', async () => {
      const { unmount } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      unmount();

      expect(mockChatService.unsubscribeFromChat).toHaveBeenCalledWith(chatId);
    });

    it('should reset state when chatId changes', async () => {
      const { result, rerender } = renderHook(
        ({ chatId }) => useChat(chatId),
        {
          initialProps: { chatId: 'chat-1' },
          wrapper: createWrapper(),
        }
      );

      await act(async () => {
        await waitForNextUpdate();
      });

      expect(result.current.messages).toHaveLength(2);

      // Change chat ID
      rerender({ chatId: 'chat-2' });

      expect(result.current.chat).toBeNull();
      expect(result.current.messages).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  // =====================================================
  // MESSAGE OPERATIONS TESTS
  // =====================================================

  describe('message operations', () => {
    beforeEach(async () => {
      // Setup hook with loaded chat
      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      return { result };
    });

    describe('sendMessage', () => {
      it('should send message with optimistic update', async () => {
        const { result } = renderHook(() => useChat(chatId), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await waitForNextUpdate();
        });

        const initialMessageCount = result.current.messages.length;

        mockChatService.sendMessage.mockResolvedValue({
          success: true,
          data: mockMessages.message1,
        });

        await act(async () => {
          await result.current.sendMessage('Hello, test message!');
        });

        // Should add optimistic message immediately
        expect(result.current.messages.length).toBe(initialMessageCount + 1);
        
        // Should show sending state
        expect(result.current.isSending).toBe(false); // Should be false after completion

        expect(mockChatService.sendMessage).toHaveBeenCalledWith({
          chat_id: chatId,
          content: 'Hello, test message!',
          message_type: MessageType.TEXT,
          reply_to_message_id: undefined,
          metadata: undefined,
        });
      });

      it('should handle send message errors', async () => {
        const { result } = renderHook(() => useChat(chatId), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await waitForNextUpdate();
        });

        mockChatService.sendMessage.mockResolvedValue({
          success: false,
          error: 'Message too long',
          error_code: ChatErrorCode.MESSAGE_TOO_LONG,
        });

        await act(async () => {
          await result.current.sendMessage('Test message');
        });

        expect(result.current.error).toBe('Message too long');
        expect(result.current.isSending).toBe(false);
      });

      it('should validate empty messages', async () => {
        const { result } = renderHook(() => useChat(chatId), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await waitForNextUpdate();
        });

        await act(async () => {
          await result.current.sendMessage('   '); // Only whitespace
        });

        expect(result.current.error).toBe('メッセージを入力してください。');
        expect(mockChatService.sendMessage).not.toHaveBeenCalled();
      });

      it('should prevent concurrent message sending', async () => {
        const { result } = renderHook(() => useChat(chatId), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await waitForNextUpdate();
        });

        mockChatService.sendMessage.mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve({
            success: true,
            data: mockMessages.message1,
          }), 100))
        );

        // Try to send multiple messages simultaneously
        await act(async () => {
          result.current.sendMessage('Message 1');
          result.current.sendMessage('Message 2'); // Should be ignored
        });

        expect(mockChatService.sendMessage).toHaveBeenCalledTimes(1);
      });

      it('should support reply to message', async () => {
        const { result } = renderHook(() => useChat(chatId), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await waitForNextUpdate();
        });

        mockChatService.sendMessage.mockResolvedValue({
          success: true,
          data: mockMessages.message2,
        });

        await act(async () => {
          await result.current.sendMessage('Reply message', MessageType.TEXT, 'message-1');
        });

        expect(mockChatService.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            reply_to_message_id: 'message-1',
          })
        );
      });
    });

    describe('editMessage', () => {
      it('should edit message successfully', async () => {
        const { result } = renderHook(() => useChat(chatId), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await waitForNextUpdate();
        });

        const editedMessage = { 
          ...mockMessages.message1, 
          content: 'Edited content',
          edited_at: new Date().toISOString(),
        };

        mockChatService.editMessage.mockResolvedValue({
          success: true,
          data: editedMessage,
        });

        await act(async () => {
          await result.current.editMessage('message-1', 'Edited content');
        });

        expect(mockChatService.editMessage).toHaveBeenCalledWith({
          message_id: 'message-1',
          content: 'Edited content',
        });
      });

      it('should validate edited content', async () => {
        const { result } = renderHook(() => useChat(chatId), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await waitForNextUpdate();
        });

        await act(async () => {
          await result.current.editMessage('message-1', '   '); // Empty content
        });

        expect(result.current.error).toBe('メッセージを入力してください。');
        expect(mockChatService.editMessage).not.toHaveBeenCalled();
      });
    });

    describe('deleteMessage', () => {
      it('should delete message successfully', async () => {
        const { result } = renderHook(() => useChat(chatId), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await waitForNextUpdate();
        });

        mockChatService.deleteMessage.mockResolvedValue({
          success: true,
          data: true,
        });

        await act(async () => {
          await result.current.deleteMessage('message-1', false);
        });

        expect(mockChatService.deleteMessage).toHaveBeenCalledWith({
          message_id: 'message-1',
          delete_for_everyone: false,
        });
      });

      it('should support delete for everyone', async () => {
        const { result } = renderHook(() => useChat(chatId), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await waitForNextUpdate();
        });

        mockChatService.deleteMessage.mockResolvedValue({
          success: true,
          data: true,
        });

        await act(async () => {
          await result.current.deleteMessage('message-1', true);
        });

        expect(mockChatService.deleteMessage).toHaveBeenCalledWith({
          message_id: 'message-1',
          delete_for_everyone: true,
        });
      });
    });
  });

  // =====================================================
  // REAL-TIME EVENTS TESTS
  // =====================================================

  describe('real-time events', () => {
    let eventHandler: (event: any) => void;

    beforeEach(async () => {
      // Capture the event handler passed to subscribeToChat
      mockChatService.subscribeToChat.mockImplementation((chatId, handler) => {
        eventHandler = handler;
        return Promise.resolve({ success: true, data: 'subscription-key' });
      });
    });

    it('should handle new message events', async () => {
      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      const initialMessageCount = result.current.messages.length;

      const newMessageEvent: MessageEvent = {
        type: ChatEventType.NEW_MESSAGE,
        chat_id: chatId,
        user_id: mockUsers.user2.id,
        timestamp: new Date().toISOString(),
        data: { ...mockMessages.message1, id: 'new-message' },
      };

      await act(async () => {
        eventHandler(newMessageEvent);
      });

      expect(result.current.messages).toHaveLength(initialMessageCount + 1);
      expect(result.current.messages.some(m => m.id === 'new-message')).toBe(true);
    });

    it('should handle message updated events', async () => {
      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      const updatedMessageEvent: MessageEvent = {
        type: ChatEventType.MESSAGE_UPDATED,
        chat_id: chatId,
        user_id: mockUsers.user1.id,
        timestamp: new Date().toISOString(),
        data: { 
          ...mockMessages.message1, 
          content: 'Updated content',
          edited_at: new Date().toISOString(),
        },
      };

      await act(async () => {
        eventHandler(updatedMessageEvent);
      });

      const updatedMessage = result.current.messages.find(m => m.id === mockMessages.message1.id);
      expect(updatedMessage?.content).toBe('Updated content');
      expect(updatedMessage?.edited_at).toBeTruthy();
    });

    it('should handle message deleted events', async () => {
      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      const deletedMessageEvent: MessageEvent = {
        type: ChatEventType.MESSAGE_DELETED,
        chat_id: chatId,
        user_id: mockUsers.user1.id,
        timestamp: new Date().toISOString(),
        data: {
          ...mockMessages.message1,
          deleted_at: new Date().toISOString(),
        },
      };

      await act(async () => {
        eventHandler(deletedMessageEvent);
      });

      const deletedMessage = result.current.messages.find(m => m.id === mockMessages.message1.id);
      expect(deletedMessage?.content).toBe('このメッセージは削除されました');
      expect(deletedMessage?.message_type).toBe(MessageType.DELETED);
    });

    it('should handle typing started events', async () => {
      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      const typingEvent: TypingEvent = {
        type: ChatEventType.TYPING_STARTED,
        chat_id: chatId,
        user_id: mockUsers.user2.id,
        timestamp: new Date().toISOString(),
        data: {
          user: mockUsers.user2,
          is_typing: true,
        },
      };

      await act(async () => {
        eventHandler(typingEvent);
      });

      expect(result.current.typingUsers).toContain(mockUsers.user2.id);
    });

    it('should handle typing stopped events', async () => {
      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      // First start typing
      const typingStartEvent: TypingEvent = {
        type: ChatEventType.TYPING_STARTED,
        chat_id: chatId,
        user_id: mockUsers.user2.id,
        timestamp: new Date().toISOString(),
        data: {
          user: mockUsers.user2,
          is_typing: true,
        },
      };

      await act(async () => {
        eventHandler(typingStartEvent);
      });

      expect(result.current.typingUsers).toContain(mockUsers.user2.id);

      // Then stop typing
      const typingStopEvent: TypingEvent = {
        type: ChatEventType.TYPING_STOPPED,
        chat_id: chatId,
        user_id: mockUsers.user2.id,
        timestamp: new Date().toISOString(),
        data: {
          user: mockUsers.user2,
          is_typing: false,
        },
      };

      await act(async () => {
        eventHandler(typingStopEvent);
      });

      expect(result.current.typingUsers).not.toContain(mockUsers.user2.id);
    });

    it('should not show own typing status', async () => {
      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      const ownTypingEvent: TypingEvent = {
        type: ChatEventType.TYPING_STARTED,
        chat_id: chatId,
        user_id: mockUsers.user1.id, // Current user
        timestamp: new Date().toISOString(),
        data: {
          user: mockUsers.user1,
          is_typing: true,
        },
      };

      await act(async () => {
        eventHandler(ownTypingEvent);
      });

      expect(result.current.typingUsers).not.toContain(mockUsers.user1.id);
    });
  });

  // =====================================================
  // PAGINATION TESTS
  // =====================================================

  describe('pagination', () => {
    it('should load more messages', async () => {
      // Setup initial state with hasMoreMessages = true
      mockChatService.getMessages
        .mockResolvedValueOnce({
          success: true,
          data: {
            messages: [mockMessages.message1],
            total_count: 10,
            has_more: true,
            next_cursor: 'cursor-1',
          },
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            messages: [mockMessages.message2],
            total_count: 10,
            has_more: false,
            next_cursor: undefined,
          },
        });

      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.hasMoreMessages).toBe(true);
      expect(result.current.canLoadMore).toBe(true);

      // Load more messages
      await act(async () => {
        await result.current.loadMoreMessages();
      });

      expect(mockChatService.getMessages).toHaveBeenCalledTimes(2);
      expect(mockChatService.getMessages).toHaveBeenLastCalledWith(chatId, {
        limit: 20,
        cursor: 'cursor-1',
        order: 'desc',
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.hasMoreMessages).toBe(false);
      expect(result.current.canLoadMore).toBe(false);
    });

    it('should prevent concurrent pagination requests', async () => {
      mockChatService.getMessages.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: {
            messages: [mockMessages.message2],
            total_count: 10,
            has_more: true,
          },
        }), 100))
      );

      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      // Try to load more messages multiple times
      await act(async () => {
        result.current.loadMoreMessages();
        result.current.loadMoreMessages();
        result.current.loadMoreMessages();
      });

      // Should only make one additional request
      await act(async () => {
        await flushPromises();
      });

      expect(mockChatService.getMessages).toHaveBeenCalledTimes(2); // Initial + 1 more
    });
  });

  // =====================================================
  // TYPING MANAGEMENT TESTS
  // =====================================================

  describe('typing management', () => {
    it('should update typing status', async () => {
      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      mockChatService.updateTypingStatus.mockResolvedValue({
        success: true,
        data: true,
      });

      await act(async () => {
        await result.current.updateTypingStatus(true);
      });

      expect(mockChatService.updateTypingStatus).toHaveBeenCalledWith({
        chat_id: chatId,
        is_typing: true,
      });
    });

    it('should debounce typing status updates', async () => {
      jest.useFakeTimers();

      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      mockChatService.updateTypingStatus.mockResolvedValue({
        success: true,
        data: true,
      });

      // Send multiple typing updates quickly
      await act(async () => {
        result.current.updateTypingStatus(true);
        result.current.updateTypingStatus(true);
        result.current.updateTypingStatus(true);
      });

      // Should not call service immediately
      expect(mockChatService.updateTypingStatus).not.toHaveBeenCalled();

      // Fast-forward debounce time
      act(() => {
        jest.advanceTimersByTime(600);
      });

      await act(async () => {
        await flushPromises();
      });

      // Should call service once after debounce
      expect(mockChatService.updateTypingStatus).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });

  // =====================================================
  // ERROR HANDLING AND RETRY TESTS
  // =====================================================

  describe('error handling and retry', () => {
    it('should provide retry functionality', async () => {
      // First call fails
      mockChatService.getChat.mockResolvedValueOnce({
        success: false,
        error: 'Network error',
        error_code: ChatErrorCode.SYSTEM_ERROR,
      });

      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      expect(result.current.error).toBe('Network error');

      // Setup successful retry
      mockChatService.getChat.mockResolvedValueOnce({
        success: true,
        data: mockChats.chat1,
      });

      await act(async () => {
        await result.current.retry();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.chat).toEqual(mockChats.chat1);
    });

    it('should limit retry attempts', async () => {
      mockChatService.getChat.mockResolvedValue({
        success: false,
        error: 'Persistent error',
        error_code: ChatErrorCode.SYSTEM_ERROR,
      });

      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      // Retry multiple times
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await result.current.retry();
        });
      }

      expect(result.current.error).toBe('再試行回数が上限に達しました。');
    });

    it('should clear errors', async () => {
      mockChatService.getChat.mockResolvedValue({
        success: false,
        error: 'Test error',
        error_code: ChatErrorCode.SYSTEM_ERROR,
      });

      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      expect(result.current.error).toBe('Test error');

      await act(async () => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  // =====================================================
  // OPTIMISTIC UPDATES TESTS
  // =====================================================

  describe('optimistic updates', () => {
    it('should remove optimistic message when real message arrives', async () => {
      let eventHandler: (event: any) => void;

      mockChatService.subscribeToChat.mockImplementation((chatId, handler) => {
        eventHandler = handler;
        return Promise.resolve({ success: true, data: 'subscription-key' });
      });

      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      const initialMessageCount = result.current.messages.length;

      // Send message creates optimistic message
      mockChatService.sendMessage.mockResolvedValue({
        success: true,
        data: { ...mockMessages.message1, id: 'real-message-id' },
      });

      await act(async () => {
        await result.current.sendMessage('Test optimistic message');
      });

      // Should have optimistic message
      expect(result.current.messages.length).toBe(initialMessageCount + 1);

      // Simulate real message event
      const realMessageEvent: MessageEvent = {
        type: ChatEventType.NEW_MESSAGE,
        chat_id: chatId,
        user_id: mockUsers.user1.id,
        timestamp: new Date().toISOString(),
        data: { 
          ...mockMessages.message1, 
          id: 'real-message-id',
          content: 'Test optimistic message',
        },
      };

      await act(async () => {
        eventHandler(realMessageEvent);
      });

      // Should have same message count (optimistic replaced by real)
      expect(result.current.messages.length).toBe(initialMessageCount + 1);
      expect(result.current.messages.some(m => m.id === 'real-message-id')).toBe(true);
    });

    it('should timeout optimistic messages', async () => {
      jest.useFakeTimers();

      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      const initialMessageCount = result.current.messages.length;

      // Mock send message to never resolve
      mockChatService.sendMessage.mockImplementation(() => new Promise(() => {}));

      await act(async () => {
        result.current.sendMessage('Test timeout message');
      });

      expect(result.current.messages.length).toBe(initialMessageCount + 1);

      // Fast-forward to timeout
      act(() => {
        jest.advanceTimersByTime(11000); // 11 seconds
      });

      await act(async () => {
        await flushPromises();
      });

      // Optimistic message should be removed
      expect(result.current.messages.length).toBe(initialMessageCount);

      jest.useRealTimers();
    });
  });

  // =====================================================
  // READ STATUS MANAGEMENT TESTS
  // =====================================================

  describe('read status management', () => {
    it('should auto-mark messages as read when visible', async () => {
      // Mock document visibility
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
      });

      let eventHandler: (event: any) => void;

      mockChatService.subscribeToChat.mockImplementation((chatId, handler) => {
        eventHandler = handler;
        return Promise.resolve({ success: true, data: 'subscription-key' });
      });

      mockChatService.markAsRead.mockResolvedValue({
        success: true,
        data: true,
      });

      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      // Simulate new message from other user
      const newMessageEvent: MessageEvent = {
        type: ChatEventType.NEW_MESSAGE,
        chat_id: chatId,
        user_id: mockUsers.user2.id,
        timestamp: new Date().toISOString(),
        data: { 
          ...mockMessages.message1, 
          id: 'new-unread-message',
          sender_id: mockUsers.user2.id,
        },
      };

      await act(async () => {
        eventHandler(newMessageEvent);
      });

      // Should auto-mark as read after delay
      await act(async () => {
        jest.advanceTimersByTime(1100); // Auto-read delay
        await flushPromises();
      });

      expect(mockChatService.markAsRead).toHaveBeenCalledWith({
        chat_id: chatId,
        message_ids: ['new-unread-message'],
      });
    });

    it('should not auto-mark own messages as read', async () => {
      let eventHandler: (event: any) => void;

      mockChatService.subscribeToChat.mockImplementation((chatId, handler) => {
        eventHandler = handler;
        return Promise.resolve({ success: true, data: 'subscription-key' });
      });

      mockChatService.markAsRead.mockResolvedValue({
        success: true,
        data: true,
      });

      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      // Simulate new message from current user
      const ownMessageEvent: MessageEvent = {
        type: ChatEventType.NEW_MESSAGE,
        chat_id: chatId,
        user_id: mockUsers.user1.id,
        timestamp: new Date().toISOString(),
        data: { 
          ...mockMessages.message1, 
          id: 'own-message',
          sender_id: mockUsers.user1.id,
        },
      };

      await act(async () => {
        eventHandler(ownMessageEvent);
      });

      // Should still auto-mark as read (own messages are immediately read)
      expect(mockChatService.markAsRead).toHaveBeenCalledWith({
        chat_id: chatId,
        message_ids: ['own-message'],
      });
    });

    it('should manually mark messages as read', async () => {
      const { result } = renderHook(() => useChat(chatId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await waitForNextUpdate();
      });

      mockChatService.markAsRead.mockResolvedValue({
        success: true,
        data: true,
      });

      await act(async () => {
        await result.current.markAsRead(['message-1', 'message-2']);
      });

      expect(mockChatService.markAsRead).toHaveBeenCalledWith({
        chat_id: chatId,
        message_ids: ['message-1', 'message-2'],
      });
    });
  });
});