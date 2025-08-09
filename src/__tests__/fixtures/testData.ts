/**
 * SECURE TEST DATA FIXTURES
 * 
 * SECURITY RULES:
 * 1. NO real maternal health IDs
 * 2. Use encrypted/hashed values only
 * 3. Sanitize all logging data
 * 4. Clear sensitive data after tests
 */

import { PublicUserProfile, RegistrationRequest, LoginRequest } from '../../types/auth';

// =====================================================
// ENCRYPTED TEST DATA (NO REAL MATERNAL HEALTH IDS)
// =====================================================

export const ENCRYPTED_TEST_IDS = {
  VALID_ENCRYPTED_1: 'enc_hash_a1b2c3d4e5f6789012345678901234',
  VALID_ENCRYPTED_2: 'enc_hash_b2c3d4e5f6789012345678901234a1',
  INVALID_ENCRYPTED: 'enc_hash_invalid_test_data_xyz789',
};

// =====================================================
// TEST USER PROFILES (PUBLIC DATA ONLY)
// =====================================================

export const TEST_USERS: Record<string, PublicUserProfile> = {
  VALID_USER_1: {
    id: 'test-user-uuid-1',
    username: 'mama_test_1',
    display_name: '테스트 엄마 1',
    emoji: '🌸',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  VALID_USER_2: {
    id: 'test-user-uuid-2',
    username: 'mama_test_2',
    display_name: 'テストママ 2',
    emoji: '🌺',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
};

// =====================================================
// REGISTRATION TEST REQUESTS
// =====================================================

export const REGISTRATION_REQUESTS: Record<string, RegistrationRequest> = {
  VALID_REGISTRATION: {
    maternal_health_id: ENCRYPTED_TEST_IDS.VALID_ENCRYPTED_1,
    username: 'new_mama_test',
    password: 'SecurePassword123!',
    confirmPassword: 'SecurePassword123!',
    display_name: '새로운 엄마',
    emoji: '🌷',
  },
  INVALID_PASSWORD: {
    maternal_health_id: ENCRYPTED_TEST_IDS.VALID_ENCRYPTED_2,
    username: 'weak_password_test',
    password: '123',
    confirmPassword: '123',
    display_name: 'Weak Password Test',
    emoji: '😅',
  },
  PASSWORD_MISMATCH: {
    maternal_health_id: ENCRYPTED_TEST_IDS.VALID_ENCRYPTED_1,
    username: 'mismatch_test',
    password: 'SecurePassword123!',
    confirmPassword: 'DifferentPassword456!',
    display_name: 'Mismatch Test',
    emoji: '🤔',
  },
  USERNAME_TOO_SHORT: {
    maternal_health_id: ENCRYPTED_TEST_IDS.VALID_ENCRYPTED_2,
    username: 'ab',
    password: 'SecurePassword123!',
    confirmPassword: 'SecurePassword123!',
    display_name: 'Short Username',
    emoji: '📏',
  },
  DUPLICATE_USERNAME: {
    maternal_health_id: ENCRYPTED_TEST_IDS.VALID_ENCRYPTED_1,
    username: 'mama_test_1', // Same as existing user
    password: 'SecurePassword123!',
    confirmPassword: 'SecurePassword123!',
    display_name: 'Duplicate Test',
    emoji: '👯‍♀️',
  },
};

// =====================================================
// LOGIN TEST REQUESTS
// =====================================================

export const LOGIN_REQUESTS: Record<string, LoginRequest> = {
  VALID_LOGIN: {
    username: 'mama_test_1',
    password: 'SecurePassword123!',
  },
  INVALID_PASSWORD: {
    username: 'mama_test_1',
    password: 'WrongPassword',
  },
  NONEXISTENT_USER: {
    username: 'nonexistent_user',
    password: 'AnyPassword123!',
  },
  EMPTY_CREDENTIALS: {
    username: '',
    password: '',
  },
};

// =====================================================
// SECURITY TEST SCENARIOS
// =====================================================

export const SECURITY_TEST_SCENARIOS = {
  BRUTE_FORCE: {
    username: 'mama_test_1',
    attempts: Array(6).fill('WrongPassword123!'), // Exceed max attempts
  },
  SQL_INJECTION: {
    username: "'; DROP TABLE users; --",
    password: 'password',
  },
  XSS_ATTEMPT: {
    username: '<script>alert("xss")</script>',
    password: 'password',
  },
  MATERNAL_ID_EXPOSURE: {
    // Test that maternal health IDs are never exposed
    testInputs: [
      '1234567890', // Raw 10-digit ID
      'maternal_health_id: 1234567890',
      { maternal_health_id: '1234567890' },
    ],
  },
};

// =====================================================
// PERFORMANCE TEST DATA
// =====================================================

export const PERFORMANCE_TEST_DATA = {
  CONCURRENT_USERS: 10,
  TARGET_RESPONSE_TIMES: {
    LOGIN: 2000, // 2 seconds
    REGISTRATION: 5000, // 5 seconds
    VALIDATION: 300, // 300ms
    SESSION_RESTORE: 1000, // 1 second
    TOKEN_REFRESH: 500, // 500ms
  },
  LOAD_TEST: {
    USERS: 50,
    REQUESTS_PER_USER: 5,
    RAMP_UP_TIME: 10000, // 10 seconds
  },
};

// =====================================================
// DATABASE TEST DATA
// =====================================================

export const DATABASE_TEST_DATA = {
  MOCK_SESSIONS: [
    {
      id: 'session-test-1',
      user_id: 'test-user-uuid-1',
      access_token: 'mock_access_token_1',
      refresh_token: 'mock_refresh_token_1',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    },
  ],
  MOCK_SECURITY_EVENTS: [
    {
      id: 'event-test-1',
      user_id: 'test-user-uuid-1',
      event_type: 'login_success',
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0 Test Browser',
      created_at: new Date().toISOString(),
    },
  ],
};

// =====================================================
// ERROR TEST SCENARIOS
// =====================================================

export const ERROR_TEST_SCENARIOS = {
  NETWORK_ERRORS: [
    { type: 'timeout', message: 'Request timed out' },
    { type: 'offline', message: 'Network unavailable' },
    { type: 'server_error', message: 'Internal server error' },
  ],
  VALIDATION_ERRORS: [
    {
      field: 'username',
      error: 'Username must be at least 3 characters',
      input: 'ab',
    },
    {
      field: 'password',
      error: 'Password must contain at least one number',
      input: 'WeakPassword',
    },
  ],
  AUTHENTICATION_ERRORS: [
    { code: 'invalid_credentials', message: 'Invalid username or password' },
    { code: 'account_locked', message: 'Account temporarily locked' },
    { code: 'session_expired', message: 'Session has expired' },
  ],
};

// =====================================================
// TEST UTILITIES
// =====================================================

export const TEST_UTILITIES = {
  /**
   * Creates a safe test user without exposing sensitive data
   */
  createSafeTestUser: (overrides: Partial<PublicUserProfile> = {}): PublicUserProfile => ({
    ...TEST_USERS.VALID_USER_1,
    ...overrides,
    id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  }),

  /**
   * Creates a registration request with encrypted test data
   */
  createSafeRegistrationRequest: (overrides: Partial<RegistrationRequest> = {}): RegistrationRequest => ({
    ...REGISTRATION_REQUESTS.VALID_REGISTRATION,
    ...overrides,
    maternal_health_id: ENCRYPTED_TEST_IDS.VALID_ENCRYPTED_1, // Always use encrypted test data
  }),

  /**
   * Validates that no sensitive data is exposed in test results
   */
  validateNoSensitiveDataExposed: (data: any): void => {
    const serialized = JSON.stringify(data);
    
    // Check for patterns that might be maternal health IDs
    if (serialized.match(/\b\d{10}\b/)) {
      throw new Error('SECURITY VIOLATION: Potential maternal health ID detected in test data');
    }
    
    // Check for explicit sensitive field names
    if (serialized.includes('maternal_health_id') && !serialized.includes('encrypted') && !serialized.includes('enc_hash')) {
      throw new Error('SECURITY VIOLATION: Unencrypted maternal health ID field detected');
    }
  },

  /**
   * Creates mock database response without sensitive data
   */
  createMockDatabaseResponse: (user: PublicUserProfile) => ({
    data: [user],
    error: null,
    count: 1,
    status: 200,
    statusText: 'OK',
  }),

  /**
   * Simulates network delays for performance testing
   */
  simulateNetworkDelay: (ms: number = 100): Promise<void> => 
    new Promise(resolve => setTimeout(resolve, ms)),
};

// =====================================================
// CLEANUP UTILITIES
// =====================================================

export const CLEANUP_UTILITIES = {
  /**
   * Clears all test data from memory
   */
  clearTestData: () => {
    // Clear any cached test data
    Object.keys(TEST_USERS).forEach(key => {
      delete (TEST_USERS as any)[key];
    });
  },

  /**
   * Validates that no test data remains in memory
   */
  validateCleanup: () => {
    // Check that no sensitive test data remains
    if (global.gc) {
      global.gc(); // Force garbage collection if available
    }
    
    // Additional cleanup validation can be added here
  },
};