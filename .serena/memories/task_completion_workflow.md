# タスク完了時のワークフロー - MamaPace

## 実装完了後の必須チェック項目

### 1. コード品質チェック
```bash
npm run lint        # ESLint実行・修正
npm run format      # Prettier整形
```

### 2. テスト実行
```bash
npm test           # 単体テスト実行
npm run test:coverage # カバレッジ確認
# 必要に応じてE2Eテスト
npm run test:e2e   # Detox E2E（時間がかかる）
```

### 3. TypeScript型チェック
- VSCodeでの型エラー確認
- `tsconfig.json` 準拠確認

### 4. 動作確認
```bash
npm start          # 開発サーバー起動
# iOS/Androidシミュレータで実際の動作確認
```

### 5. コミット前確認
- 変更内容の妥当性チェック
- 関連ファイルの整合性確認
- 破壊的変更の影響範囲確認

### 6. Git操作
```bash
git add .
git commit -m "具体的な変更内容を記載"
git push origin main
```

## テストカバレッジ要件
- **最低ライン**: 1% (現在の設定)
- **推奨**: 単体テスト 80%以上、統合テスト 70%以上
- **重要機能**: 必ずテストケース作成

## 品質ガイドライン
- ESLint設定に準拠
- Prettier設定で自動整形
- TypeScript厳格モードでエラーゼロ
- React Native / Expo ベストプラクティス遵守