import {HttpError} from './http.js';
import {database} from './db.js';

export const PASSCODE_SESSION_SECONDS=24*60*60;
export const PASSCODE_MAX_ATTEMPTS=5;
export const PASSCODE_LOCK_MINUTES=15;
export const VENDOR_PASSCODE_COOKIE='sw_vendor_passcode';
export const SERVICE_PASSCODE_COOKIE='sw_service_passcode';

const PBKDF2_ITERATIONS=310000;
const FRESH_ACCESS_SECONDS=10*60;
const PASSCODE_PATTERN=/^\d{6,8}$/;
const WEAK_PASSCODES=new Set(['000000','111111','123456','654321','12345678','87654321']);

export function vendorPasscodeSubject(tenantId){return `vendor:${tenantId}`}
export function servicePasscodeSubject(){return 'service-admin'}

export function normalizePasscode(value){
  const passcode=String(value||'').trim();
  if(!PASSCODE_PATTERN.test(passcode))throw new HttpError(400,'invalid_passcode','パスコードは6〜8桁の数字で入力してください。');
  if(WEAK_PASSCODES.has(passcode)||/^(\d)\1+$/.test(passcode))throw new HttpError(400,'weak_passcode','連続した数字や同じ数字だけのパスコードは使用できません。');
  return passcode;
}

export async function passcodeStatus(env,{subject,email,request,cookieName}){
  const credential=await credentialFor(env,subject,email);
  const verified=credential?await validSession(env,{subject,email,request,cookieName}):false;
  return {configured:Boolean(credential),verified,resetAllowed:isFreshAccessAuthentication(request)};
}

export async function registerPasscode(env,{subject,email,passcode,request,cookieName}){
  const current=await credentialFor(env,subject,email);
  if(current)throw new HttpError(409,'passcode_already_configured','パスコードはすでに登録されています。');
  const normalized=normalizePasscode(passcode),salt=randomValue(16),hash=await derivePasscodeHash(normalized,salt),now=new Date().toISOString();
  await database(env).prepare(`INSERT INTO auth_credentials
    (subject,email,passcode_salt,passcode_hash,failed_attempts,locked_until,created_at,updated_at)
    VALUES (?1,?2,?3,?4,0,NULL,?5,?5)
    ON CONFLICT(subject,email) DO UPDATE SET passcode_salt=excluded.passcode_salt,
    passcode_hash=excluded.passcode_hash,failed_attempts=0,locked_until=NULL,updated_at=excluded.updated_at`)
    .bind(subject,email,salt,hash,now).run();
  await deleteSubjectSessions(env,subject,email);
  return createSession(env,{subject,email,cookieName});
}

export async function verifyRegisteredPasscode(env,{subject,email,passcode,cookieName}){
  const credential=await credentialFor(env,subject,email);
  if(!credential)throw new HttpError(409,'passcode_setup_required','最初にパスコードを登録してください。');
  enforceLock(credential);
  const candidate=await derivePasscodeHash(String(passcode||''),credential.passcode_salt);
  if(!constantTimeEqual(candidate,credential.passcode_hash)){
    await recordFailure(env,credential);
    throw new HttpError(401,'invalid_passcode','パスコードが違います。5回失敗すると15分間ロックされます。');
  }
  await clearFailures(env,subject,email);
  return createSession(env,{subject,email,cookieName});
}

export async function resetRegisteredPasscode(env,{subject,email,passcode,request,cookieName}){
  if(!isFreshAccessAuthentication(request))throw new HttpError(401,'fresh_email_auth_required','パスコードをリセットするには、メール確認をもう一度行ってください。');
  const normalized=normalizePasscode(passcode),salt=randomValue(16),hash=await derivePasscodeHash(normalized,salt),now=new Date().toISOString();
  await database(env).prepare(`INSERT INTO auth_credentials
    (subject,email,passcode_salt,passcode_hash,failed_attempts,locked_until,created_at,updated_at)
    VALUES (?1,?2,?3,?4,0,NULL,?5,?5)
    ON CONFLICT(subject,email) DO UPDATE SET passcode_salt=excluded.passcode_salt,
    passcode_hash=excluded.passcode_hash,failed_attempts=0,locked_until=NULL,updated_at=excluded.updated_at`)
    .bind(subject,email,salt,hash,now).run();
  await deleteSubjectSessions(env,subject,email);
  return createSession(env,{subject,email,cookieName});
}

export async function changeRegisteredPasscode(env,{subject,email,currentPasscode,newPasscode,request,cookieName}){
  await requirePasscodeSession(request,env,{subject,email,cookieName});
  const credential=await credentialFor(env,subject,email);
  enforceLock(credential);
  const candidate=await derivePasscodeHash(String(currentPasscode||''),credential.passcode_salt);
  if(!constantTimeEqual(candidate,credential.passcode_hash)){
    await recordFailure(env,credential);
    throw new HttpError(401,'invalid_passcode','現在のパスコードが違います。');
  }
  const normalized=normalizePasscode(newPasscode),salt=randomValue(16),hash=await derivePasscodeHash(normalized,salt),now=new Date().toISOString();
  await database(env).prepare('UPDATE auth_credentials SET passcode_salt=?1,passcode_hash=?2,failed_attempts=0,locked_until=NULL,updated_at=?3 WHERE subject=?4 AND email=?5')
    .bind(salt,hash,now,subject,email).run();
  await deleteSubjectSessions(env,subject,email);
  return createSession(env,{subject,email,cookieName});
}

