# ブロック/通報機能 実装計画とチェックリスト

この文書は、ブロック（ユーザー単位）および通報（ユーザー/投稿/コメント/DM 等）機能を、安全に段階的に導入するための実装計画です。Supabase スキーマ変更、Edge Functions（任意）、クライアント実装、テスト、リリース手順を網羅します。

---

## レビュー反映: 改善項目（優先度付き）

本ドキュメントの初版に対して実装レビューを受領。以下の改善を優先度順に追加します（この節は計画であり、実装はまだ行いません）。

### P1（高）必須対応

- 入力検証の強化（reportService）
  - 目的: `targetId`/`reasonText` の妥当性検証とサニタイズでインジェクション/不正データ保存を防止。
  - 方針: 空/長さ超過チェック、許可文字/最大長（例: `targetId`<=255, `reasonText`<=500）を実装。型は UI からの値をそのまま信頼しない。
  - 影響: `src/services/reportService.ts`

- レースコンディションの解消（useBlock）
  - 目的: API 失敗時のUI不整合を防ぐ。
  - 方針: 楽観更新は成功後に反映／あるいは失敗時にロールバック。`loading`/`error` 状態管理を追加。
  - 影響: `src/hooks/useBlock.ts`

- エラー文脈の付与（サービス層）
  - 目的: デバッグ・ユーザー通知に十分な文脈を提供。
  - 方針: 例外にコード/場所/操作名を付与、`notify*` と連携。`throw error` を `throw new Error('Block failed: ' + error.message)` のようにラップ。
  - 影響: `src/services/blockService.ts`, `src/services/reportService.ts`

- レンダリング中の状態更新を回避（メニュー表示）
  - 目的: React のレンダリングフェーズルール違反（レンダリング中の `setState`）を回避。
  - 方針: Alert の発火はハンドラー内または `useEffect` 経由で行い、JSX内の即時IIFEで `setShowMenu(false)` を呼ばない。
  - 影響: `src/components/PostCard.tsx`, `src/screens/ChatScreen.tsx`

- スキーマの一貫性（reports.target_id）
  - 目的: 参照整合性/JOIN最適化のために型を統一。
  - 方針: 可能なら `text` → `uuid` に変更（移行手順: `alter table ... alter column target_id type uuid using target_id::uuid`）。対象IDがすべてUUIDでない要件がある場合は、当面 `text` 維持＋入力検証/インデックス最適化で代替。
  - 影響: `supabase/sql/2025-09-10_block_and_report.sql`（後続マイグレーションで変更）

### P2（中）推奨対応

- ブロック状態チェック/キャッシュの最適化
  - 目的: N+1 クエリ回避とパフォーマンス改善。
  - 方針: `useBlockedList()` でTTL付きキャッシュ/メモ化、`isBlocked` の個別問い合わせを避ける。必要ならサーバ側でビュー化し `NOT EXISTS` を共通化。
  - 影響: `src/hooks/useBlock.ts`, 将来的にビュー/RLS

- デバウンス/レート制限
  - 目的: 連打によるAPIスパムと状態不整合を防止。
  - 方針: クライアント側で 300ms デバウンス＋操作中ボタン無効化。サーバ側（Edge Function採用時）はIP/ユーザー単位レート制限を追加。
  - 影響: UI各所、（任意で）Edge Functions

- UX向上（確認/ローディング/Undo）
  - 目的: 誤操作/不明瞭な状態を防止。
  - 方針: ブロック実行前に確認ダイアログ、送信中ローディング（ボタン無効化）、完了後に短時間の「元に戻す」導線を表示。
  - 影響: `PostCard`, `UserProfileScreen`, `ChatScreen`

### P3（低〜中）望ましい対応

- フィード/DMの除外のサーバサイド強化
  - 目的: クライアント以外からの参照経路も遮断し、二重化を回避。
  - 方針: ビュー or RPC・RLSで `NOT EXISTS (select 1 from block_relationships ...)` を共通化。

