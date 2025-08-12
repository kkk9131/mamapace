import { jest } from '@jest/globals';

// Mock Expo modules
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: 'mock-supabase-url',
        supabaseAnonKey: 'mock-supabase-key'
      }
    }
  }
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }))
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn()
    })),
    rpc: jest.fn()
  }))
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn()
  }),
  useRoute: () => ({
    params: {}
  }),
  NavigationContainer: ({ children }: any) => children,
  useFocusEffect: jest.fn()
}));

// Mock React Native components
jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: jest.fn((options) => options.ios) },
  StyleSheet: { create: (styles: any) => styles, absoluteFill: {} },
  Dimensions: { get: jest.fn(() => ({ width: 375, height: 812 })) },
  Alert: { alert: jest.fn() },
  Vibration: { vibrate: jest.fn() },
  Linking: { openURL: jest.fn() },
  AppState: { currentState: 'active', addEventListener: jest.fn(), removeEventListener: jest.fn() }
}));

// Mock secure logger
jest.mock('../utils/privacyProtection', () => ({
  secureLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  },
  sanitizeLogData: jest.fn((data) => data)
}));

// Global test setup
global.fetch = jest.fn();
global.console = { ...console, warn: jest.fn(), error: jest.fn(), log: jest.fn() };