/**
 * TEST SETUP CONFIGURATION
 * Global setup for all tests with security and privacy protection
 */

import 'react-native-gesture-handler/jestSetup';
import '@testing-library/jest-native/extend-expect';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      reset: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
    useFocusEffect: jest.fn(),
  };
});

// Mock Expo modules
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

// Security: Mock console methods to prevent sensitive data logging during tests
const originalConsole = { ...console };

beforeEach(() => {
  // Create a safe console that filters maternal health IDs
  console.log = jest.fn((...args) => {
    const message = args.join(' ');
    if (message.match(/\b\d{10}\b/) || message.includes('maternal_health_id')) {
      throw new Error('SECURITY VIOLATION: Maternal health ID detected in console output during test');
    }
    originalConsole.log(...args);
  });
  
  console.warn = jest.fn((...args) => {
    const message = args.join(' ');
    if (message.match(/\b\d{10}\b/) || message.includes('maternal_health_id')) {
      throw new Error('SECURITY VIOLATION: Maternal health ID detected in console output during test');
    }
    originalConsole.warn(...args);
  });
  
  console.error = jest.fn((...args) => {
    const message = args.join(' ');
    if (message.match(/\b\d{10}\b/) || message.includes('maternal_health_id')) {
      throw new Error('SECURITY VIOLATION: Maternal health ID detected in console output during test');
    }
    originalConsole.error(...args);
  });
});

afterEach(() => {
  // Restore original console
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  
  // Clear all mocks
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(10000);

// Mock native modules that may not be available in test environment
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    NativeModules: {
      ...RN.NativeModules,
      // Add any native module mocks here
    },
  };
});

// Mock Supabase client for testing
jest.mock('../services/supabaseClient', () => ({
  supabaseClient: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      refreshSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  },
  initializeSupabase: jest.fn(() => Promise.resolve()),
}));

// Global test utilities
global.createMockUser = () => ({
  id: 'test-user-123',
  username: 'testuser',
  display_name: 'Test User',
  emoji: '🌸',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

global.createSecureTestData = () => ({
  // Never include actual maternal health IDs in test data
  encryptedMaternalHealthId: 'encrypted_test_data_hash_12345',
  username: 'testuser',
  password: 'SecureTest123!',
  confirmPassword: 'SecureTest123!',
});

// Performance testing utilities
global.measurePerformance = async (fn: () => Promise<any>, maxTime: number = 2000) => {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  
  if (duration > maxTime) {
    throw new Error(`Performance test failed: took ${duration}ms, expected < ${maxTime}ms`);
  }
  
  return { result, duration };
};