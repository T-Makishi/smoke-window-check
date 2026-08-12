import test from 'node:test';
import assert from 'node:assert/strict';
import {BILLING_PLANS,addGrace,billingAccessState,billingPublic} from '../functions/_lib/billing.js';
import {verifyStripeWebhook} from '../functions/_lib/stripe.js';

test('料金は月額2980円・年額29800円で固定する',()=>{assert.equal(BILLING_PLANS.monthly.amountYen,2980);assert.equal(BILLING_PLANS.annual.amountYen,29800)});
test('支払失敗の猶予期間は7日間',()=>{assert.equal(addGrace('2026-08-12T00:00:00.000Z'),'2026-08-19T00:00:00.000Z')});
test('公開契約情報にStripe顧客IDを含めない',()=>{const value=billingPublic({status:'active',plan_code:'monthly',provider_customer_id:'cus_secret',provider_subscription_id:'sub_secret'},{STRIPE_SECRET_KEY:'x',STRIPE_WEBHOOK_SECRET:'y',STRIPE_PRICE_MONTHLY:'a',STRIPE_PRICE_ANNUAL:'b'});assert.equal(value.configured,true);assert.equal(JSON.stringify(value).includes('cus_secret'),false)});
test('支払失敗の猶予期限内だけ公開利用を継続する',()=>{const now=new Date('2026-08-12T00:00:00.000Z');assert.equal(billingAccessState({status:'past_due',grace_ends_at:'2026-08-13T00:00:00.000Z'},now),'active');assert.equal(billingAccessState({status:'past_due',grace_ends_at:'2026-08-11T23:59:59.000Z'},now),'suspended');assert.equal(billingAccessState({status:'canceled',current_period_end:'2026-08-31T00:00:00.000Z'},now),'active');assert.equal(billingAccessState({status:'unpaid'},now),'suspended')});
test('Stripe Webhook署名をHMACで検証する',async()=>{const body='{"id":"evt_1"}',timestamp=Math.floor(Date.now()/1000),secret='whsec_test',key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${timestamp}.${body}`)),hex=Array.from(new Uint8Array(signature),b=>b.toString(16).padStart(2,'0')).join('');assert.equal(await verifyStripeWebhook(body,`t=${timestamp},v1=${hex}`,secret),true);assert.equal(await verifyStripeWebhook(body,`t=${timestamp},v1=bad`,secret),false)});
