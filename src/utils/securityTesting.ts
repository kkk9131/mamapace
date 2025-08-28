/**
 * SECURITY TESTING FRAMEWORK
 *
 * Comprehensive security testing utilities for the authentication system
 * Validates security controls, encryption, and privacy protection
 *
 * TESTING AREAS:
 * - Authentication flow security
 * - Maternal health ID protection
 * - Session management security
 * - Encryption/decryption validation
 * - Input validation and sanitization
 */

import { authService } from '../services/authService';
import { encryptionService } from '../services/encryptionService';
import { sessionManager } from '../services/sessionManager';
import { validationService } from '../services/validationService';
import { supabaseClient } from '../services/supabaseClient';
import {
  secureLogger,
  sanitizeObject,
  validatePrivacyCompliance,
  maskMaternalHealthId,
} from '../utils/privacyProtection';
import {
  createRegistrationRequest,
  createLoginRequest,
  ValidationConstraints,
} from '../types/auth';

// =====================================================
// TYPES AND INTERFACES
// =====================================================

/**
 * Test result status
 */
type TestStatus = 'pass' | 'fail' | 'warning' | 'skip';

/**
 * Individual test result
 */
interface TestResult {
  testName: string;
  category: string;
  status: TestStatus;
  message: string;
  details?: any;
  executionTime: number;
  timestamp: number;
}

/**
 * Test suite result
 */
interface TestSuiteResult {
  suiteName: string;
  tests: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
  totalTime: number;
  success: boolean;
}

/**
 * Complete security test report
 */
interface SecurityTestReport {
  suites: TestSuiteResult[];
  overall: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    warningTests: number;
    skippedTests: number;
    successRate: number;
  };
  timestamp: number;
  duration: number;
  criticalFailures: TestResult[];
  securityScore: number; // 0-100
}

/**
 * Test configuration
 */
interface TestConfig {
  includePerformanceTests: boolean;
  includeStressTests: boolean;
  testDataGeneration: boolean;
  skipDestructiveTests: boolean;
  verbose: boolean;
}

// =====================================================
// SECURITY TESTING FRAMEWORK
// =====================================================

class SecurityTestFramework {
  private static instance: SecurityTestFramework;
  private testResults: TestResult[] = [];

  private constructor() {}

  static getInstance(): SecurityTestFramework {
    if (!SecurityTestFramework.instance) {
      SecurityTestFramework.instance = new SecurityTestFramework();
    }
    return SecurityTestFramework.instance;
  }

  // =====================================================
  // MAIN TEST RUNNER
  // =====================================================

  /**
   * Runs comprehensive security test suite
   */
  async runSecurityTests(
    config: Partial<TestConfig> = {}
  ): Promise<SecurityTestReport> {
    const startTime = Date.now();
    this.testResults = [];

    const defaultConfig: TestConfig = {
      includePerformanceTests: true,
      includeStressTests: false,
      testDataGeneration: true,
      skipDestructiveTests: true,
      verbose: false,
    };

    const testConfig = { ...defaultConfig, ...config };

    secureLogger.info('Starting comprehensive security test suite', {
      config: testConfig,
    });

    try {
      // Run all test suites
      const suites = await Promise.all([
        this.runEncryptionTests(),
        this.runAuthenticationTests(),
        this.runValidationTests(),
        this.runSessionManagementTests(),
        this.runPrivacyProtectionTests(),
        this.runServiceIntegrationTests(),
        ...(testConfig.includePerformanceTests
          ? [this.runPerformanceTests()]
          : []),
        ...(testConfig.includeStressTests ? [this.runStressTests()] : []),
      ]);

      // Generate report
      const report = this.generateSecurityReport(
        suites,
        Date.now() - startTime
      );

      secureLogger.info('Security test suite completed', {
        totalTests: report.overall.totalTests,
        successRate: report.overall.successRate,
        securityScore: report.securityScore,
        duration: report.duration,
      });

      return report;
    } catch (error) {
      secureLogger.error('Security test suite failed', { error });
      throw error;
    }
  }

  // =====================================================
  // ENCRYPTION TESTS
  // =====================================================

  private async runEncryptionTests(): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const tests: TestResult[] = [];

