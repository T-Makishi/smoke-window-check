import test from 'node:test';
import assert from 'node:assert/strict';
import {maskEmailAddress,publicTenant} from '../functions/_lib/db.js';

test('業者ログイン用メールは公開画面向けに安全にマスクする',()=>{
  assert.equal(maskEmailAddress('PCSAPOMakishi@gmail.com'),'p***@gmail.com');
  assert.equal(maskEmailAddress('invalid'),'');
});

test('公開業者情報に完全なログイン用メールを含めない',()=>{
  const tenant=publicTenant({
    id:'sw_3_oBKRj52lZBqGPw',company_name:'眞喜志',vendor_email:'pcsapomakishi@gmail.com',
    license_type:'trial',trial_days:7,starts_at:'2026-08-11T00:00:00.000Z',
    expires_at:'2026-08-17T14:59:59.999Z',status:'active',
  },'active');
  assert.equal(tenant.vendorEmailHint,'p***@gmail.com');
  assert.equal(JSON.stringify(tenant).includes('pcsapomakishi@gmail.com'),false);
});
