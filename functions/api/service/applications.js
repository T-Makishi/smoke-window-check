import {requireServiceAdmin,tenantIdFrom} from '../../_lib/auth.js';
import {database,findTenant} from '../../_lib/db.js';
import {sendProductionApprovedEmail,sendVerificationEmail} from '../../_lib/email.js';
import {handleError,HttpError,json,readJson} from '../../_lib/http.js';
import {publicApplication,publicProductionRequest,randomToken,sha256,verificationExpiry} from '../../_lib/onboarding.js';
import {requirePasscodeSession,SERVICE_PASSCODE_COOKIE,servicePasscodeSubject} from '../../_lib/passcode.js';
import {productionWindow} from '../../_lib/trial.js';
import {issueTrialApplication} from '../../_lib/trial-issuance.js';

async function authorizedService(request,env){
  const email=await requireServiceAdmin(request,env);await requirePasscodeSession(request,env,{subject:servicePasscodeSubject(),email,cookieName:SERVICE_PASSCODE_COOKIE});return email;
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
    await authorizedService(request,env);const body=await readJson(request),action=String(body.action||''),db=database(env);
    if(action==='approve-trial'||action==='resend-verification'){
      const applicationId=applicationIdFrom(body.applicationId),application=await db.prepare('SELECT * FROM trial_applications WHERE id=?1').bind(applicationId).first();if(!application)throw new HttpError(404,'not_found','無料体験の申込が見つかりません。');
      if(action==='approve-trial'){const result=await issueTrialApplication(request,env,application,{manual:true});const updated=await db.prepare('SELECT * FROM trial_applications WHERE id=?1').bind(applicationId).first();return json({ok:true,application:publicApplication(updated),...result})}
      if(application.status!=='pending')throw new HttpError(409,'application_not_pending','発行済みまたは取消済みの申込には確認メールを再送できません。');
      const token=randomToken(),tokenHash=await sha256(token),now=new Date(),verificationUrl=new URL('/trial.html',request.url);verificationUrl.searchParams.set('verify',token);
      await db.prepare('UPDATE trial_applications SET token_hash=?1,token_expires_at=?2,updated_at=?3 WHERE id=?4').bind(tokenHash,verificationExpiry(now),now.toISOString(),applicationId).run();
      await sendVerificationEmail(env,{applicationId,companyName:application.company_name,contactName:application.contact_name,email:application.email,verificationUrl:verificationUrl.toString(),tokenHash});
      return json({ok:true,message:'確認メールを再送しました。'});
    }
    const tenantId=tenantIdFrom(body.tenantId),tenant=await findTenant(env,tenantId);if(!tenant)throw new HttpError(404,'not_found','登録が見つかりません。');
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

function applicationIdFrom(value){const id=String(value||'').trim();if(!/^app_[A-Za-z0-9_-]{12,32}$/.test(id))throw new HttpError(400,'invalid_application','申込情報が正しくありません。');return id}
