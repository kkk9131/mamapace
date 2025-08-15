/**
 * CHAT SERVICE TESTS
 * 
 * Comprehensive tests for chat service functionality:
 * - Authentication and initialization
 * - Chat management (create, get, list)
 * - Message management (send, edit, delete, read)
 * - Real-time subscriptions and events
 * - Error handling and edge cases
 * - Security validation
 * - Rate limiting
 * - Performance and resource management
 */

import { jest } from '@jest/globals';
import { chatService } from '../chatService';
import { authService } from '../authService';
import { supabaseClient } from '../supabaseClient';
import { 
  mockUsers, 
  mockChats, 
  mockMessages, 
  createMockChatService,
  flushPromises,
  withTimeout 
} from '../../__tests__/setup';
import { 
  MessageType, 
  ChatErrorCode,
  CreateChatRequest,
  SendMessageRequest,
  EditMessageRequest,
  DeleteMessageRequest,
  MarkAsReadRequest,
  UpdateTypingRequest
} from '../../types/chat';

// =====================================================
// TEST SETUP
// =====================================================

// Mock dependencies
jest.mock('../authService');
jest.mock('../supabaseClient');

const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockSupabaseClientService = supabaseClient as jest.Mocked<typeof supabaseClient>;

describe('ChatService', () => {
  const mockClient = {
    rpc: jest.fn(),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.getCurrentUser.mockReturnValue(mockUsers.user1);
    mockSupabaseClientService.getClient.mockReturnValue(mockClient as any);
  });

  // =====================================================
  // INITIALIZATION TESTS
  // =====================================================

  describe('initialization', () => {
    it('should initialize successfully when authenticated', async () => {
      await expect(chatService.initialize()).resolves.not.toThrow();
      expect(mockAuthService.isAuthenticated).toHaveBeenCalled();
    });

    it('should throw error when not authenticated', async () => {
      mockAuthService.isAuthenticated.mockReturnValue(false);
      
      await expect(chatService.initialize()).rejects.toThrow(
        'Authentication required for chat service'
      );
    });

    it('should not reinitialize if already initialized', async () => {
      await chatService.initialize();
      const initSpy = jest.spyOn(mockAuthService, 'isAuthenticated');
      
      await chatService.initialize();
      
      expect(initSpy).toHaveBeenCalledTimes(0); // Should not check auth again
    });

    it('should provide service stats', () => {
      const stats = chatService.getStats();
      
      expect(stats).toEqual({
        isInitialized: expect.any(Boolean),
        activeSubscriptions: expect.any(Number),
        activeTypingTimeouts: expect.any(Number),
      });
    });
  });

  // =====================================================
  // CHAT MANAGEMENT TESTS
  // =====================================================

  describe('chat management', () => {
    beforeEach(async () => {
      await chatService.initialize();
    });

    describe('createChat', () => {
      const validCreateRequest: CreateChatRequest = {
        participant_id: mockUsers.user2.id,
        initial_message: 'Hello!',
        chat_type: 'direct',
      };

      it('should create chat successfully', async () => {
        mockClient.rpc.mockResolvedValueOnce({
          data: { success: true, chat: mockChats.chat1 },
          error: null,
        });

        const result = await chatService.createChat(validCreateRequest);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockChats.chat1);
        expect(mockClient.rpc).toHaveBeenCalledWith('create_chat', {
          p_current_user_id: mockUsers.user1.id,
          p_participant_id: validCreateRequest.participant_id,
          p_initial_message: validCreateRequest.initial_message,
          p_chat_type: validCreateRequest.chat_type,
          p_metadata: validCreateRequest.metadata,
        });
      });

      it('should handle validation errors', async () => {
        const invalidRequest: CreateChatRequest = {
          participant_id: mockUsers.user1.id, // Same as current user
        };

        const result = await chatService.createChat(invalidRequest);

        expect(result.success).toBe(false);
        expect(result.error).toContain('有効な相手を選択してください');
        expect(result.error_code).toBe(ChatErrorCode.ACCESS_DENIED);
      });

      it('should handle rate limiting', async () => {
        // Make multiple requests quickly to trigger rate limit
        const requests = Array(15).fill(validCreateRequest);
        const promises = requests.map(req => chatService.createChat(req));
        
        const results = await Promise.all(promises);
        const rateLimitedResults = results.filter(r => !r.success && r.error_code === ChatErrorCode.RATE_LIMIT_EXCEEDED);
        
        expect(rateLimitedResults.length).toBeGreaterThan(0);
      });

      it('should handle RPC errors gracefully', async () => {
        mockClient.rpc.mockResolvedValueOnce({
          data: null,
          error: { message: 'Database error' },
        });

        const result = await chatService.createChat(validCreateRequest);

        expect(result.success).toBe(false);
        expect(result.error).toBe('チャットの作成に失敗しました。');
        expect(result.error_code).toBe(ChatErrorCode.SYSTEM_ERROR);
      });

      it('should handle business logic errors', async () => {
        mockClient.rpc.mockResolvedValueOnce({
          data: { success: false, error: 'Chat already exists' },
          error: null,
        });

        const result = await chatService.createChat(validCreateRequest);

        expect(result.success).toBe(false);
        expect(result.error).toBe('既に存在するチャットです。');
        expect(result.error_code).toBe(ChatErrorCode.ACCESS_DENIED);
      });
    });

    describe('getChats', () => {
      it('should get chats with pagination', async () => {
        const mockResponse = {
          chats: [mockChats.chat1],
          total_count: 1,
          has_more: false,
          next_cursor: null,
        };

        mockClient.rpc.mockResolvedValueOnce({
          data: mockResponse,
          error: null,
        });

        const result = await chatService.getChats({ limit: 20, offset: 0 });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockResponse);
        expect(mockClient.rpc).toHaveBeenCalledWith('get_user_chats', {
          p_user_id: mockUsers.user1.id,
          p_limit: 20,
          p_offset: 0,
          p_order: 'desc',
        });
      });

      it('should handle pagination limits', async () => {
        await chatService.getChats({ limit: 150 }); // Exceeds max limit

        expect(mockClient.rpc).toHaveBeenCalledWith('get_user_chats', 
          expect.objectContaining({ p_limit: 100 }) // Should be capped at max
        );
      });

      it('should require authentication', async () => {
        mockAuthService.getCurrentUser.mockReturnValue(null);

        const result = await chatService.getChats();

        expect(result.success).toBe(false);
        expect(result.error).toBe('認証が必要です。');
        expect(result.error_code).toBe(ChatErrorCode.ACCESS_DENIED);
      });
    });

    describe('getChat', () => {
      it('should get specific chat', async () => {
        mockClient.rpc.mockResolvedValueOnce({
          data: { success: true, chat: mockChats.chat1 },
          error: null,
        });

        const result = await chatService.getChat('chat-1');

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockChats.chat1);
        expect(mockClient.rpc).toHaveBeenCalledWith('get_chat_details', {
          p_chat_id: 'chat-1',
          p_user_id: mockUsers.user1.id,
        });
      });

      it('should handle chat not found', async () => {
        mockClient.rpc.mockResolvedValueOnce({
          data: { success: false, error: 'Chat not found' },
          error: null,
        });

        const result = await chatService.getChat('nonexistent');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Chat not found');
        expect(result.error_code).toBe(ChatErrorCode.CHAT_NOT_FOUND);
      });
    });
  });

  // =====================================================
  // MESSAGE MANAGEMENT TESTS
  // =====================================================

  describe('message management', () => {
    beforeEach(async () => {
      await chatService.initialize();
    });

    describe('sendMessage', () => {
      const validSendRequest: SendMessageRequest = {
        chat_id: 'chat-1',
        content: 'Test message',
        message_type: MessageType.TEXT,
      };

      it('should send message successfully', async () => {
        mockClient.rpc.mockResolvedValueOnce({
          data: { success: true, message: mockMessages.message1 },
          error: null,
        });

        const result = await chatService.sendMessage(validSendRequest);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockMessages.message1);
        expect(mockClient.rpc).toHaveBeenCalledWith('send_message', {
          p_chat_id: validSendRequest.chat_id,
          p_sender_id: mockUsers.user1.id,
          p_content: validSendRequest.content,
          p_message_type: MessageType.TEXT,
          p_reply_to_message_id: undefined,
          p_metadata: undefined,
        });
      });

      it('should validate message content', async () => {
        const invalidRequest: SendMessageRequest = {
          chat_id: 'chat-1',
          content: '', // Empty content
        };

        const result = await chatService.sendMessage(invalidRequest);

        expect(result.success).toBe(false);
        expect(result.error).toContain('文字以上');
      });

      it('should validate message length', async () => {
        const longMessage = 'a'.repeat(2001); // Exceeds max length
        const invalidRequest: SendMessageRequest = {
          chat_id: 'chat-1',
          content: longMessage,
        };

        const result = await chatService.sendMessage(invalidRequest);

        expect(result.success).toBe(false);
        expect(result.error).toContain('文字以下');
      });

      it('should handle rate limiting for messages', async () => {
        // Send many messages quickly
        const requests = Array(35).fill(validSendRequest);
        const promises = requests.map(req => chatService.sendMessage(req));
        
        const results = await Promise.all(promises);
        const rateLimitedResults = results.filter(r => !r.success && r.error_code === ChatErrorCode.RATE_LIMIT_EXCEEDED);
        
        expect(rateLimitedResults.length).toBeGreaterThan(0);
      });
    });

    describe('getMessages', () => {
      it('should get messages with pagination', async () => {
        const mockResponse = {
          success: true,
          messages: [mockMessages.message1, mockMessages.message2],
          total_count: 2,
          has_more: false,
        };

        mockClient.rpc.mockResolvedValueOnce({
          data: mockResponse,
          error: null,
        });

        const result = await chatService.getMessages('chat-1');

        expect(result.success).toBe(true);
        expect(result.data.messages).toHaveLength(2);
        expect(mockClient.rpc).toHaveBeenCalledWith('get_chat_messages', {
          p_chat_id: 'chat-1',
          p_user_id: mockUsers.user1.id,
          p_limit: 20,
          p_offset: 0,
          p_order: 'desc',
        });
      });
    });

    describe('editMessage', () => {
      const validEditRequest: EditMessageRequest = {
        message_id: 'message-1',
        content: 'Edited message',
      };

      it('should edit message successfully', async () => {
        const editedMessage = { ...mockMessages.message1, content: 'Edited message' };
        mockClient.rpc.mockResolvedValueOnce({
          data: { success: true, message: editedMessage },
          error: null,
        });

        const result = await chatService.editMessage(validEditRequest);

        expect(result.success).toBe(true);
        expect(result.data.content).toBe('Edited message');
      });

      it('should validate edited content', async () => {
        const invalidRequest: EditMessageRequest = {
          message_id: 'message-1',
          content: '', // Empty content
        };

        const result = await chatService.editMessage(invalidRequest);

        expect(result.success).toBe(false);
        expect(result.error).toContain('メッセージが無効です');
      });

      it('should handle access denied', async () => {
        mockClient.rpc.mockResolvedValueOnce({
          data: { success: false, error: 'Access denied' },
          error: null,
        });

        const result = await chatService.editMessage(validEditRequest);

        expect(result.success).toBe(false);
        expect(result.error).toBe('このメッセージを編集する権限がありません。');
        expect(result.error_code).toBe(ChatErrorCode.ACCESS_DENIED);
      });
    });

    describe('deleteMessage', () => {
      const validDeleteRequest: DeleteMessageRequest = {
        message_id: 'message-1',
        delete_for_everyone: false,
      };

      it('should delete message successfully', async () => {
        mockClient.rpc.mockResolvedValueOnce({
          data: { success: true },
          error: null,
        });

        const result = await chatService.deleteMessage(validDeleteRequest);

        expect(result.success).toBe(true);
        expect(result.data).toBe(true);
        expect(mockClient.rpc).toHaveBeenCalledWith('delete_message', {
          p_message_id: validDeleteRequest.message_id,
          p_user_id: mockUsers.user1.id,
          p_delete_for_everyone: false,
        });
      });

      it('should handle message not found', async () => {
        mockClient.rpc.mockResolvedValueOnce({
          data: { success: false, error: 'Message not found' },
          error: null,
        });

        const result = await chatService.deleteMessage(validDeleteRequest);

        expect(result.success).toBe(false);
        expect(result.error_code).toBe(ChatErrorCode.MESSAGE_NOT_FOUND);
      });
    });
  });

  // =====================================================
  // READ STATUS TESTS
  // =====================================================

  describe('read status management', () => {
    beforeEach(async () => {
      await chatService.initialize();
    });

    it('should mark messages as read', async () => {
      const markAsReadRequest: MarkAsReadRequest = {
        chat_id: 'chat-1',
        message_ids: ['message-1', 'message-2'],
      };

      mockClient.rpc.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const result = await chatService.markAsRead(markAsReadRequest);

      expect(result.success).toBe(true);
      expect(mockClient.rpc).toHaveBeenCalledWith('mark_messages_as_read', {
        p_chat_id: 'chat-1',
        p_user_id: mockUsers.user1.id,
        p_message_ids: ['message-1', 'message-2'],
      });
    });

    it('should handle mark as read errors gracefully', async () => {
      mockClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC error' },
      });

      const result = await chatService.markAsRead({ chat_id: 'chat-1' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('既読状態の更新に失敗しました。');
    });
  });

  // =====================================================
  // TYPING INDICATORS TESTS
  // =====================================================

  describe('typing indicators', () => {
    beforeEach(async () => {
      await chatService.initialize();
    });

    it('should update typing status', async () => {
      const typingRequest: UpdateTypingRequest = {
        chat_id: 'chat-1',
        is_typing: true,
      };

      mockClient.rpc.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const result = await chatService.updateTypingStatus(typingRequest);

      expect(result.success).toBe(true);
      expect(mockClient.rpc).toHaveBeenCalledWith('update_typing_status', {
        p_chat_id: 'chat-1',
        p_user_id: mockUsers.user1.id,
        p_is_typing: true,
      });
    });

    it('should auto-stop typing after timeout', async () => {
      jest.useFakeTimers();

      const typingRequest: UpdateTypingRequest = {
        chat_id: 'chat-1',
        is_typing: true,
      };

      mockClient.rpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await chatService.updateTypingStatus(typingRequest);

      // Fast-forward time to trigger auto-stop
      jest.advanceTimersByTime(6000); // 6 seconds

      await flushPromises();

      expect(mockClient.rpc).toHaveBeenCalledWith('update_typing_status', 
        expect.objectContaining({ p_is_typing: false })
      );

      jest.useRealTimers();
    });
  });

  // =====================================================
  // REAL-TIME SUBSCRIPTIONS TESTS
  // =====================================================

  describe('real-time subscriptions', () => {
    beforeEach(async () => {
      await chatService.initialize();
    });

    it('should subscribe to chat events', async () => {
      const mockEventHandler = jest.fn();
      const mockSubscription = { unsubscribe: jest.fn() };
      
      mockClient.channel.mockReturnValue({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(() => mockSubscription),
      });

      const result = await chatService.subscribeToChat('chat-1', mockEventHandler);

      expect(result.success).toBe(true);
      expect(result.data).toBe('chat_chat-1');
      expect(mockClient.channel).toHaveBeenCalledWith('chat:chat-1');
    });

    it('should not create duplicate subscriptions', async () => {
      const mockEventHandler = jest.fn();
      
      // First subscription
      const result1 = await chatService.subscribeToChat('chat-1', mockEventHandler);
      // Second subscription to same chat
      const result2 = await chatService.subscribeToChat('chat-1', mockEventHandler);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.data).toBe(result2.data); // Same subscription key
    });

    it('should unsubscribe from chat events', async () => {
      const mockEventHandler = jest.fn();
      const mockSubscription = { unsubscribe: jest.fn() };
      
      mockClient.channel.mockReturnValue({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(() => mockSubscription),
      });

      await chatService.subscribeToChat('chat-1', mockEventHandler);
      await chatService.unsubscribeFromChat('chat-1');

      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
    });
  });

  // =====================================================
  // SEARCH TESTS
  // =====================================================

  describe('search functionality', () => {
    beforeEach(async () => {
      await chatService.initialize();
    });

    it('should search chats', async () => {
      const searchParams = {
        query: 'test',
        chat_type: 'direct' as const,
      };

      mockClient.rpc.mockResolvedValueOnce({
        data: { chats: [mockChats.chat1] },
        error: null,
      });

      const result = await chatService.searchChats(searchParams);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockChats.chat1]);
      expect(mockClient.rpc).toHaveBeenCalledWith('search_chats', {
        p_user_id: mockUsers.user1.id,
        p_query: 'test',
        p_chat_type: 'direct',
        p_has_unread: undefined,
        p_participant_id: undefined,
      });
    });

    it('should search messages', async () => {
      const searchParams = {
        query: 'hello',
        chat_id: 'chat-1',
      };

      mockClient.rpc.mockResolvedValueOnce({
        data: { messages: [mockMessages.message1] },
        error: null,
      });

      const result = await chatService.searchMessages(searchParams);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockMessages.message1]);
    });
  });

  // =====================================================
  // ERROR HANDLING TESTS
  // =====================================================

  describe('error handling', () => {
    beforeEach(async () => {
      await chatService.initialize();
    });

    it('should handle network errors gracefully', async () => {
      mockClient.rpc.mockRejectedValueOnce(new Error('Network error'));

      const result = await chatService.getChats();

      expect(result.success).toBe(false);
      expect(result.error).toBe('チャット一覧の取得中にエラーが発生しました。');
      expect(result.error_code).toBe(ChatErrorCode.SYSTEM_ERROR);
    });

    it('should handle concurrent operations safely', async () => {
      // Test concurrent message sending
      const requests = Array(5).fill({
        chat_id: 'chat-1',
        content: 'Concurrent message',
      });

      mockClient.rpc.mockResolvedValue({
        data: { success: true, message: mockMessages.message1 },
        error: null,
      });

      const promises = requests.map(req => chatService.sendMessage(req));
      const results = await Promise.all(promises);

      // All should succeed without race conditions
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should timeout long-running operations', async () => {
      // Mock a long-running RPC call
      mockClient.rpc.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: null, error: null }), 10000))
      );

      const result = await withTimeout(chatService.getChats(), 1000);

      // Should handle timeout gracefully
      expect(result).toBeDefined();
    });
  });

  // =====================================================
  // CLEANUP TESTS
  // =====================================================

  describe('cleanup', () => {
    it('should cleanup resources properly', async () => {
      await chatService.initialize();
      
      // Create some subscriptions and timeouts
      const mockEventHandler = jest.fn();
      await chatService.subscribeToChat('chat-1', mockEventHandler);
      await chatService.updateTypingStatus({ chat_id: 'chat-1', is_typing: true });

      await chatService.cleanup();

      const stats = chatService.getStats();
      expect(stats.activeSubscriptions).toBe(0);
      expect(stats.activeTypingTimeouts).toBe(0);
    });
  });

  // =====================================================
  // PERFORMANCE TESTS
  // =====================================================

  describe('performance', () => {
    beforeEach(async () => {
      await chatService.initialize();
    });

    it('should handle high-frequency typing updates efficiently', async () => {
      jest.useFakeTimers();
      
      const typingUpdates = Array(100).fill({
        chat_id: 'chat-1',
        is_typing: true,
      });

      mockClient.rpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      // Send many typing updates quickly
      const start = Date.now();
      const promises = typingUpdates.map(req => chatService.updateTypingStatus(req));
      await Promise.all(promises);

      // Should debounce and not make 100 RPC calls
      expect(mockClient.rpc).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it('should handle large message lists efficiently', async () => {
      const largeMessageList = Array(1000).fill(mockMessages.message1);
      
      mockClient.rpc.mockResolvedValueOnce({
        data: {
          success: true,
          messages: largeMessageList,
          total_count: 1000,
          has_more: false,
        },
        error: null,
      });

      const start = Date.now();
      const result = await chatService.getMessages('chat-1');
      const duration = Date.now() - start;

      expect(result.success).toBe(true);
      expect(result.data.messages).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});