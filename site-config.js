// 個人LINEの「友だち追加」からコピーした実際のHTTPSリンクを設定します。
// 空欄・不正なURLならLINE導線を表示せず、メール相談に切り替えます。
// このファイルは公開されます。秘密鍵や個人情報を追加しないでください。
window.SITE_CONFIG = Object.freeze({
  // URL共有用のプレビューのみ。本番ビルドを禁止します。
  previewOnly: true,
  contactEmail: "roy.0817.soccer@gmail.com",
  personalLineUrl: "https://line.me/ti/p/9wwRevW_8u",
  operatorName: "尾島 蓮瑛（AIPLUN）",
  // 運営者情報・保管方針・本人同意の運用を確認してからtrueに変更。
  privacyConfirmed: false,
});
