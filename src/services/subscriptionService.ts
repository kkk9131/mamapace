import { Platform as RNPlatform } from 'react-native';

import type {
  SubscriptionPlan,
  UserSubscription,
  SubscriptionStatus,
} from '../types/Subscription';

import { getSupabaseClient } from './supabaseClient';

export type Platform = 'apple' | 'google';

export type PurchaseResult = {
  ok: boolean;
  error?: string;
};

// Placeholder: this will be wired to react-native-iap later
export const subscriptionService = {
  async listPlans(): Promise<SubscriptionPlan[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('subscription_plans')
      .select(
        'id, code, display_name, product_id, price_cents, currency, period, trial_days',
      )
      .eq('active', true);
    if (error) {
      return [];
    }
    return (data as SubscriptionPlan[]) || [];
  },

  async getMySubscription(): Promise<UserSubscription | null> {
    const supabase = getSupabaseClient();
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      return null;
    }
    const { data } = await supabase
      .from('user_subscriptions')
      .select('plan_id, status, current_period_end')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    return (data as any) || null;
  },

  async verifyReceipt(platform: Platform, productId: string, receipt: string) {
    // send to Edge Function for server-side verification (stubbed)
    const supabase = getSupabaseClient();
    const url = `${process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || (supabase as any).functionsUrl || ''}/iap/verify`;
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ platform, productId, receipt }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: j?.error || `HTTP ${res.status}`,
      } as PurchaseResult;
    }
    return { ok: true } as PurchaseResult;
  },

  // iOS IAP purchase using react-native-iap
  async purchase(productId: string): Promise<PurchaseResult> {
    try {
      if (RNPlatform.OS !== 'ios') {
        return { ok: false, error: 'Unsupported platform' };
      }
      // Dynamically import to avoid breaking tests/web
      const RNIap: any = await import('react-native-iap').catch(() => null);
      if (!RNIap) {
        return { ok: false, error: 'IAP module not available' };
      }

      await RNIap.initConnection();

      // Resolve product first to surface configuration issues before showing the sheet
      const products = await RNIap.getSubscriptions([productId]).catch(
        () => [],
      );
      if (!products || !Array.isArray(products)) {
        return { ok: false, error: 'IAP products not available' };
      }
      if (products.length === 0) {
        return {
          ok: false,
          error:
            'App Storeに対象商品が見つかりません。Product IDとアプリの関連付け・ローカライズ・価格設定を確認してください。',
        };
      }
      if (typeof RNIap.requestSubscription !== 'function') {
        return { ok: false, error: 'requestSubscription not available' };
      }

      return await new Promise<PurchaseResult>(resolve => {
        let settled = false;
        const listeners: {
          purchase?: { remove: () => void };
          error?: { remove: () => void };
        } = {};

        const cleanup = () => {
          if (settled) {
            return;
          }
          settled = true;
          try {
            listeners.purchase?.remove();
          } catch {}
          try {
            listeners.error?.remove();
          } catch {}
        };

        const resolveWith = (result: PurchaseResult) => {
          if (!settled) {
            cleanup();
            resolve(result);
          }
        };

        const handleVerification = async (
          receiptId?: string,
          purchase?: any,
        ) => {
          if (!receiptId) {
            resolveWith({ ok: false, error: 'Could not resolve transaction' });
            return;
          }
          try {
            const verified = await this.verifyReceipt(
              'apple',
              String(productId),
              receiptId,
            );
            if (verified.ok && purchase) {
              try {
                if (typeof RNIap.finishTransaction === 'function') {
                  await RNIap.finishTransaction(purchase, false);
                }
              } catch (finishErr: any) {
                resolveWith({
                  ok: false,
                  error: `finishTransaction failed: ${String(
                    finishErr?.message || finishErr
                  )}`,
                });
                return;
              }
            }
            resolveWith(verified);
          } catch (err: any) {
            resolveWith({ ok: false, error: String(err?.message || err) });
          }
        };

        listeners.purchase = RNIap.purchaseUpdatedListener(
          async (purchase: any) => {
            if (!purchase || settled) {
              return;
            }
            const matchesProduct =
              !purchase.productId ||
              purchase.productId === productId ||
              String(purchase.productId) === String(productId);
            if (!matchesProduct) {
              return;
            }

            const origTxId: string | undefined =
              purchase.originalTransactionIdentifierIOS ||
              purchase.originalTransactionId ||
              purchase.transactionId;

            if (origTxId) {
              await handleVerification(origTxId, purchase);
              return;
            }

            try {
              const available: any[] =
                (await RNIap.getAvailablePurchases()) || [];
              const recent = available
                .filter(
                  p =>
                    p?.productId === productId ||
                    String(p?.productId) === String(productId),
                )
                .sort(
                  (a, b) =>
                    Number(b.transactionDate || 0) -
                    Number(a.transactionDate || 0),
                )[0];
              const fallbackId =
                recent?.originalTransactionIdentifierIOS ||
                recent?.originalTransactionId ||
                recent?.transactionId;
              await handleVerification(fallbackId, purchase);
            } catch (err: any) {
              resolveWith({
                ok: false,
                error: `Failed to fetch purchases: ${String(
                  err?.message || err,
                )}`,
              });
            }
          },
        );

        listeners.error = RNIap.purchaseErrorListener((error: any) => {
          if (settled) {
            return;
          }
          resolveWith({ ok: false, error: String(error?.message || error) });
        });

        (async () => {
          try {
            await RNIap.requestSubscription({ sku: String(productId) });
          } catch (err: any) {
            resolveWith({ ok: false, error: String(err?.message || err) });
          }
        })().catch(() => {});
      });
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  },

  // iOS restore
  async restore(): Promise<PurchaseResult> {
    try {
      if (RNPlatform.OS !== 'ios') {
        return { ok: false, error: 'Unsupported platform' };
      }
      const RNIap: any = await import('react-native-iap').catch(() => null);
      if (!RNIap) {
        return { ok: false, error: 'IAP module not available' };
      }
      await RNIap.initConnection();

      const purchases: any[] = (await RNIap.getAvailablePurchases()) || [];
      if (!purchases.length) {
        return { ok: false, error: 'No purchases found' };
      }
      // If multiple, verify the most recent subscription-like purchase
      const latest = purchases.sort(
        (a, b) =>
          Number(b.transactionDate || 0) - Number(a.transactionDate || 0),
      )[0];
      const productId = latest?.productId || 'com.mamapace.premium.monthly';
      const origTxId: string | undefined =
        latest?.originalTransactionIdentifierIOS ||
        latest?.transactionId ||
        latest?.originalTransactionId;
      if (!origTxId) {
        return { ok: false, error: 'Could not resolve transaction' };
      }

      const verified = await this.verifyReceipt(
        'apple',
        String(productId),
        origTxId,
      );
      return verified;
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  },
  hasEntitlement(_key: string, status?: SubscriptionStatus | null): boolean {
    // For now, simple rule: active or in_trial has all entitlements
    return (
      status === 'active' || status === 'in_trial' || status === 'in_grace'
    );
  },
};
