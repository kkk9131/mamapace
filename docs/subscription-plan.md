# サブスクリプション（IAP）計画・実装サマリ

## 目的と範囲
- 目的: ストア課金（App Store/Google Play）でプレミアム機能を提供し、運用コストをカバーしながら価値ある体験を提供。
- 範囲: DB/Edge Functions/クライアント（Service/Context/Hook/Screens/導線）のスケルトン実装と設定手順。

## プラン仕様（決定事項）
- プラン名/コード: プレミアム（月額） / `premium_monthly`
- 価格: ¥500/月（イントロなし）
  - Product ID（iOS）: `com.mamapace.premium.monthly2`
- 通貨/期間: JPY / 月額
- トライアル: なし（trial_days=0）
- 申込要件: 母子手帳認証バッジ保有ユーザーのみ（UI/Edge 両方でガード）
- 提供機能（エンタイトルメント）
  - `ai_chat_unlimited`: AIチャットほぼ無制限
  - `ai_comment_unlimited`: AIコメントほぼ無制限
  - `private_room_create`: 非公開ルーム作成
- 無料プランの制限（案）
  - AIチャット: 1日5メッセージ程度
  - AIコメント: 1日3回程度
  - クールダウン導入（例: 60秒/メッセージ）

## 実装状況（このブランチ）
- DB（Supabase SQL）
  - `supabase/sql/2025-09-13_subscriptions_schema.sql`
    - `subscription_plans`, `user_subscriptions`, `entitlements`, `plan_entitlements`
    - 初期シード: `premium_monthly`（`product_id` 設定、trial なし）
  - `supabase/sql/2025-09-13_subscriptions_policies.sql`
    - RLS: プランは閲覧可/書込は `service_role`、加入は本人のみ閲覧/書込は `service_role`
  - `supabase/sql/2025-09-13_subscriptions_seed_update.sql`
    - 標準価格 ¥980 を `price_cents` に反映（ストアのイントロはストア側で管理）
  - `supabase/sql/2025-09-13_subscriptions_entitlements.sql`
    - エンタイトルメントのシードとプランへの紐付け
- Edge Functions
  - `supabase/functions/iap/index.ts`
    - `POST /verify`: 受領レシートの検証入口（現状ダミー upsert）、母子手帳バッジの適格性チェックを強制
    - `POST /notifications/apple|google`: サーバ通知の受け口（未実装スタブ）
- クライアント（React Native）
  - Service: `src/services/subscriptionService.ts`（プラン取得/加入状態取得/検証呼出の骨組み）
  - Context/Hook: `src/contexts/SubscriptionContext.tsx`, `src/hooks/useSubscription.ts`
  - 画面: `src/screens/PaywallScreen.tsx`, `src/screens/ManageSubscriptionScreen.tsx`
  - 導線: `Settings` に「プレミアムにアップグレード」「サブスクリプションを管理」を追加
  - ナビ: `paywall`/`manageSubscription` を `CustomTabs` に配線、`RootNavigator` を `SubscriptionProvider` でラップ
- ドキュメント
  - `docs/subscriptions.md`（詳細設計・設定のガイド）

## ストア設定（必須作業）
1. App Store Connect / Google Play Console で `premium_monthly` を作成
   - 標準価格: 500 JPY（国別価格で日本を¥500に設定）
   - イントロ: 設定なし（現状は未使用）
2. `productId` を発行し、DB `subscription_plans.product_id` に反映
   - 本リポジトリのマイグレーション: `supabase/sql/2025-09-24_update_premium_monthly_product_id.sql`
3. Supabase Variables を設定
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Apple: `APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`
   - Google: `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_PACKAGE_NAME`

## サーバ検証/通知（実装予定）
- `iap/index.ts` に以下を実装
  - Apple: App Store Server API でレシート検証、ASNV2通知の署名検証
  - Google: Play Developer API でトークン検証、RDN通知の署名/配信検証
  - `user_subscriptions` を状態遷移（active→in_grace→expired など）

## クライアント IAP 配線（実装予定）
- `react-native-iap` を導入
  - 購入/復元時にレシート/トークンを `/iap/verify` へ送信
  - 起動/復帰時に `getAvailablePurchases`→検証→`user_subscriptions` 同期
- UI 価格表示
  - 確定後はストア価格/通貨を優先表示（DBは標準価格の目安保持）

## ロールアウト/運用
- QA: TestFlight/内部テストで購入→自動更新→キャンセルパスを確認
- 監視: Edge Functions のログ、検証/通知失敗時のリトライ戦略
- 変更: エンタイトルメントは DB で管理し、アプリは Context の `hasEntitlement(key)` で評価

## 次のアクション
- ストアで productId と価格（¥500）を確定
- DB の `subscription_plans.product_id` 更新、必要なら `price_cents` 再設定
- `react-native-iap` の導入と Edge の検証/通知実装
- 無料/有料の日次上限の最終決定 → ガード組み込み
