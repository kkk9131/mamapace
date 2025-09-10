/**
 * SECURE AUTHENTICATION SERVICE
 *
 * CRITICAL SECURITY RULES:
 * 1. NEVER log maternal_health_id values
 * 2. Always sanitize data before logging
 * 3. Use secure storage for tokens
 * 4. Validate all inputs before processing
 * 5. Handle errors without exposing system details
 */

import { secureLogger } from '../utils/privacyProtection';
import {
  AuthResponse,
  AuthSuccessResponse,
  AuthErrorResponse,
  AuthErrorCode,
  RegistrationRequest,
  LoginRequest,
  PublicUserProfile,
  AuthSession,
  DeviceInfo,
  sanitizeForLogging,
  ValidationConstraints,
  MaternalHealthIdValidation,
  UsernameValidation,
  PasswordValidation,
  SecurityActionType,
} from '../types/auth';
import { appConfig } from '../config/appConfig';

import { supabaseClient, initializeSupabase } from './supabaseClient';
import { sessionManager, initializeSessionManager } from './sessionManager';
import secureSessionStore from './secureSessionStore';
import { encryptionService, initializeEncryption } from './encryptionService';
import { validationService } from './validationService';

// =====================================================
// CONFIGURATION
// =====================================================

// Session configuration
const SESSION_CONFIG = {
  TOKEN_EXPIRY_HOURS: 24,
  REFRESH_TOKEN_EXPIRY_DAYS: 30,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCK_DURATION_MINUTES: 30,
} as const;

// =====================================================
// AUTHENTICATION SERVICE CLASS
// =====================================================

class AuthService {
  private isInitialized = false;
  // In-memory tokens (fallback). Phase 1/2 判定に応じて安全保存層を使い分け
  private phase1Session: {
    sessionToken: string;
    refreshToken: string;
    expiresAt: string;
  } | null = null;

  constructor() {}

  // =====================================================
  // INITIALIZATION
  // =====================================================

  /**
   * Initializes all authentication services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      secureLogger.info('Initializing authentication service');

      if (appConfig.useServerHashing || appConfig.disableClientEncryption) {
        // Phase 1: Only Supabase is required
        await initializeSupabase();
      } else {
        // Full stack initialization
        await Promise.all([
          initializeSupabase(),
          initializeEncryption(),
          initializeSessionManager(),
        ]);
      }

      this.isInitialized = true;
      secureLogger.info('Authentication service initialized successfully');
    } catch (error) {
      secureLogger.error('Failed to initialize authentication service', {
        error,
      });
      throw new Error('Authentication service initialization failed');
    }
  }

  /**
   * Ensures service is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // =====================================================
  // VALIDATION METHODS
  // =====================================================

  /**
   * Validates maternal health ID using server-side validation
   * Client-side validation for UX, server validation for security
   */
  async validateMaternalHealthId(
    id: string,
    context?: { action?: 'registration' | 'login' }
  ): Promise<MaternalHealthIdValidation> {
    await this.ensureInitialized();
    return await validationService.validateMaternalHealthIdServer(id, context);
  }

  /**
   * Client-side only validation for immediate UX feedback
   */
  validateMaternalHealthIdClient(id: string): MaternalHealthIdValidation {
    return validationService.validateMaternalHealthIdClient(id);
  }

  /**
   * Validates username using server-side validation
   */
  async validateUsername(
    username: string,
    context?: { userId?: string; action?: 'registration' | 'update' }
  ): Promise<UsernameValidation> {
    await this.ensureInitialized();
    return await validationService.validateUsernameServer(username, context);
  }

  /**
   * Client-side only username validation for immediate UX feedback
   */
  validateUsernameClient(username: string) {
    return validationService.validateUsernameClient(username);
  }

  /**
   * Validates password using server-side validation
   */
  async validatePassword(
    password: string,
    context?: { username?: string; action?: 'registration' | 'change' }
  ): Promise<PasswordValidation> {
    await this.ensureInitialized();
    return await validationService.validatePasswordServer(password, context);
  }

