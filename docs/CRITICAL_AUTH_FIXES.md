# 🔥 重要な認証問題修正

## 📅 修正日時: 2025-08-11

## 🚨 根本問題の特定と修正

### ❌ 根本的な問題
**症状**: ログイン成功後も「ログインが必要です」が表示され続ける
**原因**: 複数の重大な問題が重なっていた

### 🔍 特定した問題

#### 1. セッション復元の不備
**問題**: `restoreSession`関数が古い`authService.loadSession()`を使用
**影響**: アプリ起動時にSupabaseセッションが復元されない
**修正**: Supabase直接のセッション取得と適切なプロフィール読み込み

#### 2. 認証状態変更の未処理
**問題**: SupabaseのonAuthStateChangeイベントをAuthContextでリッスンしていない
**影響**: ログイン成功時に認証状態が正しく更新されない
**修正**: リアルタイムauth state change listenerの実装

#### 3. プロフィール初期化の失敗
**問題**: RPC関数が存在しない場合のフォールバック不備
**影響**: 新規ユーザーでプロフィール作成に失敗
**修正**: RPC → 直接INSERT → メモリプロフィールの多段階フォールバック

## 🛠️ 実装した修正内容

### 1. セッション復元の完全修正

```typescript
// Before: 古いサービスを使用
const user = await svc.loadSession();

// After: Supabase直接セッション処理
const { data: { session }, error } = await client.auth.getSession();
if (session && session.user) {
  const profile = await getMyProfile();
  // または ensureUserProfile でプロフィール初期化
}
```

### 2. リアルタイム認証状態監視

```typescript
// 新規追加: Supabase auth state change listener
client.auth.onAuthStateChange(async (event, session) => {
  switch (event) {
    case 'SIGNED_IN':
      // プロフィール取得/初期化してユーザー状態設定
      break;
    case 'SIGNED_OUT':
      // ログアウト処理
      break;
    case 'TOKEN_REFRESHED':
      // トークン更新処理
      break;
  }
});
```

### 3. プロフィール初期化の堅牢化

```typescript
// 多段階フォールバック
try {
  // 1. RPC関数での作成
  result = await client.rpc('create_user_profile_v2', params);
} catch {
  // 2. 直接テーブルINSERT
  result = await client.from('user_profiles').insert(data);
} catch {
  // 3. メモリ上基本プロフィール
  result = createFallbackProfile(authUser);
}
```

### 4. デバッグログの強化

```typescript
// CustomTabs と AuthGuard にデバッグログ追加
React.useEffect(() => {
  console.log('[CustomTabs] Auth state:', { 
    isAuthenticated, isLoading, hasUser: !!user 
  });
}, [isAuthenticated, isLoading, user]);
```

## 🔄 修正後の認証フロー

### アプリ起動時
1. **初期化**: AuthContextが初期化される
2. **セッション復元**: Supabaseセッションをチェック
3. **プロフィール取得**: 既存プロフィール取得またはプロフィール初期化
4. **状態設定**: `isAuthenticated=true`, `user=profile`に設定
5. **監視開始**: Auth state change listenerとセッション監視開始

### ログイン時
1. **認証**: Supabaseでのメール/パスワード認証
2. **状態変更トリガー**: `SIGNED_IN`イベントが発生
3. **自動処理**: Auth listenerがプロフィール取得/初期化を実行
4. **状態更新**: `dispatch({ type: 'SET_USER', payload: profile })`
5. **画面更新**: CustomTabsとAuthGuardが認証状態を認識

## 📊 期待される動作変化

### 修正前
- ✅ Supabase認証成功
- ❌ セッション復元失敗
- ❌ プロフィール取得失敗
- ❌ AuthContext状態未更新
- ❌ "ログインが必要です"表示

### 修正後
- ✅ Supabase認証成功
- ✅ セッション復元成功
- ✅ プロフィール取得/初期化成功
- ✅ AuthContext状態正常更新
- ✅ アプリ機能へスムーズアクセス

## 🔍 デバッグ手順

### 1. コンソールログ確認
ログイン時に以下のログが順次出力されることを確認：

```
[CustomTabs] Auth state: { isAuthenticated: false, isLoading: true, hasUser: false }
AuthContext: Setting up Supabase auth listener
AuthContext: Supabase session found { userId: "...", expires_at: "..." }
AuthContext: Profile loaded from restored session { id: "...", username: "..." }
[CustomTabs] Auth state: { isAuthenticated: true, isLoading: false, hasUser: true }
[AuthGuard] Auth state: { isAuthenticated: true, isLoading: false, hasUser: true }
```

### 2. 認証状態の確認
- ログイン画面の「🔧 デバッグ情報」ボタンで接続状態確認
- コンソールで認証イベントの流れを追跡
- AuthGuardが「ログインが必要です」を表示しないか確認

### 3. プロフィール確認
- ログイン成功後にユーザープロフィールが表示されるか
- 投稿機能にアクセスできるか
- "ログインが必要です"エラーが出なくなったか

## ⚠️ 重要な注意点

### データベース要件
- `user_profiles`テーブルへのINSERT権限が必要
- RLSポリシーで認証ユーザーの作成を許可する必要

### セッションストレージ
- React NativeのAsyncStorageが正常動作する必要
- Supabaseセッションの永続化が機能する必要

### エラーハンドリング
- ネットワークエラー時も適切にフォールバック
- プロフィール作成失敗時もアプリが使用可能

これらの修正により、認証問題が根本的に解決されるはずです。