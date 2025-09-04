/**
 * SECURE AUTHENTICATION CONTEXT
 *
 * Provides secure authentication state management with:
 * - Automatic session restoration
 * - Token refresh handling
 * - Security event logging
 * - Maternal health ID protection
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useState,
} from 'react';
import {
  PublicUserProfile,
  AuthContext as AuthContextType,
  AuthResponse,
  AuthErrorResponse,
  RegistrationRequest,
  LoginRequest,
  SecurityActionType,
  sanitizeForLogging,
} from '../types/auth';
import { authService } from '../services/authService';
import * as supaAuth from '../services/supabaseAuthAdapter';
import { getMyProfile, updateMyProfile } from '../services/profileService';
import { initializeAllServices } from '../utils/serviceInitializer';
import { secureLogger } from '../utils/privacyProtection';
import { SESSION_CHECK_INTERVAL_MS } from '../config/notificationsConfig';
import {
  registerDeviceForPush,
  unregisterDeviceForPush,
} from '../services/pushNotificationService';
import Constants from 'expo-constants';

// =====================================================
// CONTEXT STATE TYPES
// =====================================================

interface AuthState {
  user: PublicUserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
  initializationError: string | null;
}

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: PublicUserProfile | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | {
      type: 'SET_INITIALIZATION';
      payload: { initialized: boolean; error?: string };
    }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' };

// =====================================================
// STATE REDUCER
// =====================================================

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: action.payload !== null,
        isLoading: false,
        error: null,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case 'SET_INITIALIZATION':
      return {
        ...state,
        isInitialized: action.payload.initialized,
        initializationError: action.payload.error || null,
        isLoading: !action.payload.initialized,
      };

    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };

    case 'CLEAR_ERROR':
      return { ...state, error: null, initializationError: null };

    default:
      return state;
  }
}

// =====================================================
// CONTEXT DEFINITION
// =====================================================

interface AuthContextValue extends AuthContextType {
  // Authentication methods
  login: (request: LoginRequest) => Promise<AuthResponse>;
  register: (request: RegistrationRequest) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  // Supabase Auth (email/password) methods
  loginWithEmail: (params: {
    email: string;
    password: string;
  }) => Promise<AuthResponse>;
  registerWithEmail: (params: {
    email: string;
    password: string;
    display_name?: string;
    bio?: string;
    avatar_emoji?: string;
  }) => Promise<AuthResponse>;

  // Utility methods
  clearError: () => void;
  refreshToken: () => Promise<boolean>;

  // State getters
  error: string | null;
  isInitialized: boolean;
  initializationError: string | null;

  // Service status
  getServiceHealth: () => Promise<any>;

  // Dispatch for profile updates
  dispatch: React.Dispatch<AuthAction>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// =====================================================
// INITIAL STATE
// =====================================================

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  isInitialized: false,
  initializationError: null,
};

// =====================================================
// CONTEXT PROVIDER COMPONENT
// =====================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const [sessionCheckInterval, setSessionCheckInterval] =
    useState<NodeJS.Timeout | null>(null);

  // =====================================================
  // SERVICE INITIALIZATION
  // =====================================================

  /**
   * Initializes all authentication services
   */
  const initializeServices = useCallback(async () => {
    try {
      secureLogger.info('AuthContext: Initializing services');

      const result = await initializeAllServices();

      if (result.success) {
        dispatch({
          type: 'SET_INITIALIZATION',
          payload: { initialized: true },
        });
        secureLogger.info('AuthContext: Services initialized successfully', {
          totalTime: result.totalTime,
          services: result.services.length,
        });

        // E2E/App Store screenshots helper: optionally auto-login with a stub user
        try {
          const e2eAutoLogin = (Constants as any)?.expoConfig?.extra?.E2E_AUTO_LOGIN;
          if (e2eAutoLogin) {
            const now = new Date().toISOString();
            const stubUser: PublicUserProfile = {
              id: 'e2e-user',
              username: 'mamapace_e2e',
              display_name: 'Mamapace',
              bio: '自動ログイン(スクショ用)',
              avatar_emoji: '👩\u200d🍼',
              created_at: now,
              profile_visibility: 'public',
              is_active: true,
            };
            dispatch({ type: 'SET_USER', payload: stubUser });
            return; // Skip session restore when auto-login is enabled
          }
        } catch {}

        await restoreSession();
      } else {
        const errorMessage =
          result.criticalErrors.join('; ') || 'サービスの初期化に失敗しました';
        dispatch({
          type: 'SET_INITIALIZATION',
          payload: { initialized: false, error: errorMessage },
        });
        secureLogger.error('AuthContext: Service initialization failed', {
          criticalErrors: result.criticalErrors,
          warnings: result.warnings,
        });
      }
    } catch (error) {
      const errorMessage = 'サービスの初期化中にエラーが発生しました';
      secureLogger.error('AuthContext: Service initialization exception', {
        error,
      });
      dispatch({
        type: 'SET_INITIALIZATION',
        payload: {
          initialized: false,
          error: errorMessage,
        },
      });
    }
  }, []);

  /**
   * Restores user session after services are initialized
   */
  const restoreSession = useCallback(async () => {
    try {
      secureLogger.info('AuthContext: Restoring session');
      const user = await authService.loadSession();

      if (user) {
        dispatch({ type: 'SET_USER', payload: user });
        secureLogger.info(
          'AuthContext: Session restored successfully',
          sanitizeForLogging(user)
        );

        // Set up session monitoring
        setupSessionMonitoring();

        // Best-effort push registration
        try {
          await registerDeviceForPush(user.id);
        } catch (e) {
          secureLogger.warn('Push registration failed on session restore', { error: String(e) });
        }
      } else {
        dispatch({ type: 'SET_USER', payload: null });
        secureLogger.info('AuthContext: No valid session found');
      }
    } catch (error) {
      secureLogger.error('AuthContext: Session restoration failed', { error });
      dispatch({
        type: 'SET_ERROR',
        payload: 'セッションの復元に失敗しました',
      });
      dispatch({ type: 'SET_USER', payload: null });
    }
  }, []);

  /**
   * Sets up session monitoring and automatic refresh
   */
  const setupSessionMonitoring = useCallback(() => {
    // Clear existing interval
    if (sessionCheckInterval) {
      clearInterval(sessionCheckInterval);
    }

    // Check session every 5 minutes
    const interval = setInterval(
      async () => {
        try {
          const needsRefresh = await authService.needsRefresh();

          if (needsRefresh) {
            secureLogger.info(
              'AuthContext: Session needs refresh, attempting refresh'
            );
            const success = await refreshToken();

            if (!success) {
              secureLogger.warn(
                'AuthContext: Session refresh failed, logging out'
              );
              await logout();
            }
          }
        } catch (error) {
          secureLogger.error('AuthContext: Session check failed', { error });
        }
      },
      SESSION_CHECK_INTERVAL_MS
    );

    setSessionCheckInterval(interval);
  }, [sessionCheckInterval]);

  // =====================================================
  // AUTHENTICATION METHODS
  // =====================================================

  /**
   * User registration with enhanced security validation
   */
  const register = useCallback(
    async (request: RegistrationRequest): Promise<AuthResponse> => {
      if (!state.isInitialized) {
        return {
          success: false,
          error:
            'サービスが初期化されていません。しばらく待ってからお試しください。',
        };
      }

      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'CLEAR_ERROR' });

        secureLogger.info(
          'AuthContext: Registration attempt',
          sanitizeForLogging(request)
        );
        const response = await authService.register(request);

        if (response.success) {
          dispatch({ type: 'SET_USER', payload: response.user });
          secureLogger.security('Registration successful', {
            userId: response.user.id,
            username: response.user.username,
          });

          // Set up session monitoring for new user
          setupSessionMonitoring();
        } else {
          const errorResponse = response as AuthErrorResponse;
          dispatch({ type: 'SET_ERROR', payload: errorResponse.error });
          dispatch({ type: 'SET_LOADING', payload: false });
          secureLogger.warn('Registration failed', {
            error: errorResponse.error,
          });
        }

        return response;
      } catch (error) {
        const errorMessage = '登録中にエラーが発生しました';
        secureLogger.error('AuthContext: Registration exception', { error });

        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        dispatch({ type: 'SET_LOADING', payload: false });

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [state.isInitialized, setupSessionMonitoring]
  );

  /**
   * Supabase Auth (email/password) registration
   */
  const registerWithEmail = useCallback(
    async (params: {
      email: string;
      password: string;
      display_name?: string;
      bio?: string;
      avatar_emoji?: string;
    }): Promise<AuthResponse> => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'CLEAR_ERROR' });

        // Use a stable native scheme to avoid Expo dev host variations
        const redirectTo = 'mamapace://auth-callback';

        await supaAuth.signUp({
          email: params.email,
          password: params.password,
          redirectTo,
        });

        // If email confirmations are enabled, session may be null. Try explicit sign-in.
        try {
          await supaAuth.signIn({
            email: params.email,
            password: params.password,
          });
        } catch (e) {
          // If sign-in fails (e.g., email not confirmed), surface a helpful message
          dispatch({
            type: 'SET_ERROR',
            payload: 'メール認証が必要です。受信トレイをご確認ください。',
          });
          dispatch({ type: 'SET_LOADING', payload: false });
          return {
            success: false,
            error: 'メール認証が必要です。受信トレイをご確認ください。',
          };
        }

        // Ensure profile exists/updated
        if (params.display_name || params.bio || params.avatar_emoji) {
          try {
            await updateMyProfile({
              display_name: params.display_name,
              bio: params.bio,
              avatar_emoji: params.avatar_emoji,
            });
          } catch {}
        }

        const profile = await getMyProfile();
        dispatch({ type: 'SET_USER', payload: profile });
        setupSessionMonitoring();
        return {
          success: true,
          user: profile,
          session_token: '',
          refresh_token: '',
          expires_at: '',
        } as any;
      } catch (error: any) {
        const msg =
          (error && (error.message || error.error_description)) ||
          '登録に失敗しました。もう一度お試しください。';
        dispatch({ type: 'SET_ERROR', payload: msg });
        dispatch({ type: 'SET_LOADING', payload: false });
        return { success: false, error: msg };
      }
    },
    [setupSessionMonitoring]
  );

  /**
   * User login with enhanced security validation
   */
  const login = useCallback(
    async (request: LoginRequest): Promise<AuthResponse> => {
      if (!state.isInitialized) {
        return {
          success: false,
          error:
            'サービスが初期化されていません。しばらく待ってからお試しください。',
        };
      }

      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'CLEAR_ERROR' });

        secureLogger.info(
          'AuthContext: Login attempt',
          sanitizeForLogging(request)
        );
        const response = await authService.login(request);

        if (response.success) {
          dispatch({ type: 'SET_USER', payload: response.user });
          secureLogger.security('Login successful', {
            userId: response.user.id,
            username: response.user.username,
          });

          // Set up session monitoring for authenticated user
          setupSessionMonitoring();

          // Best-effort push registration
          try {
            await registerDeviceForPush(response.user.id);
          } catch (e) {
            secureLogger.warn('Push registration failed on login', { error: String(e) });
          }
        } else {
          const errorResponse = response as AuthErrorResponse;
          dispatch({ type: 'SET_ERROR', payload: errorResponse.error });
          dispatch({ type: 'SET_LOADING', payload: false });
          secureLogger.warn('Login failed', { error: errorResponse.error });
        }

        return response;
      } catch (error) {
        const errorMessage = 'ログイン中にエラーが発生しました';
        secureLogger.error('AuthContext: Login exception', { error });

        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        dispatch({ type: 'SET_LOADING', payload: false });

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [state.isInitialized, setupSessionMonitoring]
  );

  /**
   * Supabase Auth (email/password) login
   */
  const loginWithEmail = useCallback(
    async (params: {
      email: string;
      password: string;
    }): Promise<AuthResponse> => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'CLEAR_ERROR' });
        await supaAuth.signIn({
          email: params.email,
          password: params.password,
        });
        const profile = await getMyProfile();
        dispatch({ type: 'SET_USER', payload: profile });
        setupSessionMonitoring();
        return {
          success: true,
          user: profile,
          session_token: '',
          refresh_token: '',
          expires_at: '',
        } as any;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: 'ログインに失敗しました。' });
        dispatch({ type: 'SET_LOADING', payload: false });
        return { success: false, error: 'ログインに失敗しました。' };
      }
    },
    [setupSessionMonitoring]
  );

  /**
   * User logout with enhanced session cleanup
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      secureLogger.info('AuthContext: Logout initiated');

      // Clear session monitoring
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        setSessionCheckInterval(null);
      }

      // Best-effort device unregistration for push (skip in dev if configured)
      try {
        const keepToken =
          (Constants as any)?.expoConfig?.extra?.PUSH_KEEP_TOKEN_ON_LOGOUT ===
          true;
        if (!keepToken && state.user) {
          await unregisterDeviceForPush(state.user.id);
        } else if (keepToken) {
          secureLogger.info('Skipping push token unregister on logout (dev mode)');
        }
      } catch (e) {
        secureLogger.warn('Supabase signOut failed', { error: String(e) });
      }

      try {
        await supaAuth.signOut();
      } catch {}
      await authService.logout();
      dispatch({ type: 'LOGOUT' });

      secureLogger.security('Logout successful');
    } catch (error) {
      secureLogger.error('AuthContext: Logout error', { error });
      // Still clear local state even if server logout fails
      dispatch({ type: 'LOGOUT' });
    }
  }, [sessionCheckInterval]);

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Clears any authentication error
   */
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  /**
   * Refreshes authentication token
   */
  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (!state.isInitialized) {
      return false;
    }

    try {
      secureLogger.info('AuthContext: Refreshing token');
      const success = await authService.refreshToken();

      if (!success) {
        secureLogger.warn('AuthContext: Token refresh failed, logging out');
        await logout();
      } else {
        secureLogger.info('AuthContext: Token refresh successful');
      }

      return success;
    } catch (error) {
      secureLogger.error('AuthContext: Token refresh error', { error });
      await logout();
      return false;
    }
  }, [state.isInitialized, logout]);

  /**
   * Gets service health information
   */
  const getServiceHealth = useCallback(async () => {
    if (!state.isInitialized) {
      return { error: 'Services not initialized' };
    }

    try {
      const stats = authService.getServiceStats();
      return stats;
    } catch (error) {
      secureLogger.error('Failed to get service health', { error });
      return { error: 'Failed to get service health' };
    }
  }, [state.isInitialized]);

  // =====================================================
  // EFFECTS
  // =====================================================

  /**
   * Initialize authentication services on mount
   */
  useEffect(() => {
    initializeServices();
  }, [initializeServices]);

  /**
   * Cleanup intervals on unmount
   */
  useEffect(() => {
    return () => {
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
      }
    };
  }, [sessionCheckInterval]);

  // =====================================================
  // CONTEXT VALUE
  // =====================================================

  const contextValue: AuthContextValue = {
    // State
    user: state.user,
    session: null, // Not exposing session details to components
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    isInitialized: state.isInitialized,
    initializationError: state.initializationError,

    // Methods
    login,
    register,
    loginWithEmail,
    registerWithEmail,
    logout,
    clearError,
    refreshToken,
    getServiceHealth,
    dispatch,
  };

  // =====================================================
  // ERROR BOUNDARY PROTECTION
  // =====================================================

  // Critical initialization error
  if (
    state.initializationError &&
    state.initializationError.includes('critical')
  ) {
    secureLogger.error('Critical initialization error, rendering fallback UI', {
      error: state.initializationError,
    });

    const { View, Text, Pressable } = require('react-native');
    return (
      <View style={{ padding: 20 }}>
        <View
          style={{
            padding: 16,
            borderRadius: 8,
            backgroundColor: '#f8d7da',
            borderWidth: 1,
            borderColor: '#dc3545',
          }}
        >
          <Text style={{ fontWeight: '700', marginBottom: 8 }}>
            初期化エラー
          </Text>
          <Text style={{ marginBottom: 8 }}>
            アプリケーションの初期化に失敗しました。
          </Text>
          <Text style={{ marginBottom: 12 }}>{state.initializationError}</Text>
          <Pressable
            onPress={() => {
              dispatch({
                type: 'SET_INITIALIZATION',
                payload: { initialized: false },
              });
              initializeServices();
            }}
            accessibilityRole="button"
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 6,
              backgroundColor: '#dc3545',
              alignSelf: 'flex-start',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>再試行</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Critical runtime error
  if (state.error && state.error.includes('critical')) {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View style={{ padding: 20 }}>
        <View
          style={{
            padding: 16,
            borderRadius: 8,
            backgroundColor: '#fff3cd',
            borderWidth: 1,
            borderColor: '#ffc107',
          }}
        >
          <Text style={{ fontWeight: '700', marginBottom: 8 }}>
            セキュリティエラー
          </Text>
          <Text style={{ marginBottom: 12 }}>
            セキュリティ上の理由により、アプリケーションを再起動してください。
          </Text>
          <Pressable
            onPress={async () => {
              try {
                await logout();
                dispatch({ type: 'CLEAR_ERROR' });
                await initializeServices();
              } catch (error) {
                // no-op for RN
              }
            }}
            accessibilityRole="button"
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 6,
              backgroundColor: '#007bff',
              alignSelf: 'flex-start',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>再起動</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Show loading during initialization
  if (!state.isInitialized && state.isLoading) {
    const { View, Text } = require('react-native');
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        <Text style={{ fontWeight: '700', marginBottom: 6 }}>
          サービスを初期化中...
        </Text>
        <Text style={{ fontSize: 12, color: '#666' }}>
          認証システムを準備しています
        </Text>
      </View>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

// =====================================================
// CONTEXT HOOK
// =====================================================

/**
 * Hook to use authentication context
 * Throws error if used outside AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

/**
 * Hook to check if authentication services are ready
 */
export function useAuthReady(): boolean {
  const { isInitialized } = useAuth();
  return isInitialized;
}

/**
 * Hook to get service health information
 */
export function useServiceHealth() {
  const { getServiceHealth, isInitialized } = useAuth();
  const [health, setHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkHealth = useCallback(async () => {
    if (!isInitialized) return;

    setIsLoading(true);
    try {
      const healthData = await getServiceHealth();
      setHealth(healthData);
    } catch (error) {
      secureLogger.error('Failed to get service health', { error });
    } finally {
      setIsLoading(false);
    }
  }, [getServiceHealth, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      checkHealth();
    }
  }, [isInitialized, checkHealth]);

  return {
    health,
    isLoading,
    refresh: checkHealth,
  };
}

// =====================================================
// HOC FOR AUTHENTICATION PROTECTION
// =====================================================

/**
 * Higher-order component to protect routes that require authentication
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading, isInitialized, user } = useAuth();

    // Show loading during initialization or authentication check
    if (!isInitialized || isLoading) {
      return (
        <div
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
            textAlign: 'center',
          }}
        >
          <div>
            {!isInitialized ? 'サービスを初期化中...' : '認証を確認中...'}
          </div>
        </div>
      );
    }

    if (!isAuthenticated || !user) {
      // Return login prompt or redirect to login
      return (
        <div
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
            textAlign: 'center',
          }}
        >
          <h3>ログインが必要です</h3>
          <p>このページを表示するには、ログインしてください。</p>
        </div>
      );
    }

    return <Component {...props} />;
  };
}

// =====================================================
// EXPORT STATEMENTS
// =====================================================

export default AuthContext;

// Additional utilities are already exported above
