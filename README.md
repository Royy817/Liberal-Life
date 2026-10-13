# AIPLUN LIFE

既存PR #1を引き継いだ静的相談窓口。対象は転職・賃貸・インフラのみ。
相談の入口は個人LINE。運営者専用の紹介者・案件管理を追加し、管理データはサーバー側のPostgresへ保存します。外部アクセス解析は使用しません。

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
相談サイトと管理画面の静的ファイルだけを配信し、管理APIは `api/admin.js` のVercel Functionで実行。運用資料・テスト・サーバーコード・認証設定は静的配信しません。
プレビューはnoindex。`privacyConfirmed: false` の間は本番ビルドを拒否します。
確認が済んだらprivacy.htmlを確定し、設定をtrueにして本番ビルド・再テスト・公開を行います。

運用手順・管理方法・公開前確認は [docs/OPERATIONS.md](docs/OPERATIONS.md)。

現在は `previewOnly: true` により本番ビルドを禁止し、URL共有用のプレビューのみを許可しています。検索掲載防止はアクセス認証ではないため、URLを転送された人も閲覧できます。一般公開を再開する場合は、明示的な指示を受けた上でpreviewOnly設定とX-Robots-Tagを見直します。

### 限定プレビューの受付先

`VERCEL_ENV=preview node scripts/build.mjs` はデザイン確認用です。配信する設定から個人名・メールを除外（ユーザーが接続を指示した個人LINE URLは利用可能）し、フォームのメッセージ作成とコピーを利用できます。連絡先の正式な設定は `site-config.js` に保持します。ローカル動作確認は `node scripts/build.mjs` で実行できます。本番公開のガードは継続しています。

## 紹介者・案件管理

管理画面：`/admin/`。2026-10-13、限定共有Previewに専用Neon DBと管理者ログインを接続しました。本番公開はしていません。接続先・運用手順は [docs/ADMIN_SETUP.md](docs/ADMIN_SETUP.md)。`npm run test:admin` でSQL・認証・案件進捗を検証できます。
