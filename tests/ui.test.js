import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_SETTINGS} from '../js/estimate-config.js';
import {renderCustomerGuide,renderHome} from '../js/ui.js';

test('顧客トップに開始・操作ガイド・印刷・電話の導線を表示する',()=>{
  const settings=structuredClone(DEFAULT_SETTINGS);
  Object.assign(settings.company,{name:'テスト設備株式会社',phone:'03-1234-5678'});
  const html=renderHome(settings,false);
  assert.match(html,/テスト設備株式会社/);
  assert.match(html,/事前チェックを始める/);
  assert.match(html,/操作方法を見る/);
  assert.match(html,/説明書を印刷・PDF保存/);
  assert.match(html,/tel:0312345678/);
});

test('顧客操作ガイドに4手順・注意事項・QR印刷領域を表示する',()=>{
  const settings=structuredClone(DEFAULT_SETTINGS);
  const html=renderCustomerGuide(settings,'https://example.com/?t=sw_test');
  assert.match(html,/案内URL・QRを開く/);
  assert.match(html,/質問に回答する/);
  assert.match(html,/排煙窓を撮影する/);
  assert.match(html,/内容を確認して送る/);
  assert.match(html,/guideQrCanvas/);
  assert.match(html,/PCSAPO \/ マキシ企画/);
});

test('無料体験フォームは申込操作と本人確認後の処理を明示する',async()=>{
  const html=await readFile(new URL('../trial.html',import.meta.url),'utf8');
  assert.match(html,/7日間無料体験を申し込む/);
  assert.match(html,/確認完了後、運営者へ正式申込として通知され、会社専用URLが発行されます/);
  assert.doesNotMatch(html,/>確認メールを受け取る</);
});