export async function requirePasscodeSession(request,env,{subject,email,cookieName}){
  if(!(await validSession(env,{subject,email,request,cookieName})))throw new HttpError(401,'passcode_required','管理用パスコードを入力してください。');
}

export async function destroyPasscodeSession(request,env,{cookieName}){
  const token=cookieValue(request,cookieName);
  if(token)await database(env).prepare('DELETE FROM auth_sessions WHERE token_hash=?1').bind(await sha256(token)).run();
  return expiredCookie(cookieName);
}

export function isFreshAccessAuthentication(request,now=Date.now()){
  const assertion=request.headers.get('cf-access-jwt-assertion')||'';
  const payloadPart=assertion.split('.')[1];
  if(!payloadPart)return false;
  try{
    const payload=JSON.parse(new TextDecoder().decode(fromBase64Url(payloadPart))),issuedAt=Number(payload.iat);
    return Number.isFinite(issuedAt)&&issuedAt*1000<=now+30000&&now-issuedAt*1000<=FRESH_ACCESS_SECONDS*1000;
  }catch{return false}
}

export async function derivePasscodeHash(passcode,salt){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(passcode),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:fromBase64Url(salt),iterations:PBKDF2_ITERATIONS},key,256);
  return toBase64Url(new Uint8Array(bits));
}

async function credentialFor(env,subject,email){
  return database(env).prepare('SELECT * FROM auth_credentials WHERE subject=?1 AND email=?2').bind(subject,email).first();
}

async function validSession(env,{subject,email,request,cookieName}){
  const token=cookieValue(request,cookieName);
  if(!token)return false;
  const tokenHash=await sha256(token),now=new Date().toISOString();
  const row=await database(env).prepare('SELECT token_hash FROM auth_sessions WHERE token_hash=?1 AND subject=?2 AND email=?3 AND expires_at>?4').bind(tokenHash,subject,email,now).first();
  return Boolean(row);
}

async function createSession(env,{subject,email,cookieName}){
  const token=randomValue(32),tokenHash=await sha256(token),now=new Date(),expires=new Date(now.getTime()+PASSCODE_SESSION_SECONDS*1000);
  await database(env).prepare('DELETE FROM auth_sessions WHERE expires_at<=?1').bind(now.toISOString()).run();
  await database(env).prepare('INSERT INTO auth_sessions (token_hash,subject,email,expires_at,created_at) VALUES (?1,?2,?3,?4,?5)')
    .bind(tokenHash,subject,email,expires.toISOString(),now.toISOString()).run();
  return sessionCookie(cookieName,token,PASSCODE_SESSION_SECONDS);
}

async function deleteSubjectSessions(env,subject,email){await database(env).prepare('DELETE FROM auth_sessions WHERE subject=?1 AND email=?2').bind(subject,email).run()}

function enforceLock(credential){
  if(!credential)throw new HttpError(409,'passcode_setup_required','最初にパスコードを登録してください。');
  if(credential.locked_until&&Date.parse(credential.locked_until)>Date.now())throw new HttpError(429,'passcode_locked','パスコード入力がロックされています。15分後にもう一度お試しください。');
}

async function recordFailure(env,credential){
  const attempts=Number(credential.failed_attempts||0)+1,lockedUntil=attempts>=PASSCODE_MAX_ATTEMPTS?new Date(Date.now()+PASSCODE_LOCK_MINUTES*60*1000).toISOString():null;
  await database(env).prepare('UPDATE auth_credentials SET failed_attempts=?1,locked_until=?2,updated_at=?3 WHERE subject=?4 AND email=?5')
    .bind(lockedUntil?0:attempts,lockedUntil,new Date().toISOString(),credential.subject,credential.email).run();
}

async function clearFailures(env,subject,email){await database(env).prepare('UPDATE auth_credentials SET failed_attempts=0,locked_until=NULL,updated_at=?1 WHERE subject=?2 AND email=?3').bind(new Date().toISOString(),subject,email).run()}

function cookieValue(request,name){
  const cookies=request.headers.get('cookie')||'';
  for(const part of cookies.split(';')){const index=part.indexOf('=');if(index>0&&part.slice(0,index).trim()===name)return decodeURIComponent(part.slice(index+1).trim())}
  return '';
}

function sessionCookie(name,value,maxAge){return `${name}=${encodeURIComponent(value)}; Path=/api/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Strict`}
function expiredCookie(name){return `${name}=; Path=/api/; Max-Age=0; Secure; HttpOnly; SameSite=Strict`}
function randomValue(length){return toBase64Url(crypto.getRandomValues(new Uint8Array(length)))}
async function sha256(value){return toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))))}
function constantTimeEqual(left,right){if(left.length!==right.length)return false;let mismatch=0;for(let i=0;i<left.length;i++)mismatch|=left.charCodeAt(i)^right.charCodeAt(i);return mismatch===0}
function toBase64Url(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')}
function fromBase64Url(value){const base64=value.replaceAll('-','+').replaceAll('_','/').padEnd(Math.ceil(value.length/4)*4,'=');return Uint8Array.from(atob(base64),char=>char.charCodeAt(0))}
