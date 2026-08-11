const main=document.querySelector('#serviceMain'),toastElement=document.querySelector('#toast');
let tenants=[],applications=[],productionRequests=[],serviceEmail='',passcodeState=null,emailConfigured=false;
main.addEventListener('click',authAction);
initialize();

async function initialize(){
  try{
    const auth=await api('/api/service/passcode');serviceEmail=auth.user.email;passcodeState=auth.passcode;
    if(!auth.passcode.verified){renderPasscodeGate();return}
    await loadTenants();
  }catch(error){['authentication_required','network_error'].includes(error.code)?renderLogin():renderFailure(error.message)}
}

async function loadTenants(){const [data,onboarding]=await Promise.all([api('/api/service/tenants'),api('/api/service/applications')]);tenants=data.tenants;applications=onboarding.applications;productionRequests=onboarding.productionRequests;emailConfigured=Boolean(onboarding.emailConfigured);serviceEmail=data.user.email;render()}

function render(){
  main.innerHTML=`<section class="screen"><div class="screen-header"><p class="eyebrow">サービス運営者専用</p><h1>利用契約の管理</h1><p class="screen-intro">試験利用または期限のない本番利用として業者を登録します。</p></div><div class="card stack"><h2>ログインと運営者メール</h2><p class="hint">ログインID・申込通知先：${escapeHtml(serviceEmail)}</p><p class="hint">ログインIDと無料体験申込の通知先を同じメールアドレスで管理します。変更時は現在のパスコードと新しいメールの確認コードが必要です。</p><div class="tool-row"><button class="button secondary" data-action="change-passcode" type="button">パスコードを変更</button><button class="button secondary" data-action="change-service-email" type="button">運営者メールを変更</button><button class="button ghost" data-action="logout" type="button">ログアウト</button></div></div><details class="card admin-collapsible" id="manualTenantRegistration"><summary><span><small>補助操作</small><strong>業者を手動登録する</strong></span><span class="status">通常は不要</span></summary><form id="tenantForm" class="stack admin-collapsible__body"><p class="hint">Web申込を使わず、運営者が直接登録する場合に使用します。</p><div class="field"><label for="companyName">会社名</label><input id="companyName" name="companyName" required maxlength="200"></div><div class="field"><label for="vendorEmail">業者ログイン用メール</label><input id="vendorEmail" name="vendorEmail" type="email" required></div><div class="field"><label for="licensePlan">利用区分</label><select id="licensePlan" name="licensePlan"><option value="trial:7">試験利用・7日</option><option value="trial:14">試験利用・14日</option><option value="trial:30" selected>試験利用・30日</option><option value="production">本番利用・期限なし</option></select></div><button class="button" type="submit">業者を登録してURLを発行</button></form></details><div class="screen-header section"><p class="eyebrow">利用管理</p><h2>登録業者・試験利用者</h2><p class="hint">一覧は折り畳まれています。会社名を選択すると設定と管理操作を表示します。</p></div><div class="section stack" id="tenantList">${tenantCards()}</div></section>`;
  document.querySelector('#tenantForm').addEventListener('submit',createTenant);
  document.querySelector('#tenantList').addEventListener('click',tenantAction);
  renderOnboardingSections();
}

function renderOnboardingSections(){
  const list=document.querySelector('#tenantList');if(!list)return;
  const pending=applications.filter(item=>item.status==='pending').length,productionPending=productionRequests.filter(item=>item.status==='requested').length;
  const automationTitle=emailConfigured?'メール確認後に自動承認':'自動承認のメール設定が必要',automationText=emailConfigured?'申込者が本人確認リンクを開くと、7日間の専用URLを自動発行して案内メールを送信します。運営者による切り替え操作は不要です。':'現在は案内メールを送信できないため、申込を確認して手動承認・URL発行をご利用ください。メール送信サービスの設定後は自動承認へ切り替わります。';
  const wrapper=document.createElement('div');wrapper.className='stack section';wrapper.id='onboardingSections';wrapper.innerHTML=`<div class="card automation-status ${emailConfigured?'':'automation-status--warning'}"><div><p class="eyebrow">標準の受付方法</p><h2>${automationTitle}</h2><p>${automationText}</p></div><span class="status ${emailConfigured?'status--active':'status--warning'}">${emailConfigured?'自動承認':'要メール設定'}</span></div><details class="card admin-collapsible"><summary><span><small>Web申込</small><strong>無料体験の申込者</strong></span><span class="status">${pending?`${pending}件対応待ち`:`${applications.length}件`}</span></summary><div class="admin-collapsible__body">${applicationRows()}</div></details><details class="card admin-collapsible"><summary><span><small>確認・承認</small><strong>本番利用の申込</strong></span><span class="status">${productionPending}件待ち</span></summary><div class="admin-collapsible__body">${productionRequestRows()}</div></details>`;
  wrapper.addEventListener('click',onboardingAction);const manual=document.querySelector('#manualTenantRegistration');(manual||list).before(wrapper);
}

