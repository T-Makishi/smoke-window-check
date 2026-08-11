import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationInput,remainingDaysInJapan,sha256,verificationExpiry} from '../functions/_lib/onboarding.js';

test('無料体験申込の必須項目と同意を検証する',()=>{
  const input=applicationInput({companyName:'沖縄設備株式会社',contactName:'山田 太郎',phone:'098-123-4567',prefecture:'沖縄県',website:'https://example.com',consent:true,companyFax:''});
  assert.equal(input.companyName,'沖縄設備株式会社');
  assert.throws(()=>applicationInput({...input,consent:false}),/同意が必要/);
  assert.throws(()=>applicationInput({...input,consent:true,companyFax:'bot'}),/申込内容/);
});

test('メール確認リンクは30分間有効として発行する',()=>{
  assert.equal(verificationExpiry(new Date('2026-08-11T00:00:00.000Z')),'2026-08-11T00:30:00.000Z');
});

test('確認トークンは再現可能なSHA-256ハッシュへ変換する',async()=>{
  assert.equal(await sha256('same-token'),await sha256('same-token'));
  assert.notEqual(await sha256('same-token'),await sha256('different-token'));
});

test('日本時間の日付で期限3日前と1日前を判定する',()=>{
  assert.equal(remainingDaysInJapan('2026-08-14T14:59:59.999Z',new Date('2026-08-11T00:00:00.000Z')),3);
  assert.equal(remainingDaysInJapan('2026-08-12T14:59:59.999Z',new Date('2026-08-11T00:00:00.000Z')),1);
});
