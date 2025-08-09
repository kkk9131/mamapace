import AsyncStorage from '@react-native-async-storage/async-storage';

// Secure storage provider (expo-secure-store が存在すれば優先使用)
// 依存が無い環境でも動作するように動的ロードしてフォールバック
type StorageProvider = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

let provider: StorageProvider;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const SecureStore = require('expo-secure-store');
  if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
    provider = {
      async getItem(key: string) {
        return await SecureStore.getItemAsync(key);
      },
      async setItem(key: string, value: string) {
        await SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
        });
      },
      async removeItem(key: string) {
        await SecureStore.deleteItemAsync(key);
      }
    } as StorageProvider;
  } else {
    provider = {
      async getItem(key: string) { return await AsyncStorage.getItem(key); },
      async setItem(key: string, value: string) { await AsyncStorage.setItem(key, value); },
      async removeItem(key: string) { await AsyncStorage.removeItem(key); }
    };
  }
} catch {
  // フォールバック: AsyncStorage
  provider = {
    async getItem(key: string) { return await AsyncStorage.getItem(key); },
    async setItem(key: string, value: string) { await AsyncStorage.setItem(key, value); },
    async removeItem(key: string) { await AsyncStorage.removeItem(key); }
  };
}

const KEYS = {
  USER: 'auth_user_profile',
  SESSION_TOKEN: 'auth_session_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  EXPIRES_AT: 'auth_expires_at',
} as const;

async function setItem(key: string, value: string): Promise<void> { await provider.setItem(key, value); }
async function getItem(key: string): Promise<string | null> { return await provider.getItem(key); }
async function removeItem(key: string): Promise<void> { await provider.removeItem(key); }

export type StoredSession = {
  user: any | null;
  sessionToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
};

export const secureSessionStore = {
  async setSession(user: any, sessionToken: string, refreshToken: string, expiresAt: string): Promise<void> {
    await Promise.all([
      setItem(KEYS.USER, JSON.stringify(user)),
      setItem(KEYS.SESSION_TOKEN, sessionToken),
      setItem(KEYS.REFRESH_TOKEN, refreshToken),
      setItem(KEYS.EXPIRES_AT, expiresAt),
    ]);
  },

  async getSession(): Promise<StoredSession> {
    const [userStr, sessionToken, refreshToken, expiresAt] = await Promise.all([
      getItem(KEYS.USER),
      getItem(KEYS.SESSION_TOKEN),
      getItem(KEYS.REFRESH_TOKEN),
      getItem(KEYS.EXPIRES_AT),
    ]);
    return {
      user: userStr ? JSON.parse(userStr) : null,
      sessionToken,
      refreshToken,
      expiresAt,
    };
  },

  async updateTokens(sessionToken: string, refreshToken: string, expiresAt: string): Promise<void> {
    await Promise.all([
      setItem(KEYS.SESSION_TOKEN, sessionToken),
      setItem(KEYS.REFRESH_TOKEN, refreshToken),
      setItem(KEYS.EXPIRES_AT, expiresAt),
    ]);
  },

  async clear(): Promise<void> {
    await Promise.all([
      removeItem(KEYS.USER),
      removeItem(KEYS.SESSION_TOKEN),
      removeItem(KEYS.REFRESH_TOKEN),
      removeItem(KEYS.EXPIRES_AT),
    ]);
  },

  async isSessionValid(): Promise<boolean> {
    const { expiresAt } = await this.getSession();
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() > Date.now();
  },

  async needsRefresh(thresholdMinutes = 60): Promise<boolean> {
    const { expiresAt } = await this.getSession();
    if (!expiresAt) return false;
    const msLeft = new Date(expiresAt).getTime() - Date.now();
    return msLeft < thresholdMinutes * 60 * 1000;
  },

  async getCurrentUser(): Promise<any | null> {
    const { user } = await this.getSession();
    return user;
  },
};

export default secureSessionStore;
