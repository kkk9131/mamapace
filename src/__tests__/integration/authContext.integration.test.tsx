/**
 * AUTHENTICATION CONTEXT INTEGRATION TESTS
 * 
 * Tests the integration between AuthContext and UI components:
 * - Context state management
 * - Service layer integration
 * - UI component interactions
 * - Error handling and recovery
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import {
  TEST_USERS,
  REGISTRATION_REQUESTS,
  LOGIN_REQUESTS,
  TEST_UTILITIES,
  PERFORMANCE_TEST_DATA,
} from '../fixtures/testData';
import { AuthResponse } from '../../types/auth';

// Test component that uses AuthContext
const TestComponent: React.FC = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    isInitialized,
    login,
    register,
    logout,
    clearError,
  } = useAuth();

  return (
    <>
      <div testID="auth-status">
        <div testID="is-authenticated">{isAuthenticated.toString()}</div>
        <div testID="is-loading">{isLoading.toString()}</div>
        <div testID="is-initialized">{isInitialized.toString()}</div>
        <div testID="user-id">{user?.id || 'null'}</div>
        <div testID="username">{user?.username || 'null'}</div>
        <div testID="error">{error || 'null'}</div>
      </div>
      
      <button
        testID="login-button"
        onPress={() => login(LOGIN_REQUESTS.VALID_LOGIN)}
      >
        Login
      </button>
      
      <button
        testID="register-button"
        onPress={() => register(REGISTRATION_REQUESTS.VALID_REGISTRATION)}
      >
        Register
      </button>
      
      <button
        testID="logout-button"
        onPress={() => logout()}
      >
        Logout
      </button>
      
      <button
        testID="clear-error-button"
        onPress={() => clearError()}
      >
        Clear Error
      </button>
    </>
  );
};

const renderWithAuthProvider = (component: React.ReactElement) => {
  return render(
    <AuthProvider>
      {component}
    </AuthProvider>
  );
};

describe('AuthContext Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful service initialization
    (authService.initialize as jest.Mock).mockResolvedValue(undefined);
    (authService.loadSession as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    // Validate no sensitive data is exposed
    TEST_UTILITIES.validateNoSensitiveDataExposed(expect.getState());
  });

  describe('Context Initialization', () => {
    it('should initialize services and update state correctly', async () => {
      const { getByTestId } = renderWithAuthProvider(<TestComponent />);
      
      // Initially loading
      expect(getByTestId('is-loading').props.children).toBe('true');
      expect(getByTestId('is-initialized').props.children).toBe('false');
      
      // Wait for initialization
      await waitFor(() => {
        expect(getByTestId('is-initialized').props.children).toBe('true');
        expect(getByTestId('is-loading').props.children).toBe('false');
      });
      
      expect(authService.initialize).toHaveBeenCalled();
      expect(authService.loadSession).toHaveBeenCalled();
    });

    it('should handle service initialization failures', async () => {
      (authService.initialize as jest.Mock).mockRejectedValue(new Error('Init failed'));
      
      const { getByTestId } = renderWithAuthProvider(<TestComponent />);
      
      await waitFor(() => {
        expect(getByTestId('is-initialized').props.children).toBe('false');
        expect(getByTestId('error').props.children).toContain('初期化');
      });
    });

    it('should restore existing session on initialization', async () => {
      (authService.loadSession as jest.Mock).mockResolvedValue(TEST_USERS.VALID_USER_1);
      
      const { getByTestId } = renderWithAuthProvider(<TestComponent />);
      
      await waitFor(() => {
        expect(getByTestId('is-authenticated').props.children).toBe('true');
        expect(getByTestId('user-id').props.children).toBe(TEST_USERS.VALID_USER_1.id);
        expect(getByTestId('username').props.children).toBe(TEST_USERS.VALID_USER_1.username);
      });
    });
  });

  describe('Registration Flow Integration', () => {
    it('should handle successful registration', async () => {
      const successResponse: AuthResponse = {
        success: true,
        user: TEST_USERS.VALID_USER_1,
      };
      
      (authService.register as jest.Mock).mockResolvedValue(successResponse);
      
      const { getByTestId } = renderWithAuthProvider(<TestComponent />);
      
      // Wait for initialization
      await waitFor(() => {
        expect(getByTestId('is-initialized').props.children).toBe('true');
      });
      
      // Trigger registration
      act(() => {
        fireEvent.press(getByTestId('register-button'));
      });
      
      // Should show loading state
      expect(getByTestId('is-loading').props.children).toBe('true');
      
      // Wait for completion
      await waitFor(() => {
        expect(getByTestId('is-authenticated').props.children).toBe('true');
        expect(getByTestId('user-id').props.children).toBe(TEST_USERS.VALID_USER_1.id);
        expect(getByTestId('is-loading').props.children).toBe('false');
      });
      
      expect(authService.register).toHaveBeenCalledWith(REGISTRATION_REQUESTS.VALID_REGISTRATION);
    });

    it('should handle registration failures', async () => {
      const errorResponse: AuthResponse = {
        success: false,
        error: 'ユーザー名が既に使用されています',
      };
      
      (authService.register as jest.Mock).mockResolvedValue(errorResponse);
      
      const { getByTestId } = renderWithAuthProvider(<TestComponent />);
      
      await waitFor(() => {
        expect(getByTestId('is-initialized').props.children).toBe('true');
      });
      
      act(() => {
        fireEvent.press(getByTestId('register-button'));
      });
      
      await waitFor(() => {
        expect(getByTestId('error').props.children).toBe('ユーザー名が既に使用されています');
        expect(getByTestId('is-authenticated').props.children).toBe('false');
        expect(getByTestId('is-loading').props.children).toBe('false');
      });
    });

    it('should prevent registration before initialization', async () => {
      // Keep service uninitialized
      const { getByTestId } = renderWithAuthProvider(<TestComponent />);
      
      // Try to register immediately
      act(() => {
        fireEvent.press(getByTestId('register-button'));
      });
      
      // Should show error without calling service
      await waitFor(() => {
        expect(getByTestId('error').props.children).toContain('初期化されていません');
      });
      
      expect(authService.register).not.toHaveBeenCalled();
    });
  });

  describe('Login Flow Integration', () => {
    it('should handle successful login', async () => {
      const successResponse: AuthResponse = {
        success: true,
        user: TEST_USERS.VALID_USER_1,
      };
      
      (authService.login as jest.Mock).mockResolvedValue(successResponse);
      
      const { getByTestId } = renderWithAuthProvider(<TestComponent />);
      
      await waitFor(() => {
        expect(getByTestId('is-initialized').props.children).toBe('true');
      });
      
      act(() => {
        fireEvent.press(getByTestId('login-button'));
      });
      
      await waitFor(() => {
        expect(getByTestId('is-authenticated').props.children).toBe('true');
        expect(getByTestId('user-id').props.children).toBe(TEST_USERS.VALID_USER_1.id);
      });
      
      expect(authService.login).toHaveBeenCalledWith(LOGIN_REQUESTS.VALID_LOGIN);
    });

    it('should handle login failures', async () => {
      const errorResponse: AuthResponse = {
        success: false,
        error: 'ユーザー名またはパスワードが間違っています',
      };
      
      (authService.login as jest.Mock).mockResolvedValue(errorResponse);
      
      const { getByTestId } = renderWithAuthProvider(<TestComponent />);
      
      await waitFor(() => {
        expect(getByTestId('is-initialized').props.children).toBe('true');
      });
      
      act(() => {
        fireEvent.press(getByTestId('login-button'));
      });
      
      await waitFor(() => {
        expect(getByTestId('error').props.children).toBe('ユーザー名またはパスワードが間違っています');
        expect(getByTestId('is-authenticated').props.children).toBe('false');
      });
    });

    it('should handle service exceptions during login', async () => {
      (authService.login as jest.Mock).mockRejectedValue(new Error('Service error'));
      
      const { getByTestId } = renderWithAuthProvider(<TestComponent />);
      
      await waitFor(() => {
        expect(getByTestId('is-initialized').props.children).toBe('true');
      });
      
      act(() => {
        fireEvent.press(getByTestId('login-button'));
      });
      
      await waitFor(() => {
        expect(getByTestId('error').props.children).toContain('ログイン中にエラーが発生しました');
        expect(getByTestId('is-authenticated').props.children).toBe('false');
      });
    });
  });

  describe('Logout Flow Integration', () => {
    it('should handle successful logout', async () => {
      // Start with authenticated user
      (authService.loadSession as jest.Mock).mockResolvedValue(TEST_USERS.VALID_USER_1);
      (authService.logout as jest.Mock).mockResolvedValue(undefined);
      
      const { getByTestId } = renderWithAuthProvider(<TestComponent />);
      
      // Wait for initialization with user
      await waitFor(() => {
        expect(getByTestId('is-authenticated').props.children).toBe('true');
      });
      
      act(() => {
        fireEvent.press(getByTestId('logout-button'));
      });
      
      await waitFor(() => {
        expect(getByTestId('is-authenticated').props.children).toBe('false');
        expect(getByTestId('user-id').props.children).toBe('null');
        expect(getByTestId('username').props.children).toBe('null');
      });
      
      expect(authService.logout).toHaveBeenCalled();
    });

    it('should handle logout service failures gracefully', async () => {
      (authService.loadSession as jest.Mock).mockResolvedValue(TEST_USERS.VALID_USER_1);
      (authService.logout as jest.Mock).mockRejectedValue(new Error('Logout failed'));
      
      const { getByTestId } = renderWithAuthProvider(<TestComponent />);
      
      await waitFor(() => {
        expect(getByTestId('is-authenticated').props.children).toBe('true');
      });
      
      act(() => {
        fireEvent.press(getByTestId('logout-button'));
      });
      
      // Should still clear local state even if service fails
      await waitFor(() => {
        expect(getByTestId('is-authenticated').props.children).toBe('false');
        expect(getByTestId('user-id').props.children).toBe('null');
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should clear errors when requested', async () => {
      const errorResponse: AuthResponse = {
        success: false,
        error: 'Test error message',
      };
      
      (authService.login as jest.Mock).mockResolvedValue(errorResponse);
      
      const { getByTestId } = renderWithAuthProvider(<TestComponent />);
      
      await waitFor(() => {
        expect(getByTestId('is-initialized').props.children).toBe('true');
      });
      
      // Trigger error
      act(() => {
        fireEvent.press(getByTestId('login-button'));
      });
      
      await waitFor(() => {
        expect(getByTestId('error').props.children).toBe('Test error message');
      });
      
      // Clear error
      act(() => {
        fireEvent.press(getByTestId('clear-error-button'));
      });
      
      expect(getByTestId('error').props.children).toBe('null');
    });

    it('should handle critical errors with fallback UI', async () => {
      (authService.initialize as jest.Mock).mockRejectedValue(
        new Error('Critical initialization error')
      );
      
      const { getByText, getByRole } = renderWithAuthProvider(<TestComponent />);
      
      await waitFor(() => {
        expect(getByText('初期化エラー')).toBeTruthy();
        expect(getByText('再試行')).toBeTruthy();
      });
      
      // Test retry functionality
      (authService.initialize as jest.Mock).mockResolvedValue(undefined);
      
      act(() => {
        fireEvent.press(getByRole('button', { name: '再試行' }));
      });
      
      await waitFor(() => {
        expect(authService.initialize).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Session Management Integration', () => {
    it('should handle session refresh', async () => {
      (authService.loadSession as jest.Mock).mockResolvedValue(TEST_USERS.VALID_USER_1);
      (authService.needsRefresh as jest.Mock).mockResolvedValue(true);
      (authService.refreshToken as jest.Mock).mockResolvedValue(true);
      
      const { getByTestId } = renderWithAuthProvider(<TestComponent />);
      
      await waitFor(() => {
        expect(getByTestId('is-authenticated').props.children).toBe('true');
      });
      
      // Simulate session monitoring interval
      jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
      
      await waitFor(() => {
        expect(authService.needsRefresh).toHaveBeenCalled();
        expect(authService.refreshToken).toHaveBeenCalled();
      });
    });

    it('should logout when session refresh fails', async () => {
      (authService.loadSession as jest.Mock).mockResolvedValue(TEST_USERS.VALID_USER_1);
      (authService.needsRefresh as jest.Mock).mockResolvedValue(true);
      (authService.refreshToken as jest.Mock).mockResolvedValue(false);
      (authService.logout as jest.Mock).mockResolvedValue(undefined);
      
      const { getByTestId } = renderWithAuthProvider(<TestComponent />);
      
      await waitFor(() => {
        expect(getByTestId('is-authenticated').props.children).toBe('true');
      });
      
      jest.advanceTimersByTime(5 * 60 * 1000);
      
      await waitFor(() => {
        expect(getByTestId('is-authenticated').props.children).toBe('false');
        expect(authService.logout).toHaveBeenCalled();
      });
    });
  });

  describe('Performance Integration Tests', () => {
    it('should handle context operations within performance targets', async () => {
      const successResponse: AuthResponse = {
        success: true,
        user: TEST_USERS.VALID_USER_1,
      };
      
      (authService.login as jest.Mock).mockResolvedValue(successResponse);
      
      const { getByTestId } = renderWithAuthProvider(<TestComponent />);
      
      await waitFor(() => {
        expect(getByTestId('is-initialized').props.children).toBe('true');
      });
      
      const { duration } = await global.measurePerformance(async () => {
        act(() => {
          fireEvent.press(getByTestId('login-button'));
        });
        
        await waitFor(() => {
          expect(getByTestId('is-authenticated').props.children).toBe('true');
        });
      }, PERFORMANCE_TEST_DATA.TARGET_RESPONSE_TIMES.LOGIN);
      
      expect(duration).toBeLessThan(PERFORMANCE_TEST_DATA.TARGET_RESPONSE_TIMES.LOGIN);
    });

    it('should handle rapid state changes efficiently', async () => {
      const { getByTestId } = renderWithAuthProvider(<TestComponent />);
      
      await waitFor(() => {
        expect(getByTestId('is-initialized').props.children).toBe('true');
      });
      
      // Rapid sequence of operations
      const operations = [
        () => fireEvent.press(getByTestId('clear-error-button')),
        () => fireEvent.press(getByTestId('clear-error-button')),
        () => fireEvent.press(getByTestId('clear-error-button')),
      ];
      
      const start = Date.now();
      
      for (const operation of operations) {
        act(operation);
      }
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should be very fast
    });
  });

  describe('Memory Management', () => {
    it('should clean up session monitoring on unmount', async () => {
      (authService.loadSession as jest.Mock).mockResolvedValue(TEST_USERS.VALID_USER_1);
      
      const { unmount } = renderWithAuthProvider(<TestComponent />);
      
      await waitFor(() => {
        expect(authService.loadSession).toHaveBeenCalled();
      });
      
      // Mock clearInterval to verify cleanup
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      unmount();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('Security Context Integration', () => {
    it('should never expose sensitive data in context state', async () => {
      (authService.loadSession as jest.Mock).mockResolvedValue(TEST_USERS.VALID_USER_1);
      
      const { getByTestId } = renderWithAuthProvider(<TestComponent />);
      
      await waitFor(() => {
        expect(getByTestId('is-authenticated').props.children).toBe('true');
      });
      
      // Verify that displayed data contains no sensitive information
      const displayedData = {
        userId: getByTestId('user-id').props.children,
        username: getByTestId('username').props.children,
      };
      
      TEST_UTILITIES.validateNoSensitiveDataExposed(displayedData);
    });

    it('should handle authentication context securely', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      (authService.register as jest.Mock).mockResolvedValue({
        success: true,
        user: TEST_USERS.VALID_USER_1,
      });
      
      const { getByTestId } = renderWithAuthProvider(<TestComponent />);
      
      await waitFor(() => {
        expect(getByTestId('is-initialized').props.children).toBe('true');
      });
      
      act(() => {
        fireEvent.press(getByTestId('register-button'));
      });
      
      await waitFor(() => {
        expect(getByTestId('is-authenticated').props.children).toBe('true');
      });
      
      // Verify no sensitive data was logged
      consoleSpy.mock.calls.forEach(call => {
        const message = call.join(' ');
        expect(message).not.toMatch(/\b\d{10}\b/);
        expect(message).not.toContain('maternal_health_id');
      });
      
      consoleSpy.mockRestore();
    });
  });
});