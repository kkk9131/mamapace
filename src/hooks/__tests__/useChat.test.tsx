/**
 * COMPREHENSIVE useChat HOOK TESTS
 * Tests optimistic updates and core functionality
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { jest } from '@jest/globals';
import React from 'react';
import { MessageType, ChatEventType } from '../../types/chat';

// Mock user and chat data
const mockUser = { 
  id: 'test-user-123',
  username: 'testuser',
  display_name: 'Test User',
  email: 'test@example.com'
};

const mockChat = {
  id: 'chat-123',
  chat_type: 'direct' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_message_at: null,
  is_active: true,
  metadata: null,
  participants: [mockUser],
  participant_ids: [mockUser.id],
  unread_count: 0,
  participants_presence: [],
  typing_users: []
};

const mockMessage = {
  id: 'msg-123',
  conversation_id: 'chat-123',
  sender_id: mockUser.id,
  content: 'Test message',
  message_type: MessageType.TEXT,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_edited: false,
  deleted_at: null,
  metadata: null,
  sender: mockUser,
  chat_id: 'chat-123',
  edited_at: null,
  reply_to_message_id: null,
  read_by: [],
  is_read: false
};

// Mock chat service with detailed responses
const mockChatService = {
  getChat: jest.fn(),
  getMessages: jest.fn(),
  subscribeToChat: jest.fn(),
  unsubscribeFromChat: jest.fn(),
  sendMessage: jest.fn(),
  editMessage: jest.fn(),
  deleteMessage: jest.fn(),
  markAsRead: jest.fn(),
  updateTypingStatus: jest.fn()
};

// Mock privacy protection
const mockSecureLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// Apply mocks before imports
jest.mock('../../services/chatService', () => ({
  chatService: mockChatService
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ 
    user: mockUser, 
    isAuthenticated: true 
  })
}));

jest.mock('../../utils/privacyProtection', () => ({
  secureLogger: mockSecureLogger
}));

jest.mock('../../types/chat', () => ({
  ...jest.requireActual('../../types/chat'),
  sanitizeChatForLogging: jest.fn((data) => data),
  sanitizeMessageForLogging: jest.fn((data) => data),
  createSendMessageRequest: jest.fn((data) => data)
}));

// Now import the actual hook
import { useChat } from '../useChat';

describe('useChat Hook - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Default successful responses
    mockChatService.getChat.mockResolvedValue({
      success: true,
      data: mockChat
    });
    
    mockChatService.getMessages.mockResolvedValue({
      success: true,
      data: {
        messages: [mockMessage],
        total_count: 1,
        has_more: false
      }
    });
    
    mockChatService.subscribeToChat.mockResolvedValue({
      success: true,
      data: 'subscription-id'
    });
    
    mockChatService.sendMessage.mockResolvedValue({
      success: true,
      data: { ...mockMessage, id: 'real-msg-456' }
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Hook Interface', () => {
    it('should provide complete interface', async () => {
      const { result } = renderHook(() => useChat('chat-123'));
      
      await waitFor(() => {
        expect(result.current.messages).toBeDefined();
        expect(result.current.isLoading).toBeDefined();
        expect(result.current.isSending).toBeDefined();
        expect(result.current.error).toBeDefined();
        expect(result.current.chat).toBeDefined();
        expect(typeof result.current.sendMessage).toBe('function');
        expect(typeof result.current.editMessage).toBe('function');
        expect(typeof result.current.deleteMessage).toBe('function');
        expect(typeof result.current.updateTypingStatus).toBe('function');
        expect(typeof result.current.clearError).toBe('function');
        expect(typeof result.current.retry).toBe('function');
        expect(typeof result.current.loadMoreMessages).toBe('function');
        expect(typeof result.current.markAsRead).toBe('function');
        expect(result.current.canLoadMore).toBeDefined();
        expect(result.current.hasMoreMessages).toBeDefined();
        expect(result.current.typingUsers).toBeDefined();
        expect(result.current.isConnected).toBeDefined();
      });
    });

    it('should handle loading states properly', async () => {
      const { result } = renderHook(() => useChat('chat-123'));
      
      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isLoadingMessages).toBe(true);
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isLoadingMessages).toBe(false);
      });
    });
  });

  describe('Optimistic Updates', () => {
    it('should add optimistic message immediately when sending', async () => {
      const { result } = renderHook(() => useChat('chat-123'));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialMessageCount = result.current.messages.length;
      
      act(() => {
        result.current.sendMessage('New optimistic message');
      });

      // Should immediately show optimistic message
      expect(result.current.messages.length).toBe(initialMessageCount + 1);
      
      const optimisticMessage = result.current.messages.find(m => 
        'isOptimistic' in m && m.isOptimistic
      );
      
      expect(optimisticMessage).toBeDefined();
      expect(optimisticMessage?.content).toBe('New optimistic message');
      expect(optimisticMessage?.sender_id).toBe(mockUser.id);
      expect(result.current.isSending).toBe(true);
    });

    it('should replace optimistic message with real message on success', async () => {
      const { result } = renderHook(() => useChat('chat-123'));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const realMessage = { 
        ...mockMessage, 
        id: 'real-msg-456', 
        content: 'New optimistic message' 
      };
      
      mockChatService.sendMessage.mockResolvedValue({
        success: true,
        data: realMessage
      });

      act(() => {
        result.current.sendMessage('New optimistic message');
      });

      // Wait for async operation to complete
      await waitFor(() => {
        expect(result.current.isSending).toBe(false);
      });

      // Should no longer have optimistic message
      const optimisticMessage = result.current.messages.find(m => 
        'isOptimistic' in m && m.isOptimistic
      );
      expect(optimisticMessage).toBeUndefined();

      // Should have real message
      const finalMessage = result.current.messages.find(m => 
        m.id === 'real-msg-456'
      );
      expect(finalMessage).toBeDefined();
      expect(finalMessage?.content).toBe('New optimistic message');
    });

    it('should remove optimistic message on send failure', async () => {
      const { result } = renderHook(() => useChat('chat-123'));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      mockChatService.sendMessage.mockResolvedValue({
        success: false,
        error: 'Send failed',
        error_code: 'SYSTEM_ERROR'
      });

      const initialMessageCount = result.current.messages.length;

      act(() => {
        result.current.sendMessage('Failed message');
      });

      // Wait for failure
      await waitFor(() => {
        expect(result.current.isSending).toBe(false);
        expect(result.current.error).toBe('メッセージの送信に失敗しました。');
      });

      // Should remove optimistic message on failure
      expect(result.current.messages.length).toBe(initialMessageCount);
      
      const optimisticMessage = result.current.messages.find(m => 
        'isOptimistic' in m && m.isOptimistic
      );
      expect(optimisticMessage).toBeUndefined();
    });

    it('should timeout optimistic messages after 10 seconds', async () => {
      const { result } = renderHook(() => useChat('chat-123'));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Mock sendMessage to never resolve
      mockChatService.sendMessage.mockImplementation(() => new Promise(() => {}));

      const initialMessageCount = result.current.messages.length;

      act(() => {
        result.current.sendMessage('Timeout test message');
      });

      // Should have optimistic message
      expect(result.current.messages.length).toBe(initialMessageCount + 1);

      // Fast forward 10 seconds
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      // Should remove optimistic message after timeout
      expect(result.current.messages.length).toBe(initialMessageCount);
    });
  });

  describe('Message Operations', () => {
    it('should validate message content before sending', async () => {
      const { result } = renderHook(() => useChat('chat-123'));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialMessageCount = result.current.messages.length;

      // Test empty message
      act(() => {
        result.current.sendMessage('');
      });

      expect(result.current.messages.length).toBe(initialMessageCount);
      expect(result.current.error).toBe('メッセージを入力してください。');

      // Test whitespace-only message
      act(() => {
        result.current.sendMessage('   ');
      });

      expect(result.current.messages.length).toBe(initialMessageCount);
    });

    it('should handle different message types', async () => {
      const { result } = renderHook(() => useChat('chat-123'));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.sendMessage('Image message', MessageType.IMAGE);
      });

      const optimisticMessage = result.current.messages.find(m => 
        'isOptimistic' in m && m.isOptimistic
      );
      
      expect(optimisticMessage?.message_type).toBe(MessageType.IMAGE);
    });

    it('should handle message editing', async () => {
      const { result } = renderHook(() => useChat('chat-123'));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const editedMessage = { ...mockMessage, content: 'Edited content' };
      mockChatService.editMessage.mockResolvedValue({
        success: true,
        data: editedMessage
      });

      act(() => {
        result.current.editMessage('msg-123', 'Edited content');
      });

      expect(mockChatService.editMessage).toHaveBeenCalledWith({
        message_id: 'msg-123',
        content: 'Edited content'
      });
    });

    it('should handle message deletion', async () => {
      const { result } = renderHook(() => useChat('chat-123'));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      mockChatService.deleteMessage.mockResolvedValue({
        success: true,
        data: true
      });

      act(() => {
        result.current.deleteMessage('msg-123');
      });

      expect(mockChatService.deleteMessage).toHaveBeenCalledWith({
        message_id: 'msg-123'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockChatService.getChat.mockResolvedValue({
        success: false,
        error: 'Chat not found',
        error_code: 'CHAT_NOT_FOUND'
      });

      const { result } = renderHook(() => useChat('invalid-chat'));
      
      await waitFor(() => {
        expect(result.current.error).toBe('チャットの取得に失敗しました。');
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should provide error clearing functionality', async () => {
      const { result } = renderHook(() => useChat('chat-123'));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Simulate error
      act(() => {
        result.current.sendMessage('');
      });

      expect(result.current.error).toBeTruthy();

      // Clear error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('should handle retry functionality', async () => {
      mockChatService.getChat.mockResolvedValueOnce({
        success: false,
        error: 'Network error',
        error_code: 'SYSTEM_ERROR'
      }).mockResolvedValueOnce({
        success: true,
        data: mockChat
      });

      const { result } = renderHook(() => useChat('chat-123'));
      
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      act(() => {
        result.current.retry();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.chat).toEqual(mockChat);
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should handle typing status updates', async () => {
      const { result } = renderHook(() => useChat('chat-123'));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      mockChatService.updateTypingStatus.mockResolvedValue({
        success: true,
        data: true
      });

      act(() => {
        result.current.updateTypingStatus(true);
      });

      expect(mockChatService.updateTypingStatus).toHaveBeenCalledWith({
        chat_id: 'chat-123',
        is_typing: true
      });
    });

    it('should handle pagination', async () => {
      const { result } = renderHook(() => useChat('chat-123'));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const additionalMessages = [
        { ...mockMessage, id: 'msg-2', content: 'Message 2' },
        { ...mockMessage, id: 'msg-3', content: 'Message 3' }
      ];

      mockChatService.getMessages.mockResolvedValue({
        success: true,
        data: {
          messages: additionalMessages,
          total_count: 3,
          has_more: false
        }
      });

      act(() => {
        result.current.loadMoreMessages();
      });

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThan(1);
      });
    });
  });
});