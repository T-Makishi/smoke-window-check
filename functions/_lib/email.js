import {database} from './db.js';
import {serviceAdminEmail} from './auth.js';
import {HttpError} from './http.js';
import {LABELS} from '../../js/estimate-config.js';
import {symptomLabels} from '../../js/estimate.js';
import {interviewRows} from '../../js/interview-config.js';

const BREVO_ENDPOINT='https://api.brevo.com/v3/smtp/email';

export async function deliverEmail(env,{eventKey,eventType,to,toName='',replyTo=null,subject,textContent,htmlContent,tenantId=null,applicationId=null}){
  const existing=await database(env).prepare('SELECT status, provider_message_id FROM email_events WHERE event_key=?1').bind(eventKey).first();
  if(existing?.status==='sent')return {sent:true,messageId:existing.provider_message_id,deduplicated:true};
  const apiKey=String(env.BREVO_API_KEY||''),senderEmail=String(env.EMAIL_SENDER_ADDRESS||env.SERVICE_ADMIN_EMAIL||''),senderName=String(env.EMAIL_SENDER_NAME||'排煙窓事前チェック運営事務局');
  if(!apiKey||!senderEmail)throw new HttpError(503,'email_not_configured','メール送信設定が完了していません。運営者へお問い合わせください。');
  const recipient={email:to};
  if(String(toName||'').trim())recipient.name=String(toName).trim();
  let response,data={};
  try{
    response=await fetch(BREVO_ENDPOINT,{method:'POST',headers:{accept:'application/json','content-type':'application/json','api-key':apiKey},body:JSON.stringify({sender:{email:senderEmail,name:senderName},to:[recipient],replyTo:replyTo||{email:senderEmail,name:senderName},subject,textContent,htmlContent,tags:['smoke-window-check',eventType]})});
    data=await response.json().catch(()=>({}));
  }catch(error){await recordEmail(env,{eventKey,eventType,to,tenantId,applicationId,status:'failed',errorMessage:'network_error'});throw new HttpError(503,'email_delivery_failed','確認メールを送信できませんでした。時間をおいて再度お試しください。')}
  if(!response.ok){await recordEmail(env,{eventKey,eventType,to,tenantId,applicationId,status:'failed',errorMessage:String(data.message||`HTTP ${response.status}`).slice(0,500)});throw new HttpError(503,'email_delivery_failed','確認メールを送信できませんでした。時間をおいて再度お試しください。')}
  await recordEmail(env,{eventKey,eventType,to,tenantId,applicationId,status:'sent',messageId:String(data.messageId||'')});
  return {sent:true,messageId:data.messageId||null,deduplicated:false};
}

export async function sendInquiryReceivedEmail(env,{tenantId,inquiryId,caseNumber,companyName,recipient,inquiry}){
  const {text,html,customerName}=formatInquiryReceivedEmail({caseNumber,companyName,inquiry});
  const customer=inquiry.customer;
  const replyTo=customer.email?{email:customer.email,name:customer.contactName||customerName}:null;
  return deliverEmail(env,{eventKey:`inquiry-received:${inquiryId}`,eventType:'inquiry_received',to:recipient,toName:companyName,replyTo,subject:`【排煙窓事前チェック／${caseNumber}】${customerName}`,textContent:text,htmlContent:html,tenantId});
}

