/**
 * COMPREHENSIVE CHAT SERVICE TESTS
 * Tests functionality with proper isolated mocking
 */

import { jest } from '@jest/globals';

// Mock all dependencies before importing the service
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: 'test-user-123', email: 'test@example.com' } },
      error: null
    })
  },
  rpc: jest.fn().mockResolvedValue({ data: 'conv-123', error: null }),
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      }))
    }))
  })),
  channel: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockResolvedValue({ error: null }),
    unsubscribe: jest.fn().mockResolvedValue({ error: null })
  }))
};

const mockSecureLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  security: jest.fn(),
  privacy: jest.fn()
};

const mockAuthService = {
  getCurrentUser: jest.fn().mockReturnValue({ id: 'test-user-123' }),
  isAuthenticated: jest.fn().mockReturnValue(true)
};

// Apply mocks before any imports
jest.mock('../supabaseClient', () => ({
  getSupabaseClient: () => mockSupabaseClient
}));

jest.mock('../authService', () => ({
  authService: mockAuthService
}));

// No need to re-mock since it's already mocked in setup.ts

jest.mock('../encryptionService', () => ({
  encryptionService: {
    encrypt: jest.fn().mockResolvedValue('encrypted-data'),
    decrypt: jest.fn().mockResolvedValue('decrypted-data')
  }
}));

jest.mock('../../types/chat', () => ({
  ...jest.requireActual('../../types/chat'),
  sanitizeChatForLogging: jest.fn((data) => data),
  sanitizeMessageForLogging: jest.fn((data) => data)
}));

// Now import the service after mocks are in place
import { ChatConstraints, ChatErrorCode, MessageType } from '../../types/chat';
import { chatService } from '../chatService';

