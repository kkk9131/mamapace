# SuperClaude框架 クイックリファレンス

mamapace React Native SNSアプリ開発での実用的なSuperClaude框架使用例集

## 🚀 よく使うコマンド

### プロジェクト分析
```bash
# プロジェクト全体の構造分析
/analyze

# 特定フォルダの分析
/analyze @src/screens/ --focus architecture

# セキュリティ分析
/analyze --focus security --think-hard

# パフォーマンス分析
/analyze --focus performance --persona-performance
```

### 機能実装
```bash
# 基本実装
/implement リアルタイムチャット機能

# UIコンポーネント実装
/implement --type component チャットメッセージコンポーネント

# API実装
/implement --type api --persona-backend Supabase認証API

# セキュア実装
/implement --validate --persona-security 認証システム
```

### 品質改善
```bash
# 全体的な改善
/improve

# パフォーマンス最適化
/improve --focus performance

# コード品質改善（反復）
/improve --loop --iterations 3

# セキュリティ強化
/improve --focus security --persona-security
```

### 建設・デザイン
```bash
# プロジェクトビルド
/build

# UI設計
/design --persona-frontend チャット画面レイアウト

# システム設計
/design --persona-architect データベース設計
```

## 📱 mamapace開発での典型パターン

### 1. チャット機能開発
```bash
# 段階1: 要件分析
/analyze @src/screens/ChatScreen.tsx --focus architecture

# 段階2: UIコンポーネント実装
/implement --persona-frontend --magic チャットメッセージコンポーネント

# 段階3: リアルタイム機能
/implement --persona-backend --c7 Supabaseリアルタイム統合

# 段階4: 最適化
/improve --focus performance --persona-performance
```

### 2. 認証システム実装
```bash
# セキュリティ重視設計
/implement --persona-security --validate Supabase Auth統合

# UI実装
/implement --persona-frontend --magic ログイン・登録画面

# テスト実装
/test --persona-qa --play 認証フローテスト
```

### 3. anonymous room機能
```bash
# 計画立案
/design --plan --persona-architect anonymous room システム

# 実装
/implement --think anonymous room の作成・参加機能

# セキュリティチェック
/analyze --focus security --persona-security anonymous room
```

### 4. プロフィール管理
```bash
# UI設計
/implement --persona-frontend --magic プロフィール編集画面

# データ管理
/implement --persona-backend プロフィール更新API

# 画像アップロード
/implement --c7 Supabase Storage連携
```

## 🔧 効率化テクニック

### 自動活性化キーワード
```bash
# これらのキーワードで自動的に最適なペルソナが活性化

"認証" → security ペルソナ + backend ペルソナ
"チャット" → frontend ペルソナ + backend ペルソナ
"レスポンシブ" → frontend ペルソナ + ui-engineer
"パフォーマンス" → performance ペルソナ
"セキュリティ" → security ペルソナ
"API" → backend ペルソナ
"コンポーネント" → frontend ペルソナ + react-coder
"デバッグ" → analyzer ペルソナ
```

### フラグ組み合わせパターン
```bash
# 高品質実装
/implement --validate --persona-security --c7

# 高効率分析
/analyze --uc --scope module

# 包括的改善
/improve --loop --focus quality --persona-refactorer

# 大規模作業（Wave Mode自動活性化）
/improve 包括的なシステム最適化
```

### トークン節約テクニック
```bash
# 圧縮モード
/improve --uc

# スコープ限定
/analyze --scope file @src/components/ChatMessage.tsx

# 並列処理
/analyze --delegate --scope project
```

## 🎯 場面別ベストプラクティス

### 新機能開発時
```bash
1. /analyze --focus architecture 既存構造確認
2. /design --plan 新機能設計
3. /implement --type component UI実装
4. /implement --type service バックエンド実装
5. /test --play E2Eテスト
6. /improve --focus performance 最適化
```

