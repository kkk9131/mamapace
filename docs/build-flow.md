# ビルド運用フロー（EAS CLI・手動）

このドキュメントは iOS アプリを EAS CLI で“手動”ビルド/提出する流れをまとめたものです。ブランチは `master` を使用します。

## TL;DR（最短手順）

```bash
# 1) master 最新化
git checkout master && git pull

# 2) （必要な時だけ）マーケティングバージョン更新
#   例) 1.0.3 など
#   buildNumber は production プロファイルで自動増分されます
EAS_NO_VCS=1 eas build:version:set -p ios

# 3) 本番ビルド（提出は別コマンド）
eas build -p ios --profile production

# 4) TestFlight 提出（自動提出しない場合）
eas submit -p ios --latest

# まとめて自動提出したい場合（3,4 を一括）
# eas build -p ios --profile production --auto-submit
```

> 重要: `eas` コマンドは 1 行で実行してください。改行して `ios --profile ...` が別コマンドになると `sh: ios: command not found` になります。

---

## 前提条件

- EAS CLI ログイン済み
  - `eas whoami`（未ログインなら `eas login`）
- EAS プロジェクト連携済み（app.json の `extra.eas.projectId` が設定済み）
- Apple アカウント/ASC API Key が EAS に登録済み（初回のみ設定プロンプトに従う）
- iOS は `eas.json` の `production` プロファイルを使用
  - `autoIncrement: true`（buildNumber 自動加算）

## ブランチ戦略

- 本番ビルドは `master` ブランチから実施する
- 機能開発は feature ブランチ → PR → `master` にマージ → `master` からビルド

## バージョニング方針

- マーケティングバージョン（例: 1.0.3）
  - `eas build:version:set -p ios` で“必要なときだけ”更新
  - 日常の TestFlight 配布では同一バージョンのままでも可
- ビルド番号（buildNumber）
  - `production.autoIncrement: true` によりビルドごとに自動加算
- 備考
  - `app.json` の `ios.buildNumber` は remote 管理時は無視されます（警告を避けるため削除して問題なし）

## ビルドと提出

- ビルドのみ
  - `eas build -p ios --profile production`
- 提出（ビルド済みを送る）
  - `eas submit -p ios --latest`
- ビルドと同時に提出
  - `eas build -p ios --profile production --auto-submit`

## TestFlight での確認項目

- 初期化 UI が数秒で消えること（サービス初期化 OK）
- 認証（新規登録/ログイン）
- ルーム → 匿名カード（「愚痴もたまには、、、」）→ 新UI 表示
- 匿名投稿できること／リアルタイムで反映されること

## よくあるハマりどころ

- キュー待ち（Concurrency limit）
  - 正常です。枠が空くと自動開始
  - 進捗: `eas build:list`、キャンセル: `eas build:cancel <BUILD_ID>`
- コマンドの改行によるエラー
  - `eas build -p ios --profile production` は 1 行で実行
- Supabase 資格情報が取れない
  - 本番は `app.json` の `expo.extra.SUPABASE_URL/ANON_KEY` を参照（既に設定済み）
- 初期化前のアクセスによるクラッシュ
  - 匿名ルーム V2 はサービス初期化完了後に描画されるようガード済み

## 参考コマンド

- EAS 環境情報: `eas diagnostics`
- EAS 設定表示: `eas config`
- Apple側の提出後処理
  - TestFlight 反映: 5–30 分程度
  - 内部テスト: Internal Testing にメンバー追加
  - 外部テスト: グループ作成→テスター追加（審査説明が必要）

## 変更履歴（運用メモ）

- 2025-09: 匿名ルーム V2 初期化ガード・Animated 値取得を修正済み
- 2025-09: 本番用 Supabase 資格情報を `app.json` の `expo.extra` に追加済み

