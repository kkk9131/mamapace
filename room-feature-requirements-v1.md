# Mamapace ルーム機能 要件定義（V1）
最終更新: 2025-08-17（JST）

## 0. 目的とスコープ
- **目的**: ママ向けSNSにおけるコミュニティ交流の中核として、Discordライクな「スペース（=サーバー）」と、その中の「チャンネル（=タイムライン）」、および1時間で消える「匿名ルーム」を提供する。
- **V1スコープ**:
  - スペース（公開/非公開）の作成・参加・閲覧・検索（公開のみ）
  - 各スペースに **1チャンネル**（V1は固定。将来複数化）
  - NEWバッジ（既読機能は実装しない）
  - 匿名ルーム（1時間スロット・スローモード・TTL削除）
  - モデレーション（オーナー/モデレーター、通報→自動マスク）
  - 有料プランユーザーのみスペース作成可

> 既存の「1ルーム=1タイムライン」は **チャンネル** として継続利用可能。

---

## 1. 用語定義
- **スペース (Space)**: Discordのサーバー相当。コミュニティの“器”。
- **チャンネル (Channel)**: スペース内のタイムライン。V1は「1スペース=1チャンネル」。将来複数チャンネル化。
- **匿名ルーム (Anonymous Room)**: 1時間ごとに入れ替わる時限タイムライン。入室ごとに仮名（エフェメラル別名）を付与。

---

## 2. ユースケース（主要）
1. ユーザーが公開スペースを検索し、ワンタップで参加→投稿。
2. ユーザーが非公開スペースに参加申請→オーナー承認→投稿。
3. ユーザーが匿名ルームに入室し、1時間の枠で吐露・相談（スローモード適用、1時間後に履歴消滅）。
4. ユーザーが参加中チャンネルの新着を一覧で把握（NEWバッジ）。
5. オーナー/モデレーターが荒れた投稿をマスク/削除、ユーザーを追放。

---

## 3. 機能仕様

### 3.1 スペース（基本ルーム=サーバー相当）
- **公開スペース**
  - 閲覧: 認証ユーザーは閲覧可
  - 参加: **ワンタップ参加（承認不要）**
  - 投稿: 参加者のみ
  - 掲載/検索: ディレクトリ掲載、**名前＋タグ検索可**
  - 表示名: 通常プロフィール名
- **非公開スペース**
  - 閲覧: 参加者のみ
  - 参加: **申請→オーナー承認**
  - 掲載/検索: 非掲載・検索不可
  - 表示名: 通常プロフィール名
- **作成権限**: **有料プランユーザーのみ**（公開/非公開共通）

### 3.2 チャンネル（V1）
- 各スペースに1チャンネル（将来複数化に備えて設計）。
- **並び順の単一真実**: `created_at ASC, id ASC`（購読も同順）。
- **NEWバッジ**: 参加中チャンネルのみ対象。判定は「**他者**メッセージの `created_at > last_seen_at`」。入室/フォーカスで `last_seen_at=now()`。

### 3.3 匿名ルーム
- **スロット制**: 1時間ごとに新スロット（例: `anon_YYYYMMDD_HH`）。
- **表示名**: 入室ごとにランダムな別名（例: たぬき-7F2）。ユーザーIDとの紐付けは運営のみ参照可能（監査用）。
- **スローモード**: 10秒/投稿、1分最大6投稿。**サーバ側強制**（クールダウン未経過はHTTP 429）。
- **TTL削除**: `expires_at = created_at + 1h`。クエリでソフト除外＋バックグラウンドでハード削除。
- **NEWバッジ**: 対象外。

### 3.4 モデレーション
- **公開/非公開スペース**: オーナー + 指名モデレーター（複数可）。
  - 権限: メッセ削除、ユーザー追放、（V1.1で）スローモード変更、NGワード管理。
- **匿名ルーム**: 運営モデレーターのみ。
- **通報→自動マスク**: 同一メッセージに通報が**3件**集まると自動でグレー非表示（タップで展開）。
- **監査**: `sender_user_id` はDB保持（RLSによりユーザー間非公開）。監査ログは**30日で完全削除**。

---

## 4. 非機能要件
- **パフォーマンス**: メッセージはインデックス `(channel_id, created_at, id)` で取得。匿名はTTLでテーブル肥大を抑制。
- **セキュリティ/プライバシー**: PII/本文のログ出力禁止。RLSで最小権限。`is_paid_user()` による作成ゲート。
- **安定性**: ネット断時は送信キューで再送。Realtime重複イベントはIDで重複排除。
- **UX一貫性**: 取得も購読もASCで統一。`FlatList.inverted=false`。

---

## 5. データモデル（最小）

### 5.1 spaces
| カラム | 型 | 説明 |
|---|---|---|
| id | uuid pk | スペースID |
| name | text | 名称 |
| description | text | 説明 |
| tags | text[] | 検索用タグ |
| is_public | boolean | 公開/非公開 |
| owner_id | uuid | 作成者（auth.users.id） |
| max_members | int | 既定: 公開=500 / 非公開=50 |
| created_at | timestamptz | 作成日時 |

