# SuperClaude框架 使用ガイド

SuperClaude框架は、Claude Codeの高度な運用フレームワークです。このガイドでは、React Native SNSアプリ開発におけるSuperClaude框架の効果的な使用方法を説明します。

## 📚 目次

- [SuperClaude框架とは](#superclaude框架とは)
- [基本概念](#基本概念)
- [コマンドシステム](#コマンドシステム)
- [ペルソナシステム](#ペルソナシステム)
- [フラグシステム](#フラグシステム)
- [MCPサーバー統合](#mcpサーバー統合)
- [実用例](#実用例)
- [ベストプラクティス](#ベストプラクティス)

## SuperClaude框架とは

SuperClaude框架は、Claude Codeの機能を拡張する内部フレームワークで、以下の機能を提供します：

- **インテリジェントルーティング**: タスクに最適なツールとペルソナを自動選択
- **専門ペルソナ**: 11の専門領域に特化したAI人格
- **高度なコマンドシステム**: 複雑な開発タスクを効率化
- **MCPサーバー統合**: 外部サービスとの連携
- **Wave Orchestration**: 複数段階の複合知能実行

## 基本概念

### 自動活性化システム
SuperClaude框架は、ユーザーの要求を分析して最適な設定を自動選択します：

```yaml
分析要素:
  - 複雑度スコア (0.0-1.0)
  - ドメイン識別 (frontend, backend, security等)
  - 操作タイプ (analyze, implement, improve等)
  - ファイル数とスコープ
```

### 品質ゲートシステム
8段階の検証サイクルで品質を保証：
1. 構文チェック
2. 型検証
3. リント
4. セキュリティ
5. テスト
6. パフォーマンス
7. ドキュメント
8. 統合テスト

## コマンドシステム

### 主要コマンド

#### `/build` - プロジェクトビルダー
**用途**: フレームワーク検出付きプロジェクトビルド

```bash
# 基本使用
/build

# 特定ターゲットでビルド
/build api

# フラグ付き実行
/build --validate --safe-mode
```

**自動活性化**:
- `frontend`, `backend`, `architect` ペルソナ
- `Magic` (UI構築), `Context7` (パターン), `Sequential` (ロジック)

#### `/implement` - 機能実装
**用途**: 機能とコード実装

```bash
# 基本実装
/implement チャット機能を追加

# 型指定付き
/implement --type component リアルタイムメッセージコンポーネント

# フレームワーク指定
/implement --framework react-native 認証画面
```

**自動活性化**:
- ドメイン依存の専門ペルソナ
- `Magic` (UIコンポーネント), `Context7` (パターン), `Sequential` (複雑ロジック)

#### `/analyze` - 多次元分析
**用途**: コードとシステムの包括的分析

```bash
# 包括分析
/analyze

# 特定ファイル分析
/analyze @src/components/ChatMessage.tsx

# フォーカス付き分析
/analyze --focus security
```

**自動活性化**:
- `analyzer`, `architect`, `security` ペルソナ
- `Sequential` (主要), `Context7` (パターン), `Magic` (UI分析)

#### `/improve` - 品質向上
**用途**: エビデンスベースのコード改善

```bash
# 品質改善
/improve

# パフォーマンス最適化
/improve --focus performance

# セキュリティ強化
/improve --focus security
```

**自動活性化**:
- `refactorer`, `performance`, `architect`, `qa` ペルソナ
- `Sequential` (ロジック), `Context7` (パターン)

### Wave Mode対応コマンド

複雑度 ≥0.7 + ファイル数 >20 + 操作タイプ >2 で自動活性化：

```bash
# Wave Mode自動活性化例
/improve 大規模なパフォーマンス最適化
/analyze 包括的なセキュリティ監査
/implement 企業レベルの認証システム
```

## ペルソナシステム

### 技術専門家

#### `architect` - システム設計専門
```yaml
優先順位: 長期保守性 > 拡張性 > パフォーマンス > 短期利益
専門領域: システム設計、依存関係管理、将来対応設計
自動活性化: "architecture", "design", "scalability"
```

#### `frontend` - UI/UX専門
```yaml
優先順位: ユーザーニーズ > アクセシビリティ > パフォーマンス > 技術的美学
専門領域: React Native、アクセシビリティ、モバイル最適化
自動活性化: "component", "responsive", "accessibility"
```

#### `backend` - サーバーサイド専門
```yaml
優先順位: 信頼性 > セキュリティ > パフォーマンス > 機能 > 利便性
専門領域: API設計、データベース、Supabase統合
自動活性化: "API", "database", "service", "reliability"
```

#### `security` - セキュリティ専門
```yaml
優先順位: セキュリティ > コンプライアンス > 信頼性 > パフォーマンス > 利便性
専門領域: 脅威モデリング、脆弱性評価、ゼロトラスト
自動活性化: "vulnerability", "threat", "compliance"
```

### プロセス・品質専門家

#### `analyzer` - 根本原因分析専門
```yaml
優先順位: エビデンス > 体系的アプローチ > 徹底性 > 速度
専門領域: 根本原因分析、エビデンスベース調査
自動活性化: "analyze", "investigate", "root cause"
```

#### `qa` - 品質保証専門
```yaml
優先順位: 予防 > 検出 > 修正 > 包括カバレッジ
専門領域: テスト戦略、品質ゲート、エッジケース
自動活性化: "test", "quality", "validation"
```

#### `refactorer` - コード品質専門
```yaml
優先順位: シンプルさ > 保守性 > 可読性 > パフォーマンス > 巧妙さ
専門領域: リファクタリング、技術的負債管理
自動活性化: "refactor", "cleanup", "technical debt"
```

### 知識・コミュニケーション

#### `mentor` - 教育専門
```yaml
優先順位: 理解 > 知識伝達 > 教育 > タスク完了
専門領域: 知識伝達、段階的説明、学習パス設計
自動活性化: "explain", "learn", "understand"
```

#### `scribe` - ドキュメント専門
```yaml
優先順位: 明確性 > 読者ニーズ > 文化的配慮 > 完全性 > 簡潔性
専門領域: 技術文書、多言語対応、文化的コミュニケーション
自動活性化: "document", "write", "guide"
```

### 手動ペルソナ指定

```bash
# 明示的ペルソナ指定
--persona-architect    # システム設計重視
--persona-frontend     # UI/UX重視
--persona-backend      # サーバーサイド重視
--persona-security     # セキュリティ重視
--persona-analyzer     # 分析重視
```

## フラグシステム

### 計画・分析フラグ

#### `--plan`
実行前に計画を表示
```bash
/implement --plan リアルタイムチャット機能
```

#### `--think` / `--think-hard` / `--ultrathink`
分析の深度レベル指定
```bash
# マルチファイル分析（~4K tokens）
/analyze --think

# システム全体分析（~10K tokens）  
/analyze --think-hard

# 重要システム再設計分析（~32K tokens）
/analyze --ultrathink
```

### 効率化フラグ

#### `--uc` / `--ultracompressed`
30-50%のトークン削減
```bash
/improve --uc パフォーマンス最適化
```
自動活性化: コンテキスト使用率 >75%

#### `--validate`
事前検証とリスク評価
```bash
/implement --validate 認証システム
```
自動活性化: リスクスコア >0.7

### MCPサーバー制御フラグ

#### `--c7` / `--context7`
ライブラリドキュメント検索を有効化
```bash
/implement --c7 Supabase認証
```
自動活性化: 外部ライブラリインポート、フレームワーク質問

#### `--seq` / `--sequential`
複雑な多段階分析を有効化
```bash
/analyze --seq システムボトルネック
```
自動活性化: 複雑デバッグ、システム設計、--thinkフラグ

#### `--magic`
UIコンポーネント生成を有効化
```bash
/implement --magic チャットメッセージコンポーネント
```
自動活性化: UIコンポーネントリクエスト、デザインシステム

#### `--play` / `--playwright`
E2Eテストとブラウザ自動化を有効化
```bash
/test --play クロスブラウザテスト
```

### Wave Orchestration フラグ

#### `--wave-mode [auto|force|off]`
Wave オーケストレーション制御
```bash
# 自動検出
/improve --wave-mode auto 大規模システム改善

# 強制有効化
/analyze --wave-mode force 中規模分析

# 無効化
/implement --wave-mode off シンプル実装
```

#### `--wave-strategy [progressive|systematic|adaptive|enterprise]`
Wave戦略選択
```bash
# 段階的改善
/improve --wave-strategy progressive

# 体系的分析  
/analyze --wave-strategy systematic

# 動的設定
/implement --wave-strategy adaptive

# 企業レベル（>100ファイル）
/audit --wave-strategy enterprise
```

### 反復改善フラグ

#### `--loop`
反復改善モードを有効化
```bash
/improve --loop コード品質
```
自動活性化: polish, refine, enhance, improve キーワード

#### `--iterations [n]`
改善サイクル数を指定（デフォルト: 3）
```bash
/improve --loop --iterations 5 UI/UXの洗練
```

## MCPサーバー統合

### Context7 - ドキュメント検索
**用途**: 公式ライブラリドキュメント、ベストプラクティス

```yaml
自動活性化:
  - 外部ライブラリインポート検出
  - フレームワーク質問
  - scribe ペルソナ活性化

使用例:
  - Supabase API リファレンス
  - React Native公式パターン
  - Expo SDK ドキュメント
```

### Sequential - 複雑分析
**用途**: 多段階問題解決、建築分析

```yaml
自動活性化:
  - 複雑デバッグシナリオ
  - システム設計質問
  - --think フラグ

使用例:
  - 根本原因分析
  - パフォーマンスボトルネック特定
  - セキュリティ脅威モデリング
```

### Magic - UIコンポーネント生成
**用途**: モダンUIコンポーネント、デザインシステム統合

```yaml
自動活性化:
  - UIコンポーネントリクエスト
  - デザインシステム質問
  - frontend ペルソナ活性化

使用例:
  - React Nativeコンポーネント
  - レスポンシブデザイン
  - アクセシビリティ対応
```

### Playwright - ブラウザ自動化
**用途**: クロスブラウザE2Eテスト、パフォーマンス監視

```yaml
自動活性化:
  - テストワークフロー
  - パフォーマンス監視要求
  - qa ペルソナ活性化

使用例:
  - E2Eテスト生成
  - 視覚的回帰テスト
  - クロスブラウザ検証
```

## 実用例

### React Native SNSアプリ開発での使用例

#### 1. プロジェクト初期設定
```bash
# プロジェクト分析と最適化設定
/analyze --focus architecture

# 自動活性化される設定:
# --persona-architect
# --seq (複雑分析)
# --c7 (パターン参照)
```

#### 2. Supabase統合実装
```bash
# リアルタイム機能実装
/implement --type service Supabaseリアルタイムチャット

# 自動活性化される設定:
# --persona-backend (サーバーサイド専門)
# --c7 (Supabaseドキュメント)
# --seq (複雑統合)
```

#### 3. UIコンポーネント開発
```bash
# チャットメッセージコンポーネント
/implement --type component レスポンシブチャットメッセージ

# 自動活性化される設定:
# --persona-frontend (UI専門)
# --magic (コンポーネント生成)
# --c7 (React Nativeパターン)
```

#### 4. セキュリティ監査
```bash
# セキュリティ分析
/analyze --focus security --think-hard

# 自動活性化される設定:
# --persona-security (セキュリティ専門)
# --seq (深度分析)
# --validate (リスク評価)
```

#### 5. パフォーマンス最適化
```bash
# 包括的パフォーマンス改善
/improve --focus performance --loop

# 自動活性化される設定:
# --persona-performance (最適化専門)
# --play (パフォーマンス測定)
# --iterations 3 (反復改善)
```

#### 6. 大規模リファクタリング
```bash
# Wave Mode でシステム全体改善
/improve --wave-strategy systematic 全体的な品質向上

# Wave自動活性化 (複雑度 ≥0.7):
# --wave-strategy systematic
# --persona-refactorer + --persona-architect
# --seq (段階的分析)
```

### 典型的なワークフロー

#### 機能開発フロー
```bash
1. /analyze @src/screens/ --focus architecture    # 既存構造分析
2. /implement --plan 新機能設計                    # 実装計画立案
3. /implement --type component 機能コンポーネント    # 実装実行
4. /test --play E2Eテスト                         # テスト実行
5. /improve --focus performance                    # 最適化
```

#### デバッグフロー
```bash
1. /analyze --think 問題現象分析                   # 現象分析
2. /troubleshoot --persona-analyzer 根本原因調査   # 根本原因特定
3. /implement --validate 修正実装                  # 安全な修正
4. /test --focus regression 回帰テスト             # 検証
```

## ベストプラクティス

### 効率的な使用法

#### 1. 自動活性化を活用
明示的フラグ指定より、キーワードベースの自動活性化を活用：
```bash
# 推奨: 自動活性化
"Supabaseを使ってセキュアな認証システムを実装"

# 非推奨: 過度のフラグ指定
/implement --persona-backend --persona-security --c7 --seq --validate
```

#### 2. 適切な複雑度での実行
```bash
# シンプルなタスク
/implement シンプルボタンコンポーネント

# 中程度の複雑さ  
/implement --think リアルタイムチャット機能

# 高複雑度（Wave Mode自動活性化）
/implement 包括的な認証・認可システム
```

#### 3. 段階的アプローチ
```bash
# 1段階目: 分析
/analyze --focus security 現在のセキュリティ状況

# 2段階目: 計画
/improve --plan --focus security 

# 3段階目: 実装
/improve --focus security --validate
```

### プロジェクト固有の最適化

#### mamapace SNSアプリでの推奨パターン

##### チャット機能開発
```bash
# UI実装
/implement --persona-frontend チャット画面レイアウト

# バックエンド統合
/implement --persona-backend Supabaseリアルタイム統合

# 最適化
/improve --focus performance --persona-performance
```

##### 認証システム
```bash
# セキュリティ重視実装
/implement --persona-security --validate Supabase Auth統合

# UI/UX実装  
/implement --persona-frontend 認証画面デザイン

# 包括テスト
/test --persona-qa --play 認証フロー検証
```

### パフォーマンス最適化

#### トークン効率化
```bash
# 高効率（自動圧縮）
/improve --uc パフォーマンス最適化

# コンテキスト節約
/analyze --scope file 単一ファイル分析

# 並列処理活用
/analyze --delegate --scope project プロジェクト全体分析
```

#### リソース管理
```yaml
推奨使用パターン:
  - Green Zone (0-60%): フル機能利用
  - Yellow Zone (60-75%): --ucフラグ推奨
  - Orange Zone (75-85%): 必須操作のみ
  - Red Zone (85%+): 緊急プロトコル発動
```

### トラブルシューティング

#### 一般的な問題と解決法

##### 1. 期待する結果が得られない
```bash
# 問題分析
/analyze --persona-analyzer --think 期待結果との相違

# 詳細指定で再実行
/implement --plan --validate --persona-[適切] 詳細要求
```

##### 2. パフォーマンスが遅い
```bash
# リソース最適化
/improve --uc --scope file 

# 並列処理活用
/analyze --delegate 大規模分析
```

##### 3. 品質が期待値に達しない
```bash
# 品質ゲート強化
/improve --validate --persona-qa --loop

# 包括的検証
/analyze --ultrathink --focus quality
```

## まとめ

SuperClaude框架は、React Native SNSアプリ開発を大幅に効率化する強力なツールです：

### 主な利点
- **自動最適化**: タスクに最適な設定を自動選択
- **専門知識**: 11の専門ペルソナによる高品質な出力
- **効率性**: Wave Modeによる複雑タスクの最適化
- **品質保証**: 8段階品質ゲートによる確実な品質

### 成功のポイント
1. **自動活性化の活用**: 過度のフラグ指定を避け、キーワードベースの自動選択を活用
2. **段階的アプローチ**: 分析→計画→実装→検証の順序を守る
3. **適切な複雑度**: タスクの複雑さに応じた適切な設定選択
4. **継続改善**: --loopフラグを活用した反復的品質向上

SuperClaude框架を効果的に活用することで、mamapaceプロジェクトを高品質かつ効率的に開発できます。