# M1 実装計画: 母子手帳バッジ + 非公開ルーム制限

目的: 母子手帳番号の登録/認証バッジ付与と、それに紐づく非公開ルーム参加制限を最短で実装・提出可能にする。

対象ブランチ: `feature/m1-maternal-badge`
関連ドキュメント: `docs/next-version-feature-plan.md`

---

## 決定事項（案）

- データ保護: 母子手帳番号は平文保存禁止。ソルト付きハッシュ（復号不可）で保存。
- 公開範囲: 認証状態（`maternal_verified`）のみ公開可。ハッシュ/ソルトは非公開。
- 認証運用（案）: M1は「即時認証（自己申告）」を採用し、入力完了時点で `maternal_verified = true`。M2以降で管理者承認運用に拡張可能な設計を維持。
- UI方針: 
  - プロフィール編集に「母子手帳番号」入力（マスク表示）を追加。
  - バッジ表示箇所: プロフィール、投稿者名表示、ルーム一覧/詳細。
  - 未バッジの非公開ルーム参加はUI上で明示的にブロックし、説明文言を統一。
- サーバ方針:
  - DBはベーステーブルを厳格にRLS保護し、公開用のViewで `maternal_verified` など安全な項目のみ提供。
  - ルーム参加（特に非公開）には `maternal_verified = true` をサーバ側でも必須チェック（RLS/ポリシー or RPC）。

---

## 未決定事項（要回答）

1) 認証運用: M1は即時認証で確定しますか？（はい/いいえ）
   - いいえの場合: 管理者承認の権限主体（ロール/メールドメイン/手動SQLなど）を指定ください。
2) 認証文言: バッジ取得/未取得時の説明文言は日本語のみで進めます（ご要望あれば確定文言を支給ください）。

---

## 実装順序（段取り）

1. DBマイグレーション（`user_profiles` に列追加）
2. 公開用Viewの作成（`maternal_verified` のみ外部公開）
3. RPC実装（`set_maternal_id`, `verify_maternal_id`）
4. RLS/ポリシー更新（自己行の更新制御、公開Viewの参照制御）
5. ルーム参加ゲート（非公開ルームのサーバ側制御）
6. クライアントUI（プロフィール入力/保存、バッジ表示、非公開参加ブロック）
7. 受け入れテスト（未バッジ/バッジ済の挙動、再起動後の保持、平文露出なし）

---

## DB 変更（SQL案: Supabase/Postgres）

前提: `public.user_profiles` が存在し、主キーにユーザID（`id uuid` など）があること。

```sql
-- 1) 列追加
alter table public.user_profiles
  add column if not exists maternal_id_hash text,
  add column if not exists maternal_id_salt text,
  add column if not exists maternal_verified boolean default false not null,
  add column if not exists maternal_verified_at timestamptz;

-- 2) 公開用ビュー（安全な列のみ）
create or replace view public.user_profiles_public as
select
  id,
  display_name,
  avatar_url,
  maternal_verified
from public.user_profiles;

-- 3) RLS: ベーステーブルは厳格、ビューは参照許可
alter table public.user_profiles enable row level security;
-- 自分のプロフィール行のみ参照・更新可（既存方針に合わせて調整）
create policy if not exists user_profiles_self_select on public.user_profiles
  for select using (auth.uid() = id);
create policy if not exists user_profiles_self_update on public.user_profiles
  for update using (auth.uid() = id);

-- 公開ビューは全認証ユーザが参照可能（匿名公開が不要なら）
grant select on public.user_profiles_public to authenticated;
-- もし匿名も必要なら: grant select on public.user_profiles_public to anon;
```

注意: PostgresのRLSは列単位制御ではないため、公開ビューで安全な列だけをExposeします。クライアントは「一覧/他者情報取得」はビュー、自己編集はベーステーブル/RPCを通す方針とします。

---

## RPC（SQL案）

目的: 平文を扱う処理をDB内で完結し、アプリ/ログに残さない。