function applicationRows(){
  if(!applications.length)return '<p class="hint">Webからの申込はまだありません。</p>';
  return `<div class="admin-records">${applications.map(item=>`<details class="admin-record"><summary><span><strong>${escapeHtml(item.companyName)}</strong><small>${escapeHtml(item.email)}</small></span><span class="status">${applicationStateLabel(item.status)}</span></summary><div class="admin-record__body"><dl class="summary-list"><div class="summary-row"><dt>担当者</dt><dd>${escapeHtml(item.contactName)}</dd></div><div class="summary-row"><dt>電話番号</dt><dd>${escapeHtml(item.phone)}</dd></div><div class="summary-row"><dt>申込日時</dt><dd>${formatDate(item.createdAt)}</dd></div>${item.tenantId?`<div class="summary-row"><dt>業者識別番号</dt><dd><code>${escapeHtml(item.tenantId)}</code></dd></div>`:''}</dl>${item.status==='pending'?`<details class="auxiliary-actions"><summary>メール障害時の補助操作</summary><p class="hint">通常は申込者のメール確認後に自動承認されます。申込者から未着の連絡があった場合のみ再送し、メールを利用できない場合だけ手動承認してください。</p><div class="tool-row"><button class="button secondary small" data-onboarding-action="resend-verification" data-id="${item.id}">本人確認メールを再送</button><button class="button ghost small" data-onboarding-action="approve-trial" data-id="${item.id}">手動承認・URL発行</button></div></details><button class="button danger small" data-onboarding-action="delete-application" data-id="${item.id}">未発行の申込を削除</button>`:''}</div></details>`).join('')}</div>`;
}

function productionRequestRows(){
  if(!productionRequests.length)return '<p class="hint">本番利用の申込はまだありません。</p>';
  return `<div class="admin-records">${productionRequests.map(item=>`<details class="admin-record"><summary><span><strong>${escapeHtml(item.companyName)}</strong><small>${escapeHtml(item.vendorEmail)}</small></span><span class="status">${productionStateLabel(item.status)}</span></summary><div class="admin-record__body"><p>申込者：${escapeHtml(item.applicantName)}</p><p class="hint">申込日時：${formatDate(item.requestedAt)}</p>${item.note?`<p>${escapeHtml(item.note)}</p>`:''}${item.status==='requested'?`<div class="tool-row"><button class="button small" data-onboarding-action="approve-production" data-id="${item.tenantId}">本番利用を承認</button><button class="button secondary small" data-onboarding-action="decline-production" data-id="${item.tenantId}">見送る</button></div>`:''}</div></details>`).join('')}</div>`;
}

