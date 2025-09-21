# 検索機能 仕様書（草案）

この文書は、アプリに「ユーザー検索（@）」と「ポスト検索（#）」を追加するための仕様をまとめた草案です。実装は含めず、要件・UI/UX・データモデル・API・テスト・セキュリティ・作業計画を示します。

## 目的 / ゴール
- サイドバー内の「メッセージ」と「設定」の間に「検索」を追加する。
- 入力プレフィックスで検索対象を切り替える:
  - `#タグ` でポスト（ハッシュタグ）検索
  - `@ユーザー名` でユーザー検索
- シンプルかつ高速な検索体験（デバウンス、ページング、結果の即時表示）。
- RLS 等の制約下で、閲覧権限のあるデータのみを検索対象にする。

## 対象範囲（スコープ）
- 対象データ
  - ユーザー検索: `profiles.username`, 表示名 `profiles.display_name`（部分一致・前方一致中心）
  - ポスト検索（ハッシュタグ）: `#タグ` で紐づくポスト
- 非対象（本フェーズ）
  - 自由テキスト全文検索（タグ/ユーザー以外）
  - 複数条件のブール検索、日付/いいね数等の高度な絞り込み

## UX / IA
- サイドバー（ナビゲーション）
  - 追加項目: 「検索」
  - 位置: 「メッセージ」と「設定」の間
  - 遷移: 検索画面（`SearchScreen`）へ push/replace（既存ナビゲーション構成に合わせる）
- 検索画面（`SearchScreen`）
  - 上部: 単一の検索入力フィールド
    - プレースホルダー: `検索（#ハッシュタグ または @ユーザー）`
    - 入力ルール: 先頭が `#` または `@` のみを検索実行対象にする（無指定はガイド表示）
    - 送信: Enter/検索ボタンで実行、入力中は 300ms デバウンスでプレビュー可
    - クリア: テキストクリアボタン
  - 中央: 結果リスト
    - `#` の場合: ポスト一覧（カード/セル）
    - `@` の場合: ユーザー一覧（アバター+ユーザー名）
  - 状態表示
    - 初期: ヒント（`#music`, `@alice` などの例）
    - 読み込み: スケルトン
    - 空: 「該当する結果がありません」
    - エラー: リトライ導線付きの簡潔なメッセージ
- 補助仕様
  - iOS/Android キーボードの `search` アクションに対応
  - ダーク/ライトテーマ適合
  - アクセシビリティ（VoiceOver/トークバックのラベル）

## クエリ仕様
- 入力解釈
  - 先頭が `#`: ハッシュタグ検索
    - 許可文字: 英数/アンダースコア/一部記号（設計上は英数+`_` を基本に、実装で拡張）
    - 正規化: 小文字化（CITEXT 同等運用）
  - 先頭が `@`: ユーザー検索
    - 許可文字: 英数/アンダースコア/ドット（既存 `username` ポリシーに合わせる）
    - マッチ: 前方一致 + 部分一致（`ilike`）
- マルチトークン（`#tag1 #tag2` 等）は本フェーズ非対応（将来検討）
- スペース・改行はトリム、絵文字などは除外

## データモデル（Supabase/Postgres 想定）
- 既存テーブル（想定）
  - `profiles(id, username, display_name, avatar_url, ...)`
  - `posts(id, author_id, content, created_at, visibility, ...)`
- 追加（推奨）
  - `post_hashtags(post_id uuid references posts(id) on delete cascade, tag text not null, primary key(post_id, tag))`
  - インデックス
    - `create index on post_hashtags (lower(tag));`（CITEXT 推奨）
    - `create index on profiles (lower(username));`
- 取り込み（タグ抽出）
  - `posts.content` から `#タグ` を抽出して `post_hashtags` に保存
  - 手段: DB トリガー or アプリ側抽出（本フェーズはアプリ側で安全に実装、将来トリガー化）
- RLS 概要
  - `posts`: ログインユーザーが閲覧可能なポストのみ許可
  - `post_hashtags`: 閲覧可能な `posts` に join できる行のみ可
  - `profiles`: 公開プロフィール（非公開項目は除外）

## API / サービス設計（アプリ側）
- モジュール
  - `src/services/searchService.ts`
    - `parseQuery(q: string): { kind: 'user' | 'hashtag' | 'none'; term: string }`
    - `searchUsers(term: string, opts?: { limit?: number; cursor?: string })`
    - `searchPostsByHashtag(tag: string, opts?: { limit?: number; cursor?: string })`
  - `src/hooks/useSearch.ts`
    - 入力値を監視し、`parseQuery` とデバウンスを適用してサービスを呼び出す
  - `src/screens/SearchScreen.tsx`
    - UI（入力、結果表示、状態管理）
