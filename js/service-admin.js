const main=document.querySelector('#serviceMain'),toastElement=document.querySelector('#toast');
let tenants=[],serviceEmail='',passcodeState=null;
main.addEventListener('click',authAction);
initialize();

async function initialize(){
  try{
    const auth=await api('/api/service/passcode');serviceEmail=auth.user.email;passcodeState=auth.passcode;
    if(!auth.passcode.verified){renderPasscodeGate();return}
    await loadTenants();
  }catch(error){error.code==='authentication_required'?renderLogin():renderFailure(error.message)}
}

async function loadTenants(){const data=await api('/api/service/tenants');tenants=data.tenants;serviceEmail=data.user.email;render()}

function render(){
  main.innerHTML=`<section class="screen"><div class="screen-header"><p class="eyebrow">サービス運営者専用</p><h1>利用契約の管理</h1><p class="screen-intro">試験利用または期限のない本番利用として業者を登録します。</p></div><div class="card stack"><h2>ログインとパスコード</h2><p class="hint">ログイン中：${escapeHtml(serviceEmail)}</p><p class="hint">メール確認と登録者専用パスコードで保護されています。ログイン状態は24時間有効です。</p><div class="tool-row"><button class="button secondary" data-action="change-passcode" type="button">パスコードを変更</button><button class="button ghost" data-action="logout" type="button">ログアウト</button></div></div><form id="tenantForm" class="card stack"><h2>新しい業者を登録</h2><div class="field"><label for="companyName">会社名</label><input id="companyName" name="companyName" required maxlength="200"></div><div class="field"><label for="vendorEmail">業者ログイン用メール</label><input id="vendorEmail" name="vendorEmail" type="email" required></div><div class="field"><label for="licensePlan">利用区分</label><select id="licensePlan" name="licensePlan"><option value="trial:7">試験利用・7日</option><option value="trial:14">試験利用・14日</option><option value="trial:30" selected>試験利用・30日</option><option value="production">本番利用・期限なし</option></select></div><button class="button" type="submit">業者を登録してURLを発行</button></form><div class="section stack" id="tenantList">${tenantCards()}</div></section>`;
  document.querySelector('#tenantForm').addEventListener('submit',createTenant);
  document.querySelector('#tenantList').addEventListener('click',tenantAction);
}

function renderPasscodeGate(){
  const resetRequested=new URL(location.href).searchParams.get('resetPasscode')==='1',mode=resetRequested?'reset':passcodeState?.configured?'verify':'register';
  if(mode==='reset'&&!passcodeState?.resetAllowed){main.innerHTML=`<section class="screen"><div class="card stack empty-state"><p class="eyebrow">サービス運営者専用</p><h1>メール確認をもう一度行ってください</h1><p>安全に再設定するため、一度ログアウトして登録メールアドレスへ新しい確認コードを送信します。</p><button class="button" data-action="reset-help" type="button">再設定手順を開く</button></div></section>`;return}
  const title=mode==='reset'?'パスコードを再設定':mode==='verify'?'パスコードを入力':'パスコードを登録';
  const intro=mode==='reset'?'メール確認が完了しました。新しいパスコードを登録してください。':mode==='verify'?'登録済みのパスコードを入力してください。':'初回利用のため、運営者専用パスコードを設定してください。';
  main.innerHTML=`<section class="screen"><div class="screen-header"><p class="eyebrow">サービス運営者専用</p><h1>${title}</h1><p class="screen-intro">${intro}</p><p class="hint">登録メール：${escapeHtml(serviceEmail)}</p></div><form id="passcodeForm" class="card stack"><input type="hidden" name="action" value="${mode}"><div class="field"><label for="servicePasscode">${mode==='verify'?'パスコード':'新しいパスコード'}</label><input id="servicePasscode" name="passcode" type="password" inputmode="numeric" pattern="[0-9]*" minlength="6" maxlength="8" autocomplete="${mode==='verify'?'current-password':'new-password'}" required><p class="hint">6〜8桁の数字。123456や同じ数字の繰り返しは使用できません。</p></div>${mode==='verify'?'':`<div class="field"><label for="servicePasscodeConfirm">新しいパスコード（確認）</label><input id="servicePasscodeConfirm" name="confirmation" type="password" inputmode="numeric" pattern="[0-9]*" minlength="6" maxlength="8" autocomplete="new-password" required></div>`}<p class="error" id="passcodeError" hidden></p><button class="button" type="submit">${mode==='verify'?'確認して管理画面を開く':'登録して管理画面を開く'}</button>${mode==='verify'?'<button class="button ghost" data-action="reset-help" type="button">パスコードを忘れた場合</button>':''}</form><div class="card"><h2>確認コードが届かない場合</h2><p class="hint">メール確認画面でコードを再送してください。新しいコードを発行すると古いコードは無効になります。迷惑メールフォルダと noreply@notify.cloudflare.com の受信設定も確認してください。</p></div></section>`;
  document.querySelector('#passcodeForm').addEventListener('submit',submitPasscode);
}

