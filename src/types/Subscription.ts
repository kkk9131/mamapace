export type SubscriptionStatus =
  | 'inactive'
  | 'in_trial'
  | 'active'
  | 'in_grace'
  | 'canceled'
  | 'expired';

export type SubscriptionPlan = {
  id: string;
  code: string;
  display_name: string;
  product_id?: string | null;
  price_cents: number;
  currency: string; // e.g., 'JPY'
  period: 'month' | 'year';
  trial_days: number;
};

export type UserSubscription = {
  plan_id: string;
  status: SubscriptionStatus;
  current_period_end?: string | null;
};
