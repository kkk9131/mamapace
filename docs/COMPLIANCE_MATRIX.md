# 認証機能コンプライアンス・運用メモ (Phase 2)

## 現在の状態
- 機能面: 登録/ログイン/復元/自動更新/ログアウト OK
- フロント暗号化: 無効（サーバー側でハッシュ/暗号）
- セッション保存: expo-secure-store 優先、なければ AsyncStorage フォールバック
- ログ: 環境変数でログレベル切替（prod=warn、dev=debug既定）
- RLS/監査: 軽量チェック組み込み（RPC `check_rls_enabled` 前提、存在しない場合は警告）

## Secrets/設定
- Supabase URL/Anon Key は以下の優先順で読み込み
  - Expo extra (`app.json` `expo.extra.SUPABASE_URL/ANON_KEY`)
  - EXPO_PUBLIC_* または *.env
  - 直書きなし

## 本番投入前チェック
- 環境分離: dev/stg/prod で Secrets を分割
- ログレベル: prod は warn/error、dev は debug/info
- RLS/監査ログ: 主要テーブルで有効化・稼働確認
- EAS ビルド: `expo-secure-store` を含める
- 監視: Sentry 等を導入（任意）
- CI: Jest テストをRN/Expo向けにモック調整し緑化

## 既知の注意点
- テストは Phase 2 仕様に合わせて期待値とモック要調整
- `check_rls_enabled` RPC が無い環境では RLS チェックは警告ログのみ
