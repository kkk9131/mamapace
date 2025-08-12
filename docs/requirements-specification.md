# mamapace 要件定義書

母子手帳番号認証とGemini AI統合を含むReact Native SNSアプリの包括的要件定義書

---

## 📋 文書情報

| 項目 | 内容 |
|------|------|
| **文書名** | mamapace 要件定義書 |
| **バージョン** | 1.0.0 |
| **作成日** | 2025-01-XX |
| **最終更新** | 2025-01-XX |
| **SuperClaude活用** | architect + security + backend ペルソナ |

---

## 🎯 プロジェクト概要

### アプリケーション概要
**mamapace**は、母子手帳番号を用いた認証システムとGemini AI統合による、ママ向け匿名SNSアプリです。

### ビジネス目標
1. **安全な母親コミュニティ**: 母子手帳番号による信頼性の高い認証
2. **匿名性の確保**: プライバシーを重視したコミュニケーション
3. **AI支援**: Gemini AIによる育児相談・情報提供
4. **リアルタイム交流**: 即座のコミュニケーションとサポート

### ターゲットユーザー
- **主要**: 妊娠中・育児中のママ（20代-40代）
- **副次**: 育児に関わるパートナー、家族
- **地域**: 日本国内（母子手帳保有者）

---

## 🔒 認証・セキュリティ要件

### 認証システム仕様

#### 必須認証情報
```yaml
登録時必須項目:
  - 母子手帳番号: string (10桁) ※必須・一意
  - ユーザー名: string (3-20文字) ※必須・一意
  - パスワード: string (8文字以上) ※必須
  
任意項目:
  - 表示名: string (1-30文字)
  - 自己紹介: string (最大500文字)
  - アイコン: 選択式絵文字
```

#### 母子手帳番号検証仕様

**🔴 セキュリティクリティカル要件**
```yaml
検証レベル:
  - フォーマット検証: 10桁数字のみ許可
  - 一意性検証: DB内で重複不可
  - 暗号化保存: AES-256暗号化
  - アクセス制限: システム管理者のみ復号可能

プライバシー保護:
  - 表示禁止: UI上で母子手帳番号は非表示
  - ログ除外: 母子手帳番号はログ出力禁止
  - API隠蔽: クライアントAPIレスポンスから除外
```

#### パスワードポリシー
```yaml
要件:
  - 最小長: 8文字
  - 最大長: 128文字
  - 必須文字: 英数字を含む
  - 推奨: 記号を含む
  - 禁止: 一般的な脆弱パスワード

セキュリティ:
  - ハッシュ化: bcrypt (コスト12)
  - Salt: ユーザーごとに一意
  - 保存: ハッシュのみDB保存
```

### セッション管理
```yaml
認証方式: JWT (JSON Web Token)
有効期限: 
  - アクセストークン: 15分
  - リフレッシュトークン: 7日間

セキュリティ機能:
  - 自動ログアウト: 30日間非アクティブ
  - デバイス管理: 最大5デバイスまで同時ログイン
  - 異常検知: 不審なログインの通知
```

---

## 🤖 Gemini AI統合要件

### AI機能仕様

#### 1. 育児相談AI
```yaml
機能概要: Gemini AIによる24時間育児相談
入力方式: テキスト入力
応答形式: 構造化された回答

対応領域:
  - 授乳・離乳食に関する質問
  - 睡眠・生活リズムの相談
  - 発達・成長に関する不安
  - 健康・病気の基本的な質問
  
制限事項:
  - 医療診断は提供しない
  - 緊急時は医療機関受診を推奨
  - 回答は参考情報として提供
```

#### 2. 投稿内容分析
```yaml
機能概要: 投稿の感情分析・カテゴリ分類
処理タイミング: 投稿時リアルタイム

分析項目:
  - 感情分析: ポジティブ/ネガティブ/中立
  - カテゴリ分類: 育児/健康/愚痴/質問/その他
  - キーワード抽出: 主要トピック識別
  
活用方法:
  - 関連投稿の推奨
  - 適切な返信サポート
  - コミュニティモデレーション支援
```

#### 3. 自動応答・サポート
```yaml
機能概要: 夜間・緊急時の自動サポート
稼働時間: 24時間365日

サポート内容:
  - よくある質問への自動回答
  - 緊急時の対応ガイダンス
  - 関連リソース・情報の提供
  - 適切なコミュニティへの誘導
```

