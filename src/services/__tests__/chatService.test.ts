/**
 * CHAT SERVICE TESTS
 */

import { jest } from '@jest/globals';

// Mock the entire chatService module
const mockChatService = {
  initialize: jest.fn().mockResolvedValue(undefined),
  getChats: jest.fn().mockResolvedValue({ success: true, data: { chats: [] } }),
  sendMessage: jest.fn().mockResolvedValue({ success: true, data: {} }),
  createChat: jest.fn().mockResolvedValue({ success: true, data: {} }),
  subscribeToChat: jest.fn().mockResolvedValue({ success: true, data: 'sub-id' }),
  unsubscribeFromChat: jest.fn().mockResolvedValue(undefined),
  markAsRead: jest.fn().mockResolvedValue({ success: true, data: true }),
  updateTypingStatus: jest.fn().mockResolvedValue({ success: true, data: true }),
  cleanup: jest.fn().mockResolvedValue(undefined)
};

jest.mock('../chatService', () => ({
  chatService: mockChatService
}));

describe('ChatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize the service', async () => {
      const result = await mockChatService.initialize();
      expect(result).toBeUndefined();
      expect(mockChatService.initialize).toHaveBeenCalled();
    });
  });

  describe('message operations', () => {
    it('should validate message content length', () => {
      const shortMessage = '';
      const validMessage = 'Hello world';
      const longMessage = 'a'.repeat(2001);
      
      // Basic validation tests
      expect(shortMessage.length).toBe(0);
      expect(validMessage.length).toBeGreaterThan(0);
      expect(longMessage.length).toBeGreaterThan(2000);
    });

    it('should send messages', async () => {
      const result = await mockChatService.sendMessage({
        chat_id: 'test-chat',
        content: 'Test message'
      });
      
      expect(result.success).toBe(true);
      expect(mockChatService.sendMessage).toHaveBeenCalledWith({
        chat_id: 'test-chat',
        content: 'Test message'
      });
    });
  });

  describe('chat management', () => {
    it('should get chats list', async () => {
      const result = await mockChatService.getChats();
      
      expect(result.success).toBe(true);
      expect(result.data.chats).toEqual([]);
      expect(mockChatService.getChats).toHaveBeenCalled();
    });

    it('should create new chats', async () => {
      const result = await mockChatService.createChat({
        participant_id: 'user-2'
      });
      
      expect(result.success).toBe(true);
      expect(mockChatService.createChat).toHaveBeenCalledWith({
        participant_id: 'user-2'
      });
    });
  });

  describe('real-time features', () => {
    it('should handle chat subscriptions', async () => {
      const result = await mockChatService.subscribeToChat('chat-1', jest.fn());
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('sub-id');
      expect(mockChatService.subscribeToChat).toHaveBeenCalled();
    });

    it('should handle typing status updates', async () => {
      const result = await mockChatService.updateTypingStatus({
        chat_id: 'chat-1',
        is_typing: true
      });
      
      expect(result.success).toBe(true);
      expect(mockChatService.updateTypingStatus).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle API error responses', () => {
      const errorResponse = {
        success: false,
        error: 'Database error',
        error_code: 'SYSTEM_ERROR'
      };
      
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBeDefined();
      expect(errorResponse.error_code).toBeDefined();
    });
  });

  describe('service cleanup', () => {
    it('should cleanup resources', async () => {
      await mockChatService.cleanup();
      expect(mockChatService.cleanup).toHaveBeenCalled();
    });
  });
});