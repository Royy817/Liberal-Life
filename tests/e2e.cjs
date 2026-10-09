const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.BASE_URL || 'http://localhost:4173';
(async () => {
 let server;
 if (!process.env.BASE_URL) {
  const http=require('node:http'); const path=require('node:path');
  server=http.createServer((req,res)=>{
   const name=req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0].slice(1);
   if(!/^assets\/photos\/(career|rent|utility)-(480|960)\.webp$/.test(name) && !['index.html','privacy.html','career.html','rent.html','utility.html','style.css','script.js','site-config.js','robots.txt'].includes(name)){res.writeHead(404);res.end();return;}
   res.setHeader('Content-Type',name.endsWith('.webp')?'image/webp':name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html; charset=utf-8');
   res.end(fs.readFileSync(path.join(__dirname,'../public',name)));
  });
  await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
 }
 const browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--single-process','--no-zygote','--proxy-server=direct://','--use-gl=angle','--use-angle=swiftshader','--in-process-gpu']} : {})});
 const failures=[]; const checks=[];
 const context = await browser.newContext({permissions:['clipboard-read','clipboard-write']});
 const page = await context.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(15000);
 page.on('pageerror', e=>failures.push(e.message));
 await page.goto(base);
 for(const photo of await page.locator('.service-card-photo img').all()){await photo.evaluate(async img=>{await img.decode();});assert.equal(await photo.evaluate(img=>img.naturalWidth>0),true);}
 checks.push('all service photographs load from local WebP assets');
 await page.locator('#copy-button').click();
 assert.match(await page.locator('#form-error').innerText(), /カテゴリー/);
 await page.locator('[data-service="rent"]').click();
 await page.locator('#copy-button').click();
 assert.match(await page.locator('#form-error').innerText(), /時期/);
 await page.locator('#timing').selectOption({index:1});
 await page.locator('#insert-example').click();
 assert.match(await page.locator('#details').inputValue(), /引っ越し/);
 assert.equal(await page.locator('#insert-example').isDisabled(), true);
 const exampleLength=(await page.locator('#details').inputValue()).length;
 assert.equal(await page.locator('#char-count').innerText(), exampleLength+' / 1000');
 await page.locator('#details').fill('');
 assert.equal(await page.locator('#insert-example').isEnabled(), true);
 checks.push('category-specific example, existing input protected, live character count');
 await page.locator('#details').fill('京都で引っ越しを相談したい');
 await page.locator('#copy-button').click();
 assert.equal(await page.locator('#line-action').isVisible(),true);
 assert.equal(await page.locator('#line-action').getAttribute('href'),'https://line.me/ti/p/9wwRevW_8u');
 assert.equal(await page.locator('#mail-action').isVisible(),true);
 const draft=await page.locator('#draft').inputValue();
 assert.match(draft,/相談ID：AL-/); assert.match(draft,/未同意/);
 const mail=await page.locator('#mail-action').getAttribute('href');
 assert.equal(new URL(mail).searchParams.get('body'),draft);
 await page.locator('#copy-draft').click();
 assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),draft);
 checks.push('required fields, category sync, mail recipient/subject/body, clipboard, configured LINE target');
 await page.locator('#details').fill('修正した相談');
 assert.equal(await page.locator('#result').isVisible(),false);
 await page.locator('#share-consent').check();
 await page.locator('#copy-button').click();
 assert.match(await page.locator('#draft').inputValue(),/話を聞いてみたい/);
 assert.match(await page.locator('#draft').inputValue(),/未同意/);
 assert.deepEqual(await page.evaluate(()=>[localStorage.length,sessionStorage.length]),[0,0]);
 checks.push('stale draft hidden, interest does not grant sharing consent, no browser persistence');
 for(const category of ['career','rent','utility']){
   await page.locator(`[data-service="${category}"]`).click();
   await page.locator('#copy-button').click();
   assert.match(await page.locator('#mail-action').getAttribute('href'),/^mailto:/);
 }
 checks.push('all 3 categories');
 for(const url of ['', 'https://line.me/ti/p/test-personal','https://lin.ee/test-personal','https://line.me.evil.example/ti/p/test','javascript:alert(1)','https://line.me/ti/p/test?x=1','https://page.line.me/official','https://line.me/','https://user@line.me/ti/p/test']){
  await page.route('**/site-config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.SITE_CONFIG={contactEmail:'roy.0817.soccer@gmail.com',personalLineUrl:${JSON.stringify(url)}};`}));
  await page.goto(base);
  await page.locator('[data-service="career"]').click();
  await page.locator('#timing').selectOption({index:1});
  await page.locator('#copy-button').click();
  const valid=['https://line.me/ti/p/test-personal','https://lin.ee/test-personal'].includes(url);
  assert.equal(await page.locator('#line-action').isVisible(),valid,url);
  if(valid){assert.equal(await page.locator('#line-action').getAttribute('href'),url);}
  await page.unroute('**/site-config.js');
 }
 checks.push('personal LINE valid/invalid URL cases; external LINE navigation not executed');
 await page.route('**/site-config.js',route=>route.fulfill({contentType:'application/javascript',body:"window.SITE_CONFIG={contactEmail:'bad\\r\\nBcc:bad@example.com',personalLineUrl:''};"}));
 await page.goto(base);await page.locator('[data-service="utility"]').click();await page.locator('#timing').selectOption({index:1});await page.locator('#copy-button').click();
 assert.equal(await page.locator('#mail-action').isVisible(),false);assert.equal(await page.locator('#no-contact').isVisible(),true);
 await page.unroute('**/site-config.js');
 await page.goto(base);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('denied'))},configurable:true}));
 await page.locator('[data-service="utility"]').click();await page.locator('#timing').selectOption({index:1});await page.locator('#copy-button').click();await page.locator('#copy-draft').click();
 assert.match(await page.locator('#copy-status').innerText(),/文章を選択/);
 checks.push('invalid mail hidden, no contact notice, clipboard denial manual-copy fallback');
 fs.mkdirSync('test-results',{recursive:true});
 for(const width of [320,375,390,768,1440]){
  await page.setViewportSize({width,height:900});await page.goto(base);
  await page.locator('[data-service="rent"]').click();await page.locator('#timing').selectOption({index:1});await page.locator('#copy-button').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}`);
  await page.goto(base+'/privacy.html');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`privacy overflow ${width}`);
  if(width===390||width===1440){await page.goto(base);await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.querySelector('.hero-panel').getAnimations().map(a=>a.finished));});await page.screenshot({path:`test-results/home-${width}.png`,fullPage:true});await page.locator('[data-service="rent"]').click();await page.locator('#timing').selectOption({index:1});await page.locator('#copy-button').click();await page.locator('#consult').screenshot({path:`test-results/form-${width}.png`});}
 }
 checks.push('home/form/privacy no horizontal overflow at 320/375/390/768/1440px');
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base);
 assert.equal(await page.locator('.hero-panel').evaluate(el=>getComputedStyle(el).animationName),'none');
 assert.deepEqual(failures,[]);
 checks.push('reduced motion, no JavaScript errors');
 for(const category of ['career','rent','utility']){
  for(const width of [320,390,1440]){
   await page.setViewportSize({width,height:900});await page.goto(base+'/'+category+'.html');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`guide overflow ${category} ${width}`);
   assert.equal(await page.locator('h1').count(),1);
   await page.locator('.detail-photo img').evaluate(async img=>{await img.decode();});
   assert.equal(await page.locator('.detail-photo img').evaluate(img=>img.naturalWidth>0),true);
   assert.equal(await page.locator('a[href="https://www.liberal-life.com/businessoverview"]').count(),1);
   if(width===390||width===1440)await page.screenshot({path:`test-results/guide-${category}-${width}.png`,fullPage:true});
  }
  await page.locator('.detail-hero .button').click();
  assert.equal(await page.locator(`input[name="category"][value="${category}"]`).isChecked(),true);
  await page.locator('#timing').selectOption({index:1});await page.locator('#copy-button').click();
  assert.match(await page.locator('#draft').inputValue(),/未同意/);
  assert.equal(await page.locator('#line-action').getAttribute('href'),'https://line.me/ti/p/9wwRevW_8u');
 }
 await page.goto(base+'/?category=invalid#consult');
 assert.equal(await page.locator('input[name="category"]:checked').count(),0);
 await page.goto(base);assert.equal(await page.locator('.service-detail-link').count(),3);
 assert.deepEqual(failures,[]);
 checks.push('3 service guides, official source link, mobile/desktop overflow, category-prefilled consultation and LINE target, invalid category ignored');

 await browser.close();if(server) await new Promise(resolve=>server.close(resolve));console.log(JSON.stringify({status:'PASS',checks},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
