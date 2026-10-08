# AIPLUN LIFE

既存PR #1を引き継いだ静的相談窓口。対象は転職・賃貸・インフラのみ。
LINE公式アカウント、データベース、外部アクセス解析は使用しません。

## 受付先の変更

`site-config.js` の `personalLineUrl` に、本人の個人LINEの「友だち追加」でコピーした実際のHTTPSリンクを設定します。
対応形式は `https://line.me/ti/p/…` または `https://lin.ee/…`（個人アカウント由来であることを本人が確認）。
空欄・不正なリンクは非表示になります。`contactEmail` は既存メールを引き継いでいます。
LINEの自動送信はありません。メッセージをコピー → 友だち追加 → トークに貼り付け → 本人が送信します。
メールは宛先・件名・本文を入れたメールアプリを起動します。アプリ未設定の場合もコピーした文章を利用できます。

## ローカル確認

Node.js 22以上とPython 3を使用。

```sh
node scripts/build.mjs
python -m http.server 4173 --directory public
```

`http://localhost:4173` を開きます。ブラウザテストはPlaywrightを用意して
`NODE_PATH=/path/to/node_modules node tests/e2e.cjs`（テスト用サーバーは自動起動）を実行します。
`BASE_URL` でテスト先を変更できます。既存のChromiumを利用する場合は `CHROMIUM_EXECUTABLE_PATH` を指定できます。テストは外部へメール・LINEを送信しません。

## Vercel

このリポジトリ専用の独立したプロジェクトを使用。AIPLUN Studioのプロジェクトやドメインは変更しません。
ビルド：`node scripts/build.mjs`、公開ディレクトリ：`public`、Framework：Other。
公開ファイルは5ファイル＋robots.txtのみ。運用資料・テストは配信しません。
プレビューはnoindex。`privacyConfirmed: false` の間は本番ビルドを拒否します。
確認が済んだらprivacy.htmlを確定し、設定をtrueにして本番ビルド・再テスト・公開を行います。

運用手順・管理方法・公開前確認は [docs/OPERATIONS.md](docs/OPERATIONS.md)。
