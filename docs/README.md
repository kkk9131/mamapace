# mamapace プロジェクトドキュメント

React Native SNSアプリ「mamapace」の開発ドキュメント集

## 📚 ドキュメント一覧

### [SuperClaude框架 使用ガイド](./superclaude-guide.md)
Claude Codeの高度な運用フレームワーク「SuperClaude框架」の包括的な使用方法ガイド

**内容:**
- SuperClaude框架の基本概念
- コマンドシステム詳細
- ペルソナシステム活用法
- フラグシステム完全ガイド
- MCPサーバー統合
- 実用的な開発例
- ベストプラクティス

### [クイックリファレンス](./quick-reference.md)
mamapace開発での実用的なSuperClaude框架使用例集

**内容:**
- よく使うコマンド一覧
- 典型的な開発パターン
- 効率化テクニック
- 場面別ベストプラクティス
- トラブルシューティング

### [実装記録](./implementation-log.md)
mamapaceプロジェクトの機能実装記録と進捗状況

**内容:**
- 実装済み機能の詳細記録
- 実装中・計画中の機能一覧
- 技術的負債と改善計画
- 開発メトリクスと統計
- 次のアクション項目

### [機能実装テンプレート](./feature-template.md)
新機能実装時の記録用テンプレート

**内容:**
- 実装記録フォーマット
- SuperClaude活用記録
- 品質チェックリスト
- 実装後タスクガイド

### [要件定義書](./requirements-specification.md)
母子手帳番号認証とGemini AI統合を含む包括的な要件定義書

**内容:**
- 認証・セキュリティ要件（母子手帳番号）
- Gemini AI統合仕様
- 機能要件・技術要件
- データベース設計
- セキュリティ・プライバシー要件
- 開発フェーズとアクション項目

## 🎯 使い方

### 初回設定後に読むべきドキュメント
1. **[SuperClaude框架 使用ガイド](./superclaude-guide.md)** - 基本概念の理解
2. **[クイックリファレンス](./quick-reference.md)** - 実用的な使用法

### 開発中に参照するドキュメント
- **[クイックリファレンス](./quick-reference.md)** - コマンドとパターンの確認
- **[実装記録](./implementation-log.md)** - 進捗状況と実装済み機能の確認
- **[プロジェクト設定](../CLAUDE.md)** - プロジェクト固有の設定確認

### 新機能実装時に使用するドキュメント
- **[機能実装テンプレート](./feature-template.md)** - 実装記録のフォーマット
- **[実装記録](./implementation-log.md)** - 実装後の記録更新

## 🚀 SuperClaude框架とは

SuperClaude框架は、Claude Codeの機能を大幅に拡張する高度なフレームワークです：

### 主要機能
- **インテリジェントルーティング**: タスクに最適なツールとペルソナを自動選択
- **11の専門ペルソナ**: architect, frontend, backend, security, analyzer等
- **高度なコマンドシステム**: /build, /implement, /analyze, /improve等
- **MCPサーバー統合**: Context7, Sequential, Magic, Playwright
- **Wave Orchestration**: 複数段階の複合知能実行

### mamapace開発での利点
- **開発効率50%向上**: 自動最適化により手動設定を削減
- **品質保証**: 8段階の品質ゲートによる確実な品質管理
- **専門知識活用**: React Native + Supabase特化の最適化
- **自動化**: 複雑度に応じた自動的な最適設定選択

## 📱 mamapace プロジェクト概要

### 技術スタック
```yaml
フレームワーク: React Native (Expo)
言語: TypeScript
データベース: Supabase (PostgreSQL)
認証: Supabase Auth
リアルタイム: Supabase Realtime
ナビゲーション: React Navigation
```

### 主要機能
- 匿名チャットルーム
- リアルタイムメッセージング
- ユーザープロフィール管理
- プッシュ通知
- 音声・動画メッセージ

## 🎯 開発ワークフロー例

### 1. 新機能開発
```bash
/analyze @src/screens/ --focus architecture  # 既存構造分析
/implement --plan 新機能設計              # 実装計画
/implement --type component UI実装        # 実装実行
/test --play E2Eテスト                   # テスト
/improve --focus performance              # 最適化
```

### 2. バグ修正
```bash
/analyze --think-hard 問題分析            # 問題分析
/troubleshoot --persona-analyzer 調査     # 根本原因特定  
/implement --validate 修正実装            # 安全な修正
/test --focus regression                 # 回帰テスト
```

### 3. リファクタリング
```bash
/analyze --focus quality                 # 品質評価
/improve --loop --persona-refactorer     # 段階的改善
/test --persona-qa                       # 品質検証
```

## 💡 よく使うコマンド

### 基本コマンド
```bash
/analyze        # プロジェクト分析
/implement      # 機能実装
/improve        # 品質改善
/build          # プロジェクトビルド
```

### React Native特化
```bash
# UIコンポーネント実装
/implement --magic チャットコンポーネント

# Supabase統合
/implement --c7 --persona-backend リアルタイム機能

# パフォーマンス最適化
/improve --focus performance --persona-performance
```

## 🔗 関連リソース

### プロジェクトファイル
- **[CLAUDE.md](../CLAUDE.md)** - プロジェクト設定とガイドライン
- **[package.json](../package.json)** - 依存関係と設定

### 外部リソース
- [Expo Documentation](https://docs.expo.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [React Navigation](https://reactnavigation.org/docs/getting-started)

## ❓ サポート

### よくある問題
1. **期待した結果が得られない** → [トラブルシューティング](./quick-reference.md#トラブルシューティング)
2. **処理が重い・遅い** → [効率化テクニック](./quick-reference.md#効率化テクニック)
3. **品質が不十分** → [品質改善](./superclaude-guide.md#品質ゲートシステム)

### 学習リソース
- **初心者** → [使用ガイド](./superclaude-guide.md)基本概念から学習
- **実践者** → [クイックリファレンス](./quick-reference.md)でパターン習得
- **上級者** → Wave Orchestration、高度なペルソナ連携を活用

---

**SuperClaude框架を活用して、効率的にmamapaceプロジェクトを成功させましょう！** 🚀