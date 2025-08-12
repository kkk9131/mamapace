# リリース直前チェックリスト（認証機能・Phase 2）

## 設定・Secrets
- [ ] `SUPABASE_URL` / `SUPABASE_ANON_KEY`（prod/stg/dev）をSecretsで登録
- [ ] `EXPO_PUBLIC_LOG_LEVEL=warn`（本番）
- [ ] EAS Build の Secrets に認証情報を登録

## 安全保存
- [ ] `expo-secure-store` がアプリに同梱されている
- [ ] 端末でのセッション保存/復元/削除が手動確認済み

## サーバー側設定
- [ ] RLS 有効（主要テーブル: `user_profiles`, `auth_sessions`, `security_audit_log`, `encrypted_maternal_health_records`）
- [ ] 監査ログが記録されることを確認
- [ ] 可能なら `check_rls_enabled` RPC を用意し、アプリの軽量チェックで `isValid=true` を確認

## 監視・アラート
- [ ] Sentry（または同等）導入、DSN を Secrets 登録
- [ ] 重要イベント（ログイン失敗、ロック、トークン更新失敗）を通知

## CI/CD
- [ ] Jest テスト緑化（RN/Expo モジュールのモック整備）
- [ ] EAS ビルドパイプラインで prod/stg/dev のビルド動作確認

## ドキュメント/運用
- [ ] インシデントRunbook（鍵/トークン失効、ロック解除）
- [ ] Secrets 回転の手順（スケジュール/担当）
- [ ] ログレベル・環境切替の手順

## 動作チェック（本番相当）
- [ ] 新規登録 → セッション保存 → 復元
- [ ] ログイン → 自動更新 → ログアウト
- [ ] エラーメッセージが一般化されており、PIIが露出しない