async function submitPasscode(event){
  event.preventDefault();const form=event.currentTarget,data=Object.fromEntries(new FormData(form)),button=form.querySelector('button[type="submit"]'),error=document.querySelector('#passcodeError');
  if(!/^\d{6,8}$/.test(data.passcode)){showError(error,'パスコードは6〜8桁の数字で入力してください。');return}
  if(data.confirmation!==undefined&&data.passcode!==data.confirmation){showError(error,'確認用パスコードが一致しません。');return}
  button.disabled=true;try{await api('/api/service/passcode',{method:'POST',body:{action:data.action,passcode:data.passcode}});const url=new URL(location.href);url.searchParams.delete('resetPasscode');history.replaceState(null,'',url);await loadTenants();toast(data.action==='verify'?'ログインしました。':'パスコードを登録しました。')}catch(caught){showError(error,caught.message)}finally{button.disabled=false}
}

async function authAction(event){
  const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;
  if(action==='reset-help')showResetHelp();
  if(action==='change-passcode')showChangePasscode();
  if(action==='logout')await logout();
}

function showResetHelp(){showDialog('パスコードを再設定',`<ol><li>下のボタンで再設定用URLをコピーしてログアウトします。</li><li>コピーしたURLを開きます。</li><li>登録メールアドレスを入力し、新しい確認コードで認証します。</li><li>新しいパスコードを登録します。</li></ol><p class="hint">確認コードが届かない場合は、認証画面から再送してください。</p>`,'URLをコピーしてログアウト',async()=>{const url=new URL('/service.html',location.origin);url.searchParams.set('resetPasscode','1');try{await copyText(url.toString());await api('/api/service/passcode',{method:'DELETE'});location.href='/cdn-cgi/access/logout'}catch{toast('再設定用URLをコピーできませんでした。')}})}

function showChangePasscode(){showDialog('パスコードを変更','<div class="field"><label for="currentPasscode">現在のパスコード</label><input id="currentPasscode" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password"></div><div class="field"><label for="newPasscode">新しいパスコード</label><input id="newPasscode" type="password" inputmode="numeric" minlength="6" maxlength="8" autocomplete="new-password"></div><div class="field"><label for="newPasscodeConfirm">新しいパスコード（確認）</label><input id="newPasscodeConfirm" type="password" inputmode="numeric" minlength="6" maxlength="8" autocomplete="new-password"></div><p class="error" id="dialogError" hidden></p>','変更する',async()=>{const current=document.querySelector('#currentPasscode').value.trim(),next=document.querySelector('#newPasscode').value.trim(),confirmation=document.querySelector('#newPasscodeConfirm').value.trim(),error=document.querySelector('#dialogError'),button=document.querySelector('#dialogSave');if(!/^\d{6,8}$/.test(next)){showError(error,'新しいパスコードは6〜8桁の数字で入力してください。');return}if(next!==confirmation){showError(error,'確認用パスコードが一致しません。');return}button.disabled=true;try{await api('/api/service/passcode',{method:'POST',body:{action:'change',currentPasscode:current,newPasscode:next}});closeDialog();toast('パスコードを変更しました。')}catch(caught){showError(error,caught.message)}finally{button.disabled=false}})}

async function logout(){try{await api('/api/service/passcode',{method:'DELETE'})}finally{location.href='/cdn-cgi/access/logout'}}

function tenantCards(){
  if(!tenants.length)return '<div class="card empty-state"><h2>登録業者はありません</h2></div>';
  return tenants.map(tenant=>{const url=customerUrl(tenant.id),production=tenant.licenseType==='production',stateButton=tenant.state==='active'?`<button class="button danger small" data-action="suspend" data-id="${tenant.id}">利用停止</button>`:tenant.state==='suspended'?`<button class="button secondary small" data-action="resume" data-id="${tenant.id}">利用再開</button>`:'';return `<article class="card stack"><div class="history-head"><div><h2>${escapeHtml(tenant.companyName)}</h2><p>${escapeHtml(tenant.vendorEmail)}</p></div><span class="status">${stateLabel(tenant.state)}</span></div><dl class="summary-list"><div class="summary-row"><dt>利用区分</dt><dd>${production?'本番利用':'試験利用'}</dd></div><div class="summary-row"><dt>利用期間</dt><dd>${production?'期限なし':`${tenant.trialDays}日`}</dd></div>${production?'':`<div class="summary-row"><dt>終了日時</dt><dd>${formatDate(tenant.expiresAt)}</dd></div>`}<div class="summary-row"><dt>お客様用URL</dt><dd><code>${escapeHtml(url)}</code></dd></div></dl><div class="tool-row"><button class="button secondary small" data-action="copy" data-id="${tenant.id}">URLをコピー</button><button class="button ghost small" data-action="extend" data-days="7" data-id="${tenant.id}">7日試験</button><button class="button ghost small" data-action="extend" data-days="14" data-id="${tenant.id}">14日試験</button><button class="button ghost small" data-action="extend" data-days="30" data-id="${tenant.id}">30日試験</button>${production?'':`<button class="button small" data-action="production" data-id="${tenant.id}">本番へ切替</button>`}${stateButton}</div></article>`}).join('');
}

