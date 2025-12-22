import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

import type {
  SubscriptionPlan,
  UserSubscription,
  PurchaseResult,
  EntitlementCode,
} from '../types/subscription';
import { ENTITLEMENTS } from '../types/subscription';
import { subscriptionService } from '../services/subscriptionService';
import { useAuth } from './AuthContext';

interface SubscriptionContextValue {
  // State
  plan: SubscriptionPlan | null;
  subscription: UserSubscription | null;
  loading: boolean;

  // Computed
  isPremium: boolean;

  // Actions
  purchase: (productId: string) => Promise<PurchaseResult>;
  restore: () => Promise<PurchaseResult>;
  refresh: () => Promise<void>;

  // Entitlement checks
  hasEntitlement: (code: EntitlementCode) => boolean;
  canUseUnlimitedAIChat: boolean;
  canUseUnlimitedAIComment: boolean;
  isAdFree: boolean;
  canCreatePrivateRoom: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [plans, sub] = await Promise.all([
        subscriptionService.listPlans(),
        subscriptionService.getMySubscription(),
      ]);
      setPlan(plans[0] || null);
      setSubscription(sub);
    } catch (e) {
      console.error('[SubscriptionContext] refresh error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      refresh();
    } else {
      setPlan(null);
      setSubscription(null);
      setLoading(false);
    }
  }, [user, refresh]);

  const isPremium = useMemo(
    () => subscriptionService.isPremium(subscription),
    [subscription]
  );

  const hasEntitlement = useCallback(
    (code: EntitlementCode) => subscriptionService.hasEntitlement(code, subscription),
    [subscription]
  );

  const purchase = useCallback(
    async (productId: string): Promise<PurchaseResult> => {
      const result = await subscriptionService.purchase(productId);
      if (result.ok) {
        await refresh();
      }
      return result;
    },
    [refresh]
  );

  const restore = useCallback(async (): Promise<PurchaseResult> => {
    const result = await subscriptionService.restore();
    if (result.ok) {
      await refresh();
    }
    return result;
  }, [refresh]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      plan,
      subscription,
      loading,
      isPremium,
      purchase,
      restore,
      refresh,
      hasEntitlement,
      canUseUnlimitedAIChat: hasEntitlement(ENTITLEMENTS.AI_CHAT_UNLIMITED),
      canUseUnlimitedAIComment: hasEntitlement(ENTITLEMENTS.AI_COMMENT_UNLIMITED),
      isAdFree: hasEntitlement(ENTITLEMENTS.AD_FREE),
      canCreatePrivateRoom: hasEntitlement(ENTITLEMENTS.PRIVATE_ROOM_CREATE),
    }),
    [plan, subscription, loading, isPremium, purchase, restore, refresh, hasEntitlement]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
}