export function formatInquiryReceivedEmail({caseNumber,companyName,inquiry}){
  const customer=inquiry.customer,site=inquiry.site,diagnosis=inquiry.diagnosis,estimate=inquiry.estimate,inspection=inquiry.inspectionFee,media=inquiry.media,result=inquiry.presentedResult||{};
  const customerName=customer.companyName||customer.storeName||customer.facilityName||customer.contactName;
  const address=[site.postalCode&&`〒${site.postalCode}`,site.prefecture,site.city,site.address,site.buildingName,site.floor,site.room].filter(Boolean).join(' ');
  const questions=interviewRows(diagnosis);
  const informationSections=[
    ['受付情報', [['受付番号',caseNumber]]],
    ['ご依頼者情報', [
      ['依頼者区分',LABELS.customerType[inquiry.customerType]||inquiry.customerType],['会社・店舗・施設名',customerName],
      ['担当者名',customer.contactName],['電話番号',customer.phone],['メール',customer.email||'未入力']
    ]],
    ['現場・症状', [
      ['現場住所',address],['現場名',site.siteName||'未入力'],['症状',symptomLabels(diagnosis).join('、')||'未入力'],
      ['メーカー',diagnosis.makerName||'不明'],['設置高さ',LABELS.height[diagnosis.heightType]||diagnosis.heightType||'未入力'],
      ['対象数量',LABELS.quantity[diagnosis.quantity]||diagnosis.quantity||'未入力'],['緊急度',LABELS.urgency[diagnosis.urgency]||diagnosis.urgency||'未入力'],
      ['補足',diagnosis.notes||'なし']
    ]]
  ];
  const resultRows=[
    ['確認が必要な内容',result.summary],
    ['不足している情報',Array.isArray(result.missingItems)&&result.missingItems.length?result.missingItems.join('、'):result.missingItems?.length===0?'現在の入力項目はそろっています':'未入力'],
    ['次の対応',result.recommendation||result.nextAction],
    ['安全上のご案内',result.safetyNotice],
    ['注意事項',result.disclaimer]
  ].filter(([,value])=>value);
  const closingSections=[
    ['費用のご案内', [
      ['概算費用',`${formatYen(estimate.minimumPrice)}〜${formatYen(estimate.maximumPrice)}`],
      ['現地調査費',`現地調査のみの場合 ${formatYen(inspection.amount)}`],
      ['工事を正式依頼',`工事代金から${formatYen(inspection.deductionOnFormalOrder)}を差し引く`],
      ['現地調査費確認',inspection.agreed?'確認済み':'未確認']
    ]],
    ['添付ファイル', [['写真・動画',`${media.count}点`],['保存状況','写真・動画の実データはメール・サーバーに保存されません']]]
  ];
  const textSections=sections=>sections.map(([title,rows])=>`■ ${title}\n${rows.map(([label,value])=>`${label}：${value}`).join('\n')}`).join('\n\n');
  const questionText=questions.length
    ?questions.map(([question,answer],index)=>`Q${index+1}. ${question}\nA. ${answer}`).join('\n\n')
    :'回答はありません。';
  const resultText=resultRows.length?`\n\n■ お客様に提示した事前チェック結果\n${resultRows.map(([label,value])=>`${label}：\n  ${value}`).join('\n')}`:'';
  const text=`${companyName} ご担当者様\n\n新しい排煙窓事前チェックを受け付けました。\n\n${textSections(informationSections)}\n\n■ 選択式問診の回答\n${questionText}${resultText}\n\n${textSections(closingSections)}\n\n業者設定画面の「問い合わせ管理」で詳細・対応状況・社内メモを確認できます。`;
  const informationHtml=informationSections.map(([title,rows])=>emailSection(title,rows)).join('');
  const closingHtml=closingSections.map(([title,rows])=>emailSection(title,rows)).join('');
  const questionHtml=questions.length
    ?questions.map(([question,answer],index)=>`<div style="margin:0 0 16px"><p style="margin:0 0 5px;font-weight:700;color:#0d2b45">Q${index+1}. ${escapeHtml(question)}</p><p style="margin:0;padding:10px 12px;background:#eef6f1;border-left:4px solid #1e5e3a">A. ${escapeHtml(answer)}</p></div>`).join('')
    :'<p>回答はありません。</p>';
  const resultHtml=resultRows.length?emailSection('お客様に提示した事前チェック結果',resultRows,{stacked:true}):'';
  const html=`<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif;color:#1f2b25;line-height:1.7;max-width:720px"><p>${escapeHtml(companyName)} ご担当者様</p><h2 style="color:#0d2b45;margin-bottom:8px">新しい排煙窓事前チェック</h2><p style="margin-top:0">見出しごとに内容を整理しています。</p>${informationHtml}<h3 style="color:#1e5e3a;border-bottom:2px solid #1e5e3a;padding-bottom:6px">選択式問診の回答</h3>${questionHtml}${resultHtml}${closingHtml}<p style="margin-top:24px;padding:14px;background:#f3f6f4">業者設定画面の「問い合わせ管理」で詳細・対応状況・社内メモを確認できます。</p></div>`;
  return {text,html,customerName};
}

