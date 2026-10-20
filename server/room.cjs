'use strict';
const crypto = require('node:crypto');
const {getDb}=require('./db.cjs');
const {InputError}=require('./domain.cjs');

const RENTS=['5万円未満','5〜6万円','6〜7万円','7〜8万円','8〜10万円','10〜12万円','12〜15万円','15万円以上','相談して決めたい'];
const LAYOUTS=['','ワンルーム / 1K','1DK / 1LDK','2K / 2DK / 2LDK','3LDK以上','相談して決めたい'];
const BUDGETS=['','15万円以内','15〜25万円','25〜35万円','35〜50万円','50万円以上'];
const PRIORITIES=['','家賃の安さ','立地・通勤通学','広さ・間取り','設備','初期費用の安さ','周辺環境'];
const FEATURES=['駅徒歩10分以内','バス・トイレ別','独立洗面台','2階以上','オートロック','築浅','ペット相談','駐車場あり','ネット無料','家具家電付き'];
const CHANNELS=['','sns','direct','friend','other'];
function string(value,max,label,required=false,multiline=false){
  if(typeof value!=='string'||value.length>max||/[\u0000-\u0009\u000b-\u001f\u007f]/.test(value)||(!multiline&&/\n/.test(value)))throw new InputError(label+'を確認してください。');
  const s=value.trim();if(required&&!s)throw new InputError(label+'を入力してください。');return s;
}
function choice(value,options,label){if(!options.includes(value))throw new InputError(label+'を確認してください。');return value;}
function parse(data){
  if(!data||typeof data!=='object'||Array.isArray(data))throw new InputError('入力内容を確認してください。');
  if(data.consent!==true)throw new InputError('個人情報の取り扱いへの同意が必要です。');
  if(data.website)throw new InputError('送信内容を確認してください。',400);
  const customerName=string(data.customerName,80,'お名前',true);
  const email=string(data.email,150,'メール',true);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new InputError('メールアドレスを確認してください。');
  const phone=string(data.phone||'',30,'電話番号');
  if(phone&&!/^[+0-9()\-\s]{8,30}$/.test(phone))throw new InputError('電話番号を確認してください。');
  const features=data.features;
  if(!Array.isArray(features)||features.length>FEATURES.length||new Set(features).size!==features.length||features.some(f=>!FEATURES.includes(f)))throw new InputError('こだわり条件を確認してください。');
  const move=string(data.move||'',7,'入居希望時期');
  if(move&&!/^(20[2-9][0-9])-(0[1-9]|1[0-2])$/.test(move))throw new InputError('入居希望時期を確認してください。');
  const ref=string(data.ref||'',40,'紹介者コード');
  const source=string(data.source||'',40,'流入元');
  if(ref&&!/^[a-zA-Z0-9_-]{2,40}$/.test(ref))throw new InputError('紹介者コードを確認してください。');
  if(source&&!/^[a-zA-Z0-9_-]{1,40}$/.test(source))throw new InputError('流入元を確認してください。');
  return {customerName,email,phone,area:string(data.area,150,'希望エリア',true),
    rent:choice(data.rent,RENTS,'家賃'),layout:choice(data.layout||'',LAYOUTS,'間取り'),
    move,budget:choice(data.budget||'',BUDGETS,'初期費用'),
    features,priority:choice(data.priority||'',PRIORITIES,'優先条件'),
    notes:string(data.notes||'',1000,'その他のご希望',false,true),
    ref,channel:choice(data.channel||'',CHANNELS,'流入経路'),source,
    consentAt:new Date().toISOString()};
}
function createRoomHandler(options={}){
  const env=options.env||process.env;
  const database=options.db||{query:(...args)=>getDb().query(...args)};
  const query=async(...args)=>{const r=await database.query(...args);return Array.isArray(r)?r:r.rows;};
  return async function roomHandler(req,res){
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');
    res.setHeader('X-Content-Type-Options','nosniff');
    const send=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));};
    try{
      if(req.method!=='POST')throw new InputError('POSTで送信してください。',405);
      const isLocal=env.NODE_ENV==='development';
      const expected=(isLocal?'http://':'https://')+req.headers.host;
      if(!req.headers.host||req.headers.origin!==expected||req.headers['sec-fetch-site']==='cross-site'||!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new InputError('送信元を確認できません。',403);
      if(!env.DATABASE_URL&&!options.db)throw new InputError('受付準備中です。LINE相談をご利用ください。',503);
      if(!env.ADMIN_SECRET||env.ADMIN_SECRET.length<32)throw new InputError('受付準備中です。LINE相談をご利用ください。',503);
      let body=req.body;
      if(body===undefined){
        const chunks=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>12000)throw new InputError('入力が長すぎます。',413);chunks.push(chunk);}
        body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      }else{
        if(Buffer.byteLength(typeof body==='string'?body:JSON.stringify(body))>12000)throw new InputError('入力が長すぎます。',413);
        if(typeof body==='string')body=JSON.parse(body);
      }
      if(body?.website)return send(200,{ok:true,received:false});
      const data=parse(body);
      const address=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
      const ipkey=crypto.createHmac('sha256',env.ADMIN_SECRET).update(address).digest('hex');
      for(const [key,max] of [['room-ip-'+ipkey,5],['room-global',200]]){
        const [rate]=await query(`INSERT INTO life_room_limits(key,attempts,expires_at) VALUES($1,1,now()+interval '1 hour') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN life_room_limits.expires_at<now() THEN 1 ELSE life_room_limits.attempts+1 END,expires_at=CASE WHEN life_room_limits.expires_at<now() THEN now()+interval '1 hour' ELSE life_room_limits.expires_at END RETURNING attempts`,[key]);
        if(rate.attempts>max){res.setHeader('Retry-After','3600');throw new InputError('短時間に送信が集中しています。時間をおいてください。',429);}
      }
      const id='R-'+crypto.randomUUID();
      await query('INSERT INTO life_room_inquiries(id,profile,stage) VALUES($1,$2::jsonb,$3)',[id,JSON.stringify(data),'new']);
      return send(201,{ok:true,id});
    }catch(err){
      if(err instanceof InputError)return send(err.status,{error:err.message});
      if(err instanceof SyntaxError)return send(400,{error:'入力形式を確認してください。'});
      return send(503,{error:'保存できませんでした。LINEからご相談いただくか、時間をおいて再度お試しください。'});
    }
  };
}
module.exports={createRoomHandler,parse};
