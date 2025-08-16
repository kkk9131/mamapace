# リアルタイムチャット機能実装 - 既存UI活用版

## Claude Code実行コマンド

```bash
# Phase 1: 既存UI分析と設計
/analyze @src/screens/Chat* @supabase/ --think-hard --seq --persona-architect --focus architecture --validate

# Phase 2: Wave Mode実装（推奨メインコマンド - 既存UI保持）
/implement "integrate Supabase realtime into existing chat UI" --wave-mode --wave-strategy progressive --delegate tasks --persona-backend --c7 --seq --validate

# Alternative: 段階的実装（詳細制御が必要な場合）
/analyze "existing chat UI structure" --persona-frontend --think
/implement "chat backend integration only" --delegate --persona-backend --seq --c7
/implement "realtime messaging logic" --delegate --persona-backend --seq --validate
/test "chat functionality" --qa --play --delegate --validate
```

## 詳細実装プロンプト

### SuperClaude + Agents 最適化バージョン（既存UI活用）
```
MamaPaceアプリの既存チャットUIに、Supabase Realtimeを使用したバックエンド機能を統合してください。

**既存UI構造**:
- ChatScreen.tsx: メッセージ表示とテキスト入力（基本UI完成済み）
- ChatsListScreen.tsx: チャット一覧（基本UI完成済み）
- 既存のテーマシステム、アニメーション、レイアウトを維持

**実装要件**:
1. 既存UIデザインを完全保持
2. ダミーデータを実際のSupabaseデータに置換
3. リアルタイムメッセージ送受信機能
4. 既読機能とタイピングインジケーター
5. チャット一覧の動的更新
6. セキュリティ（RLS）実装

**実装方針**:
- 既存のUI/UXを一切変更しない
- バックエンドロジックとデータ統合のみ実装
- 既存のスタイリング、アニメーション、テーマを継承
- TypeScript厳格モード対応
- 既存のコード規約に完全準拠

**使用フラグ**: --wave-mode --wave-strategy progressive --delegate tasks --persona-backend --c7 --seq --validate

**段階的実装計画**:
Wave 1: データベース設計とSupabaseスキーマ作成
Wave 2: 既存UIへのデータ統合とAPI接続
Wave 3: リアルタイム機能とメッセージ送受信
Wave 4: 高度機能（既読、タイピング）とテスト

**重要**: UIコンポーネントの変更は最小限に留め、主にデータフロー、状態管理、Supabase統合に集中してください。
```

### 従来型詳細プロンプト（既存UI保持版）
```
MamaPaceアプリの既存チャットUIを活用し、Supabase Realtimeでバックエンド機能を実装してください。

**現状確認**:
- ChatScreen.tsx: 基本的なチャット画面（ダミーデータ使用）
- ChatsListScreen.tsx: チャット一覧画面（ダミーデータ使用）
- 既存のテーマシステムとアニメーション
- Supabase認証システム既存

**実装要件**:

1. **データベース設計**:
   - messagesテーブル作成
   - conversationsテーブル作成
   - RLS (Row Level Security) 設定
   - リアルタイム購読設定

2. **既存UI統合**:
   - ダミーデータを実際のデータに置換
   - 既存のレイアウト、スタイル、アニメーションを保持
   - TextInputにメッセージ送信機能を追加
   - FlatListに動的データ表示を実装

3. **リアルタイム機能**:
   - Supabase Realtimeを使用
   - メッセージのリアルタイム送受信
   - 既読機能
   - タイピングインジケーター

4. **状態管理**:
   - React Context または useState でメッセージ状態管理
   - 既存の認証システムとの統合
   - エラーハンドリング

5. **セキュリティ**:
   - 認証ユーザーのみアクセス可能
   - 適切なRLS設定
   - メッセージ暗号化（必要に応じて）

**重要制約**:
- 既存のUI/UX デザインを変更しない
- 既存のテーマ、カラー、フォントを維持
- 現在のナビゲーション構造を保持
- TypeScript厳格モード対応

段階的に実装し、UI変更は最小限に留めてください。
```

## 実行順序

### 推奨（SuperClaude + Agents - 既存UI保持）
```bash
# 1. 既存UI分析
/analyze @src/screens/Chat* --think --persona-frontend --persona-architect

# 2. バックエンド統合実装
/implement "integrate Supabase realtime into existing chat UI" --wave-mode --wave-strategy progressive --delegate tasks --persona-backend --c7 --seq --validate

# 3. 品質チェック
/test --qa --delegate --validate
/improve --focus security --persona-security --seq
```

### 詳細制御版（既存UI保持）
```bash
# 1. 既存UI構造分析
/analyze @src/screens/Chat* --think --persona-frontend

# 2. データベース設計
/implement "chat database schema" --delegate --persona-backend --seq --c7

# 3. 既存UIへのデータ統合
/implement "replace dummy data with Supabase data" --delegate --persona-backend --seq

# 4. リアルタイム機能統合
/implement "supabase realtime integration" --delegate --persona-backend --seq --c7 --validate

# 5. 送信機能実装
/implement "message sending functionality" --delegate --persona-backend --seq

# 6. テストと改善
/test "chat functionality" --qa --delegate --validate
/improve --focus security --persona-security --validate
```

## 期待される結果

### Wave Mode実装での成果物（既存UI活用）
- **Wave 1**: チャット用データベーススキーマとRLS設定
- **Wave 2**: 既存UIへのSupabaseデータ統合とAPI接続
- **Wave 3**: リアルタイムメッセージ送受信機能
- **Wave 4**: 高度機能（既読、タイピング）とセキュリティ監査

### パフォーマンス予測（既存UI活用）
- **実装時間**: 約30-45分（UIスキップで25%短縮）
- **品質**: 既存UI保持、テストカバレッジ80%以上
- **保守性**: 既存デザインシステム完全継承

### 自動生成される要素（バックエンド重点）
- Supabaseマイグレーションファイル
- チャット関連TypeScript型定義
- リアルタイム通信サービス
- メッセージ送信/受信ロジック
- Jestテストファイル
- セキュリティ設定（RLS）
- 既存UI統合用React Hooks

### UI変更最小化のメリット
- **デザイン一貫性**: 既存テーマとの完全な統合
- **開発効率**: UI作成時間を完全省略
- **メンテナンス性**: 既存のスタイルシステムを継承
- **ユーザー体験**: 一貫したアプリ体験の維持

---

**注意**: 実装前にSupabase設定とプロジェクト構造を確認し、最適なアプローチを選択してください。