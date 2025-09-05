import Constants from 'expo-constants';

export const NOTIFICATION_PAGE_SIZE = 20;

export const SESSION_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function getExpoProjectId(): string | undefined {
  // Prefer explicit env; then app config extra; then undefined
  const env = (global as any)?.process?.env || {};
  const fromEnv = env.EXPO_PUBLIC_EAS_PROJECT_ID || env.EAS_PROJECT_ID;
  const fromExtra = (Constants as any)?.expoConfig?.extra?.eas?.projectId;
  return (fromEnv as string) || (fromExtra as string) || undefined;
}
