/**
 * AUTHENTICATION SERVICE INTEGRATION TESTS
 * 
 * Tests the integration between AuthService and all dependent services:
 * - EncryptionService coordination
 * - ValidationService integration
 * - SessionManager functionality
 * - SupabaseClient database operations
 */

import { authService } from '../../services/authService';
import { encryptionService } from '../../services/encryptionService';
import { validationService } from '../../services/validationService';
import { sessionManager } from '../../services/sessionManager';
import { supabaseClient } from '../../services/supabaseClient';
import {
  REGISTRATION_REQUESTS,
  LOGIN_REQUESTS,
  TEST_USERS,
  ENCRYPTED_TEST_IDS,
  TEST_UTILITIES,
  SECURITY_TEST_SCENARIOS,
  PERFORMANCE_TEST_DATA,
} from '../fixtures/testData';
import { AuthResponse, AuthErrorCode } from '../../types/auth';

describe('AuthService Integration Tests', () => {
  beforeEach(async () => {
    // Reset all services before each test
    jest.clearAllMocks();
    
    // Mock successful service initialization
    (encryptionService.initialize as jest.Mock).mockResolvedValue(undefined);
    (validationService.initialize as jest.Mock).mockResolvedValue(undefined);
    (sessionManager.initialize as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Validate no sensitive data is exposed
    TEST_UTILITIES.validateNoSensitiveDataExposed(expect.getState());
  });

  describe('Service Initialization Integration', () => {
    it('should initialize all services in correct order', async () => {
      const initSpy = jest.spyOn(authService, 'initialize');
      
      await authService.initialize();
      
      expect(initSpy).toHaveBeenCalled();
      expect(encryptionService.initialize).toHaveBeenCalled();
      expect(sessionManager.initialize).toHaveBeenCalled();
    });

    it('should handle service initialization failures gracefully', async () => {
      (encryptionService.initialize as jest.Mock).mockRejectedValue(new Error('Encryption init failed'));
      
      await expect(authService.initialize()).rejects.toThrow('Authentication service initialization failed');
    });

    it('should prevent operations before initialization', async () => {
      const uninitializedService = new (authService.constructor as any)();
      
      const result = await uninitializedService.register(REGISTRATION_REQUESTS.VALID_REGISTRATION);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('初期化されていません');
    });
  });

  describe('Registration Flow Integration', () => {
    beforeEach(async () => {
      await authService.initialize();
      
      // Mock successful validation
      (validationService.validateMaternalHealthId as jest.Mock).mockResolvedValue({
        isValid: true,
        isUnique: true,
      });
      
      (validationService.validateUsername as jest.Mock).mockResolvedValue({
        isValid: true,
        isUnique: true,
      });
      
      (validationService.validatePassword as jest.Mock).mockReturnValue({
        isValid: true,
        score: 4,
        feedback: [],
      });
      
      // Mock successful encryption
      (encryptionService.encryptMaternalHealthId as jest.Mock).mockReturnValue(
        ENCRYPTED_TEST_IDS.VALID_ENCRYPTED_1
      );
      
      // Mock successful database insertion
      (supabaseClient.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [TEST_USERS.VALID_USER_1],
            error: null,
          }),
        }),
      });
      
      // Mock successful session creation
      (sessionManager.createSession as jest.Mock).mockResolvedValue({
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    });

    it('should complete full registration flow successfully', async () => {
      const result = await authService.register(REGISTRATION_REQUESTS.VALID_REGISTRATION);
      
      expect(result.success).toBe(true);
      expect(result.user).toEqual(TEST_USERS.VALID_USER_1);
      
      // Verify service integration
      expect(validationService.validateMaternalHealthId).toHaveBeenCalled();
      expect(validationService.validateUsername).toHaveBeenCalled();
      expect(validationService.validatePassword).toHaveBeenCalled();
      expect(encryptionService.encryptMaternalHealthId).toHaveBeenCalled();
      expect(supabaseClient.from).toHaveBeenCalledWith('users');
      expect(sessionManager.createSession).toHaveBeenCalled();
    });

    it('should handle validation service failures', async () => {
      (validationService.validateMaternalHealthId as jest.Mock).mockResolvedValue({
        isValid: false,
        error: '無効な母子健康手帳番号です',
      });
      
      const result = await authService.register(REGISTRATION_REQUESTS.VALID_REGISTRATION);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('無効な母子健康手帳番号です');
      
      // Should not proceed to encryption or database operations
      expect(encryptionService.encryptMaternalHealthId).not.toHaveBeenCalled();
      expect(supabaseClient.from).not.toHaveBeenCalled();
    });

    it('should handle encryption service failures', async () => {
      (encryptionService.encryptMaternalHealthId as jest.Mock).mockImplementation(() => {
        throw new Error('Encryption failed');
      });
      
      const result = await authService.register(REGISTRATION_REQUESTS.VALID_REGISTRATION);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('暗号化');
    });

    it('should handle database service failures', async () => {
      (supabaseClient.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error', code: '23505' },
          }),
        }),
      });
      
      const result = await authService.register(REGISTRATION_REQUESTS.VALID_REGISTRATION);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(AuthErrorCode.DUPLICATE_USERNAME);
    });

    it('should handle session creation failures', async () => {
      (sessionManager.createSession as jest.Mock).mockRejectedValue(
        new Error('Session creation failed')
      );
      
      const result = await authService.register(REGISTRATION_REQUESTS.VALID_REGISTRATION);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('セッション');
    });
  });

  describe('Login Flow Integration', () => {
    beforeEach(async () => {
      await authService.initialize();
      
      // Mock successful database lookup
      (supabaseClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                ...TEST_USERS.VALID_USER_1,
                encrypted_maternal_health_id: ENCRYPTED_TEST_IDS.VALID_ENCRYPTED_1,
                password_hash: 'mock_password_hash',
              },
              error: null,
            }),
          }),
        }),
      });
      
      // Mock successful password verification
      (encryptionService.verifyPassword as jest.Mock).mockResolvedValue(true);
      
      // Mock successful session creation
      (sessionManager.createSession as jest.Mock).mockResolvedValue({
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    });

    it('should complete full login flow successfully', async () => {
      const result = await authService.login(LOGIN_REQUESTS.VALID_LOGIN);
      
      expect(result.success).toBe(true);
      expect(result.user).toEqual(TEST_USERS.VALID_USER_1);
      
      // Verify service integration
      expect(supabaseClient.from).toHaveBeenCalledWith('users');
      expect(encryptionService.verifyPassword).toHaveBeenCalled();
      expect(sessionManager.createSession).toHaveBeenCalled();
    });

    it('should handle user not found', async () => {
      (supabaseClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }, // Not found
            }),
          }),
        }),
      });
      
      const result = await authService.login(LOGIN_REQUESTS.NONEXISTENT_USER);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(AuthErrorCode.INVALID_CREDENTIALS);
    });

    it('should handle password verification failure', async () => {
      (encryptionService.verifyPassword as jest.Mock).mockResolvedValue(false);
      
      const result = await authService.login(LOGIN_REQUESTS.INVALID_PASSWORD);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(AuthErrorCode.INVALID_CREDENTIALS);
    });

    it('should handle account lockout', async () => {
      // Mock failed login attempts
      (sessionManager.getFailedLoginAttempts as jest.Mock).mockResolvedValue(5);
      
      const result = await authService.login(LOGIN_REQUESTS.VALID_LOGIN);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(AuthErrorCode.ACCOUNT_LOCKED);
    });
  });

  describe('Session Management Integration', () => {
    beforeEach(async () => {
      await authService.initialize();
    });

    it('should restore session successfully', async () => {
      (sessionManager.getStoredSession as jest.Mock).mockResolvedValue({
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        user: TEST_USERS.VALID_USER_1,
      });
      
      (sessionManager.isSessionValid as jest.Mock).mockResolvedValue(true);
      
      const user = await authService.loadSession();
      
      expect(user).toEqual(TEST_USERS.VALID_USER_1);
      expect(sessionManager.getStoredSession).toHaveBeenCalled();
      expect(sessionManager.isSessionValid).toHaveBeenCalled();
    });

    it('should handle expired sessions', async () => {
      (sessionManager.getStoredSession as jest.Mock).mockResolvedValue({
        access_token: 'expired_token',
        expires_at: new Date(Date.now() - 1000).toISOString(),
      });
      
      (sessionManager.isSessionValid as jest.Mock).mockResolvedValue(false);
      
      const user = await authService.loadSession();
      
      expect(user).toBeNull();
      expect(sessionManager.clearSession).toHaveBeenCalled();
    });

    it('should refresh tokens when needed', async () => {
      (sessionManager.needsRefresh as jest.Mock).mockResolvedValue(true);
      (sessionManager.refreshSession as jest.Mock).mockResolvedValue({
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      
      const success = await authService.refreshToken();
      
      expect(success).toBe(true);
      expect(sessionManager.refreshSession).toHaveBeenCalled();
    });
  });

  describe('Security Integration Tests', () => {
    beforeEach(async () => {
      await authService.initialize();
    });

    it('should protect against brute force attacks', async () => {
      // Mock failed attempts
      (sessionManager.getFailedLoginAttempts as jest.Mock).mockResolvedValue(6);
      
      const result = await authService.login(LOGIN_REQUESTS.VALID_LOGIN);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(AuthErrorCode.ACCOUNT_LOCKED);
      expect(sessionManager.recordFailedAttempt).toHaveBeenCalled();
    });

    it('should sanitize input data', async () => {
      const maliciousRequest = {
        username: SECURITY_TEST_SCENARIOS.SQL_INJECTION.username,
        password: SECURITY_TEST_SCENARIOS.SQL_INJECTION.password,
      };
      
      await authService.login(maliciousRequest);
      
      // Verify that input validation was called
      expect(validationService.sanitizeInput).toHaveBeenCalledWith(maliciousRequest.username);
    });

    it('should never expose maternal health IDs', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      await authService.register(REGISTRATION_REQUESTS.VALID_REGISTRATION);
      
      // Verify no console logs contain sensitive data
      consoleSpy.mock.calls.forEach(call => {
        const message = call.join(' ');
        expect(message).not.toMatch(/\b\d{10}\b/);
        expect(message).not.toContain('maternal_health_id');
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Performance Integration Tests', () => {
    beforeEach(async () => {
      await authService.initialize();
      
      // Setup successful mocks for performance testing
      (validationService.validateMaternalHealthId as jest.Mock).mockResolvedValue({
        isValid: true,
        isUnique: true,
      });
      
      (validationService.validateUsername as jest.Mock).mockResolvedValue({
        isValid: true,
        isUnique: true,
      });
      
      (encryptionService.encryptMaternalHealthId as jest.Mock).mockReturnValue(
        ENCRYPTED_TEST_IDS.VALID_ENCRYPTED_1
      );
      
      (supabaseClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: TEST_USERS.VALID_USER_1,
              error: null,
            }),
          }),
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [TEST_USERS.VALID_USER_1],
            error: null,
          }),
        }),
      });
      
      (sessionManager.createSession as jest.Mock).mockResolvedValue({
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    });

    it('should complete registration within performance targets', async () => {
      const { duration } = await global.measurePerformance(
        () => authService.register(REGISTRATION_REQUESTS.VALID_REGISTRATION),
        PERFORMANCE_TEST_DATA.TARGET_RESPONSE_TIMES.REGISTRATION
      );
      
      expect(duration).toBeLessThan(PERFORMANCE_TEST_DATA.TARGET_RESPONSE_TIMES.REGISTRATION);
    });

    it('should complete login within performance targets', async () => {
      (encryptionService.verifyPassword as jest.Mock).mockResolvedValue(true);
      
      const { duration } = await global.measurePerformance(
        () => authService.login(LOGIN_REQUESTS.VALID_LOGIN),
        PERFORMANCE_TEST_DATA.TARGET_RESPONSE_TIMES.LOGIN
      );
      
      expect(duration).toBeLessThan(PERFORMANCE_TEST_DATA.TARGET_RESPONSE_TIMES.LOGIN);
    });

    it('should handle concurrent operations efficiently', async () => {
      const promises = Array(PERFORMANCE_TEST_DATA.CONCURRENT_USERS).fill(null).map((_, index) => 
        authService.register({
          ...REGISTRATION_REQUESTS.VALID_REGISTRATION,
          username: `concurrent_user_${index}`,
        })
      );
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Error Recovery Integration', () => {
    beforeEach(async () => {
      await authService.initialize();
    });

    it('should recover from network failures', async () => {
      // First call fails
      (supabaseClient.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('Network error')),
          }),
        }),
      });
      
      // Second call succeeds
      (supabaseClient.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: TEST_USERS.VALID_USER_1,
              error: null,
            }),
          }),
        }),
      });
      
      (encryptionService.verifyPassword as jest.Mock).mockResolvedValue(true);
      (sessionManager.createSession as jest.Mock).mockResolvedValue({
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      
      // First attempt should fail
      const firstResult = await authService.login(LOGIN_REQUESTS.VALID_LOGIN);
      expect(firstResult.success).toBe(false);
      
      // Second attempt should succeed
      const secondResult = await authService.login(LOGIN_REQUESTS.VALID_LOGIN);
      expect(secondResult.success).toBe(true);
    });

    it('should handle partial service failures gracefully', async () => {
      (sessionManager.createSession as jest.Mock).mockRejectedValue(
        new Error('Session service unavailable')
      );
      
      const result = await authService.register(REGISTRATION_REQUESTS.VALID_REGISTRATION);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('セッション');
    });
  });
});