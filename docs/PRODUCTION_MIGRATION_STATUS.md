# 本番環境移行ステータス

## 📅 更新日時: 2025-08-11

## 🎯 現在の進捗状況

### ✅ 完了済み

#### DB/RLS/権限
- ✅ v2 RPC（auth.uid()基準）導入済（posts/reactions/comments/profile/follow）
- ✅ 直接テーブルDMLはREVOKE済、v2 RPCはauthenticatedのみGRANT
- ✅ Realtimeは必要テーブルのみ有効化
- ✅ user_followsを含む08_social.sql適用・RLS・publication確認済

#### クライアント実装
- ✅ postServiceをv2へ全面置換、p_user_id撤廃
- ✅ プロフィール/フォロー機能を実装（profileService追加、UI統合）
- ✅ 認証画面をSupabase Auth（email/password）対応
- ✅ loginWithEmail/registerWithEmail追加
- ✅ ディープリンク用scheme: "mamapace"をapp.jsonに追加
- ✅ サインアップでemailRedirectTo = mamapace://auth-callbackを送る実装済

#### ナビゲーション/UX
- ✅ NavigationContainer追加
- ✅ ProfileScreenのフォーカス再読込・各画面導線OK

### 🚧 実装済み（暫定対応）

#### メール送信問題の回避策
- ✅ `devAuthHelper.ts` - レート制限回避とメール確認スキップ機能
- ✅ `signUpWithAutoConfirm` - サインアップ後の自動ログイン試行
- ✅ レート制限エラーの適切なハンドリング
- ✅ カウントダウンタイマーによるリトライ制御
- ✅ メール確認待ちユーザーへの適切なフィードバック

### ❌ 未解決の問題

#### Supabase Auth（メール送信）
- ❌ エラー: 「email rate limit exceeded」
- ❌ エラー: 「Error sending confirmation/invite email」
- ❌ カスタムSMTP未設定
- ❌ Site URL未設定（PCでメールリンクを開いた場合404）

#### 認証フロー
- ⚠️ メール確認が必要な環境では、サインアップ後にログインできない
- ⚠️ v2 RPCがpermission denied（認証されていないため）

## 🔧 暫定的な解決策

### 1. 開発環境での検証継続

```typescript
// devAuthHelper.ts を使用した暫定的な認証フロー
import { signUpWithAutoConfirm } from './services/devAuthHelper';

// レート制限を回避しつつサインアップ
const result = await signUpWithAutoConfirm(email, password, metadata);
```

### 2. Supabaseダッシュボードでの手動確認

1. Supabase Dashboard → Authentication → Users
2. 対象ユーザーの「...」メニュー → "Confirm email"
3. アプリでログインを再試行

### 3. Admin APIでの確認（Service Role Key必要）

```javascript
// バックエンドまたはAdmin環境で実行
const { data, error } = await supabase.auth.admin.updateUserById(
  userId,
  { email_confirmed_at: new Date().toISOString() }
);
```

## 📝 本番環境への移行に必要な作業

### 1. SMTP設定

#### Custom SMTP Provider設定
- [ ] SendGrid/Postmark/Resend/AWS SESのいずれかを選定
- [ ] APIキーの取得と設定
- [ ] Fromドメイン（mama-pace.com）の設定

#### ドメイン認証
- [ ] SPFレコードの設定
- [ ] DKIM認証の設定
- [ ] ドメイン検証の完了

### 2. Supabase設定

#### Authentication Settings
- [ ] Site URL: 本番URLまたはステージングURL（https://mama-pace.com）
- [ ] Additional Redirect URLs: mamapace://auth-callback
- [ ] Email Templates: カスタマイズ
- [ ] Rate Limits: 本番用に調整

### 3. アプリ側の改善

#### ディープリンク処理
- [ ] mamapace://auth-callbackの適切なハンドリング
- [ ] メール確認完了後の自動ログイン
- [ ] エラー時のフォールバック

#### エラーハンドリング
- [x] レート制限エラーの表示
- [x] リトライメカニズム
- [ ] オフライン時の処理

## 🧪 検証手順

### 認証フロー検証

1. **新規登録**
   ```
   1. サインアップ画面でメール/パスワード入力
   2. 「登録」ボタンタップ
   3. メール確認メッセージの表示確認
   4. （手動確認後）ログイン画面からログイン
   ```

2. **ログイン**
   ```
   1. ログイン画面でメール/パスワード入力
   2. 「ログイン」ボタンタップ
   3. ホーム画面への遷移確認
   ```

3. **v2 RPC動作確認**
   ```
   1. ログイン後、プロフィール表示
   2. 投稿作成・表示
   3. いいね・コメント機能
   4. フォロー機能
   ```

## 🚀 デプロイチェックリスト

- [ ] SMTP設定完了
- [ ] ドメイン認証完了
- [ ] Supabase本番設定完了
- [ ] 認証フロー全体のE2Eテスト合格
- [ ] v2 RPC全機能の動作確認
- [ ] Realtime機能の動作確認
- [ ] ロールバック手順の文書化
- [ ] 本番環境へのデプロイ

## 📊 リスクと対策

### リスク
1. **メール送信失敗**: レート制限やSMTP設定不備
2. **認証不能**: メール確認ができない
3. **データアクセス不能**: RLS/RPCの権限不足

### 対策
1. **段階的移行**: まず少数ユーザーでテスト
2. **フォールバック**: Mock認証への切り替え可能
3. **監視強化**: エラーログの詳細監視

## 📚 参考資料

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Email Rate Limits](https://supabase.com/docs/guides/platform/going-into-prod#email-rate-limits)
- [Custom SMTP Setup](https://supabase.com/docs/guides/auth/auth-smtp)