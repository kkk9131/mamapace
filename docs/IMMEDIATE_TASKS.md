## 即時対応タスクリスト（更新）

- ログレベル ENV 切替の導入（完了）
  - `EXPO_PUBLIC_LOG_LEVEL` または `LOG_LEVEL`、デフォルトは prod=warn / dev=debug
- SecureStore 優先の安全保存（完了）
  - `expo-secure-store` が存在すれば使用。なければ AsyncStorage フォールバック
- Supabase RLS/監査の軽量チェック（完了）
  - `validateRLSEnabled()` に軽量チェック追加（RPC `check_rls_enabled` 前提、無ければ警告）
- Secrets 参照の再確認（完了）
  - `app.json` extra / EXPO_PUBLIC_* / env を優先順で読み込み

次にやると良いこと（後でOK）
- RN/Expo テスト環境モック整備（DevMenu/Expoモジュールなど）
- Phase 2 仕様に合わせた期待値修正（クライアント暗号を前提にしない）
- EAS ビルド・Secrets 登録
