/**
 * SECURE SESSION MANAGER
 *
 * CRITICAL SECURITY RULES:
 * 1. All session data must be encrypted before storage
 * 2. Implement automatic session expiry and cleanup
 * 3. Secure token refresh mechanism
 * 4. Session validation and integrity checks
 * 5. Comprehensive audit logging for all session operations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { PublicUserProfile, AuthSession, DeviceInfo } from '../types/auth';
import { encryptionService, EncryptedData } from './encryptionService';
import { secureLogger, sanitizeObject } from '../utils/privacyProtection';

// =====================================================
// TYPES AND INTERFACES
// =====================================================

/**
 * Stored session data structure
 */
interface StoredSessionData {
  user: PublicUserProfile;
  session: AuthSession;
  sessionToken: string;
  refreshToken: string;
  deviceInfo: DeviceInfo;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string;
}

/**
 * Encrypted session container
 */
interface EncryptedSession {
  encryptedData: EncryptedData;
  checksum: string;
  version: string;
  createdAt: string;
}

/**
 * Session validation result
 */
interface SessionValidation {
  isValid: boolean;
  reason?: string;
  shouldRefresh?: boolean;
  timeToExpiry?: number;
}

/**
 * Session statistics
 */
interface SessionStats {
  sessionsCreated: number;
  sessionsRestored: number;
  sessionsFailed: number;
  lastSessionTime: number | null;
  currentSessionAge: number | null;
}

// =====================================================
// CONSTANTS
// =====================================================

const STORAGE_KEYS = {
  ENCRYPTED_SESSION: 'mamapace_encrypted_session',
  SESSION_METADATA: 'mamapace_session_metadata',
  SESSION_CHECKSUM: 'mamapace_session_checksum',
  DEVICE_FINGERPRINT: 'mamapace_device_fingerprint',
} as const;

const SESSION_CONFIG = {
  VERSION: '1.0.0',
  MAX_SESSION_AGE_HOURS: 24,
  REFRESH_THRESHOLD_HOURS: 23, // Refresh 1 hour before expiry
  CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
  MAX_FAILED_ATTEMPTS: 3,
  INTEGRITY_CHECK_INTERVAL_MS: 10 * 60 * 1000, // 10 minutes
} as const;

// =====================================================
// SESSION MANAGER CLASS
// =====================================================

class SessionManager {
  private static instance: SessionManager;
  private currentSession: StoredSessionData | null = null;
  private isInitialized = false;
  private stats: SessionStats = {
    sessionsCreated: 0,
    sessionsRestored: 0,
    sessionsFailed: 0,
    lastSessionTime: null,
    currentSessionAge: null,
  };
  private cleanupInterval: NodeJS.Timeout | null = null;
  private integrityCheckInterval: NodeJS.Timeout | null = null;
  private deviceFingerprint: string | null = null;

  private constructor() {}

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  // =====================================================
  // INITIALIZATION
  // =====================================================

