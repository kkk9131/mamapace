# ログイン問題デバッグガイド

## 📅 作成日時: 2025-08-11

## 🚨 現在の問題

```
WARN [SECURE] {"data": {"attempts": 1, "error": "ログインに失敗しました。"}, "level": "warn", "message": "Login failed", "timestamp": "2025-08-11T23:16:58.386Z"}
```

## 🔧 実装されたデバッグ機能

### 1. 詳細ログイン解析（debugAuth.ts）

#### `testSupabaseConnection()`
- Supabaseへの基本接続テスト
- セッション状態の確認
- ユーザー状態の確認

#### `debugLogin(email, password)`
- 詳細なログイン分析
- エラーカテゴリの判定
- 推奨アクションの提示

#### `checkEnvironmentConfig()`
- 環境設定の確認
- Supabaseクライアントの状態確認

### 2. LoginScreenの改善機能

#### デバッグボタン
- 「🔧 デバッグ情報」ボタン追加
- 接続状態の即座確認
- コンソールへの詳細出力

#### 詳細エラー表示
- エラーカテゴリの表示
- 推奨アクションの提示
- より具体的なトラブルシューティング情報

## 🔍 トラブルシューティング手順

### Step 1: デバッグ情報の確認

1. ログイン画面で「🔧 デバッグ情報」ボタンをタップ
2. 表示される情報を確認：
   ```
   接続: OK/FAIL
   設定: OK/FAIL
   ユーザー数: [数値]/FAIL
   セッション: Active/None
   ```

### Step 2: 問題パターン別の対処

#### パターン A: 接続失敗（接続: FAIL）

**原因**: Supabaseへの基本接続ができない
**対処**:
1. インターネット接続確認
2. Supabase URL/ANON KEYの確認
3. Supabaseサービス状態確認

#### パターン B: メール未確認

**原因**: `Email not confirmed`
**対処**:
1. Supabaseダッシュボード → Authentication → Users
2. 対象ユーザー → 「...」メニュー → "Confirm email"
3. 手動でメール確認を完了

#### パターン C: 認証情報エラー

**原因**: `Invalid login credentials`
**対処**:
1. メール・パスワードの再確認
2. アカウント存在確認
3. 必要に応じて新規登録

#### パターン D: レート制限

**原因**: `rate limit exceeded`
**対処**:
1. 60秒待機
2. 試行回数のリセット
3. 再試行

## 🛠️ コンソールデバッグ

### ログ確認コマンド

```javascript
// ブラウザコンソールまたはReact Native Debuggerで確認
console.log('=== DEBUG INFO ===');
```

### 期待される情報

```json
{
  "connection": {
    "success": true,
    "connection": "OK",
    "session": "None",
    "user": "None"
  },
  "config": {
    "hasClient": true,
    "clientType": "Initialized"
  },
  "users": {
    "success": true,
    "userCount": 0
  }
}
```

## 🔑 手動アカウント確認方法

### Supabaseダッシュボード操作

1. **ログイン**: [Supabaseダッシュボード](https://supabase.com/dashboard)
2. **プロジェクト選択**: xxnslcwktufssamircxf
3. **Authentication**: 左メニュー → Authentication → Users
4. **ユーザー確認**: 
   - ユーザーが存在するか確認
   - Email Confirmed列を確認
   - 未確認の場合、「...」→「Confirm email」

### SQL直接確認

```sql
-- auth.usersテーブルの確認
SELECT email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'your-email@example.com';

-- user_profilesテーブルの確認
SELECT username, display_name, created_at 
FROM public.user_profiles 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);
```

## 📋 症状別チェックリスト

### ✅ ログイン成功への確認項目

- [ ] Supabase接続が正常（デバッグ情報: 接続 OK）
- [ ] ユーザーアカウントが存在
- [ ] メールアドレスが確認済み
- [ ] パスワードが正しい
- [ ] レート制限に引っかかっていない
- [ ] RLSポリシーが適切に設定されている

### ⚠️ 一般的なエラーと対処

| エラーメッセージ | 原因 | 対処方法 |
|---|---|---|
| `Invalid login credentials` | メール/パスワード不一致 | 認証情報の再確認 |
| `Email not confirmed` | メール未確認 | Supabaseで手動確認 |
| `rate limit exceeded` | レート制限 | 60秒待機後再試行 |
| `Connection failed` | ネットワーク問題 | 接続状態確認 |
| `permission denied` | RLS権限問題 | RLSポリシー確認 |

## 🚀 本番環境移行前の確認

1. **SMTP設定完了**: メール送信が正常動作
2. **メール確認フロー**: 自動確認が動作
3. **デバッグ機能無効化**: 本番ではデバッグボタンを非表示
4. **エラーハンドリング**: ユーザーフレンドリーなエラーメッセージ

## 📞 サポート情報

問題が解決しない場合:
1. コンソールの詳細ログを確認
2. Supabaseダッシュボードでユーザー状態確認  
3. 必要に応じて手動でメール確認を実行
4. レート制限の場合は時間をおいて再試行