  /**
   * Client-side only password validation for immediate UX feedback
   */
  validatePasswordClient(password: string): PasswordValidation {
    return validationService.validatePasswordClient(password);
  }

  // =====================================================
  // DEVICE INFORMATION
  // =====================================================

  /**
   * Gets device information for session tracking
   */
  private async getDeviceInfo(): Promise<DeviceInfo> {
    // In a real implementation, you would use expo-device to get actual device info
    // For now, we'll use placeholder values that would be populated by the actual device APIs
    return {
      device_type: 'ios', // Platform.OS would give us 'ios' or 'android'
      device_model: 'iPhone', // Device.modelName
      os_version: '15.0', // Device.osVersion
      app_version: '1.0.0', // From app.json or expo-constants
      device_id: 'anonymous_device_id', // Generated unique identifier
    };
  }

  // =====================================================
  // REGISTRATION
  // =====================================================

  /**
   * Registers a new user with enhanced security and validation
   */
  async register(request: RegistrationRequest): Promise<AuthResponse> {
    await this.ensureInitialized();

    try {
      secureLogger.info('Registration attempt', sanitizeForLogging(request));

      // Phase 1: Skip server-side validation layer (avoid privacy enforcement noise)
      // Rely on client-side UI validation for now

      // Prepare maternal health ID payload
      // When either server hashing is enabled or client encryption is disabled,
      // send plaintext to server and let server handle hashing/encryption.
      const sendPlainToServer =
        appConfig.useServerHashing === true ||
        (appConfig as any).disableClientEncryption === true;

      // Call secure registration function
      const client = supabaseClient.getClient();
      const { data, error } = await client.rpc('register_user_secure', {
        p_username: request.username,
        ...(sendPlainToServer
          ? { p_maternal_health_id: request.maternal_health_id }
          : {
              p_encrypted_maternal_health_id:
                await encryptionService.encryptMaternalHealthId(
                  request.maternal_health_id,
                  request.password
                ),
            }),
        p_password: request.password,
        p_display_name: request.display_name,
        p_bio: request.bio,
        p_avatar_emoji: request.avatar_emoji,
        p_device_info: await this.getDeviceInfo(),
      });

      if (error) {
        secureLogger.error('Registration RPC error', { error });

        // Map specific errors
        if (error.message.includes('already exists')) {
          return {
            success: false,
            error: 'ユーザー名または母子手帳番号が既に登録されています',
            error_code: AuthErrorCode.USERNAME_EXISTS,
          };
        }

        return {
          success: false,
          error: '登録に失敗しました。もう一度お試しください。',
          error_code: AuthErrorCode.SYSTEM_ERROR,
        };
      }

      const result = data as any;

      if (!result.success) {
        return {
          success: false,
          error: result.error || '登録に失敗しました。',
          error_code: AuthErrorCode.SYSTEM_ERROR,
        };
      }

      secureLogger.security('Registration successful', {
        userId: result.user?.id,
        username: result.user?.username,
      });

      // Persist session
      const isPhase2 = !!(appConfig as any).disableClientEncryption;
      if (isPhase2) {
        await secureSessionStore.setSession(
          result.user,
          result.session_token,
          result.refresh_token,
          result.expires_at
        );
      } else if (!appConfig.useServerHashing) {
        await sessionManager.createSession(
          result.user,
          result.session_token,
          result.refresh_token,
          result.expires_at,
          await this.getDeviceInfo()
        );
      } else {
        this.phase1Session = {
          sessionToken: result.session_token,
          refreshToken: result.refresh_token,
          expiresAt: result.expires_at,
        };
      }

      return {
        success: true,
        user: result.user,
        session_token: result.session_token,
        refresh_token: result.refresh_token,
        expires_at: result.expires_at,
      };
    } catch (error) {
      secureLogger.error('Registration exception', { error });
      return {
        success: false,
        error: '登録中にエラーが発生しました。',
        error_code: AuthErrorCode.SYSTEM_ERROR,
      };
    }
  }

  // =====================================================
  // LOGIN
  // =====================================================