### Gemini API統合仕様
```yaml
API選択: Gemini-1.5-Flash (高速レスポンス重視)
料金プラン: 従量課金制
制限設定:
  - 月間クエリ数: 50,000リクエスト
  - レート制限: 10リクエスト/秒
  - レスポンス時間: <2秒

セキュリティ:
  - API Key管理: 環境変数で管理
  - データ暗号化: TLS 1.3
  - ログ管理: PII情報除外
```

---

## 📱 機能要件

### 1. ユーザー認証・管理

#### 1.1 ユーザー登録
```yaml
画面: 登録画面
必須項目: 母子手帳番号、ユーザー名、パスワード
検証:
  - 母子手帳番号: フォーマット + 一意性
  - ユーザー名: 文字数 + 一意性 + 禁止文字
  - パスワード: 複雑さ要件
成功時: 自動ログイン + ホーム画面遷移
```

#### 1.2 ログイン
```yaml
画面: ログイン画面
入力方式: ユーザー名/母子手帳番号 + パスワード
認証方式: JWT発行
オプション:
  - ログイン状態維持: 最大7日間
  - パスワード忘れ: リセット機能
成功時: ホーム画面遷移
```

#### 1.3 プロフィール管理
```yaml
画面: プロフィール設定画面
編集可能項目:
  - 表示名: 変更可能
  - 自己紹介: 変更可能
  - アイコン: 選択可能
編集不可項目:
  - 母子手帳番号: セキュリティ上変更不可
  - ユーザー名: 一意性保持のため変更不可
```

### 2. 投稿・タイムライン機能

#### 2.1 投稿機能
```yaml
投稿タイプ:
  - テキスト投稿: 最大2000文字
  - 画像投稿: 最大4枚、10MB/枚
  - 気分タグ: 元気/眠い/しんどい/幸せ

匿名オプション:
  - 実名投稿: 表示名で投稿
  - 匿名投稿: "匿名"で表示

AI分析:
  - 投稿内容の感情分析
  - カテゴリ自動分類
  - 不適切投稿の検知
```

#### 2.2 タイムライン
```yaml
表示方式:
  - 時系列: 最新順表示
  - フィルタ: 気分タグ別フィルタリング
  - 無限スクロール: ページネーション

インタラクション:
  - いいね機能: ハートマーク
  - コメント機能: ネスト可能
  - シェア機能: アプリ内シェア
```

### 3. チャット・コミュニケーション

#### 3.1 1対1チャット
```yaml
機能:
  - リアルタイムメッセージング
  - 既読状態表示
  - 画像・絵文字送信
  - メッセージ削除

プライバシー:
  - エンドツーエンド暗号化検討
  - ブロック機能
  - 通報機能
```

#### 3.2 匿名ルーム
```yaml
ルーム種類:
  - トピック別: 授乳/離乳食/睡眠等
  - 時期別: 妊娠期/0-6ヶ月/1歳以上等
  - 地域別: 都道府県別

参加制限:
  - 最大参加者数: 100名/ルーム
  - 参加条件: 認証済みユーザー
  - モデレーション: AI支援 + 人的監視
```

### 4. Gemini AI機能

#### 4.1 育児相談チャット
```yaml
UI:
  - 専用チャット画面
  - AI識別アイコン表示
  - 音声入力対応検討

機能:
  - 24時間対応
  - 多言語対応(日本語メイン)
  - 履歴保存
  - お気に入り回答保存

制限:
  - 医療診断禁止
  - 個人情報取得制限
  - 不適切質問への対応
```

#### 4.2 投稿サポート
```yaml
機能:
  - 投稿内容の改善提案
  - 適切なタグ提案
  - 感情に応じた返信例提示
  - 関連情報の自動表示

プライバシー:
  - 投稿内容の学習利用は制限
  - 個人を特定する情報は除外
```

---

## 🏗️ 技術要件

### アーキテクチャ構成

#### フロントエンド
```yaml
Framework: React Native + Expo
Language: TypeScript
UI Library: React Navigation + Expo UI
State Management: Context API + Zustand

主要依存関係:
  - React Native 0.79.5
  - Expo SDK 53.0.20
  - TypeScript 5.8.3
  - React Navigation 6.1.18
```

#### バックエンド
```yaml
Database: Supabase (PostgreSQL)
Authentication: Supabase Auth + カスタム拡張
Real-time: Supabase Realtime
File Storage: Supabase Storage

API統合:
  - Gemini AI API (gemini-1.5-flash)
  - Push Notifications (Expo Push)
```

