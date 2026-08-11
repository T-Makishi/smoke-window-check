import test from 'node:test';
import assert from 'node:assert/strict';
import {emailsMatch,identityEmail} from '../functions/_lib/auth.js';

test('Gmailの+タグ付きアドレスを同じ受信箱として照合する',()=>{
  assert.equal(identityEmail('Makishi.0520+trial@gmail.com'),'makishi0520@gmail.com');
  assert.equal(emailsMatch('makishi0520@gmail.com','makishi.0520+trial@googlemail.com'),true);
});

test('Gmail以外の+タグは別アドレスとして扱う',()=>{
  assert.equal(emailsMatch('user@example.com','user+trial@example.com'),false);
});

test('異なるGmail受信箱は一致しない',()=>{
  assert.equal(emailsMatch('makishi0520@gmail.com','makishikikaku@gmail.com'),false);
});
