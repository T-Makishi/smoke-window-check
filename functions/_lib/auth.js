import {HttpError} from './http.js';

const EMAIL_PATTERN=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function authenticatedEmail(request){
  const email=(request.headers.get('cf-access-authenticated-user-email')||'').trim().toLowerCase();
  if(!EMAIL_PATTERN.test(email))throw new HttpError(401,'authentication_required','メール確認が必要です。');
  return email;
}

export function requireServiceAdmin(request,env){
  const email=authenticatedEmail(request);
  const expected=String(env.SERVICE_ADMIN_EMAIL||'makishi0520@gmail.com').trim().toLowerCase();
  if(email!==expected)throw new HttpError(403,'forbidden','サービス運営者として登録されていません。');
  return email;
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