  /**
   * Initializes the session manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      secureLogger.info('Initializing session manager');

      // Initialize encryption service first
      await encryptionService.initialize();

      // Generate or load device fingerprint
      await this.initializeDeviceFingerprint();

      // Start background tasks
      this.startBackgroundTasks();

      // Try to restore existing session
      await this.restoreSession();

      this.isInitialized = true;
      secureLogger.info('Session manager initialized successfully');
    } catch (error) {
      secureLogger.error('Failed to initialize session manager', { error });
      throw new Error('Session manager initialization failed');
    }
  }

  /**
   * Initializes device fingerprint for session validation
   */
  private async initializeDeviceFingerprint(): Promise<void> {
    try {
      let fingerprint = await AsyncStorage.getItem(
        STORAGE_KEYS.DEVICE_FINGERPRINT
      );

      if (!fingerprint) {
        // Generate new device fingerprint
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2);
        fingerprint = await encryptionService.generateHash(
          `${timestamp}-${random}`
        );

        await AsyncStorage.setItem(
          STORAGE_KEYS.DEVICE_FINGERPRINT,
          fingerprint
        );
        secureLogger.info('Generated new device fingerprint');
      } else {
        secureLogger.debug('Loaded existing device fingerprint');
      }

      this.deviceFingerprint = fingerprint;
    } catch (error) {
      secureLogger.error('Failed to initialize device fingerprint', { error });
      throw error;
    }
  }

  /**
   * Starts background tasks for session maintenance
   */
  private startBackgroundTasks(): void {
    // Cleanup task
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.performMaintenance();
      } catch (error) {
        secureLogger.error('Session maintenance failed', { error });
      }
    }, SESSION_CONFIG.CLEANUP_INTERVAL_MS);

    // Integrity check task
    this.integrityCheckInterval = setInterval(async () => {
      try {
        if (this.currentSession) {
          const validation = await this.validateSession(this.currentSession);
          if (!validation.isValid) {
            secureLogger.security('Session integrity check failed', {
              reason: validation.reason,
            });
            await this.clearSession();
          }
        }
      } catch (error) {
        secureLogger.error('Session integrity check failed', { error });
      }
    }, SESSION_CONFIG.INTEGRITY_CHECK_INTERVAL_MS);

    secureLogger.debug('Background tasks started');
  }

  // =====================================================
  // SESSION CREATION AND STORAGE
  // =====================================================

  /**
   * Creates and stores a new session
   */
  async createSession(
    user: PublicUserProfile,
    sessionToken: string,
    refreshToken: string,
    expiresAt: string,
    deviceInfo: DeviceInfo
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      secureLogger.info('Creating new session', {
        userId: user.id,
        expiresAt,
        deviceType: deviceInfo.device_type,
      });

      const now = new Date().toISOString();

      // Create session data
      const sessionData: StoredSessionData = {
        user,
        session: {
          id: `session_${Date.now()}_${Math.random().toString(36).substring(2)}`,
          user_id: user.id,
          session_token: sessionToken,
          expires_at: expiresAt,
          created_at: now,
          last_used_at: now,
          device_info: deviceInfo,
          ip_address: null, // Would be set by server in real implementation
          is_active: true,
        },
        sessionToken,
        refreshToken,
        deviceInfo,
        createdAt: now,
        expiresAt,
        lastUsedAt: now,
      };

      // Encrypt and store session
      await this.storeEncryptedSession(sessionData);

      // Update current session
      this.currentSession = sessionData;
      this.stats.sessionsCreated++;
      this.stats.lastSessionTime = Date.now();
      this.stats.currentSessionAge = 0;

      secureLogger.security('Session created successfully', {
        sessionId: sessionData.session.id,
        userId: user.id,
        expiresAt,
      });
    } catch (error) {
      this.stats.sessionsFailed++;
      secureLogger.error('Failed to create session', { error });
      throw new Error('Session creation failed');
    }
  }

  /**
   * Encrypts and stores session data
   */
  private async storeEncryptedSession(
    sessionData: StoredSessionData
  ): Promise<void> {
    try {
      if (!this.deviceFingerprint) {
        throw new Error('Device fingerprint not initialized');
      }

      // Serialize session data
      const serializedData = JSON.stringify(sanitizeObject(sessionData));

      // Generate checksum for integrity
      const checksum = await encryptionService.generateHash(serializedData);

      // Encrypt session data using device fingerprint as key
      const encryptedData = await encryptionService.encrypt(
        serializedData,
        this.deviceFingerprint
      );

      // Create encrypted session container
      const encryptedSession: EncryptedSession = {
        encryptedData,
        checksum,
        version: SESSION_CONFIG.VERSION,
        createdAt: new Date().toISOString(),
      };

      // Store encrypted session
      await AsyncStorage.setItem(
        STORAGE_KEYS.ENCRYPTED_SESSION,
        JSON.stringify(encryptedSession)
      );

      secureLogger.debug('Session encrypted and stored successfully');
    } catch (error) {
      secureLogger.error('Failed to store encrypted session', { error });
      throw error;
    }
  }

  // =====================================================
  // SESSION RESTORATION AND VALIDATION
  // =====================================================

  /**
   * Restores session from encrypted storage
   */
  async restoreSession(): Promise<StoredSessionData | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      secureLogger.info('Restoring session from storage');

      const encryptedSession = await this.loadEncryptedSession();
      if (!encryptedSession) {
        secureLogger.debug('No stored session found');
        return null;
      }

      // Decrypt session data
      const sessionData = await this.decryptSession(encryptedSession);
      if (!sessionData) {
        secureLogger.warn('Failed to decrypt session data');
        return null;
      }

      // Validate session
      const validation = await this.validateSession(sessionData);
      if (!validation.isValid) {
        secureLogger.warn('Stored session is invalid', {
          reason: validation.reason,
        });
        await this.clearSession();
        return null;
      }

      // Update session usage
      sessionData.lastUsedAt = new Date().toISOString();
      await this.storeEncryptedSession(sessionData);

      // Update current session
      this.currentSession = sessionData;
      this.stats.sessionsRestored++;
      this.stats.lastSessionTime = Date.now();
      this.stats.currentSessionAge =
        Date.now() - new Date(sessionData.createdAt).getTime();

      secureLogger.security('Session restored successfully', {
        sessionId: sessionData.session.id,
        userId: sessionData.user.id,
        age: this.stats.currentSessionAge,
      });

      return sessionData;
    } catch (error) {
      this.stats.sessionsFailed++;
      secureLogger.error('Failed to restore session', { error });
      await this.clearSession();
      return null;
    }
  }

  /**
   * Loads encrypted session from storage
   */
  private async loadEncryptedSession(): Promise<EncryptedSession | null> {
    try {
      const storedData = await AsyncStorage.getItem(
        STORAGE_KEYS.ENCRYPTED_SESSION
      );
      if (!storedData) {
        return null;
      }

      const encryptedSession = JSON.parse(storedData) as EncryptedSession;

      // Validate version compatibility
      if (encryptedSession.version !== SESSION_CONFIG.VERSION) {
        secureLogger.warn('Incompatible session version', {
          stored: encryptedSession.version,
          current: SESSION_CONFIG.VERSION,
        });
        return null;
      }

      return encryptedSession;
    } catch (error) {
      secureLogger.error('Failed to load encrypted session', { error });
      return null;
    }
  }

  /**
   * Decrypts session data
   */
  private async decryptSession(
    encryptedSession: EncryptedSession
  ): Promise<StoredSessionData | null> {
    try {
      if (!this.deviceFingerprint) {
        throw new Error('Device fingerprint not initialized');
      }

      // Decrypt session data
      const decryptedData = await encryptionService.decrypt(
        encryptedSession.encryptedData,
        this.deviceFingerprint
      );

      // Verify checksum
      const isValid = await encryptionService.verifyHash(
        decryptedData,
        encryptedSession.checksum
      );

      if (!isValid) {
        secureLogger.security('Session checksum verification failed');
        return null;
      }

      // Parse session data
      const sessionData = JSON.parse(decryptedData) as StoredSessionData;

      secureLogger.debug('Session decrypted successfully');
      return sessionData;
    } catch (error) {
      secureLogger.error('Failed to decrypt session', { error });
      return null;
    }
  }

  /**
   * Validates session data and expiry
   */
  private async validateSession(
    sessionData: StoredSessionData
  ): Promise<SessionValidation> {
    try {
      const now = Date.now();
      const expiryTime = new Date(sessionData.expiresAt).getTime();
      const timeToExpiry = expiryTime - now;

      // Check if session is expired
      if (timeToExpiry <= 0) {
        return {
          isValid: false,
          reason: 'Session expired',
          timeToExpiry: 0,
        };
      }

      // Check if session needs refresh
      const refreshThreshold =
        SESSION_CONFIG.REFRESH_THRESHOLD_HOURS * 60 * 60 * 1000;
      const shouldRefresh = timeToExpiry < refreshThreshold;

      // Validate session structure
      if (
        !sessionData.user ||
        !sessionData.session ||
        !sessionData.sessionToken
      ) {
        return {
          isValid: false,
          reason: 'Invalid session structure',
        };
      }

      // Check session age
      const sessionAge = now - new Date(sessionData.createdAt).getTime();
      const maxAge = SESSION_CONFIG.MAX_SESSION_AGE_HOURS * 60 * 60 * 1000;

      if (sessionAge > maxAge) {
        return {
          isValid: false,
          reason: 'Session too old',
          timeToExpiry,
        };
      }

      return {
        isValid: true,
        shouldRefresh,
        timeToExpiry,
      };
    } catch (error) {
      secureLogger.error('Session validation error', { error });
      return {
        isValid: false,
        reason: 'Validation error',
      };
    }
  }

  // =====================================================
  // SESSION ACCESS AND MANAGEMENT
  // =====================================================

  /**
   * Gets current session data
   */
  getCurrentSession(): StoredSessionData | null {
    if (!this.currentSession) {
      return null;
    }

    // Update last used time
    this.currentSession.lastUsedAt = new Date().toISOString();
    this.currentSession.session.last_used_at = this.currentSession.lastUsedAt;

    // Store updated session asynchronously
    this.storeEncryptedSession(this.currentSession).catch(error => {
      secureLogger.error('Failed to update session usage', { error });
    });

    return this.currentSession;
  }

  /**
   * Gets current user from session
   */
  getCurrentUser(): PublicUserProfile | null {
    return this.currentSession?.user || null;
  }

  /**
   * Gets current session token
   */
  getCurrentSessionToken(): string | null {
    return this.currentSession?.sessionToken || null;
  }

  /**
   * Gets current refresh token
   */
  getCurrentRefreshToken(): string | null {
    return this.currentSession?.refreshToken || null;
  }

  /**
   * Checks if session is valid and not expired
   */
  async isSessionValid(): Promise<boolean> {
    if (!this.currentSession) {
      return false;
    }

    const validation = await this.validateSession(this.currentSession);
    return validation.isValid;
  }

  /**
   * Checks if session needs refresh
   */
  async needsRefresh(): Promise<boolean> {
    if (!this.currentSession) {
      return false;
    }

    const validation = await this.validateSession(this.currentSession);
    return validation.isValid && (validation.shouldRefresh || false);
  }

  // =====================================================
  // SESSION UPDATE AND REFRESH
  // =====================================================

  /**
   * Updates session tokens after refresh
   */
  async updateSessionTokens(
    newSessionToken: string,
    newRefreshToken: string,
    newExpiresAt: string
  ): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No current session to update');
    }

    try {
      secureLogger.info('Updating session tokens');

      // Update session data
      this.currentSession.sessionToken = newSessionToken;
      this.currentSession.refreshToken = newRefreshToken;
      this.currentSession.expiresAt = newExpiresAt;
      this.currentSession.session.session_token = newSessionToken;
      this.currentSession.session.expires_at = newExpiresAt;
      this.currentSession.lastUsedAt = new Date().toISOString();

      // Store updated session
      await this.storeEncryptedSession(this.currentSession);

      secureLogger.security('Session tokens updated successfully', {
        sessionId: this.currentSession.session.id,
        newExpiresAt,
      });
    } catch (error) {
      secureLogger.error('Failed to update session tokens', { error });
      throw new Error('Session token update failed');
    }
  }

  /**
   * Updates user profile in session
   */
  async updateUserProfile(updatedUser: PublicUserProfile): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No current session to update');
    }

    try {
      secureLogger.info('Updating user profile in session', {
        userId: updatedUser.id,
      });

      // Update user data
      this.currentSession.user = updatedUser;
      this.currentSession.lastUsedAt = new Date().toISOString();

      // Store updated session
      await this.storeEncryptedSession(this.currentSession);

      secureLogger.debug('User profile updated in session');
    } catch (error) {
      secureLogger.error('Failed to update user profile', { error });
      throw error;
    }
  }

  // =====================================================
  // SESSION CLEANUP
  // =====================================================

  /**
   * Clears current session
   */
  async clearSession(): Promise<void> {
    try {
      secureLogger.info('Clearing session');

      if (this.currentSession) {
        secureLogger.security('Session cleared', {
          sessionId: this.currentSession.session.id,
          userId: this.currentSession.user.id,
        });
      }

      // Clear from storage
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.ENCRYPTED_SESSION),
        AsyncStorage.removeItem(STORAGE_KEYS.SESSION_METADATA),
        AsyncStorage.removeItem(STORAGE_KEYS.SESSION_CHECKSUM),
      ]);

      // Clear from memory
      this.currentSession = null;
      this.stats.currentSessionAge = null;

      secureLogger.info('Session cleared successfully');
    } catch (error) {
      secureLogger.error('Failed to clear session', { error });
      throw error;
    }
  }

  /**
   * Performs maintenance tasks
   */
  private async performMaintenance(): Promise<void> {
    try {
      secureLogger.debug('Performing session maintenance');

      // Check if current session is valid
      if (this.currentSession) {
        const validation = await this.validateSession(this.currentSession);
        if (!validation.isValid) {
          secureLogger.info('Expired session detected during maintenance', {
            reason: validation.reason,
          });
          await this.clearSession();
        } else {
          // Update session age
          this.stats.currentSessionAge =
            Date.now() - new Date(this.currentSession.createdAt).getTime();
        }
      }

      secureLogger.debug('Session maintenance completed');
    } catch (error) {
      secureLogger.error('Session maintenance failed', { error });
    }
  }

  // =====================================================
  // CLEANUP AND SHUTDOWN
  // =====================================================

  /**
   * Stops background tasks and cleanup
   */
  async shutdown(): Promise<void> {
    try {
      secureLogger.info('Shutting down session manager');

      // Stop background tasks
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      if (this.integrityCheckInterval) {
        clearInterval(this.integrityCheckInterval);
        this.integrityCheckInterval = null;
      }

      // Clear current session
      this.currentSession = null;
      this.isInitialized = false;

      secureLogger.info('Session manager shutdown completed');
    } catch (error) {
      secureLogger.error('Failed to shutdown session manager', { error });
    }
  }

  /**
   * Gets session manager statistics
   */
  getStats(): SessionStats {
    return { ...this.stats };
  }

  /**
   * Gets session manager configuration
   */
  getConfig() {
    return {
      version: SESSION_CONFIG.VERSION,
      maxSessionAgeHours: SESSION_CONFIG.MAX_SESSION_AGE_HOURS,
      refreshThresholdHours: SESSION_CONFIG.REFRESH_THRESHOLD_HOURS,
      isInitialized: this.isInitialized,
    };
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const sessionManager = SessionManager.getInstance();

/**
 * Initialize the session manager - should be called at app startup
 */
export const initializeSessionManager = async (): Promise<void> => {
  await sessionManager.initialize();
};

export default sessionManager;