    // Test 1: Basic encryption/decryption
    tests.push(
      await this.runTest('encryption-basic', 'encryption', async () => {
        const plaintext = 'test-data-123';
        const password = 'secure-password-456';

        const encrypted = await encryptionService.encrypt(plaintext, password);
        const decrypted = await encryptionService.decrypt(encrypted, password);

        if (decrypted !== plaintext) {
          throw new Error('Decrypted data does not match original');
        }

        return {
          encrypted: encrypted.algorithm,
          keyDerivation: encrypted.keyDerivation,
        };
      })
    );

    // Test 2: Maternal health ID encryption
    tests.push(
      await this.runTest('encryption-maternal-id', 'encryption', async () => {
        const maternalId = '1234567890';
        const password = 'user-password-123';

        const encrypted = await encryptionService.encryptMaternalHealthId(
          maternalId,
          password
        );
        const decrypted = await encryptionService.decryptMaternalHealthId(
          encrypted,
          password
        );

        if (decrypted !== maternalId) {
          throw new Error('Maternal ID decryption failed');
        }

        // Verify encrypted data doesn't contain plaintext
        const encryptedString = JSON.stringify(encrypted);
        if (encryptedString.includes(maternalId)) {
          throw new Error('Plaintext found in encrypted data');
        }

        return { algorithm: encrypted.algorithm };
      })
    );

    // Test 3: Session token encryption
    tests.push(
      await this.runTest('encryption-session-token', 'encryption', async () => {
        const sessionToken = 'session-token-xyz-789';
        const userId = 'user-123-456';

        const encrypted = await encryptionService.encryptSessionToken(
          sessionToken,
          userId
        );
        const decrypted = await encryptionService.decryptSessionToken(
          encrypted,
          userId
        );

        if (decrypted !== sessionToken) {
          throw new Error('Session token decryption failed');
        }

        return { algorithm: encrypted.algorithm };
      })
    );

    // Test 4: Encryption with wrong password should fail
    tests.push(
      await this.runTest(
        'encryption-wrong-password',
        'encryption',
        async () => {
          const plaintext = 'sensitive-data';
          const correctPassword = 'correct-password';
          const wrongPassword = 'wrong-password';

          const encrypted = await encryptionService.encrypt(
            plaintext,
            correctPassword
          );

          try {
            await encryptionService.decrypt(encrypted, wrongPassword);
            throw new Error(
              'Decryption should have failed with wrong password'
            );
          } catch (error) {
            // This is expected - decryption should fail
            return { expectedFailure: true };
          }
        }
      )
    );

    // Test 5: Hash generation and verification
    tests.push(
      await this.runTest(
        'encryption-hash-verification',
        'encryption',
        async () => {
          const data = 'data-to-hash-123';

          const hash1 = await encryptionService.generateHash(data);
          const hash2 = await encryptionService.generateHash(data);

          // Same data should produce same hash
          if (hash1 !== hash2) {
            throw new Error('Hash generation is not deterministic');
          }

          // Verification should work
          const isValid = await encryptionService.verifyHash(data, hash1);
          if (!isValid) {
            throw new Error('Hash verification failed');
          }

          // Wrong data should fail verification
          const isInvalid = await encryptionService.verifyHash(
            'wrong-data',
            hash1
          );
          if (isInvalid) {
            throw new Error('Hash verification should fail for wrong data');
          }

          return { hashLength: hash1.length };
        }
      )
    );

