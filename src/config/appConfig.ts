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
  // Feature rollout: toggle filtered DB views (posts/conversations/profiles)
  useFilteredViews: false,
};

export default appConfig;
