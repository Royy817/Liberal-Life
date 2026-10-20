'use strict';
const roomForm=document.getElementById('roomConsultForm');
const reviewSection=document.getElementById('roomReviewSection');
const summaryArea=document.getElementById('roomSummary');
const errorNode=document.getElementById('roomError');
const sendNote=document.getElementById('roomSendNote');
const submitButton=document.getElementById('roomSubmit');
let summaryText='',savedId='';
function lineUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&((u.hostname==='line.me'&&/^\/ti\/p\/[a-zA-Z0-9_-]+$/.test(u.pathname))||(u.hostname==='lin.ee'&&/^\/[a-zA-Z0-9_-]+$/.test(u.pathname)))?u.href:'';}catch{return '';}}
const lineLink=document.getElementById('roomLineLink'),personalLine=lineUrl(window.SITE_CONFIG?.personalLineUrl||'');
if(personalLine){lineLink.href=personalLine;lineLink.hidden=false;}
const field=name=>roomForm.elements.namedItem(name).value.trim();
const referral=new URLSearchParams(location.search);
const cleanRef=value=>/^[a-zA-Z0-9_-]{2,40}$/.test(value||'')?value:'';
const cleanChannel=value=>['sns','direct','friend','other'].includes(value)?value:'';
const cleanSource=value=>/^[a-zA-Z0-9_-]{1,40}$/.test(value||'')?value:'';
function getData(){
  return {customerName:field('customerName'),email:field('email'),phone:field('phone'),area:field('area'),rent:field('rent'),
    layout:field('layout'),move:field('move'),budget:field('budget'),
    features:[...roomForm.querySelectorAll('[name="features"]:checked')].map(x=>x.value),
    priority:field('priority'),notes:field('notes'),consent:document.getElementById('roomConsent').checked,
    website:document.getElementById('roomWebsite').value,
    ref:cleanRef(referral.get('ref')),channel:cleanChannel(referral.get('channel')),source:cleanSource(referral.get('utm_source'))};
}
roomForm.addEventListener('input',()=>{
  if(!reviewSection.hidden&&!savedId){reviewSection.hidden=true;}
});
roomForm.addEventListener('change',()=>{
  if(!reviewSection.hidden&&!savedId){reviewSection.hidden=true;}
});
roomForm.addEventListener('submit',event=>{
  event.preventDefault();
  errorNode.textContent='';
  if(!roomForm.checkValidity()){errorNode.textContent='必須項目とメールアドレス、同意欄をご確認ください。';roomForm.reportValidity();return;}
  const d=getData();
  const pairs=[['お名前',d.customerName],['メール',d.email],['電話',d.phone||'未入力'],['希望エリア',d.area],['家賃上限',d.rent],
    ['間取り',d.layout||'指定なし'],['入居希望',d.move||'未定'],['初期費用予算',d.budget||'未定'],
    ['こだわり条件',d.features.join('、')||'指定なし'],['最優先条件',d.priority||'未定'],['その他の希望',d.notes||'なし']];
  summaryText='【お部屋探し相談・希望条件】\n'+pairs.map(([k,v])=>k+'：'+v).join('\n')+
    '\n\n物件の詳しい説明・内見・契約は提携不動産会社へ相談したいです。';
  summaryArea.value=summaryText;
  reviewSection.hidden=false;
  sendNote.textContent='「サイトから相談を送信する」を押すと、上記の内容がAIPLUNの管理画面に保存されます。LINEへは自動送信しません。';
  reviewSection.scrollIntoView({behavior:'smooth',block:'start'});
});
document.getElementById('roomBack').addEventListener('click',()=>{
  reviewSection.hidden=true;
  roomForm.scrollIntoView({behavior:'smooth',block:'start'});
});
submitButton.addEventListener('click',async()=>{
  if(savedId)return;
  submitButton.disabled=true;
  sendNote.textContent='送信処理中です。';
  try{
    const response=await fetch('/api/room',{method:'POST',credentials:'omit',cache:'no-store',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(getData())});
    const result=await response.json();
    if(!response.ok||!result.ok)throw new Error(result.error||'送信できませんでした。');
    savedId=result.id;
    submitButton.textContent='受付済み';
    sendNote.textContent='送信できました。受付番号：'+savedId+'。AIPLUNが内容を確認します。LINEへの追加送信は不要です。';
    for(const input of roomForm.elements)input.disabled=true;
  }catch(error){
    submitButton.disabled=false;
    sendNote.textContent=error.message+'　未送信のままです。LINEから相談することもできます。';
  }
});
document.getElementById('roomSend').addEventListener('click',async()=>{
  try{
    if(!navigator.clipboard?.writeText)throw new Error('clipboard');
    await navigator.clipboard.writeText(summaryText);
    if(!savedId)sendNote.textContent='相談文をコピーしました。LINEへ貼り付けて送信してください。コピーだけでは管理画面に保存されません。';
  }catch{
    summaryArea.focus();summaryArea.select();
    if(!savedId)sendNote.textContent='文章を選択しました。手動でコピーし、LINEへ送信してください。';
  }
});
