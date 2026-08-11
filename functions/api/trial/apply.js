import {normalizeEmail} from '../../_lib/auth.js';
import {database} from '../../_lib/db.js';
import {sendVerificationEmail} from '../../_lib/email.js';
import {handleError,HttpError,json,readJson} from '../../_lib/http.js';
import {applicationInput,randomId,randomToken,sha256,TRIAL_CONSENT_VERSION,verificationExpiry} from '../../_lib/onboarding.js';

export async function onRequestPost({request,env}){
  try{
    const body=await readJson(request),input=applicationInput(body),email=normalizeEmail(body.email),db=database(env),now=new Date(),nowIso=now.toISOString(),fingerprint=await requestFingerprint(request,env);
    const registered=await db.prepare('SELECT id FROM tenants WHERE vendor_email=?1 LIMIT 1').bind(email).first();
    if(registered)throw new HttpError(409,'already_registered','このメールアドレスは既に登録されています。業者ログインをご利用ください。');
    const recent=await db.prepare("SELECT COUNT(*) AS count FROM trial_applications WHERE request_fingerprint=?1 AND created_at>=?2").bind(fingerprint,new Date(now.getTime()-86_400_000).toISOString()).first();
    if(Number(recent?.count||0)>=5)throw new HttpError(429,'rate_limited','申込回数が上限に達しました。24時間後に再度お試しください。');
    const existing=await db.prepare('SELECT * FROM trial_applications WHERE email=?1').bind(email).first();
    if(existing?.status==='issued')throw new HttpError(409,'trial_already_used','このメールアドレスでは無料体験を既に利用しています。本番利用について運営者へお問い合わせください。');
    const token=randomToken(),tokenHash=await sha256(token),applicationId=existing?.id||randomId('app_');
    if(existing){
      await db.prepare("UPDATE trial_applications SET company_name=?1,contact_name=?2,phone=?3,prefecture=?4,website=?5,status='pending',token_hash=?6,token_expires_at=?7,request_fingerprint=?8,consent_version=?9,consent_at=?10,updated_at=?10 WHERE id=?11").bind(input.companyName,input.contactName,input.phone,input.prefecture,input.website,tokenHash,verificationExpiry(now),fingerprint,TRIAL_CONSENT_VERSION,nowIso,applicationId).run();
    }else{
      await db.prepare("INSERT INTO trial_applications (id,company_name,contact_name,email,phone,prefecture,website,status,token_hash,token_expires_at,request_fingerprint,consent_version,consent_at,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,'pending',?8,?9,?10,?11,?12,?12,?12)").bind(applicationId,input.companyName,input.contactName,email,input.phone,input.prefecture,input.website,tokenHash,verificationExpiry(now),fingerprint,TRIAL_CONSENT_VERSION,nowIso).run();
    }
    const verificationUrl=new URL('/trial.html',request.url);verificationUrl.searchParams.set('verify',token);
    let verificationSent=true;
    try{await sendVerificationEmail(env,{applicationId,companyName:input.companyName,contactName:input.contactName,email,verificationUrl:verificationUrl.toString(),tokenHash})}
    catch(error){console.error('trial_verification_email_failed',applicationId,error);verificationSent=false}
    const message=verificationSent?'入力したメールアドレスへ本人確認リンクを送信しました。30分以内に確認を完了してください。':'無料体験のお申し込みを受け付けました。体験開始までお待ちください。運営者から案内メールをお送りします。';
    return json({ok:true,verificationSent,message},{status:verificationSent?201:202});
  }catch(error){return handleError(error)}
}

async function requestFingerprint(request,env){
  const ip=request.headers.get('cf-connecting-ip')||'unknown',agent=(request.headers.get('user-agent')||'').slice(0,200),secret=String(env.APPLICATION_FINGERPRINT_SECRET||env.PASSCODE_PEPPER||'smoke-window-check');
  return sha256(`${secret}:${ip}:${agent}`);
}