  /**
   * Authenticates user with enhanced security
   */
  async login(request: LoginRequest): Promise<AuthResponse> {
    await this.ensureInitialized();

    try {
      secureLogger.info('Login attempt', sanitizeForLogging(request));

      // Phase 1: Skip server-side validation layer

      // Get device info
      const deviceInfo = request.device_info || (await this.getDeviceInfo());

      // Prepare maternal health ID payload
      // When either server hashing is enabled or client encryption is disabled,
      // send plaintext to server and let server handle hashing/encryption.
      const sendPlainToServer =
        appConfig.useServerHashing === true ||
        (appConfig as any).disableClientEncryption === true;

      // Call secure authentication function
      const client = supabaseClient.getClient();
      const { data, error } = await client.rpc('authenticate_user_secure', {
        p_username: request.username,
        ...(sendPlainToServer
          ? { p_maternal_health_id: request.maternal_health_id }
          : {
              p_encrypted_maternal_health_id:
                await encryptionService.encryptMaternalHealthId(
                  request.maternal_health_id,
                  request.password
                ),
            }),
        p_password: request.password,
        p_device_info: deviceInfo,
        p_ip_address: null, // In a real app, get client IP
      });

      if (error) {
        secureLogger.error('Login RPC error', { error });
        return {
          success: false,
          error: 'ログインに失敗しました。',
          error_code: AuthErrorCode.SYSTEM_ERROR,
        };
      }

      const result = data as any;

      if (!result.success) {
        // Map specific error messages
        const errorMapping: Record<
          string,
          { error: string; code: AuthErrorCode }
        > = {
          'Invalid credentials': {
            error:
              'ユーザー名、母子手帳番号、またはパスワードが正しくありません。',
            code: AuthErrorCode.INVALID_CREDENTIALS,
          },
          'Account temporarily locked': {
            error:
              'アカウントが一時的にロックされています。しばらく待ってからお試しください。',
            code: AuthErrorCode.ACCOUNT_LOCKED,
          },
        };

        const mappedError = errorMapping[result.error] || {
          error: 'ログインに失敗しました。',
          code: AuthErrorCode.SYSTEM_ERROR,
        };

        return {
          success: false,
          error: mappedError.error,
          error_code: mappedError.code,
        };
      }

      // Persist session
      const isPhase2Login = !!(appConfig as any).disableClientEncryption;
      if (isPhase2Login) {
        await secureSessionStore.setSession(
          result.user,
          result.session_token,
          result.refresh_token,
          result.expires_at
        );
      } else if (!appConfig.useServerHashing) {
        await sessionManager.createSession(
          result.user,
          result.session_token,
          result.refresh_token,
          result.expires_at,
          deviceInfo
        );
      } else {
        this.phase1Session = {
          sessionToken: result.session_token,
          refreshToken: result.refresh_token,
          expiresAt: result.expires_at,
        };
      }

      secureLogger.security('Login successful', {
        userId: result.user?.id,
        username: result.user?.username,
      });

      return {
        success: true,
        user: result.user,
        session_token: result.session_token,
        refresh_token: result.refresh_token,
        expires_at: result.expires_at,
      };
    } catch (error) {
      secureLogger.error('Login exception', { error });
      return {
        success: false,
        error: 'ログイン中にエラーが発生しました。',
        error_code: AuthErrorCode.SYSTEM_ERROR,
      };
    }
  }

  // =====================================================
  // SESSION MANAGEMENT
  // =====================================================

  /**
   * Loads existing session from secure storage
   */
  async loadSession(): Promise<PublicUserProfile | null> {
    await this.ensureInitialized();
    if (
      appConfig.useServerHashing ||
      (appConfig as any).disableClientEncryption
    ) {
      // Phase 2: restore from secure store
      const sess = await secureSessionStore.getSession();
      return sess.user;
    }

    try {
      const sessionData = await sessionManager.restoreSession();
      if (!sessionData) {
        return null;
      }

      const isValid = await sessionManager.isSessionValid();
      if (!isValid) {
        await sessionManager.clearSession();
        return null;
      }

      secureLogger.info('Session loaded successfully', {
        userId: sessionData.user.id,
        username: sessionData.user.username,
      });
      return sessionData.user;
    } catch (error) {
      secureLogger.error('Failed to load session', { error });
      await sessionManager.clearSession();
      return null;
    }
  }

