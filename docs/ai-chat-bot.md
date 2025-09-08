# AI チャットボット機能（Gemini 2.0 Flash）

このドキュメントは、メッセージ一覧から起動できる AI チャットボット機能の設計・実装・設定手順をまとめたものです。サーバー側で会話セッションを永続化し、ユーザーごとに履歴を安全に管理します。

## 概要
- 起動: メッセージ一覧画面右下のハート（`heart-outline`）アイコンから AI チャット画面を開く
- モデル: Google Gemini 2.0 Flash
- 出力フォーマット: 日本語・最大6行（出典がある場合のみ6行目に圧縮表示）
- グラウンディング: ニュース/価格/統計/規格/法令/日時/バージョン/在庫/場所 等を含む場合に検索（任意設定）
- 永続化: Supabase 上の `ai_chat_sessions` / `ai_chat_messages` で履歴を管理（RLS保護）
- UI: セッション一覧/切替/削除、タイトル編集、履歴読み込み

## 実装構成
- Edge Function: `ai-chat-bot`
  - prompt: Mamapace用Systemプロンプト（常にユーザーに寄り添う、医療/法的助言回避、出典表示ルール等）
  - 入力: `messages`（直近20件にトリム）、任意 `session_id`
  - 処理: 必要に応じて検索 → Gemini生成 → 出典付き整形 → DB保存（ユーザー発話/AI応答）
  - 出力: `{ ok: true, text, session_id }`
- DB スキーマ（RLS有効）
  - `public.ai_chat_sessions(id, user_id, title, created_at, updated_at)`
  - `public.ai_chat_messages(id, session_id, role, content, sources jsonb, created_at)`
  - ポリシー: 所有者（`auth.uid()`）のみ参照/作成/更新/削除
- モバイル側
  - 画面: `src/screens/AIChatBotScreen.tsx`
    - 入力フォーム（タブバーと重ならないよう安全領域・オフセット調整済み）
    - 履歴モーダル（一覧/新規/削除）とセッション切替
    - セッションタイトルのインライン編集
  - サービス:
    - `src/services/aiChatService.ts` … Edge Function呼び出し
    - `src/services/aiChatSessionService.ts` … セッション一覧/作成/削除/タイトル更新/履歴取得

## Edge Function: ai-chat-bot
- パス: `supabase/functions/ai-chat-bot/index.ts`
- 使用モデル: `gemini-2.0-flash`
- 生成設定: `temperature: 0.7`, `top_p: 0.9`, `max_output_tokens: 512`
- Systemプロンプト（要旨）
  - 常にユーザーに寄り添う・思いやり・簡潔・安心のトーン
  - 医療・法的助言や危険行為の具体指示はしない
  - 最新情報が必要な場合は検索し、本文に必要なら [1][2] を付す。出典は6行目に最大2件
  - 出典が無い場合は出典行を表示しない（本文のみ）
- 入出力
  - 入力: `{ messages: {role, content}[], session_id?: string }`
  - 出力: `{ ok: true, text: string, session_id: string }`
- 認証: `verify_jwt: true`（Authorization: Bearer のユーザートークン必須）
- 保存: ユーザー発話（最新1件）とAI応答を `ai_chat_messages` に挿入。セッションが無い場合は新規作成して返す
- 更新: 応答保存後に `ai_chat_sessions.updated_at` を更新

## 環境変数（Edge Functions）
- 必須: `GEMINI_API_KEY`（Gemini API キー）
- 任意（検索有効化）:
  - `GOOGLE_SEARCH_API_KEY`（Custom Search JSON API キー）
  - `GOOGLE_SEARCH_CX`（Programmable Search Engine の cx）
- 任意（CORS）: `ALLOWED_ORIGINS`（カンマ区切り、未設定時は `*`）

## データベース（適用済みマイグレーション）
- マイグレーション名: `ai_chat_sessions_schema_v2`
- 追加オブジェクト
  - tables
    - `public.ai_chat_sessions`
    - `public.ai_chat_messages`
  - indexes
    - `ai_chat_sessions_user_id_idx`
    - `ai_chat_messages_session_id_created_at_idx`
  - RLS Policies
    - セッション: select/insert/update/delete すべて所有者のみに制限
    - メッセージ: 親セッションの所有者のみ select/insert/delete を許可

## モバイルアプリの変更点
- メッセージ一覧（`src/screens/ChatsListScreen.tsx`）
  - 右下FAB: `heart-outline` アイコン → AIチャット画面へ遷移
  - ヘッダー右側: フォロワー一覧ボタン（↑）
- AIチャット画面（`src/screens/AIChatBotScreen.tsx`）
  - 入力フォーム: タブバーと重ならないよう SafeArea とオフセット調整
  - 履歴（モーダル）: セッション一覧/選択/新規/削除
  - タイトル編集: 現在セッションのタイトルをインライン編集して保存
  - 送信時: `session_id` を引き継ぎ、応答後に初回は `session_id` を確定

## クライアントAPI
- `sendAIChat(messages, sessionId?)`
  - 呼び出し先: `functions.invoke('ai-chat-bot')`
  - 戻り値: `{ ok, text, session_id }`
- セッション操作
  - `listAISessions()` / `createAISession(title?)` / `deleteAISession(id)`
  - `updateAISessionTitle(id, title)` / `fetchAIMessages(sessionId)`

## セットアップ手順（概要）
1) Edge Functions 環境変数を設定
   - ダッシュボードの Edge Functions 設定で `GEMINI_API_KEY` を設定
   - 検索を有効化する場合は `GOOGLE_SEARCH_API_KEY`, `GOOGLE_SEARCH_CX` も設定
   - 必要に応じて `ALLOWED_ORIGINS` を設定
2) 関数デプロイ（supabaseMCP で済み / CLIでも可）
   - `supabase functions deploy ai-chat-bot --project-ref <project_ref>`
3) アプリ側
   - ログイン後にメッセージ一覧 → 右下FAB → AIチャットを開き送信

## 動作確認
- 認証: 未ログインの場合は Edge Function で 401 になる（verify_jwt 有効）
- 生成: 通常質問で本文のみ（最大6行）、最新情報が必要な質問では出典行が6行目に付く
- 履歴: 履歴モーダルからセッション切替、新規作成、削除が可能
- タイトル: 編集→保存でDBに反映され、一覧にも即時反映

## セキュリティ/制限事項
- RLSにより所有者のみ履歴アクセス可能
- PIIを取得/保存しない設計（Systemプロンプトでも誘導）
- レート制限は未実装（必要に応じてEdge側に追加推奨）

## 将来的な拡張
- ストリーミング応答（SSE）
- 履歴ページング/検索
- モデレーション/キーワードフィルタ
- セッション共有（匿名リンク）

---
関連: `docs/ai-compassionate-comment.md`（Geminiを用いた共感コメント機能）
