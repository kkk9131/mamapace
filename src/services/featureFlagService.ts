import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSupabaseClient } from './supabaseClient';

type CacheEntry = { value: boolean; expiresAt: number };
const memoryCache: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 60_000; // 60s

const OVERRIDE_KEY = 'feature_flag_override'; // stores JSON { [key]: boolean }

export async function getFeatureFlag(
  key: string,
  defaultValue = false,
): Promise<boolean> {
  // 1) In-memory cache
  const now = Date.now();
  const c = memoryCache[key];
  if (c && c.expiresAt > now) {
    return c.value;
  }

  // 2) Local override (AsyncStorage)
  try {
    const raw = await AsyncStorage.getItem(OVERRIDE_KEY);
    if (raw) {
      const map = JSON.parse(raw) as Record<string, boolean>;
      if (typeof map[key] === 'boolean') {
        memoryCache[key] = { value: map[key], expiresAt: now + CACHE_TTL_MS };
        return map[key];
      }
    }
  } catch {}

  // 3) Remote (Supabase table: public.feature_flags { key text pk, enabled boolean })
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('feature_flags')
      .select('enabled')
      .eq('key', key)
      .maybeSingle();
    if (!error && data && typeof (data as any).enabled === 'boolean') {
      const v = !!(data as any).enabled;
      memoryCache[key] = { value: v, expiresAt: now + CACHE_TTL_MS };
      return v;
    }
  } catch {}

  // 4) Fallback
  memoryCache[key] = { value: defaultValue, expiresAt: now + CACHE_TTL_MS };
  return defaultValue;
}

export async function setLocalOverride(key: string, value: boolean) {
  try {
    const raw = await AsyncStorage.getItem(OVERRIDE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    map[key] = value;
    await AsyncStorage.setItem(OVERRIDE_KEY, JSON.stringify(map));
    memoryCache[key] = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  } catch {}
}
