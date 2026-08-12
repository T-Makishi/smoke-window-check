import {tenantIdFrom} from '../../_lib/auth.js';
import {database,findTenant,parseTenantSettings} from '../../_lib/db.js';
import {sendInquiryReceivedEmail} from '../../_lib/email.js';
import {handleError,HttpError,json,readJson} from '../../_lib/http.js';
import {inquiryInput,inquirySummary,randomCaseNumber,randomInquiryId} from '../../_lib/inquiries.js';
import {licenseState} from '../../_lib/trial.js';

export async function onRequestPost({request,env}){
  try{
    const url=new URL(request.url),tenantId=tenantIdFrom(url.searchParams.get('tenant')),tenant=await findTenant(env,tenantId),state=licenseState(tenant);
    if(!tenant)throw new HttpError(404,'not_found','お客様用URLを確認できません。');
    if(state!=='active')throw new HttpError(state==='expired'?410:403,state,state==='expired'?'利用期間が終了しています。':'現在ご利用いただけません。');
    const {clientSubmissionId,inquiry}=inquiryInput(await readJson(request)),db=database(env);
    const existing=await db.prepare('SELECT * FROM vendor_inquiries WHERE tenant_id=?1 AND client_submission_id=?2').bind(tenantId,clientSubmissionId).first();
    if(existing)return json({ok:true,inquiry:inquirySummary(existing),deduplicated:true});
    const settings=parseTenantSettings(tenant),now=new Date().toISOString(),id=randomInquiryId(),caseNumber=randomCaseNumber(),customerName=inquiry.customer.companyName||inquiry.customer.storeName||inquiry.customer.facilityName||inquiry.customer.contactName,siteAddress=[inquiry.site.prefecture,inquiry.site.city,inquiry.site.address,inquiry.site.buildingName,inquiry.site.floor,inquiry.site.room].filter(Boolean).join(' '),symptomSummary=inquiry.diagnosis.symptoms.join('、');
    await db.prepare(`INSERT INTO vendor_inquiries (id,tenant_id,case_number,client_submission_id,customer_name,customer_email,customer_phone,site_address,site_name,symptom_summary,urgency,estimate_min,estimate_max,media_count,media_names_json,payload_json,status,assignee,internal_memo,email_status,received_at,updated_at)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,'unconfirmed','','','pending',?17,?17)`)
      .bind(id,tenantId,caseNumber,clientSubmissionId,customerName,inquiry.customer.email,inquiry.customer.phone,siteAddress,inquiry.site.siteName,symptomSummary,inquiry.diagnosis.urgency,inquiry.estimate.minimumPrice,inquiry.estimate.maximumPrice,inquiry.media.count,JSON.stringify(inquiry.media.names),JSON.stringify(inquiry),now).run();
    let emailStatus='sent';
    try{await sendInquiryReceivedEmail(env,{tenantId,inquiryId:id,caseNumber,companyName:tenant.company_name,recipient:settings.company.email,inquiry})}catch(error){console.error(error);emailStatus='failed'}
    await db.prepare('UPDATE vendor_inquiries SET email_status=?1,updated_at=?2 WHERE id=?3 AND tenant_id=?4').bind(emailStatus,new Date().toISOString(),id,tenantId).run();
    const saved=await db.prepare('SELECT * FROM vendor_inquiries WHERE id=?1 AND tenant_id=?2').bind(id,tenantId).first();
    return json({ok:true,inquiry:inquirySummary(saved),deduplicated:false},{status:201});
  }catch(error){return handleError(error)}
}
