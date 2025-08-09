/**
 * END-TO-END AUTHENTICATION TESTS
 * 
 * Complete user journey testing for authentication flows:
 * - Full registration process from UI to database
 * - Complete login flow with session management
 * - Navigation and state management
 * - Error handling and recovery
 * - Cross-browser compatibility (when applicable)
 */

import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from '../../contexts/AuthContext';
import LoginScreen from '../../screens/LoginScreen';
import SignUpScreen from '../../screens/SignUpScreen';
import { AuthGuard } from '../../components/AuthGuard';
import {
  TEST_USERS,
  REGISTRATION_REQUESTS,
  LOGIN_REQUESTS,
  TEST_UTILITIES,
  PERFORMANCE_TEST_DATA,
  ERROR_TEST_SCENARIOS,
} from '../fixtures/testData';
import { authService } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock navigation for E2E testing
const mockNavigate = jest.fn();
const mockReset = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    reset: mockReset,
    goBack: mockGoBack,
  }),
}));

// E2E Test Wrapper Component
const E2ETestApp: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NavigationContainer>
    <AuthProvider>
      {children}
    </AuthProvider>
  </NavigationContainer>
);

describe('Authentication E2E Tests', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    mockReset.mockClear();
    mockGoBack.mockClear();
    
    // Clear AsyncStorage
    await AsyncStorage.clear();
    
    // Mock successful service initialization
    (authService.initialize as jest.Mock).mockResolvedValue(undefined);
    (authService.loadSession as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    TEST_UTILITIES.validateNoSensitiveDataExposed(expect.getState());
  });

  describe('Complete Registration Flow E2E', () => {
    it('should complete full registration journey successfully', async () => {
      // Mock successful registration response
      (authService.register as jest.Mock).mockResolvedValue({
        success: true,
        user: TEST_USERS.VALID_USER_1,
      });

      const { getByTestId, getByText } = render(
        <E2ETestApp>
          <SignUpScreen />
        </E2ETestApp>
      );

      // Wait for component to initialize
      await waitFor(() => {
        expect(getByTestId('signup-form')).toBeTruthy();
      });

      // Step 1: Fill in maternal health ID
      const maternalHealthIdInput = getByTestId('maternal-health-id-input');
      act(() => {
        fireEvent.changeText(maternalHealthIdInput, REGISTRATION_REQUESTS.VALID_REGISTRATION.maternal_health_id);
      });

      // Step 2: Fill in username
      const usernameInput = getByTestId('username-input');
      act(() => {
        fireEvent.changeText(usernameInput, REGISTRATION_REQUESTS.VALID_REGISTRATION.username);
      });

      // Step 3: Fill in password
      const passwordInput = getByTestId('password-input');
      act(() => {
        fireEvent.changeText(passwordInput, REGISTRATION_REQUESTS.VALID_REGISTRATION.password);
      });

      // Step 4: Confirm password
      const confirmPasswordInput = getByTestId('confirm-password-input');
      act(() => {
        fireEvent.changeText(confirmPasswordInput, REGISTRATION_REQUESTS.VALID_REGISTRATION.confirmPassword);
      });

      // Step 5: Fill in display name
      const displayNameInput = getByTestId('display-name-input');
      act(() => {
        fireEvent.changeText(displayNameInput, REGISTRATION_REQUESTS.VALID_REGISTRATION.display_name);
      });

      // Step 6: Select emoji
      const emojiButton = getByTestId('emoji-picker-button');
      act(() => {
        fireEvent.press(emojiButton);
      });
      
      const emojiOption = getByTestId(`emoji-${REGISTRATION_REQUESTS.VALID_REGISTRATION.emoji}`);
      act(() => {
        fireEvent.press(emojiOption);
      });

      // Step 7: Submit registration
      const registerButton = getByTestId('register-button');
      
      // Should be enabled after all fields are filled
      expect(registerButton.props.accessibilityState?.disabled).toBe(false);
      
      act(() => {
        fireEvent.press(registerButton);
      });

      // Step 8: Verify loading state
      await waitFor(() => {
        expect(getByTestId('loading-indicator')).toBeTruthy();
      });

      // Step 9: Verify successful registration
      await waitFor(() => {
        expect(authService.register).toHaveBeenCalledWith(
          expect.objectContaining({
            username: REGISTRATION_REQUESTS.VALID_REGISTRATION.username,
            password: REGISTRATION_REQUESTS.VALID_REGISTRATION.password,
            display_name: REGISTRATION_REQUESTS.VALID_REGISTRATION.display_name,
            emoji: REGISTRATION_REQUESTS.VALID_REGISTRATION.emoji,
          })
        );
      });

      // Step 10: Verify navigation to main app
      await waitFor(() => {
        expect(mockReset).toHaveBeenCalledWith({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      });
    });

    it('should handle registration validation errors in real-time', async () => {
      const { getByTestId, queryByText } = render(
        <E2ETestApp>
          <SignUpScreen />
        </E2ETestApp>
      );

      await waitFor(() => {
        expect(getByTestId('signup-form')).toBeTruthy();
      });

      // Test weak password validation
      const passwordInput = getByTestId('password-input');
      act(() => {
        fireEvent.changeText(passwordInput, '123');
      });

      // Should show password strength indicator
      await waitFor(() => {
        expect(getByTestId('password-strength-indicator')).toBeTruthy();
        expect(queryByText('弱い')).toBeTruthy();
      });

      // Test password confirmation mismatch
      const confirmPasswordInput = getByTestId('confirm-password-input');
      act(() => {
        fireEvent.changeText(confirmPasswordInput, '456');
      });

      await waitFor(() => {
        expect(queryByText('パスワードが一致しません')).toBeTruthy();
      });

      // Register button should be disabled with validation errors
      const registerButton = getByTestId('register-button');
      expect(registerButton.props.accessibilityState?.disabled).toBe(true);
    });

    it('should handle registration server errors gracefully', async () => {
      (authService.register as jest.Mock).mockResolvedValue({
        success: false,
        error: 'ユーザー名が既に使用されています',
      });

      const { getByTestId, getByText } = render(
        <E2ETestApp>
          <SignUpScreen />
        </E2ETestApp>
      );

      await waitFor(() => {
        expect(getByTestId('signup-form')).toBeTruthy();
      });

      // Fill form with valid data
      act(() => {
        fireEvent.changeText(getByTestId('maternal-health-id-input'), REGISTRATION_REQUESTS.VALID_REGISTRATION.maternal_health_id);
        fireEvent.changeText(getByTestId('username-input'), REGISTRATION_REQUESTS.DUPLICATE_USERNAME.username);
        fireEvent.changeText(getByTestId('password-input'), REGISTRATION_REQUESTS.VALID_REGISTRATION.password);
        fireEvent.changeText(getByTestId('confirm-password-input'), REGISTRATION_REQUESTS.VALID_REGISTRATION.confirmPassword);
      });

      // Submit registration
      const registerButton = getByTestId('register-button');
      act(() => {
        fireEvent.press(registerButton);
      });

      // Verify error handling
      await waitFor(() => {
        expect(getByText('ユーザー名が既に使用されています')).toBeTruthy();
      });

      // Should not navigate on error
      expect(mockReset).not.toHaveBeenCalled();
    });
  });

  describe('Complete Login Flow E2E', () => {
    it('should complete full login journey successfully', async () => {
      (authService.login as jest.Mock).mockResolvedValue({
        success: true,
        user: TEST_USERS.VALID_USER_1,
      });

      const { getByTestId } = render(
        <E2ETestApp>
          <LoginScreen />
        </E2ETestApp>
      );

      await waitFor(() => {
        expect(getByTestId('login-form')).toBeTruthy();
      });

      // Step 1: Enter username
      const usernameInput = getByTestId('username-input');
      act(() => {
        fireEvent.changeText(usernameInput, LOGIN_REQUESTS.VALID_LOGIN.username);
      });

      // Step 2: Enter password
      const passwordInput = getByTestId('password-input');
      act(() => {
        fireEvent.changeText(passwordInput, LOGIN_REQUESTS.VALID_LOGIN.password);
      });

      // Step 3: Submit login
      const loginButton = getByTestId('login-button');
      act(() => {
        fireEvent.press(loginButton);
      });

      // Step 4: Verify loading state
      await waitFor(() => {
        expect(getByTestId('loading-indicator')).toBeTruthy();
      });

      // Step 5: Verify successful login
      await waitFor(() => {
        expect(authService.login).toHaveBeenCalledWith(LOGIN_REQUESTS.VALID_LOGIN);
      });

      // Step 6: Verify navigation
      await waitFor(() => {
        expect(mockReset).toHaveBeenCalledWith({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      });
    });

    it('should handle login failures with proper error display', async () => {
      (authService.login as jest.Mock).mockResolvedValue({
        success: false,
        error: 'ユーザー名またはパスワードが間違っています',
      });

      const { getByTestId, getByText } = render(
        <E2ETestApp>
          <LoginScreen />
        </E2ETestApp>
      );

      await waitFor(() => {
        expect(getByTestId('login-form')).toBeTruthy();
      });

      // Fill and submit form
      act(() => {
        fireEvent.changeText(getByTestId('username-input'), LOGIN_REQUESTS.INVALID_PASSWORD.username);
        fireEvent.changeText(getByTestId('password-input'), LOGIN_REQUESTS.INVALID_PASSWORD.password);
        fireEvent.press(getByTestId('login-button'));
      });

      // Verify error display
      await waitFor(() => {
        expect(getByText('ユーザー名またはパスワードが間違っています')).toBeTruthy();
      });

      // Should not navigate on error
      expect(mockReset).not.toHaveBeenCalled();
    });

    it('should handle account lockout scenario', async () => {
      (authService.login as jest.Mock).mockResolvedValue({
        success: false,
        error: 'アカウントが一時的にロックされています。30分後に再試行してください。',
        errorCode: 'ACCOUNT_LOCKED',
      });

      const { getByTestId, getByText } = render(
        <E2ETestApp>
          <LoginScreen />
        </E2ETestApp>
      );

      await waitFor(() => {
        expect(getByTestId('login-form')).toBeTruthy();
      });

      // Attempt login
      act(() => {
        fireEvent.changeText(getByTestId('username-input'), LOGIN_REQUESTS.VALID_LOGIN.username);
        fireEvent.changeText(getByTestId('password-input'), 'wrong_password');
        fireEvent.press(getByTestId('login-button'));
      });

      // Verify lockout message
      await waitFor(() => {
        expect(getByText(/アカウントが一時的にロックされています/)).toBeTruthy();
      });

      // Login button should be disabled
      const loginButton = getByTestId('login-button');
      expect(loginButton.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('Session Management E2E', () => {
    it('should restore session and bypass login on app restart', async () => {
      // Mock existing session
      (authService.loadSession as jest.Mock).mockResolvedValue(TEST_USERS.VALID_USER_1);

      // Create a protected component
      const ProtectedComponent = () => (
        <AuthGuard>
          <div testID="protected-content">Protected Content</div>
        </AuthGuard>
      );

      const { getByTestId } = render(
        <E2ETestApp>
          <ProtectedComponent />
        </E2ETestApp>
      );

      // Should show loading initially
      expect(getByTestId('loading-indicator')).toBeTruthy();

      // Should restore session and show protected content
      await waitFor(() => {
        expect(getByTestId('protected-content')).toBeTruthy();
      });

      expect(authService.loadSession).toHaveBeenCalled();
    });

    it('should handle session expiry gracefully', async () => {
      // Start with valid session
      (authService.loadSession as jest.Mock).mockResolvedValue(TEST_USERS.VALID_USER_1);
      
      // Mock session refresh failure
      (authService.needsRefresh as jest.Mock).mockResolvedValue(true);
      (authService.refreshToken as jest.Mock).mockResolvedValue(false);
      (authService.logout as jest.Mock).mockResolvedValue(undefined);

      const ProtectedComponent = () => (
        <AuthGuard>
          <div testID="protected-content">Protected Content</div>
        </AuthGuard>
      );

      const { queryByTestId, getByTestId } = render(
        <E2ETestApp>
          <ProtectedComponent />
        </E2ETestApp>
      );

      // Initially should show protected content
      await waitFor(() => {
        expect(getByTestId('protected-content')).toBeTruthy();
      });

      // Simulate session refresh check (after 5 minutes)
      act(() => {
        jest.advanceTimersByTime(5 * 60 * 1000);
      });

      // Should logout and show login prompt
      await waitFor(() => {
        expect(queryByTestId('protected-content')).toBeNull();
        expect(getByTestId('auth-required')).toBeTruthy();
      });
    });
  });

  describe('Navigation and State Management E2E', () => {
    it('should handle navigation between login and signup screens', async () => {
      const { getByTestId, rerender } = render(
        <E2ETestApp>
          <LoginScreen />
        </E2ETestApp>
      );

      // Start on login screen
      await waitFor(() => {
        expect(getByTestId('login-form')).toBeTruthy();
      });

      // Navigate to signup
      const signupLink = getByTestId('goto-signup-button');
      act(() => {
        fireEvent.press(signupLink);
      });

      expect(mockNavigate).toHaveBeenCalledWith('SignUp');

      // Switch to signup screen
      rerender(
        <E2ETestApp>
          <SignUpScreen />
        </E2ETestApp>
      );

      await waitFor(() => {
        expect(getByTestId('signup-form')).toBeTruthy();
      });

      // Navigate back to login
      const loginLink = getByTestId('goto-login-button');
      act(() => {
        fireEvent.press(loginLink);
      });

      expect(mockNavigate).toHaveBeenCalledWith('Login');
    });

    it('should maintain form state during navigation', async () => {
      const { getByTestId, rerender } = render(
        <E2ETestApp>
          <SignUpScreen />
        </E2ETestApp>
      );

      await waitFor(() => {
        expect(getByTestId('signup-form')).toBeTruthy();
      });

      // Fill partial form
      const usernameInput = getByTestId('username-input');
      act(() => {
        fireEvent.changeText(usernameInput, 'partial_username');
      });

      // Navigate away and back (simulated)
      act(() => {
        fireEvent.press(getByTestId('goto-login-button'));
      });

      rerender(
        <E2ETestApp>
          <LoginScreen />
        </E2ETestApp>
      );

      rerender(
        <E2ETestApp>
          <SignUpScreen />
        </E2ETestApp>
      );

      // Form should be reset (security measure)
      await waitFor(() => {
        const newUsernameInput = getByTestId('username-input');
        expect(newUsernameInput.props.value).toBe('');
      });
    });
  });

  describe('Error Recovery E2E', () => {
    it('should recover from network failures', async () => {
      // First call fails
      (authService.login as jest.Mock)
        .mockResolvedValueOnce({
          success: false,
          error: 'ネットワークエラーが発生しました',
        })
        .mockResolvedValueOnce({
          success: true,
          user: TEST_USERS.VALID_USER_1,
        });

      const { getByTestId, getByText } = render(
        <E2ETestApp>
          <LoginScreen />
        </E2ETestApp>
      );

      await waitFor(() => {
        expect(getByTestId('login-form')).toBeTruthy();
      });

      // First attempt fails
      act(() => {
        fireEvent.changeText(getByTestId('username-input'), LOGIN_REQUESTS.VALID_LOGIN.username);
        fireEvent.changeText(getByTestId('password-input'), LOGIN_REQUESTS.VALID_LOGIN.password);
        fireEvent.press(getByTestId('login-button'));
      });

      await waitFor(() => {
        expect(getByText('ネットワークエラーが発生しました')).toBeTruthy();
      });

      // Retry attempt succeeds
      act(() => {
        fireEvent.press(getByTestId('login-button'));
      });

      await waitFor(() => {
        expect(mockReset).toHaveBeenCalled();
      });
    });

    it('should handle service unavailable scenarios', async () => {
      (authService.initialize as jest.Mock).mockRejectedValue(
        new Error('Service unavailable')
      );

      const { getByText, getByRole } = render(
        <E2ETestApp>
          <LoginScreen />
        </E2ETestApp>
      );

      // Should show service error
      await waitFor(() => {
        expect(getByText('初期化エラー')).toBeTruthy();
      });

      // Should allow retry
      const retryButton = getByRole('button', { name: '再試行' });
      expect(retryButton).toBeTruthy();
    });
  });

  describe('Performance E2E Tests', () => {
    it('should complete authentication flows within performance targets', async () => {
      (authService.login as jest.Mock).mockResolvedValue({
        success: true,
        user: TEST_USERS.VALID_USER_1,
      });

      const { getByTestId } = render(
        <E2ETestApp>
          <LoginScreen />
        </E2ETestApp>
      );

      await waitFor(() => {
        expect(getByTestId('login-form')).toBeTruthy();
      });

      const { duration } = await global.measurePerformance(async () => {
        act(() => {
          fireEvent.changeText(getByTestId('username-input'), LOGIN_REQUESTS.VALID_LOGIN.username);
          fireEvent.changeText(getByTestId('password-input'), LOGIN_REQUESTS.VALID_LOGIN.password);
          fireEvent.press(getByTestId('login-button'));
        });

        await waitFor(() => {
          expect(mockReset).toHaveBeenCalled();
        });
      }, PERFORMANCE_TEST_DATA.TARGET_RESPONSE_TIMES.LOGIN);

      expect(duration).toBeLessThan(PERFORMANCE_TEST_DATA.TARGET_RESPONSE_TIMES.LOGIN);
    });

    it('should handle form validation within performance targets', async () => {
      const { getByTestId } = render(
        <E2ETestApp>
          <SignUpScreen />
        </E2ETestApp>
      );

      await waitFor(() => {
        expect(getByTestId('signup-form')).toBeTruthy();
      });

      const { duration } = await global.measurePerformance(async () => {
        act(() => {
          fireEvent.changeText(getByTestId('password-input'), 'test_password_123');
        });

        await waitFor(() => {
          expect(getByTestId('password-strength-indicator')).toBeTruthy();
        });
      }, PERFORMANCE_TEST_DATA.TARGET_RESPONSE_TIMES.VALIDATION);

      expect(duration).toBeLessThan(PERFORMANCE_TEST_DATA.TARGET_RESPONSE_TIMES.VALIDATION);
    });
  });

  describe('Accessibility E2E Tests', () => {
    it('should support keyboard navigation', async () => {
      const { getByTestId } = render(
        <E2ETestApp>
          <LoginScreen />
        </E2ETestApp>
      );

      await waitFor(() => {
        expect(getByTestId('login-form')).toBeTruthy();
      });

      // Test tab navigation
      const usernameInput = getByTestId('username-input');
      const passwordInput = getByTestId('password-input');
      const loginButton = getByTestId('login-button');

      // Should have proper accessibility labels
      expect(usernameInput.props.accessibilityLabel).toBeTruthy();
      expect(passwordInput.props.accessibilityLabel).toBeTruthy();
      expect(loginButton.props.accessibilityLabel).toBeTruthy();

      // Should be focusable
      expect(usernameInput.props.accessible).toBe(true);
      expect(passwordInput.props.accessible).toBe(true);
      expect(loginButton.props.accessible).toBe(true);
    });

    it('should provide screen reader support', async () => {
      const { getByTestId, getByText } = render(
        <E2ETestApp>
          <SignUpScreen />
        </E2ETestApp>
      );

      await waitFor(() => {
        expect(getByTestId('signup-form')).toBeTruthy();
      });

      // Trigger validation error
      act(() => {
        fireEvent.changeText(getByTestId('password-input'), '123');
      });

      await waitFor(() => {
        const errorMessage = getByText('弱い');
        expect(errorMessage.props.accessibilityLiveRegion).toBe('polite');
      });
    });
  });

  describe('Security E2E Tests', () => {
    it('should maintain security throughout complete user journey', async () => {
      const consoleSpy = jest.spyOn(console, 'log');

      (authService.register as jest.Mock).mockResolvedValue({
        success: true,
        user: TEST_USERS.VALID_USER_1,
      });

      const { getByTestId } = render(
        <E2ETestApp>
          <SignUpScreen />
        </E2ETestApp>
      );

      await waitFor(() => {
        expect(getByTestId('signup-form')).toBeTruthy();
      });

      // Complete registration flow
      act(() => {
        fireEvent.changeText(getByTestId('maternal-health-id-input'), REGISTRATION_REQUESTS.VALID_REGISTRATION.maternal_health_id);
        fireEvent.changeText(getByTestId('username-input'), REGISTRATION_REQUESTS.VALID_REGISTRATION.username);
        fireEvent.changeText(getByTestId('password-input'), REGISTRATION_REQUESTS.VALID_REGISTRATION.password);
        fireEvent.changeText(getByTestId('confirm-password-input'), REGISTRATION_REQUESTS.VALID_REGISTRATION.confirmPassword);
        fireEvent.press(getByTestId('register-button'));
      });

      await waitFor(() => {
        expect(authService.register).toHaveBeenCalled();
      });

      // Verify no sensitive data in console logs
      consoleSpy.mock.calls.forEach(call => {
        const message = call.join(' ');
        expect(message).not.toMatch(/\b\d{10}\b/);
        expect(message).not.toContain('maternal_health_id');
      });

      consoleSpy.mockRestore();
    });
  });
});