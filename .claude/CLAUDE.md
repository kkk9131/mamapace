# MamaPace - SNSアプリケーション

## プロジェクト概要
MamaPaceは、React Native (Expo) とSupabaseを使用して構築されたモバイルSNSアプリケーションです。

## 技術スタック
- **フロントエンド**: React Native 0.79.5, Expo 53.0.20, TypeScript
- **バックエンド**: Supabase (PostgreSQL, Realtime, Auth)
- **状態管理**: React Context API
- **ナビゲーション**: React Navigation (Bottom Tabs)
- **テスト**: Jest, Detox, React Testing Library

## ディレクトリ構造
```
src/
├── components/       # 再利用可能なUIコンポーネント
├── config/          # アプリケーション設定
├── contexts/        # React Context (認証など)
├── navigation/      # ナビゲーション設定
├── screens/         # 画面コンポーネント
├── services/        # ビジネスロジック・API通信
├── theme/           # テーマ・スタイル定義
├── types/           # TypeScript型定義
└── utils/           # ユーティリティ関数
```

## 主要機能
### 実装済み
- **認証システム**: サインアップ、ログイン、セッション管理
- **投稿機能**: 投稿作成、いいね、コメント
- **プロフィール**: プロフィール表示・編集
- **フォロー機能**: ユーザーフォロー/フォロワー管理
- **匿名機能**: 匿名投稿、匿名ルーム
- **通知**: プッシュ通知対応
- **検索**: ユーザー・投稿検索

### 開発中 (feature/real-time-chat)
- **リアルタイムチャット**: 1対1チャット機能

## データベース構造 (Supabase)
### 主要テーブル
- `profiles`: ユーザープロフィール情報
- `posts`: 投稿データ
- `comments`: コメントデータ
- `likes`: いいね情報
- `follows`: フォロー関係
- `notifications`: 通知データ
- `rooms`: チャットルーム（匿名機能用）

## セキュリティ機能
- **暗号化**: encryptionService による機密データ暗号化
- **セッション管理**: セキュアなトークン管理
- **入力検証**: validationService による厳格な入力チェック
- **RLS (Row Level Security)**: Supabase側でのアクセス制御

## 開発コマンド
```bash
# 開発サーバー起動
npm start

# iOS シミュレーター
npm run ios

# Android エミュレーター
npm run android

# テスト実行
npm test
npm run test:coverage

# Lint
npm run lint

# E2Eテスト
npm run detox:test
```

## 環境変数
- `SUPABASE_URL`: Supabase プロジェクトURL
- `SUPABASE_ANON_KEY`: Supabase 匿名キー

## 注意事項
- Expo管理ワークフローを使用
- TypeScript厳格モードで開発
- ESLint/Prettierによるコード品質管理
- テストカバレッジ目標: 80%以上