```sql
-- 必要拡張
create extension if not exists pgcrypto;

-- set_maternal_id: 入力値を受け取り、ソルト生成とハッシュ保存を行う
create or replace function public.set_maternal_id(p_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_salt text;
  v_hash text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- ランダムソルト生成（64バイト程度をBase64化）
  v_salt := encode(gen_random_bytes(48), 'base64');
  -- ハッシュ（SHA-256）
  v_hash := encode(digest(p_id || v_salt, 'sha256'), 'hex');

  update public.user_profiles
     set maternal_id_salt = v_salt,
         maternal_id_hash = v_hash,
         -- M1は即時認証とする（管理者承認に切り替える場合はここを外す）
         maternal_verified = true,
         maternal_verified_at = now()
   where id = v_uid;

  if not found then
    raise exception 'profile not found for user %', v_uid;
  end if;
  return true;
end;
$$;

revoke all on function public.set_maternal_id(text) from public;
grant execute on function public.set_maternal_id(text) to authenticated;

-- verify_maternal_id: 将来の管理者承認用（M1は即時認証のためダミー/管理者のみ）
create or replace function public.verify_maternal_id(p_user uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.user_profiles
     set maternal_verified = true,
         maternal_verified_at = now()
   where id = p_user;
  select true;
$$;

-- 管理者ロールのみ実行許可（ロール設計に合わせて修正）
revoke all on function public.verify_maternal_id(uuid) from public;
-- 例: grant execute on function public.verify_maternal_id(uuid) to service_role;
```

---

## 非公開ルームのサーバ側制御（SQL/RLS案）

前提（リポジトリ分析結果・現状実体）:
- `public.spaces(id, is_public boolean, ...)`
- `public.channels(id, space_id, ...)`
- `public.channel_members(channel_id, user_id, ...)` 参加は `insert` で表現

案1: `channel_members` への `insert` をRLSで制御（is_public=false のスペース=非公開扱い）

```sql
alter table public.channel_members enable row level security;

-- 参加（insert）時: 非公開ルームの場合は本人の maternal_verified が true であること
create policy if not exists channel_members_join_private on public.channel_members
  for insert
  with check (
    auth.uid() = user_id
    and (
      not exists (
        select 1
          from public.channels c
          join public.spaces s on s.id = c.space_id
         where c.id = channel_id and s.is_public = false
      )
      or exists (
        select 1 from public.user_profiles p where p.id = auth.uid() and p.maternal_verified = true
      )
    )
  );
```

案2: 参加処理をRPC化（将来のビジネスルール拡張に有利）

```sql
create or replace function public.join_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_private boolean;
  v_verified boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select is_private into v_private from public.rooms where id = p_room_id;
  if v_private is null then
    raise exception 'room not found';
  end if;

  if v_private then
    select maternal_verified into v_verified from public.user_profiles where id = v_uid;
    if not coalesce(v_verified, false) then
      raise exception 'maternal badge required';
    end if;
  end if;

  insert into public.room_members(room_id, user_id)
  values (p_room_id, v_uid)
  on conflict do nothing;
  return true;
end;
$$;

revoke all on function public.join_room(uuid) from public;
grant execute on function public.join_room(uuid) to authenticated;
```

M1では「案1（RLS）」だけでも可。既存クライアントが `channel_members` を直接操作しているため案1が無改修で効きやすい。今後の課金/招待ロジックの拡張を見据えるなら案2を推奨。

---

## クライアント実装（Expo React Native / supabase-js）

- プロフィール編集
  - 入力欄: 「母子手帳番号」（必須/フォーマット軽微、数値/英数のみ）。入力はマスク（●●）表示。
  - 保存: `rpc set_maternal_id(p_id text)` を呼び出す。成功時にスナックバー/ダイアログで完了通知。
  - 再入力/再申請: 同RPCの再呼び出しで上書き可能（運用で制限するならフロントで1日1回などのRate Limit）。
- バッジ表示
  - データ取得: 公開ビュー `user_profiles_public` から `maternal_verified` を参照。
  - 表示箇所: ユーザプロフィール、投稿者名横、ルーム一覧/詳細。
  - アイコン: 暫定の既存アイコン/カラー（要件があれば差し替え）。
- 非公開ルームのゲート制御
  - UI: 参加ボタンを押下した際、未バッジなら統一文言でブロック表示。
  - サーバ: 上記RLS/または `join_room` RPC で最終的に拒否するため、UI側は表示制御 + エラーハンドリングを実装。
  - 判定: `spaces.is_public = false` のスペース（非公開）に対する参加のみバッジを要求。

### バッジUI（アプリに合う仕様・ガイド）
- 配色/トーン: 既存のテーマカラーに準拠（Primaryの色調でコントラストAAを満たす）。
- アイコン: 小型シールド＋チェック（または母子テーマのハート＋チェック）。24dp前後、隣接テキストとの余白8dp。
- 表示箇所: ユーザ名の右側にインライン、プロフィールヘッダではラベル付き（例: 「認証済み」）。
- アクセシビリティ: スクリーンリーダー用に `accessibilityLabel="母子手帳認証済み"` を付与。
- 文言（日本語のみ）: 未取得時の案内「母子手帳の認証が必要です」。

---

## 受け入れテスト（M1）

