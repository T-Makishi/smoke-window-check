import {DEFAULT_SETTINGS,LABELS} from './estimate-config.js';
import {appState,createDraft} from './state.js?v=20260812c';
import {storage,validBackup} from './storage.js';
import {calculateEstimate} from './estimate.js';
import {createPresentedResult,interviewQuestionsFor,pruneInterviewAnswers} from './interview-config.js?v=20260812c';
import {validateStep} from './validation.js';
import {buildMailto,caseText,copyText} from './export.js?v=20260812c';
import {clone,debounce,download,uid} from './utils.js';
import {settingsFromForm,resetSettings} from './settings.js';
import {customerFields,renderCustomerGuide,renderDetail,renderHistory,renderHome,renderPrintReport,renderSettings,renderStep,renderVendorInquiries,renderVendorInquiryDetail} from './ui.js?v=20260812f';
import {hashPasscode,verifyPasscode} from './security.js';
import {applyCustomerConfigFromUrl,buildCustomerUrl} from './recipient-link.js';
import {buildTenantCustomerUrl,clearVendorIdentitySession,clearVendorPasscodeSession,deleteVendorInquiry,exportVendorInquiriesCsv,isTenantUrl,loadPublicTenant,loadVendorInquiries,loadVendorPasscodeState,loadVendorSubscription,loadVendorTenant,mergePublicSettings,readTenantId,remainingTrialDays,requestVendorIdentityLink,saveVendorTenant,submitPublicInquiry,submitVendorPasscode,updateVendorInquiry,vendorLoginUrl,wantsAdmin} from './cloudflare-platform.js?v=20260812j';

const main=document.querySelector('#main'),progress=document.querySelector('#progressWrap'),headerCompany=document.querySelector('#headerCompany');
const LOGO_MAX_SOURCE_BYTES=1024*1024,LOGO_EDGE=64,LOGO_MAX_DATA_URL_LENGTH=1800;
const pageUrl=new URL(location.href),tenantId=readTenantId(location.href),tenantParamPresent=isTenantUrl(location.href),demoMode=pageUrl.searchParams.get('demo')==='1',embedMode=pageUrl.searchParams.get('embed')==='1',guidePreview=pageUrl.searchParams.get('guidePreview')||'';
const platform={tenantId,tenant:null,vendorAuthenticated:false,passcode:null,userEmail:'',initializing:true,blocked:false,demo:demoMode,embed:embedMode,inquiries:[],currentInquiry:null,inquiryFilters:{query:'',status:''}};
let settings=applyCustomerConfigFromUrl(storage.getSettings(DEFAULT_SETTINGS),location.href);let cases=storage.getCases().map(normalizeCase);
const draftSaved=debounce(()=>{if(platform.demo)return;if(appState.step>0&&appState.step<8)try{storage.saveDraft(appState.draft)}catch(e){toast(e.message)}},200);

document.querySelector('#homeButton').addEventListener('click',()=>goHome());
document.querySelector('#settingsButton').addEventListener('click',requestSettingsAccess);
main.addEventListener('click',handleClick);main.addEventListener('change',handleChange);main.addEventListener('input',handleInput);
initialize();

async function initialize(){
  main.innerHTML='<section class="screen"><div class="card empty-state"><h1>利用情報を確認しています</h1><p>少しお待ちください。</p></div></section>';
  if(platform.demo){settings=structuredClone(DEFAULT_SETTINGS);settings.company.name='排煙窓事前見積デモ';settings.company.tradeName='操作体験用';settings.company.phone='';settings.company.email='demo@example.invalid';settings.app.name='排煙窓事前見積 操作体験';document.body.classList.add('is-demo');if(platform.embed)document.body.classList.add('is-embedded');document.querySelector('#settingsButton').hidden=true;platform.initializing=false;applySettings();if(guidePreview)renderGuidePreview(guidePreview);else renderHomeScreen();return}
  if(tenantParamPresent&&!tenantId){renderPlatformUnavailable('invalid');return}
  if(tenantId){
    try{
      const result=await loadPublicTenant(tenantId);platform.tenant=result.tenant;settings=mergePublicSettings(DEFAULT_SETTINGS,result.tenant.settings);updateLicenseBanner();
      document.querySelector('#settingsButton').textContent='業者ログイン';
      if(wantsAdmin(location.href)){
        let auth;try{auth=await loadVendorPasscodeState(tenantId)}catch(error){if(error.code==='identity_required'){platform.initializing=false;applySettings();updateLicenseBanner();appState.screen='identity';render();return}throw error}platform.passcode=auth.passcode;platform.userEmail=auth.user.email;
        if(auth.passcode.verified){const vendor=await loadVendorTenant(tenantId);settings=mergePublicSettings(DEFAULT_SETTINGS,vendor.tenant.settings);platform.vendorAuthenticated=true}
        updateLicenseBanner();
      }
    }catch(error){
      if(wantsAdmin(location.href)&&error.code==='authentication_required'){appState.screen='identity';platform.initializing=false;applySettings();render();return}
      if(wantsAdmin(location.href)&&error.code==='network_error'){renderPlatformUnavailable(error.code,error.tenant);return}
      if(wantsAdmin(location.href)&&['suspended','expired'].includes(error.code)&&error.tenant){
        platform.tenant=error.tenant;document.querySelector('#settingsButton').textContent='業者ログイン';
        try{
          const auth=await loadVendorPasscodeState(tenantId);platform.passcode=auth.passcode;platform.userEmail=auth.user.email;
          if(auth.passcode.verified){const vendor=await loadVendorTenant(tenantId);settings=mergePublicSettings(DEFAULT_SETTINGS,vendor.tenant.settings);platform.vendorAuthenticated=true}
          platform.initializing=false;applySettings();updateLicenseBanner();appState.screen=platform.vendorAuthenticated?'settings':'passcode';render();return;
        }catch(authError){if(authError.code==='identity_required'){platform.initializing=false;applySettings();appState.screen='identity';render();return}renderPlatformUnavailable(authError.code,authError.tenant);return}
      }
      renderPlatformUnavailable(error.code,error.tenant);return;
    }
  }
  platform.initializing=false;applySettings();
  if(wantsAdmin(location.href)&&tenantId&&!platform.vendorAuthenticated){appState.screen='passcode';render();return}
  renderHomeScreen();
  if(platform.vendorAuthenticated){appState.screen='settings';render()}
}

