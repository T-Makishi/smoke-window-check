import {HttpError} from './http.js';

export const TRIAL_CONSENT_VERSION='2026-08-11';
export const PRODUCTION_TERMS_VERSION='2026-08-11';
export const VERIFICATION_MINUTES=30;

export function randomId(prefix,byteLength=12){
  const bytes=crypto.getRandomValues(new Uint8Array(byteLength));
  return `${prefix}${toBase64Url(bytes)}`;
}

export function randomToken(){return randomId('',32)}

export async function sha256(value){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function verificationExpiry(now=new Date()){
  return new Date(now.getTime()+VERIFICATION_MINUTES*60_000).toISOString();
}

export function applicationInput(body){
  const companyName=cleanText(body.companyName,200),contactName=cleanText(body.contactName,100),phone=cleanText(body.phone,30),prefecture=cleanText(body.prefecture,40),website=cleanText(body.website,300);
  if(!companyName)throw new HttpError(400,'invalid_company','会社名を入力してください。');
  if(!contactName)throw new HttpError(400,'invalid_contact','担当者名を入力してください。');
  if(!/^[0-9+()\-\s]{8,30}$/.test(phone))throw new HttpError(400,'invalid_phone','電話番号を正しく入力してください。');
  if(website&&!/^https?:\/\/[^\s]+$/i.test(website))throw new HttpError(400,'invalid_website','Webサイトは https:// から入力してください。');
  if(body.consent!==true)throw new HttpError(400,'consent_required','無料体験の利用条件と個人情報の取扱いへの同意が必要です。');
  if(cleanText(body.companyFax,200))throw new HttpError(400,'invalid_request','申込内容を確認してください。');
  return {companyName,contactName,phone,prefecture,website};
}

export function remainingDaysInJapan(expiresAt,now=new Date()){
  const endDate=japanDate(expiresAt),today=japanDate(now.toISOString());
  const end=Date.UTC(...endDate.split('-').map((value,index)=>index===1?Number(value)-1:Number(value)));
  const start=Date.UTC(...today.split('-').map((value,index)=>index===1?Number(value)-1:Number(value)));
  return Math.ceil((end-start)/86_400_000);
}

export function publicApplication(row){
  return {id:row.id,companyName:row.company_name,contactName:row.contact_name,email:row.email,phone:row.phone,prefecture:row.prefecture,website:row.website,status:row.status,tenantId:row.tenant_id,createdAt:row.created_at,verifiedAt:row.verified_at};
}

export function publicProductionRequest(row){
  if(!row)return null;
  return {tenantId:row.tenant_id,applicantName:row.applicant_name,note:row.note,status:row.status,termsVersion:row.terms_version,requestedAt:row.requested_at,updatedAt:row.updated_at};
}

function cleanText(value,max){return String(value??'').trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max)}
function toBase64Url(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')}
function japanDate(value){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))}
