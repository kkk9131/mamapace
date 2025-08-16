/**
 * useChat HOOK TESTS
 */

import { renderHook } from '@testing-library/react-native';
import { jest } from '@jest/globals';
import { useChat } from '../useChat';
import React from 'react';

// Mock dependencies
jest.mock('../../services/chatService');
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user' }, isAuthenticated: true })
}));

describe('useChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useChat('chat-1'));
    
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle loading state', () => {
    const { result } = renderHook(() => useChat('chat-1'));
    
    // Initially not loading
    expect(result.current.isLoading).toBe(false);
    
    // After initialization, loading state should be managed
    expect(result.current.isLoadingMessages).toBeDefined();
  });

  it('should provide message operations', () => {
    const { result } = renderHook(() => useChat('chat-1'));
    
    expect(typeof result.current.sendMessage).toBe('function');
    expect(typeof result.current.editMessage).toBe('function');
    expect(typeof result.current.deleteMessage).toBe('function');
  });

  it('should handle typing status', () => {
    const { result } = renderHook(() => useChat('chat-1'));
    
    expect(typeof result.current.updateTypingStatus).toBe('function');
    expect(result.current.typingUsers).toEqual([]);
  });

  it('should provide error handling', () => {
    const { result } = renderHook(() => useChat('chat-1'));
    
    expect(typeof result.current.clearError).toBe('function');
    expect(typeof result.current.retry).toBe('function');
    expect(result.current.error).toBeNull();
  });

  it('should support pagination', () => {
    const { result } = renderHook(() => useChat('chat-1'));
    
    expect(typeof result.current.loadMoreMessages).toBe('function');
    expect(result.current.canLoadMore).toBeDefined();
    expect(result.current.hasMoreMessages).toBeDefined();
  });
});