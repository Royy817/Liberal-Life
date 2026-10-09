import { mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import vm from 'node:vm';
const context = { window: {} };
vm.runInNewContext(await readFile('site-config.js', 'utf8'), context);
const config = context.window.SITE_CONFIG;
if (process.env.VERCEL_ENV === 'production' && config.previewOnly !== false) {
  throw new Error('現在はURL共有用プレビューのみです。本番公開は明示的に許可されていません。');
}
if (process.env.VERCEL_ENV === 'production' && config.privacyConfirmed !== true) {
  throw new Error('公開前にsite-config.jsの運営者情報・個人情報保護方針を確認してください。プレビューは作成できます。');
}
await rm('public', { recursive: true, force: true });
await mkdir('public', { recursive: true });
for (const file of ['index.html', 'privacy.html', 'style.css', 'script.js', 'site-config.js']) {
  await copyFile(file, `public/${file}`);
}
const preview = process.env.VERCEL_ENV !== 'production';
// The user-authorized personal LINE link is available in protected previews.
// Other unconfirmed personal contact details stay in source only.
if (process.env.VERCEL_ENV === 'preview') {
  const safeConfig = { ...config, contactEmail: '', operatorName: 'AIPLUN', privacyConfirmed: false };
  await writeFile('public/site-config.js', 'window.SITE_CONFIG = Object.freeze(' + JSON.stringify(safeConfig, null, 2) + ');\n');
  for (const file of ['index.html', 'privacy.html']) {
    let html = await readFile(`public/${file}`, 'utf8');
    for (const value of [config.contactEmail, config.operatorName]) {
      if (value) html = html.split(value).join(value === config.operatorName ? 'AIPLUN' : '');
    }
    await writeFile(`public/${file}`, html);
  }
}
if (preview) {
  for (const file of ['index.html', 'privacy.html']) {
    const html = await readFile(`public/${file}`, 'utf8');
    await writeFile(`public/${file}`, html.replace('<head>', '<head>\n  <meta name="robots" content="noindex,nofollow">'));
  }
}
await writeFile('public/robots.txt', preview ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n');
console.log(`Static build ready (${preview ? 'preview / noindex' : 'production'})`);
