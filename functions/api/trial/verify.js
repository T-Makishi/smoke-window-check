import {database,findTenant} from '../../_lib/db.js';
import {sendOperatorApplicationNotice,sendTrialIssuedEmail} from '../../_lib/email.js';
import {handleError,HttpError,json,readJson} from '../../_lib/http.js';
import {randomId,sha256} from '../../_lib/onboarding.js';
import {settingsJson} from '../../_lib/settings.js';
import {trialWindow} from '../../_lib/trial.js';
import {DEFAULT_SETTINGS} from '../../../js/estimate-config.js';

export async function onRequestPost({request,env}){
  try{
    const body=await readJson(request),token=String(body.token||'');
    if(!/^[A-Za-z0-9_-]{40,60}$/.test(token))throw new HttpError(400,'invalid_token','確認リンクが正しくありません。');
    const tokenHash=await sha256(token),db=database(env),application=await db.prepare('SELECT * FROM trial_applications WHERE token_hash=?1').bind(tokenHash).first(),now=new Date(),nowIso=now.toISOString();
    if(!application)throw new HttpError(404,'verification_not_found','確認リンクが無効です。申込画面から確認メールを再送してください。');
    if(application.status==='issued'&&application.tenant_id){const tenant=await findTenant(env,application.tenant_id);return json({ok:true,alreadyVerified:true,...issuedResult(request,tenant)});}
    if(application.status!=='pending')throw new HttpError(410,'verification_unavailable','この申込は現在利用できません。');
    if(Date.parse(application.token_expires_at)<now.getTime())throw new HttpError(410,'verification_expired','確認リンクの有効期限が切れています。申込画面からもう一度お申し込みください。');
    const duplicate=await db.prepare('SELECT id FROM tenants WHERE vendor_email=?1 LIMIT 1').bind(application.email).first();
    if(duplicate)throw new HttpError(409,'already_registered','このメールアドレスは既に登録されています。');
    const tenantId=randomId('sw_'),window=trialWindow(7,nowIso),source=structuredClone(DEFAULT_SETTINGS);source.company.name=application.company_name;source.company.email=application.email;
    const {json:serialized}=settingsJson(source);
    await db.batch([
      db.prepare("INSERT INTO tenants (id,company_name,vendor_email,settings_json,license_type,trial_days,starts_at,expires_at,status,created_at,updated_at) VALUES (?1,?2,?3,?4,'trial',7,?5,?6,'active',?7,?7)").bind(tenantId,application.company_name,application.email,serialized,window.startsAt,window.expiresAt,nowIso),
      db.prepare("UPDATE trial_applications SET status='issued',tenant_id=?1,verified_at=?2,updated_at=?2 WHERE id=?3 AND status='pending'").bind(tenantId,nowIso,application.id),
    ]);
    const tenant=await findTenant(env,tenantId),urls=issuedResult(request,tenant),serviceUrl=new URL('/service.html',request.url).toString();
    const results=await Promise.allSettled([
      sendTrialIssuedEmail(env,{applicationId:application.id,tenantId,companyName:application.company_name,contactName:application.contact_name,email:application.email,customerUrl:urls.customerUrl,adminUrl:urls.adminUrl,expiresAt:tenant.expires_at}),
      sendOperatorApplicationNotice(env,{applicationId:application.id,tenantId,companyName:application.company_name,contactName:application.contact_name,email:application.email,phone:application.phone,serviceUrl}),
    ]);
    return json({ok:true,...urls,emailSent:results[0].status==='fulfilled'});
  }catch(error){return handleError(error)}
}

function issuedResult(request,tenant){
  if(!tenant)throw new HttpError(404,'tenant_not_found','発行済みの利用情報が見つかりません。');
  const customerUrl=new URL('/',request.url);customerUrl.searchParams.set('t',tenant.id);
  const adminUrl=new URL(customerUrl);adminUrl.searchParams.set('admin','1');
  return {tenant:{id:tenant.id,companyName:tenant.company_name,expiresAt:tenant.expires_at},customerUrl:customerUrl.toString(),adminUrl:adminUrl.toString()};
}