async function onboardingAction(event){
  const button=event.target.closest('[data-onboarding-action]');if(!button)return;const action=button.dataset.onboardingAction;
  if(action==='delete-application'){
    const application=applications.find(item=>item.id===button.dataset.id);if(!application||!confirm(`${application.companyName}の未発行申込を削除しますか？この操作は元に戻せません。`))return;
    button.disabled=true;try{await api('/api/service/applications',{method:'DELETE',body:{applicationId:application.id}});await loadTenants();toast('未発行の申込を削除しました。')}catch(error){toast(error.message)}finally{button.disabled=false}return;
  }
  if(action==='approve-trial'||action==='resend-verification'){
    const application=applications.find(item=>item.id===button.dataset.id);if(!application)return;
    if(action==='approve-trial'&&!confirm(`${application.companyName}をメール確認前に手動承認し、7日間の専用URLを発行しますか？`))return;
    button.disabled=true;try{const result=await api('/api/service/applications',{method:'PATCH',body:{applicationId:application.id,action}});if(action==='approve-trial')showIssuedTrial(result);await loadTenants();toast(action==='resend-verification'?'本人確認メールを再送しました。申込者へ受信確認をご案内ください。':result.emailSent?'手動承認し、案内メールを送信しました。':'手動承認しました。表示されたURLを申込者へ直接ご案内ください。')}catch(error){toast(action==='resend-verification'&&['email_not_configured','email_delivery_failed'].includes(error.code)?'メールを再送できません。手動承認・URL発行をご利用ください。':error.message)}finally{button.disabled=false}return;
  }
  const request=productionRequests.find(item=>item.tenantId===button.dataset.id);if(!request)return;
  const confirmText=action==='approve-production'?`${request.companyName}を期限なしの本番利用へ切り替えますか？`:`${request.companyName}の本番利用申込を見送りますか？`;if(!confirm(confirmText))return;
  button.disabled=true;try{await api('/api/service/applications',{method:'PATCH',body:{tenantId:request.tenantId,action}});await loadTenants();toast(action==='approve-production'?'本番利用へ切り替えました。':'申込状態を更新しました。')}catch(error){toast(error.message)}finally{button.disabled=false}
}

function showIssuedTrial(result){showDialog('無料体験URLを発行しました',`<p>${result.emailSent?'申込者へ案内メールを送信しました。':'案内メールを送信できませんでした。以下のURLをコピーして申込者へお送りください。'}</p><div class="url-panel"><strong>業者設定URL</strong><code>${escapeHtml(result.adminUrl)}</code><button class="button secondary small" id="copyIssuedAdmin" type="button">コピー</button></div><div class="url-panel"><strong>お客様用URL</strong><code>${escapeHtml(result.customerUrl)}</code><button class="button secondary small" id="copyIssuedCustomer" type="button">コピー</button></div>`,'閉じる',closeDialog);document.querySelector('#copyIssuedAdmin').onclick=()=>copyText(result.adminUrl).then(()=>toast('業者設定URLをコピーしました。'));document.querySelector('#copyIssuedCustomer').onclick=()=>copyText(result.customerUrl).then(()=>toast('お客様用URLをコピーしました。'))}

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
  if(action==='change-service-email')showServiceEmailChange();
  if(action==='logout')await logout();
}

function showServiceEmailChange(){showDialog('運営者メールを変更',`<p>ログインIDと無料体験申込の通知先を同時に変更します。</p><div class="field"><label for="newServiceEmail">新しいメールアドレス</label><input id="newServiceEmail" type="email" autocomplete="email" required></div><div class="field"><label for="serviceEmailPasscode">現在のパスコード</label><input id="serviceEmailPasscode" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password" required></div><p class="hint">新しいメールへ6桁の確認コードを送信します。確認完了後、次回から新しいメールでログインします。</p><p class="error" id="dialogError" hidden></p>`,'確認コードを送信',requestServiceEmailChange)}

async function requestServiceEmailChange(){const email=document.querySelector('#newServiceEmail'),passcode=document.querySelector('#serviceEmailPasscode'),error=document.querySelector('#dialogError'),button=document.querySelector('#dialogSave');if(!email.value.trim()||!passcode.value.trim()){showError(error,'新しいメールアドレスと現在のパスコードを入力してください。');return}button.disabled=true;try{const result=await api('/api/service/email',{method:'POST',body:{action:'request',newEmail:email.value.trim(),currentPasscode:passcode.value.trim()}});document.querySelector('.modal>div').innerHTML=`<p><strong>${escapeHtml(result.newEmail)}</strong>へ確認コードを送信しました。</p><div class="field"><label for="serviceEmailCode">6桁の確認コード</label><input id="serviceEmailCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div><p class="error" id="dialogError" hidden></p>`;button.textContent='変更を確定';button.disabled=false;button.onclick=()=>confirmServiceEmailChange(result.requestId)}catch(caught){showError(error,caught.message);button.disabled=false}}

