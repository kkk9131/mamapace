/**
 * AUTHENTICATION PERFORMANCE TESTS
 * 
 * Comprehensive performance benchmarking for authentication system:
 * - Response time validation for all authentication operations
 * - Concurrent user handling performance
 * - Resource usage monitoring
 * - Memory leak detection
 * - Database operation optimization
 * - UI responsiveness under load
 */

import { authService } from '../../services/authService';
import { encryptionService } from '../../services/encryptionService';
import { validationService } from '../../services/validationService';
import { sessionManager } from '../../services/sessionManager';
import {
  REGISTRATION_REQUESTS,
  LOGIN_REQUESTS,
  TEST_USERS,
  PERFORMANCE_TEST_DATA,
  TEST_UTILITIES,
  ENCRYPTED_TEST_IDS,
} from '../fixtures/testData';

// Performance monitoring utilities
class PerformanceMonitor {
  private startTime: number = 0;
  private endTime: number = 0;
  private memoryStart: any = null;
  private memoryEnd: any = null;

  start() {
    this.startTime = performance.now();
    if (global.gc) {
      global.gc(); // Force garbage collection before test
    }
    this.memoryStart = process.memoryUsage ? process.memoryUsage() : null;
  }

  end() {
    this.endTime = performance.now();
    this.memoryEnd = process.memoryUsage ? process.memoryUsage() : null;
  }

  getDuration() {
    return this.endTime - this.startTime;
  }

  getMemoryDiff() {
    if (!this.memoryStart || !this.memoryEnd) return null;
    
    return {
      heapUsed: this.memoryEnd.heapUsed - this.memoryStart.heapUsed,
      heapTotal: this.memoryEnd.heapTotal - this.memoryStart.heapTotal,
      external: this.memoryEnd.external - this.memoryStart.external,
      rss: this.memoryEnd.rss - this.memoryStart.rss,
    };
  }
}

