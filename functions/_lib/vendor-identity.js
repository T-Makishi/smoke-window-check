import {emailsMatch,identityEmail,normalizeEmail,tenantIdFrom} from './auth.js';
import {database,findTenant} from './db.js';
import {sendVendorLoginEmail} from './email.js';
import {HttpError} from './http.js';
import {randomToken,sha256} from './onboarding.js';
import {licenseState} from './trial.js';

export const VENDOR_IDENTITY_COOKIE='sw_vendor_identity';
export const VENDOR_DEVICE_SECONDS=30*24*60*60;
export const VENDOR_LOGIN_MINUTES=15;
const VENDOR_LOGIN_LIMIT_PER_HOUR=5;

export async function createVendorIdentitySession(env,{tenantId,email,verifiedAt=new Date().toISOString()}){
  const token=randomToken(),tokenHash=await sha256(token),now=new Date(),expiresAt=new Date(now.getTime()+VENDOR_DEVICE_SECONDS*1000).toISOString();
  const db=database(env);
  await db.batch([
    db.prepare('DELETE FROM vendor_identity_sessions WHERE expires_at<=?1').bind(now.toISOString()),
    db.prepare('INSERT INTO vendor_identity_sessions (token_hash,tenant_id,email,verified_at,expires_at,created_at) VALUES (?1,?2,?3,?4,?5,?6)')
      .bind(tokenHash,tenantId,normalizeEmail(email),verifiedAt,expiresAt,now.toISOString()),
  ]);
  return identityCookie(token,VENDOR_DEVICE_SECONDS);
}

export async function requireVendorIdentity(request,env,tenantIdValue){
  const tenantId=tenantIdFrom(tenantIdValue),row=await findTenant(env,tenantId);
  if(!row)throw new HttpError(404,'not_found','利用情報を確認できません。');
  const state=licenseState(row);
  if(state!=='active')throw new HttpError(state==='expired'?410:403,state,state==='expired'?'試験利用期間が終了しています。':'このアプリは現在停止されています。');
  const token=cookieValue(request,VENDOR_IDENTITY_COOKIE);
  if(!token)throw new HttpError(401,'identity_required','登録メールの確認が必要です。');
  const session=await database(env).prepare('SELECT * FROM vendor_identity_sessions WHERE token_hash=?1 AND tenant_id=?2 AND expires_at>?3')
    .bind(await sha256(token),tenantId,new Date().toISOString()).first();
  if(!session||!emailsMatch(row.vendor_email,session.email))throw new HttpError(401,'identity_required','登録メールの確認が必要です。');
  return {email:identityEmail(row.vendor_email),row,identity:session,freshEmailAuthenticated:Date.now()-Date.parse(session.verified_at)<=10*60*1000};
}

export async function requestVendorLoginLink(request,env,{tenantId:tenantIdValue,email,purpose='login'}){
  const tenantId=tenantIdFrom(tenantIdValue),row=await findTenant(env,tenantId),normalized=normalizeEmail(email);
  if(!row||!emailsMatch(row.vendor_email,normalized))return {sent:true};
  const state=licenseState(row);
  if(state!=='active')throw new HttpError(state==='expired'?410:403,state,state==='expired'?'試験利用期間が終了しています。':'このアプリは現在停止されています。');
  if(!['login','reset'].includes(purpose))throw new HttpError(400,'invalid_purpose','メール確認の目的が正しくありません。');
  const db=database(env),now=new Date(),since=new Date(now.getTime()-60*60*1000).toISOString();
  const recent=await db.prepare('SELECT COUNT(*) AS count FROM vendor_login_tokens WHERE tenant_id=?1 AND created_at>?2').bind(tenantId,since).first();
  if(Number(recent?.count||0)>=VENDOR_LOGIN_LIMIT_PER_HOUR)throw new HttpError(429,'login_link_rate_limited','確認メールの送信回数が上限に達しました。1時間後にお試しください。');
  const token=randomToken(),tokenHash=await sha256(token),expiresAt=new Date(now.getTime()+VENDOR_LOGIN_MINUTES*60*1000).toISOString();
  await db.prepare('INSERT INTO vendor_login_tokens (token_hash,tenant_id,email,purpose,expires_at,used_at,created_at) VALUES (?1,?2,?3,?4,?5,NULL,?6)')
    .bind(tokenHash,tenantId,row.vendor_email,purpose,expiresAt,now.toISOString()).run();
  const verificationUrl=new URL('/api/vendor/verify',request.url);verificationUrl.searchParams.set('token',token);
  await sendVendorLoginEmail(env,{tenantId,companyName:row.company_name,email:row.vendor_email,purpose,verificationUrl:verificationUrl.toString(),tokenHash});
  return {sent:true};
}

export async function consumeVendorLoginToken(env,token){
  if(!/^[A-Za-z0-9_-]{40,60}$/.test(String(token||'')))throw new HttpError(400,'invalid_token','確認リンクが正しくありません。');
  const db=database(env),tokenHash=await sha256(token),row=await db.prepare('SELECT * FROM vendor_login_tokens WHERE token_hash=?1').bind(tokenHash).first(),now=new Date();
  if(!row||row.used_at)throw new HttpError(410,'login_link_used','この確認リンクは使用済みです。業者ログイン画面から新しいメールを送信してください。');
  if(Date.parse(row.expires_at)<now.getTime())throw new HttpError(410,'login_link_expired','確認リンクの有効期限が切れています。業者ログイン画面から新しいメールを送信してください。');
  const tenant=await findTenant(env,row.tenant_id);
  if(!tenant||!emailsMatch(tenant.vendor_email,row.email))throw new HttpError(403,'forbidden','この業者設定を利用できません。');
  const result=await db.prepare('UPDATE vendor_login_tokens SET used_at=?1 WHERE token_hash=?2 AND used_at IS NULL').bind(now.toISOString(),tokenHash).run();
  if(Number(result?.meta?.changes||result?.changes||0)!==1)throw new HttpError(410,'login_link_used','この確認リンクは使用済みです。');
  return {tenant,purpose:row.purpose,cookie:await createVendorIdentitySession(env,{tenantId:tenant.id,email:tenant.vendor_email,verifiedAt:now.toISOString()})};
}

export async function destroyVendorIdentitySession(request,env){
  const token=cookieValue(request,VENDOR_IDENTITY_COOKIE);
  if(token)await database(env).prepare('DELETE FROM vendor_identity_sessions WHERE token_hash=?1').bind(await sha256(token)).run();
  return expiredIdentityCookie();
}

function cookieValue(request,name){
  const cookies=request.headers.get('cookie')||'';
  for(const part of cookies.split(';')){const index=part.indexOf('=');if(index>0&&part.slice(0,index).trim()===name)return decodeURIComponent(part.slice(index+1).trim())}
  return '';
}
function identityCookie(value,maxAge){return `${VENDOR_IDENTITY_COOKIE}=${encodeURIComponent(value)}; Path=/api/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`}
function expiredIdentityCookie(){return `${VENDOR_IDENTITY_COOKIE}=; Path=/api/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`}