### データベース設計

#### ユーザー関連テーブル
```sql
-- ユーザーマスター
users_profile (
  id uuid primary key references auth.users,
  username varchar(20) unique not null,
  display_name varchar(30),
  bio text,
  avatar_emoji varchar(10),
  maternal_health_book_encrypted text not null, -- 暗号化保存
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  -- セキュリティ
  constraint username_format check (username ~ '^[a-zA-Z0-9_]{3,20}$'),
  constraint maternal_health_book_unique unique (maternal_health_book_encrypted)
);

-- プライバシー設定
user_privacy_settings (
  user_id uuid references users_profile(id) primary key,
  anonymous_posts_default boolean default false,
  ai_interaction_enabled boolean default true,
  data_usage_consent boolean default false,
  updated_at timestamp with time zone default now()
);
```

#### 投稿関連テーブル
```sql
-- 投稿マスター
posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users_profile(id) on delete cascade,
  content text not null,
  mood_tag varchar(20), -- 'happy', 'tired', 'tough', 'peaceful'
  is_anonymous boolean default false,
  ai_sentiment_score float, -- Gemini分析結果
  ai_category varchar(50), -- Gemini分類結果
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  constraint content_length check (char_length(content) <= 2000),
  constraint mood_tag_valid check (mood_tag in ('happy', 'tired', 'tough', 'peaceful'))
);

-- いいね
post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references users_profile(id) on delete cascade,
  created_at timestamp with time zone default now(),
  
  unique(post_id, user_id)
);

-- コメント
post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references users_profile(id) on delete cascade,
  parent_comment_id uuid references post_comments(id),
  content text not null,
  is_anonymous boolean default false,
  created_at timestamp with time zone default now(),
  
  constraint content_length check (char_length(content) <= 1000)
);
```

#### チャット関連テーブル
```sql
-- チャットルーム
chat_rooms (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  description text,
  room_type varchar(20) not null, -- 'private', 'anonymous', 'topic'
  topic_category varchar(50), -- 'breastfeeding', 'sleep', 'development'
  max_participants integer default 100,
  created_by uuid references users_profile(id),
  created_at timestamp with time zone default now(),
  
  constraint room_type_valid check (room_type in ('private', 'anonymous', 'topic'))
);

-- ルーム参加者
room_participants (
  room_id uuid references chat_rooms(id) on delete cascade,
  user_id uuid references users_profile(id) on delete cascade,
  joined_at timestamp with time zone default now(),
  
  primary key (room_id, user_id)
);

-- メッセージ
messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references chat_rooms(id) on delete cascade,
  sender_id uuid references users_profile(id) on delete cascade,
  content text not null,
  message_type varchar(20) default 'text', -- 'text', 'image', 'system'
  is_anonymous boolean default false,
  created_at timestamp with time zone default now(),
  
  constraint content_length check (char_length(content) <= 2000)
);
```

#### AI関連テーブル
```sql
-- AI相談履歴
ai_consultations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users_profile(id) on delete cascade,
  question text not null,
  ai_response text not null,
  consultation_category varchar(50),
  satisfaction_rating integer, -- 1-5
  created_at timestamp with time zone default now(),
  
  constraint rating_range check (satisfaction_rating between 1 and 5)
);

-- AI分析ログ
ai_analysis_logs (
  id uuid primary key default gen_random_uuid(),
  content_type varchar(20) not null, -- 'post', 'comment', 'message'
  content_id uuid not null,
  analysis_type varchar(50) not null, -- 'sentiment', 'category', 'moderation'
  analysis_result jsonb not null,
  confidence_score float,
  created_at timestamp with time zone default now()
);
```

---

## 🔐 セキュリティ・プライバシー要件

### データ保護

#### 個人情報保護
```yaml
母子手帳番号:
  - 暗号化: AES-256-GCM
  - 鍵管理: AWS KMS / Supabase Vault
  - アクセス制御: システム管理者のみ
  - 監査ログ: 全アクセス記録

個人識別情報(PII):
  - 最小化原則: 必要最小限の収集
  - 匿名化: 可能な限り匿名化
  - 保存期間: ユーザー削除と同時に完全削除
  - 第三者共有: 原則禁止
```

