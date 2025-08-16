# Supabaseチャット機能マイグレーションガイド

## 🚨 重要：データベースへの適用が必要です

現在、チャット機能のSQLファイルは作成済みですが、Supabaseのデータベースには適用されていません。

## 📁 必要なSQLファイル（作成済み）

以下のファイルがすでに`supabase/sql/`ディレクトリに作成されています：

1. **11_chat_schema.sql** - チャットのテーブルと関数
   - `conversations` テーブル
   - `messages` テーブル
   - `read_receipts` テーブル
   - `typing_indicators` テーブル
   - `get_or_create_conversation` 関数 ⭐ **この関数が必要**
   - その他のヘルパー関数

2. **12_chat_rls.sql** - Row Level Security ポリシー
   - 適切なアクセス制御
   - セキュリティポリシー

3. **13_chat_realtime.sql** - リアルタイム通信設定
   - リアルタイムサブスクリプション設定

## 🚀 Supabaseダッシュボードでの適用方法

### 方法1: SQL Editorを使用（推奨）

1. **Supabaseダッシュボードにログイン**
   - https://supabase.com/dashboard にアクセス
   - プロジェクト（xxnslcwktufssamircxf）を選択

2. **SQL Editorを開く**
   - 左サイドバーから「SQL Editor」をクリック

3. **SQLファイルを順番に実行**
   
   **重要**: 以下の順番で実行してください：

   a. **11_chat_schema.sql を実行**
      - ファイルの内容をコピー
      - SQL Editorに貼り付け
      - 「Run」ボタンをクリック
      - ✅ 成功メッセージを確認

   b. **12_chat_rls.sql を実行**
      - 同様にコピー＆ペースト
      - 「Run」ボタンをクリック
      - ✅ 成功メッセージを確認

   c. **13_chat_realtime.sql を実行**
      - 同様にコピー＆ペースト
      - 「Run」ボタンをクリック
      - ✅ 成功メッセージを確認

### 方法2: Database Migrationsを使用

1. **Databaseタブを開く**
   - 左サイドバーから「Database」をクリック

2. **Migrationsセクションへ**
   - 「Migrations」をクリック

3. **新しいマイグレーションを作成**
   - 「Create new migration」をクリック
   - 名前: `chat_system_implementation`
   - SQLファイルの内容を順番に貼り付け

## ✅ 確認方法

SQLを実行後、以下を確認してください：

### 1. テーブルの確認
Supabaseダッシュボードの「Table Editor」で以下のテーブルが作成されているか確認：
- ✅ `conversations`
- ✅ `messages`
- ✅ `read_receipts`
- ✅ `typing_indicators`

### 2. 関数の確認
SQL Editorで以下のクエリを実行：

```sql
-- 関数の存在確認
SELECT 
  proname as function_name,
  pronargs as arg_count
FROM pg_proc 
WHERE proname = 'get_or_create_conversation';
```

結果が返ってくれば成功です。

### 3. 権限の確認
```sql
-- 権限の確認
SELECT 
  grantee, 
  privilege_type 
FROM information_schema.routine_privileges 
WHERE routine_name = 'get_or_create_conversation';
```

`authenticated`ロールに`EXECUTE`権限があることを確認。

## 🔧 トラブルシューティング

### エラー: "function already exists"
既に一部適用されている場合：
```sql
-- 既存の関数を削除してから再作成
DROP FUNCTION IF EXISTS public.get_or_create_conversation(uuid, uuid);
```

### エラー: "permission denied"
管理者権限で実行していることを確認してください。

### エラー: "relation does not exist"
依存関係の順番を確認：
1. 先に`user_profiles`テーブルが存在する必要があります
2. SQLファイルを正しい順番で実行してください

## 📝 本番環境への適用チェックリスト

- [ ] バックアップを取得済み
- [ ] 11_chat_schema.sql を適用
- [ ] 12_chat_rls.sql を適用
- [ ] 13_chat_realtime.sql を適用
- [ ] テーブルが作成されていることを確認
- [ ] `get_or_create_conversation`関数が存在することを確認
- [ ] RLSポリシーが有効になっていることを確認
- [ ] アプリから動作テスト実施

## 🎯 期待される結果

すべてのSQLが正常に適用されると：
1. チャットボタンをクリックしても「function not found」エラーが発生しない
2. 新規チャットの作成・既存チャットの取得が正常に動作
3. メッセージの送受信が可能
4. リアルタイム更新が動作

## 💡 ヒント

- Supabaseダッシュボードで直接SQLを実行するのが最も簡単で確実です
- エラーが発生した場合は、エラーメッセージを確認して対処してください
- 不明な点があれば、Supabaseのドキュメントを参照してください

---

**重要**: 現在のエラーは、これらのSQLファイルがデータベースに適用されていないことが原因です。上記の手順に従って適用してください。