- エッジケース整備（多重通報/多重ブロック）
  - 目的: UI多重送信/重複INSERTの抑制。
  - 方針: DB一意制約に加え、フロントでの重複実行ガード。

### テスト計画（不足分の補填）

- サービス
  - `src/services/__tests__/blockService.test.ts`: 正常系/失敗系、エラー文脈の検証
  - `src/services/__tests__/reportService.test.ts`: 入力検証、INSERT 呼び出しの確認
- フック
  - `src/hooks/__tests__/useBlock.test.ts`: 楽観更新・失敗時ロールバック、デバウンス
- コンポーネント
  - `src/components/__tests__/PostCard.block.test.tsx`: メニュー表示、確認ダイアログ、ローディング、Undo

---

## 0. 前提・ブランチ

- [x] 作業ブランチ作成: `feat/block-report`
- [x] 初期スナップショットをコミット
- [ ] Draft PR を作成して進捗共有（個人開発でもバックアップ代わりに推奨）

---

## 1. スキーマ設計（Supabase / PostgreSQL）

目的: ブロック関係と通報レコードを永続化し、RLS でアクセス制御を厳格化。

- [ ] テーブル: `public.block_relationships`
  - `blocker_id uuid not null`（ブロックする側 = 現在ログインユーザー）
  - `blocked_id uuid not null`（ブロックされる側）
  - `created_at timestamptz not null default now()`
  - 制約: `check (blocker_id <> blocked_id)`（自己ブロック禁止）
  - 一意: `unique (blocker_id, blocked_id)`
  - インデックス: `idx_blocker_id`, `idx_blocked_id`
  - RLS:
    - [ ] `enable row level security`。
    - [ ] `INSERT`: `auth.uid() = blocker_id`
    - [ ] `DELETE`: `auth.uid() = blocker_id`
    - [ ] `SELECT`: `auth.uid() = blocker_id`（自分のブロック一覧のみ取得可）

- [ ] テーブル: `public.reports`
  - `id uuid primary key default gen_random_uuid()`
  - `reporter_id uuid not null`
  - `target_type text not null check (target_type in ('user','post','comment','message','room'))`
  - `target_id uuid not null`（投稿などが文字列IDの場合は text に変更）
  - `reason_code text not null`（例: 'spam'|'harassment'|'hate'|'nudity'|'other'）
  - `reason_text text null`（任意の補足）
  - `metadata jsonb not null default '{}'::jsonb`（クライアント環境/バージョン等）
  - `status text not null default 'open' check (status in ('open','triaged','closed'))`
  - `handled_by uuid null`（管理オペレータ）
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
  - インデックス: `(target_type,target_id)`, `(reporter_id)`, `(status)`
  - RLS:
    - [ ] `enable row level security`。
    - [ ] `INSERT`: `auth.uid() = reporter_id`
    - [ ] `SELECT`: 自分が送信したレポートのみ（`auth.uid() = reporter_id`）。管理者閲覧が必要なら `role` ベースで別ポリシー。

- [ ] 既存クエリとの整合性（閲覧制御）
  - 投稿・プロフィール・DM リストで「ブロックしている相手」を除外。
  - 最小実装は「クライアント側フィルタ」で開始し、段階的にビュー/RLS に反映。
  - 拡張（任意）: セキュリティ定義関数＋ビューで、`WHERE NOT EXISTS (select 1 from block_relationships ...)` を共通化。

- [ ] マイグレーション SQL 作成（例）
  - 追加: `supabase/sql/2025-09-__block_and_report.sql`
  - 適用: `supabase` CLI もしくは管理画面。PR に SQL を同梱。

---

## 2. Edge Functions（任意）

通報の非同期ワークフローや通知が必要な場合のみ。

- [ ] `supabase/functions/report-submit`（任意）
  - 入力検証、レート制限、必要ならモデレーション通知（Webhook/Email/Slack）。