  /**
   * Validates session token with server
   */
  private async validateSessionToken(token: string): Promise<boolean> {
    try {
      const client = supabaseClient.getClient();
      const { data, error } = await client.rpc('validate_session_token', {
        p_session_token: token,
      });

      if (error) {
        secureLogger.error('Session token validation error', { error });
        return false;
      }

      return data?.is_valid || false;
    } catch (error) {
      secureLogger.error('Session token validation exception', { error });
      return false;
    }
  }

  /**
   * Refreshes authentication token
   */
  async refreshToken(): Promise<boolean> {
    await this.ensureInitialized();
    
    // Phase 2: disableClientEncryption mode
    if ((appConfig as any).disableClientEncryption) {
      try {
        const sess = await secureSessionStore.getSession();
        if (!sess.refreshToken) {
          secureLogger.warn('No refresh token available (Phase 2)');
          return false;
        }
        const client = supabaseClient.getClient();
        const { data, error } = await client.rpc('refresh_session_token', {
          p_refresh_token: sess.refreshToken,
        });
        if (error || !data?.success) {
          secureLogger.error('Token refresh RPC error (Phase 2)', { error });
          return false;
        }
        await secureSessionStore.updateTokens(
          data.session_token,
          data.refresh_token,
          data.expires_at
        );
        secureLogger.security('Token refresh successful (Phase 2)');
        return true;
      } catch (error) {
        secureLogger.error('Token refresh exception (Phase 2)', { error });
        return false;
      }
    }
    
    // Phase 1: useServerHashing mode
    if (appConfig.useServerHashing) {
      try {
        if (!this.phase1Session?.refreshToken) {
          secureLogger.warn('No refresh token available (Phase 1)');
          return false;
        }

        const client = supabaseClient.getClient();
        const { data, error } = await client.rpc('refresh_session_token', {
          p_refresh_token: this.phase1Session.refreshToken,
        });

        if (error || !data?.success) {
          secureLogger.error('Token refresh RPC error (Phase 1)', { error });
          // Clear invalid session
          this.phase1Session = null;
          return false;
        }

        // Update phase1 session with new tokens
        this.phase1Session = {
          sessionToken: data.session_token,
          refreshToken: data.refresh_token,
          expiresAt: data.expires_at,
        };

        secureLogger.security('Token refresh successful (Phase 1)');
        return true;
      } catch (error) {
        secureLogger.error('Token refresh exception (Phase 1)', { error });
        this.phase1Session = null;
        return false;
      }
    }

    // Default: Full session manager mode
    try {
      const refreshToken = sessionManager.getCurrentRefreshToken();

      if (!refreshToken) {
        secureLogger.warn('No refresh token available');
        return false;
      }

      const client = supabaseClient.getClient();
      const { data, error } = await client.rpc('refresh_session_token', {
        p_refresh_token: refreshToken,
      });

      if (error) {
        secureLogger.error('Token refresh RPC error', { error });
        return false;
      }

      if (data?.success) {
        // Update session with new tokens
        await sessionManager.updateSessionTokens(
          data.session_token,
          data.refresh_token,
          data.expires_at
        );

        secureLogger.security('Token refresh successful');
        return true;
      }

      return false;
    } catch (error) {
      secureLogger.error('Token refresh exception', { error });
      return false;
    }
  }