### 5.2 channels
| カラム | 型 | 説明 |
|---|---|---|
| id | uuid pk | チャンネルID |
| space_id | uuid fk -> spaces | 所属スペース |
| name | text | 既定 'general' |
| created_at | timestamptz | 作成日時 |

※V1はスペース作成時に `general` を自動作成。

### 5.3 channel_members
| カラム | 型 | 説明 |
|---|---|---|
| channel_id | uuid fk -> channels | |
| user_id | uuid fk -> auth.users | |
| role | text | owner/moderator/member |
| last_seen_at | timestamptz | NEW判定 |
| joined_at | timestamptz | 参加日時 |
**PK**: (channel_id, user_id)

### 5.4 messages
| カラム | 型 | 説明 |
|---|---|---|
| id | uuid pk | |
| channel_id | uuid fk -> channels | 匿名は別管理でも可 |
| sender_id | uuid fk -> auth.users | |
| type | text | 'text'/'image'（既定 'text'） |
| content | text | 本文（image時はキャプション） |
| attachments | jsonb | 画像などの受け皿（既定 '[]'） |
| created_at | timestamptz | 送信時刻 |
| deleted_at | timestamptz null | 自削除/規制 |
| expires_at | timestamptz null | 匿名のみ: +1h |
**Index**: `(channel_id, created_at, id)`, `(expires_at)`

### 5.5 subscriptions（作成権限判定）
| カラム | 型 | 説明 |
|---|---|---|
| user_id | uuid pk | |
| plan | text | 例: 'pro' |
| status | text | active/paused/canceled |
| current_period_end | timestamptz | |

**関数**: `is_paid_user(uid uuid) returns boolean`

### 5.6 anonymous_slots（任意）
| カラム | 型 | 説明 |
|---|---|---|
| id | text pk | `anon_YYYYMMDD_HH` |
| opened_at | timestamptz | |
| closed_at | timestamptz | |

---

## 6. 権限/RLS 方針（骨子）
- **spaces**
  - SELECT: 公開→認証ユーザー可 / 非公開→メンバーのみ
  - INSERT: **WITH CHECK: is_paid_user(auth.uid()) = true**
  - UPDATE/DELETE: owner or space-moderator
- **channels**
  - SELECT: `space.is_public=true`→認証ユーザー可 / 非公開→メンバーのみ
  - INSERT: owner/moderator（V1は自動生成のみ）
- **channel_members**
  - SELECT: 同一スペースのメンバー
  - INSERT: 公開→本人が自己参加 / 非公開→承認APIのみ
  - UPDATE: 自分の行のみ（`last_seen_at` 等）
  - DELETE: 自分 or owner/moderator
- **messages**
  - SELECT: 公開→認証ユーザー可 / 非公開→メンバーのみ / 匿名→スロット参加者のみ
  - INSERT: 参加者のみ（匿名は参加=自動）
  - UPDATE/DELETE: 自分の投稿のみ（+モデレーター）

---

## 7. API/RPC（最小）
- **スペース/チャンネル**
  - `create_space(payload)` … WITH CHECKで `is_paid_user()` 検査。内部で `general` を作成。
  - `search_public_spaces(q text, tags text[])`
  - `join_public_space(space_id)`（内部で `channel_members` に自己追加）
  - `request_join_private_space(space_id)` / `approve_join(space_id, user_id)`
- **メッセージ/NEW**
  - `get_chat_list_with_new()`（参加チャンネルの `has_new` を返す）
  - `mark_seen(channel_id)`
- **匿名**
  - `get_or_create_current_anon_room()`（レイジー生成）
  - `POST /anon/:slot/messages`（**スローモード**＆**TTL付与**＆429）

---

## 8. 受け入れ基準（抜粋）
- 並び順: アプリ再起動×10でも `created_at ASC, id ASC` を維持（購読も同順）。
- NEW: 自分のみ投稿→NEWなし。他者が未閲覧中に投稿→NEW表示。入室で消える。
- 公開スペース: 参加しなくても閲覧可。投稿は参加後のみ。
- 非公開スペース: 検索に出ない。申請→承認で参加可。
- 匿名: スローモード適用、1時間後に取得結果から消え、バックグラウンドで削除。
- 作成権限: 有料ユーザーのみ `create_space` 成功。無料はRLSで拒否。

---

## 9. マイルストーン
- **V1.0**: スペース（1チャンネル固定）＋公開/非公開＋検索＋NEW＋匿名（1h/スロモ/TTL）
- **V1.1**: 複数チャンネル、招待リンク/コード、モデレーターUI強化、全文検索、画像投稿・通知

---

## 10. 既知のリスク & 対応
- 公開スペースの荒れ: スローモード初期3秒、通報3件自動マスク、モデレーター導入。
- 匿名の負荷: スロット制＋TTL＋インデックス最適化で抑制。
- 有料ゲートのバイパス: RLS WITH CHECK + サーバ検証で強制。クライアント判定に依存しない。
