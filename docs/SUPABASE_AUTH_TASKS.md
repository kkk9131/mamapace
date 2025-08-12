# 認証統合タスク（Supabase 連携）

本ファイルは進捗管理用のチェックリストです。完了した項目はチェック済みにしています。

## 準備（Secrets/設定）
- [x] C1: `supabaseClient` が Expo の extra/env から `SUPABASE_URL` / `SUPABASE_ANON_KEY` を読むよう変更
- [x] C2: `app.json` の `expo.extra` に `SUPABASE_URL`, `SUPABASE_ANON_KEY` を追加（空値で雛形）
- [x] C3: `.mcp.json` を環境変数参照に変更（`${SUPABASE_URL}` 等）し、直書き鍵を削除

## 接続確認（MCP）
- [x] V1: supabaseMCP で `user_profiles` の簡易 `select count` を実行して疎通確認

## バックエンド（スキーマ/RPC/RLS）
- [x] B0: 拡張の有効化（pgcrypto）
- [x] B1: テーブル作成
  - `user_profiles`, `auth_sessions`, `security_audit_log`
- [x] B2: RLS ポリシーの設定（最小権限）
- [x] B3: 認証用 RPC の作成
  - `register_user_secure`, `authenticate_user_secure`, `refresh_session_token`, `invalidate_session`, `validate_session_token`
- [x] B4: 母子手帳番号の保存は Phase 1 でハッシュ（`salt + sha256`）。RPC 内でハッシュ化して照合

## アプリ側（切替/実装）
- [x] A1: `authService` を Phase 1 仕様に変更（クライアント暗号化を一旦バイパスし、RPC 側でハッシュ）
- [x] A2: `supabaseClient` を extra/env 対応済み
- [x] A3: `useMockAuth` 切替スイッチを `false` へ変更（本番接続時）
- [x] A4: `initializeAllServices` 成功（初期化エラーが出ない）

## フロー疎通
- [x] F1: 新規登録 → セッション保存 → ホーム遷移（Phase 1はローカル保存スキップ）
- [x] F2: ログイン → セッション保存 → ホーム遷移（Phase 1はローカル保存スキップ）
- [x] F3: トークン更新（自動/手動）
- [x] F4: 設定→ログアウト → 認証画面へ

## テスト/監査
- [ ] T1: 主要テストの修正/整備（モックから実サービス前提に段階移行）
- [ ] T2: E2E（Detox）で認証ハッピーパスを検証
- [ ] S1: 監査ログへ主要イベントを記録（PIIなし）

## 補足
- Phase 2 で RN 暗号化 or サーバー側暗号化に移行予定。現段階はハッシュ保存で機能優先。