- [ ] `supabase/functions/report-admin`（任意）
  - `status` 更新、`handled_by` 設定。管理者ロールのみ許可。

- [ ] （任意）ストレージ/スクリーンショット添付対応。

---

## 3. クライアント実装（Expo/React Native, TypeScript）

層別に最小変更→拡張の順で実装。

### 3.1 型定義（`src/types/`）
- [ ] `Report.ts` に型を追加: `Report`, `ReportTargetType`, `ReportReasonCode`。
- [ ] `Block.ts` に型を追加: `BlockRelation`。

### 3.2 サービス層（`src/services/`）
- [ ] `blockService.ts` 新規
  - `blockUser(blockedUserId: string)`
  - `unblockUser(blockedUserId: string)`
  - `listBlockedUsers()`
  - `isBlocked(userId: string)`（クライアントキャッシュ前提で最小実装）
- [ ] `reportService.ts` 新規
  - `submitReport(targetType, targetId, reasonCode, reasonText?)`

### 3.3 Context/Hook（`src/contexts/`, `src/hooks/`）
- [ ] `BlockContext`（任意）: ブロック一覧のメモ化と購読
- [ ] `useBlock()` / `useIsBlocked(userId)` / `useBlockedList()`
- [ ] `useReport()`：通報送信、UI 状態管理
- [ ] 既存フィード・DM 取得フックに「ブロック相手の除外」フィルタ（クライアント側）

### 3.4 UI コンポーネント（`src/components/`）
- [ ] `PostCard` の「…（メニュー）」に「通報」「ユーザーをブロック」を追加
- [ ] プロフィール画面アクションに「ブロック/解除」「通報」を追加
- [ ] チャット画面のアクションに「ブロック」「通報」
- [ ] 成功/失敗のトースト表示（既存のトーストユーティリティがあれば利用）

### 3.5 画面/ナビゲーション（`src/screens/`, `src/navigation/`）
- [ ] `BlockedUsersListScreen` 新規（管理用）
- [ ] `ReportReasonScreen` 新規（理由選択 + 任意テキスト）
- [ ] `navigation` にルート追加、各画面から遷移

### 3.6 ユーティリティ/定数（`src/utils/`）
- [ ] `reportReasons.ts`：表示用ラベルとコードの対応
- [ ] ガード関数：`shouldHideContentForUser(targetUserId)`（ブロック配列で判定）

---

## 4. 仕様（最小版）

- ブロックは「片方向」最小実装：A が B をブロック → A の画面に B を表示しない。
- DM/メンション/フォローなど、相互作用 UI も非表示（最小はクライアント側フィルタ）。
- 通報は匿名ではなくユーザー起点（`reporter_id = auth.uid()`）。
- 通報完了後はサンクス画面/トースト表示。重複通報は許容（モデレータ側で集約）。

拡張（任意）:
- 相手側からも閲覧不可にするサーバサイド制御（RLS またはビューでの除外）。
- 重複通報のサーバサイド抑制（`unique` 制約など）

---

## 5. エラーハンドリング/UX

- [ ] ネットワーク/サーバエラー時のリトライ/トースト
- [ ] 二重タップ防止（送信中はボタン無効化）
- [ ] ブロック済み/未ブロックの状態反映（ボタンラベル切替）

---

## 6. セキュリティ/RLS

- [ ] RLS 有効化と厳格化（自己行のみ読み書き）
- [ ] クライアントからの `reporter_id`/`blocker_id` はサーバ側で `auth.uid()` 強制
- [ ] レート制限（Edge Function を使う場合）
- [ ] PII ログを残さない。`console` ログ禁止（ESLint ルール準拠）
- [ ] 入力検証の強化（report対象のIDフォーマット・最大長、`reason_text` の最大長/許可文字）

---

## 7. テスト