describe('Authentication Performance Tests', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(async () => {
    jest.clearAllMocks();
    performanceMonitor = new PerformanceMonitor();
    
    await authService.initialize();
    
    // Setup successful mocks for consistent performance testing
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
    
    (encryptionService.encryptMaternalHealthId as jest.Mock).mockReturnValue(
      ENCRYPTED_TEST_IDS.VALID_ENCRYPTED_1
    );
    
    (encryptionService.verifyPassword as jest.Mock).mockResolvedValue(true);
    
    (sessionManager.createSession as jest.Mock).mockResolvedValue({
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  });

  afterEach(() => {
    TEST_UTILITIES.validateNoSensitiveDataExposed(expect.getState());
  });

  describe('Registration Performance', () => {
    it('should complete registration within target time', async () => {
      const targetTime = PERFORMANCE_TEST_DATA.TARGET_RESPONSE_TIMES.REGISTRATION;

      performanceMonitor.start();
      
      const result = await authService.register(REGISTRATION_REQUESTS.VALID_REGISTRATION);
      
      performanceMonitor.end();
      
      const duration = performanceMonitor.getDuration();
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(targetTime);
      
      console.log(`Registration completed in ${duration.toFixed(2)}ms (target: ${targetTime}ms)`);
    });

    it('should handle validation operations within target time', async () => {
      const targetTime = PERFORMANCE_TEST_DATA.TARGET_RESPONSE_TIMES.VALIDATION;
      
      const validationOperations = [
        () => validationService.validateMaternalHealthId(REGISTRATION_REQUESTS.VALID_REGISTRATION.maternal_health_id),
        () => validationService.validateUsername(REGISTRATION_REQUESTS.VALID_REGISTRATION.username),
        () => validationService.validatePassword(REGISTRATION_REQUESTS.VALID_REGISTRATION.password),
      ];
      
      for (const operation of validationOperations) {
        performanceMonitor.start();
        
        await operation();
        
        performanceMonitor.end();
        
        const duration = performanceMonitor.getDuration();
        expect(duration).toBeLessThan(targetTime);
        
        console.log(`Validation completed in ${duration.toFixed(2)}ms (target: ${targetTime}ms)`);
      }
    });

    it('should handle encryption operations efficiently', async () => {
      const iterations = 100;
      const maxTimePerOperation = 50; // 50ms per encryption
      
      performanceMonitor.start();
      
      for (let i = 0; i < iterations; i++) {
        encryptionService.encryptMaternalHealthId(`test_id_${i.toString().padStart(10, '0')}`);
      }
      
      performanceMonitor.end();
      
      const totalDuration = performanceMonitor.getDuration();
      const averageTime = totalDuration / iterations;
      
      expect(averageTime).toBeLessThan(maxTimePerOperation);
      
      console.log(`Average encryption time: ${averageTime.toFixed(2)}ms per operation`);
    });

    it('should not cause memory leaks during registration', async () => {
      const iterations = 10;
      const maxMemoryIncrease = 50 * 1024 * 1024; // 50MB threshold
      
      performanceMonitor.start();
      
      for (let i = 0; i < iterations; i++) {
        const request = {
          ...REGISTRATION_REQUESTS.VALID_REGISTRATION,
          username: `user_${i}`,
        };
        
        await authService.register(request);
        
        // Force garbage collection between iterations
        if (global.gc && i % 3 === 0) {
          global.gc();
        }
      }
      
      performanceMonitor.end();
      
      const memoryDiff = performanceMonitor.getMemoryDiff();
      
      if (memoryDiff) {
        expect(memoryDiff.heapUsed).toBeLessThan(maxMemoryIncrease);
        
        console.log(`Memory usage after ${iterations} registrations:`);
        console.log(`Heap: ${(memoryDiff.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        console.log(`RSS: ${(memoryDiff.rss / 1024 / 1024).toFixed(2)}MB`);
      }
    });
  });

  describe('Login Performance', () => {
    beforeEach(() => {
      // Mock database lookup for login
      jest.spyOn(require('../../services/supabaseClient'), 'supabaseClient', 'get')
        .mockReturnValue({
          from: jest.fn().mockReturnValue({
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
          }),
        });
    });

    it('should complete login within target time', async () => {
      const targetTime = PERFORMANCE_TEST_DATA.TARGET_RESPONSE_TIMES.LOGIN;

      performanceMonitor.start();
      
      const result = await authService.login(LOGIN_REQUESTS.VALID_LOGIN);
      
      performanceMonitor.end();
      
      const duration = performanceMonitor.getDuration();
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(targetTime);
      
      console.log(`Login completed in ${duration.toFixed(2)}ms (target: ${targetTime}ms)`);
    });

    it('should handle password verification efficiently', async () => {
      const iterations = 50;
      const maxTimePerVerification = 100; // 100ms per verification
      
      performanceMonitor.start();
      
      for (let i = 0; i < iterations; i++) {
        await encryptionService.verifyPassword('test_password_123', 'mock_hash');
      }
      
      performanceMonitor.end();
      
      const totalDuration = performanceMonitor.getDuration();
      const averageTime = totalDuration / iterations;
      
      expect(averageTime).toBeLessThan(maxTimePerVerification);
      
      console.log(`Average password verification: ${averageTime.toFixed(2)}ms per operation`);
    });

    it('should handle failed login attempts efficiently', async () => {
      (encryptionService.verifyPassword as jest.Mock).mockResolvedValue(false);
      
      const targetTime = PERFORMANCE_TEST_DATA.TARGET_RESPONSE_TIMES.LOGIN;

      performanceMonitor.start();
      
      const result = await authService.login(LOGIN_REQUESTS.INVALID_PASSWORD);
      
      performanceMonitor.end();
      
      const duration = performanceMonitor.getDuration();
      
      expect(result.success).toBe(false);
      expect(duration).toBeLessThan(targetTime);
      
      console.log(`Failed login handled in ${duration.toFixed(2)}ms (target: ${targetTime}ms)`);
    });
  });

  describe('Session Management Performance', () => {
    it('should restore session within target time', async () => {
      const targetTime = PERFORMANCE_TEST_DATA.TARGET_RESPONSE_TIMES.SESSION_RESTORE;
      
      (sessionManager.getStoredSession as jest.Mock).mockResolvedValue({
        access_token: 'mock_token',
        refresh_token: 'mock_refresh',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        user: TEST_USERS.VALID_USER_1,
      });
      
      (sessionManager.isSessionValid as jest.Mock).mockResolvedValue(true);

      performanceMonitor.start();
      
      const user = await authService.loadSession();
      
      performanceMonitor.end();
      
      const duration = performanceMonitor.getDuration();
      
      expect(user).toEqual(TEST_USERS.VALID_USER_1);
      expect(duration).toBeLessThan(targetTime);
      
      console.log(`Session restored in ${duration.toFixed(2)}ms (target: ${targetTime}ms)`);
    });

    it('should refresh token within target time', async () => {
      const targetTime = PERFORMANCE_TEST_DATA.TARGET_RESPONSE_TIMES.TOKEN_REFRESH;
      
      (sessionManager.needsRefresh as jest.Mock).mockResolvedValue(true);
      (sessionManager.refreshSession as jest.Mock).mockResolvedValue({
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      performanceMonitor.start();
      
      const success = await authService.refreshToken();
      
      performanceMonitor.end();
      
      const duration = performanceMonitor.getDuration();
      
      expect(success).toBe(true);
      expect(duration).toBeLessThan(targetTime);
      
      console.log(`Token refreshed in ${duration.toFixed(2)}ms (target: ${targetTime}ms)`);
    });

    it('should handle session cleanup efficiently', async () => {
      const maxCleanupTime = 200; // 200ms for cleanup operations

      performanceMonitor.start();
      
      await authService.logout();
      
      performanceMonitor.end();
      
      const duration = performanceMonitor.getDuration();
      
      expect(duration).toBeLessThan(maxCleanupTime);
      
      console.log(`Session cleanup completed in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent registrations efficiently', async () => {
      const concurrentUsers = PERFORMANCE_TEST_DATA.CONCURRENT_USERS;
      const maxAverageTime = PERFORMANCE_TEST_DATA.TARGET_RESPONSE_TIMES.REGISTRATION * 1.5; // 50% tolerance

      const registrationPromises = Array(concurrentUsers).fill(null).map(async (_, index) => {
        const monitor = new PerformanceMonitor();
        monitor.start();
        
        const request = {
          ...REGISTRATION_REQUESTS.VALID_REGISTRATION,
          username: `concurrent_user_${index}`,
        };
        
        const result = await authService.register(request);
        
        monitor.end();
        
        return {
          result,
          duration: monitor.getDuration(),
          index,
        };
      });

      performanceMonitor.start();
      
      const results = await Promise.all(registrationPromises);
      
      performanceMonitor.end();
      
      const totalTime = performanceMonitor.getDuration();
      const averageTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const maxTime = Math.max(...results.map(r => r.duration));
      
      // All registrations should succeed
      results.forEach(({ result, index }) => {
        expect(result.success).toBe(true);
      });
      
      // Average time should be within acceptable range
      expect(averageTime).toBeLessThan(maxAverageTime);
      
      console.log(`Concurrent registrations (${concurrentUsers} users):`);
      console.log(`Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`Average time: ${averageTime.toFixed(2)}ms`);
      console.log(`Max time: ${maxTime.toFixed(2)}ms`);
    });

    it('should handle concurrent logins efficiently', async () => {
      const concurrentLogins = 20;
      const maxAverageTime = PERFORMANCE_TEST_DATA.TARGET_RESPONSE_TIMES.LOGIN * 1.5;

      const loginPromises = Array(concurrentLogins).fill(null).map(async (_, index) => {
        const monitor = new PerformanceMonitor();
        monitor.start();
        
        const result = await authService.login({
          username: `user_${index}`,
          password: 'test_password_123',
        });
        
        monitor.end();
        
        return {
          result,
          duration: monitor.getDuration(),
          index,
        };
      });

      const results = await Promise.all(loginPromises);
      const averageTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      
      expect(averageTime).toBeLessThan(maxAverageTime);
      
      console.log(`Concurrent logins (${concurrentLogins} attempts):`);
      console.log(`Average time: ${averageTime.toFixed(2)}ms`);
    });

    it('should handle mixed concurrent operations', async () => {
      const operations = [
        ...Array(5).fill(null).map((_, i) => ({
          type: 'register',
          data: {
            ...REGISTRATION_REQUESTS.VALID_REGISTRATION,
            username: `mixed_reg_${i}`,
          },
        })),
        ...Array(5).fill(null).map((_, i) => ({
          type: 'login',
          data: {
            username: `mixed_login_${i}`,
            password: 'test_password_123',
          },
        })),
        ...Array(3).fill(null).map(() => ({
          type: 'session_restore',
          data: null,
        })),
      ];

      const operationPromises = operations.map(async (op) => {
        const monitor = new PerformanceMonitor();
        monitor.start();
        
        let result;
        switch (op.type) {
          case 'register':
            result = await authService.register(op.data);
            break;
          case 'login':
            result = await authService.login(op.data);
            break;
          case 'session_restore':
            result = { user: await authService.loadSession() };
            break;
        }
        
        monitor.end();
        
        return {
          type: op.type,
          result,
          duration: monitor.getDuration(),
        };
      });

      performanceMonitor.start();
      
      const results = await Promise.all(operationPromises);
      
      performanceMonitor.end();
      
      const totalTime = performanceMonitor.getDuration();
      const resultsByType = results.reduce((acc, r) => {
        if (!acc[r.type]) acc[r.type] = [];
        acc[r.type].push(r.duration);
        return acc;
      }, {} as Record<string, number[]>);
      
      console.log(`Mixed concurrent operations (${operations.length} total):`);
      console.log(`Total time: ${totalTime.toFixed(2)}ms`);
      
      Object.entries(resultsByType).forEach(([type, durations]) => {
        const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        console.log(`${type} average: ${avg.toFixed(2)}ms (${durations.length} operations)`);
      });
    });
  });

  describe('Resource Usage Performance', () => {
    it('should maintain acceptable memory usage under load', async () => {
      const iterations = 100;
      const maxMemoryPerOperation = 1024 * 1024; // 1MB per operation
      
      const initialMemory = process.memoryUsage ? process.memoryUsage() : null;
      
      for (let i = 0; i < iterations; i++) {
        const request = {
          ...REGISTRATION_REQUESTS.VALID_REGISTRATION,
          username: `memory_test_${i}`,
        };
        
        await authService.register(request);
        
        // Force GC every 20 iterations
        if (global.gc && i % 20 === 0) {
          global.gc();
        }
      }
      
      if (global.gc) {
        global.gc(); // Final cleanup
      }
      
      const finalMemory = process.memoryUsage ? process.memoryUsage() : null;
      
      if (initialMemory && finalMemory) {
        const memoryDiff = finalMemory.heapUsed - initialMemory.heapUsed;
        const memoryPerOperation = memoryDiff / iterations;
        
        expect(memoryPerOperation).toBeLessThan(maxMemoryPerOperation);
        
        console.log(`Memory usage after ${iterations} operations:`);
        console.log(`Total increase: ${(memoryDiff / 1024 / 1024).toFixed(2)}MB`);
        console.log(`Per operation: ${(memoryPerOperation / 1024).toFixed(2)}KB`);
      }
    });

    it('should handle CPU-intensive operations efficiently', async () => {
      const cpuIntensiveOperations = [
        () => encryptionService.encryptMaternalHealthId('1234567890'),
        () => encryptionService.verifyPassword('password123', 'hash'),
        () => validationService.validatePassword('ComplexPassword123!'),
      ];
      
      const iterations = 50;
      const maxTimePerBatch = 1000; // 1 second for 50 operations
      
      performanceMonitor.start();
      
      for (let i = 0; i < iterations; i++) {
        for (const operation of cpuIntensiveOperations) {
          await operation();
        }
      }
      
      performanceMonitor.end();
      
      const totalTime = performanceMonitor.getDuration();
      const totalOperations = iterations * cpuIntensiveOperations.length;
      
      expect(totalTime).toBeLessThan(maxTimePerBatch * cpuIntensiveOperations.length);
      
      console.log(`CPU-intensive operations (${totalOperations} total):`);
      console.log(`Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`Average per operation: ${(totalTime / totalOperations).toFixed(2)}ms`);
    });
  });

  describe('Database Performance', () => {
    it('should handle database operations within acceptable time limits', async () => {
      const dbOperations = [
        'user_lookup',
        'user_insert',
        'session_create',
        'security_event_log',
      ];
      
      const maxTimePerOperation = 200; // 200ms per DB operation
      
      for (const operation of dbOperations) {
        performanceMonitor.start();
        
        // Simulate database operation based on type
        switch (operation) {
          case 'user_lookup':
            await authService.login(LOGIN_REQUESTS.VALID_LOGIN);
            break;
          case 'user_insert':
            await authService.register({
              ...REGISTRATION_REQUESTS.VALID_REGISTRATION,
              username: `db_test_${Date.now()}`,
            });
            break;
          case 'session_create':
            await sessionManager.createSession(TEST_USERS.VALID_USER_1);
            break;
          case 'security_event_log':
            // This would be handled internally by the services
            await authService.login(LOGIN_REQUESTS.INVALID_PASSWORD);
            break;
        }
        
        performanceMonitor.end();
        
        const duration = performanceMonitor.getDuration();
        expect(duration).toBeLessThan(maxTimePerOperation);
        
        console.log(`${operation} completed in ${duration.toFixed(2)}ms`);
      }
    });
  });
  
  describe('Performance Regression Detection', () => {
    it('should maintain consistent performance across test runs', async () => {
      const testRuns = 5;
      const operationsPerRun = 10;
      const maxVariance = 0.3; // 30% variance allowed
      
      const runResults: number[] = [];
      
      for (let run = 0; run < testRuns; run++) {
        performanceMonitor.start();
        
        const promises = Array(operationsPerRun).fill(null).map(async (_, i) => {
          const result = await authService.register({
            ...REGISTRATION_REQUESTS.VALID_REGISTRATION,
            username: `regression_test_${run}_${i}`,
          });
          return result;
        });
        
        await Promise.all(promises);
        
        performanceMonitor.end();
        
        runResults.push(performanceMonitor.getDuration());
      }
      
      const averageTime = runResults.reduce((sum, time) => sum + time, 0) / testRuns;
      const variance = runResults.reduce((sum, time) => sum + Math.pow(time - averageTime, 2), 0) / testRuns;
      const standardDeviation = Math.sqrt(variance);
      const coefficientOfVariation = standardDeviation / averageTime;
      
      expect(coefficientOfVariation).toBeLessThan(maxVariance);
      
      console.log(`Performance consistency over ${testRuns} runs:`);
      console.log(`Average time: ${averageTime.toFixed(2)}ms`);
      console.log(`Standard deviation: ${standardDeviation.toFixed(2)}ms`);
      console.log(`Coefficient of variation: ${(coefficientOfVariation * 100).toFixed(2)}%`);
    });
  });
});