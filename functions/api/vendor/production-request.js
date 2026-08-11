import {tenantIdFrom} from '../../_lib/auth.js';
import {database,findTenant} from '../../_lib/db.js';
import {sendProductionRequestNotice} from '../../_lib/email.js';
import {handleError,HttpError,json,readJson} from '../../_lib/http.js';
import {PRODUCTION_TERMS_VERSION,publicProductionRequest} from '../../_lib/onboarding.js';
import {authorizedTenant} from '../../_lib/vendor-auth.js';

export async function onRequestGet({request,env}){
  try{const {row}=await authorizedTenant(request,env),record=await database(env).prepare('SELECT * FROM production_requests WHERE tenant_id=?1').bind(row.id).first();return json({ok:true,request:publicProductionRequest(record)});}catch(error){return handleError(error)}
}

export async function onRequestPost({request,env}){
  try{
    const {row,email}=await authorizedTenant(request,env);if(row.license_type==='production')throw new HttpError(409,'already_production','既に本番利用へ切り替わっています。');
    const body=await readJson(request),applicantName=String(body.applicantName||'').trim().slice(0,100),note=String(body.note||'').trim().slice(0,2000);
    if(!applicantName)throw new HttpError(400,'invalid_applicant','担当者名を入力してください。');
    if(body.agreed!==true)throw new HttpError(400,'agreement_required','本番利用の申込条件への同意が必要です。');
    const db=database(env),existing=await db.prepare('SELECT * FROM production_requests WHERE tenant_id=?1').bind(row.id).first();
    if(existing?.status==='requested')throw new HttpError(409,'already_requested','本番利用の申込は既に受け付けています。');
    const now=new Date().toISOString();
    await db.prepare("INSERT INTO production_requests (tenant_id,applicant_name,note,status,terms_version,requested_at,updated_at) VALUES (?1,?2,?3,'requested',?4,?5,?5) ON CONFLICT(tenant_id) DO UPDATE SET applicant_name=excluded.applicant_name,note=excluded.note,status='requested',terms_version=excluded.terms_version,requested_at=excluded.requested_at,updated_at=excluded.updated_at").bind(row.id,applicantName,note,PRODUCTION_TERMS_VERSION,now).run();
    const serviceUrl=new URL('/service.html',request.url).toString();
    let notificationSent=true;try{await sendProductionRequestNotice(env,{tenantId:row.id,companyName:row.company_name,applicantName,email,note,serviceUrl,requestedAt:now})}catch(error){console.error('production_request_notification_failed',row.id,error);notificationSent=false}
    const record=await db.prepare('SELECT * FROM production_requests WHERE tenant_id=?1').bind(row.id).first();
    return json({ok:true,request:publicProductionRequest(record),notificationSent},{status:201});
  }catch(error){return handleError(error)}
}
