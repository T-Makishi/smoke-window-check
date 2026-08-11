import {database} from '../../_lib/db.js';
import {sendExpiryReminder} from '../../_lib/email.js';
import {error,handleError,json} from '../../_lib/http.js';
import {remainingDaysInJapan} from '../../_lib/onboarding.js';

export async function onRequestPost({request,env}){
  try{
    if(!authorized(request,env))return error(401,'unauthorized','ジョブ認証に失敗しました。');
    const db=database(env),result=await db.prepare("SELECT id,company_name,vendor_email,expires_at FROM tenants WHERE license_type='trial' AND status='active' AND expires_at>?1").bind(new Date().toISOString()).all(),origin=new URL(request.url).origin;
    const summary={checked:0,sent:0,skipped:0,failed:0};
    for(const tenant of result.results||[]){
      summary.checked++;const days=remainingDaysInJapan(tenant.expires_at);
      if(![3,1].includes(days)){summary.skipped++;continue}
      const adminUrl=`${origin}/?t=${encodeURIComponent(tenant.id)}&admin=1`;
      try{const delivery=await sendExpiryReminder(env,{tenantId:tenant.id,companyName:tenant.company_name,email:tenant.vendor_email,days,expiresAt:tenant.expires_at,adminUrl});delivery.deduplicated?summary.skipped++:summary.sent++}catch(error){console.error('reminder_failed',tenant.id,error);summary.failed++}
    }
    return json({ok:true,summary});
  }catch(error){return handleError(error)}
}

function authorized(request,env){
  const expected=String(env.JOB_SECRET||'');if(expected.length<32)return false;
  const supplied=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(supplied.length!==expected.length)return false;
  let different=0;for(let index=0;index<expected.length;index++)different|=expected.charCodeAt(index)^supplied.charCodeAt(index);
  return different===0;
}
