import test from 'node:test';
import assert from 'node:assert/strict';
import {derivePasscodeHash,isFreshAccessAuthentication,normalizePasscode,PASSCODE_MAX_ATTEMPTS,PASSCODE_SESSION_SECONDS} from '../functions/_lib/passcode.js';

test('パスコードは6〜8桁の安全な数字だけを受け付ける',()=>{
  assert.equal(normalizePasscode(' 493827 '),'493827');
  assert.throws(()=>normalizePasscode('1234'),/6〜8桁/);
  assert.throws(()=>normalizePasscode('abcdef'),/6〜8桁/);
  assert.throws(()=>normalizePasscode('123456'),/連続した数字/);
  assert.throws(()=>normalizePasscode('777777'),/連続した数字/);
});

test('PBKDF2ハッシュは同じソルトで再現し、別ソルトでは一致しない',async()=>{
  const saltA=Buffer.from('0123456789abcdef').toString('base64url');
  const saltB=Buffer.from('fedcba9876543210').toString('base64url');
  const first=await derivePasscodeHash('493827',saltA);
  assert.equal(await derivePasscodeHash('493827',saltA),first);
  assert.notEqual(await derivePasscodeHash('493827',saltB),first);
  assert.notEqual(await derivePasscodeHash('493828',saltA),first);
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

function requestWithIssuedAt(iat){
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  return new Request('https://example.com',{headers:{'cf-access-jwt-assertion':`${encode({alg:'none'})}.${encode({iat})}.signature`}});
}