export async function sendVerificationEmail(env,{applicationId,companyName,contactName,email,verificationUrl,tokenHash}){
  const subject='【排煙窓事前チェック】7日間無料体験のメール確認';
  const text=`${contactName} 様\n\n7日間無料体験のお申込みありがとうございます。\n次のURLを30分以内に開き、メールアドレスを確認してください。\n\n${verificationUrl}\n\n会社名：${companyName}\nこのメールに心当たりがない場合は操作不要です。`;
  const html=`<p>${escapeHtml(contactName)} 様</p><p>7日間無料体験のお申込みありがとうございます。</p><p><a href="${escapeHtml(verificationUrl)}" style="display:inline-block;padding:14px 22px;color:#fff;background:#1e5e3a;border-radius:8px;text-decoration:none;font-weight:700">メールを確認して無料体験を開始</a></p><p>このリンクは30分間有効です。</p><p>会社名：${escapeHtml(companyName)}</p><p style="color:#65736c">このメールに心当たりがない場合は操作不要です。</p>`;
  return deliverEmail(env,{eventKey:`verification:${applicationId}:${tokenHash.slice(0,16)}`,eventType:'trial_verification',to:email,toName:contactName,subject,textContent:text,htmlContent:html,applicationId});
}

export async function sendTrialIssuedEmail(env,{applicationId,tenantId,companyName,contactName,email,customerUrl,adminUrl,expiresAt}){
  const subject='【排煙窓事前チェック】7日間無料体験を開始しました';
  const expiry=formatJapan(expiresAt),text=`${contactName} 様\n\n無料体験の専用環境を発行しました。\n\n業者識別番号：${tenantId}\n業者設定URL：${adminUrl}\nお客様案内URL：${customerUrl}\n利用期限：${expiry}\n\n最初に業者設定URLを開き、受付メール、会社情報、料金を確認してください。設定後、お客様案内URLを顧客へ共有してください。`;
  const html=`<p>${escapeHtml(contactName)} 様</p><p><strong>${escapeHtml(companyName)}</strong> 専用の7日間無料体験を発行しました。</p><table style="border-collapse:collapse"><tr><th style="text-align:left;padding:6px">業者識別番号</th><td style="padding:6px">${escapeHtml(tenantId)}</td></tr><tr><th style="text-align:left;padding:6px">利用期限</th><td style="padding:6px">${escapeHtml(expiry)}</td></tr></table><p><a href="${escapeHtml(adminUrl)}">業者設定を開く</a></p><p><a href="${escapeHtml(customerUrl)}">お客様用画面を開く</a></p><ol><li>業者設定で受付メール、会社情報、料金を確認します。</li><li>お客様用URLを顧客へ案内します。</li><li>顧客の問診は設定した受付メール宛てに送信されます。</li></ol>`;
  return deliverEmail(env,{eventKey:`trial-issued:${applicationId}`,eventType:'trial_issued',to:email,toName:contactName,subject,textContent:text,htmlContent:html,tenantId,applicationId});
}

export async function sendVendorLoginEmail(env,{tenantId,companyName,email,purpose,verificationUrl,tokenHash}){
  const reset=purpose==='reset',subject=reset?'【排煙窓事前チェック】パスコード再設定の確認':'【排煙窓事前チェック】業者設定ログインの確認';
  const action=reset?'パスコードを再設定する':'業者設定を開く';
  const text=`${companyName} ご担当者様\n\n${action}には、次のURLを15分以内に開いてください。\n\n${verificationUrl}\n\nこのリンクは1回限り有効です。心当たりがない場合は操作不要です。`;
  const html=`<p>${escapeHtml(companyName)} ご担当者様</p><p>${escapeHtml(action)}には、次のボタンを15分以内に押してください。</p><p><a href="${escapeHtml(verificationUrl)}" style="display:inline-block;padding:14px 22px;color:#fff;background:#1e5e3a;border-radius:8px;text-decoration:none;font-weight:700">${escapeHtml(action)}</a></p><p>このリンクは1回限り有効です。</p><p style="color:#65736c">心当たりがない場合は操作不要です。</p>`;
  return deliverEmail(env,{eventKey:`vendor-${purpose}:${tenantId}:${tokenHash.slice(0,16)}`,eventType:`vendor_${purpose}`,to:email,subject,textContent:text,htmlContent:html,tenantId});
}

