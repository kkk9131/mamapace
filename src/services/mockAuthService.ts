/**
 * MOCK AUTHENTICATION SERVICE
 *
 * Lightweight, local-only auth service used before Supabase integration.
 * Stores a mock session in AsyncStorage and returns deterministic responses
 * to allow UI and flow development without backend dependencies.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AuthResponse,
  RegistrationRequest,
  LoginRequest,
  PublicUserProfile,
} from '../types/auth';

const STORAGE_KEYS = {
  SESSION: 'mamapace_mock_session',
} as const;

type MockSession = {
  user: PublicUserProfile;
  session_token: string;
  refresh_token: string;
  expires_at: string;
};

function nowPlusHours(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

class MockAuthService {
  private initialized = false;

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async register(request: RegistrationRequest): Promise<AuthResponse> {
    if (!this.initialized) await this.initialize();

    // Minimal validation: non-empty fields
    if (!request.username?.trim() || !request.password?.trim()) {
      return { success: false, error: '入力内容に問題があります' };
    }

    const user: PublicUserProfile = {
      id: generateId('user'),
      username: request.username.trim(),
      display_name: request.display_name ?? null,
      bio: request.bio ?? null,
      avatar_emoji: request.avatar_emoji ?? '👶',
      created_at: new Date().toISOString(),
      profile_visibility: 'public',
      is_active: true,
    };

    const session: MockSession = {
      user,
      session_token: generateId('sess'),
      refresh_token: generateId('ref'),
      expires_at: nowPlusHours(24),
    };

    await AsyncStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));

    return {
      success: true,
      user: session.user,
      session_token: session.session_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
    };
  }

  async login(request: LoginRequest): Promise<AuthResponse> {
    if (!this.initialized) await this.initialize();

    // Accept any non-empty credentials and create/restore a session
    if (!request.username?.trim() || !request.password?.trim()) {
      return { success: false, error: '入力内容に問題があります' };
    }

    const existing = await this.restoreSessionInternal();
    if (existing) {
      return {
        success: true,
        user: existing.user,
        session_token: existing.session_token,
        refresh_token: existing.refresh_token,
        expires_at: existing.expires_at,
      };
    }

    const user: PublicUserProfile = {
      id: generateId('user'),
      username: request.username.trim(),
      display_name: null,
      bio: null,
      avatar_emoji: '👶',
      created_at: new Date().toISOString(),
      profile_visibility: 'public',
      is_active: true,
    };

    const session: MockSession = {
      user,
      session_token: generateId('sess'),
      refresh_token: generateId('ref'),
      expires_at: nowPlusHours(24),
    };

    await AsyncStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));

    return {
      success: true,
      user: session.user,
      session_token: session.session_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
    };
  }

  async logout(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.SESSION);
  }

  async loadSession(): Promise<PublicUserProfile | null> {
    const session = await this.restoreSessionInternal();
    return session?.user ?? null;
  }

  async needsRefresh(): Promise<boolean> {
    const session = await this.restoreSessionInternal();
    if (!session) return false;
    const timeLeft = new Date(session.expires_at).getTime() - Date.now();
    return timeLeft < 60 * 60 * 1000; // < 1h remaining
  }

  async refreshToken(): Promise<boolean> {
    const session = await this.restoreSessionInternal();
    if (!session) return false;
    const updated: MockSession = {
      ...session,
      session_token: generateId('sess'),
      refresh_token: generateId('ref'),
      expires_at: nowPlusHours(24),
    };
    await AsyncStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(updated));
    return true;
  }

  getInitializationStatus() {
    return {
      authService: this.initialized,
      supabase: false,
      encryption: false,
      sessionManager: true,
    };
  }

  getServiceStats() {
    return {
      mock: true,
      initialized: this.initialized,
      storageKey: STORAGE_KEYS.SESSION,
    };
  }

  private async restoreSessionInternal(): Promise<MockSession | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.SESSION);
      if (!raw) return null;
      return JSON.parse(raw) as MockSession;
    } catch {
      return null;
    }
  }
}

export const mockAuthService = new MockAuthService();
export default mockAuthService;
