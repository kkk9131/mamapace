import { jest } from '@jest/globals';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    multiRemove: jest.fn(() => Promise.resolve()),
  },
}));

// Mock Expo modules
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: 'mock-supabase-url',
        supabaseAnonKey: 'mock-supabase-key',
      },
    },
  },
}));

// Mock Expo Haptics
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock Expo core to avoid native references in tests
jest.mock('expo', () => ({}));

// Mock Expo Blur
jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

// Mock Expo Image Manipulator
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(async (uri: string) => ({ uri, width: 800, height: 600 })),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));

// Mock Expo FileSystem minimal default (tests may override per-suite)
jest.mock('expo-file-system', () => ({
  uploadAsync: jest.fn(async () => ({ status: 200, body: '' })),
  FileSystemUploadType: { BINARY_CONTENT: 'binary' },
}));

jest.mock('@supabase/supabase-js', () => {
  const chain = {
    select: jest.fn(function () { return this; }),
    insert: jest.fn(function () { return this; }),
    update: jest.fn(function () { return this; }),
    delete: jest.fn(function () { return this; }),
    eq: jest.fn(function () { return this; }),
    order: jest.fn(function () { return this; }),
    lt: jest.fn(function () { return this; }),
    limit: jest.fn(function () { return this; }),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    upsert: jest.fn(function () { return this; }),
  } as any;
  return ({
    createClient: jest.fn(() => ({
      auth: {
        signInWithPassword: jest.fn(),
        signUp: jest.fn(),
        signOut: jest.fn(),
        getSession: jest.fn(),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
      },
      from: jest.fn(() => ({ ...chain })),
      storage: {
        from: jest.fn(() => ({
          getPublicUrl: jest.fn((path: string) => ({ data: { publicUrl: `https://cdn.example.com/${path}` } })),
        })),
      },
      rpc: jest.fn(),
    })),
  });
});

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
  NavigationContainer: ({ children }: any) => children,
  useFocusEffect: jest.fn(),
}));

// Mock React Native components
jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: jest.fn(options => options.ios) },
  StyleSheet: { create: (styles: any) => styles, absoluteFill: {} },
  Dimensions: { get: jest.fn(() => ({ width: 375, height: 812 })) },
  Alert: { alert: jest.fn(), prompt: jest.fn() },
  Vibration: { vibrate: jest.fn() },
  Linking: { openURL: jest.fn() },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  Switch: 'Switch',
  FlatList: 'FlatList',
  ScrollView: 'ScrollView',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  ActivityIndicator: 'ActivityIndicator',
  RefreshControl: 'RefreshControl',
  Animated: {
    View: 'Animated.View',
    Text: 'Animated.Text',
    Value: jest.fn().mockImplementation(() => ({
      setValue: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    })),
    timing: jest.fn(() => ({ start: jest.fn() })),
    spring: jest.fn(() => ({ start: jest.fn() })),
    sequence: jest.fn(() => ({ start: jest.fn() })),
    parallel: jest.fn(() => ({ start: jest.fn() })),
    loop: jest.fn(() => ({ start: jest.fn() })),
  },
}));

// Mock secure logger
jest.mock('../utils/privacyProtection', () => ({
  secureLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  sanitizeLogData: jest.fn(data => data),
}));

// Global test setup
global.fetch = jest.fn();
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};