- サービス/フック/コンポーネントの単体テストを近接配置で作成。
  - [ ] `src/services/__tests__/blockService.test.ts`
  - [ ] `src/services/__tests__/reportService.test.ts`
  - [ ] `src/components/__tests__/PostCard.menu.test.tsx`
  - [ ] `src/screens/__tests__/ReportReasonScreen.test.tsx`
  - [ ] `src/hooks/__tests__/useBlock.test.ts`
- [ ] フィード/DM リストからブロック相手が除外されることを検証（モックで）
- [ ] `npm test` / `npm run test:coverage` をパス
- [ ] レンダー中の状態更新を避ける（メニュー/Alertの発火位置の単体テストで確認）

---

## 8. 移行・リリース手順

- [ ] SQL を PR に同梱し、ステージング/ローカルで適用
- [ ] 型生成（使用していれば）: `supabase gen types typescript --project-id <id>` → `src/types/supabase.ts` 反映
- [ ] クライアント実装を段階的にマージ
- [ ] QA チェック
  - [ ] ブロック→フィード/検索/プロフィール/DM 非表示を確認
  - [ ] 解除→再表示を確認
  - [ ] 通報送信→DB 反映・UI フィードバック
- [ ] ドラフト PR をオープン→セルフレビュー→マージ
- [ ] （必要なら）`reports.target_id` の型変更マイグレーションを段階適用
  - 例: `alter table public.reports alter column target_id type uuid using target_id::uuid;`
  - 事前検証: 既存データのキャスト成功、全参照先がUUIDであること

---

## 9. リスクと緩和

- RLS 漏れ: 最初はクライアントフィルタ、後続でビュー/RLSを補強。
- 誤操作: 確認ダイアログ、Undo（解除）導線。
- 通報スパム: レート制限、同一対象へのクールダウン。

---

## 10. 完了条件（Definition of Done）

- [ ] スキーマ（2 テーブル）と RLS 適用済み
- [ ] サービス/API でブロック/通報が機能
- [ ] 主要画面に「ブロック」「通報」導線を実装
- [ ] フィード/DM でブロック相手が非表示
- [ ] テスト/リンタがグリーン
- [ ] リリースノート/QA 済み
- [ ] 上記P1項目がすべて解消、P2項目の主要部分が完了

---

## 次フェーズ詳細計画（実装順のガイド）

この章では「サーバ側除外 → DM RLS → UI抑止 → 通報ワークフロー（Edge） → 追加テスト」の順に、設計/下書きSQL/AC（受け入れ基準）を簡潔にまとめます。実装は段階的に小さなPRで進めます。

### 1) サーバ側除外（ビュー＋RLS）→ 主要画面から段階切替（高）

- 目的: クライアント以外の経路も含めて参照を遮断し、データアクセスの一貫性と安全性を高める。
- 方針（段階導入）
  1. フィルタビューを新設（Security Invoker）
     - posts_filtered, user_profiles_public_filtered, conversations_filtered（必要に応じて messages_filtered 等）
     - 共通条件: `NOT EXISTS (select 1 from public.block_relationships br where br.blocker_id = auth.uid() and br.blocked_id = <対象所有者ID>)`
  2. 主要画面（ホーム/検索/DMリスト/通知など）のクエリをビューへ切替（1画面ずつ）
  3. モニタリング: 件数変動/例外の監視（暫定でログ/ダッシュボード）
  4. 最終的にベーステーブルへの直接参照を閉じる（必要なRLS/権限調整を別PRで）

- 参考SQL（たたき台）
```sql
-- 投稿: 所有者がブロック対象なら除外
create or replace view public.posts_filtered as
select p.*
from public.posts p
where not exists (
  select 1 from public.block_relationships br
  where br.blocker_id = auth.uid()
    and br.blocked_id = p.user_id
);

-- 公開プロフィールのフィルタ
create or replace view public.user_profiles_public_filtered as
select up.*
from public.user_profiles_public up
where not exists (
  select 1 from public.block_relationships br
  where br.blocker_id = auth.uid()
    and br.blocked_id = up.id
);

-- DM一覧（例）: other_participant_id は実スキーマに合わせてJOIN/関数で抽出
create or replace view public.conversations_filtered as
select c.*
from public.conversations c
where not exists (
  select 1 from public.block_relationships br
  where br.blocker_id = auth.uid()
    and br.blocked_id = (case when c.participant_1_id = auth.uid() then c.participant_2_id else c.participant_1_id end)
);

-- 必要に応じて: security_invoker
alter view public.posts_filtered set (security_invoker = true);
alter view public.user_profiles_public_filtered set (security_invoker = true);
alter view public.conversations_filtered set (security_invoker = true);
```

