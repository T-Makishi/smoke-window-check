import {HttpError} from './http.js';

const API='https://api.stripe.com/v1';
export async function stripeRequest(env,path,params={}){
  const key=String(env.STRIPE_SECRET_KEY||'');if(!key)throw new HttpError(503,'billing_not_configured','現在、オンライン契約の受付準備中です。運営者へお問い合わせください。');
  const body=new URLSearchParams();for(const [key,value] of Object.entries(params))if(value!==undefined&&value!==null&&value!=='')body.set(key,String(value));
  let response,data;try{response=await fetch(`${API}${path}`,{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/x-www-form-urlencoded'},body});data=await response.json()}catch{throw new HttpError(503,'billing_unavailable','決済サービスへ接続できません。時間をおいて再度お試しください。')}
  if(!response.ok){console.error('Stripe API error',data?.error?.type,data?.error?.code);throw new HttpError(502,'billing_failed','契約手続きを開始できませんでした。時間をおいて再度お試しください。')}
  return data;
}

export async function verifyStripeWebhook(rawBody,signatureHeader,secret,now=Date.now()){
  if(!signatureHeader||!secret)return false;const entries=Object.fromEntries(signatureHeader.split(',').map(item=>item.split('=',2)));const timestamp=Number(entries.t),signature=entries.v1;if(!timestamp||!signature||Math.abs(now/1000-timestamp)>300)return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signed=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${timestamp}.${rawBody}`));const expected=Array.from(new Uint8Array(signed),b=>b.toString(16).padStart(2,'0')).join('');
  if(expected.length!==signature.length)return false;let mismatch=0;for(let i=0;i<expected.length;i++)mismatch|=expected.charCodeAt(i)^signature.charCodeAt(i);return mismatch===0;
}
