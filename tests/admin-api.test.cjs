'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { PGlite } = require('@electric-sql/pglite');
const { createHandler } = require('../server/admin.cjs');
const { passwordHash } = require('../server/auth.cjs');
const { caseData, InputError, csv } = require('../server/domain.cjs');
const intake = () => ({ label:'テスト相談',category:'rent',channel:'sns',source:'tiktok',receivedAt:'2026-10-12',stage:'intake',referrerCode:'r001',consultationId:'AL-20261012-test01' });
test('authenticated SQL workflow: intake to payment, attribution, conflicts, audit, export and durable persistence', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'life-sql-test-'));
  let db=new PGlite(dir); await db.exec(fs.readFileSync(path.join(__dirname,'../server/schema.sql'),'utf8'));
  const env={ADMIN_ACCOUNTS:JSON.stringify([{username:'owner',hash:await passwordHash('test-only-password-long-2026')}]),ADMIN_SECRET:'test-only-random-secret-01234567890123456789'};
  const server=http.createServer(createHandler({env,db,secure:false}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  let cookie='',csrf='';
  async function call(action,method='GET',body,extra={}){
    const r=await fetch(base+'/api/admin?action='+action,{method,headers:{...(cookie?{cookie}:{}),...(method!=='GET'?{Origin:base,'Content-Type':'application/json','X-CSRF-Token':csrf}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});
    return {r,data:r.headers.get('content-type')?.includes('application/json')?await r.json():await r.text()};
  }
  try {
    assert.equal((await call('cases')).r.status,401);
    assert.equal((await call('login','POST',{username:'owner',password:'wrong'})).r.status,401);
    const login=await call('login','POST',{username:'owner',password:'test-only-password-long-2026'});assert.equal(login.r.status,200);cookie=login.r.headers.get('set-cookie').split(';')[0];csrf=login.data.csrf;
    assert.match(login.r.headers.get('set-cookie'),/HttpOnly/);assert.match(login.r.headers.get('set-cookie'),/SameSite=Strict/);assert.match(login.r.headers.get('cache-control'),/no-store/);
    assert.equal((await call('referrers','POST',{code:'r001',name:'紹介者01',active:true},{Origin:'https://evil.example'})).r.status,403);
    assert.equal((await call('referrers','POST',{code:'r001',name:'紹介者01',active:true},{'X-CSRF-Token':'wrong'})).r.status,403);
    assert.equal((await call('referrers','POST',{code:'r001',name:'紹介者01',active:true})).r.status,200);
    assert.equal((await call('referrers','POST',{code:'r001',name:'重複',active:true})).r.status,409);
    const added=await call('cases','POST',intake());assert.equal(added.r.status,200);let c=added.data.case;
    assert.equal(c.referrerCode,'r001');assert.equal(c.channel,'sns');assert.equal(c.source,'tiktok');
    assert.equal((await call('cases','POST',intake())).r.status,409);
    const invalid=await call('cases','PATCH',{...c,stage:'referred',referredAt:'2026-10-13'});assert.equal(invalid.r.status,400);
    assert.equal((await db.query('SELECT count(*) FROM life_audit')).rows[0].count,2);
    for(const patch of [
      {stage:'consented',consentAt:'2026-10-12',provider:'Liberal Life 賃貸担当',sharedItems:'相談カテゴリー、希望時期'},
      {stage:'referred',referredAt:'2026-10-13'},
      {stage:'won',wonAt:'2026-10-14'},
      {stage:'rewarded',rewardedAt:'2026-10-15',reward:30000},
      {stage:'paid',paidAt:'2026-10-20'}
    ]){const updated=await call('cases','PATCH',{...c,...patch});assert.equal(updated.r.status,200,JSON.stringify(updated.data));c=updated.data.case;}
    assert.equal((await call('cases','PATCH',{...c,version:1,label:'古い画面'})).r.status,409);
    const list=await call('cases');assert.equal(list.data.cases[0].stage,'paid');assert.equal(list.data.cases[0].reward,30000);
    const output=await call('export');assert.equal(output.r.status,200);assert.match(output.data,/r001/);assert.match(output.data,/30000/);
    assert.match(csv([{label:'=HYPERLINK("evil")'}]),/'=HYPERLINK/);
    const history=await call('audit');assert.equal(history.data.audit.length,7);assert.ok(history.data.audit.every(x=>x.actor==='owner'));
    assert.equal((await call('delete','POST',{id:c.id,version:c.version-1})).r.status,409);
    // SQL engine is closed and reopened to verify durable disk persistence.
    await db.close();db=new PGlite(dir);const persisted=await db.query('SELECT data FROM life_cases');assert.equal(persisted.rows[0].data.paidAt,'2026-10-20');await db.close();
  } finally {await new Promise(r=>server.close(r));await db.close().catch(()=>{});fs.rmSync(dir,{recursive:true,force:true});}
});
test('logout invalidates the session, stopped referrers cannot receive new cases, throttling is persisted',async()=>{
  const db=new PGlite();await db.exec(fs.readFileSync(path.join(__dirname,'../server/schema.sql'),'utf8'));
  const env={ADMIN_ACCOUNTS:JSON.stringify([{username:'owner',hash:await passwordHash('test-only-password-long-2026')}]),ADMIN_SECRET:'test-only-random-secret-01234567890123456789'};
  const server=http.createServer(createHandler({env,db,secure:false}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const login=await fetch(base+'/api/admin?action=login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:'owner',password:'test-only-password-long-2026'})});const cookie=login.headers.get('set-cookie').split(';')[0],{csrf}=await login.json();
  const headers={Origin:base,'Content-Type':'application/json',cookie,'X-CSRF-Token':csrf};
  try{await fetch(base+'/api/admin?action=referrers',{method:'POST',headers,body:JSON.stringify({code:'r001',name:'停止',active:false})});assert.equal((await fetch(base+'/api/admin?action=cases',{method:'POST',headers,body:JSON.stringify(intake())})).status,400);
    await fetch(base+'/api/admin?action=referrers',{method:'PATCH',headers,body:JSON.stringify({code:'r001',name:'再開',active:true,version:1})});
    const added=await fetch(base+'/api/admin?action=cases',{method:'POST',headers,body:JSON.stringify(intake())});const c=(await added.json()).case;
    assert.equal((await fetch(base+'/api/admin?action=delete',{method:'POST',headers,body:JSON.stringify({id:c.id,version:c.version})})).status,200);
    assert.equal((await db.query('SELECT count(*) FROM life_cases')).rows[0].count,0);
    assert.equal((await db.query("SELECT count(*) FROM life_audit WHERE action='case_deleted'")).rows[0].count,1);

    assert.equal((await fetch(base+'/api/admin?action=logout',{method:'POST',headers,body:'{}'})).status,200);assert.equal((await fetch(base+'/api/admin?action=cases',{headers:{cookie}})).status,401);
    let last;for(let i=0;i<8;i++)last=await fetch(base+'/api/admin?action=login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:'owner',password:'wrong'})});assert.equal(last.status,429);
  }finally{await new Promise(r=>server.close(r));await db.close();}
});
test('unconfigured backend fails closed; chronology, consent and reward validation',async()=>{
  const handler=createHandler({env:{}});let code,text;const res={setHeader(){},set statusCode(v){code=v;},end(v){text=v;}};await handler({url:'/api/admin?action=cases',method:'GET',headers:{}},res);assert.equal(code,503);assert.equal(JSON.parse(text).configured,false);
  for(const patch of [{receivedAt:'invalid'},{receivedAt:'2026-02-30'},{stage:'paid'},{reward:-1},{stage:'referred',consentAt:'2026-10-13',referredAt:'2026-10-12'},{wonAt:'2026-10-15'},{stage:'rewarded',reward:'NaN'}])assert.throws(()=>caseData({...intake(),...patch}),InputError);
});
