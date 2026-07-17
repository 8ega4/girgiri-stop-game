# ギリギリで止めろ！

猫が押しているコップを、机から落ちるギリギリで止めるワンタップWebゲームです。スマートフォン縦画面を中心に、タップ・クリック・Space・Enterで5ラウンドを遊べます。

## 開発

```bash
npm install
npm run dev
```

品質確認:

```bash
npm test
npm run build
npm run preview
```

## 主な機能

- 速度・加速・緩急・フェイントが異なる全5ラウンド
- 正規化座標による端末サイズに依存しないスコア計算
- 通常モードと日付固定シードの「今日のチャレンジ」
- X、Threads、LINE、Web Share APIでの共有
- Canvas APIによる1080×1920の結果画像保存
- Web Audio APIの効果音、振動、紙吹雪、音量設定保存
- ハイスコア・プレイ回数・デイリー結果のローカル保存
- GA4が存在する場合だけ送信するイベント計測

## GitHub Pagesへの公開

`vite.config.ts`は相対パス（`base: "./"`）でビルドするため、リポジトリ名に関係なくサブディレクトリ配信できます。

1. `npm run build`を実行する
2. GitHubリポジトリの Settings → Pages を開く
3. GitHub Actions、または`dist`を公開するワークフローを選ぶ

GitHub Actionsを使う場合は、Node.jsをセットアップして`npm ci && npm run build`を実行し、`dist`をPages artifactとしてアップロードしてください。

## 画像素材

提供された3枚の参考画像は`public/assets/reference-*.png`に保持しています。ゲーム内では、そこから猫・コップ・机を切り出してWebP化した以下の素材を使用します。

- `hero-cat-cup.webp`: スタート画面
- `game-cat-cup.webp`: プレイ画面
- `result-cat-cup.webp`: 最終結果カード
- `og-image.png`: 1200×630のSNS共有画像

外部API、ログイン、データベースは使用していません。