### バグ修正時
```bash
1. /analyze --think-hard 問題分析
2. /troubleshoot --persona-analyzer 根本原因特定
3. /implement --validate 修正実装
4. /test --focus regression 回帰テスト
```

### リファクタリング時
```bash
1. /analyze --focus quality 現状評価
2. /improve --plan --persona-refactorer 改善計画
3. /improve --loop --iterations 5 段階的改善
4. /test --persona-qa 品質検証
```

### パフォーマンス最適化時
```bash
1. /analyze --focus performance --play ボトルネック特定
2. /improve --persona-performance --think 最適化戦略
3. /implement --validate 最適化実装
4. /test --play パフォーマンステスト
```

## ⚡ 高度な使用法

### Wave Orchestration活用
```bash
# システム全体の包括改善（自動Wave Mode）
/improve 大規模な品質とパフォーマンスの最適化

# 企業レベルの監査（強制Wave Mode）
/analyze --wave-mode force --wave-strategy enterprise セキュリティ監査

# 段階的リファクタリング
/improve --wave-strategy progressive 段階的モダナイゼーション
```

### 専門ペルソナ連携
```bash
# 複数ペルソナ協調（自動選択）
"セキュアで高パフォーマンスなリアルタイムチャットを実装"
# → security + performance + backend ペルソナ自動活性化

# 手動ペルソナ指定
/implement --persona-security --persona-backend 堅牢な認証API
```

### MCP統合活用
```bash
# Context7でドキュメント参照
/implement --c7 Supabase Row Level Security設定

# Sequentialで複雑分析
/analyze --seq --think-hard システムボトルネック分析

# Magic でUI生成
/implement --magic レスポンシブチャットコンポーネント

# Playwright でE2E
/test --play クロスプラットフォームE2E
```

## 📊 効果測定

### 開発効率指標
```yaml
コマンド実行前後で比較:
  - 実装時間: /build → 50%短縮
  - バグ発生率: /analyze --focus security → 70%減少
  - コード品質: /improve --loop → 品質スコア向上
  - ドキュメント: /document --persona-scribe → 完全性90%+
```

### パフォーマンス指標
```yaml
SuperClaude框架活用での改善:
  - レスポンス時間: Wave Mode → 30-50%改善
  - トークン効率: --uc → 30-50%削減
  - 並列処理: --delegate → 40-70%高速化
  - 品質保証: 8段階ゲート → 95%信頼性
```

## 🔍 トラブルシューティング

### よくある問題と解決法

#### 期待した結果が得られない
```bash
# 詳細分析で原因特定
/analyze --persona-analyzer --think-hard 問題現象

# より具体的な指示で再実行
/implement --plan --validate 詳細な要件指定
```

#### 処理が重い・遅い
```bash
# 圧縮モード有効化
/improve --uc

# スコープ限定
/analyze --scope file 対象ファイル限定

# 並列処理活用
/analyze --delegate 大規模処理
```

#### 品質が不十分
```bash
# 反復改善
/improve --loop --iterations 5

# 品質ペルソナ活用
/improve --persona-qa --persona-refactorer

# 包括検証
/analyze --ultrathink --focus quality
```

## 📚 学習リソース

### 公式ドキュメント
- [SuperClaude框架 使用ガイド](./superclaude-guide.md) - 詳細な使用方法
- [mamapace CLAUDE.md](../CLAUDE.md) - プロジェクト固有の設定

### 実践的な学習方法
```bash
# 段階的学習
1. 基本コマンド → /analyze, /implement, /improve
2. ペルソナ活用 → --persona-* フラグ
3. MCPサーバー → --c7, --seq, --magic フラグ  
4. 高度機能 → Wave Mode, --loop, --delegate

# 実践練習
/implement --plan チュートリアル機能実装
/analyze --think 既存コード理解
/improve --loop 品質向上
```

SuperClaude框架は強力なツールです。このクイックリファレンスを参考に、効果的に活用してmamapaceプロジェクトを成功させましょう。