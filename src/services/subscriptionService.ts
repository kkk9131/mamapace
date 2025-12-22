import { Platform as RNPlatform } from 'react-native';

import type {
  SubscriptionPlan,
  UserSubscription,
  PurchaseResult,
  Platform,
  EntitlementCode,
} from '../types/subscription';

import { getSupabaseClient } from './supabaseClient';

export const subscriptionService = {
  /**
   * アクティブなプラン一覧を取得
   */
  async listPlans(): Promise<SubscriptionPlan[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('active', true);

    if (error) {
      console.error('[SubscriptionService] listPlans error:', error);
      return [];
    }
    return (data as SubscriptionPlan[]) || [];
  },

  /**
   * 現在のユーザーのサブスクリプション状態を取得
   */
  async getMySubscription(): Promise<UserSubscription | null> {
    const supabase = getSupabaseClient();
    // Use getSession() instead of getUser() to avoid network validation
    // getUser() can fail if token needs refresh, but getSession() returns local data
    const sessionResult = await supabase.auth.getSession();
    const user = sessionResult.data.session?.user;
    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[SubscriptionService] getMySubscription error:', error);
      return null;
    }
    return data as UserSubscription | null;
  },

  /**
   * ユーザーがプレミアム会員かどうか
   */
  isPremium(subscription: UserSubscription | null): boolean {
    if (!subscription) return false;
    return (
      subscription.status === 'active' ||
      subscription.status === 'in_grace'
    );
  },

  /**
   * 特定のエンタイトルメントを持っているか
   */
  hasEntitlement(
    _entitlement: EntitlementCode,
    subscription: UserSubscription | null
  ): boolean {
    // 現在は単純にプレミアム会員なら全特典あり
    return this.isPremium(subscription);
  },

  /**
   * iOS/Android IAP購入
   */
  async purchase(productId: string): Promise<PurchaseResult> {
    try {
      const platform = RNPlatform.OS;
      if (platform !== 'ios' && platform !== 'android') {
        return { ok: false, error: 'このプラットフォームでは購入できません' };
      }

      // Dynamic import to avoid breaking web/tests
      const RNIap = await import('react-native-iap').catch(() => null);
      if (!RNIap) {
        return { ok: false, error: 'IAPモジュールが利用できません' };
      }

      await RNIap.initConnection();

      // Get subscription products
      const products = await RNIap.getSubscriptions({ skus: [productId] }).catch(
        () => []
      );

      if (!products || products.length === 0) {
        return {
          ok: false,
          error: 'ストアに商品が見つかりません。設定を確認してください。',
        };
      }

      // Request subscription
      const purchase = await RNIap.requestSubscription({
        sku: productId,
      });

      if (!purchase) {
        return { ok: false, error: '購入がキャンセルされました' };
      }

      // Verify receipt on server
      const transactionId =
        platform === 'ios'
          ? (purchase as any).originalTransactionIdentifierIOS ||
            (purchase as any).transactionId
          : (purchase as any).purchaseToken;

      const verified = await this.verifyReceipt(
        platform as Platform,
        productId,
        transactionId
      );

      if (verified.ok) {
        // Finish transaction
        await RNIap.finishTransaction({ purchase, isConsumable: false });
      }

      return verified;
    } catch (e: any) {
      console.error('[SubscriptionService] purchase error:', e);
      return { ok: false, error: e?.message || '購入処理中にエラーが発生しました' };
    }
  },

  /**
   * 購入の復元 (iOS)
   */
  async restore(): Promise<PurchaseResult> {
    try {
      if (RNPlatform.OS !== 'ios') {
        return { ok: false, error: 'iOS以外では復元機能は利用できません' };
      }

      const RNIap = await import('react-native-iap').catch(() => null);
      if (!RNIap) {
        return { ok: false, error: 'IAPモジュールが利用できません' };
      }

      await RNIap.initConnection();
      const purchases = await RNIap.getAvailablePurchases();

      if (!purchases || purchases.length === 0) {
        return { ok: false, error: '復元できる購入が見つかりません' };
      }

      // Get the most recent subscription
      const latest = purchases
        .filter((p: any) => p.productId?.includes('premium'))
        .sort(
          (a: any, b: any) =>
            Number(b.transactionDate || 0) - Number(a.transactionDate || 0)
        )[0];

      if (!latest) {
        return { ok: false, error: 'プレミアム購入が見つかりません' };
      }

      const transactionId =
        (latest as any).originalTransactionIdentifierIOS ||
        (latest as any).transactionId;

      return await this.verifyReceipt(
        'apple',
        latest.productId || 'com.mamapace.premium.monthly',
        transactionId
      );
    } catch (e: any) {
      console.error('[SubscriptionService] restore error:', e);
      return { ok: false, error: e?.message || '復元処理中にエラーが発生しました' };
    }
  },

  /**
   * サーバーでレシート検証
   */
  async verifyReceipt(
    platform: Platform,
    productId: string,
    receipt: string
  ): Promise<PurchaseResult> {
    try {
      const supabase = getSupabaseClient();
      const token = (await supabase.auth.getSession()).data.session?.access_token;

      if (!token) {
        return { ok: false, error: 'ログインが必要です' };
      }

      const functionsUrl =
        process.env.EXPO_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '.functions.supabase.co') ||
        '';

      const res = await fetch(`${functionsUrl}/iap-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ platform, productId, receipt }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        return { ok: false, error: json?.error || `HTTP ${res.status}` };
      }

      return { ok: true };
    } catch (e: any) {
      console.error('[SubscriptionService] verifyReceipt error:', e);
      return { ok: false, error: e?.message || 'レシート検証に失敗しました' };
    }
  },
};