- 受け入れ基準（AC）
  - ビューへの切替後、ブロック相手がAPIレスポンスに含まれない（キャッシュを除く）
  - 主要画面（ホーム/検索/DM）でUXが保持されパフォーマンスも許容範囲

### 2) DM作成・送信のRLS拒否（高）

- 目的: ブロック状態での新規DM作成やメッセージ送信をサーバ側で拒否。
- 方針
  - シンプルなアプローチ: 会話IDから相手IDを解決し、ブロック関係があれば `messages` への INSERT を拒否。
  - パフォーマンス/可読性のため、関数化推奨。

- 参考SQL（たたき台）
```sql
-- 会話相手がブロック対象ならfalse
create or replace function can_send_message(p_conversation_id uuid)
returns boolean language sql stable as $$
  select not exists (
    select 1
    from public.conversations c
    join public.block_relationships br
      on br.blocker_id = auth.uid()
     and br.blocked_id = (case when c.participant_1_id = auth.uid() then c.participant_2_id else c.participant_1_id end)
   where c.id = p_conversation_id
  );
$$;

-- RLS（messagesテーブル）: 送信者本人かつ can_send_message= true のときのみ許可
alter table public.messages enable row level security;
drop policy if exists messages_insert_policy on public.messages;
create policy messages_insert_policy on public.messages
  for insert with check (
    auth.uid() = sender_id
    and can_send_message(conversation_id)
  );
```

- 受け入れ基準（AC）
  - ブロック状態でのDM送信がサーバ側で拒否される（クライアント改変で回避不可）
  - 解除後は送信可能

### 3) UIのインタラクション抑止（中）

- 目的: サーバ側拒否に先行・補完する形でUXを向上させ、無駄な操作/エラーを減らす。
- 方針/対象
  - プロフィール: isBlocked＝true なら「フォロー/チャット」無効化（mutatingはスピナー）
  - チャット画面: ブロック状態なら入力欄/送信ボタンを無効化し、案内文言を表示
  - メンション・サジェスト: ブロック相手を候補から除外
  - Undo: ブロック直後に短時間「元に戻す（解除）」導線

- 受け入れ基準（AC）
  - ブロック状態時に主要なインタラクションが無効化され、誤操作が減る

### 4) Edge Functions 通報ワークフロー（レート制限＋通知）（中）

- 目的: 通報運用の実効性を高め、スパム通報を抑止。
- 構成案
  - `functions/report-submit`: 入力検証（ID/型/長さ）、ユーザー・対象単位のクールダウン（例: 1分/1回, 日次上限）、通知（Slack/Email/Webhook）
  - `functions/report-admin`（任意）: `status`/`handled_by` 更新
  - 監査ログ: 重要な通報を `security_audit_log` に記録

- 参考の擬似フロー
```ts
// report-submit (pseudo)
validate(auth.uid(), body);
assertNotRateLimited(auth.uid(), body.targetType, body.targetId);
insert into public.reports (...);
notifyModerators(...);
```

- 受け入れ基準（AC）
  - 連続通報が一定時間で制限される
  - 通報が通知先に到達し、管理者が確認できる

### 5) 追加テスト（新機能部位に絞る）（中）

- サーバ側除外
  - ビュー切替後にブロック相手が含まれないこと（モック/API層の単体）
  - DM送信RLS: ブロック時に拒否（関数の単体テスト or シミュレーション）
