# SuperClaude + Agents 併用ベストプラクティス

## 概要
SuperClaudeフレームワークとClaude CodeのAgents（Task tool）機能を組み合わせることで、複雑なタスクを効率的に処理できます。このドキュメントでは、両機能を最大限活用するためのベストプラクティスを紹介します。

## 1. 基本概念

### SuperClaude
- **コマンドシステム**: `/analyze`, `/build`, `/implement` などの高レベルコマンド
- **フラグシステム**: `--think`, `--seq`, `--delegate` などの動作制御
- **ペルソナシステム**: 専門領域に特化したAI動作パターン
- **Wave Mode**: 複雑なタスクの段階的実行

### Agents (Task tool)
- **並列処理**: 独立したタスクを複数のエージェントで同時実行
- **専門エージェント**: general-purpose, statusline-setup など
- **ステートレス実行**: 各エージェントは独立して動作

## 2. 効果的な併用パターン

### パターン1: 大規模コードベース分析
```bash
# SuperClaudeのWave Modeで全体戦略を立て、Agentsで並列実行
/analyze @src/ --wave-mode --delegate folders
```

**動作フロー**:
1. Wave Modeが分析戦略を立案
2. 各ディレクトリをAgentsに委譲
3. 並列で詳細分析を実行
4. 結果を統合して報告

### パターン2: マルチドメイン実装
```bash
# フロントエンドとバックエンドを並列開発
/implement "user authentication" --delegate --multi-agent --parallel-focus
```

**利点**:
- Frontend Agent: UI/UXコンポーネント実装
- Backend Agent: API/データベース実装
- 同時並行で開発時間を50-70%短縮

### パターン3: 段階的品質改善
```bash
# Wave Modeで段階的改善、各段階でAgentsを活用
/improve @src/ --wave-mode --wave-strategy progressive --delegate tasks
```

**実行段階**:
1. **Wave 1**: セキュリティ脆弱性の検出（Security Agent）
2. **Wave 2**: パフォーマンス最適化（Performance Agent）
3. **Wave 3**: コード品質改善（Quality Agent）
4. **Wave 4**: ドキュメント生成（Documentation Agent）

## 3. 最適な使い分け

### SuperClaudeが優れている場面
- **戦略立案**: 全体的なアーキテクチャ設計
- **複雑な意思決定**: トレードオフの評価
- **段階的実行**: Wave Modeによる計画的な実装
- **専門知識が必要**: ペルソナシステムの活用

### Agentsが優れている場面
- **並列処理可能なタスク**: 独立した複数ファイルの処理
- **大量の繰り返し作業**: 同様のパターンの適用
- **検索と収集**: 広範囲な情報収集
- **時間のかかる処理**: バックグラウンド実行

## 4. 実践的な組み合わせ例

### 例1: リアルタイムチャット機能の実装
```bash
# SuperClaudeで設計、Agentsで並列実装
/design "real-time chat" --think-hard --seq
/implement "chat feature" --delegate --wave-mode
```

**タスク分割**:
```yaml
Wave 1 - 設計と準備:
  - SuperClaude: アーキテクチャ設計
  - Agent 1: データベーススキーマ設計
  - Agent 2: API仕様定義

Wave 2 - 基本実装:
  - Agent 1: Supabaseテーブル作成
  - Agent 2: リアルタイム接続設定
  - Agent 3: 基本UIコンポーネント

Wave 3 - 機能追加:
  - Agent 1: メッセージ送受信
  - Agent 2: 既読機能
  - Agent 3: タイピングインジケーター

Wave 4 - 品質保証:
  - SuperClaude: 統合テスト
  - Agent 1: セキュリティ監査
  - Agent 2: パフォーマンステスト
```

### 例2: 大規模リファクタリング
```bash
# 複雑度分析と段階的リファクタリング
/analyze @src/ --ultrathink --delegate folders
/improve @src/ --wave-mode --wave-strategy systematic --delegate files
```

