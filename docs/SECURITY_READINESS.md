# 認証機能の現状とリリース前チェックリスト

## 現状（2025-08-09）
- Phase 2（サーバー暗号／クライアントは安全保存のみ）で主要フローは動作確認済み
  - 登録 / ログイン / セッション復元 / 自動更新 / ログアウト
- セッション保存: expo-secure-store 優先、未導入なら AsyncStorage に自動フォールバック
- ログレベル: ENVで切替（prod=warn既定／dev=debug既定）
- Supabase RLS/監査: 軽量チェック導入済（`check_rls_enabled` RPCがない環境では警告）

## すぐに完了済みの本番向け最小ガード
- [x] ログレベル ENV 切替
- [x] SecureStore 優先の安全保存
- [x] RLS/監査の軽チェック
- [x] Secrets 参照の最終確認

## リリース直前に実施すべきこと
1. 環境・Secrets の最終適用
   - dev/stg/prod 各環境の `SUPABASE_URL` / `SUPABASE_ANON_KEY` を Secrets で登録
   - `EXPO_PUBLIC_LOG_LEVEL=warn`（本番）
2. 監視/アラート
   - Sentry 等の導入、DSN を Secrets 登録
   - 重要ログ（認証失敗、ロック、トークン更新失敗）を通知
3. RLS/監査の厳密確認
   - `check_rls_enabled` RPC の整備と結果確認
   - 監査ログ（`security_audit_log`）が意図通り記録されるか
4. CI/CD とビルド
   - RN/Expo モジュールのモック整備で Jest を緑化
   - EAS ビルド設定と Secrets 登録（`expo-secure-store` を含める）
5. ドキュメント/Runbook
   - インシデント対応（鍵/トークン失効、ロック解除）
   - ログレベル/Secrets/環境切替の手順

## 影響ファイル
- `src/services/secureSessionStore.ts`: SecureStore優先保存
- `src/services/authService.ts`: Phase 2 分岐・refresh/needsRefresh 統一
- `src/utils/privacyProtection.ts`: ログレベル ENV 切替
- `src/services/supabaseClient.ts`: Secrets読取とRLS軽チェック
- `src/utils/serviceInitializer.ts`: RLS 結果をヘルスに反映
