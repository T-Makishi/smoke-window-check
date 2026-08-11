import {requireServiceAdmin,tenantIdFrom} from '../../_lib/auth.js';
import {database,findTenant} from '../../_lib/db.js';
import {sendProductionApprovedEmail} from '../../_lib/email.js';
import {handleError,HttpError,json,readJson} from '../../_lib/http.js';
import {publicApplication,publicProductionRequest} from '../../_lib/onboarding.js';
import {requirePasscodeSession,SERVICE_PASSCODE_COOKIE,servicePasscodeSubject} from '../../_lib/passcode.js';
import {productionWindow} from '../../_lib/trial.js';

async function authorizedService(request,env){
  const email=requireServiceAdmin(request,env);await requirePasscodeSession(request,env,{subject:servicePasscodeSubject(),email,cookieName:SERVICE_PASSCODE_COOKIE});return email;
}

export async function onRequestGet({request,env}){
  try{
    await authorizedService(request,env);const db=database(env),[applicationsResult,requestsResult]=await Promise.all([
      db.prepare('SELECT * FROM trial_applications ORDER BY created_at DESC').all(),
      db.prepare("SELECT pr.*,t.company_name,t.vendor_email FROM production_requests pr JOIN tenants t ON t.id=pr.tenant_id ORDER BY CASE pr.status WHEN 'requested' THEN 0 ELSE 1 END,pr.requested_at DESC").all(),
    ]);
    const applications=(applicationsResult.results||[]).map(publicApplication),productionRequests=(requestsResult.results||[]).map(row=>({...publicProductionRequest(row),companyName:row.company_name,vendorEmail:row.vendor_email}));
    return json({ok:true,applications,productionRequests});
  }catch(error){return handleError(error)}
}

export async function onRequestPatch({request,env}){
  try{
    await authorizedService(request,env);const body=await readJson(request),tenantId=tenantIdFrom(body.tenantId),action=String(body.action||''),db=database(env),tenant=await findTenant(env,tenantId);
    if(!tenant)throw new HttpError(404,'not_found','登録が見つかりません。');
    if(action==='approve-production'){
      const requestRow=await db.prepare('SELECT * FROM production_requests WHERE tenant_id=?1').bind(tenantId).first();
      if(!requestRow||requestRow.status!=='requested')throw new HttpError(409,'request_not_pending','承認待ちの本番利用申込がありません。');
      const now=new Date().toISOString(),window=productionWindow(now);
      await db.batch([
        db.prepare("UPDATE tenants SET license_type='production',starts_at=?1,expires_at=?2,status='active',updated_at=?3 WHERE id=?4").bind(window.startsAt,window.expiresAt,now,tenantId),
        db.prepare("UPDATE production_requests SET status='approved',updated_at=?1 WHERE tenant_id=?2").bind(now,tenantId),
      ]);
      const adminUrl=new URL('/',request.url);adminUrl.searchParams.set('t',tenantId);adminUrl.searchParams.set('admin','1');
      try{await sendProductionApprovedEmail(env,{tenantId,companyName:tenant.company_name,email:tenant.vendor_email,adminUrl:adminUrl.toString()})}catch(error){console.error('production_approval_email_failed',tenantId,error)}
    }else if(action==='decline-production'){
      await db.prepare("UPDATE production_requests SET status='declined',updated_at=?1 WHERE tenant_id=?2 AND status='requested'").bind(new Date().toISOString(),tenantId).run();
    }else throw new HttpError(400,'invalid_action','操作が正しくありません。');
    const updated=await db.prepare('SELECT * FROM production_requests WHERE tenant_id=?1').bind(tenantId).first();
    return json({ok:true,request:publicProductionRequest(updated)});
  }catch(error){return handleError(error)}
}
