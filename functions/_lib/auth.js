import {database} from './db.js';
import {HttpError} from './http.js';

const EMAIL_PATTERN=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function authenticatedEmail(request){
  const email=request.headers.get('cf-access-authenticated-user-email')||'';
  try{return identityEmail(email)}
  catch{throw new HttpError(401,'authentication_required','メール確認が必要です。')}
}

export async function requireServiceAdmin(request,env){
  const email=authenticatedEmail(request);
  const expected=await serviceAdminEmail(env);
  if(!emailsMatch(email,expected))throw new HttpError(403,'forbidden','サービス運営者として登録されていません。');
  return email;
}

export async function serviceAdminEmail(env){
  const fallback=normalizeEmail(env.SERVICE_ADMIN_EMAIL||'makishi0520@gmail.com');
  try{
    const row=await database(env).prepare("SELECT value FROM service_settings WHERE key='service_admin_email'").first();
    return row?.value?normalizeEmail(row.value):fallback;
  }catch(error){
    if(String(error?.message||error).toLowerCase().includes('no such table'))return fallback;
    throw error;
  }
}

export async function ensureServiceSettings(env){
  await database(env).prepare(`CREATE TABLE IF NOT EXISTS service_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL
  )`).run();
  await database(env).prepare(`CREATE TABLE IF NOT EXISTS service_email_changes (
    id TEXT PRIMARY KEY,
    current_email TEXT NOT NULL COLLATE NOCASE,
    new_email TEXT NOT NULL COLLATE NOCASE,
    code_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','expired','cancelled')),
    created_at TEXT NOT NULL,
    confirmed_at TEXT
  )`).run();
}

export function tenantIdFrom(value){
  const id=String(value||'').trim();
  if(!/^sw_[A-Za-z0-9_-]{12,32}$/.test(id))throw new HttpError(400,'invalid_tenant','お客様用URLが正しくありません。');
  return id;
}

export function normalizeEmail(value){
  const email=String(value||'').trim().toLowerCase();
  if(!EMAIL_PATTERN.test(email))throw new HttpError(400,'invalid_email','有効なメールアドレスを入力してください。');
  return email;
}

// Gmail の +タグとドットは同一メールボックスを表す。
// 他社メールでは同じ仕様を仮定せず、登録値をそのまま照合する。
export function identityEmail(value){
  const email=normalizeEmail(value),at=email.lastIndexOf('@'),local=email.slice(0,at),domain=email.slice(at+1);
  if(domain!=='gmail.com'&&domain!=='googlemail.com')return email;
  return `${local.split('+',1)[0].replaceAll('.','')}@gmail.com`;
}

export function emailsMatch(left,right){
  try{return identityEmail(left)===identityEmail(right)}catch{return false}
}
