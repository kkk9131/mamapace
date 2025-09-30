# 決済（サブスクリプション）未完了要件と実装タスク

## 概要
- 対象: プレミアム（月額 ¥500、母子手帳バッジ保有者のみ、トライアルなし）
- 現状: スキーマ/画面/導線/価格反映は完了。購入・復元・サーバ検証・通知処理は未実装。
- 目的: iOS（優先）→ Android（後追い）の順で決済フローを本稼働させる。

## プラットフォーム要件
- iOS（優先）
  - ライブラリ: `react-native-iap`
- Product ID: `com.mamapace.premium`
  - Store 設定: App Store Connect で日本の標準価格 ¥500、Intro なし
  - 購入/復元: `requestSubscription` / `getAvailablePurchases` を使用
- Android（後追い）
  - Google Play Console: 同等のサブスクリプション作成（価格 ¥500）
  - Google Play Billing / `react-native-iap` で配線

## サーバ検証要件（Edge Functions）
- エンドポイント: `/iap/verify`（POST）
  - 入力: `{ platform: 'apple'|'google', productId, receipt }`
  - 出力: `{ ok: true }` or `{ error }`
  - 前提: 認証済み（Authorization: Bearer <token>）
  - バッジ要件: `user_profiles.maternal_verified = true` を必須（実装済み）
- Apple 検証（実装）
  - App Store Server API（JWS/JWT）でレシート/トランザクション確認
  - 環境変数: `APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`
  - 参考: サンドボックス/本番の両環境で検証可。自動判別または構成で切替。
- Google 検証（後追い）
  - Play Developer API で purchaseToken 検証
  - 環境変数: `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_PACKAGE_NAME`

## 通知処理要件（状態同期）
- Apple ASNV2（App Store Server Notifications v2）
  - エンドポイント: `/iap/notifications/apple`
  - 署名（signedPayload）検証 → サブスク状態更新（更新/失効/返金等）
- Google RDN（Real‑time Developer Notifications）
  - Pub/Sub 経由の通知を Edge へ転送 or 監視用バックエンド
  - payload 検証 → 状態更新

## データモデルと状態遷移
- テーブル: `subscription_plans`, `user_subscriptions`, `entitlements`, `plan_entitlements`
- 状態: `inactive` → `active` → `in_grace` → `expired` / `canceled`
- 更新ルール（例）
  - 初回購入: トライアルなしのため `active`
  - 更新成功: `active` で次回 `current_period_end` を更新
  - 失敗/キャンセル: `in_grace`→期限後 `expired` or 即時 `canceled`
- 冪等性: user_id + plan_id で upsert。通知は eventId で重複排除。

## クライアント要件（アプリ）
- 購入/復元
  - iOS: `react-native-iap` で `requestSubscription`（購入） / `getAvailablePurchases`（復元）
  - 成功時: レシート/トークンを `/iap/verify` に送信 → Context を `refresh()`
- 起動/復帰同期
  - アプリ起動・フォアグラウンド復帰時に購入情報を取得→検証→`user_subscriptions` 同期
- UI/UX
  - Paywall: 価格（¥500）表示、バッジ未所持時の無効化を表示（実装済み）
  - Manage: OS のサブスク管理画面リンク（実装済み）
  - 失敗時: ネットワーク/検証エラーのユーザー向け案内

## 環境変数・設定
- Supabase Functions（Edge）
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
  - Apple: `APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`
  - Google: `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_PACKAGE_NAME`
- クライアント（必要に応じて）
  - `EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL`（関数URLの明示）

## セキュリティ/コンプライアンス
- 秘密鍵は Edge の環境変数にのみ保管（クライアントへ渡さない）
- レシート等の保存は最小化（必要なら `last_receipt_snapshot` をマスク/サマリ）
- RLS: `user_subscriptions` 読取は本人のみ、書込は `service_role` のみ
- レート制限/重複防止: 既存の基本実装を維持・強化
- ログ: PII・秘匿情報を除外、最小限

## QA/監視
- サンドボックス/TestFlight で購入→更新→解約/失効→復元の一連を検証
- Edge Functions のログ監視・失敗時のリトライ方針
- メトリクス（任意）: 変換率、解約率、失敗率

## 受け入れ基準（サンプル）
- iOS で
- [ ] バッジ保有ユーザーが購入でき、DBに `active` が反映
  - [ ] 復元で既存サブスクが反映
  - [ ] 通知（更新/キャンセル）で状態が自動更新
  - [ ] バッジ未所持ユーザーは購入不能
  - [ ] Paywall 価格表示が正（¥500 / 月）

## 実装タスク（チェックリスト）
1) iOS・IAP 配線
- [x] 依存追加: `react-native-iap`
- [ ] iOS 設定（Capabilities/StoreKit/Test用コンフィグ）
- [x] `subscriptionService.purchase/restore` 実装
- [x] Paywall から購入/復元を呼び出し

2) Edge `/iap/verify` 本実装
- [x] Apple JWT 署名生成（鍵・Issuer/Key ID・Private Key）
- [x] レシート検証 → `user_subscriptions` 更新（冪等）
- [ ] エラー分類（無効レシート/期限切れ/ネットワーク等）

3) 通知処理
- [ ] `/iap/notifications/apple` 実装（ASNV2 署名検証）
- [ ] 種類別の状態更新（更新/解約/返金/グレース）
- [ ] 重複排除・リトライ

4) 起動/復帰時の同期
- [x] `getAvailablePurchases`→`/iap/verify` でサブスク整合
- [ ] 失敗時の再試行/UX

5) Android（後追い）
- [ ] Play Console 設定（¥500）
- [ ] Google 検証実装（purchaseToken）
- [ ] 通知（RDN）処理

6) 表示/運用
- [ ] ストアローカライズ価格での表示（任意）
- [ ] ドキュメント更新・運用手順/トラブルシュート追加

## 参照
- 設計・方針: `docs/subscriptions.md`, `docs/subscription-plan.md`
- 実装ファイル例
  - Edge: `supabase/functions/iap/index.ts`
  - App: `src/services/subscriptionService.ts`
  - Context/Hook: `src/contexts/SubscriptionContext.tsx`, `src/hooks/useSubscription.ts`
  - UI: `src/screens/PaywallScreen.tsx`, `src/screens/ManageSubscriptionScreen.tsx`
