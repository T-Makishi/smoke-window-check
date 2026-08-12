import {database} from '../../_lib/db.js';
import {authorizedTenant} from '../../_lib/vendor-auth.js';
import {handleError,HttpError,json,readJson} from '../../_lib/http.js';
import {BILLING_COMMERCE_VERSION,BILLING_PLANS,BILLING_PRIVACY_VERSION,BILLING_TERMS_VERSION,billingPlan,billingPublic,randomId,requestFingerprint,stripePriceId} from '../../_lib/billing.js';
import {stripeRequest} from '../../_lib/stripe.js';

export async function onRequestGet({request,env}){try{const {row}=await authorizedTenant(request,env),subscription=await database(env).prepare('SELECT * FROM billing_subscriptions WHERE tenant_id=?1').bind(row.id).first();return json({ok:true,subscription:billingPublic(subscription,env),plans:Object.values(BILLING_PLANS),versions:{terms:BILLING_TERMS_VERSION,privacy:BILLING_PRIVACY_VERSION,commerce:BILLING_COMMERCE_VERSION}})}catch(error){return handleError(error)}}

export async function onRequestPost({request,env}){
  try{
    const {row,email}=await authorizedTenant(request,env),body=await readJson(request),action=String(body.action||''),db=database(env),subscription=await db.prepare('SELECT * FROM billing_subscriptions WHERE tenant_id=?1').bind(row.id).first(),origin=new URL(request.url).origin;
    if(action==='portal'){
      if(!subscription?.provider_customer_id)throw new HttpError(409,'no_billing_account','契約情報がありません。料金プランを選択してください。');
      const session=await stripeRequest(env,'/billing_portal/sessions',{customer:subscription.provider_customer_id,return_url:`${origin}/contract.html?t=${encodeURIComponent(row.id)}`});return json({ok:true,url:session.url});
    }
    if(action!=='checkout')throw new HttpError(400,'invalid_action','契約操作を確認できません。');
    if(body.agreements?.terms!==true||body.agreements?.privacy!==true||body.agreements?.commerce!==true)throw new HttpError(400,'agreement_required','利用条件への同意が必要です。');
    if(['active','trialing','past_due'].includes(subscription?.status))throw new HttpError(409,'already_subscribed','既存契約の変更は契約管理画面から行ってください。');
    const plan=billingPlan(body.planCode),now=new Date().toISOString(),acceptanceId=randomId(),fingerprint=await requestFingerprint(request);
    await db.prepare('INSERT INTO contract_acceptances (id,tenant_id,plan_code,amount_yen,terms_version,privacy_version,commerce_version,accepted_email,request_fingerprint,accepted_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)').bind(acceptanceId,row.id,plan.code,plan.amountYen,BILLING_TERMS_VERSION,BILLING_PRIVACY_VERSION,BILLING_COMMERCE_VERSION,email,fingerprint,now).run();
    const params={mode:'subscription','line_items[0][price]':stripePriceId(env,plan.code),'line_items[0][quantity]':'1',client_reference_id:row.id,'metadata[tenant_id]':row.id,'metadata[acceptance_id]':acceptanceId,'subscription_data[metadata][tenant_id]':row.id,'subscription_data[metadata][acceptance_id]':acceptanceId,success_url:`${origin}/contract.html?t=${encodeURIComponent(row.id)}&checkout=success`,cancel_url:`${origin}/contract.html?t=${encodeURIComponent(row.id)}&checkout=cancel`,allow_promotion_codes:'false'};
    if(subscription?.provider_customer_id)params.customer=subscription.provider_customer_id;else params.customer_email=email;
    const session=await stripeRequest(env,'/checkout/sessions',params);
    await db.prepare("INSERT INTO billing_subscriptions (tenant_id,provider,provider_customer_id,plan_code,status,created_at,updated_at) VALUES (?1,'stripe',?2,?3,'checkout_pending',?4,?4) ON CONFLICT(tenant_id) DO UPDATE SET plan_code=excluded.plan_code,status='checkout_pending',updated_at=excluded.updated_at").bind(row.id,session.customer||subscription?.provider_customer_id||null,plan.code,now).run();
    return json({ok:true,url:session.url});
  }catch(error){return handleError(error)}
}
