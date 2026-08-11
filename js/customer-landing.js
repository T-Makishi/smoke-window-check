import {DEFAULT_SETTINGS} from './estimate-config.js';
import {buildTenantCustomerUrl,isTenantUrl,loadPublicTenant,mergePublicSettings,readTenantId} from './cloudflare-platform.js';

const main=document.querySelector('#customerLanding');
const tenantId=readTenantId(location.href);
const requestedTenant=isTenantUrl(location.href);

initialize();

async function initialize(){
  if(requestedTenant&&!tenantId){renderError('案内URLが正しくありません。','業者から届いたURLをもう一度開いてください。');return}
  if(!tenantId){renderLanding(structuredClone(DEFAULT_SETTINGS),{demo:true});return}
  try{
    const result=await loadPublicTenant(tenantId),settings=mergePublicSettings(DEFAULT_SETTINGS,result.tenant.settings);
    renderLanding(settings,{tenantId,tenant:result.tenant});
  }catch(error){
    const message=error.code==='expired'?'無料体験の利用期間が終了しています。':error.message;
    renderError('この案内ページを開けません',message);
  }
}

function renderLanding(settings,{demo=false,tenantId='',tenant=null}={}){
  const companyName=demo?'サンプル排煙窓サービス':settings.company.name;
  const questionnaireUrl=demo?new URL('/?demo=1',location.origin).toString():buildTenantCustomerUrl(tenantId,location.href);
  const phone=String(settings.company.phone||'').trim(),tel=phone.replace(/[^0-9+]/g,'');
  const fee=Number(settings.inspection.fee||0).toLocaleString('ja-JP');
  const logo=settings.company.logoDataUrl?.startsWith('data:image/')?`<img src="${escapeHtml(settings.company.logoDataUrl)}" alt="${escapeHtml(companyName)} ロゴ">`:`<span aria-hidden="true">窓</span>`;
  document.title=`${companyName} | 排煙窓事前見積`;
  document.querySelector('#headerCompany').textContent=companyName;
  main.innerHTML=`
    ${demo?'<div class="demo-ribbon" role="status"><strong>操作デモ</strong><span>入力内容は保存・送信されません</span></div>':''}
    <section class="customer-hero">
      <div class="customer-shell customer-hero__grid">
        <div class="customer-hero__copy">
          <p class="customer-eyebrow">${escapeHtml(companyName)}からのご案内</p>
          <h1>排煙窓の状態を、<br><em>写真と質問で伝えられます。</em></h1>
          <p class="customer-lead">専門知識やアプリのインストールは不要です。画面に沿って入力すると、修理会社へ相談する内容を約3分で整理できます。</p>
          <div class="customer-hero__actions">
            <a class="button customer-primary" href="${escapeHtml(questionnaireUrl)}">${demo?'事前見積デモを体験する':'事前見積を始める'} <span aria-hidden="true">→</span></a>
            <a class="customer-text-link" href="#guide">先に操作方法を見る</a>
          </div>
          <ul class="customer-trust"><li>ログイン不要</li><li>入力目安 約3分</li><li>スマホ・PC対応</li></ul>
        </div>
        <div class="customer-hero__card" aria-label="ご案内元の会社情報">
          <div class="company-logo">${logo}</div>
          <p>ご案内元</p><h2>${escapeHtml(companyName)}</h2>
          <dl><div><dt>事前チェック</dt><dd>無料</dd></div><div><dt>現地調査費</dt><dd>${fee}円</dd></div></dl>
          <small>表示金額は概算です。正式見積もりには現地確認が必要な場合があります。</small>
        </div>
      </div>
    </section>

    <section class="customer-guide-section" id="guide">
      <div class="customer-shell">
        <div class="customer-section-title"><p class="customer-eyebrow">かんたん4ステップ</p><h2>この順番で進めます</h2><p>途中で前の画面に戻れます。分からない質問は「分からない」を選べます。</p></div>
        <ol class="customer-steps">
          <li><div class="step-visual step-visual--tap"><span class="mini-phone"><i></i><b>事前チェックを始める</b></span></div><div><span class="step-number">1</span><h3>案内を開いて開始</h3><p>緑色の「事前チェックを始める」を押します。</p></div></li>
          <li><div class="step-visual"><span class="mini-form"><i></i><i></i><i></i><b>次へ進む</b></span></div><div><span class="step-number">2</span><h3>質問に答える</h3><p>お名前、場所、症状を分かる範囲で入力します。</p></div></li>
          <li><div class="step-visual"><span class="camera-icon" aria-hidden="true"><i></i></span></div><div><span class="step-number">3</span><h3>写真を撮る</h3><p>窓全体、操作部分、不具合箇所を撮影します。</p></div></li>
          <li><div class="step-visual"><span class="mail-icon" aria-hidden="true">✓</span></div><div><span class="step-number">4</span><h3>内容を確認して送る</h3><p>メール画面で写真を添付し、修理会社へ送信します。</p></div></li>
        </ol>
      </div>
    </section>

    <section class="photo-guide">
      <div class="customer-shell photo-grid">
        <div><p class="customer-eyebrow">撮影のポイント</p><h2>この3枚があると<br>状況が伝わりやすくなります</h2><p>危険な場所へ登る必要はありません。安全に撮影できる範囲だけで構いません。</p></div>
        <div class="photo-examples"><figure><div class="window-picture window-picture--wide"><i></i><i></i></div><figcaption><b>1. 窓全体</b><span>窓と周囲が入るように</span></figcaption></figure><figure><div class="window-picture window-picture--handle"><i></i></div><figcaption><b>2. 操作部分</b><span>ハンドルや開閉装置</span></figcaption></figure><figure><div class="window-picture window-picture--label"><i>型式</i></div><figcaption><b>3. ラベル</b><span>メーカー名・型式</span></figcaption></figure></div>
      </div>
    </section>

    <section class="customer-notes">
      <div class="customer-shell notes-grid">
        <div><h2>送信前にご確認ください</h2><ul><li>写真・動画は自動送信されません。メール画面でご自身で添付してください。</li><li>概算金額は問診内容に基づく目安であり、正式見積もりではありません。</li><li>入力内容は使用中の端末に保存されます。共用端末では保存しないでください。</li></ul></div>
        <aside><strong>操作にお困りの場合</strong><span>${escapeHtml(companyName)}</span>${phone?`<a href="tel:${escapeHtml(tel)}">${escapeHtml(phone)}</a>`:'<small>案内元の業者へお問い合わせください。</small>'}</aside>
      </div>
    </section>

    <section class="customer-final-cta">
      <div class="customer-shell"><h2>準備ができたら始めましょう</h2><p>入力途中でも前の画面へ戻って修正できます。</p><div><a class="button customer-primary" href="${escapeHtml(questionnaireUrl)}">${demo?'事前見積デモを体験する':'事前見積を始める'} <span aria-hidden="true">→</span></a><button class="button secondary" id="printGuide" type="button">操作ガイドを印刷・PDF保存</button></div>${demo?'<a class="business-return" href="/trial.html">業者向けサービス案内へ戻る</a>':''}</div>
    </section>`;
  document.querySelector('#printGuide')?.addEventListener('click',()=>window.print());
}

function renderError(title,message){
  main.innerHTML=`<section class="customer-error"><div class="customer-error__mark" aria-hidden="true">!</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><p>この案内を送った業者へお問い合わせください。</p></section>`;
}

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