#### 通信セキュリティ
```yaml
暗号化:
  - API通信: TLS 1.3
  - リアルタイム通信: WSS (WebSocket Secure)
  - ファイル転送: End-to-End暗号化

認証・認可:
  - JWT: RS256署名
  - API Key: ローテーション対応
  - レート制限: DDoS攻撃対策
```

### プライバシー機能

#### ユーザー制御
```yaml
匿名性制御:
  - 投稿単位での匿名選択
  - プロフィール表示制御
  - 検索除外設定

データ管理:
  - データエクスポート: JSON形式
  - アカウント削除: 完全削除保証
  - データ修正権: 個人情報修正機能
```

#### AI関連プライバシー
```yaml
Gemini AI連携:
  - 個人情報除外: 自動的に除外
  - 学習利用禁止: 明示的にオプトアウト
  - ログ保存期間: 90日間限定
  - データ所在地: 日本国内限定検討
```

---

## 📊 パフォーマンス要件

### レスポンス性能
```yaml
目標値:
  - 画面遷移: <300ms
  - API応答: <500ms  
  - AI応答: <2000ms
  - リアルタイムメッセージ: <100ms

リソース効率:
  - アプリサイズ: <50MB
  - メモリ使用量: <200MB (Android)
  - バッテリー消費: 標準的なSNSアプリと同等
```

### スケーラビリティ
```yaml
同時接続数:
  - フェーズ1: 1,000ユーザー
  - フェーズ2: 10,000ユーザー
  - フェーズ3: 100,000ユーザー

データ量:
  - 月間投稿数: 100,000投稿
  - メッセージ数: 1,000,000メッセージ
  - AI相談件数: 10,000件
```

---

## 🌐 外部連携・API要件

### Gemini AI API
```yaml
エンドポイント: https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash
認証方式: API Key
制限事項:
  - リクエスト/分: 600
  - リクエスト/日: 10,000
  - コンテンツ制限: 32K tokens

データフロー:
  1. ユーザー入力 → フィルタリング
  2. Gemini API → リクエスト送信  
  3. レスポンス → 内容検証
  4. ユーザー → 表示
```

### Supabase統合
```yaml
認証: Supabase Auth + RLS (Row Level Security)
データベース: PostgreSQL 15+
リアルタイム: WebSocket接続
ストレージ: 画像・ファイル保存

セキュリティポリシー例:
-- 投稿は本人のみ編集可能
create policy "Users can update own posts" on posts
  for update using (auth.uid() = user_id);

-- 匿名投稿でも本人は識別可能
create policy "Users can view posts" on posts
  for select using (
    auth.role() = 'authenticated'
  );
```

---

## 📱 UI/UX要件

### デザイン原則
```yaml
アクセシビリティ:
  - WCAG 2.1 AA準拠
  - 音声読み上げ対応
  - 色覚障がい対応
  - 大きなタップターゲット (44px以上)

ユーザビリティ:
  - 直感的なナビゲーション
  - 一貫したUIパターン
  - エラーメッセージの分かりやすさ
  - オフライン状態の適切な表示
```

### モバイルファースト
```yaml
レスポンシブ対応:
  - 縦画面メイン設計
  - 横画面でも利用可能
  - タブレット対応

操作性:
  - 片手操作可能
  - スワイプジェスチャー対応
  - ハプティックフィードバック
  - 適切なキーボード表示制御
```

---

## 🧪 テスト要件

### テスト戦略
```yaml
ユニットテスト:
  - カバレッジ: 80%以上
  - 重要機能: 90%以上
  - 暗号化・認証: 100%

統合テスト:
  - API連携テスト
  - データベース連携テスト
  - Gemini AI応答テスト

E2Eテスト:
  - 主要ユーザーフロー
  - 認証フロー
  - 投稿・チャット機能
  - AI相談機能
```

### セキュリティテスト
```yaml
脆弱性テスト:
  - SQLインジェクション
  - XSS攻撃
  - CSRF攻撃
  - 認証バイパス

プライバシーテスト:
  - 個人情報漏洩検証
  - 匿名性確保テスト
  - データ暗号化検証
  - アクセス権限テスト
```

---

## 📈 運用・保守要件

### 監視・ログ
```yaml
アプリケーション監視:
  - エラー率監視
  - レスポンス時間監視
  - クラッシュレート監視
  - ユーザー行動分析

セキュリティ監視:
  - 不正ログイン検知
  - 異常なAPI利用パターン
  - 大量データアクセス監視
  - 母子手帳番号アクセス監査
```