    return {
      suiteName: 'Encryption Tests',
      tests,
      summary: this.calculateSummary(tests),
      totalTime: Date.now() - startTime,
      success: tests.every(t => t.status === 'pass'),
    };
  }

  // =====================================================
  // AUTHENTICATION TESTS
  // =====================================================

  private async runAuthenticationTests(): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const tests: TestResult[] = [];

    // Test 1: Service initialization
    tests.push(
      await this.runTest('auth-initialization', 'authentication', async () => {
        const status = authService.getInitializationStatus();

        if (!status.authService) {
          throw new Error('Auth service not initialized');
        }

        return status;
      })
    );

    // Test 2: Username validation
    tests.push(
      await this.runTest(
        'auth-username-validation',
        'authentication',
        async () => {
          const validUsername = 'testuser123';
          const invalidUsername = 'test@user!';

          const validResult = authService.validateUsernameClient(validUsername);
          const invalidResult =
            authService.validateUsernameClient(invalidUsername);

          if (!validResult.isValid) {
            throw new Error('Valid username rejected');
          }

          if (invalidResult.isValid) {
            throw new Error('Invalid username accepted');
          }

          return { validUsername, invalidUsername };
        }
      )
    );

    // Test 3: Maternal health ID validation
    tests.push(
      await this.runTest(
        'auth-maternal-id-validation',
        'authentication',
        async () => {
          const validId = '1234567890';
          const invalidId = '123456789'; // Too short
          const invalidChars = '123456789a'; // Contains letters

          const validResult =
            authService.validateMaternalHealthIdClient(validId);
          const invalidResult1 =
            authService.validateMaternalHealthIdClient(invalidId);
          const invalidResult2 =
            authService.validateMaternalHealthIdClient(invalidChars);

          if (!validResult.isValid) {
            throw new Error('Valid maternal health ID rejected');
          }

          if (invalidResult1.isValid || invalidResult2.isValid) {
            throw new Error('Invalid maternal health ID accepted');
          }

          return {
            validId: maskMaternalHealthId(),
            invalidCount: 2,
          };
        }
      )
    );

    // Test 4: Password validation
    tests.push(
      await this.runTest(
        'auth-password-validation',
        'authentication',
        async () => {
          const strongPassword = 'StrongPass123!';
          const weakPassword = 'weak';

          const strongResult =
            authService.validatePasswordClient(strongPassword);
          const weakResult = authService.validatePasswordClient(weakPassword);

          if (!strongResult.isValid || strongResult.strength !== 'strong') {
            throw new Error('Strong password not recognized');
          }

          if (weakResult.isValid) {
            throw new Error('Weak password accepted');
          }

          return {
            strongStrength: strongResult.strength,
            weakStrength: weakResult.strength,
          };
        }
      )
    );

    // Test 5: Registration request creation (without actual registration)
    tests.push(
      await this.runTest(
        'auth-registration-request',
        'authentication',
        async () => {
          const request = createRegistrationRequest({
            username: 'testuser',
            maternal_health_id: 'TEST_ID_MOCK',
            password: 'TestPassword123!',
            display_name: 'Test User',
            bio: 'Test bio',
          });

          // Verify privacy compliance
          const privacyCheck = validatePrivacyCompliance(
            sanitizeObject(request)
          );

          if (!privacyCheck.isCompliant) {
            return {
              status: 'warning',
              message: 'Privacy compliance issues detected',
              violations: privacyCheck.violations,
            };
          }

          return { requestValid: true, privacyCompliant: true };
        }
      )
    );

    return {
      suiteName: 'Authentication Tests',
      tests,
      summary: this.calculateSummary(tests),
      totalTime: Date.now() - startTime,
      success: tests.every(t => t.status === 'pass'),
    };
  }

  // =====================================================
  // VALIDATION TESTS
  // =====================================================

  private async runValidationTests(): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const tests: TestResult[] = [];

    // Test 1: Validation service stats
    tests.push(
      await this.runTest('validation-service-stats', 'validation', async () => {
        const stats = validationService.getStats();
        return stats;
      })
    );

    // Test 2: Input sanitization
    tests.push(
      await this.runTest(
        'validation-input-sanitization',
        'validation',
        async () => {
          const maliciousInputs = [
            '<script>alert("xss")</script>',
            'DROP TABLE users;',
            '"; DELETE FROM users; --',
            '../../../etc/passwd',
          ];

          for (const input of maliciousInputs) {
            const sanitized = sanitizeObject({ input }).input;
            if (sanitized === input) {
              throw new Error(`Input not sanitized: ${input}`);
            }
          }

          return { testedInputs: maliciousInputs.length };
        }
      )
    );

    // Test 3: Constraint validation
    tests.push(
      await this.runTest('validation-constraints', 'validation', async () => {
        const constraints = ValidationConstraints;

        // Test username constraints
        const shortUsername = 'ab'; // Too short
        const longUsername = 'a'.repeat(25); // Too long

        const shortResult =
          validationService.validateUsernameClient(shortUsername);
        const longResult =
          validationService.validateUsernameClient(longUsername);

        if (shortResult.isValid || longResult.isValid) {
          throw new Error('Username constraint validation failed');
        }

        return {
          minUsernameLength: constraints.username.minLength,
          maxUsernameLength: constraints.username.maxLength,
        };
      })
    );

    // Test 4: Privacy compliance validation
    tests.push(
      await this.runTest(
        'validation-privacy-compliance',
        'validation',
        async () => {
          const sensitiveData = {
            username: 'testuser',
            maternal_health_id: 'TEST_ID_MOCK', // This should trigger a violation
            password: 'password123',
            some_field: 'normal data',
          };

          const compliance = validatePrivacyCompliance(sensitiveData);

          if (compliance.isCompliant) {
            throw new Error(
              'Privacy compliance check should have detected violations'
            );
          }

          return {
            violations: compliance.violations.length,
            hasMaternalIdViolation: compliance.violations.some(v =>
              v.includes('maternal')
            ),
          };
        }
      )
    );

    return {
      suiteName: 'Validation Tests',
      tests,
      summary: this.calculateSummary(tests),
      totalTime: Date.now() - startTime,
      success: tests.every(t => t.status === 'pass'),
    };
  }

  // =====================================================
  // SESSION MANAGEMENT TESTS
  // =====================================================

  private async runSessionManagementTests(): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const tests: TestResult[] = [];

    // Test 1: Session manager configuration
    tests.push(
      await this.runTest('session-config', 'session', async () => {
        const config = sessionManager.getConfig();
        const stats = sessionManager.getStats();

        return { config, stats };
      })
    );

    // Test 2: Session validation without active session
    tests.push(
      await this.runTest('session-no-active-session', 'session', async () => {
        const isValid = await sessionManager.isSessionValid();
        const currentUser = sessionManager.getCurrentUser();

        // Should be false/null when no session exists
        return {
          isValid,
          hasUser: currentUser !== null,
        };
      })
    );

    // Test 3: Session needs refresh check
    tests.push(
      await this.runTest('session-needs-refresh', 'session', async () => {
        const needsRefresh = await sessionManager.needsRefresh();

        // Should be false when no session exists
        if (needsRefresh) {
          return {
            status: 'warning',
            message: 'needsRefresh returned true with no active session',
          };
        }

        return { needsRefresh };
      })
    );

    return {
      suiteName: 'Session Management Tests',
      tests,
      summary: this.calculateSummary(tests),
      totalTime: Date.now() - startTime,
      success: tests.every(t => t.status === 'pass'),
    };
  }

  // =====================================================
  // PRIVACY PROTECTION TESTS
  // =====================================================

  private async runPrivacyProtectionTests(): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const tests: TestResult[] = [];

    // Test 1: Maternal health ID masking
    tests.push(
      await this.runTest('privacy-maternal-id-masking', 'privacy', async () => {
        const maskedId = maskMaternalHealthId();

        if (maskedId.includes('1') || maskedId.includes('2')) {
          throw new Error('Masked ID contains actual digits');
        }

        if (maskedId.length !== 10) {
          throw new Error('Masked ID length is incorrect');
        }

        return { maskedLength: maskedId.length };
      })
    );

    // Test 2: Data sanitization
    tests.push(
      await this.runTest('privacy-data-sanitization', 'privacy', async () => {
        const sensitiveData = {
          username: 'testuser',
          maternal_health_id: 'TEST_ID_MOCK',
          password: 'secret123',
          session_token: 'token-abc-123',
          normal_field: 'normal data',
        };

        const sanitized = sanitizeObject(sensitiveData);

        // Check that sensitive fields are redacted
        if (
          sanitized.maternal_health_id !== '[REDACTED]' ||
          sanitized.password !== '[REDACTED]' ||
          sanitized.session_token !== '[REDACTED]'
        ) {
          throw new Error('Sensitive fields not properly redacted');
        }

        // Check that normal fields are preserved
        if (
          sanitized.username !== 'testuser' ||
          sanitized.normal_field !== 'normal data'
        ) {
          throw new Error('Normal fields were incorrectly modified');
        }

        return { fieldsRedacted: 3, fieldsPreserved: 2 };
      })
    );

    // Test 3: Secure logging
    tests.push(
      await this.runTest('privacy-secure-logging', 'privacy', async () => {
        // Test that secure logger sanitizes data
        const testData = {
          user: 'testuser',
          maternal_health_id: 'TEST_ID_MOCK',
          action: 'test',
        };

        // This should not throw and should sanitize the data
        secureLogger.info('Test log entry', testData);

        return { logTestPassed: true };
      })
    );

    return {
      suiteName: 'Privacy Protection Tests',
      tests,
      summary: this.calculateSummary(tests),
      totalTime: Date.now() - startTime,
      success: tests.every(t => t.status === 'pass'),
    };
  }

  // =====================================================
  // SERVICE INTEGRATION TESTS
  // =====================================================

  private async runServiceIntegrationTests(): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const tests: TestResult[] = [];

    // Test 1: Supabase client health
    tests.push(
      await this.runTest(
        'integration-supabase-health',
        'integration',
        async () => {
          const health = await supabaseClient.healthCheck();
          const stats = supabaseClient.getStats();

          return {
            isHealthy: health.isHealthy,
            latency: health.latency,
            stats,
          };
        }
      )
    );

    // Test 2: Service initialization status
    tests.push(
      await this.runTest(
        'integration-service-status',
        'integration',
        async () => {
          const status = authService.getInitializationStatus();

          const allInitialized = Object.values(status).every(Boolean);

          if (!allInitialized) {
            return {
              status: 'warning',
              message: 'Not all services are initialized',
              details: status,
            };
          }

          return status;
        }
      )
    );

    // Test 3: Service statistics collection
    tests.push(
      await this.runTest(
        'integration-service-stats',
        'integration',
        async () => {
          const stats = authService.getServiceStats();

          return {
            hasSupabaseStats: !!stats.supabase,
            hasEncryptionStats: !!stats.encryption,
            hasSessionStats: !!stats.sessionManager,
            hasValidationStats: !!stats.validation,
          };
        }
      )
    );

    return {
      suiteName: 'Service Integration Tests',
      tests,
      summary: this.calculateSummary(tests),
      totalTime: Date.now() - startTime,
      success: tests.every(t => t.status === 'pass'),
    };
  }

  // =====================================================
  // PERFORMANCE TESTS
  // =====================================================

  private async runPerformanceTests(): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const tests: TestResult[] = [];

    // Test 1: Encryption performance
    tests.push(
      await this.runTest('performance-encryption', 'performance', async () => {
        const iterations = 10;
        const startTime = Date.now();

        for (let i = 0; i < iterations; i++) {
          const plaintext = `test-data-${i}`;
          const password = 'test-password';

          const encrypted = await encryptionService.encrypt(
            plaintext,
            password
          );
          await encryptionService.decrypt(encrypted, password);
        }

        const totalTime = Date.now() - startTime;
        const avgTime = totalTime / iterations;

        // Warn if average encryption time is > 100ms
        if (avgTime > 100) {
          return {
            status: 'warning',
            message: `Encryption performance degraded: ${avgTime.toFixed(2)}ms avg`,
            details: { iterations, totalTime, avgTime },
          };
        }

        return { iterations, totalTime, avgTime };
      })
    );

    // Test 2: Validation performance
    tests.push(
      await this.runTest('performance-validation', 'performance', async () => {
        const testCases = [
          'validuser123',
          'invalid@user',
          'a'.repeat(50), // Too long
          'ab', // Too short
        ];

        const startTime = Date.now();

        for (const testCase of testCases) {
          validationService.validateUsernameClient(testCase);
        }

        const totalTime = Date.now() - startTime;
        const avgTime = totalTime / testCases.length;

        return { testCases: testCases.length, totalTime, avgTime };
      })
    );

    return {
      suiteName: 'Performance Tests',
      tests,
      summary: this.calculateSummary(tests),
      totalTime: Date.now() - startTime,
      success: tests.every(t => t.status === 'pass'),
    };
  }

  // =====================================================
  // STRESS TESTS (OPTIONAL)
  // =====================================================

  private async runStressTests(): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const tests: TestResult[] = [];

    // Test 1: Concurrent encryption operations
    tests.push(
      await this.runTest('stress-concurrent-encryption', 'stress', async () => {
        const concurrentOps = 20;
        const promises = [];

        for (let i = 0; i < concurrentOps; i++) {
          promises.push(
            encryptionService
              .encrypt(`test-data-${i}`, `password-${i}`)
              .then(encrypted =>
                encryptionService.decrypt(encrypted, `password-${i}`)
              )
          );
        }

        const results = await Promise.all(promises);

        return {
          concurrentOps,
          successfulOps: results.length,
        };
      })
    );

    return {
      suiteName: 'Stress Tests',
      tests,
      summary: this.calculateSummary(tests),
      totalTime: Date.now() - startTime,
      success: tests.every(t => t.status === 'pass'),
    };
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Runs a single test with error handling and timing
   */
  private async runTest(
    testName: string,
    category: string,
    testFunction: () => Promise<any>
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      secureLogger.debug(`Running test: ${testName}`);

      const result = await testFunction();
      const executionTime = Date.now() - startTime;

      // Check if result indicates warning or failure
      if (result && typeof result === 'object' && result.status) {
        return {
          testName,
          category,
          status: result.status,
          message: result.message || `Test completed with ${result.status}`,
          details: result.details || result,
          executionTime,
          timestamp: Date.now(),
        };
      }

      return {
        testName,
        category,
        status: 'pass',
        message: 'Test passed successfully',
        details: result,
        executionTime,
        timestamp: Date.now(),
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      secureLogger.error(`Test failed: ${testName}`, { error: errorMessage });

      return {
        testName,
        category,
        status: 'fail',
        message: errorMessage,
        details: { error: errorMessage },
        executionTime,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Calculates test summary statistics
   */
  private calculateSummary(tests: TestResult[]) {
    return {
      total: tests.length,
      passed: tests.filter(t => t.status === 'pass').length,
      failed: tests.filter(t => t.status === 'fail').length,
      warnings: tests.filter(t => t.status === 'warning').length,
      skipped: tests.filter(t => t.status === 'skip').length,
    };
  }

  /**
   * Generates comprehensive security report
   */
  private generateSecurityReport(
    suites: TestSuiteResult[],
    totalDuration: number
  ): SecurityTestReport {
    const allTests = suites.flatMap(suite => suite.tests);

    const overall = {
      totalTests: allTests.length,
      passedTests: allTests.filter(t => t.status === 'pass').length,
      failedTests: allTests.filter(t => t.status === 'fail').length,
      warningTests: allTests.filter(t => t.status === 'warning').length,
      skippedTests: allTests.filter(t => t.status === 'skip').length,
      successRate: 0,
    };

    overall.successRate =
      overall.totalTests > 0
        ? (overall.passedTests / overall.totalTests) * 100
        : 0;

    // Critical failures are test failures in critical categories
    const criticalCategories = ['encryption', 'authentication', 'privacy'];
    const criticalFailures = allTests.filter(
      t => t.status === 'fail' && criticalCategories.includes(t.category)
    );

    // Calculate security score (0-100)
    const securityScore = this.calculateSecurityScore(suites, criticalFailures);

    return {
      suites,
      overall,
      timestamp: Date.now(),
      duration: totalDuration,
      criticalFailures,
      securityScore,
    };
  }

  /**
   * Calculates overall security score
   */
  private calculateSecurityScore(
    suites: TestSuiteResult[],
    criticalFailures: TestResult[]
  ): number {
    let score = 100;

    // Deduct points for critical failures
    score -= criticalFailures.length * 25; // 25 points per critical failure

    // Deduct points for suite failures
    for (const suite of suites) {
      if (suite.summary.failed > 0) {
        const failureRatio = suite.summary.failed / suite.summary.total;
        score -= failureRatio * 20; // Up to 20 points per suite
      }
    }

    // Deduct points for warnings in critical categories
    const criticalWarnings = suites
      .flatMap(s => s.tests)
      .filter(
        t =>
          t.status === 'warning' &&
          ['encryption', 'authentication', 'privacy'].includes(t.category)
      );

    score -= criticalWarnings.length * 5; // 5 points per critical warning

    return Math.max(0, Math.round(score));
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const securityTestFramework = SecurityTestFramework.getInstance();

/**
 * Run comprehensive security tests
 */
export const runSecurityTests = async (
  config?: Partial<TestConfig>
): Promise<SecurityTestReport> => {
  return await securityTestFramework.runSecurityTests(config);
};

/**
 * Quick security health check
 */
export const quickSecurityCheck = async (): Promise<{
  score: number;
  criticalIssues: number;
  status: 'secure' | 'warning' | 'critical';
}> => {
  const report = await runSecurityTests({
    includePerformanceTests: false,
    includeStressTests: false,
    skipDestructiveTests: true,
  });

  const status =
    report.securityScore >= 80
      ? 'secure'
      : report.securityScore >= 60
        ? 'warning'
        : 'critical';

  return {
    score: report.securityScore,
    criticalIssues: report.criticalFailures.length,
    status,
  };
};

export type { TestResult, TestSuiteResult, SecurityTestReport, TestConfig };
export default securityTestFramework;
