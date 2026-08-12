import {HttpError} from './http.js';

export const BILLING_TERMS_VERSION='2026-08-12';
export const BILLING_PRIVACY_VERSION='2026-08-12';
export const BILLING_COMMERCE_VERSION='2026-08-13';
export const BILLING_GRACE_DAYS=7;
export const BILLING_PLANS={
  monthly:{code:'monthly',name:'月額プラン',amountYen:2980,interval:'month'},
  annual:{code:'annual',name:'年額プラン',amountYen:30360,interval:'year',discountLabel:'約15％割引',monthlyEquivalentYen:2530},
};

export function billingPlan(value){const plan=BILLING_PLANS[String(value||'')];if(!plan)throw new HttpError(400,'invalid_plan','料金プランを選択してください。');return plan}
export function stripePriceId(env,planCode){const value=planCode==='monthly'?env.STRIPE_PRICE_MONTHLY:env.STRIPE_PRICE_ANNUAL;if(!value)throw new HttpError(503,'billing_not_configured','現在、オンライン契約の受付準備中です。運営者へお問い合わせください。');return String(value)}
export function stripeConfigured(env){return Boolean(env.STRIPE_SECRET_KEY&&env.STRIPE_WEBHOOK_SECRET&&env.STRIPE_PRICE_MONTHLY&&env.STRIPE_PRICE_ANNUAL)}
export function stripeTimestamp(value){const seconds=Number(value);return Number.isFinite(seconds)&&seconds>0?new Date(seconds*1000).toISOString():null}
export function addGrace(value,days=BILLING_GRACE_DAYS){const date=value?new Date(value):new Date();if(Number.isNaN(date.getTime()))return null;date.setUTCDate(date.getUTCDate()+days);return date.toISOString()}
export function billingPublic(row,env={}){
  const plan=row?.plan_code?BILLING_PLANS[row.plan_code]:null;
  return {configured:stripeConfigured(env),status:row?.status||'none',planCode:row?.plan_code||'',planName:plan?.name||'',cancelAtPeriodEnd:Boolean(row?.cancel_at_period_end),currentPeriodStart:row?.current_period_start||null,currentPeriodEnd:row?.current_period_end||null,graceEndsAt:row?.grace_ends_at||null,canceledAt:row?.canceled_at||null,endedAt:row?.ended_at||null,lastPaymentError:row?.last_payment_error||''};
}
export function billingAccessState(row,now=new Date()){
  if(!row)return 'active';
  const current=now instanceof Date?now:new Date(now),status=String(row.status||'');
  if(['active','trialing'].includes(status))return 'active';
  if(status==='past_due')return isFuture(row.grace_ends_at,current)?'active':'suspended';
  if(status==='canceled')return isFuture(row.current_period_end,current)?'active':'suspended';
  if(['unpaid','incomplete_expired','paused'].includes(status))return 'suspended';
  return 'active';
}
export function randomId(prefix='accept'){const values=new Uint8Array(16);crypto.getRandomValues(values);return `${prefix}_${Array.from(values,b=>b.toString(16).padStart(2,'0')).join('')}`}
export async function requestFingerprint(request){const source=[request.headers.get('cf-connecting-ip')||'',request.headers.get('user-agent')||''].join('|'),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('').slice(0,32)}
function isFuture(value,now){const timestamp=Date.parse(value||'');return Number.isFinite(timestamp)&&timestamp>now.getTime()}
