export type SubscriptionStatus =
  | 'active'
  | 'cancelled'
  | 'expired'
  | 'in_grace'
  | 'paused';

export type Platform = 'apple' | 'google';

export interface SubscriptionPlan {
  id: string;
  code: string;
  display_name: string;
  description: string | null;
  product_id_ios: string | null;
  product_id_android: string | null;
  price_jpy: number;
  period: 'monthly' | 'yearly';
  trial_days: number;
  active: boolean;
}

export interface Entitlement {
  id: string;
  code: string;
  display_name: string;
  description: string | null;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  platform: Platform;
  original_transaction_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseResult {
  ok: boolean;
  error?: string;
}

// Entitlement codes
export const ENTITLEMENTS = {
  AI_CHAT_UNLIMITED: 'ai_chat_unlimited',
  AI_COMMENT_UNLIMITED: 'ai_comment_unlimited',
  AD_FREE: 'ad_free',
  PRIVATE_ROOM_CREATE: 'private_room_create',
} as const;

export type EntitlementCode = (typeof ENTITLEMENTS)[keyof typeof ENTITLEMENTS];