- UI抑止
  - プロフィール/チャットの無効化と案内文言の表示
  - Undo導線の表示/動作
- Edge Functions
  - 通報入力検証、レート制限ヒット、通知の発火（ステージングでE2E）


## 付録：SQL のたたき台（参考）

> 実際の SQL は `supabase/sql/2025-09-__block_and_report.sql` に配置してください。

```sql
-- block_relationships
create table if not exists public.block_relationships (
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz not null default now(),
  constraint block_no_self check (blocker_id <> blocked_id),
  constraint block_unique unique (blocker_id, blocked_id)
);

alter table public.block_relationships enable row level security;

create policy block_rel_insert on public.block_relationships
  for insert with check (auth.uid() = blocker_id);

create policy block_rel_delete on public.block_relationships
  for delete using (auth.uid() = blocker_id);

create policy block_rel_select on public.block_relationships
  for select using (auth.uid() = blocker_id);

create index if not exists idx_blocker_id on public.block_relationships(blocker_id);
create index if not exists idx_blocked_id on public.block_relationships(blocked_id);

-- reports
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  target_type text not null check (target_type in ('user','post','comment','message','room')),
  target_id uuid not null,
  reason_code text not null,
  reason_text text null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','triaged','closed')),
  handled_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy reports_insert on public.reports
  for insert with check (auth.uid() = reporter_id);

create policy reports_select_own on public.reports
  for select using (auth.uid() = reporter_id);

create index if not exists idx_reports_target on public.reports(target_type, target_id);
create index if not exists idx_reports_reporter on public.reports(reporter_id);
create index if not exists idx_reports_status on public.reports(status);
```

---

## 実装順序の推奨

1) SQL（テーブル＋RLS）→ 2) サービス → 3) UI 導線 → 4) クライアント側除外 → 5) テスト → 6)（任意）ビュー/RLS強化 → 7) ドキュメント/リリース

---

## ロードマップ（優先度と詳細・新規参加者向け）

この機能群は段階導入で安全にリリースします。下記は優先度順の実行計画と、初見の開発者でも把握できる要点です。

### 0) 現状サマリ（2025-09-10 時点）
- DB: `block_relationships` と `reports` の作成とRLS適用が完了。`user_profiles_public` は `security_invoker` 化済。
- クライアント: サービス/フック（blockService, reportService, useBlock, useReport）を追加。Home/DM にクライアント側除外とメニュー導線（通報/ブロック）を実装済み。
- 既知の改善（P1優先）: 入力検証強化、useBlockのレース解消、サービス層のエラー文脈、レンダー中のsetState回避、`reports.target_id` 型の一貫性検討。

### 1) 検索/フォロー・フォロワー一覧にもブロック除外を適用（最優先）
- 目的: 体験の一貫性とプライバシー保護を即座に高める（低リスク）。
- 対象: 検索画面、`FollowersListScreen`、`FollowingListScreen`、（必要があれば）関連一覧。
- 実装方針:
  - 既存の `useBlockedList()` を各一覧の描画直前で適用し、`otherUserId` が `blocked` に含まれるアイテムをフィルタ除外。
  - パフォーマンス: N+1回避のため、一覧単位での一括ロード後に配列フィルタ。将来的にはサーバ側のビュー/RPCに切替予定（後述のStep 3）。
- 受け入れ基準（AC）:
  - ブロック相手が検索/フォロー/フォロワーに表示されない。
  - 解除後は再表示される（手動更新 or 画面再表示でOK）。
- リスク/対策: 検索結果件数が変動するため、UIの空状態文言が不自然にならないよう確認。
- テスト: モックで `blocked` にユーザーを含め、除外を検証（ユニット）。