- 返却型（例）
  - `SearchUserItem = { id, username, displayName, avatarUrl }`
  - `SearchPostItem = { id, author: SearchUserItem, contentPreview, createdAt, likeCount? }`
- ソート/ページング
  - ユーザー: 前方一致が強い順（`username` の昇順）+ 登録順/活動スコアは将来
  - ポスト: `created_at desc`、次いでエンゲージメント順（将来）
  - ページング: `limit + cursor`（`created_at,id` 複合カーソル推奨）

### Supabase クエリ例（参考、実装は本フェーズ対象外）
- ユーザー検索（前方一致→部分一致の順で補完）
```ts
const term = input.replace(/^@/, '').trim();
const q = `%${term}%`;
const { data, error } = await supabase
  .from('profiles')
  .select('id, username, display_name, avatar_url')
  .ilike('username', q)
  .order('username', { ascending: true })
  .limit(20);
```
- ハッシュタグ検索（タグ→ポスト join）
```ts
const tag = input.replace(/^#/, '').toLowerCase().trim();
const { data: ids } = await supabase
  .from('post_hashtags')
  .select('post_id')
  .ilike('tag', tag)
  .limit(200);
const postIds = ids?.map(x => x.post_id) ?? [];
const { data: posts } = await supabase
  .from('posts')
  .select('id, author:profiles(id, username, display_name, avatar_url), content, created_at')
  .in('id', postIds)
  .order('created_at', { ascending: false })
  .limit(20);
```

## ナビゲーション/配置
- 追加箇所
  - サイドバーのメニュー配列に `Search` を追加
  - 既存ファイル例（想定）: `src/navigation/SidebarNavigator.tsx` または `src/components/Sidebar/*.tsx`
  - 位置調整: `Messages` の次、`Settings` の前
- 画面登録
  - `SearchScreen` をナビゲーションスタックに登録
  - ルート名: `'Search'`（一貫性のため英語名、表示ラベルは「検索」）

## バリデーション / エラーハンドリング
- 入力
  - 先頭文字が `#/@` でない場合は検索実行不可、ヒント表示
  - 許可外文字は削除/無視（必要に応じてトースト）
- 通信
  - タイムアウト/ネットワークエラー時はリトライ導線
  - 連続入力時は古いリクエストをキャンセル（最新のみ採用）

## アクセシビリティ / i18n
- 入力欄には `accessibilityLabel="検索"`
- 結果のセルにロール/ラベル設定
- ローカライズ: 文字列を `src/i18n/`（存在すれば）に追加

## パフォーマンス
- 入力デバウンス（300ms 目安）
- 結果リストは仮想化（RN FlatList）
- DB インデックス整備（上記参照）
- キャッシュ（直近クエリ→メモリキャッシュ、将来 SWR/TanStack Query 検討）

## セキュリティ / プライバシー
- RLS による行レベル制御を尊重
- 非公開アカウントや限定公開ポストは権限に応じた結果に限定
- 入力値はサニタイズし、SQL インジェクション対策（パラメータ・ビルダー使用）

## テスト計画
- ユニット
  - `parseQuery` の判定（`#`/`@`/その他）
  - 不正文字/空文字の扱い
- サービス
  - 検索関数が正しいクエリを発行（モック Supabase）
- UI
  - 入力→デバウンス→ロード→結果表示の状態遷移
  - 空/エラー/読み込み時の表示
- パフォーマンステスト（将来）

## 計測（任意）
- イベント: `search_opened`, `search_executed`, `search_result_clicked`
- 属性: 種別（user/hashtag）、入力長、結果件数

## 実施ステップ（提案）
1. 画面/ナビゲーションの追加（サイドバー/ルート登録）
2. `parseQuery`/`searchService` のスケルトン実装
3. `SearchScreen` の UI 実装（入力/状態/結果リスト）
4. Supabase クエリ実装（RLS/インデックス確認）
5. テスト整備（ユニット/サービス/UI）
6. パフォーマンス/アクセシビリティの微調整

## オープンクエスチョン
- ユーザー検索は `display_name` も対象に含めるか？（現状は `username` 優先）
- `#`/`@` なしの入力を統合検索として扱うか？（現状は非対応）
- ハッシュタグの許可文字とローカライズ（日本語タグ許可の是非）
- 並び順（新着 vs 人気）の切替 UI を設けるか？

---
本仕様は草案です。要件の確定に応じて更新します。
