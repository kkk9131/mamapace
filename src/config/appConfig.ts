/**
 * Application configuration
 *
 * When useMockAuth is true, the app uses a local mock
 * authentication service instead of Supabase-backed services.
 */
export const appConfig = {
  useMockAuth: false,
  // Phase 2: Server-side encryption; client does not encrypt
  useServerHashing: false,
  disableClientEncryption: true,
};

export default appConfig;
