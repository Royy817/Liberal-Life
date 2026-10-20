'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse,createRoomHandler}=require('../server/room.cjs');
const valid={customerName:'山田',email:'test@example.com',phone:'',area:'京都市',rent:'7〜8万円',layout:'ワンルーム / 1K',move:'2027-03',budget:'15〜25万円',features:['独立洗面台'],priority:'立地・通勤通学',notes:'駅の近く',consent:true,website:'',ref:'',channel:'',source:''};
test('accept valid room inquiry and reject unconsented submissions',()=>{
  assert.equal(parse(valid).area,'京都市');
  assert.throws(()=>parse({...valid,consent:false}),/同意/);
  assert.throws(()=>parse({...valid,features:['不正']}),/こだわり/);
  assert.throws(()=>parse({...valid,notes:'\u0000'}),/その他/);
});
function response(){return{statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},end(s){this.payload=JSON.parse(s)}}}
function request(body,origin='https://example.test'){return{method:'POST',url:'/api/room',headers:{host:'example.test',origin,'content-type':'application/json'},body,socket:{remoteAddress:'127.0.0.1'}}}
test('POST stores explicit consent in isolated inquiry table',async()=>{
  const statements=[];
  const db={query:async(sql,params)=>{statements.push({sql,params});return sql.includes('RETURNING attempts')?[{attempts:1}]:[]}};
  const handler=createRoomHandler({db,env:{DATABASE_URL:'mock',ADMIN_SECRET:'x'.repeat(32)}});
  const res=response();await handler(request(valid),res);
  assert.equal(res.statusCode,201);
  assert.match(res.payload.id,/^R-[0-9a-f-]{36}$/);
  const insert=statements.find(x=>x.sql.includes('INSERT INTO life_room_inquiries'));
  assert.ok(insert);
  assert.equal(JSON.parse(insert.params[1]).email,'test@example.com');
});
test('POST refuses missing consent and cross-origin submissions',async()=>{
  const handler=createRoomHandler({db:{query:async()=>[]},env:{DATABASE_URL:'mock',ADMIN_SECRET:'x'.repeat(32)}});
  const first=response();await handler(request({...valid,consent:false}),first);assert.equal(first.statusCode,400);
  const second=response();await handler(request(valid,'https://evil.test'),second);assert.equal(second.statusCode,403);
});
