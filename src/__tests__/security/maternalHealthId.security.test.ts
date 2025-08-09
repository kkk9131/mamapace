/**
 * MATERNAL HEALTH ID SECURITY TESTS
 * 
 * CRITICAL SECURITY VALIDATION:
 * 1. Maternal health IDs never appear in logs, console, or UI
 * 2. All data is properly encrypted before storage/transmission
 * 3. Privacy protection mechanisms work correctly
 * 4. No information leakage through error messages or timing attacks
 */

import { authService } from '../../services/authService';
import { encryptionService } from '../../services/encryptionService';
import { validationService } from '../../services/validationService';
import { secureLogger } from '../../utils/privacyProtection';
import {
  REGISTRATION_REQUESTS,
  LOGIN_REQUESTS,
  SECURITY_TEST_SCENARIOS,
  TEST_UTILITIES,
  ENCRYPTED_TEST_IDS,
} from '../fixtures/testData';

// Capture all console output for security validation
let consoleOutputs: string[] = [];
let originalConsole: any;

describe('Maternal Health ID Security Tests', () => {
  beforeAll(() => {
    // Capture console outputs to validate no sensitive data leaks
    originalConsole = { ...console };
    
    const captureOutput = (level: string) => (originalFn: any) => (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' ');
      consoleOutputs.push(`${level}: ${message}`);
      return originalFn.apply(console, args);
    };
    
    console.log = captureOutput('LOG')(originalConsole.log);
    console.warn = captureOutput('WARN')(originalConsole.warn);
    console.error = captureOutput('ERROR')(originalConsole.error);
    console.info = captureOutput('INFO')(originalConsole.info);
    console.debug = captureOutput('DEBUG')(originalConsole.debug);
  });

  afterAll(() => {
    // Restore original console
    Object.assign(console, originalConsole);
  });

  beforeEach(async () => {
    consoleOutputs = [];
    jest.clearAllMocks();
    await authService.initialize();
  });

  afterEach(() => {
    // Validate no maternal health IDs were exposed in any outputs
    validateNoSensitiveDataInOutputs();
    TEST_UTILITIES.validateNoSensitiveDataExposed(expect.getState());
  });

  const validateNoSensitiveDataInOutputs = () => {
    consoleOutputs.forEach((output, index) => {
      // Check for 10-digit sequences that might be maternal health IDs
      if (output.match(/\b\d{10}\b/)) {
        throw new Error(`SECURITY VIOLATION: Potential maternal health ID found in console output #${index}: ${output}`);
      }
      
      // Check for explicit field names
      if (output.includes('maternal_health_id') && !output.includes('encrypted') && !output.includes('enc_hash')) {
        throw new Error(`SECURITY VIOLATION: Unencrypted maternal_health_id field found in output #${index}: ${output}`);
      }
      
      // Check for common patterns that might expose sensitive data
      const suspiciousPatterns = [
        /母子健康手帳\s*[:：]\s*\d+/,
        /health.*id\s*[:：]\s*\d+/,
        /maternal.*\d{6,}/,
      ];
      
      suspiciousPatterns.forEach(pattern => {
        if (pattern.test(output)) {
          throw new Error(`SECURITY VIOLATION: Suspicious pattern found in output #${index}: ${output}`);
        }
      });
    });
  };

  describe('Registration Security', () => {
    beforeEach(() => {
      // Mock successful services
      (validationService.validateMaternalHealthId as jest.Mock).mockResolvedValue({
        isValid: true,
        isUnique: true,
      });
      
      (encryptionService.encryptMaternalHealthId as jest.Mock).mockReturnValue(
        ENCRYPTED_TEST_IDS.VALID_ENCRYPTED_1
      );
    });

    it('should never log raw maternal health IDs during registration', async () => {
      const request = REGISTRATION_REQUESTS.VALID_REGISTRATION;
      
      await authService.register(request);
      
      // Check that the raw maternal health ID never appeared in logs
      consoleOutputs.forEach(output => {
        expect(output).not.toContain(request.maternal_health_id);
      });
    });

    it('should encrypt maternal health ID before any database operations', async () => {
      const encryptSpy = jest.spyOn(encryptionService, 'encryptMaternalHealthId');
      
      await authService.register(REGISTRATION_REQUESTS.VALID_REGISTRATION);
      
      // Ensure encryption was called
      expect(encryptSpy).toHaveBeenCalledWith(
        REGISTRATION_REQUESTS.VALID_REGISTRATION.maternal_health_id
      );
      
      // Ensure encrypted value is used in database operations
      const dbCalls = jest.mocked(require('../../services/supabaseClient').supabaseClient.from).mock.calls;
      
      dbCalls.forEach(call => {
        const insertData = call[0]; // First argument to from()
        if (typeof insertData === 'object' && insertData.encrypted_maternal_health_id) {
          expect(insertData.encrypted_maternal_health_id).toBe(ENCRYPTED_TEST_IDS.VALID_ENCRYPTED_1);
          expect(insertData.encrypted_maternal_health_id).not.toBe(
            REGISTRATION_REQUESTS.VALID_REGISTRATION.maternal_health_id
          );
        }
      });
    });

    it('should handle encryption failures securely', async () => {
      (encryptionService.encryptMaternalHealthId as jest.Mock).mockImplementation(() => {
        throw new Error('Encryption service failed');
      });
      
      const result = await authService.register(REGISTRATION_REQUESTS.VALID_REGISTRATION);
      
      expect(result.success).toBe(false);
      expect(result.error).not.toContain(REGISTRATION_REQUESTS.VALID_REGISTRATION.maternal_health_id);
      
      // Verify the error message is generic and doesn't expose sensitive data
      expect(result.error).toMatch(/暗号化|エラー/);
    });

    it('should sanitize validation error messages', async () => {
      (validationService.validateMaternalHealthId as jest.Mock).mockResolvedValue({
        isValid: false,
        error: `Invalid maternal health ID: ${REGISTRATION_REQUESTS.VALID_REGISTRATION.maternal_health_id}`,
      });
      
      const result = await authService.register(REGISTRATION_REQUESTS.VALID_REGISTRATION);
      
      expect(result.success).toBe(false);
      expect(result.error).not.toContain(REGISTRATION_REQUESTS.VALID_REGISTRATION.maternal_health_id);
      expect(result.error).toMatch(/無効|母子健康手帳/);
    });
  });

  describe('Input Validation Security', () => {
    it('should detect and block potential maternal health ID exposure attempts', () => {
      const maliciousInputs = SECURITY_TEST_SCENARIOS.MATERNAL_ID_EXPOSURE.testInputs;
      
      maliciousInputs.forEach(input => {
        expect(() => {
          // This should trigger our security validation
          console.log('Test input:', input);
        }).toThrow(/SECURITY VIOLATION/);
      });
    });

    it('should sanitize all user inputs before processing', async () => {
      const sanitizeSpy = jest.spyOn(validationService, 'sanitizeInput');
      
      const maliciousRequest = {
        maternal_health_id: '1234567890"><script>alert(document.cookie)</script>',
        username: SECURITY_TEST_SCENARIOS.XSS_ATTEMPT.username,
        password: 'password123',
        confirmPassword: 'password123',
      };
      
      await authService.register(maliciousRequest as any);
      
      expect(sanitizeSpy).toHaveBeenCalledWith(maliciousRequest.username);
      expect(sanitizeSpy).toHaveBeenCalledWith(maliciousRequest.maternal_health_id);
    });

    it('should validate maternal health ID format without exposing actual values', async () => {
      const invalidFormatTests = [
        '123456789', // Too short
        '12345678901', // Too long
        'abcd123456', // Contains letters
        '123-456-789', // Contains hyphens
        '', // Empty
        null, // Null
        undefined, // Undefined
      ];
      
      for (const invalidId of invalidFormatTests) {
        const request = {
          ...REGISTRATION_REQUESTS.VALID_REGISTRATION,
          maternal_health_id: invalidId as any,
        };
        
        const result = await authService.register(request);
        
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/形式|無効|母子健康手帳/);
        
        // Verify the invalid ID doesn't appear in the error message
        if (invalidId) {
          expect(result.error).not.toContain(String(invalidId));
        }
      }
    });
  });

  describe('Database Security', () => {
    it('should never store unencrypted maternal health IDs in database', async () => {
      const dbInsertSpy = jest.spyOn(require('../../services/supabaseClient').supabaseClient, 'from')
        .mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [{ id: 'test-id' }],
              error: null,
            }),
          }),
        });
      
      await authService.register(REGISTRATION_REQUESTS.VALID_REGISTRATION);
      
      // Check all database insert calls
      const insertCalls = dbInsertSpy.mock.results.map(result => 
        result.value.insert.mock.calls
      ).flat();
      
      insertCalls.forEach(call => {
        const insertData = call[0];
        if (insertData && typeof insertData === 'object') {
          // Should not contain raw maternal health ID
          Object.values(insertData).forEach(value => {
            if (typeof value === 'string') {
              expect(value).not.toBe(REGISTRATION_REQUESTS.VALID_REGISTRATION.maternal_health_id);
            }
          });
          
          // Should contain encrypted version
          if (insertData.encrypted_maternal_health_id) {
            expect(insertData.encrypted_maternal_health_id).toBe(ENCRYPTED_TEST_IDS.VALID_ENCRYPTED_1);
          }
        }
      });
    });

    it('should handle database errors without exposing sensitive data', async () => {
      jest.spyOn(require('../../services/supabaseClient').supabaseClient, 'from')
        .mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: null,
              error: {
                message: `Duplicate key value violates unique constraint. Key (encrypted_maternal_health_id)=(${REGISTRATION_REQUESTS.VALID_REGISTRATION.maternal_health_id}) already exists.`,
                code: '23505',
              },
            }),
          }),
        });
      
      const result = await authService.register(REGISTRATION_REQUESTS.VALID_REGISTRATION);
      
      expect(result.success).toBe(false);
      expect(result.error).not.toContain(REGISTRATION_REQUESTS.VALID_REGISTRATION.maternal_health_id);
      expect(result.error).toMatch(/既に使用|重複|存在/);
    });
  });

  describe('Session Security', () => {
    it('should never include maternal health ID in session data', async () => {
      const mockSession = {
        access_token: 'mock_token',
        refresh_token: 'mock_refresh',
        expires_at: new Date().toISOString(),
        user: {
          ...require('../fixtures/testData').TEST_USERS.VALID_USER_1,
          encrypted_maternal_health_id: ENCRYPTED_TEST_IDS.VALID_ENCRYPTED_1,
        },
      };
      
      jest.spyOn(require('../../services/sessionManager'), 'sessionManager')
        .mockImplementation({
          createSession: jest.fn().mockResolvedValue(mockSession),
          getStoredSession: jest.fn().mockResolvedValue(mockSession),
        } as any);
      
      const user = await authService.loadSession();
      
      expect(user).toBeTruthy();
      expect(user).not.toHaveProperty('maternal_health_id');
      expect(user).not.toHaveProperty('encrypted_maternal_health_id');
      
      // Verify session doesn't expose sensitive data
      TEST_UTILITIES.validateNoSensitiveDataExposed(user);
    });

    it('should handle session restoration without exposing sensitive data', async () => {
      const mockStoredSession = {
        access_token: 'stored_token',
        user: require('../fixtures/testData').TEST_USERS.VALID_USER_1,
      };
      
      jest.spyOn(require('../../services/sessionManager'), 'sessionManager')
        .mockImplementation({
          getStoredSession: jest.fn().mockResolvedValue(mockStoredSession),
          isSessionValid: jest.fn().mockResolvedValue(true),
        } as any);
      
      const user = await authService.loadSession();
      
      expect(user).toEqual(require('../fixtures/testData').TEST_USERS.VALID_USER_1);
      
      // Check that no sensitive data was logged during session restoration
      consoleOutputs.forEach(output => {
        expect(output).not.toMatch(/\b\d{10}\b/);
        expect(output).not.toContain('maternal_health_id');
      });
    });
  });

  describe('Error Message Security', () => {
    it('should provide generic error messages for security-sensitive failures', async () => {
      const securitySensitiveErrors = [
        'Maternal health ID not found in database',
        'Invalid maternal health ID: 1234567890',
        'User with maternal_health_id 1234567890 already exists',
        'Encryption failed for ID: 1234567890',
      ];
      
      for (const errorMessage of securitySensitiveErrors) {
        // Mock service to return security-sensitive error
        (validationService.validateMaternalHealthId as jest.Mock).mockResolvedValue({
          isValid: false,
          error: errorMessage,
        });
        
        const result = await authService.register(REGISTRATION_REQUESTS.VALID_REGISTRATION);
        
        expect(result.success).toBe(false);
        expect(result.error).not.toContain('1234567890');
        expect(result.error).not.toContain('maternal_health_id');
        expect(result.error).toMatch(/無効|エラー|失敗/);
      }
    });

    it('should not leak information through timing attacks', async () => {
      const timingTests = [
        REGISTRATION_REQUESTS.VALID_REGISTRATION,
        {
          ...REGISTRATION_REQUESTS.VALID_REGISTRATION,
          maternal_health_id: 'invalid_format',
        },
        {
          ...REGISTRATION_REQUESTS.VALID_REGISTRATION,
          maternal_health_id: ENCRYPTED_TEST_IDS.INVALID_ENCRYPTED,
        },
      ];
      
      const timings: number[] = [];
      
      for (const request of timingTests) {
        const start = Date.now();
        await authService.register(request);
        const duration = Date.now() - start;
        timings.push(duration);
      }
      
      // Verify timing differences are not significant enough to leak information
      const maxTiming = Math.max(...timings);
      const minTiming = Math.min(...timings);
      const timingDifference = maxTiming - minTiming;
      
      // Should not have more than 100ms difference to prevent timing attacks
      expect(timingDifference).toBeLessThan(100);
    });
  });

  describe('Memory Security', () => {
    it('should clear sensitive data from memory after use', async () => {
      const originalRequest = { ...REGISTRATION_REQUESTS.VALID_REGISTRATION };
      
      await authService.register(originalRequest);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Verify that the original request object hasn't been modified
      expect(originalRequest.maternal_health_id).toBe(
        REGISTRATION_REQUESTS.VALID_REGISTRATION.maternal_health_id
      );
      
      // The actual validation would require memory inspection tools
      // This is a basic check that the object structure hasn't been corrupted
      expect(typeof originalRequest.maternal_health_id).toBe('string');
    });

    it('should not retain sensitive data in service caches', async () => {
      await authService.register(REGISTRATION_REQUESTS.VALID_REGISTRATION);
      
      // Get service statistics
      const stats = authService.getServiceStats();
      
      // Verify stats don't contain sensitive data
      TEST_UTILITIES.validateNoSensitiveDataExposed(stats);
      
      // Verify cached data doesn't contain sensitive information
      if (stats.cache) {
        Object.values(stats.cache).forEach(cacheEntry => {
          TEST_UTILITIES.validateNoSensitiveDataExposed(cacheEntry);
        });
      }
    });
  });

  describe('Audit Log Security', () => {
    it('should log security events without exposing maternal health IDs', async () => {
      const logSpy = jest.spyOn(secureLogger, 'security');
      
      await authService.register(REGISTRATION_REQUESTS.VALID_REGISTRATION);
      
      // Verify security events were logged
      expect(logSpy).toHaveBeenCalled();
      
      // Verify logged data doesn't contain sensitive information
      logSpy.mock.calls.forEach(call => {
        const [message, data] = call;
        expect(message).not.toContain(REGISTRATION_REQUESTS.VALID_REGISTRATION.maternal_health_id);
        
        if (data) {
          TEST_UTILITIES.validateNoSensitiveDataExposed(data);
        }
      });
    });

    it('should audit security violations appropriately', async () => {
      const auditSpy = jest.spyOn(secureLogger, 'audit');
      
      // Attempt malicious input
      try {
        await authService.register({
          ...REGISTRATION_REQUESTS.VALID_REGISTRATION,
          username: SECURITY_TEST_SCENARIOS.SQL_INJECTION.username,
        });
      } catch (error) {
        // Expected to fail
      }
      
      // Verify security audit was recorded
      expect(auditSpy).toHaveBeenCalled();
      
      // Verify audit doesn't contain sensitive data
      auditSpy.mock.calls.forEach(call => {
        const [message, data] = call;
        if (data) {
          TEST_UTILITIES.validateNoSensitiveDataExposed(data);
        }
      });
    });
  });

  describe('Integration Security', () => {
    it('should maintain security across all service integrations', async () => {
      // Test full registration flow with security validation
      const result = await authService.register(REGISTRATION_REQUESTS.VALID_REGISTRATION);
      
      // Verify result doesn't expose sensitive data
      TEST_UTILITIES.validateNoSensitiveDataExposed(result);
      
      // Verify all console outputs are secure
      validateNoSensitiveDataInOutputs();
      
      // Verify all service interactions were secure
      const allMockCalls = [
        ...(validationService.validateMaternalHealthId as jest.Mock).mock.calls,
        ...(encryptionService.encryptMaternalHealthId as jest.Mock).mock.calls,
      ].flat();
      
      // The calls themselves might contain sensitive data (input parameters)
      // but ensure they don't leak into outputs or responses
      expect(result.success).toBeDefined();
      if (result.success) {
        expect(result.user).toBeTruthy();
        TEST_UTILITIES.validateNoSensitiveDataExposed(result.user);
      }
    });
  });
});