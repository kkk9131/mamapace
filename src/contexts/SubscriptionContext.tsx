import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';
import type { Product } from 'react-native-iap';

import { subscriptionService } from '../services/subscriptionService';
import type {
  SubscriptionStatus,
  UserSubscription,
  SubscriptionPlan,
} from '../types/Subscription';

import { useAuth } from './AuthContext';

type SubscriptionState = {
  loading: boolean;
  status: SubscriptionStatus | null;
  plan: SubscriptionPlan | null;
  expiresAt: string | null;
  products: Product[];
  productsLoading: boolean;
  refresh: () => Promise<void>;
  purchase: () => Promise<{ ok: boolean; error?: string }>;
  restore: () => Promise<{ ok: boolean; error?: string }>;
  hasEntitlement: (key: string) => boolean;
};

const Ctx = createContext<SubscriptionState | undefined>(undefined);

export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setStatus(null);
      setPlan(null);
      setExpiresAt(null);
      return;
    }
    setLoading(true);
    try {
      const [plans, mine] = await Promise.all([
        subscriptionService.listPlans(),
        subscriptionService.getMySubscription(),
      ]);
      // Choose current plan by subscription if exists; otherwise default to premium_monthly or first active plan
      let p = mine
        ? plans.find(pl => pl.id === (mine as any).plan_id) || null
        : null;
      if (!p) {
        p = plans.find(pl => pl.code === 'premium_monthly') || plans[0] || null;
      }
      setPlan(p);
      setStatus((mine?.status as SubscriptionStatus) || null);
      setExpiresAt((mine?.current_period_end as string) || null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setProductsLoading(true);
      try {
        const fetched = await subscriptionService.fetchProducts();
        if (mounted) {
          setProducts(fetched);
        }
      } catch {
        if (mounted) {
          setProducts([]);
        }
      } finally {
        if (mounted) {
          setProductsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // On app start and when returning to foreground, attempt restore->verify to sync server state
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (user) {
          const res = await subscriptionService.restore();
          // Even if restore fails (no purchases), refresh to pick up any server changes
          if (mounted) {
            await refresh();
          }
        } else {
          await refresh();
        }
      } catch {
        if (mounted) {
          await refresh();
        }
      }
    })();

    const sub = AppState.addEventListener('change', async state => {
      if (state === 'active' && user) {
        try {
          await subscriptionService.restore();
        } catch {}
        await refresh();
      }
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [user, refresh]);

  const purchase = useCallback(async () => {
    const primaryProductId = products[0]?.productId || null;
    const res = await subscriptionService.purchase(primaryProductId);
    if (res.ok) {
      await refresh();
    }
    return res;
  }, [products, refresh]);

  const restore = useCallback(async () => {
    const res = await subscriptionService.restore();
    if (res.ok) {
      await refresh();
    }
    return res;
  }, [refresh]);

  const hasEntitlement = useCallback(
    (key: string) => {
      return subscriptionService.hasEntitlement(key, status);
    },
    [status],
  );

  const value = useMemo(
    () => ({
      loading,
      status,
      plan,
      expiresAt,
      products,
      productsLoading,
      refresh,
      purchase,
      restore,
      hasEntitlement,
    }),
    [
      loading,
      status,
      plan,
      expiresAt,
      products,
      productsLoading,
      refresh,
      purchase,
      restore,
      hasEntitlement,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return ctx;
}