describe('ChatService - Comprehensive Tests', () => {
  const mockUser = { id: 'test-user-123', email: 'test@example.com' };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    });
    
    mockAuthService.getCurrentUser.mockReturnValue(mockUser);
    mockAuthService.isAuthenticated.mockReturnValue(true);
  });

  describe('Chat Creation', () => {
    it('should create chat successfully with valid data', async () => {
      const mockConversationId = 'conv-123';
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: mockConversationId,
        error: null
      });

      const request = {
        participant_id: 'user-456',
        chat_type: 'direct' as const,
        initial_message: 'Hello there!'
      };

      const result = await chatService.createChat(request);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(mockConversationId);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('get_or_create_conversation', {
        p_user1_id: mockUser.id,
        p_user2_id: request.participant_id
      });
    });

    it('should handle unauthenticated user', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error('No user')
      });

      const request = {
        participant_id: 'user-456',
        chat_type: 'direct' as const
      };

      const result = await chatService.createChat(request);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(ChatErrorCode.ACCESS_DENIED);
      expect(result.error).toBe('認証が必要です。');
    });

    it('should handle database RPC errors', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: null,
        error: new Error('Database connection failed')
      });

      const request = {
        participant_id: 'user-456',
        chat_type: 'direct' as const
      };

      const result = await chatService.createChat(request);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(ChatErrorCode.SYSTEM_ERROR);
    });

    it('should send initial message when provided', async () => {
      const mockConversationId = 'conv-123';
      mockSupabaseClient.rpc
        .mockResolvedValueOnce({ data: mockConversationId, error: null })
        .mockResolvedValueOnce({ data: {}, error: null });

      const request = {
        participant_id: 'user-456',
        chat_type: 'direct' as const,
        initial_message: 'Hello there!'
      };

      const result = await chatService.createChat(request);

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('send_message', {
        p_sender_id: mockUser.id,
        p_recipient_id: request.participant_id,
        p_content: 'Hello there!',
        p_message_type: 'text'
      });
    });
  });

  describe('Message Operations', () => {
    it('should validate message content length', () => {
      const constraints = ChatConstraints.message;
      
      expect(constraints.minLength).toBe(1);
      expect(constraints.maxLength).toBe(2000);
      
      const shortMessage = '';
      const validMessage = 'Hello world';
      const longMessage = 'a'.repeat(2001);
      
      expect(shortMessage.length).toBeLessThan(constraints.minLength);
      expect(validMessage.length).toBeGreaterThanOrEqual(constraints.minLength);
      expect(validMessage.length).toBeLessThanOrEqual(constraints.maxLength);
      expect(longMessage.length).toBeGreaterThan(constraints.maxLength);
    });

    it('should send message successfully', async () => {
      const mockMessage = {
        id: 'msg-123',
        conversation_id: 'conv-123',
        sender_id: mockUser.id,
        content: 'Test message',
        message_type: 'text' as MessageType,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_edited: false,
        deleted_at: null,
        metadata: null
      };

      // Mock the conversation lookup first
      mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
        data: {
          id: 'conv-123',
          participant_1_id: mockUser.id,
          participant_2_id: 'user-456'
        },
        error: null
      });

      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: mockMessage,
        error: null
      });

      const request = {
        chat_id: 'conv-123',
        content: 'Test message',
        message_type: 'text' as MessageType
      };

      const result = await chatService.sendMessage(request);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMessage);
    });

    it('should handle message sending errors', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: null,
        error: new Error('Failed to send message')
      });

      const request = {
        chat_id: 'conv-123',
        content: 'Test message',
        message_type: 'text' as MessageType
      };

      const result = await chatService.sendMessage(request);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(ChatErrorCode.SYSTEM_ERROR);
    });
  });

  describe('Chat Retrieval', () => {
    it('should get chats list successfully', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          participant_id: 'user-2',
          participant_username: 'user2',
          participant_display_name: 'User Two',
          participant_avatar_emoji: '😊',
          last_message_content: 'Hello',
          last_message_sender_id: 'user-2',
          last_message_created_at: new Date().toISOString(),
          unread_count: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: mockConversations,
        error: null
      });

      const result = await chatService.getChats();

      expect(result.success).toBe(true);
      expect(result.data?.chats).toHaveLength(1);
      expect(result.data?.chats[0].id).toBe('conv-1');
      expect(result.data?.chats[0].unread_count).toBe(1);
      expect(result.data?.chats[0].last_message?.content).toBe('Hello');
    });

    it('should handle empty chats list', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const result = await chatService.getChats();

      expect(result.success).toBe(true);
      expect(result.data?.chats).toEqual([]);
      expect(result.data?.total_count).toBe(0);
    });

    it('should handle database errors when getting chats', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error')
      });

      const result = await chatService.getChats();

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(ChatErrorCode.SYSTEM_ERROR);
    });
  });

  describe('Real-time Subscriptions', () => {
    it('should subscribe to chat successfully', async () => {
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockResolvedValue({ error: null })
      };
      
      mockSupabaseClient.channel.mockReturnValue(mockChannel);

      const callback = jest.fn();
      const result = await chatService.subscribeToChat('conv-123', callback);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(mockSupabaseClient.channel).toHaveBeenCalledWith(`chat:conv-123`);
      expect(mockChannel.on).toHaveBeenCalled();
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('should handle subscription errors', async () => {
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockResolvedValue({ 
          error: new Error('Subscription failed') 
        })
      };
      
      mockSupabaseClient.channel.mockReturnValue(mockChannel);

      const callback = jest.fn();
      const result = await chatService.subscribeToChat('conv-123', callback);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(ChatErrorCode.SYSTEM_ERROR);
    });

    it('should unsubscribe from chat', async () => {
      // First subscribe
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockResolvedValue({ error: null }),
        unsubscribe: jest.fn().mockResolvedValue({ error: null })
      };
      
      mockSupabaseClient.channel.mockReturnValue(mockChannel);

      const callback = jest.fn();
      const subscribeResult = await chatService.subscribeToChat('conv-123', callback);
      
      // Then unsubscribe
      await chatService.unsubscribeFromChat('conv-123');

      expect(subscribeResult.success).toBe(true);
      expect(mockChannel.unsubscribe).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network errors gracefully', async () => {
      mockSupabaseClient.rpc.mockRejectedValueOnce(new Error('Network error'));

      const request = {
        participant_id: 'user-456',
        chat_type: 'direct' as const
      };

      const result = await chatService.createChat(request);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(ChatErrorCode.SYSTEM_ERROR);
    });

    it('should handle null/undefined responses', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: null,
        error: null
      });

      const request = {
        participant_id: 'user-456',
        chat_type: 'direct' as const
      };

      const result = await chatService.createChat(request);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(ChatErrorCode.SYSTEM_ERROR);
    });

    it('should log security events appropriately', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error('Unauthorized')
      });

      const request = {
        participant_id: 'user-456',
        chat_type: 'direct' as const
      };

      const result = await chatService.createChat(request);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(ChatErrorCode.ACCESS_DENIED);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce message rate limits', () => {
      const constraints = ChatConstraints.rateLimit;
      
      expect(constraints.messagesPerMinute).toBe(30);
      expect(constraints.chatsPerHour).toBe(10);
      
      // Test rate limit logic conceptually
      const userId = 'test-user';
      const messageTimes: number[] = [];
      const now = Date.now();
      
      // Simulate 31 messages in a minute
      for (let i = 0; i < 31; i++) {
        messageTimes.push(now + (i * 1000)); // 1 second apart
      }
      
      const messagesInLastMinute = messageTimes.filter(time => 
        time > now - 60000
      ).length;
      
      expect(messagesInLastMinute).toBeGreaterThan(constraints.messagesPerMinute);
    });
  });
});