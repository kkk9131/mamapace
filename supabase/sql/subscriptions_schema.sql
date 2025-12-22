-- ============================================================
-- Mama Premium Subscription Schema
-- ============================================================

-- 1. Subscription Plans (プラン定義)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,              -- 'mama_premium_monthly'
  display_name TEXT NOT NULL,             -- 'ママプレミアム'
  description TEXT,
  product_id_ios TEXT,                    -- 'com.mamapace.premium.monthly'
  product_id_android TEXT,                -- 'mama_premium_monthly'
  price_jpy INTEGER NOT NULL DEFAULT 480, -- 価格（円）
  period TEXT NOT NULL DEFAULT 'monthly', -- 'monthly', 'yearly'
  trial_days INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Entitlements (特典定義)
CREATE TABLE IF NOT EXISTS entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,              -- 'ai_chat_unlimited', 'ad_free'
  display_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Plan-Entitlements Junction (プラン-特典紐付け)
CREATE TABLE IF NOT EXISTS plan_entitlements (
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  entitlement_id UUID NOT NULL REFERENCES entitlements(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, entitlement_id)
);

-- 4. User Subscriptions (ユーザーの購読状態)
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'cancelled', 'expired', 'in_grace', 'paused'
  platform TEXT NOT NULL,                 -- 'apple', 'google'
  original_transaction_id TEXT,           -- Store transaction ID
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id)  -- 1ユーザー1サブスクリプション
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_period_end ON user_subscriptions(current_period_end);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Plans: 誰でも閲覧可能
CREATE POLICY "Plans are viewable by everyone"
  ON subscription_plans FOR SELECT
  USING (true);

-- Entitlements: 誰でも閲覧可能
CREATE POLICY "Entitlements are viewable by everyone"
  ON entitlements FOR SELECT
  USING (true);

-- Plan-Entitlements: 誰でも閲覧可能
CREATE POLICY "Plan entitlements are viewable by everyone"
  ON plan_entitlements FOR SELECT
  USING (true);

-- User Subscriptions: 本人のみ閲覧可能
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- User Subscriptions: service_roleのみ書き込み可能（Edge Functionから）
CREATE POLICY "Service role can manage subscriptions"
  ON user_subscriptions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- Seed Data (初期データ)
-- ============================================================

-- プラン
INSERT INTO subscription_plans (code, display_name, description, product_id_ios, product_id_android, price_jpy, period, trial_days)
VALUES (
  'mama_premium_monthly',
  'ママプレミアム',
  'AIチャット・コメント無制限、広告非表示、非公開ルーム作成',
  'com.mamapace.premium.monthly',
  'mama_premium_monthly',
  480,
  'monthly',
  0
)
ON CONFLICT (code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  product_id_ios = EXCLUDED.product_id_ios,
  product_id_android = EXCLUDED.product_id_android,
  price_jpy = EXCLUDED.price_jpy,
  updated_at = now();

-- 特典
INSERT INTO entitlements (code, display_name, description) VALUES
  ('ai_chat_unlimited', 'AIチャット無制限', '1日の制限なくAIチャットを利用可能'),
  ('ai_comment_unlimited', 'AIコメント無制限', '1日の制限なくAIコメントを利用可能'),
  ('ad_free', '広告非表示', 'アプリ内の広告を非表示'),
  ('private_room_create', '非公開ルーム作成', '非公開ルームを作成可能')
ON CONFLICT (code) DO NOTHING;

-- プラン-特典紐付け
INSERT INTO plan_entitlements (plan_id, entitlement_id)
SELECT p.id, e.id
FROM subscription_plans p, entitlements e
WHERE p.code = 'mama_premium_monthly'
  AND e.code IN ('ai_chat_unlimited', 'ai_comment_unlimited', 'ad_free', 'private_room_create')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Updated_at Trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