function render(){applySettings();progress.hidden=appState.screen!=='wizard'||appState.step===8;document.body.classList.toggle('has-progress',!progress.hidden);if(appState.screen==='home')main.innerHTML=renderHome(settings,platform.demo?false:!!storage.getDraft(),{demo:platform.demo,serverStorage:Boolean(platform.tenantId)});if(appState.screen==='guide'){main.innerHTML=renderCustomerGuide(settings,customerGuideUrl());renderGuideQr()}if(appState.screen==='wizard'){main.innerHTML=renderStep(appState.step,appState.draft,settings,appState.mediaFiles,{demo:platform.demo,interviewIndex:appState.interviewIndex,tenantMode:Boolean(platform.tenantId)});updateProgress();if(platform.demo&&appState.step<8)enhanceDemoStep()}if(appState.screen==='history')main.innerHTML=renderHistory(cases,settings);if(appState.screen==='settings'){main.innerHTML=renderSettings(settings);enhanceSettings();enhanceTenantLicenseCard();enhanceTenantSecurityCard();enhanceShareControls();enhanceInquiryManagementCard()}if(appState.screen==='inquiries')main.innerHTML=renderVendorInquiries(platform.inquiries,platform.inquiryFilters,{lastBackupAt:readInquiryBackupAt()});if(appState.screen==='inquiry-detail')main.innerHTML=renderVendorInquiryDetail(platform.currentInquiry,settings);if(appState.screen==='detail')main.innerHTML=renderDetail(appState.draft,settings);if(appState.screen==='identity')main.innerHTML=renderVendorIdentityGate();if(appState.screen==='passcode')main.innerHTML=renderVendorPasscodeGate();main.focus({preventScroll:true});scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}
function renderHomeScreen(){appState.screen='home';appState.step=0;render();if(platform.demo)enhanceDemoHome()}
function enhanceDemoHome(){const screen=main.querySelector('.customer-welcome');if(!screen)return;screen.classList.add('demo-home');screen.querySelector('[data-action="history"]')?.remove();const kicker=screen.querySelector('.hero-kicker'),lead=screen.querySelector('.customer-welcome__lead'),startButton=screen.querySelector('[data-action="start"]');if(kicker)kicker.textContent='業者・見積依頼者向け';if(lead)lead.innerHTML='本番と同じ問診の流れを、この画面内で操作できます。<strong>入力内容は保存・送信されません。</strong>';if(startButton)startButton.childNodes[0].textContent='操作体験を始める';const banner=document.createElement('div');banner.className='demo-banner';banner.innerHTML='<strong>操作体験デモ</strong><span>サンプル入力済み・保存、送信されません</span>';screen.prepend(banner)}
function goHome(){if(platform.blocked)return;if(appState.screen==='wizard'&&appState.step>0&&appState.step<8)syncForm();renderHomeScreen()}
function applySettings(){document.documentElement.style.setProperty('--color-primary',settings.app.mainColor);document.documentElement.style.setProperty('--main',settings.app.mainColor);document.documentElement.style.setProperty('--color-accent',settings.app.accentColor);document.documentElement.style.setProperty('--accent',settings.app.accentColor);headerCompany.textContent=settings.company.name;document.title=settings.app.name;const mark=document.querySelector('#logoMark');mark.replaceChildren();if(settings.company.logoDataUrl?.startsWith('data:image/')){const img=document.createElement('img');img.className='logo-image';img.alt='';img.src=settings.company.logoDataUrl;mark.append(img)}else mark.textContent='窓'}
function updateLicenseBanner(){const banner=document.querySelector('#licenseBanner'),admin=wantsAdmin(location.href),days=remainingTrialDays(platform.tenant);if(!banner)return;if(!admin||days===null){banner.hidden=true;banner.textContent='';return}const email=platform.userEmail||platform.tenant?.vendorEmailHint||'';banner.hidden=false;banner.innerHTML=`<div class="license-banner__inner"><strong>試験利用中</strong><span>${days===0?'本日まで':`残り${days}日`}</span><span class="license-banner__admin">業者設定を編集中</span>${email?`<span class="license-banner__email">登録メール：${escapeHtml(email)}</span>`:''}</div>`}
function updateProgress(){const n=Math.min(appState.step,8);document.querySelector('#stepLabel').textContent=`STEP ${n} / 8`;document.querySelector('#stepName').textContent=['','依頼者情報',appState.interviewIndex>=0?'選択式問診':'症状選択','写真・動画','現場情報','排煙窓の問診','概算・料金','内容確認','保存完了'][n];document.querySelector('#progressBar').style.width=`${n/8*100}%`;const bar=document.querySelector('[role=progressbar]');bar.setAttribute('aria-valuenow',n);bar.setAttribute('aria-valuetext',`8段階中${n}段階、${document.querySelector('#stepName').textContent}`)}
function start(draft=null){appState.draft=normalizeCase(draft||(platform.demo?demoSampleDraft():createDraft()));appState.mediaFiles=[];appState.editingId=draft?.id||null;appState.interviewIndex=-1;appState.screen='wizard';appState.step=1;render();draftSaved()}
function demoSampleDraft(){const draft=createDraft();draft.customerType='corporate';Object.assign(draft.customer,{companyName:'サンプル商事株式会社',departmentName:'総務部',contactName:'山田 太郎',phone:'03-1234-5678',email:'sample@example.com',managementNumber:'DEMO-001'});Object.assign(draft.site,{postalCode:'100-0001',prefecture:'東京都',city:'千代田区',address:'千代田1-1',buildingName:'サンプルビル',floor:'3階',siteName:'本社事務所',parking:'yes',elevator:'yes',workHours:'平日 10:00〜16:00'});Object.assign(draft.diagnosis,{symptom:'heavy',symptoms:['heavy','noise'],interviewAnswers:{resistance_timing:'middle',noise_type:'metal',noise_timing:'both'},buildingType:'office',heightType:'smallLadder',quantity:'1',makerStatus:'known',makerName:'サンプルメーカー',onset:'month',urgency:'normal',notes:'開閉時に重さと異音があります。'});Object.assign(draft.inspectionFee,{agreed:true,agreedAt:new Date().toISOString()});return draft}
function renderGuidePreview(preview){
  if(preview==='home'){renderHomeScreen();return}
  const step=Number(preview),allowedSteps=new Set([2,3,7]);
  if(!allowedSteps.has(step)){renderHomeScreen();return}
  appState.draft=normalizeCase(demoSampleDraft());appState.mediaFiles=[];appState.editingId=null;appState.interviewIndex=-1;appState.screen='wizard';appState.step=step;
  if(step>=7){appState.draft.estimate=calculateEstimate(appState.draft,settings);Object.assign(appState.draft.inspectionFee,{amount:settings.inspection.fee,taxType:settings.inspection.taxType,deductionOnFormalOrder:settings.inspection.deduction});appState.draft.presentedResult=createPresentedResult(appState.draft,appState.draft.estimate,settings)}
  render();
}
function enhanceDemoStep(){const header=main.querySelector('.screen-header');if(!header||main.querySelector('.demo-step-note'))return;const note=document.createElement('div');note.className='demo-step-note';note.innerHTML='<strong>サンプル入力済み</strong><span>内容を確認して「次へ進む」を押すと、最後まで操作できます。</span>';header.after(note)}
async function handleClick(e){
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(action){
    if(action==='send-vendor-identity-link')await sendVendorIdentityLink();
    if(action==='submit-vendor-passcode')await submitVendorPasscodeForm();
    if(action==='vendor-passcode-reset-help')showVendorResetHelp();
    if(action==='vendor-change-passcode')showVendorChangePasscode();
    if(action==='vendor-logout')await logoutVendor();
    if(action==='vendor-contract')location.href=`/contract.html?t=${encodeURIComponent(platform.tenantId)}`;
    if(action==='start')start();
    if(action==='resume'){const d=storage.getDraft();start(d||null)}
    if(action==='guide'){appState.screen='guide';render()}
    if(action==='home')goHome();
    if(action==='history'){cases=storage.getCases().map(normalizeCase);appState.screen='history';render()}
    if(action==='help')showHelp();
    if(action==='back')previous();
    if(action==='next')next();
    if(action==='clear-media')clearMedia();
    if(action==='copy-current')doCopy(appState.draft);
    if(action==='send-email')await sendEmail(appState.draft);
    if(action==='vendor-inquiries'||action==='vendor-inquiry-list')await openVendorInquiries();
    if(action==='vendor-inquiry-search')await searchVendorInquiries();
    if(action==='vendor-inquiry-reset')await resetVendorInquirySearch();
    if(action==='vendor-inquiry-export')await exportVendorInquiryBackup();
    if(action==='vendor-inquiry-detail')await openVendorInquiry(e.target.closest('[data-id]')?.dataset.id);
    if(action==='vendor-inquiry-save')await saveVendorInquiryManagement();
    if(action==='vendor-inquiry-delete')await removeVendorInquiry();
    if(action==='vendor-inquiry-back'){appState.screen='settings';render()}
    if(action==='vendor-inquiry-print')printVendorInquiry();
    if(action==='share-media')await shareMedia(appState.draft);
    if(action==='print')printCurrentView();
    if(action==='export')exportBackup();
    if(action==='delete-all')deleteAll();
    if(action==='save-settings')await saveSettings();
    if(action==='save-and-share-customer-link')await saveAndShareCustomerLink();
    if(action==='save-and-copy-email-link')await saveAndCopyEmailLink();
    if(action==='save-and-show-qr')await saveAndShowQr();
    if(action==='save-and-copy-customer-url')await saveAndCopyCustomerUrl();
    if(action==='remove-logo')removeLogo();
    if(action==='reset-settings')resetAllSettings();
  }
  const rm=e.target.closest('[data-remove-media]');if(rm)removeMedia(Number(rm.dataset.removeMedia));
  const edit=e.target.closest('[data-edit-step]');if(edit){appState.screen='wizard';appState.step=Number(edit.dataset.editStep);appState.interviewIndex=-1;render()}
  const ca=e.target.closest('[data-case-action]');if(ca)await caseAction(ca.dataset.caseAction,ca.dataset.id)
}
function handleChange(e){if(e.target.id==='mediaInput')addMedia([...e.target.files]);if(e.target.id==='importInput')importBackup(e.target.files[0]);if(e.target.id==='companyLogo')loadLogo(e.target.files[0]);if(e.target.name==='customerType'){syncForm();appState.draft.customerType=e.target.value;document.querySelector('#customerFields').innerHTML=customerFields(appState.draft);draftSaved()}if(e.target.id==='agreed'){appState.draft.inspectionFee.agreed=e.target.checked;appState.draft.inspectionFee.agreedAt=e.target.checked?new Date().toISOString():null;draftSaved()}if(e.target.id==='submissionAgreement'){appState.draft.submission.agreed=e.target.checked;saveCurrentCase()}if(e.target.id==='company.email')updateCustomerUrlPreview()}
function handleInput(){if(appState.screen==='wizard'){syncForm();draftSaved()}}
function syncForm(){const form=document.querySelector('#stepForm');if(!form)return;const symptomInputs=[...form.querySelectorAll('[name="diagnosis.symptoms"]')];if(symptomInputs.length){const values=symptomInputs.filter(input=>input.checked).map(input=>input.value);appState.draft.diagnosis.symptoms=values;appState.draft.diagnosis.symptom=values[0]||''}for(const [name,value] of new FormData(form)){if(name==='diagnosis.symptoms')continue;setPath(appState.draft,name,value)}}
function setPath(obj,path,value){const keys=path.split('.');let o=obj;while(keys.length>1){const k=keys.shift();o[k]??={};o=o[k]}o[keys[0]]=value}
function previous(){syncForm();if(appState.step===1){renderHomeScreen();return}if(appState.step===2&&appState.interviewIndex>=0){if(appState.interviewIndex===0)appState.interviewIndex=-1;else appState.interviewIndex--;render();draftSaved();return}if(appState.step===3){const questions=interviewQuestionsFor(appState.draft.diagnosis);appState.step=2;appState.interviewIndex=questions.length?questions.length-1:-1;render();draftSaved();return}appState.step--;appState.interviewIndex=-1;render();draftSaved()}
function next(){syncForm();if(appState.step===2){if(appState.interviewIndex<0){const errors=validateStep(2,appState.draft);if(Object.keys(errors).length){showErrors(errors);return}pruneInterviewAnswers(appState.draft.diagnosis);const questions=interviewQuestionsFor(appState.draft.diagnosis);if(questions.length){appState.interviewIndex=0;render();draftSaved();return}}else{const questions=interviewQuestionsFor(appState.draft.diagnosis),question=questions[appState.interviewIndex],answer=question&&appState.draft.diagnosis.interviewAnswers?.[question.id];if(question&&!answer){showErrors({[`diagnosis.interviewAnswers.${question.id}`]:'最も近い状態を選択してください。'});return}if(appState.interviewIndex<questions.length-1){appState.interviewIndex++;render();draftSaved();return}appState.interviewIndex=-1;appState.step=3;render();draftSaved();return}}const errors=validateStep(appState.step,appState.draft);if(Object.keys(errors).length){showErrors(errors);return}if(appState.step===5){appState.draft.estimate=calculateEstimate(appState.draft,settings);Object.assign(appState.draft.inspectionFee,{amount:settings.inspection.fee,taxType:settings.inspection.taxType,deductionOnFormalOrder:settings.inspection.deduction});appState.draft.presentedResult=createPresentedResult(appState.draft,appState.draft.estimate,settings)}if(appState.step===6&&appState.draft.inspectionFee.agreed&&!appState.draft.inspectionFee.agreedAt)appState.draft.inspectionFee.agreedAt=new Date().toISOString();if(appState.step===7){saveCase();return}appState.step++;appState.interviewIndex=-1;render();draftSaved()}
function showErrors(errors){document.querySelectorAll('.error').forEach(x=>x.hidden=true);let first=null;for(const [key,msg] of Object.entries(errors)){const id=key.includes('.')?key.split('.').at(-1):key;const p=document.querySelector(`#error-${CSS.escape(key)},#error-${CSS.escape(id)}`);const input=document.querySelector(`[name="${CSS.escape(key)}"],#${CSS.escape(key)}`);if(p){p.textContent=msg;p.hidden=false}(input||p?.parentElement)?.classList.add('has-error');if(input)input.classList.add('is-invalid');first??=input||p}first?.scrollIntoView({behavior:'smooth',block:'center'});first?.focus?.();toast('入力内容を確認してください。')}
function saveCase(){const now=new Date().toISOString(),d=clone(appState.draft);d.id=appState.editingId||d.id||uid();d.createdAt=appState.editingId?(cases.find(c=>c.id===appState.editingId)?.createdAt||now):now;d.updatedAt=now;d.media={count:appState.mediaFiles.length||d.media.count,saved:false,names:appState.mediaFiles.map(x=>x.file.name)};if(!platform.demo){const idx=cases.findIndex(c=>c.id===d.id);if(idx>=0)cases[idx]=d;else cases.unshift(d);try{storage.saveCases(cases);storage.clearDraft()}catch(e){toast(e.message);return}}appState.draft=d;appState.editingId=null;appState.step=8;render();if(platform.demo)enhanceDemoCompletion()}
function saveCurrentCase(){if(platform.demo)return;appState.draft.updatedAt=new Date().toISOString();const index=cases.findIndex(item=>item.id===appState.draft.id);if(index>=0)cases[index]=clone(appState.draft);else cases.unshift(clone(appState.draft));storage.saveCases(cases)}