### バックアップ・災害対策
```yaml
データバックアップ:
  - 自動バックアップ: 日次
  - 長期保管: 月次
  - クロスリージョン複製
  - 復旧テスト: 月次実施

災害対策:
  - RTO (復旧時間目標): 4時間
  - RPO (復旧ポイント目標): 1時間
  - 代替サイト準備
  - 通信手段確保
```

---

## 🎯 開発フェーズ

### Phase 1: 基盤構築 (4週間)
```yaml
完了済み:
  ✅ プロジェクト初期化
  ✅ UI基盤実装
  ✅ ナビゲーション構築

残作業:
  🔲 Supabase環境構築
  🔲 認証システム実装
  🔲 母子手帳番号検証機能
  🔲 基本的なCRUD操作
```

### Phase 2: コア機能実装 (6週間)
```yaml
予定:
  🔲 投稿・タイムライン機能
  🔲 1対1チャット機能
  🔲 匿名ルーム基本機能
  🔲 プロフィール管理
  🔲 基本的なセキュリティ実装
```

### Phase 3: AI統合 (4週間)
```yaml
予定:
  🔲 Gemini API統合
  🔲 育児相談チャット実装
  🔲 投稿内容分析機能
  🔲 自動応答機能
  🔲 AI応答品質調整
```

### Phase 4: 高度な機能 (6週間)
```yaml
予定:
  🔲 画像投稿・表示機能
  🔲 プッシュ通知
  🔲 検索・フィルタ機能
  🔲 ブロック・通報機能
  🔲 データエクスポート機能
```

### Phase 5: テスト・最適化 (4週間)
```yaml
予定:
  🔲 包括的テスト実施
  🔲 セキュリティ監査
  🔲 パフォーマンス最適化
  🔲 ドキュメント整備
  🔲 デプロイ準備
```

---

## ⚠️ リスク・制約事項

### 技術的リスク
```yaml
高リスク:
  - 母子手帳番号の真正性検証困難
  - Gemini API制限・料金変更
  - リアルタイム性能要件

中リスク:
  - Supabaseの制限事項
  - モバイルプラットフォーム変更
  - セキュリティ脆弱性発見

対策:
  - 段階的実装・検証
  - 代替案準備
  - セキュリティ専門家レビュー
```

### 法的・規制リスク
```yaml
考慮事項:
  - 個人情報保護法対応
  - 母子健康法との関係
  - AI利用に関する規制動向
  - 医療情報取扱規制

対策:
  - 法務専門家相談
  - プライバシーポリシー整備
  - 利用規約明確化
  - 定期的な規制動向確認
```

---

## 📋 アクション項目

### 即座に着手すべき項目
1. **Supabase環境構築** - 開発・ステージング・本番環境
2. **母子手帳番号暗号化ライブラリ選定** - セキュリティ最優先
3. **Gemini API アカウント取得・テスト** - API制限確認
4. **データベース詳細設計** - RLS ポリシー含む

### 短期実装項目 (2週間以内)
1. **認証システムプロトタイプ** - 母子手帳番号検証含む
2. **基本CRUD操作** - ユーザー・投稿管理
3. **セキュリティテスト環境** - 脆弱性検査準備

### 中期計画項目 (1ヶ月以内)
1. **AI統合基盤** - Gemini API統合テスト
2. **リアルタイム機能** - チャット基本機能
3. **包括的テスト戦略** - セキュリティ・パフォーマンステスト

---

## 📝 備考・参考情報

### 参考資料
- [個人情報保護委員会ガイドライン](https://www.ppc.go.jp/)
- [母子健康手帳について - 厚生労働省](https://www.mhlw.go.jp/)
- [Supabase セキュリティ - 公式ドキュメント](https://supabase.com/docs/guides/database/security)
- [Google AI責任ある開発原則](https://ai.google/responsibility/responsible-ai-practices/)

### SuperClaude活用記録
```yaml
使用エージェント:
  - architect: システム設計・アーキテクチャ検討
  - security: セキュリティ要件・脅威分析  
  - backend: データベース設計・API仕様

効果:
  - 要件漏れ防止: セキュリティ観点の網羅
  - 技術選定支援: 最適なアーキテクチャ提案
  - リスク分析: 潜在的課題の早期発見
```

---

**文書終了**

最終更新: 2025-01-XX  
次回レビュー予定: 2025-01-XX