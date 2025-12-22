-- 投稿済み商品テーブル（重複防止用）
CREATE TABLE IF NOT EXISTS posted_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rakuten_item_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  price INTEGER,
  affiliate_url TEXT,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  room_message_id UUID REFERENCES room_messages(id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 重複防止のユニーク制約（同じ商品は1日1回まで）
CREATE UNIQUE INDEX IF NOT EXISTS idx_posted_products_unique_daily
  ON posted_products(rakuten_item_code, (posted_at::date));

-- 検索用インデックス
CREATE INDEX IF NOT EXISTS idx_posted_products_item_code
  ON posted_products(rakuten_item_code);
CREATE INDEX IF NOT EXISTS idx_posted_products_posted_at
  ON posted_products(posted_at DESC);