export async function sendOperatorApplicationNotice(env,{applicationId,tenantId,companyName,contactName,email,phone,serviceUrl}){
  const operator=await serviceAdminEmail(env);if(!operator)return {sent:false};
  const subject=`【新規無料体験】${companyName}`;
  const text=`無料体験が開始されました。\n会社名：${companyName}\n担当者：${contactName}\nメール：${email}\n電話：${phone}\n業者識別番号：${tenantId}\n\n${serviceUrl}`;
  return deliverEmail(env,{eventKey:`operator-application:${applicationId}`,eventType:'operator_application',to:operator,subject,textContent:text,htmlContent:`<h2>無料体験が開始されました</h2><p>会社名：${escapeHtml(companyName)}<br>担当者：${escapeHtml(contactName)}<br>メール：${escapeHtml(email)}<br>電話：${escapeHtml(phone)}<br>業者識別番号：${escapeHtml(tenantId)}</p><p><a href="${escapeHtml(serviceUrl)}">運営管理画面を開く</a></p>`,tenantId,applicationId});
}

export async function sendExpiryReminder(env,{tenantId,companyName,email,days,expiresAt,adminUrl}){
  const label=days===1?'明日':`あと${days}日`,subject=`【排煙窓事前チェック】無料体験の終了まで${label}です`,expiry=formatJapan(expiresAt);
  const text=`${companyName} ご担当者様\n\n7日間無料体験の終了まで${label}です。\n利用期限：${expiry}\n\n本番利用をご希望の場合は、業者設定画面からお申し込みください。\n${adminUrl}`;
  return deliverEmail(env,{eventKey:`trial-reminder:${tenantId}:${days}`,eventType:`trial_reminder_${days}`,to:email,subject,textContent:text,htmlContent:`<p>${escapeHtml(companyName)} ご担当者様</p><p>7日間無料体験の終了まで<strong>${escapeHtml(label)}</strong>です。</p><p>利用期限：${escapeHtml(expiry)}</p><p><a href="${escapeHtml(adminUrl)}">業者設定・本番利用申込を開く</a></p>`,tenantId});
}

export async function sendProductionRequestNotice(env,{tenantId,companyName,applicantName,email,note,serviceUrl,requestedAt}){
  const operator=await serviceAdminEmail(env);if(!operator)return {sent:false};
  return deliverEmail(env,{eventKey:`production-request:${tenantId}:${requestedAt}`,eventType:'production_request',to:operator,subject:`【本番利用申込】${companyName}`,textContent:`本番利用の相談申込が届きました。\n会社名：${companyName}\n担当者：${applicantName}\n登録メール：${email}\n連絡事項：${note||'なし'}\n\n${serviceUrl}`,htmlContent:`<h2>本番利用の相談申込</h2><p>会社名：${escapeHtml(companyName)}<br>担当者：${escapeHtml(applicantName)}<br>登録メール：${escapeHtml(email)}</p><p>連絡事項：${escapeHtml(note||'なし')}</p><p><a href="${escapeHtml(serviceUrl)}">運営管理画面を開く</a></p>`,tenantId});
}