  /**
   * Logs out user and clears session
   */
  async logout(): Promise<void> {
    await this.ensureInitialized();
    if (
      appConfig.useServerHashing ||
      (appConfig as any).disableClientEncryption
    ) {
      // Phase 2: clear secure store
      await secureSessionStore.clear();
      secureLogger.security('Logout (Phase 2)');
      this.phase1Session = null;
      return;
    }
    try {
      const sessionToken = sessionManager.getCurrentSessionToken();
      const currentUser = sessionManager.getCurrentUser();

      if (sessionToken && currentUser) {
        // Invalidate session on server
        const client = supabaseClient.getClient();
        await client.rpc('invalidate_session', {
          p_session_token: sessionToken,
        });

        // Log security event
        await this.logSecurityEvent(SecurityActionType.LOGOUT, true);
      }

      // Clear session from session manager
      await sessionManager.clearSession();

      secureLogger.security('Logout successful');
    } catch (error) {
      secureLogger.error('Logout error', { error });
      // Still clear local session even if server update fails
      await sessionManager.clearSession();
    }
  }

  /**
   * Clears all stored session data
   */
  private async clearSession(): Promise<void> {
    await sessionManager.clearSession();
  }

  // =====================================================
  // SECURITY LOGGING
  // =====================================================

  /**
   * Logs security events for audit purposes
   * NEVER logs sensitive data like maternal health IDs
   */
  private async logSecurityEvent(
    actionType: SecurityActionType,
    success: boolean,
    failureReason?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const sanitizedMetadata = metadata ? sanitizeForLogging(metadata) : null;
      const currentUser = sessionManager.getCurrentUser();

      const client = supabaseClient.getClient();
      // Use secured RPC instead of direct insert (table access is revoked)
      await client.rpc('log_audit_event', {
        p_action_type: actionType,
        p_success: success,
        p_failure_reason: failureReason ?? null,
        p_metadata: sanitizedMetadata,
        p_ip_address: null,
        p_user_agent: 'React Native App',
      });

      secureLogger.security('Security event logged', {
        action_type: actionType,
        success,
        failure_reason: failureReason,
      });
    } catch (error) {
      secureLogger.error('Failed to log security event', { error });
      // Don't throw here - logging failures shouldn't break the main flow
    }
  }

  // =====================================================
  // GETTERS
  // =====================================================

  /**
   * Gets current authenticated user
   */
  getCurrentUser(): PublicUserProfile | null {
    return sessionManager.getCurrentUser();
  }

  /**
   * Gets current session
   */
  getCurrentSession(): AuthSession | null {
    const sessionData = sessionManager.getCurrentSession();
    return sessionData?.session || null;
  }

  /**
   * Checks if user is authenticated
   */
  isAuthenticated(): boolean {
    return sessionManager.getCurrentUser() !== null;
  }

  /**
   * Checks if session needs refresh
   */
  async needsRefresh(): Promise<boolean> {
    await this.ensureInitialized();
    // Phase 2: secureSessionStore ベースで残り60分を閾値として判定
    if ((appConfig as any).disableClientEncryption === true) {
      try {
        return await secureSessionStore.needsRefresh(60);
      } catch (error) {
        secureLogger.error('Phase 2 needsRefresh check failed', { error });
        return false;
      }
    }

    if (appConfig.useServerHashing) {
      if (!this.phase1Session?.expiresAt) {
        return false;
      }
      const now = Date.now();
      const exp = new Date(this.phase1Session.expiresAt).getTime();
      return exp - now < 60 * 60 * 1000; // less than 60 minutes
    }
    return await sessionManager.needsRefresh();
  }

  /**
   * Gets service initialization status
   */
  getInitializationStatus() {
    return {
      authService: this.isInitialized,
      supabase: supabaseClient.getStats().isInitialized,
      encryption: encryptionService.getStats().isInitialized,
      sessionManager: sessionManager.getConfig().isInitialized,
    };
  }

  /**
   * Gets comprehensive service statistics
   */
  getServiceStats() {
    return {
      supabase: supabaseClient.getStats(),
      encryption: encryptionService.getStats(),
      sessionManager: sessionManager.getStats(),
      validation: validationService.getStats(),
    };
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const authService = new AuthService();

/**
 * Initialize the authentication service - should be called at app startup
 */
export const initializeAuthService = async (): Promise<void> => {
  await authService.initialize();
};

export default authService;