async function confirmServiceEmailChange(requestId){const code=document.querySelector('#serviceEmailCode'),error=document.querySelector('#dialogError'),button=document.querySelector('#dialogSave');if(!/^\d{6}$/.test(code.value.trim())){showError(error,'6桁の確認コードを入力してください。');return}button.disabled=true;try{const result=await api('/api/service/email',{method:'POST',body:{action:'confirm',requestId,code:code.value.trim()}});document.querySelector('.modal').innerHTML=`<h2>運営者メールを変更しました</h2><p>${escapeHtml(result.email)}を、次回からのログインIDと申込通知先に使用します。</p><p>安全のため現在のログインを終了します。</p><p><a class="button" href="/cdn-cgi/access/logout">ログアウトして新しいメールで確認</a></p>`}catch(caught){showError(error,caught.message);button.disabled=false}}

function showResetHelp(){showDialog('パスコードを再設定',`<ol><li>下のボタンで再設定用URLをコピーしてログアウトします。</li><li>コピーしたURLを開きます。</li><li>登録メールアドレスを入力し、新しい確認コードで認証します。</li><li>新しいパスコードを登録します。</li></ol><p class="hint">確認コードが届かない場合は、認証画面から再送してください。</p>`,'URLをコピーしてログアウト',async()=>{const url=new URL('/service.html',location.origin);url.searchParams.set('resetPasscode','1');try{await copyText(url.toString());await api('/api/service/passcode',{method:'DELETE'});location.href='/cdn-cgi/access/logout'}catch{toast('再設定用URLをコピーできませんでした。')}})}

function showChangePasscode(){showDialog('パスコードを変更','<div class="field"><label for="currentPasscode">現在のパスコード</label><input id="currentPasscode" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password"></div><div class="field"><label for="newPasscode">新しいパスコード</label><input id="newPasscode" type="password" inputmode="numeric" minlength="6" maxlength="8" autocomplete="new-password"></div><div class="field"><label for="newPasscodeConfirm">新しいパスコード（確認）</label><input id="newPasscodeConfirm" type="password" inputmode="numeric" minlength="6" maxlength="8" autocomplete="new-password"></div><p class="error" id="dialogError" hidden></p>','変更する',async()=>{const current=document.querySelector('#currentPasscode').value.trim(),next=document.querySelector('#newPasscode').value.trim(),confirmation=document.querySelector('#newPasscodeConfirm').value.trim(),error=document.querySelector('#dialogError'),button=document.querySelector('#dialogSave');if(!/^\d{6,8}$/.test(next)){showError(error,'新しいパスコードは6〜8桁の数字で入力してください。');return}if(next!==confirmation){showError(error,'確認用パスコードが一致しません。');return}button.disabled=true;try{await api('/api/service/passcode',{method:'POST',body:{action:'change',currentPasscode:current,newPasscode:next}});closeDialog();toast('パスコードを変更しました。')}catch(caught){showError(error,caught.message)}finally{button.disabled=false}})}

async function logout(){try{await api('/api/service/passcode',{method:'DELETE'})}finally{location.href='/cdn-cgi/access/logout'}}

function tenantCards(){
  if(!tenants.length)return '<div class="card empty-state"><h2>登録業者はありません</h2></div>';
  return tenants.map(tenant=>{const url=customerUrl(tenant.id),production=tenant.licenseType==='production',stateButton=tenant.state==='active'?`<button class="button danger small" data-action="suspend" data-id="${tenant.id}">利用停止</button>`:tenant.state==='suspended'?`<button class="button secondary small" data-action="resume" data-id="${tenant.id}">利用再開</button>`:'';return `<details class="card tenant-disclosure"><summary><span><strong>${escapeHtml(tenant.companyName)}</strong><small>${production?'本番利用':`試験利用・${tenant.trialDays}日`}　${escapeHtml(tenant.vendorEmail)}</small></span><span class="status">${stateLabel(tenant.state)}</span></summary><div class="tenant-disclosure__body"><dl class="summary-list"><div class="summary-row"><dt>利用区分</dt><dd>${production?'本番利用':'試験利用'}</dd></div><div class="summary-row"><dt>利用期間</dt><dd>${production?'期限なし':`${tenant.trialDays}日`}</dd></div>${production?'':`<div class="summary-row"><dt>終了日時</dt><dd>${formatDate(tenant.expiresAt)}</dd></div>`}<div class="summary-row"><dt>お客様用URL</dt><dd><code>${escapeHtml(url)}</code></dd></div></dl><div class="tool-row"><button class="button secondary small" data-action="copy" data-id="${tenant.id}">URLをコピー</button><button class="button secondary small" data-action="edit" data-id="${tenant.id}">業者情報を編集</button><button class="button ghost small" data-action="extend" data-days="7" data-id="${tenant.id}">7日試験</button><button class="button ghost small" data-action="extend" data-days="14" data-id="${tenant.id}">14日試験</button><button class="button ghost small" data-action="extend" data-days="30" data-id="${tenant.id}">30日試験</button>${production?'':`<button class="button small" data-action="production" data-id="${tenant.id}">本番へ切替</button>`}${stateButton}<button class="button danger small" data-action="delete" data-id="${tenant.id}">利用者を削除</button></div></div></details>`}).join('');
}

