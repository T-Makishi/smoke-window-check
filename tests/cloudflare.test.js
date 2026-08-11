import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SETTINGS} from '../js/estimate-config.js';
import {buildTenantCustomerUrl,buildTenantGuideUrl,mergePublicSettings,readTenantId,remainingTrialDays,vendorLoginUrl} from '../js/cloudflare-platform.js';
import {licenseState,productionWindow,trialWindow} from '../functions/_lib/trial.js';
import {sanitizeSettings} from '../functions/_lib/settings.js';

test('短いお客様用URLを生成する',()=>{
  const id='sw_abcdefghijklmnop',url=buildTenantCustomerUrl(id,'https://smoke-window-check.pages.dev/path?cfg=long#top');
  assert.equal(url,'https://smoke-window-check.pages.dev/?t=sw_abcdefghijklmnop');
  assert.equal(readTenantId(url),id);
  assert.equal(readTenantId('https://example.com/?t=invalid'),null);
});

test('会社別の見積依頼者向け案内URLを生成する',()=>{
  const id='sw_abcdefghijklmnop',url=buildTenantGuideUrl(id,'https://smoke-window-check.pages.dev/path?cfg=long#top');
  assert.equal(url,'https://smoke-window-check.pages.dev/customer.html?t=sw_abcdefghijklmnop');
  assert.equal(readTenantId(url),id);
});

test('パスコード再設定のログインURLは再設定状態を保持する',()=>{
  const id='sw_abcdefghijklmnop';
  assert.equal(vendorLoginUrl(id,`https://smoke-window-check.pages.dev/?t=${id}&admin=1&resetPasscode=1`),`https://smoke-window-check.pages.dev/api/vendor/login?tenant=${id}&resetPasscode=1`);
});

test('D1の公開設定を既定設定へ安全に統合する',()=>{
  const merged=mergePublicSettings(DEFAULT_SETTINGS,{company:{name:'テスト設備'},pricing:{height:{smallLadder:9000}}});
  assert.equal(merged.company.name,'テスト設備');
  assert.equal(merged.company.email,DEFAULT_SETTINGS.company.email);
  assert.equal(merged.pricing.height.smallLadder,9000);
  assert.deepEqual(merged.security,DEFAULT_SETTINGS.security);
});

test('7日試験は開始日を含む日本時間の最終日まで利用できる',()=>{
  const window=trialWindow(7,'2026-07-19T01:00:00.000Z');
  assert.equal(window.startsAt,'2026-07-19T01:00:00.000Z');
  assert.equal(window.expiresAt,'2026-07-25T14:59:59.999Z');
  assert.equal(licenseState({status:'active',expires_at:window.expiresAt},'2026-07-25T14:59:59.999Z'),'active');
  assert.equal(licenseState({status:'active',expires_at:window.expiresAt},'2026-07-25T15:00:00.000Z'),'expired');
});

test('停止中の登録は期限内でも利用不可',()=>{
  assert.equal(licenseState({status:'suspended',expires_at:'2099-01-01T00:00:00.000Z'}),'suspended');
});

test('本番利用は期限なし、停止操作は有効',()=>{
  const window=productionWindow('2026-08-11T00:00:00.000Z');
  assert.equal(window.expiresAt,'9999-12-31T14:59:59.999Z');
  assert.equal(licenseState({status:'active',license_type:'production',expires_at:'2000-01-01T00:00:00.000Z'}),'active');
  assert.equal(licenseState({status:'suspended',license_type:'production',expires_at:window.expiresAt}),'suspended');
});

test('試験版だけ残日数を表示する',()=>{
  const now=Date.parse('2026-08-11T00:00:00.000Z');
  assert.equal(remainingTrialDays({licenseType:'trial',expiresAt:'2026-08-13T14:59:59.999Z'},now),3);
  assert.equal(remainingTrialDays({licenseType:'trial',expiresAt:'2026-08-11T00:00:00.000Z'},now),0);
  assert.equal(remainingTrialDays({licenseType:'production',expiresAt:'9999-12-31T14:59:59.999Z'},now),null);
});

test('サーバー保存設定から秘密情報を除外して検証する',()=>{
  const source=structuredClone(DEFAULT_SETTINGS);source.security.settingsPasscodeHash='secret';
  const saved=sanitizeSettings(source);
  assert.equal(saved.security,undefined);
  assert.equal(saved.company.email,'makishi0520@gmail.com');
  source.company.email='invalid';
  assert.throws(()=>sanitizeSettings(source),/有効な受付メール/);
});
