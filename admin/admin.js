(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const names = { career:'転職',rent:'賃貸・引っ越し',utility:'インフラ',sns:'SNS',direct:'直接営業',friend:'友人・知人紹介',other:'その他',unknown:'不明',intake:'相談受付',consent_wait:'同意待ち',consented:'同意取得',referred:'有効紹介',won:'成約',rewarded:'報酬確定',paid:'入金済み',lost:'見送り' };
  const money = n => new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(n || 0);
  let csrf = '', cases = [], referrers = [], audit = [], roomInquiries = [], activeRoom = null, editingCase = null, editingReferrer = null;
  function node(tag, value, className) { const n=document.createElement(tag); if (value !== undefined) n.textContent=value; if(className)n.className=className;return n; }
  function error(message) { $('global-error').textContent=message;$('global-error').hidden=!message; }
  function lock() { csrf='';cases=[];referrers=[];audit=[];roomInquiries=[];activeRoom=null;editingCase=null;editingReferrer=null;$('case-form').reset();$('referrer-form').reset();updateReferrerSelects();$('generated-link').value='';$('link-result').hidden=true;$('workspace').hidden=true;$('account').hidden=true;$('login-panel').hidden=false;for(const t of document.querySelectorAll('tbody'))t.replaceChildren();$('metrics').replaceChildren();$('referrer-list').replaceChildren();$('attention').replaceChildren();document.querySelectorAll('dialog[open]').forEach(d=>d.close()); }
  async function api(action,method='GET',data) {
    const response=await fetch('/api/admin?action='+action,{method,credentials:'same-origin',cache:'no-store',headers:method==='GET'?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf},...(data?{body:JSON.stringify(data)}:{})});
    const result=await response.json();
    if(!response.ok){if(response.status===401)lock();throw new Error(result.error || '操作を完了できませんでした。');}return result;
  }
  async function busy(button,action){button.disabled=true;try{await action();}finally{button.disabled=false;}}
  const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
  function option(select,value,label){const n=node('option',label);n.value=value;select.append(n);}
  function updateReferrerSelects(){for(const select of [$('link-referrer'),$('case-form').elements.referrerCode]){const previous=select.value;select.replaceChildren();option(select,'','紹介者なし / 不明');for(const r of referrers)if(select!==$('link-referrer')||r.active)option(select,r.code,r.name+' ('+r.code+')'+(r.active?'':' / 停止'));select.value=previous;}}
  async function load(){const results=await Promise.all([api('cases'),api('referrers'),api('audit')]);cases=results[0].cases;referrers=results[1].referrers;audit=results[2].audit;try{roomInquiries=(await api('room-inquiries')).inquiries;$('room-inbox-error').textContent='';}catch(e){roomInquiries=[];$('room-inbox-error').textContent='お部屋探し受付を読み込めません：'+e.message;}const prior=$('filter-month').value;const months=[...new Set(cases.map(c=>c.receivedAt.slice(0,7)))].sort().reverse();$('filter-month').replaceChildren();option($('filter-month'),'','すべて');months.forEach(m=>option($('filter-month'),m,m));$('filter-month').value=prior;updateReferrerSelects();render();}
  async function start(session){csrf=session.csrf;$('username').textContent=session.username;try{await load();$('login-panel').hidden=true;$('workspace').hidden=false;$('account').hidden=false;error('');}catch(e){lock();error(e.message);}}
  function filtered(){return cases.filter(c=>(!$('filter-month').value||c.receivedAt.startsWith($('filter-month').value))&&(!$('filter-category').value||c.category===$('filter-category').value)&&(!$('filter-channel').value||c.channel===$('filter-channel').value));}
  function stats(rows){return {intake:rows.length,referred:rows.filter(c=>c.referredAt).length,won:rows.filter(c=>c.wonAt).length,reward:rows.reduce((s,c)=>s+(c.rewardedAt?c.reward:0),0),paid:rows.reduce((s,c)=>s+(c.paidAt?c.reward:0),0)};}
  function tableEmpty(body,colspan,message='まだ記録がありません。'){const tr=node('tr'),td=node('td',message,'empty');td.colSpan=colspan;tr.append(td);body.append(tr);}
  function grouped(body,rows,key,label){body.replaceChildren();const groups=new Map();for(const c of rows){const k=c[key]||'';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(c);}for(const [k,rs]of groups){const st=stats(rs),tr=node('tr');for(const value of [label(k),st.intake,st.referred,st.won,money(st.reward)])tr.append(node('td',value));body.append(tr);}if(!groups.size)tableEmpty(body,5);}
  const refName=code=>referrers.find(r=>r.code===code)?.name || (code?'未登録 ('+code+')':'紹介者なし / 不明');
  function render(){const rows=filtered(),st=stats(rows);$('metrics').replaceChildren();for(const [label,value,hint]of [['相談受付',st.intake+'件','実際に届いた相談'],['有効紹介',st.referred+'件','担当者が受け付けた案件'],['成約',st.won+'件','提携先で確認済み'],['確定報酬',money(st.reward),'選択した案件・税別'],['入金済み',money(st.paid),'選択した案件・税別'],['紹介 → 成約率',st.referred?Math.round(st.won/st.referred*100)+'%':'—','成約件数 ÷ 有効紹介件数']]){const n=node('article',undefined,'metric');n.append(node('span',label),node('strong',value),node('small',hint));$('metrics').append(n);}
    grouped($('by-referrer'),rows,'referrerCode',refName);grouped($('by-channel'),rows,'channel',k=>names[k]||'不明');
    $('case-list').replaceChildren();for(const c of rows){const tr=node('tr'),first=node('td',c.label);first.append(node('small',c.receivedAt+' / '+(c.consultationId||c.id)));tr.append(first,node('td',names[c.category]));const referral=node('td',refName(c.referrerCode));referral.append(node('small',names[c.channel]+(c.source?' / '+c.source:'')));tr.append(referral);const status=node('td');status.append(node('span',names[c.stage],'badge'));tr.append(status,node('td',c.rewardedAt?money(c.reward):'未確定'));const edit=node('button','編集');edit.type='button';edit.addEventListener('click',()=>openCase(c));const cell=node('td');cell.append(edit);tr.append(cell);$('case-list').append(tr);}if(!rows.length)tableEmpty($('case-list'),6,'LINEで受け付けた相談を「案件を追加」から記録してください。');
    $('attention').replaceChildren();const needs=rows.filter(c=>c.stage==='consent_wait'||c.stage==='rewarded');for(const c of needs){const n=node('div',undefined,'attention-item');n.append(node('span',c.label+' / '+(c.stage==='consent_wait'?'同意確認待ち':'入金確認待ち')));const b=node('button','確認する');b.addEventListener('click',()=>openCase(c));n.append(b);$('attention').append(n);}if(!needs.length)$('attention').append(node('p','同意待ち・入金確認待ちの案件はありません。','sub'));
    renderRoom();
    $('referrer-list').replaceChildren();for(const r of referrers){const row=node('div',undefined,'list-row'),n=node('div',r.name);n.append(node('small',r.code+' / '+(r.active?'活動中':'停止')));const b=node('button','編集');b.addEventListener('click',()=>openReferrer(r));row.append(n,b);$('referrer-list').append(row);}if(!referrers.length)$('referrer-list').append(node('p','最初の紹介者を登録してください。','sub'));
    $('audit-list').replaceChildren();const actions={case_created:'案件追加',case_updated:'案件更新',case_deleted:'案件削除',referrer_created:'紹介者追加',referrer_updated:'紹介者更新',room_updated:'お部屋探し対応更新',room_deleted:'お部屋探し相談削除'};for(const a of audit){const tr=node('tr');for(const v of [new Date(a.created_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}),a.actor,actions[a.action]||a.action,a.entity_id,names[a.stage]||'—'])tr.append(node('td',v));$('audit-list').append(tr);}if(!audit.length)tableEmpty($('audit-list'),5);
  }

  const roomStages={new:'新規受付',contacting:'対応中',introduced:'提携先への案内済み',closed:'対応終了'};
  const roomDate=value=>new Date(value).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'});
  function renderRoom(){
    const tbody=$('room-list');tbody.replaceChildren();
    $('room-count').textContent=roomInquiries.filter(r=>r.stage==='new').length ? '('+roomInquiries.filter(r=>r.stage==='new').length+')' : '';
    for(const r of roomInquiries){
      const p=r.profile||{},tr=node('tr');
      tr.append(node('td',roomDate(r.created_at)),node('td',p.customerName||'—'),node('td',(p.area||'—')+' / '+(p.rent||'—')));
      const td=node('td');td.append(node('span',roomStages[r.stage]||r.stage,'badge'));tr.append(td);
      const button=node('button','詳細を見る');button.type='button';button.addEventListener('click',()=>openRoom(r));
      const cell=node('td');cell.append(button);tr.append(cell);tbody.append(tr);
    }
    if(!roomInquiries.length)tableEmpty(tbody,5,'サイトから送信されたお部屋探し相談はまだありません。');
  }
  function openRoom(r){
    activeRoom=r;
    $('room-dialog-id').textContent=r.id+' / '+roomDate(r.created_at);
    const p=r.profile||{},details=$('room-details');details.replaceChildren();
    const pairs=[['お名前',p.customerName],['メールアドレス',p.email],['電話番号',p.phone],['希望エリア',p.area],['家賃上限',p.rent],['希望の間取り',p.layout],['入居希望月',p.move],['初期費用の予算',p.budget],['こだわり条件',(p.features||[]).join(' / ')],['最優先条件',p.priority],['その他の希望',p.notes],['紹介者コード',p.ref],['流入経路',names[p.channel]||p.channel],['流入元',p.source],['受付への同意日時',p.consentAt]];
    for(const [label,value] of pairs){const row=node('div',undefined,'room-detail-item');row.append(node('strong',label),node('span',value||'—'));details.append(row);}
    $('room-stage').value=r.stage;$('room-dialog-error').textContent='';$('room-dialog').showModal();
  }
  $('room-stage-form').addEventListener('submit',async event=>{
    event.preventDefault();
    await busy(event.submitter,async()=>{
      try{
        await api('room-inquiries','PATCH',{id:activeRoom.id,version:activeRoom.version,stage:$('room-stage').value});
        $('room-dialog').close();await load();
      }catch(e){$('room-dialog-error').textContent=e.message;}
    });
  });
  $('room-delete').addEventListener('click',async()=>{
    if(!activeRoom||!confirm('この相談の氏名・連絡先・希望条件を削除します。復元できません。本当に削除しますか？'))return;
    await busy($('room-delete'),async()=>{
      try{await api('room-delete','POST',{id:activeRoom.id,version:activeRoom.version});$('room-dialog').close();activeRoom=null;await load();}catch(e){$('room-dialog-error').textContent=e.message;}
    });
  });
  $('room-make-case').addEventListener('click',()=>{
    if(!activeRoom)return;
    const item=activeRoom,profile=item.profile||{};
    $('room-dialog').close();
    openCase();
    $('case-form').elements.label.value='お部屋探し / '+(profile.area||'エリア未定').slice(0,35);
    $('case-form').elements.consultationId.value=item.id;
    $('case-form').elements.category.value='rent';
    $('case-form').elements.channel.value=profile.channel||'unknown';
    $('case-form').elements.source.value=profile.source||'';
    $('case-form').elements.timing.value=profile.move||'';
  });
  function openCase(c){editingCase=c||null;const form=$('case-form');form.reset();$('case-title').textContent=c?'案件を編集':'案件を追加';$('case-error').textContent='';updateReferrerSelects();for(const element of form.elements)if(element.name)element.value=c?(c[element.name]??''):({receivedAt:today(),category:'career',channel:'unknown',stage:'intake'}[element.name]??'');$('delete-case').hidden=!c;$('case-dialog').showModal();}
  function openReferrer(r){editingReferrer=r||null;const form=$('referrer-form');form.reset();$('referrer-error').textContent='';form.elements.code.readOnly=Boolean(r);if(r){form.elements.code.value=r.code;form.elements.name.value=r.name;form.elements.active.value=String(r.active);}$('referrer-dialog').showModal();}
  $('case-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.submitter;await busy(button,async()=>{try{const data=Object.fromEntries(new FormData(e.target));if(editingCase){data.id=editingCase.id;data.version=editingCase.version;}await api('cases',editingCase?'PATCH':'POST',data);$('case-dialog').close();await load();}catch(err){$('case-error').textContent=err.message;}});});
  $('referrer-form').addEventListener('submit',async e=>{e.preventDefault();await busy(e.submitter,async()=>{try{const data=Object.fromEntries(new FormData(e.target));data.active=data.active==='true';if(editingReferrer)data.version=editingReferrer.version;await api('referrers',editingReferrer?'PATCH':'POST',data);$('referrer-dialog').close();await load();}catch(err){$('referrer-error').textContent=err.message;}});});
  $('delete-case').addEventListener('click',async()=>{if(!editingCase||!confirm('この案件の記録を削除します。元に戻せません。操作履歴の案件IDは残ります。削除しますか？'))return;await busy($('delete-case'),async()=>{try{await api('delete','POST',{id:editingCase.id,version:editingCase.version});$('case-dialog').close();await load();}catch(e){$('case-error').textContent=e.message;}});});
  $('login-form').addEventListener('submit',async e=>{e.preventDefault();await busy(e.submitter,async()=>{try{$('login-error').textContent='';const result=await api('login','POST',Object.fromEntries(new FormData(e.target)));e.target.reset();await start(result);}catch(err){$('login-error').textContent=err.message;}});});
  $('logout').addEventListener('click',async()=>{try{await api('logout','POST',{});lock();}catch(e){error(e.message);}});
  $('reload').addEventListener('click',async()=>{await busy($('reload'),async()=>{try{await load();error('');}catch(e){error(e.message);}});});
  for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{for(const t of document.querySelectorAll('[data-view]'))t.setAttribute('aria-pressed',String(t===b));for(const p of document.querySelectorAll('[data-panel]'))p.hidden=p.dataset.panel!==b.dataset.view;document.querySelector('.filters').hidden=['room','referrers','history'].includes(b.dataset.view);});
  for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>$(b.dataset.close).close());
  for(const id of ['filter-month','filter-category','filter-channel'])$(id).addEventListener('change',render);
  $('new-case').addEventListener('click',()=>openCase());$('new-referrer').addEventListener('click',()=>openReferrer());
  $('export').addEventListener('click',async()=>{await busy($('export'),async()=>{try{const response=await fetch('/api/admin?action=export',{credentials:'same-origin',cache:'no-store'});if(!response.ok){const data=await response.json();throw new Error(data.error);}const blob=await response.blob(),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='aiplun-cases-'+today()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){error(e.message);}});});
  const base=new URL('../index.html',location.href);base.search='';const share=new URL(location.href).searchParams.get('_vercel_share');if(share)base.searchParams.set('_vercel_share',share);$('link-base').value=base.href;
  $('link-form').addEventListener('submit',e=>{e.preventDefault();try{const base=new URL($('link-base').value);if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1'].includes(base.hostname)))throw Error('HTTPSの相談サイトURLを入力してください。');if(base.username||base.password)throw Error('URLにログイン情報を含めないでください。');const url=new URL($('link-page').value,base);url.search='';const share=base.searchParams.get('_vercel_share');if(share)url.searchParams.set('_vercel_share',share);if($('link-referrer').value)url.searchParams.set('ref',$('link-referrer').value);url.searchParams.set('channel',$('link-channel').value);const source=$('link-source').value;if(source&&!/^[a-zA-Z0-9_-]{1,40}$/.test(source))throw Error('流入元は英数字・ハイフン・アンダースコアで入力してください。');if(source)url.searchParams.set('utm_source',source);$('generated-link').value=url.href;$('link-result').hidden=false;$('link-status').textContent='紹介者と経路を分けたリンクができました。';}catch(err){error(err.message);}});
  $('copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('generated-link').value);$('link-status').textContent='コピーしました。紹介者へ共有してください。';}catch{$('generated-link').select();$('link-status').textContent='リンクを選択しました。手動でコピーしてください。';}});
  api('session').then(result=>result.authenticated?start(result):null).catch(e=>{$('setup-notice').hidden=false;$('setup-notice').textContent=e.message;for(const el of $('login-form').elements)el.disabled=true;});
})();
