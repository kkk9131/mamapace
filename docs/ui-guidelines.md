# UIガイドライン（MVP）

## 配色・テーマ
- useTheme() を使用し、以下のキーを参照
  - colors: bg, card, surface, text, subtext, pink, pinkSoft, mint, danger
  - spacing(n): 8px単位
  - radius: sm(10), md(14), lg(18)
  - shadow.card: 共通カード影

## コンポーネント共通
- 角丸: カード=radius.lg、ピル=999
- 影: ...theme.shadow.card を適用
- 透明ブラー: BlurView tint="dark" intensity=20-40 + 背景 #ffffff10 前後
- 余白: 外側は spacing(1)〜spacing(2)、リスト下部はタブを避けて余白追加
- アニメーション: Animated.Value + spring/timing、useNativeDriver: true

## アクションアイコン
- 共感=💗、コメント=💬
- ボタンは surface 背景のピル、押下でスケールダウン、+1 フロート演出

## 画面パターン
- ヘッダー/セクションタイトル: 小さめキャプション12、subtext色
- リストカード: BlurView + 内側padding、ItemSeparatorで高さ spacing(1)〜(2)
- 右下FAB: ピンク背景、円形56x56、影あり

## 画面別仕様
- HomeScreen
  - 投稿カード: タップで comments へ
  - 右上アクション: 💗/💬 アイコン + +1
  - 右下FAB: ＋で Compose へ
- AnonFeedScreen/AnonRoomScreen
  - 下部入力フォームはタブに被らないよう bottom:56 / 画面側に paddingBottom
  - アクションは Home と同様
- ComposeScreen（ポスト）
  - 左上: ◀️ 戻る（onClose）
  - 文言: 「ポスト」
  - ママの味方トグル: ON/OFF（ピンク=ON）
  - ポスト後は onClose
- CommentComposeScreen（コメント）
  - 下部バーにキャンセル/送信、コメント作成後は onClose
- CommentsListScreen（コメント一覧）
  - 「ママの味方」コメントを常に一覧先頭に配置
  - 視認性向上: 淡ピンク背景、ラベル色=pink
- NotificationsScreen
  - 種別アイコン: 💗/💬/⭐️
  - 未読は濃い表示+「新着」バッジ、既読は不透明度0.7
  - 時刻は本文下右寄せのバッジ風
- ChatsListScreen
  - 会話行: アバター、最終文、未読バッジ
- ChatScreen
  - 入力バーはタブと被らないよう bottom:56
- RoomsListScreen
  - 参加ルーム一覧: バッジに人数表示
- SettingsScreen
  - 左上タイトル= Mamapace（淡ピンク/大きめ）
  - 表示: ダークモード切替（ダミー）
  - 空き手トグル: 左/右
- ProfileScreen（あなた）
  - ヘッダー: アイコン、名前、ひとこと
  - フォロー/フォロワーはPillボタン（一覧へ遷移）
  - 共感したポスト/参加ルーム: 水平スクロールPill、下に自分のポスト一覧

## ナビゲーションキー（CustomTabs.active）
- home, compose, chats, chat, anon, comments, comment, noti, settings, rooms, roomsList, followers, following, liked, me

## 実装のコツ
- useTheme()を各画面で theme として受け取り、colors/spacing/radius/shadowを統一利用
- 交互参照の import は theme/theme と colors/colors の混在を避ける
- タブと被るUIは bottom:56 と画面側 paddingBottom をセットで調整
- タップ遷移は親から onNavigate/onOpen のpropsを受け取ってsetActiveを呼ぶ