export async function sendProductionApprovedEmail(env,{tenantId,companyName,email,adminUrl}){
  return deliverEmail(env,{eventKey:`production-approved:${tenantId}`,eventType:'production_approved',to:email,subject:'【排煙窓事前チェック】本番利用へ切り替わりました',textContent:`${companyName} ご担当者様\n\n排煙窓事前チェックを期限のない本番利用へ切り替えました。\nこれまでのお客様用URLと設定をそのまま継続して使用できます。\n\n業者設定：${adminUrl}`,htmlContent:`<p>${escapeHtml(companyName)} ご担当者様</p><p>排煙窓事前チェックを<strong>本番利用</strong>へ切り替えました。</p><p>これまでのお客様用URLと設定をそのまま継続して使用できます。</p><p><a href="${escapeHtml(adminUrl)}">業者設定を開く</a></p>`,tenantId});
}

export async function sendServiceEmailChangeCode(env,{requestId,currentEmail,newEmail,code}){
  const subject='【排煙窓事前チェック】運営者メール変更の確認コード';
  const text=`運営者メールアドレスを変更します。\n\n新しいメール：${newEmail}\n確認コード：${code}\n\nこのコードは10分間有効です。心当たりがない場合は操作を中止してください。`;
  const html=`<h2>運営者メールアドレスの変更</h2><p>次の確認コードを管理画面へ入力してください。</p><p style="font-size:32px;font-weight:800;letter-spacing:.18em">${escapeHtml(code)}</p><p>新しいメール：${escapeHtml(newEmail)}<br>有効時間：10分</p><p style="color:#65736c">心当たりがない場合は操作を中止してください。</p>`;
  return deliverEmail(env,{eventKey:`service-email-change:${requestId}`,eventType:'service_email_change',to:newEmail,subject,textContent:text,htmlContent:html});
}

export async function sendServiceEmailChangedNotice(env,{currentEmail,newEmail}){
  const subject='【排煙窓事前チェック】運営者メールを変更しました',text=`サービス運営者のログインIDと申込通知先を変更しました。\n\n変更前：${currentEmail}\n変更後：${newEmail}\n\n次回から新しいメールアドレスでログインしてください。`;
  const deliveries=[currentEmail,newEmail].map((recipient,index)=>deliverEmail(env,{eventKey:`service-email-changed:${newEmail}:${index}`,eventType:'service_email_changed',to:recipient,subject,textContent:text,htmlContent:`<h2>運営者メールを変更しました</h2><p>変更前：${escapeHtml(currentEmail)}<br>変更後：${escapeHtml(newEmail)}</p><p>次回から新しいメールアドレスでログインしてください。</p>`}));
  return Promise.allSettled(deliveries);
}

async function recordEmail(env,{eventKey,eventType,to,tenantId,applicationId,status,messageId=null,errorMessage=null}){
  await database(env).prepare('INSERT INTO email_events (event_key,event_type,recipient,tenant_id,application_id,status,provider_message_id,error_message,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9) ON CONFLICT(event_key) DO UPDATE SET status=excluded.status,provider_message_id=excluded.provider_message_id,error_message=excluded.error_message,created_at=excluded.created_at').bind(eventKey,eventType,to,tenantId,applicationId,status,messageId,errorMessage,new Date().toISOString()).run();
}

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function emailSection(title,rows,{stacked=false}={}){
  const body=stacked
    ?rows.map(([label,value])=>`<div style="padding:10px 0;border-bottom:1px solid #d9e2dd"><strong style="display:block;color:#0d2b45;margin-bottom:3px">${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`).join('')
    :`<table role="presentation" style="border-collapse:collapse;width:100%">${rows.map(([label,value])=>`<tr><th style="width:34%;padding:8px;text-align:left;vertical-align:top;border-bottom:1px solid #d9e2dd;color:#0d2b45">${escapeHtml(label)}</th><td style="padding:8px;vertical-align:top;border-bottom:1px solid #d9e2dd">${escapeHtml(value)}</td></tr>`).join('')}</table>`;
  return `<h3 style="color:#1e5e3a;border-bottom:2px solid #1e5e3a;padding-bottom:6px;margin-top:26px">${escapeHtml(title)}</h3>${body}`;
}
function formatJapan(value){return new Intl.DateTimeFormat('ja-JP',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Tokyo'}).format(new Date(value))}
function formatYen(value){return `${Number(value||0).toLocaleString('ja-JP')}円`}
