## ポスト機能 実装計画（feature/posts）

### 概要
X と同様のポスト体験を提供する。ホームのタイムライン、投稿作成、あなた（自分）画面の投稿一覧、共感したポスト一覧、ポストへの共感・コメントを実装。

### スコープと用語
- **ポスト**: テキスト中心（画像は後続）。
- **共感**: いいね相当（トグル・集計あり）。
- **コメント**: ポストへの返信（一覧・作成）。
- **対象画面**: ホーム、あなた、自分が共感したポスト、投稿作成、コメント一覧/作成。

### Doneの定義（DoD）
- **ホーム**: 最新順スクロール、無限スクロール、プルリフレ、空・ローディング・エラー状態。
- **投稿作成**: テキスト入力（上限検討: 300字デフォルト）、送信中状態、成功後の楽観反映、失敗ロールバック。
- **あなた**: 自分の投稿の無限スクロール。プロフィール画面から遷移可。
- **共感したポスト**: 自分が共感した投稿の無限スクロール。
- **共感**: トグル、数の反映、自分の状態表示、楽観更新。
- **コメント**: 一覧と作成、件数表示、楽観追加。
- **データ**: Supabase テーブル・RLS・インデックス・簡易RPC整備。
- **品質**: 型定義、サービス層、エラー/再試行、テスト（ユニット/統合/E2Eの要所）。

---

### マイルストーン
1) DB/セキュリティ → 2) サービス/型 → 3) コンポーネント/画面 → 4) 共感/コメント → 5) テスト/パフォーマンス/磨き

---

### あなたがやること（依頼事項）
1. 仕様確定（短時間）
   - [ ] 投稿最大文字数（提案: 300）
   - [ ] 禁則/NGワード有無（後続でOK）
   - [ ] コメント最大文字数（提案: 300）
   - [ ] 公開範囲（現状: 公開）
2. Supabase 構築/適用（DB権限が必要）
   - [ ] `supabase/sql/06_posts.sql` を適用（新規作成予定のDDL/RLS/RPC）
   - [ ] RLS 有効化の確認（既存ガイドに準拠）
   - [ ] 必要なインデックス作成（DDL内で付与）
3. 環境設定
   - [ ] `.env`/アプリ設定で Supabase URL/Anon Key を有効化（既存 `src/services/supabaseClient.ts` 仕様に従う）
4. デザイン/コピー（任意）
   - [ ] 画面文言・注意書き（必要なら）

---

### 私がやること（実装担当）
1. DBスキーマ提案/DDL追加
   - [ ] `supabase/sql/06_posts.sql` 追加（テーブル・RLS・インデックス・簡易RPC）
     - `public.posts(id, user_id, body, created_at)`
     - `public.post_reactions(id, post_id, user_id, created_at, unique(post_id,user_id))`
     - `public.post_comments(id, post_id, user_id, body, created_at)`
     - RLS: 読み取り公開、書き込みは本人のみ。各テーブルに適用。
     - RPC（任意）: `get_home_feed(limit, before)`、`get_user_posts(user_id, ...)`、`get_liked_posts(user_id, ...)`。
2. 型/サービス層
   - [ ] `src/types/post.ts`（`Post`, `PostWithMeta`, `Comment`, `ReactionSummary` 等）
   - [ ] `src/services/postService.ts`
       - 取得: ホーム/ユーザー/共感したポスト（ページング）
       - 作成: 投稿、共感トグル、コメント作成
       - 集計: 共感数/コメント数取得（ビュー or 集計クエリ）
       - 楽観更新・エラーハンドリング・リトライ
   - [ ] 必要なら `src/utils/pagination.ts`（cursor/pagingヘルパ）
3. UIコンポーネント
   - [ ] `src/components/PostCard.tsx`（本文、共感/コメントボタン、カウント、タップ遷移）
   - [ ] `src/components/CommentItem.tsx`（シンプル）
4. 画面実装/接続（既存モック置換）
   - [ ] `src/screens/HomeScreen.tsx` を Supabase連携・無限スクロールに置換
   - [ ] `src/screens/ComposeScreen.tsx` をサービス接続（投稿作成）
   - [ ] `src/screens/CommentsListScreen.tsx` を postId 連携＋作成導線
   - [ ] `src/screens/LikedPostsListScreen.tsx` を likes 連携
   - [ ] `src/screens/ProfileScreen.tsx` から自分の投稿一覧遷移（新規 `MyPostsListScreen.tsx` 追加）
   - [ ] `src/navigation/CustomTabs.tsx` ルート/パラメータ整備
5. 体験/状態管理
   - [ ] プルリフレ/読み込み中/空状態/エラーリトライ
   - [ ] 楽観更新（投稿・共感・コメント）と失敗ロールバック
   - [ ] ハプティクス/トースト（既存規約に準拠）
6. テスト
   - [ ] サービス層ユニットテスト（モック）
   - [ ] 主要フロー統合テスト（投稿→フィード反映、共感トグル、コメント追加）
   - [ ] 既存 E2E に投稿/共感/コメントの陽性経路を追加
7. パフォーマンス/安定性
   - [ ] ページング・インデックス検証
   - [ ] ネットワーク失敗時の再試行/指数バックオフ
   - [ ] 最小限のバッチ更新（共感数など）
8. ドキュメント/記録
   - [ ] `docs/implementation-log.md` 追記
   - [ ] この計画との差分更新

---

### 推奨DB設計（要確認）
- posts
  - id uuid PK, user_id uuid FK→user_profiles.id, body text not null, created_at timestamptz default now()
- post_reactions
  - id uuid PK, post_id uuid FK, user_id uuid FK, created_at timestamptz default now(), UNIQUE(post_id, user_id)
- post_comments
  - id uuid PK, post_id uuid FK, user_id uuid FK, body text not null, created_at timestamptz default now()
- インデックス: posts(created_at desc), post_reactions(post_id), post_reactions(user_id, created_at), post_comments(post_id, created_at)
- RLS: 読み取りは公開、挿入は`auth.uid()=user_id`相当、削除/更新は本人のみ（今回は削除・更新は後続）

---

### 実装順序（詳細）
1. DDL/RLS/RPC 追加 → 反映（あなた）
2. 型・サービス層（私）
3. PostCard・画面接続（私）
4. 共感トグル・コメント（私）
5. 無限スクロール/UX磨き（私）
6. テスト一式/ドキュメント（私）

---

### テスト観点（抜粋）
- 投稿作成: 入力バリデーション、送信中、成功/失敗、楽観反映とロールバック
- フィード: ページング、プルリフレ、空/エラー
- 共感: 状態トグル、カウント整合、並行押下の排他
- コメント: 一覧ロード、作成、件数表示
- RLS: 他人への書き込み不可、公開読み取り可

---

### 未決定・リスク
- 文字数上限とNGワードポリシー
- 投稿編集/削除は範囲外か（現時点は非対応）
- ファイル添付（後続フェーズ）

---

### 作業ブランチ/運用
- ブランチ: `feature/posts`
- コミット: conventional commits 準拠（docs/CLAUDE.md）
- PR: 計画→実装→テスト→レビューの小分割を推奨