- 平文露出なし: 入力値がネットワークログ/アプリログ/DBに平文で残らない。
- 入力→保存→表示: アプリ再起動後も `maternal_verified` が一貫して表示される。
- 未バッジの制限: 非公開ルーム参加がUI/サーバの両面でブロックされる（文言統一）。
- バッジ済の解除: バッジ登録後は非公開ルーム参加が可能になる。

---

## ログ/解析ポリシー（意味と運用）

- 目的: 母子手帳番号の平文が開発/運用のいかなるログにも残らないようにする。
- 範囲: コンソールログ、解析SDK、クラッシュレポート、ネットワークインスペクタ、DB/SQLエラーログ。
- 手段:
  - クライアント: 入力値をログに出さない。`secureLogger` と `sanitizeForLogging` を通し、`maternal_` 系キーは常にマスク/削除。
  - ネットワーク: 平文送信を避ける設定がある場合はクライアント暗号化を維持。M1は最小化のため「サーバでハッシュ」方針を優先。
  - サーバ: RPCで受け取り、アプリ/SQL関数内でも値をログ出力しない。例外メッセージにも含めない。
  - テスト/デバッグ: 固定文字列 `TEST_ID_MOCK` などのみ使用し、実IDは使用しない。
  - 監査: 監査時は `maternal_verified` のみを参照（ハッシュ/ソルトは参照不要）。

---

## 多言語対応

- 本M1は日本語のみ対応。文言キーは将来のi18n拡張に備えて抽象化（例: `t('badge.required')`）。

---

## ロールアウト/運用

- 秘匿情報の監査: 監査用にクエリ/ログ方針を確認（ハッシュ/ソルト以外の情報を保存しない）。
- リリース順: 先にサーバ側（DB/RLS/RPC）→ クライアント（UI/表示/ゲート）。
- フィーチャーフラグ: 必要に応じてクライアント表示の段階公開を検討。

---

## 将来拡張（M2以降の前提に配慮）

- 管理者承認フロー: `verify_maternal_id` を管理者専用に切り替え、`set_maternal_id` では `verified=false` のまま保管する運用に変更可能。
- 課金ゲート連動: `join_room` RPC にサブスク要件を追加してもよい（M1では未実装）。
- 監査証跡: `maternal_id_*` 更新の監査テーブル追加を検討。

---

## 移行戦略: 即時認証 → 管理者承認

- 互換性方針: クライアントは `maternal_verified` のみを参照。承認方式の変更はサーバ側で完結させ、クライアント変更を最小化。
- スキーマ追加（任意・推奨）:
  - `maternal_verified_method text check (maternal_verified_method in ('self','admin')) default 'self' not null`
  - `maternal_verified_by uuid`（管理者承認時に設定）
  - （必要なら）`maternal_verification_status text`（`pending/verified/rejected`）
- 切替手順:
  1) `set_maternal_id` から「即時 `verified=true`」を削除し、`verified=false` で保存。
  2) 管理者UI/RPC `verify_maternal_id(p_user)` で承認、`method='admin'` と `verified_by` を記録。
  3) 既存 `method='self'` のユーザは経過措置として有効を維持 or 再承認を要求（運用判断）。
- フィーチャーフラグ: `app_config.require_admin_verification=true` でクライアントの文言と導線を切替可能にする。

---

## クライアント技術の推奨

- ランタイム: Expo React Native（既存採用）+ TypeScript。
- データアクセス: `@supabase/supabase-js` v2 で RPC 優先、直接テーブル操作はRLSを前提に最小限。
- セキュリティ: 入力値は状態管理に長期保持しない、`SecureStore` はトークンのみに限定、番号は送信直前に扱う。
- UI実装: 既存の services 層（`profileService`/`roomService`）を踏襲。プロフィール画面に入力欄追加、`user_profiles_public` から `maternal_verified` を購読してバッジ表示。
- ログ: `secureLogger` を必須化。開発ビルドでも `maternal_*` の平文禁止（マスク）。

---

## ログ運用のセキュリティ

- 安全性評価: 本方針（平文不記録、サニタイズ、RPC内でも未出力）は個人情報保護の観点で妥当。
- 追加施策（推奨）:
  - 本番でのデバッグログ無効化、ログ保持期間の短縮。
  - 例外ハンドラで request body をログ出力しない運用を徹底。
  - Supabase 側で関数内 `RAISE` に入力値を含めないレビュー基準。
  - 解析/クラッシュSDKの自動PII収集を無効化（可能な範囲で）。
  - ネットワークはTLSで暗号化。開発時のネットワークインスペクタ（プロキシ）利用は内部環境限定。
