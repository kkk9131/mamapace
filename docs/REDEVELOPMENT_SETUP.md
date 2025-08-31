# 再開発（再セットアップ）チェックリスト

このドキュメントは、開発を再開するとき（新しいマシン・新しいクローン・久しぶりの作業）に必要な再生成手順をまとめたものです。基本的に`.gitignore`に入っているものは都度生成/準備します。

## 前提
- Node.js (推奨: LTS)
- npm もしくは yarn（本プロジェクトは npm を想定）
- Git / GitHub アクセス権
- Expo（`npx expo`でOK）

## 1) 初回のみ必要な準備
- ブランチ
  ```bash
  git checkout master
  git pull --ff-only
  git checkout -b feature/<your-topic>
  ```
- 環境変数（.env）
  - 追跡されないため、各自作成が必要（新規クローン時のみ）
  ```bash
  cp .env.example .env
  # 必要な値を入力（例）
  # SUPABASE_URL=
  # SUPABASE_ANON_KEY=
  ```

## 2) 毎回（もしくは環境が変わったとき）再生成するもの
- 依存パッケージ（`node_modules/` はコミットされない）
  ```bash
  npm ci
  ```
- Expo キャッシュクリア（挙動が不安定なときに有効・任意）
  ```bash
  npx expo start -c
  ```
- Web/ビルド生成物（`dist/`, `web-build/` 等）
  - 実行時に自動生成されるため、事前生成は不要

## 3) アプリ起動（ローカル）
```bash
npm run start         # or: npx expo start
```
（iOS/Android ビルドは Expo のワークフローに準拠。Bare ではないため `pod install` は不要）

## 4) Supabase 関連
- 通常はリモート環境を使用するため、ローカルでの DB 起動やマイグレーション実行は不要
- 環境変数（`SUPABASE_URL`, `SUPABASE_ANON_KEY`）が正しいかのみ確認

## 5) よくあるトラブル復旧
- 依存が壊れていそう
  ```bash
  rm -rf node_modules package-lock.json
  npm ci
  ```
- キャッシュによる画面不整合
  ```bash
  npx expo start -c
  ```
- .env の不足/不一致
  - `.env.example` を更新内容に合わせて `.env` を追補

## 6) コミット/プッシュの流れ（参考）
```bash
git add -A
git commit -m "<変更概要>"
git push -u origin feature/<your-topic>
```
PR を作成し、レビュー後に `master` へマージしてください。

---
補足: `.gitignore` に含まれるファイル群（例: `.env`, `node_modules/`, `dist/`, `.expo/`, `coverage/`）はリポジトリに含まれません。新規クローン時は `.env` の作成、依存インストール（`npm ci`）のみ行えば動作します。