async function createTenant(event){event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]'),data=Object.fromEntries(new FormData(form)),production=data.licensePlan==='production',trialDays=production?30:Number(data.licensePlan.split(':')[1]);button.disabled=true;try{const result=await api('/api/service/tenants',{method:'POST',body:{companyName:data.companyName,vendorEmail:data.vendorEmail,licenseType:production?'production':'trial',trialDays}});tenants.unshift(result.tenant);render();await copyText(customerUrl(result.tenant.id));toast('業者を登録し、お客様用URLをコピーしました。')}catch(error){toast(error.message)}finally{button.disabled=false}}

async function tenantAction(event){
  const button=event.target.closest('[data-action]');if(!button)return;const tenant=tenants.find(item=>item.id===button.dataset.id);if(!tenant)return;
  if(button.dataset.action==='copy'){try{await copyText(customerUrl(tenant.id));toast('お客様用URLをコピーしました。')}catch{toast('URLをコピーできませんでした。')}return}
  if(button.dataset.action==='edit'){showTenantEditDialog(tenant);return}
  if(button.dataset.action==='delete'){showTenantDeleteDialog(tenant);return}
  if(button.dataset.action==='suspend'&&!confirm(`${tenant.companyName}の利用を停止しますか？`))return;
  if(button.dataset.action==='extend'&&!confirm(`${tenant.companyName}の試験期間を本日から${button.dataset.days}日で再発行しますか？`))return;
  if(button.dataset.action==='production'&&!confirm(`${tenant.companyName}を期限のない本番利用へ切り替えますか？`))return;
  button.disabled=true;try{const body={id:tenant.id};if(button.dataset.action==='extend')body.trialDays=Number(button.dataset.days);if(button.dataset.action==='production')body.licenseType='production';if(button.dataset.action==='suspend')body.status='suspended';if(button.dataset.action==='resume')body.status='active';const result=await api('/api/service/tenants',{method:'PATCH',body});tenants=tenants.map(item=>item.id===tenant.id?result.tenant:item);document.querySelector('#tenantList').innerHTML=tenantCards();toast('利用情報を更新しました。')}catch(error){toast(error.message)}finally{button.disabled=false}
}

function showTenantDeleteDialog(tenant){showDialog('利用者を完全に削除',`<p><strong>${escapeHtml(tenant.companyName)}</strong>の登録、業者設定、認証情報、発行済み専用URLを削除します。</p><p class="warning-text">削除後は専用URLへアクセスできず、元に戻せません。</p><div class="field"><label for="deleteTenantConfirmation">確認のため会社名を入力</label><input id="deleteTenantConfirmation" autocomplete="off" placeholder="${escapeHtml(tenant.companyName)}"></div><p class="error" id="dialogError" hidden></p>`,'完全に削除',async()=>{const confirmation=document.querySelector('#deleteTenantConfirmation').value.trim(),error=document.querySelector('#dialogError'),button=document.querySelector('#dialogSave');if(confirmation!==tenant.companyName){showError(error,'会社名が一致しません。');return}button.disabled=true;try{await api('/api/service/tenants',{method:'DELETE',body:{id:tenant.id,confirmCompanyName:confirmation}});closeDialog();await loadTenants();toast('利用者と専用URLを削除しました。')}catch(caught){showError(error,caught.message)}finally{button.disabled=false}})}

