/**
 * AUTHENTICATION GUARD COMPONENT
 *
 * Protects authenticated routes and manages navigation state:
 * - Redirects unauthenticated users to login
 * - Shows loading state during authentication checks
 * - Handles session restoration gracefully
 * - Provides security context for protected components
 */

import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';
import { secureLogger } from '../utils/privacyProtection';

interface AuthGuardProps {
  /** Child components to render when authenticated */
  children: React.ReactNode;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Custom unauthenticated component */
  unauthenticatedComponent?: React.ReactNode;
  /** Whether to show debug information */
  showDebugInfo?: boolean;
}

/**
 * Authentication guard that protects routes requiring authentication
 */
export default function AuthGuard({
  children,
  loadingComponent,
  unauthenticatedComponent,
  showDebugInfo = false,
}: AuthGuardProps) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const { isAuthenticated, isLoading, user, error } = useAuth();

  // =====================================================
  // LOADING STATE
  // =====================================================

  if (isLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }

    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'transparent',
          padding: theme.spacing(2),
        }}
      >
        <View
          style={{
            backgroundColor: colors.card + '88',
            borderRadius: theme.radius.lg,
            padding: theme.spacing(2),
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.surface,
          }}
        >
          <ActivityIndicator
            size="large"
            color={colors.pink}
            style={{ marginBottom: theme.spacing(1) }}
          />

          <Text
            style={{
              color: colors.text,
              fontSize: 16,
              fontWeight: '600',
              marginBottom: 4,
            }}
          >
            認証確認中...
          </Text>

          <Text
            style={{
              color: colors.subtext,
              fontSize: 12,
              textAlign: 'center',
            }}
          >
            セキュアなセッションを復元しています
          </Text>

          {showDebugInfo && (
            <View
              style={{
                marginTop: theme.spacing(1),
                padding: theme.spacing(0.75),
                backgroundColor: colors.surface,
                borderRadius: theme.radius.sm,
                alignSelf: 'stretch',
              }}
            >
              <Text
                style={{
                  color: colors.subtext,
                  fontSize: 10,
                  fontFamily: 'monospace',
                }}
              >
                AuthGuard: Loading={String(isLoading)} | Auth=
                {String(isAuthenticated)} | User={user ? 'Present' : 'None'}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // =====================================================
  // ERROR STATE
  // =====================================================

  if (error && error.includes('critical')) {
    secureLogger.error('Critical authentication error in AuthGuard', { error });

    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'transparent',
          padding: theme.spacing(2),
        }}
      >
        <View
          style={{
            backgroundColor: colors.danger + '10',
            borderRadius: theme.radius.lg,
            padding: theme.spacing(2),
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.danger + '30',
          }}
        >
          <Text style={{ fontSize: 24, marginBottom: theme.spacing(1) }}>
            🚨
          </Text>

          <Text
            style={{
              color: colors.danger,
              fontSize: 16,
              fontWeight: '700',
              marginBottom: theme.spacing(0.5),
              textAlign: 'center',
            }}
          >
            セキュリティエラー
          </Text>

          <Text
            style={{
              color: colors.danger,
              fontSize: 14,
              textAlign: 'center',
              lineHeight: 20,
            }}
          >
            セキュリティ上の理由により、アプリケーションを再起動してください。
            問題が続く場合は、サポートにお問い合わせください。
          </Text>
        </View>
      </View>
    );
  }

  // =====================================================
  // UNAUTHENTICATED STATE
  // =====================================================

  if (!isAuthenticated || !user) {
    secureLogger.debug(
      'AuthGuard: User not authenticated, showing unauthenticated component'
    );

    if (unauthenticatedComponent) {
      return <>{unauthenticatedComponent}</>;
    }

    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'transparent',
          padding: theme.spacing(2),
        }}
      >
        <View
          style={{
            backgroundColor: colors.card + '88',
            borderRadius: theme.radius.lg,
            padding: theme.spacing(2),
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.surface,
          }}
        >
          <Text style={{ fontSize: 32, marginBottom: theme.spacing(1) }}>
            🔐
          </Text>

          <Text
            style={{
              color: colors.text,
              fontSize: 18,
              fontWeight: '700',
              marginBottom: theme.spacing(0.5),
              textAlign: 'center',
            }}
          >
            ログインが必要です
          </Text>

          <Text
            style={{
              color: colors.subtext,
              fontSize: 14,
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: theme.spacing(1.5),
            }}
          >
            このページを表示するには、 ログインまたは新規登録が必要です。
          </Text>

          <View
            style={{
              backgroundColor: colors.mint + '15',
              borderRadius: theme.radius.sm,
              padding: theme.spacing(1),
              borderWidth: 1,
              borderColor: colors.mint + '30',
              alignSelf: 'stretch',
            }}
          >
            <Text
              style={{
                color: colors.mint,
                fontSize: 12,
                textAlign: 'center',
              }}
            >
              🛡️ あなたの個人情報は安全に保護されます
            </Text>
          </View>

          {showDebugInfo && (
            <View
              style={{
                marginTop: theme.spacing(1),
                padding: theme.spacing(0.75),
                backgroundColor: colors.surface,
                borderRadius: theme.radius.sm,
                alignSelf: 'stretch',
              }}
            >
              <Text
                style={{
                  color: colors.subtext,
                  fontSize: 10,
                  fontFamily: 'monospace',
                }}
              >
                AuthGuard: Loading={String(isLoading)} | Auth=
                {String(isAuthenticated)} | User={user ? 'Present' : 'None'}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // =====================================================
  // AUTHENTICATED STATE
  // =====================================================

  secureLogger.debug(
    'AuthGuard: User authenticated, rendering protected content',
    {
      userId: user.id,
      username: user.username,
    }
  );

  return <>{children}</>;
}

// =====================================================
// HIGHER-ORDER COMPONENT VERSION
// =====================================================

/**
 * Higher-order component version of AuthGuard for wrapping components
 */
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    loadingComponent?: React.ReactNode;
    unauthenticatedComponent?: React.ReactNode;
    showDebugInfo?: boolean;
  }
): React.ComponentType<P> {
  return function AuthGuardedComponent(props: P) {
    return (
      <AuthGuard
        loadingComponent={options?.loadingComponent}
        unauthenticatedComponent={options?.unauthenticatedComponent}
        showDebugInfo={options?.showDebugInfo}
      >
        <Component {...props} />
      </AuthGuard>
    );
  };
}

// =====================================================
// AUTHENTICATION STATUS HOOK
// =====================================================

/**
 * Hook to check authentication status for conditional rendering
 */
export function useAuthStatus() {
  const { isAuthenticated, isLoading, user, error } = useAuth();

  return {
    isAuthenticated,
    isLoading,
    hasUser: !!user,
    hasError: !!error,
    isCriticalError: error?.includes('critical'),
    isReady: !isLoading && !error,
  };
}
