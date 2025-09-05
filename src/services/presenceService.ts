/**
 * PRESENCE SERVICE
 *
 * Manages user online status and presence information:
 * - Online/offline status tracking
 * - Last seen timestamps
 * - Activity-based presence updates
 * - Real-time presence broadcasting
 * - Privacy controls for visibility
 */

import { secureLogger } from '../utils/privacyProtection';
import { OnlineStatus, UserPresence } from '../types/chat';
import { PublicUserProfile } from '../types/auth';

import { authService } from './authService';
import { supabaseClient } from './supabaseClient';

// =====================================================
// CONFIGURATION
// =====================================================

const PRESENCE_CONFIG = {
  HEARTBEAT_INTERVAL_MS: 30000, // 30 seconds
  OFFLINE_THRESHOLD_MS: 60000, // 1 minute
  AWAY_THRESHOLD_MS: 300000, // 5 minutes
  UPDATE_DEBOUNCE_MS: 2000, // 2 seconds
  MAX_PRESENCE_CACHE_SIZE: 1000,
  PRESENCE_EXPIRE_MS: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// =====================================================
// PRESENCE SERVICE
// =====================================================

class PresenceService {
  private isInitialized = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastActivity = Date.now();
  private currentStatus: OnlineStatus = OnlineStatus.OFFLINE;
  private presenceCache = new Map<string, UserPresence>();
  private subscriptions = new Map<string, any>();
  private pendingUpdates = new Map<string, NodeJS.Timeout>();

  constructor() {}

  // =====================================================
  // INITIALIZATION
  // =====================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const user = authService.getCurrentUser();
      if (!user) {
        throw new Error('User must be authenticated');
      }

      secureLogger.info('Initializing presence service');

      // Set initial online status
      await this.updateUserPresence(OnlineStatus.ONLINE);

      // Start heartbeat
      this.startHeartbeat();

      // Setup activity monitoring
      this.setupActivityMonitoring();

      // Setup visibility change handling
      this.setupVisibilityHandling();

      this.isInitialized = true;
      secureLogger.info('Presence service initialized');
    } catch (error) {
      secureLogger.error('Failed to initialize presence service', { error });
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // =====================================================
  // PRESENCE MANAGEMENT
  // =====================================================

  /**
   * Updates current user's presence status
   */
  async updateUserPresence(
    status: OnlineStatus,
    customMessage?: string
  ): Promise<void> {
    await this.ensureInitialized();

    const user = authService.getCurrentUser();
    if (!user) {
      return;
    }

    try {
      // Debounce updates to prevent spam
      const updateKey = `${user.id}_${status}`;
      if (this.pendingUpdates.has(updateKey)) {
        clearTimeout(this.pendingUpdates.get(updateKey)!);
      }

      this.pendingUpdates.set(
        updateKey,
        setTimeout(async () => {
          const client = supabaseClient.getClient();
          const { error } = await client.rpc('update_user_presence', {
            p_user_id: user.id,
            p_status: status,
            p_last_seen_at: new Date().toISOString(),
            p_custom_message: customMessage,
          });

          if (error) {
            secureLogger.error('Failed to update user presence', {
              error,
              status,
            });
          } else {
            this.currentStatus = status;
            this.lastActivity = Date.now();

            // Update local cache
            this.updatePresenceCache(user.id, {
              user_id: user.id,
              status,
              last_seen_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }

          this.pendingUpdates.delete(updateKey);
        }, PRESENCE_CONFIG.UPDATE_DEBOUNCE_MS)
      );
    } catch (error) {
      secureLogger.error('Error updating user presence', { error, status });
    }
  }

  /**
   * Gets presence information for specific users
   */
  async getUsersPresence(userIds: string[]): Promise<UserPresence[]> {
    await this.ensureInitialized();

    if (userIds.length === 0) {
      return [];
    }

    try {
      // Check cache first
      const cached: UserPresence[] = [];
      const uncachedIds: string[] = [];

      userIds.forEach(userId => {
        const cachedPresence = this.presenceCache.get(userId);
        if (cachedPresence && this.isPresenceFresh(cachedPresence)) {
          cached.push(cachedPresence);
        } else {
          uncachedIds.push(userId);
        }
      });

      // Fetch uncached presence data
      let fetched: UserPresence[] = [];
      if (uncachedIds.length > 0) {
        const client = supabaseClient.getClient();
        const { data, error } = await client.rpc('get_users_presence', {
          p_user_ids: uncachedIds,
        });

        if (error) {
          secureLogger.error('Failed to fetch user presence', {
            error,
            userIds: uncachedIds,
          });
        } else {
          fetched = data || [];

          // Update cache
          fetched.forEach(presence => {
            this.updatePresenceCache(presence.user_id, presence);
          });
        }
      }

      return [...cached, ...fetched];
    } catch (error) {
      secureLogger.error('Error getting users presence', { error, userIds });
      return [];
    }
  }

  /**
   * Gets presence for users in a specific chat
   */
  async getChatPresence(chatId: string): Promise<UserPresence[]> {
    await this.ensureInitialized();

    try {
      const client = supabaseClient.getClient();
      const { data, error } = await client.rpc('get_chat_presence', {
        p_chat_id: chatId,
      });

      if (error) {
        secureLogger.error('Failed to get chat presence', { error, chatId });
        return [];
      }

      const presenceData = data || [];

      // Update cache
      presenceData.forEach((presence: UserPresence) => {
        this.updatePresenceCache(presence.user_id, presence);
      });

      return presenceData;
    } catch (error) {
      secureLogger.error('Error getting chat presence', { error, chatId });
      return [];
    }
  }

  /**
   * Subscribes to presence updates for a chat
   */
  async subscribeToChatPresence(
    chatId: string,
    onPresenceUpdate: (presence: UserPresence[]) => void
  ): Promise<string> {
    await this.ensureInitialized();

    try {
      const subscriptionKey = `chat_presence_${chatId}`;

      if (this.subscriptions.has(subscriptionKey)) {
        return subscriptionKey;
      }

      const client = supabaseClient.getClient();
      const subscription = client
        .channel(`chat_presence:${chatId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_presence',
            filter: `user_id=in.(${await this.getChatParticipantIds(chatId)})`,
          },
          async payload => {
            const presence = payload.new as UserPresence;
            if (presence) {
              this.updatePresenceCache(presence.user_id, presence);
              const chatPresence = await this.getChatPresence(chatId);
              onPresenceUpdate(chatPresence);
            }
          }
        )
        .subscribe();

      this.subscriptions.set(subscriptionKey, subscription);
      return subscriptionKey;
    } catch (error) {
      secureLogger.error('Error subscribing to chat presence', {
        error,
        chatId,
      });
      throw error;
    }
  }

  /**
   * Unsubscribes from presence updates
   */
  async unsubscribeFromPresence(subscriptionKey: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionKey);
    if (subscription) {
      await subscription.unsubscribe();
      this.subscriptions.delete(subscriptionKey);
    }
  }

  // =====================================================
  // ACTIVITY MONITORING
  // =====================================================

  private setupActivityMonitoring(): void {
    const updateActivity = () => {
      this.lastActivity = Date.now();

      // Update status based on activity
      if (this.currentStatus === OnlineStatus.AWAY) {
        this.updateUserPresence(OnlineStatus.ONLINE);
      }
    };

    // Monitor various user activities
    if (typeof document !== 'undefined') {
      [
        'mousedown',
        'mousemove',
        'keypress',
        'scroll',
        'touchstart',
        'click',
      ].forEach(event => {
        document.addEventListener(event, updateActivity, true);
      });
    }
  }

  private setupVisibilityHandling(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.updateUserPresence(OnlineStatus.ONLINE);
        } else {
          // Don't immediately go offline, use heartbeat to determine actual offline status
          this.lastActivity =
            Date.now() - PRESENCE_CONFIG.AWAY_THRESHOLD_MS + 5000; // Grace period
        }
      });
    }

    // Handle app background/foreground on mobile
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.updateUserPresence(OnlineStatus.ONLINE);
      });

      window.addEventListener('blur', () => {
        this.lastActivity =
          Date.now() - PRESENCE_CONFIG.AWAY_THRESHOLD_MS + 5000;
      });
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.checkAndUpdateStatus();
    }, PRESENCE_CONFIG.HEARTBEAT_INTERVAL_MS);
  }

  private async checkAndUpdateStatus(): Promise<void> {
    const now = Date.now();
    const timeSinceActivity = now - this.lastActivity;

    let newStatus = this.currentStatus;

    if (timeSinceActivity > PRESENCE_CONFIG.OFFLINE_THRESHOLD_MS) {
      if (
        this.currentStatus !== OnlineStatus.OFFLINE &&
        this.currentStatus !== OnlineStatus.INVISIBLE
      ) {
        newStatus = OnlineStatus.OFFLINE;
      }
    } else if (timeSinceActivity > PRESENCE_CONFIG.AWAY_THRESHOLD_MS) {
      if (this.currentStatus === OnlineStatus.ONLINE) {
        newStatus = OnlineStatus.AWAY;
      }
    } else {
      if (
        this.currentStatus === OnlineStatus.AWAY ||
        this.currentStatus === OnlineStatus.OFFLINE
      ) {
        newStatus = OnlineStatus.ONLINE;
      }
    }

    if (newStatus !== this.currentStatus) {
      await this.updateUserPresence(newStatus);
    }
  }

  // =====================================================
  // CACHE MANAGEMENT
  // =====================================================

  private updatePresenceCache(userId: string, presence: UserPresence): void {
    // Manage cache size
    if (this.presenceCache.size > PRESENCE_CONFIG.MAX_PRESENCE_CACHE_SIZE) {
      // Remove oldest entries
      const entries = Array.from(this.presenceCache.entries());
      const toRemove = entries
        .sort(
          (a, b) =>
            new Date(a[1].updated_at).getTime() -
            new Date(b[1].updated_at).getTime()
        )
        .slice(0, Math.floor(PRESENCE_CONFIG.MAX_PRESENCE_CACHE_SIZE * 0.2));

      toRemove.forEach(([key]) => {
        this.presenceCache.delete(key);
      });
    }

    this.presenceCache.set(userId, presence);
  }

  private isPresenceFresh(presence: UserPresence): boolean {
    const age = Date.now() - new Date(presence.updated_at).getTime();
    return age < PRESENCE_CONFIG.PRESENCE_EXPIRE_MS;
  }

  private async getChatParticipantIds(chatId: string): Promise<string> {
    try {
      const client = supabaseClient.getClient();
      const { data, error } = await client.rpc('get_chat_participant_ids', {
        p_chat_id: chatId,
      });

      if (error) {
        secureLogger.error('Failed to get chat participant IDs', {
          error,
          chatId,
        });
        return '';
      }

      return (data || []).join(',');
    } catch (error) {
      secureLogger.error('Error getting chat participant IDs', {
        error,
        chatId,
      });
      return '';
    }
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Gets current user's presence status
   */
  getCurrentStatus(): OnlineStatus {
    return this.currentStatus;
  }

  /**
   * Manually sets user status (e.g., for Do Not Disturb)
   */
  async setStatus(status: OnlineStatus, customMessage?: string): Promise<void> {
    await this.updateUserPresence(status, customMessage);
  }

  /**
   * Gets cached presence for a user
   */
  getCachedPresence(userId: string): UserPresence | null {
    const presence = this.presenceCache.get(userId);
    return presence && this.isPresenceFresh(presence) ? presence : null;
  }

  /**
   * Clears presence cache
   */
  clearCache(): void {
    this.presenceCache.clear();
  }

  // =====================================================
  // CLEANUP
  // =====================================================

  async cleanup(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Clear pending updates
    for (const timeout of this.pendingUpdates.values()) {
      clearTimeout(timeout);
    }
    this.pendingUpdates.clear();

    // Unsubscribe from all presence channels
    for (const [key] of this.subscriptions) {
      await this.unsubscribeFromPresence(key);
    }

    // Set offline status before cleanup
    const user = authService.getCurrentUser();
    if (user) {
      try {
        await this.updateUserPresence(OnlineStatus.OFFLINE);
      } catch (error) {
        secureLogger.error('Failed to set offline status during cleanup', {
          error,
        });
      }
    }

    this.clearCache();
    this.isInitialized = false;

    secureLogger.info('Presence service cleanup completed');
  }

  /**
   * Gets service statistics
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      currentStatus: this.currentStatus,
      cacheSize: this.presenceCache.size,
      activeSubscriptions: this.subscriptions.size,
      lastActivity: new Date(this.lastActivity).toISOString(),
    };
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const presenceService = new PresenceService();

/**
 * Initialize the presence service - should be called after auth is established
 */
export const initializePresenceService = async (): Promise<void> => {
  await presenceService.initialize();
};

export default presenceService;