async function createTenant(event){event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]'),data=Object.fromEntries(new FormData(form)),production=data.licensePlan==='production',trialDays=production?30:Number(data.licensePlan.split(':')[1]);button.disabled=true;try{const result=await api('/api/service/tenants',{method:'POST',body:{companyName:data.companyName,vendorEmail:data.vendorEmail,licenseType:production?'production':'trial',trialDays}});tenants.unshift(result.tenant);render();await copyText(customerUrl(result.tenant.id));toast('業者を登録し、お客様用URLをコピーしました。')}catch(error){toast(error.message)}finally{button.disabled=false}}

async function tenantAction(event){
  const button=event.target.closest('[data-action]');if(!button)return;const tenant=tenants.find(item=>item.id===button.dataset.id);if(!tenant)return;
  if(button.dataset.action==='copy'){try{await copyText(customerUrl(tenant.id));toast('お客様用URLをコピーしました。')}catch{toast('URLをコピーできませんでした。')}return}
  if(button.dataset.action==='suspend'&&!confirm(`${tenant.companyName}の利用を停止しますか？`))return;
  if(button.dataset.action==='extend'&&!confirm(`${tenant.companyName}の試験期間を本日から${button.dataset.days}日で再発行しますか？`))return;
  if(button.dataset.action==='production'&&!confirm(`${tenant.companyName}を期限のない本番利用へ切り替えますか？`))return;
  button.disabled=true;try{const body={id:tenant.id};if(button.dataset.action==='extend')body.trialDays=Number(button.dataset.days);if(button.dataset.action==='production')body.licenseType='production';if(button.dataset.action==='suspend')body.status='suspended';if(button.dataset.action==='resume')body.status='active';const result=await api('/api/service/tenants',{method:'PATCH',body});tenants=tenants.map(item=>item.id===tenant.id?result.tenant:item);document.querySelector('#tenantList').innerHTML=tenantCards();toast('利用情報を更新しました。')}catch(error){toast(error.message)}finally{button.disabled=false}
}

function renderLogin(){const url=new URL('/api/service/login',location.origin);if(new URL(location.href).searchParams.get('resetPasscode')==='1')url.searchParams.set('resetPasscode','1');main.innerHTML=`<section class="screen"><div class="card empty-state"><h1>運営者ログインが必要です</h1><p>登録メールアドレスへ確認コードを送信します。</p><p class="hint">届かない場合は認証画面から再送し、迷惑メールフォルダも確認してください。</p><p><a class="button" href="${url}">メール確認へ進む</a></p></div></section>`}
function renderFailure(message){main.innerHTML=`<section class="screen"><div class="card empty-state"><h1>管理画面を開けません</h1><p>${escapeHtml(message)}</p></div></section>`}
function showError(element,message){element.textContent=message;element.hidden=false}
function showDialog(title,body,saveLabel,onSave){document.querySelector('#modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dialogTitle"><h2 id="dialogTitle">${escapeHtml(title)}</h2><div>${body}</div><div class="modal-actions section"><button class="button" id="dialogSave" type="button">${escapeHtml(saveLabel)}</button><button class="button secondary" id="dialogClose" type="button">閉じる</button></div></div></div>`;document.querySelector('#dialogSave').onclick=onSave;document.querySelector('#dialogClose').onclick=closeDialog}
function closeDialog(){document.querySelector('#modalRoot').innerHTML=''}
async function api(path,{method='GET',body}={}){let response;try{response=await fetch(path,{method,credentials:'same-origin',headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined})}catch{throw apiError('network_error','通信できません。時間をおいて再度お試しください。')}const type=response.headers.get('content-type')||'';if(!type.includes('application/json'))throw apiError('authentication_required','メール確認が必要です。');const data=await response.json();if(!response.ok||!data.ok)throw apiError(data.error?.code||'request_failed',data.error?.message||'処理できませんでした。');return data}
function apiError(code,message){const error=new Error(message);error.code=code;return error}
const customerUrl=id=>`${location.origin}/?t=${encodeURIComponent(id)}`;
const stateLabel=state=>({active:'利用中',expired:'期限終了',suspended:'停止中',invalid:'要確認'}[state]||'未確認');
const formatDate=value=>new Intl.DateTimeFormat('ja-JP',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tokyo'}).format(new Date(value));
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function copyText(text){if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(text);const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();if(!ok)throw new Error()}
function toast(message){toastElement.textContent=message;toastElement.hidden=false;clearTimeout(toast.id);toast.id=setTimeout(()=>toastElement.hidden=true,3200)}
