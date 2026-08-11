const main=document.querySelector('#trialMain'),form=document.querySelector('#trialForm');
const token=new URL(location.href).searchParams.get('verify');
if(token)verify(token);else form?.addEventListener('submit',submitApplication);

async function submitApplication(event){
  event.preventDefault();const button=form.querySelector('button[type="submit"]'),error=document.querySelector('#trialError');error.hidden=true;
  if(!form.reportValidity())return;
  const data=Object.fromEntries(new FormData(form));data.consent=data.consent==='true';button.disabled=true;button.textContent='送信しています…';
  try{const result=await api('/api/trial/apply',{body:data});main.innerHTML=resultScreen('確認メールを送信しました',`<p>${escapeHtml(result.message)}</p><p>メールが届かない場合は、迷惑メールフォルダを確認してから、この画面でもう一度お申し込みください。</p><a class="button secondary" href="/trial.html">申込画面へ戻る</a>`);scrollTo({top:0});}
  catch(caught){error.textContent=caught.message;error.hidden=false;error.focus?.();}
  finally{button.disabled=false;button.textContent='確認メールを受け取る'}
}

async function verify(value){
  main.innerHTML=resultScreen('メールアドレスを確認しています','<p>専用環境を発行しています。画面を閉じずにお待ちください。</p>');
  try{
    const result=await api('/api/trial/verify',{body:{token:value}}),expiry=formatDate(result.tenant.expiresAt),emailNotice=result.emailSent?'専用URLをメールにも送信しました。':'専用URLのメール送信に失敗しました。この画面のURLを保存してください。';
    main.innerHTML=resultScreen('7日間無料体験を開始しました',`<p><strong>${escapeHtml(result.tenant.companyName)}</strong> 専用の環境を発行しました。</p><dl class="summary-list"><div class="summary-row"><dt>業者識別番号</dt><dd>${escapeHtml(result.tenant.id)}</dd></div><div class="summary-row"><dt>利用期限</dt><dd>${escapeHtml(expiry)}</dd></div></dl><div class="url-panel"><strong>最初に開く：業者設定URL</strong><code>${escapeHtml(result.adminUrl)}</code><button class="button secondary small" data-copy="${escapeHtml(result.adminUrl)}">URLをコピー</button></div><div class="url-panel"><strong>設定後に顧客へ案内：お客様用URL</strong><code>${escapeHtml(result.customerUrl)}</code><button class="button secondary small" data-copy="${escapeHtml(result.customerUrl)}">URLをコピー</button></div><p class="hint">${escapeHtml(emailNotice)}</p><a class="button" href="${escapeHtml(result.adminUrl)}">業者設定を始める</a>`);
    main.addEventListener('click',copyAction);
  }catch(error){main.innerHTML=resultScreen('無料体験を開始できませんでした',`<p>${escapeHtml(error.message)}</p><a class="button" href="/trial.html#apply">申込画面へ戻る</a>`,'!')}
}

function resultScreen(title,body,mark='✓'){return `<section class="card stack trial-result"><div class="trial-result__mark" aria-hidden="true">${mark}</div><p class="eyebrow">7日間無料体験</p><h1>${escapeHtml(title)}</h1>${body}</section>`}
async function copyAction(event){const button=event.target.closest('[data-copy]');if(!button)return;try{await navigator.clipboard.writeText(button.dataset.copy);button.textContent='コピーしました'}catch{button.textContent='コピーできませんでした'}}
async function api(path,{body}){let response;try{response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})}catch{throw new Error('通信できません。時間をおいて再度お試しください。')}const data=await response.json().catch(()=>({}));if(!response.ok||!data.ok)throw new Error(data.error?.message||'処理を完了できませんでした。');return data}
function formatDate(value){return new Intl.DateTimeFormat('ja-JP',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Tokyo'}).format(new Date(value))}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
