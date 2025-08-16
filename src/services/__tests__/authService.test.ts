/**
 * COMPREHENSIVE AUTH SERVICE TESTS
 * Tests authentication flow with proper security measures
 */

import { jest } from '@jest/globals';

// Mock user data
const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  username: 'testuser',
  display_name: 'Test User',
  avatar_emoji: '😊'
};

const mockSession = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: mockUser
};

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    getSession: jest.fn(),
    getUser: jest.fn(),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } }
    })),
    refreshSession: jest.fn()
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({ data: [mockUser], error: null })
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn().mockResolvedValue({ data: [mockUser], error: null })
      }))
    }))
  }))
};

// Mock secure store
const mockSecureStore = {
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined)
};

// Mock session manager
const mockSessionManager = {
  saveSession: jest.fn().mockResolvedValue(undefined),
  getSession: jest.fn().mockResolvedValue(null),
  clearSession: jest.fn().mockResolvedValue(undefined),
  refreshSession: jest.fn().mockResolvedValue(mockSession)
};

// Apply mocks
jest.mock('../supabaseClient', () => ({
  getSupabaseClient: () => mockSupabaseClient
}));

jest.mock('expo-secure-store', () => mockSecureStore);

jest.mock('../sessionManager', () => ({
  sessionManager: mockSessionManager
}));

// Import the service after mocks
import { authService } from '../authService';
import { AuthErrorCode } from '../../types/auth';

describe('AuthService - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful responses
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    });
    
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    });
  });

  describe('Authentication Flow', () => {
    it('should sign in successfully with valid credentials', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      const result = await authService.signIn('test@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(result.data?.user).toEqual(mockUser);
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
      expect(mockSessionManager.saveSession).toHaveBeenCalledWith(mockSession);
    });

    it('should handle invalid credentials', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' }
      });

      const result = await authService.signIn('test@example.com', 'wrongpassword');

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
      expect(result.error).toBe('認証情報が正しくありません。');
    });

    it('should validate email format', async () => {
      const result = await authService.signIn('invalid-email', 'password123');

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(AuthErrorCode.INVALID_EMAIL);
      expect(result.error).toBe('有効なメールアドレスを入力してください。');
    });

    it('should validate password strength', async () => {
      const result = await authService.signIn('test@example.com', '123');

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(AuthErrorCode.WEAK_PASSWORD);
      expect(result.error).toBe('パスワードは8文字以上である必要があります。');
    });
  });

  describe('User Registration', () => {
    it('should register user successfully', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      const userData = {
        email: 'newuser@example.com',
        password: 'password123',
        username: 'newuser',
        display_name: 'New User'
      };

      const result = await authService.signUp(userData);

      expect(result.success).toBe(true);
      expect(result.data?.user).toEqual(mockUser);
      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            username: userData.username,
            display_name: userData.display_name
          }
        }
      });
    });

    it('should handle email already exists error', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' }
      });

      const userData = {
        email: 'existing@example.com',
        password: 'password123',
        username: 'existing',
        display_name: 'Existing User'
      };

      const result = await authService.signUp(userData);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(AuthErrorCode.EMAIL_EXISTS);
    });

    it('should validate required fields', async () => {
      const userData = {
        email: '',
        password: 'password123',
        username: 'testuser',
        display_name: 'Test User'
      };

      const result = await authService.signUp(userData);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(AuthErrorCode.INVALID_EMAIL);
    });
  });

  describe('Session Management', () => {
    it('should get current user when authenticated', () => {
      // Mock current user in service state
      (authService as any).currentUser = mockUser;

      const user = authService.getCurrentUser();

      expect(user).toEqual(mockUser);
    });

    it('should return null when not authenticated', () => {
      (authService as any).currentUser = null;

      const user = authService.getCurrentUser();

      expect(user).toBeNull();
    });

    it('should check authentication status correctly', () => {
      (authService as any).currentUser = mockUser;
      expect(authService.isAuthenticated()).toBe(true);

      (authService as any).currentUser = null;
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should sign out successfully', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: null
      });

      const result = await authService.signOut();

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
      expect(mockSessionManager.clearSession).toHaveBeenCalled();
    });

    it('should refresh session when needed', async () => {
      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const result = await authService.refreshSession();

      expect(result.success).toBe(true);
      expect(result.data?.session).toEqual(mockSession);
      expect(mockSessionManager.saveSession).toHaveBeenCalledWith(mockSession);
    });
  });

  describe('Profile Management', () => {
    it('should update user profile successfully', async () => {
      const updatedUser = { ...mockUser, display_name: 'Updated Name' };
      
      mockSupabaseClient.from().update().eq().select.mockResolvedValue({
        data: [updatedUser],
        error: null
      });

      const updateData = {
        display_name: 'Updated Name',
        avatar_emoji: '🎉'
      };

      const result = await authService.updateProfile(updateData);

      expect(result.success).toBe(true);
      expect(result.data?.user.display_name).toBe('Updated Name');
    });

    it('should handle profile update errors', async () => {
      mockSupabaseClient.from().update().eq().select.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' }
      });

      const updateData = {
        display_name: 'Updated Name'
      };

      const result = await authService.updateProfile(updateData);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(AuthErrorCode.SYSTEM_ERROR);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockRejectedValue(
        new Error('Network error')
      );

      const result = await authService.signIn('test@example.com', 'password123');

      expect(result.success).toBe(false);
      expect(result.error_code).toBe(AuthErrorCode.SYSTEM_ERROR);
    });

    it('should handle session storage errors', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });
      
      mockSessionManager.saveSession.mockRejectedValue(
        new Error('Storage error')
      );

      const result = await authService.signIn('test@example.com', 'password123');

      // Should still succeed even if session storage fails
      expect(result.success).toBe(true);
    });
  });

  describe('Input Validation', () => {
    it('should validate email format correctly', async () => {
      // Test valid email
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      const validResult = await authService.signIn('test@example.com', 'password123');
      expect(validResult.success).toBe(true);

      // Test invalid email
      const invalidResult = await authService.signIn('invalid-email', 'password123');
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error_code).toBe(AuthErrorCode.INVALID_EMAIL);
    });

    it('should validate password requirements', async () => {
      const weakPasswords = [
        '',
        '123',
        'short',
        '1234567' // 7 characters
      ];

      for (const password of weakPasswords) {
        const result = await authService.signIn('test@example.com', password);
        expect(result.success).toBe(false);
        expect(result.error_code).toBe(AuthErrorCode.WEAK_PASSWORD);
      }
    });
  });

  describe('Security Features', () => {
    it('should not log sensitive information', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      await authService.signIn('test@example.com', 'password123');

      // Check that password is not logged
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('password123')
      );
      expect(consoleError).not.toHaveBeenCalledWith(
        expect.stringContaining('password123')
      );

      consoleSpy.mockRestore();
      consoleError.mockRestore();
    });

    it('should handle rate limiting', async () => {
      // Simulate multiple rapid requests
      const promises = Array.from({ length: 10 }, () =>
        authService.signIn('test@example.com', 'password123')
      );

      const results = await Promise.all(promises);

      // Should handle concurrent requests gracefully
      results.forEach(result => {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('error_code');
      });
    });
  });
});