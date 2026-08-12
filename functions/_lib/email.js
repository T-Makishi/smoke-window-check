import {database} from './db.js';
import {serviceAdminEmail} from './auth.js';
import {HttpError} from './http.js';

const BREVO_ENDPOINT='https://api.brevo.com/v3/smtp/email';

export async function deliverEmail(env,{eventKey,eventType,to,toName='',subject,textContent,htmlContent,tenantId=null,applicationId=null}){
  const existing=await database(env).prepare('SELECT status, provider_message_id FROM email_events WHERE event_key=?1').bind(eventKey).first();
  if(existing?.status==='sent')return {sent:true,messageId:existing.provider_message_id,deduplicated:true};
  const apiKey=String(env.BREVO_API_KEY||''),senderEmail=String(env.EMAIL_SENDER_ADDRESS||env.SERVICE_ADMIN_EMAIL||''),senderName=String(env.EMAIL_SENDER_NAME||'排煙窓事前チェック運営事務局');
  if(!apiKey||!senderEmail)throw new HttpError(503,'email_not_configured','メール送信設定が完了していません。運営者へお問い合わせください。');
  let response,data={};
  try{
    response=await fetch(BREVO_ENDPOINT,{method:'POST',headers:{accept:'application/json','content-type':'application/json','api-key':apiKey},body:JSON.stringify({sender:{email:senderEmail,name:senderName},to:[{email:to,name:toName}],replyTo:{email:senderEmail,name:senderName},subject,textContent,htmlContent,tags:['smoke-window-check',eventType]})});
    data=await response.json().catch(()=>({}));
  }catch(error){await recordEmail(env,{eventKey,eventType,to,tenantId,applicationId,status:'failed',errorMessage:'network_error'});throw new HttpError(503,'email_delivery_failed','確認メールを送信できませんでした。時間をおいて再度お試しください。')}
  if(!response.ok){await recordEmail(env,{eventKey,eventType,to,tenantId,applicationId,status:'failed',errorMessage:String(data.message||`HTTP ${response.status}`).slice(0,500)});throw new HttpError(503,'email_delivery_failed','確認メールを送信できませんでした。時間をおいて再度お試しください。')}
  await recordEmail(env,{eventKey,eventType,to,tenantId,applicationId,status:'sent',messageId:String(data.messageId||'')});
  return {sent:true,messageId:data.messageId||null,deduplicated:false};
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
function formatJapan(value){return new Intl.DateTimeFormat('ja-JP',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Tokyo'}).format(new Date(value))}
