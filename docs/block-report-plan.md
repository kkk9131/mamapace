# ブロック/通報機能 実装計画とチェックリスト

この文書は、ブロック（ユーザー単位）および通報（ユーザー/投稿/コメント/DM 等）機能を、安全に段階的に導入するための実装計画です。Supabase スキーマ変更、Edge Functions（任意）、クライアント実装、テスト、リリース手順を網羅します。

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

---

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