### 2) BlockedUsersListScreen の追加（ブロック管理UI）
- 目的: 誤ブロックの解除導線を提供し、サポート/運用負荷を削減。
- 画面仕様（最小）:
  - 一覧: `listBlockedUsers()` の結果（avatar/名前は必要なら `user_profiles_public` から補完）。
  - 操作: `解除` ボタン（確認ダイアログ→実行→トースト）。
  - 遷移: 設定/プロフィールメニューから遷移できるようにする。
- 技術方針: 新規 `src/screens/BlockedUsersListScreen.tsx` とルーティング追加のみ。サーバ変更は不要。
- 受け入れ基準（AC）:
  - ブロック済みユーザーが一覧に表示され、解除できる。
  - 解除後、他一覧・検索にも反映される（`useBlockedList().refresh()` または再マウント）。
- テスト: レンダリング/解除操作のユニットテスト。

### 3) サーバ側での除外強化（ビュー＋RLSで相手側表示も遮断）
- 目的: クライアント外経路も含めて参照を遮断し、データアクセス経路を一元化/堅牢化。
- 方針（段階ロールアウト）:
  1. ビュー新設（例）: `posts_filtered`, `user_profiles_public_filtered`, `conversations_filtered` など。
  2. ビューでの共通条件: `NOT EXISTS (select 1 from public.block_relationships br where br.blocker_id = auth.uid() and br.blocked_id = <対象の所有者ID>)`
  3. 既存クエリを段階的にビューへ切替（画面ごとにスイッチ）。
  4. モニタリング: 例外/件数の大幅変動をダッシュボードで確認。
  5. RLS強化（任意）: ビュー側に寄せた後、テーブルを直接叩く経路をポリシーで制限。
- 参考SQL（たたき台）:
```sql
-- 投稿のフィルタビュー（例）
create or replace view public.posts_filtered as
select p.*
from public.posts p
where not exists (
  select 1 from public.block_relationships br
  where br.blocker_id = auth.uid()
    and br.blocked_id = p.user_id
);

-- 公開プロフィールビューのフィルタ（maternal_verifiedの例と組み合わせ）
create or replace view public.user_profiles_public_filtered as
select up.*
from public.user_profiles_public up
where not exists (
  select 1 from public.block_relationships br
  where br.blocker_id = auth.uid()
    and br.blocked_id = up.id
);
```
- 受け入れ基準（AC）:
  - ビュー切替後、ブロック相手はAPIレスポンスに含まれない（端末キャッシュのみが残る）。
  - 主要画面（フィード/検索/DM）のクエリが新ビューを用いてもパフォーマンス良好。
- ロールバック戦略: ビュー適用を機能フラグで切替可能にし、問題が出た画面のみ迅速に戻せるようにする。

### 4) 通報ワークフロー（Edge Functions：通知・レート制限）
- 目的: モデレーション運用を可能にし、通報のスパムを抑止。
- 構成案:
  - `functions/report-submit`: 入力検証（target存在チェック/フォーマット/長さ）、ユーザー単位・対象単位のクールダウン、モデレーション通知（Slack/Email/Webhook）。
  - `functions/report-admin`（任意）: `status`/`handled_by` の更新API（管理者のみ）。
  - 監査ログ: 重要なアクションは `security_audit_log` に記録。
- 受け入れ基準（AC）:
  - 連続通報に対し、一定時間で適切に制限/エラー応答する。
  - 通報が通知先に到達し、管理者が確認できる。
- テスト/運用: 閾値・通知先を `.env`/Project Settings で変更可能、E2E テストはステージングで実施。

### フィーチャーフラグ / 計測
- フラグ例: `feature.block_filter_server`, `feature.block_ui_bulk`, `feature.report_edge_function`
- 計測/ログ: 除外ヒット率、通報回数・レート制限ヒット、ブロック/解除の回数、エラー率。

### リスク管理と段階導入
- クライアント優先→サーバ強化の順で実施（ロールバック容易性重視）。
- ビュー切替やRLS強化は画面単位で行い、影響範囲を限定。
- すべての変更に小さなPRを推奨、CIで `npm test`/`lint` を通過させる。
