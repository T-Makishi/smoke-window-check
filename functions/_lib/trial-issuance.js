import {database,findTenant} from './db.js';
import {sendOperatorApplicationNotice,sendTrialIssuedEmail} from './email.js';
import {HttpError} from './http.js';
import {randomId} from './onboarding.js';
import {settingsJson} from './settings.js';
import {trialWindow} from './trial.js';
import {DEFAULT_SETTINGS} from '../../js/estimate-config.js';

export async function issueTrialApplication(request,env,application,{manual=false}={}){
  const db=database(env),now=new Date(),nowIso=now.toISOString();
  if(application.status==='issued'&&application.tenant_id){const tenant=await findTenant(env,application.tenant_id);return {alreadyIssued:true,...issuedUrls(request,tenant),emailSent:true}}
  if(application.status!=='pending')throw new HttpError(409,'application_not_pending','この申込は現在承認できません。');
  const duplicate=await db.prepare('SELECT id FROM tenants WHERE vendor_email=?1 LIMIT 1').bind(application.email).first();
  if(duplicate)throw new HttpError(409,'already_registered','このメールアドレスは既に登録されています。');
  const tenantId=randomId('sw_'),window=trialWindow(7,nowIso),source=structuredClone(DEFAULT_SETTINGS);source.company.name=application.company_name;source.company.email=application.email;
  const {json:serialized}=settingsJson(source);
  await db.batch([
    db.prepare("INSERT INTO tenants (id,company_name,vendor_email,settings_json,license_type,trial_days,starts_at,expires_at,status,created_at,updated_at) VALUES (?1,?2,?3,?4,'trial',7,?5,?6,'active',?7,?7)").bind(tenantId,application.company_name,application.email,serialized,window.startsAt,window.expiresAt,nowIso),
    db.prepare("UPDATE trial_applications SET status='issued',tenant_id=?1,verified_at=COALESCE(verified_at,?2),updated_at=?2 WHERE id=?3 AND status='pending'").bind(tenantId,nowIso,application.id),
  ]);
  const tenant=await findTenant(env,tenantId),urls=issuedUrls(request,tenant),serviceUrl=new URL('/service.html',request.url).toString();
  const results=await Promise.allSettled([
    sendTrialIssuedEmail(env,{applicationId:application.id,tenantId,companyName:application.company_name,contactName:application.contact_name,email:application.email,customerUrl:urls.customerUrl,adminUrl:urls.adminUrl,expiresAt:tenant.expires_at}),
    sendOperatorApplicationNotice(env,{applicationId:application.id,tenantId,companyName:application.company_name,contactName:application.contact_name,email:application.email,phone:application.phone,serviceUrl}),
  ]);
  return {...urls,manual,emailSent:results[0].status==='fulfilled',operatorNotified:results[1].status==='fulfilled'};
}

export function issuedUrls(request,tenant){
  if(!tenant)throw new HttpError(404,'tenant_not_found','発行済みの利用情報が見つかりません。');
  const questionnaireUrl=new URL('/',request.url);questionnaireUrl.searchParams.set('t',tenant.id);
  const customerUrl=new URL('/customer.html',request.url);customerUrl.searchParams.set('t',tenant.id);
  const adminUrl=new URL(questionnaireUrl);adminUrl.searchParams.set('admin','1');
  return {tenant:{id:tenant.id,companyName:tenant.company_name,expiresAt:tenant.expires_at},customerUrl:customerUrl.toString(),adminUrl:adminUrl.toString()};
}
