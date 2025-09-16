-- Subscriptions schema (initial)
-- Notes:
-- - This sets up plans and user subscription tracking for store IAP.
-- - Pricing is stored in minor units (cents). Currency: JP (JPY) initially.
-- - Entitlements are future-proofing for feature gating; can be wired later.

begin;

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- e.g., 'premium_monthly'
  display_name text not null, -- e.g., 'プレミアム（月額）'
  store text not null check (store in ('apple', 'google', 'shared')) default 'shared',
  product_id text, -- store product id (nullable until ready)
  price_cents integer not null check (price_cents >= 0), -- e.g., 48000 for ¥480? No: minor units for JPY are 1, so 480 means ¥480
  currency text not null default 'JPY',
  period text not null check (period in ('month','year')) default 'month',
  trial_days integer not null default 0,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create trigger set_timestamp_subscription_plans
before update on public.subscription_plans
for each row execute procedure public.trigger_set_timestamp();

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  plan_id uuid not null references public.subscription_plans (id) on delete restrict,
  status text not null check (status in ('inactive','in_trial','active','in_grace','canceled','expired')) default 'inactive',
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  canceled_at timestamp with time zone,
  provider_original_transaction_id text, -- Apple originalTransactionId
  provider_subscription_id text, -- Google purchase token / subscription id
  last_receipt_snapshot jsonb, -- latest raw receipt snapshot (sanitized)
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (user_id, plan_id)
);

create index if not exists idx_user_subscriptions_user on public.user_subscriptions(user_id);
create index if not exists idx_user_subscriptions_plan on public.user_subscriptions(plan_id);

create trigger set_timestamp_user_subscriptions
before update on public.user_subscriptions
for each row execute procedure public.trigger_set_timestamp();

-- Optional: entitlements for future gating
create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, -- e.g., 'feature_x'
  description text
);

create table if not exists public.plan_entitlements (
  plan_id uuid not null references public.subscription_plans(id) on delete cascade,
  entitlement_id uuid not null references public.entitlements(id) on delete cascade,
  primary key (plan_id, entitlement_id)
);

-- Seed initial plan (without product_id yet). JPY minor unit is 1.
-- NOTE: Set price_cents to desired amount in JPY (e.g., 480 for ¥480) and update product_id later.
insert into public.subscription_plans (code, display_name, store, product_id, price_cents, currency, period, trial_days, active)
values ('premium_monthly', 'プレミアム（月額）', 'shared', null, 500, 'JPY', 'month', 7, true)
on conflict (code) do nothing;

commit;
