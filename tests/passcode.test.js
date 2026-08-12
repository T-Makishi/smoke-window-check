import test from 'node:test';
import assert from 'node:assert/strict';
import {derivePasscodeHash,isFreshAccessAuthentication,normalizePasscode,PASSCODE_MAX_ATTEMPTS,PASSCODE_SESSION_SECONDS} from '../functions/_lib/passcode.js';
import {VENDOR_DEVICE_SECONDS,VENDOR_LOGIN_MINUTES} from '../functions/_lib/vendor-identity.js';

test('パスコードは6〜8桁の安全な数字だけを受け付ける',()=>{
  assert.equal(normalizePasscode(' 493827 '),'493827');
  assert.throws(()=>normalizePasscode('1234'),/6〜8桁/);
  assert.throws(()=>normalizePasscode('abcdef'),/6〜8桁/);
  assert.throws(()=>normalizePasscode('123456'),/連続した数字/);
  assert.throws(()=>normalizePasscode('777777'),/連続した数字/);
});

test('HMACハッシュは同じ秘密鍵とソルトで再現し、異なる値では一致しない',async()=>{
  const saltA=Buffer.from('0123456789abcdef').toString('base64url');
  const saltB=Buffer.from('fedcba9876543210').toString('base64url');
  const pepperA='test-only-pepper-with-at-least-32-characters';
  const pepperB='different-test-pepper-at-least-32-characters';
  const first=await derivePasscodeHash('493827',saltA,pepperA);
  assert.match(first,/^hmac-sha256-v1\./);
  assert.equal(await derivePasscodeHash('493827',saltA,pepperA),first);
  assert.notEqual(await derivePasscodeHash('493827',saltB,pepperA),first);
  assert.notEqual(await derivePasscodeHash('493828',saltA,pepperA),first);
  assert.notEqual(await derivePasscodeHash('493827',saltA,pepperB),first);
  await assert.rejects(()=>derivePasscodeHash('493827',saltA,'short'),/安全設定/);
});

test('メール再確認直後だけパスコード再設定を許可する',()=>{
  const now=Date.parse('2026-08-11T03:00:00.000Z');
  assert.equal(isFreshAccessAuthentication(requestWithIssuedAt(now/1000-60),now),true);
  assert.equal(isFreshAccessAuthentication(requestWithIssuedAt(now/1000-601),now),false);
  assert.equal(isFreshAccessAuthentication(new Request('https://example.com'),now),false);
});

test('認証防御の固定値は24時間・5回失敗である',()=>{
  assert.equal(PASSCODE_SESSION_SECONDS,24*60*60);
  assert.equal(PASSCODE_MAX_ATTEMPTS,5);
});

test('業者認証は端末確認30日・メールリンク15分である',()=>{
  assert.equal(VENDOR_DEVICE_SECONDS,30*24*60*60);
  assert.equal(VENDOR_LOGIN_MINUTES,15);
});

function requestWithIssuedAt(iat){
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  return new Request('https://example.com',{headers:{'cf-access-jwt-assertion':`${encode({alg:'none'})}.${encode({iat})}.signature`}});
}
