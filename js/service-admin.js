const main=document.querySelector('#serviceMain'),toastElement=document.querySelector('#toast');
let tenants=[],serviceEmail='';
initialize();

async function initialize(){
  try{const data=await api('/api/service/tenants');tenants=data.tenants;serviceEmail=data.user.email;render()}
  catch(error){renderLogin(error.message)}
}

function render(){
  main.innerHTML=`<section class="screen"><div class="screen-header"><p class="eyebrow">サービス運営者専用</p><h1>試験利用の管理</h1><p class="screen-intro">業者を登録し、7日・14日・30日の利用期間を発行します。</p><p class="hint">ログイン中：${escapeHtml(serviceEmail)}</p></div><form id="tenantForm" class="card stack"><h2>新しい業者を登録</h2><div class="field"><label for="companyName">会社名</label><input id="companyName" name="companyName" required maxlength="200"></div><div class="field"><label for="vendorEmail">業者ログイン用メール</label><input id="vendorEmail" name="vendorEmail" type="email" required></div><div class="field"><label for="trialDays">試験利用期間</label><select id="trialDays" name="trialDays"><option value="7">7日</option><option value="14">14日</option><option value="30" selected>30日</option></select></div><button class="button" type="submit">業者を登録してURLを発行</button></form><div class="section stack" id="tenantList">${tenantCards()}</div></section>`;
  document.querySelector('#tenantForm').addEventListener('submit',createTenant);
  document.querySelector('#tenantList').addEventListener('click',tenantAction);
}

function tenantCards(){
  if(!tenants.length)return '<div class="card empty-state"><h2>登録業者はありません</h2></div>';
  return tenants.map(tenant=>{const url=customerUrl(tenant.id),stateButton=tenant.state==='active'?`<button class="button danger small" data-action="suspend" data-id="${tenant.id}">利用停止</button>`:tenant.state==='suspended'?`<button class="button secondary small" data-action="resume" data-id="${tenant.id}">利用再開</button>`:'';return `<article class="card stack"><div class="history-head"><div><h2>${escapeHtml(tenant.companyName)}</h2><p>${escapeHtml(tenant.vendorEmail)}</p></div><span class="status">${stateLabel(tenant.state)}</span></div><dl class="summary-list"><div class="summary-row"><dt>利用期間</dt><dd>${tenant.trialDays}日</dd></div><div class="summary-row"><dt>終了日時</dt><dd>${formatDate(tenant.expiresAt)}</dd></div><div class="summary-row"><dt>お客様用URL</dt><dd><code>${escapeHtml(url)}</code></dd></div></dl><div class="tool-row"><button class="button secondary small" data-action="copy" data-id="${tenant.id}">URLをコピー</button><button class="button ghost small" data-action="extend" data-days="7" data-id="${tenant.id}">7日で再発行</button><button class="button ghost small" data-action="extend" data-days="14" data-id="${tenant.id}">14日で再発行</button><button class="button ghost small" data-action="extend" data-days="30" data-id="${tenant.id}">30日で再発行</button>${stateButton}</div></article>`}).join('');
}

async function createTenant(event){
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]'),data=Object.fromEntries(new FormData(form));button.disabled=true;
  try{const result=await api('/api/service/tenants',{method:'POST',body:{...data,trialDays:Number(data.trialDays)}});tenants.unshift(result.tenant);render();await copyText(customerUrl(result.tenant.id));toast('業者を登録し、お客様用URLをコピーしました。')}
  catch(error){toast(error.message)}finally{button.disabled=false}
}

async function tenantAction(event){
  const button=event.target.closest('[data-action]');if(!button)return;const tenant=tenants.find(item=>item.id===button.dataset.id);if(!tenant)return;
  if(button.dataset.action==='copy'){try{await copyText(customerUrl(tenant.id));toast('お客様用URLをコピーしました。')}catch{toast('URLをコピーできませんでした。')}return}
  if(button.dataset.action==='suspend'&&!confirm(`${tenant.companyName}の利用を停止しますか？`))return;
  if(button.dataset.action==='extend'&&!confirm(`${tenant.companyName}の試験期間を本日から${button.dataset.days}日で再発行しますか？`))return;
  button.disabled=true;
  try{const body={id:tenant.id};if(button.dataset.action==='extend')body.trialDays=Number(button.dataset.days);if(button.dataset.action==='suspend')body.status='suspended';if(button.dataset.action==='resume')body.status='active';const result=await api('/api/service/tenants',{method:'PATCH',body});tenants=tenants.map(item=>item.id===tenant.id?result.tenant:item);document.querySelector('#tenantList').innerHTML=tenantCards();toast('利用情報を更新しました。')}
  catch(error){toast(error.message)}finally{button.disabled=false}
}

function renderLogin(message){main.innerHTML=`<section class="screen"><div class="card empty-state"><h1>運営者ログインが必要です</h1><p>${escapeHtml(message||'登録したメールアドレスへ確認コードを送信します。')}</p><p><a class="button" href="/api/service/login">メール確認へ進む</a></p></div></section>`}
async function api(path,{method='GET',body}={}){let response;try{response=await fetch(path,{method,credentials:'same-origin',headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined})}catch{throw new Error('通信できません。時間をおいて再度お試しください。')}const type=response.headers.get('content-type')||'';if(!type.includes('application/json'))throw new Error('メール確認が必要です。');const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error?.message||'処理できませんでした。');return data}
const customerUrl=id=>`${location.origin}/?t=${encodeURIComponent(id)}`;
const stateLabel=state=>({active:'利用中',expired:'期限終了',suspended:'停止中',invalid:'要確認'}[state]||'未確認');
const formatDate=value=>new Intl.DateTimeFormat('ja-JP',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tokyo'}).format(new Date(value));
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function copyText(text){if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(text);const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();if(!ok)throw new Error()}
function toast(message){toastElement.textContent=message;toastElement.hidden=false;clearTimeout(toast.id);toast.id=setTimeout(()=>toastElement.hidden=true,3200)}