function showTenantEditDialog(tenant){
  showDialog('業者情報を編集',`<form id="tenantEditForm" class="stack"><div class="field"><label for="editCompanyName">会社名</label><input id="editCompanyName" name="companyName" value="${escapeHtml(tenant.companyName)}" maxlength="200" required></div><div class="field"><label for="editVendorEmail">業者ログイン用メール</label><input id="editVendorEmail" name="vendorEmail" type="email" value="${escapeHtml(tenant.vendorEmail)}" required></div><p class="hint">メールを変更すると、旧メールのログイン状態と登録済みパスコードは無効になります。新しい担当者はメール確認後にパスコードを登録します。</p><p class="error" id="tenantEditError" hidden></p></form>`,'変更を保存',async()=>{
    const form=document.querySelector('#tenantEditForm'),button=document.querySelector('#dialogSave'),error=document.querySelector('#tenantEditError');
    if(!form.reportValidity())return;
    const data=Object.fromEntries(new FormData(form));button.disabled=true;
    try{const result=await api('/api/service/tenants',{method:'PATCH',body:{id:tenant.id,companyName:data.companyName,vendorEmail:data.vendorEmail}});tenants=tenants.map(item=>item.id===tenant.id?result.tenant:item);closeDialog();document.querySelector('#tenantList').innerHTML=tenantCards();toast('業者情報を更新しました。')}
    catch(caught){showError(error,caught.message)}finally{button.disabled=false}
  });
}

function renderLogin(){const url=new URL('/api/service/login',location.origin);if(new URL(location.href).searchParams.get('resetPasscode')==='1')url.searchParams.set('resetPasscode','1');main.innerHTML=`<section class="screen"><div class="card empty-state"><h1>運営者ログインが必要です</h1><p>登録メールアドレスへ確認コードを送信します。</p><p class="hint">届かない場合は認証画面から再送し、迷惑メールフォルダも確認してください。</p><p><a class="button" href="${url}">メール確認へ進む</a></p></div></section>`}
function renderFailure(message){main.innerHTML=`<section class="screen"><div class="card empty-state"><h1>管理画面を開けません</h1><p>${escapeHtml(message)}</p></div></section>`}
function showError(element,message){element.textContent=message;element.hidden=false}
function showDialog(title,body,saveLabel,onSave){document.querySelector('#modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dialogTitle"><h2 id="dialogTitle">${escapeHtml(title)}</h2><div>${body}</div><div class="modal-actions section"><button class="button" id="dialogSave" type="button">${escapeHtml(saveLabel)}</button><button class="button secondary" id="dialogClose" type="button">閉じる</button></div></div></div>`;document.querySelector('#dialogSave').onclick=onSave;document.querySelector('#dialogClose').onclick=closeDialog}
function closeDialog(){document.querySelector('#modalRoot').innerHTML=''}
async function api(path,{method='GET',body}={}){let response;try{response=await fetch(path,{method,credentials:'same-origin',headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined})}catch{throw apiError('network_error','通信できません。時間をおいて再度お試しください。')}const type=response.headers.get('content-type')||'';if(!type.includes('application/json'))throw apiError('authentication_required','メール確認が必要です。');const data=await response.json();if(!response.ok||!data.ok)throw apiError(data.error?.code||'request_failed',data.error?.message||'処理できませんでした。');return data}
function apiError(code,message){const error=new Error(message);error.code=code;return error}
const customerUrl=id=>`${location.origin}/customer.html?t=${encodeURIComponent(id)}`;
const stateLabel=state=>({active:'利用中',expired:'期限終了',suspended:'停止中',invalid:'要確認'}[state]||'未確認');
const applicationStateLabel=state=>({pending:'メール確認待ち',issued:'発行済み',cancelled:'取消'}[state]||'要確認');
const productionStateLabel=state=>({requested:'承認待ち',approved:'承認済み',declined:'見送り',cancelled:'取消'}[state]||'要確認');
const formatDate=value=>new Intl.DateTimeFormat('ja-JP',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tokyo'}).format(new Date(value));
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function copyText(text){if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(text);const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();if(!ok)throw new Error()}
function toast(message){toastElement.textContent=message;toastElement.hidden=false;clearTimeout(toast.id);toast.id=setTimeout(()=>toastElement.hidden=true,3200)}