## 5. パフォーマンス最適化のコツ

### トークン効率化
```bash
# SuperClaudeの圧縮モードとAgentsの並列処理を組み合わせ
/analyze @src/ --uc --delegate --concurrency 10
```

### 実行時間短縮
- **並列度の調整**: `--concurrency [1-15]` で最適な並列数を設定
- **委譲戦略**: `--delegate auto` で自動最適化
- **Wave戦略**: `--wave-strategy adaptive` で動的調整

## 6. トラブルシューティング

### よくある問題と解決策

#### 問題1: Agentsの結果が断片的
**解決策**: SuperClaudeで結果を統合
```bash
/analyze --seq  # Sequentialで結果を構造化
```

#### 問題2: Wave Modeが遅い
**解決策**: Agentsで並列化
```bash
--wave-mode --delegate --parallel-focus
```

#### 問題3: コンテキスト不足
**解決策**: SuperClaudeで事前分析
```bash
/load @project/ --think-hard  # 全体理解を深める
/task "implementation" --delegate  # その後委譲
```

## 7. 推奨ワークフロー

### 新機能開発
1. **計画**: `/design --think-hard --seq`
2. **実装**: `/implement --wave-mode --delegate`
3. **テスト**: `/test --parallel --multi-agent`
4. **改善**: `/improve --loop --delegate tasks`

### バグ修正
1. **分析**: `/troubleshoot --analyzer --seq`
2. **修正**: `/fix --delegate files`
3. **検証**: `/test --qa --playwright`

### コード品質向上
1. **監査**: `/analyze --wave-mode --focus quality`
2. **改善**: `/improve --systematic-waves --delegate`
3. **文書化**: `/document --scribe --c7`

## 8. 高度な設定

### カスタムフラグ組み合わせ
```yaml
# .claude/config.yml
presets:
  turbo-analysis:
    flags: "--ultrathink --seq --delegate folders --concurrency 15"
  
  quality-wave:
    flags: "--wave-mode --wave-strategy systematic --validate --delegate tasks"
  
  fast-implementation:
    flags: "--uc --delegate auto --parallel-focus --no-mcp"
```

### 自動化スクリプト
```bash
#!/bin/bash
# super-agent.sh - SuperClaude + Agents 自動実行

# 分析フェーズ
claude code --command "/analyze @src/ --wave-mode --delegate"

# 実装フェーズ
claude code --command "/implement --multi-agent --parallel-focus"

# 品質チェック
claude code --command "/test --qa --delegate"
```

## 9. メトリクスと評価

### 効果測定指標
- **実行時間**: 単独実行 vs 併用での時間短縮率
- **トークン使用量**: 効率的なトークン利用
- **品質スコア**: テストカバレッジ、コード品質指標
- **並列効率**: 並列度による性能向上率

### 典型的な改善率
| タスクタイプ | 単独実行 | 併用 | 改善率 |
|------------|---------|------|--------|
| 大規模分析 | 60分 | 20分 | 67% |
| マルチドメイン実装 | 120分 | 45分 | 63% |
| 品質改善 | 90分 | 35分 | 61% |
| ドキュメント生成 | 30分 | 12分 | 60% |

## 10. まとめ

### ゴールデンルール
1. **戦略はSuperClaude、実行はAgents**: 高レベル設計と並列実行の分離
2. **Wave Modeで段階管理、Agentsで並列化**: 構造化と効率化の両立
3. **ペルソナで専門性、Agentsで拡張性**: 品質と速度のバランス
4. **フラグで制御、委譲で加速**: 細かい調整と大胆な並列化

### 次のステップ
- SuperClaudeの各コマンドを学習
- Agents機能の並列度を実験
- プロジェクト固有の最適設定を発見
- チーム内でベストプラクティスを共有

---

*このドキュメントは継続的に更新されます。実践で得られた知見を追加してください。*