function enhanceDemoCompletion(){const mark=main.querySelector('.success-mark'),card=mark?.closest('.card');if(!card)return;const title=card.querySelector('h1,h2');if(title)title.textContent='操作体験が完了しました';const warning=[...card.querySelectorAll('p')].find(element=>element.textContent.includes('送信')||element.textContent.includes('保存'));if(warning)warning.textContent='この操作体験で入力した内容は保存・送信されていません。';card.querySelectorAll('[data-action="send-email"],[data-action="share-media"],[data-action="copy-current"],[data-action="print"],[data-action="history"]').forEach(element=>element.remove())}

function addMedia(files){const allowed=['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'],max=20*1024*1024;let error='';for(const file of files){if(appState.mediaFiles.length>=3){error='添付できるのは最大3点です。';break}if(!allowed.includes(file.type)){error=`「${file.name}」は対応していない形式です。`;continue}if(file.size>max){error=`「${file.name}」は20MBを超えています。`;continue}appState.mediaFiles.push({file,url:URL.createObjectURL(file),type:file.type})}appState.draft.media.count=appState.mediaFiles.length;if(error)toast(error);render();draftSaved()}
function removeMedia(i){const x=appState.mediaFiles.splice(i,1)[0];if(x)URL.revokeObjectURL(x.url);appState.draft.media.count=appState.mediaFiles.length;render();draftSaved()}
function clearMedia(){if(!confirm('添付した写真・動画をすべて削除しますか？'))return;appState.mediaFiles.forEach(x=>URL.revokeObjectURL(x.url));appState.mediaFiles=[];appState.draft.media.count=0;render();draftSaved()}
async function doCopy(c){try{await copyText(caseText(c,settings));toast('相談内容をコピーしました。')}catch{toast('コピーできませんでした。端末の権限を確認してください。')}}
async function sendEmail(c){if(platform.demo){showModal('操作体験はここまでです','<p>本番では、ここから業者の専用管理画面と受付メールへ問診内容を送信します。</p><p>この操作体験では入力内容を保存・送信していません。</p>');return}if(!platform.tenantId){try{location.href=buildMailto(c,settings)}catch(e){toast(e.message)}return}if(!document.querySelector('#submissionAgreement')?.checked&&!c.submission?.agreed){toast('送信前に、問診回答の保存と送信へ同意してください。');document.querySelector('#submissionAgreement')?.focus();return}const button=document.querySelector('[data-action="send-email"]');if(button)button.disabled=true;c.submission.agreed=true;try{const result=await submitPublicInquiry(platform.tenantId,c);c.submission={agreed:true,serverId:result.inquiry.id,caseNumber:result.inquiry.caseNumber,emailStatus:result.inquiry.emailStatus,sentAt:result.inquiry.receivedAt};saveCurrentCase();render();toast(result.inquiry.emailStatus==='sent'?'問診結果を業者へ送信しました。':'業者専用画面へ保存しました。')}catch(error){toast(error.message||'送信できませんでした。時間をおいて再度お試しください。')}finally{if(button?.isConnected)button.disabled=false}}
async function shareMedia(c){const files=appState.mediaFiles.map(x=>x.file);if(!files.length){toast('共有できる写真・動画がありません。再度選択してください。');return}if(!navigator.share||!navigator.canShare?.({files})){toast('この端末ではファイル共有を利用できません。メール画面で添付してください。');return}try{const caseNumber=c.submission?.caseNumber||'未発行';await navigator.share({title:'排煙窓事前チェック',text:`受付番号：${caseNumber}\n送信先：${settings.company.email}\n\n${caseText(c,settings)}`,files})}catch(e){if(e?.name!=='AbortError')toast('共有画面を開けませんでした。')}}
async function caseAction(action,id){const c=cases.find(x=>x.id===id);if(!c)return;if(action==='detail'){appState.draft=clone(c);appState.screen='detail';render()}if(action==='edit')start(clone(c));if(action==='copy')await doCopy(c);if(action==='duplicate'){const n=clone(c);n.id=uid();n.createdAt=n.updatedAt=new Date().toISOString();n.customer.contactName=`${n.customer.contactName}（複製）`;cases.unshift(n);storage.saveCases(cases);render();toast('相談内容を複製しました。')}if(action==='print'){appState.draft=clone(c);appState.screen='detail';render();printCurrentView()}if(action==='delete'){if(confirm('この相談内容を削除しますか？この操作は元に戻せません。')){cases=cases.filter(x=>x.id!==id);storage.saveCases(cases);render();toast('削除しました。')}}if(action==='status')changeStatus(c)}
function changeStatus(c){const options=Object.entries(LABELS.status).map(([v,l])=>`<option value="${v}" ${c.status===v?'selected':''}>${l}</option>`).join('');showModal('対応状況を変更',`<div class="field"><label for="statusSelect">対応状況</label><select id="statusSelect">${options}</select></div><div class="field"><label for="caseMemo">社内メモ</label><textarea id="caseMemo"></textarea></div>`,()=>{c.status=document.querySelector('#statusSelect').value;c.memo=document.querySelector('#caseMemo').value;storage.saveCases(cases);closeModal();render();toast('対応状況を更新しました。')},c.memo)}
function exportBackup(){download(`排煙窓相談_保存データ_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({version:1,exportedAt:new Date().toISOString(),cases},null,2));toast('保存データをダウンロードフォルダへ書き出しました。')}
async function importBackup(file){if(!file)return;try{const data=JSON.parse(await file.text());if(!validBackup(data))throw new Error();if(!confirm(`${data.cases.length}件の相談をこの端末へ戻します。現在の履歴へ追加してよろしいですか？`))return;const map=new Map([...cases,...data.cases.map(normalizeCase)].map(c=>[c.id,c]));cases=[...map.values()];storage.saveCases(cases);render();toast('保存ファイルから相談内容を戻しました。')}catch{toast('このアプリで書き出した保存データファイルではありません。')}}
function deleteAll(){if(confirm('保存した相談をすべて削除しますか？この操作は元に戻せません。')){cases=[];storage.saveCases(cases);render();toast('すべて削除しました。')}}
async function saveSettings({stay=false}={}){const form=document.querySelector('#settingsForm'),newCode=document.querySelector('#newSettingsPasscode')?.value.trim()||'',confirmation=document.querySelector('#confirmSettingsPasscode')?.value.trim()||'',nextSettings=settingsFromForm(form,settings);try{platform.tenantId?buildTenantCustomerUrl(platform.tenantId,location.href):buildCustomerUrl(nextSettings,location.href)}catch(e){toast(e.message);document.getElementById('company.email')?.focus();return false}if(newCode){if(!/^\d{4,8}$/.test(newCode)){toast('新しいパスコードは4〜8桁の数字で入力してください。');document.querySelector('#newSettingsPasscode').focus();return false}if(newCode!==confirmation){toast('新しいパスコードが一致しません。');document.querySelector('#confirmSettingsPasscode').focus();return false}}if(newCode)nextSettings.security.settingsPasscodeHash=await hashPasscode(newCode);try{if(platform.tenantId){if(!platform.vendorAuthenticated){location.href=vendorLoginUrl(platform.tenantId,location.href);return false}const result=await saveVendorTenant(platform.tenantId,nextSettings);platform.tenant=result.tenant;settings=mergePublicSettings(DEFAULT_SETTINGS,result.tenant.settings)}else settings=nextSettings;storage.saveSettings(settings);applySettings();if(stay){const newPass=document.querySelector('#newSettingsPasscode'),confirmPass=document.querySelector('#confirmSettingsPasscode');if(newPass)newPass.value='';if(confirmPass)confirmPass.value='';updateCustomerUrlPreview()}else renderHomeScreen();toast('業者設定を保存しました。');return true}catch(e){toast(e.message);return false}}
async function savedCustomerUrl(){if(!(await saveSettings({stay:true})))return null;try{const url=platform.tenantId?buildTenantCustomerUrl(platform.tenantId,location.href):buildCustomerUrl(settings,location.href);document.querySelector('#customerShareUrl').value=url;return url}catch(e){toast(e.message);document.getElementById('company.email')?.focus();return null}}
async function saveAndCopyCustomerUrl(){const url=await savedCustomerUrl();if(!url)return;try{await copyText(url);toast('実際のお客様用URLをコピーしました。')}catch{toast('URLをコピーできませんでした。端末の権限を確認してください。')}}
async function saveAndShareCustomerLink(){
  const url=await savedCustomerUrl();if(!url)return;
  const title='排煙窓事前チェック',text=`${settings.company.name}から、現地調査前の排煙窓事前チェックのお願いです。症状・設置状況・写真を分かる範囲でお知らせください。`;
  if(navigator.share)try{await navigator.share({title,text,url});return}catch(error){if(error?.name==='AbortError')return}
  try{await copyCustomerInvitation(url);toast('案内文とリンクをコピーしました。LINE・SMSなどへ貼り付けてください。')}catch{toast('案内リンクを共有できませんでした。端末の権限を確認してください。')}
}
async function saveAndCopyEmailLink(){const url=await savedCustomerUrl();if(!url)return;try{const rich=await copyCustomerInvitation(url);toast(rich?'メール用の短い表示リンクをコピーしました。':'この端末では短い表示に対応していないため、案内文とURLをコピーしました。')}catch{toast('メール用リンクをコピーできませんでした。端末の権限を確認してください。')}}
async function saveAndShowQr(){const url=await savedCustomerUrl();if(url)await showCustomerQr(url)}
async function copyCustomerInvitation(url){const linkText='排煙窓事前チェックを開く',intro=`${settings.company.name}から、現地調査前の事前確認のお願いです。症状・設置状況・写真を分かる範囲でご入力ください。`,plain=`${intro}\n${linkText}\n${url}`,html=`<p>${escapeHtml(intro)}</p><p><a href="${escapeHtml(url)}">${escapeHtml(linkText)}</a></p>`;if(navigator.clipboard?.write&&window.ClipboardItem)try{await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([plain],{type:'text/plain'}),'text/html':new Blob([html],{type:'text/html'})})]);return true}catch{}if(copyHtmlFallback(html))return true;await copyText(plain);return false}
function copyHtmlFallback(html){const container=document.createElement('div'),selection=getSelection(),range=document.createRange();if(!selection)return false;container.contentEditable='true';container.style.cssText='position:fixed;left:-9999px;top:0';container.innerHTML=html;document.body.append(container);range.selectNodeContents(container);selection.removeAllRanges();selection.addRange(range);let copied=false;try{copied=document.execCommand('copy')}catch{}selection.removeAllRanges();container.remove();return copied}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
async function showCustomerQr(url){
  if(typeof window.qrcode!=='function'){toast('QRコード機能を読み込めませんでした。通信状態を確認してください。');return}
  let qr;
  try{qr=window.qrcode(0,'L');qr.addData(url,'Byte');qr.make()}
  catch{toast('設定内容が多いためQRコードを作成できません。案内文またはロゴを見直してください。');return}
  showModal('LINE用QR案内画像','<div class="qr-code-panel"><canvas class="qr-code-canvas qr-share-card" id="customerQrCanvas" role="img" aria-label="会社名と案内文を含むお客様用QR画像"></canvas><p class="share-guide"><strong>LINEで送る場合</strong><br>下のボタンを押し、共有画面でLINEを選択してください。長いURLはトーク画面に表示されません。</p><div class="tool-row qr-code-actions"><button class="button small" id="shareQrImage" type="button">LINEなどへ送る</button><button class="button secondary small" id="copyQrImage" type="button">画像をコピー</button><button class="button secondary small" id="downloadQrImage" type="button">PNGで保存</button></div><p class="hint">この画像には発行時点の公開設定へつながるQRコードが含まれます。設定変更後は新しく発行してください。</p></div>');
  const canvas=document.querySelector('#customerQrCanvas');
  try{await renderQrShareCard(qr,canvas,settings)}catch{closeModal();toast('QR案内画像を作成できませんでした。別の端末またはブラウザでお試しください。');return}
  document.querySelector('#copyQrImage').onclick=()=>copyQrImage(canvas);
  document.querySelector('#downloadQrImage').onclick=()=>downloadQrImage(canvas);
  const share=document.querySelector('#shareQrImage');
  if(!navigator.share)share.hidden=true;else share.onclick=()=>shareQrImage(canvas);
  const modal=document.querySelector('.modal'),modalTitle=document.querySelector('#modalTitle');
  modalTitle.tabIndex=-1;modalTitle.focus({preventScroll:true});modal.scrollTop=0;
}
async function renderQrShareCard(qr,canvas,currentSettings){
  const width=1200,height=1600,context=canvas.getContext('2d');
  if(!context)throw new Error('Canvas unavailable');
  canvas.width=width;canvas.height=height;context.imageSmoothingEnabled=true;
  context.fillStyle='#f3f7f5';context.fillRect(0,0,width,height);
  context.fillStyle=currentSettings.app.mainColor||'#1e5e3a';context.fillRect(0,0,width,170);
  if(currentSettings.company.logoDataUrl?.startsWith('data:image/')){
    try{const logo=await loadCanvasImage(currentSettings.company.logoDataUrl);context.save();context.beginPath();context.arc(110,85,58,0,Math.PI*2);context.clip();context.fillStyle='#fff';context.fillRect(52,27,116,116);context.drawImage(logo,52,27,116,116);context.restore()}catch{}
  }
  context.textAlign='center';context.textBaseline='middle';context.fillStyle='#fff';drawFittedText(context,currentSettings.company.name||'排煙窓修理会社',currentSettings.company.logoDataUrl?690:1040,88,52,34);
  context.fillStyle='#0d2b45';context.font='700 64px -apple-system, BlinkMacSystemFont, "Noto Sans JP", sans-serif';context.fillText('排煙窓事前チェック',width/2,255);
  context.fillStyle='#40544c';context.font='500 37px -apple-system, BlinkMacSystemFont, "Noto Sans JP", sans-serif';context.fillText('スマートフォンのカメラで読み取ってください',width/2,330);
  const qrBox={x:120,y:400,size:960};context.fillStyle='#fff';roundedRect(context,qrBox.x,qrBox.y,qrBox.size,qrBox.size,38);context.fill();
  renderQrIntoBox(qr,context,qrBox.x+60,qrBox.y+60,qrBox.size-120);
  context.fillStyle='#0d2b45';context.font='700 43px -apple-system, BlinkMacSystemFont, "Noto Sans JP", sans-serif';context.fillText('現地調査前に必要な症状・写真を入力',width/2,1430);
  context.fillStyle='#607169';context.font='500 31px -apple-system, BlinkMacSystemFont, "Noto Sans JP", sans-serif';context.fillText('URLを入力する必要はありません',width/2,1495);
}
function renderQrIntoBox(qr,context,x,y,maxSize){const modules=qr.getModuleCount(),quiet=4,cell=Math.max(1,Math.floor(maxSize/(modules+quiet*2))),size=(modules+quiet*2)*cell,left=Math.round(x+(maxSize-size)/2),top=Math.round(y+(maxSize-size)/2);context.imageSmoothingEnabled=false;context.fillStyle='#fff';context.fillRect(left,top,size,size);context.fillStyle='#000';for(let row=0;row<modules;row++)for(let col=0;col<modules;col++)if(qr.isDark(row,col))context.fillRect(left+(col+quiet)*cell,top+(row+quiet)*cell,cell,cell);context.imageSmoothingEnabled=true}
function drawFittedText(context,text,maxWidth,y,startSize,minSize){let size=startSize;do{context.font=`700 ${size}px -apple-system, BlinkMacSystemFont, "Noto Sans JP", sans-serif`;if(context.measureText(text).width<=maxWidth)break;size-=2}while(size>minSize);let shown=text;while(shown.length>1&&context.measureText(shown).width>maxWidth)shown=`${shown.slice(0,-2)}…`;context.fillText(shown,600,y)}
function roundedRect(context,x,y,width,height,radius){context.beginPath();context.roundRect?context.roundRect(x,y,width,height,radius):(context.rect(x,y,width,height))}
function loadCanvasImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src})}
function qrCanvasBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('QR画像を作成できませんでした。')),'image/png'))}
async function copyQrImage(canvas){try{const blob=await qrCanvasBlob(canvas);if(!navigator.clipboard?.write||!window.ClipboardItem)throw new Error();await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);toast('QR画像をコピーしました。')}catch{toast('QR画像をコピーできませんでした。「PNGで保存」をご利用ください。')}}
async function downloadQrImage(canvas){try{const blob=await qrCanvasBlob(canvas),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='排煙窓事前チェック_LINE用QR画像.png';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),1000);toast('LINE用QR画像をPNGで保存しました。')}catch(e){toast(e.message)}}
async function shareQrImage(canvas){try{const blob=await qrCanvasBlob(canvas),file=new File([blob],'排煙窓事前チェック_LINE用QR画像.png',{type:'image/png'});if(!navigator.canShare?.({files:[file]}))throw new Error();await navigator.share({title:'排煙窓事前チェック',text:`${settings.company.name}から、現地調査前の事前確認のお願いです。画像のQRコードから開いてください。`,files:[file]})}catch(e){if(e?.name!=='AbortError')toast('この端末では画像共有を利用できません。「PNGで保存」をご利用ください。')}}
async function loadLogo(file){if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>LOGO_MAX_SOURCE_BYTES){toast('ロゴはPNG・JPEG・WebP形式、1MB以下にしてください。');return}try{settings.company.logoDataUrl=await compressLogo(file);applySettings();updateCustomerUrlPreview();updateLogoStatus();toast('ロゴを圧縮しました。設定を保存してください。')}catch(e){toast(e.message||'ロゴを読み込めませんでした。別の画像を選んでください。')}}
async function compressLogo(file){const image=await loadLogoImage(file);try{if(!image.width||!image.height)throw new Error('ロゴ画像のサイズを確認できません。');const canvas=document.createElement('canvas');canvas.width=canvas.height=LOGO_EDGE;const context=canvas.getContext('2d',{alpha:true});if(!context)throw new Error('ロゴ画像を処理できません。');const scale=Math.min(LOGO_EDGE/image.width,LOGO_EDGE/image.height),width=Math.max(1,Math.round(image.width*scale)),height=Math.max(1,Math.round(image.height*scale));context.clearRect(0,0,LOGO_EDGE,LOGO_EDGE);context.drawImage(image,Math.round((LOGO_EDGE-width)/2),Math.round((LOGO_EDGE-height)/2),width,height);let smallest='';for(const quality of [.72,.58,.44,.3]){const dataUrl=canvas.toDataURL('image/webp',quality);if(!smallest||dataUrl.length<smallest.length)smallest=dataUrl;if(dataUrl.length<=LOGO_MAX_DATA_URL_LENGTH)return dataUrl}throw new Error(`圧縮後のロゴが共有上限を超えています。より単純な画像を選んでください（目安${LOGO_EDGE}×${LOGO_EDGE}px）。`)}finally{image.close?.()}}
async function loadLogoImage(file){if('createImageBitmap'in window)return createImageBitmap(file);return new Promise((resolve,reject)=>{const image=new Image(),url=URL.createObjectURL(file);image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('ロゴ画像を読み込めませんでした。'))};image.src=url})}
function removeLogo(){settings.company.logoDataUrl='';applySettings();updateCustomerUrlPreview();updateLogoStatus();toast('ロゴを削除しました。設定を保存してください。')}
function updateLogoStatus(){const status=document.querySelector('#companyLogoStatus');if(!status)return;status.replaceChildren();if(!settings.company.logoDataUrl)return;const text=document.createElement('span');text.textContent='ロゴ設定済み';const button=document.createElement('button');button.type='button';button.className='button ghost small';button.dataset.action='remove-logo';button.textContent='ロゴを削除';status.append(text,button)}
function resetAllSettings(){if(confirm('会社情報、料金、表示設定を初期値へ戻しますか？')){settings=applyCustomerConfigFromUrl(resetSettings(),location.href);storage.resetSettings();render();toast('初期設定に戻しました。')}}
function enhanceSettings(){
  const form=document.querySelector('#settingsForm'),branding=document.querySelector('#brandingSettingsFields'),resetRow=form?.querySelector('.settings-reset-row');if(!form||!branding||!resetRow)return;
  const logo=document.createElement('div');logo.className='field field--wide';logo.innerHTML='<label for="companyLogo">ロゴ画像</label><input id="companyLogo" type="file" accept="image/png,image/jpeg,image/webp"><p class="hint">PNG・JPEG・WebP形式、1MB以下。共有用に64×64pxへ自動圧縮します。</p><div class="logo-setting-status tool-row" id="companyLogoStatus"></div>';branding.append(logo);updateLogoStatus();
  const card=document.createElement('details');card.className='card settings-group';card.id='settings-detailed-pricing';card.innerHTML='<summary><span><strong>症状別料金・詳細条件</strong><small>修理内容別の価格帯、キャンセル、不在時の説明</small></span></summary><div class="settings-group__body"><div class="settings-fields-grid" id="detailedPricingFields"></div></div>';
  const fields=card.querySelector('#detailedPricingFields'),entries=[['キャンセル時の説明','inspection.cancellation','text'],['不在時の説明','inspection.absence','text'],['複数症状の追加確認費','pricing.additionalSymptomFee','number'],['ワイヤー交換 最低額','pricing.symptoms.wire.0','number'],['ワイヤー交換 最高額','pricing.symptoms.wire.1','number'],['ハンドル交換 最低額','pricing.symptoms.spins.0','number'],['ハンドル交換 最高額','pricing.symptoms.spins.1','number'],['オペレーター交換 最低額','pricing.symptoms.wontOpen.0','number'],['オペレーター交換 最高額','pricing.symptoms.wontOpen.1','number'],['調整作業 最低額','pricing.symptoms.heavy.0','number'],['調整作業 最高額','pricing.symptoms.heavy.1','number'],['その他作業 最低額','pricing.symptoms.other.0','number'],['その他作業 最高額','pricing.symptoms.other.1','number']];
  for(const [label,name,type] of entries){const wrap=document.createElement('div');wrap.className=`field${type==='text'?' field--wide':''}`;const lab=document.createElement('label');lab.htmlFor=name;lab.textContent=label;const input=document.createElement('input');input.id=input.name=name;input.type=type;input.value=name.split('.').reduce((o,k)=>o?.[k],settings)??'';wrap.append(lab,input);fields.append(wrap)}form.insertBefore(card,resetRow);
  if(!platform.tenantId){const security=document.createElement('details');security.className='card settings-group';security.innerHTML='<summary><span><strong>ログイン・パスコード</strong><small>この端末で業者設定を開くための保護設定</small></span></summary><div class="settings-group__body"><div class="settings-fields-grid"><div class="field field--wide"><p class="hint">次回から設定画面を開くときに使用します。4〜8桁の数字を設定してください。空欄の場合は変更しません。</p></div><div class="field"><label for="newSettingsPasscode">新しいパスコード</label><input id="newSettingsPasscode" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password"></div><div class="field"><label for="confirmSettingsPasscode">新しいパスコード（確認）</label><input id="confirmSettingsPasscode" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password"></div></div></div>';form.insertBefore(security,resetRow)}
  form.addEventListener('input',updateCustomerUrlPreview);form.addEventListener('change',updateCustomerUrlPreview);updateCustomerUrlPreview();
}
function enhanceShareControls(){
  const output=document.querySelector('#customerShareUrl'),field=output?.closest('.field'),message=document.querySelector('#customerShareUrlMessage'),original=document.querySelector('[data-action="save-and-copy-customer-url"]');
  if(!output||!field||!message||!original)return;
  const card=output.closest('.card'),form=document.querySelector('#settingsForm');
  card?.classList.add('customer-share-card','settings-priority-card');card.id='settings-share';
  const heading=card?.querySelector('h2');if(heading)heading.textContent='お客様へ事前確認ページを案内する';
  const description=card?.querySelector('h2 + p');if(description)description.textContent='会社情報と受付メールを確認したら、現地調査前の情報を受け取る専用ページをお客様へ送ります。';
  const steps=document.createElement('ol');steps.className='share-steps';steps.innerHTML='<li><strong>1</strong><span>会社情報・料金・受付先を確認</span></li><li><strong>2</strong><span>LINE・メール・QRで依頼者へ案内</span></li><li><strong>3</strong><span>事前確認内容を受付メールで確認</span></li>';
  description?.after(steps);
  output.type='hidden';field.querySelector('label')?.remove();
  const ready=document.createElement('div'),title=document.createElement('strong');ready.className='share-ready';title.textContent='お客様への案内を送信できます';ready.append(title,message);field.prepend(ready);
  const directButton=document.createElement('button');directButton.type='button';directButton.className='button';directButton.dataset.action='save-and-share-customer-link';directButton.textContent='LINE・SMSなどで直接送る';
  original.dataset.action='save-and-copy-email-link';original.className='button secondary';original.textContent='メール用の案内文をコピー';
  const qrButton=document.createElement('button');qrButton.type='button';qrButton.className='button line-share-button';qrButton.dataset.action='save-and-show-qr';qrButton.textContent='QRコード画像を作成・送信';
  const actions=document.createElement('div');actions.className='share-action-grid';original.before(actions);actions.append(directButton,original,qrButton);
  const details=document.createElement('details');details.innerHTML='<summary>URLだけをコピーする</summary><p class="hint">ホームページへの掲載など、URLそのものが必要な場合に使用してください。</p><button class="button ghost small" data-action="save-and-copy-customer-url" type="button">お客様用URLをコピー</button>';actions.after(details);
  if(card&&form)form.prepend(card);
}
function updateCustomerUrlPreview(){const form=document.querySelector('#settingsForm'),output=document.querySelector('#customerShareUrl'),message=document.querySelector('#customerShareUrlMessage');if(!form||!output)return;try{output.value=platform.tenantId?buildTenantCustomerUrl(platform.tenantId,location.href):buildCustomerUrl(settingsFromForm(form,settings),location.href);output.removeAttribute('aria-invalid');if(message)message.textContent=platform.tenantId?'会社専用の事前確認ページをメールまたはLINEでお客様へ案内できます。':'メールには短い表示リンク、LINEにはQR案内画像を使用します。長いURLは通常表示しません。'}catch(e){output.value='';output.setAttribute('aria-invalid','true');if(message)message.textContent=e.message}}

function normalizeCase(value){const c=value&&typeof value==='object'?value:createDraft(),defaults=createDraft();c.diagnosis??=defaults.diagnosis;if(!Array.isArray(c.diagnosis.symptoms))c.diagnosis.symptoms=c.diagnosis.symptom?[c.diagnosis.symptom]:[];c.diagnosis.symptoms=[...new Set(c.diagnosis.symptoms.filter(key=>typeof key==='string'))];c.diagnosis.symptom=c.diagnosis.symptoms[0]||c.diagnosis.symptom||'';c.diagnosis.interviewVersion=Number(c.diagnosis.interviewVersion)||1;if(!c.diagnosis.interviewAnswers||typeof c.diagnosis.interviewAnswers!=='object'||Array.isArray(c.diagnosis.interviewAnswers))c.diagnosis.interviewAnswers={};c.presentedResult??=null;c.submission={...defaults.submission,...(c.submission&&typeof c.submission==='object'?c.submission:{})};return c}

function renderVendorPasscodeGate(){
  const resetRequested=new URL(location.href).searchParams.get('resetPasscode')==='1';
  const state=platform.passcode||{},mode=resetRequested?'reset':state.configured?'verify':'register';
  const title=mode==='reset'?'パスコードを再設定':mode==='verify'?'パスコードを入力':'パスコードを登録';
  const intro=mode==='reset'?'メール確認が完了しました。新しいパスコードを登録してください。':mode==='verify'?'登録済みのパスコードを入力してください。':'初回利用のため、登録メールアドレス専用のパスコードを設定してください。';
  if(mode==='reset'&&!state.resetAllowed)return `<section class="screen"><div class="card stack empty-state"><p class="eyebrow">業者設定・運営者ログイン</p><h1>メール確認が必要です</h1><p>登録メールへパスコード再設定用リンクを送信します。</p><button class="button" data-action="vendor-passcode-reset-help" type="button">再設定メールを送る</button></div></section>`;
  return `<section class="screen"><div class="screen-header"><p class="eyebrow">業者設定・運営者ログイン</p><h1>${title}</h1><p class="screen-intro">${intro}</p><p class="hint">登録メール：${escapeHtml(platform.userEmail)}</p></div><div class="card stack"><div class="field"><label for="vendorPasscode">${mode==='verify'?'パスコード':'新しいパスコード'}</label><input id="vendorPasscode" type="password" inputmode="numeric" pattern="[0-9]*" minlength="6" maxlength="8" autocomplete="${mode==='verify'?'current-password':'new-password'}"><p class="hint">6〜8桁の数字。123456や同じ数字の繰り返しは使用できません。</p></div>${mode==='verify'?'':`<div class="field"><label for="vendorPasscodeConfirm">新しいパスコード（確認）</label><input id="vendorPasscodeConfirm" type="password" inputmode="numeric" pattern="[0-9]*" minlength="6" maxlength="8" autocomplete="new-password"></div>`}<p class="error" id="passcodeGateError" hidden></p><button class="button" data-action="submit-vendor-passcode" data-mode="${mode}" type="button">${mode==='verify'?'確認して設定を開く':'登録して設定を開く'}</button>${mode==='verify'?'<button class="button ghost" data-action="vendor-passcode-reset-help" type="button">パスコードを忘れた場合</button>':''}</div></section>`;
}

function renderVendorIdentityGate(){
  const hint=platform.tenant?.vendorEmailHint||'';
  return `<section class="screen"><div class="screen-header"><p class="eyebrow">業者設定</p><h1>登録メールを確認</h1><p class="screen-intro">初めて使う端末では、登録メールへ確認リンクを送信します。</p></div><div class="card stack"><div class="field"><label for="vendorIdentityEmail">登録メールアドレス</label><input id="vendorIdentityEmail" type="email" autocomplete="email" inputmode="email" placeholder="${escapeHtml(hint||'name@example.com')}"><p class="hint">登録メール：${escapeHtml(hint)}</p></div><p class="error" id="vendorIdentityError" hidden></p><button class="button" data-action="send-vendor-identity-link" type="button">確認リンクをメールで受け取る</button><p class="hint">リンクは15分間・1回限り有効です。メール確認後、この端末ではパスコードだけでログインできます。</p></div></section>`;
}

async function sendVendorIdentityLink(purpose='login'){
  if(new URL(location.href).searchParams.get('resetPasscode')==='1')purpose='reset';
  const input=document.querySelector('#vendorIdentityEmail'),error=document.querySelector('#vendorIdentityError'),button=document.querySelector('[data-action="send-vendor-identity-link"]'),email=input?.value.trim()||platform.userEmail;
  if(!email){showPasscodeError(error,input,'登録メールアドレスを入力してください。');return}
  button.disabled=true;
  try{const result=await requestVendorIdentityLink(platform.tenantId,{email,purpose});button.textContent='メールを送信しました';input.disabled=true;error.textContent=result.message;error.hidden=false;error.classList.add('is-success')}
  catch(caught){showPasscodeError(error,input,caught.message)}finally{button.disabled=false}
}

async function submitVendorPasscodeForm(){
  const button=document.querySelector('[data-action="submit-vendor-passcode"]'),mode=button?.dataset.mode,input=document.querySelector('#vendorPasscode'),confirmation=document.querySelector('#vendorPasscodeConfirm'),error=document.querySelector('#passcodeGateError');
  const passcode=input?.value.trim()||'';
  if(!/^\d{6,8}$/.test(passcode)){showPasscodeError(error,input,'パスコードは6〜8桁の数字で入力してください。');return}
  if(confirmation&&passcode!==confirmation.value.trim()){showPasscodeError(error,confirmation,'確認用パスコードが一致しません。');return}
  button.disabled=true;
  try{
    await submitVendorPasscode(platform.tenantId,{action:mode,passcode});
    const vendor=await loadVendorTenant(platform.tenantId);settings=mergePublicSettings(DEFAULT_SETTINGS,vendor.tenant.settings);platform.vendorAuthenticated=true;platform.passcode={configured:true,verified:true,resetAllowed:false};
    const url=new URL(location.href);url.searchParams.delete('resetPasscode');history.replaceState(null,'',url);appState.screen='settings';render();toast(mode==='verify'?'ログインしました。':'パスコードを登録しました。');
  }catch(caught){showPasscodeError(error,input,caught.message)}finally{button.disabled=false}
}

function showPasscodeError(error,input,message){if(error){error.textContent=message;error.hidden=false}input?.classList.add('is-invalid');input?.focus();input?.select()}

function showVendorResetHelp(){
  showModal('パスコードを再設定',`<p>登録メールアドレスへ、再設定用リンクを送信します。</p><p class="hint">リンクは15分間・1回限り有効です。Cloudflareのログイン画面は表示されません。</p><p class="error" id="resetPasscodeMailError" hidden></p>`,async()=>{const button=document.querySelector('#modalSave'),error=document.querySelector('#resetPasscodeMailError');button.disabled=true;try{const result=await requestVendorIdentityLink(platform.tenantId,{email:platform.userEmail,purpose:'reset'});button.textContent='メールを送信しました';error.textContent=result.message;error.hidden=false}catch(caught){error.textContent=caught.message;error.hidden=false;button.disabled=false}});document.querySelector('#modalSave').textContent='再設定メールを送る';
}

function showVendorChangePasscode(){showModal('パスコードを変更','<div class="field"><label for="currentVendorPasscode">現在のパスコード</label><input id="currentVendorPasscode" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password"></div><div class="field"><label for="newVendorPasscode">新しいパスコード</label><input id="newVendorPasscode" type="password" inputmode="numeric" minlength="6" maxlength="8" autocomplete="new-password"></div><div class="field"><label for="confirmVendorPasscode">新しいパスコード（確認）</label><input id="confirmVendorPasscode" type="password" inputmode="numeric" minlength="6" maxlength="8" autocomplete="new-password"></div><p class="error" id="changePasscodeError" hidden></p>',changeVendorPasscode);document.querySelector('#modalSave').textContent='変更する'}

async function changeVendorPasscode(){const current=document.querySelector('#currentVendorPasscode'),next=document.querySelector('#newVendorPasscode'),confirmation=document.querySelector('#confirmVendorPasscode'),error=document.querySelector('#changePasscodeError'),button=document.querySelector('#modalSave');if(!/^\d{6,8}$/.test(next.value.trim())){showPasscodeError(error,next,'新しいパスコードは6〜8桁の数字で入力してください。');return}if(next.value.trim()!==confirmation.value.trim()){showPasscodeError(error,confirmation,'確認用パスコードが一致しません。');return}button.disabled=true;try{await submitVendorPasscode(platform.tenantId,{action:'change',currentPasscode:current.value.trim(),newPasscode:next.value.trim()});closeModal();toast('パスコードを変更しました。')}catch(caught){showPasscodeError(error,current,caught.message)}finally{button.disabled=false}}

async function logoutVendor(){try{await clearVendorPasscodeSession(platform.tenantId);await clearVendorIdentitySession(platform.tenantId)}finally{location.href=buildTenantCustomerUrl(platform.tenantId,location.href)}}

async function enhanceTenantLicenseCard(){
  if(!platform.tenantId||!platform.vendorAuthenticated)return;
  const form=document.querySelector('#settingsForm');if(!form)return;const days=remainingTrialDays(platform.tenant);
  const card=document.createElement('div');card.className='card trial-admin-card settings-priority-card';card.innerHTML=`<div class="trial-admin-summary"><div><p class="eyebrow">${platform.tenant?.licenseType==='production'?'本番利用':'試験利用版'}</p><h2>${days===null?'契約・お支払いを管理':days===0?'無料体験は本日までです':`無料体験は残り${days}日です`}</h2><p class="hint">料金プランの申込、支払方法の変更、解約・再契約を専用画面で管理できます。</p></div><div><button class="button" type="button" data-action="vendor-contract">契約・お支払いを開く</button></div></div>`;form.prepend(card);
  try{const result=await loadVendorSubscription(platform.tenantId);if(result.subscription?.status==='past_due'){const warning=document.createElement('p');warning.className='error';warning.textContent='お支払いを確認できません。契約・お支払い画面から支払方法を更新してください。';card.append(warning)}}catch{}
}

function enhanceTenantSecurityCard(){if(!platform.tenantId||!platform.vendorAuthenticated)return;const form=document.querySelector('#settingsForm'),resetRow=form?.querySelector('.settings-reset-row');if(!form||!resetRow)return;const card=document.createElement('details');card.className='card settings-group';card.id='settings-security';card.innerHTML=`<summary><span><strong>ログイン・パスコード</strong><small>ログイン中：${escapeHtml(platform.userEmail)}</small></span></summary><div class="settings-group__body"><p class="hint">メール確認と登録者専用パスコードで保護されています。ログイン状態は24時間有効です。</p><div class="tool-row section"><button class="button secondary" type="button" data-action="vendor-change-passcode">パスコードを変更</button><button class="button ghost" type="button" data-action="vendor-logout">ログアウト</button></div></div>`;form.insertBefore(card,resetRow)}

function enhanceInquiryManagementCard(){if(!platform.tenantId||!platform.vendorAuthenticated)return;const form=document.querySelector('#settingsForm');if(!form||document.querySelector('#vendorInquiryCard'))return;const card=document.createElement('section');card.id='vendorInquiryCard';card.className='card settings-priority-card inquiry-entry-card';card.innerHTML='<div><p class="eyebrow">会社専用の受付管理</p><h2>受信した問い合わせ</h2><p>お客様から届いた問診結果を、この会社だけの管理画面で閲覧・検索できます。</p><p class="hint">他社の問い合わせと混在しません。サービス運営者が相談内容を閲覧する画面もありません。</p></div><div><strong id="vendorInquiryCount">確認中</strong><button class="button" data-action="vendor-inquiries" type="button">問い合わせ管理を開く</button></div>';form.prepend(card);loadVendorInquiries(platform.tenantId,{query:'',status:''}).then(result=>{platform.inquiries=result.inquiries||[];const count=document.querySelector('#vendorInquiryCount');if(count)count.textContent=`${platform.inquiries.length}件`}).catch(()=>{const count=document.querySelector('#vendorInquiryCount');if(count)count.textContent='再読込してください'})}

async function openVendorInquiries(){if(!platform.vendorAuthenticated)return;try{const result=await loadVendorInquiries(platform.tenantId,platform.inquiryFilters);platform.inquiries=result.inquiries||[];appState.screen='inquiries';render()}catch(error){toast(error.message)}}
async function searchVendorInquiries(){platform.inquiryFilters={query:document.querySelector('#inquiryQuery')?.value.trim()||'',status:document.querySelector('#inquiryStatus')?.value||''};await openVendorInquiries()}
async function resetVendorInquirySearch(){platform.inquiryFilters={query:'',status:''};await openVendorInquiries()}
async function exportVendorInquiryBackup(){
  const button=document.querySelector('[data-action="vendor-inquiry-export"]');if(button)button.disabled=true;
  try{
    const result=await exportVendorInquiriesCsv(platform.tenantId),url=URL.createObjectURL(result.blob),link=document.createElement('a');link.href=url;link.download=result.filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    const savedAt=new Date().toISOString();let savedAtRecorded=true;try{localStorage.setItem(inquiryBackupKey(),savedAt)}catch{savedAtRecorded=false}render();toast(`${result.count}件のCSVを保存しました。${savedAtRecorded?'':' この端末には保存日時を記録できませんでした。'}`);
  }catch(error){toast(error.message||'CSVを保存できませんでした。')}finally{if(button?.isConnected)button.disabled=false}
}
function inquiryBackupKey(){return `smoke-window-check:vendor-inquiry-backup:${platform.tenantId||'local'}`}
function readInquiryBackupAt(){try{return localStorage.getItem(inquiryBackupKey())||''}catch{return ''}}
async function openVendorInquiry(id){if(!id)return;try{const result=await loadVendorInquiries(platform.tenantId,{id});platform.currentInquiry=result.inquiry;appState.screen='inquiry-detail';render()}catch(error){toast(error.message)}}
async function saveVendorInquiryManagement(){const item=platform.currentInquiry;if(!item)return;const button=document.querySelector('[data-action="vendor-inquiry-save"]');if(button)button.disabled=true;try{const result=await updateVendorInquiry(platform.tenantId,{id:item.id,status:document.querySelector('#vendorInquiryStatus')?.value||item.status,assignee:document.querySelector('#vendorInquiryAssignee')?.value.trim()||'',internalMemo:document.querySelector('#vendorInquiryMemo')?.value.trim()||''});platform.currentInquiry=result.inquiry;render();toast('対応内容を保存しました。')}catch(error){toast(error.message)}finally{if(button?.isConnected)button.disabled=false}}
async function removeVendorInquiry(){const item=platform.currentInquiry;if(!item||!confirm(`受付番号 ${item.caseNumber} を削除しますか？この操作は元に戻せません。`))return;try{await deleteVendorInquiry(platform.tenantId,item.id);platform.currentInquiry=null;await openVendorInquiries();toast('問い合わせを削除しました。')}catch(error){toast(error.message)}}
function printVendorInquiry(){const item=platform.currentInquiry;if(!item?.inquiry)return;appState.draft=normalizeCase(clone(item.inquiry));printCurrentView()}

function requestSettingsAccess(){if(platform.tenantId){if(platform.vendorAuthenticated){appState.screen='settings';render();return}const url=new URL(location.href);url.searchParams.set('t',platform.tenantId);url.searchParams.set('admin','1');location.href=url.toString();return}showModal('業者設定を開く','<p>この画面は排煙窓会社の担当者専用です。</p><div class="field"><label for="settingsPasscode">パスコード</label><input id="settingsPasscode" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password"><p class="error" id="passcodeError" hidden></p></div>',verifySettingsPasscode);const save=document.querySelector('#modalSave');save.textContent='確認して開く';document.querySelector('#settingsPasscode').focus()}
async function verifySettingsPasscode(){const input=document.querySelector('#settingsPasscode'),error=document.querySelector('#passcodeError');if(!(await verifyPasscode(input.value,settings.security.settingsPasscodeHash))){error.textContent='パスコードが違います。';error.hidden=false;input.classList.add('is-invalid');input.select();return}closeModal();appState.screen='settings';render()}

function printCurrentView(){
  if(!appState.draft)return;
  document.querySelector('#printReport')?.remove();
  const previousTitle=document.title,customer=appState.draft.customer;
  const report=document.createElement('div');
  report.id='printReport';report.className='print-report';report.setAttribute('aria-hidden','true');
  report.innerHTML=renderPrintReport(appState.draft,settings);document.body.append(report);
  document.title=`排煙窓事前チェック_${customer?.companyName||customer?.storeName||customer?.facilityName||customer?.contactName||'相談内容'}`;
  document.body.classList.add('is-printing');
  let cleaned=false,fallback;
  const cleanup=()=>{if(cleaned)return;cleaned=true;clearTimeout(fallback);window.removeEventListener('afterprint',cleanup);document.title=previousTitle;document.body.classList.remove('is-printing');report.remove()};
  window.addEventListener('afterprint',cleanup,{once:true});
  fallback=setTimeout(cleanup,60000);
  try{window.print()}catch{cleanup();toast('印刷画面を開けませんでした。ブラウザのメニューから「印刷」または「プリント」を選択してください。')}
}
function customerGuideUrl(){try{return platform.tenantId?buildTenantCustomerUrl(platform.tenantId,location.href):buildCustomerUrl(settings,location.href)}catch{return ''}}
function renderGuideQr(){enhanceGuideVisuals();const canvas=document.querySelector('#guideQrCanvas'),url=customerGuideUrl();if(!canvas||!url||typeof window.qrcode!=='function')return;try{const qr=window.qrcode(0,'L');qr.addData(url,'Byte');qr.make();const context=canvas.getContext('2d');if(!context)return;context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);renderQrIntoBox(qr,context,0,0,canvas.width)}catch{canvas.closest('.customer-guide__qr')?.remove()}}
function enhanceGuideVisuals(){const steps=document.querySelector('.guide-steps');if(!steps||document.querySelector('.guide-visuals'))return;const demoPath='index.html?demo=1&embed=1&guidePreview=';const visuals=document.createElement('section');visuals.className='guide-visuals';visuals.setAttribute('aria-label','実際の画面で見る操作手順');visuals.innerHTML=`<h2>実際の画面で見る操作手順</h2><p class="guide-visuals__lead">現在のアプリ画面を表示しています。スマートフォン枠の中でも実際に操作できます。</p><div class="guide-screen-grid"><figure><div class="guide-screen-shot guide-screen-shot--phone"><iframe src="${demoPath}home" title="事前チェック開始画面の操作例" loading="lazy"></iframe></div><figcaption><b>1</b><span>緑色の「事前チェックを始める」を押します。</span></figcaption></figure><figure><div class="guide-screen-shot guide-screen-shot--phone"><iframe src="${demoPath}2" title="症状選択画面の操作例" loading="lazy"></iframe></div><figcaption><b>2</b><span>当てはまる症状を選び、「次へ進む」を押します。症状は複数選べます。</span></figcaption></figure><figure><div class="guide-screen-shot guide-screen-shot--phone"><iframe src="${demoPath}3" title="写真と動画の選択画面の操作例" loading="lazy"></iframe></div><figcaption><b>3</b><span>排煙窓の全体・操作部分・不具合箇所を撮影し、写真・動画を選びます。</span></figcaption></figure><figure><div class="guide-screen-shot guide-screen-shot--phone"><iframe src="${demoPath}7" title="内容確認と送信画面の操作例" loading="lazy"></iframe></div><figcaption><b>4</b><span>内容と概算料金を確認し、保存後に問診内容を業者へ送信します。</span></figcaption></figure></div><p class="guide-visuals__note">会社ごとの設定により、会社名・料金・案内文の表示は異なります。</p>`;steps.before(visuals)}
function renderPlatformUnavailable(code,tenant=null){platform.initializing=false;platform.blocked=true;progress.hidden=true;document.querySelector('#settingsButton').hidden=true;document.querySelector('#homeButton').disabled=true;const expired=code==='expired',suspended=code==='suspended',invalid=code==='invalid'||code==='invalid_tenant'||code==='not_found';const title=expired?'試験利用期間が終了しました':suspended?'現在ご利用いただけません':invalid?'お客様用URLを確認できません':'利用情報を確認できません';const detail=expired?'この事前チェックの利用期間は終了しています。排煙窓会社へ直接お問い合わせください。':suspended?'この事前チェックは現在停止されています。排煙窓会社へ直接お問い合わせください。':invalid?'案内されたURLをもう一度ご確認ください。':'通信状態を確認し、時間をおいて再度お試しください。';headerCompany.textContent=tenant?.companyName||'排煙窓事前チェック';main.innerHTML=`<section class="screen"><div class="card empty-state"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(detail)}</p></div></section>`}
function showHelp(){showModal('使い方',`<ol><li>依頼者情報と現場住所を入力します。</li><li>症状を選び、必要に応じて写真や動画を選びます。</li><li>質問に答えると修理費用の目安が表示されます。</li><li>現地調査費の条件を確認し、業者へ問診結果を送信します。</li></ol><p>送信後の問診回答は、案内元の会社専用管理領域へ保存されます。写真・動画の実データはサーバーに保存されません。</p>`)}
function showModal(title,body,onSave=null,memo=''){document.querySelector('#modalRoot').innerHTML=`<div class="modal-backdrop" role="presentation"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><h2 id="modalTitle"></h2><div id="modalBody"></div><div class="modal-actions section">${onSave?'<button class="button" id="modalSave">保存</button>':''}<button class="button secondary" id="modalClose">閉じる</button></div></div></div>`;document.querySelector('#modalTitle').textContent=title;document.querySelector('#modalBody').innerHTML=body;if(document.querySelector('#caseMemo'))document.querySelector('#caseMemo').value=memo;document.querySelector('#modalClose').onclick=closeModal;if(onSave)document.querySelector('#modalSave').onclick=onSave;document.querySelector('#modalClose').focus()}
function closeModal(){document.querySelector('#modalRoot').innerHTML=''}
function toast(msg){const t=document.querySelector('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.id);toast.id=setTimeout(()=>t.hidden=true,3200)}
