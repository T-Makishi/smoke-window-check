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
  assert.match(html,/お客様が実際に使う画面/);
  assert.match(html,/\?demo=1&amp;embed=1/);
  assert.doesNotMatch(html,/>確認メールを受け取る</);
});

test('顧客操作ガイドはスマートフォン図解と印刷導線を追加する',async()=>{
  const app=await readFile(new URL('../js/app.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../css/components.css',import.meta.url),'utf8');
  assert.match(app,/スマートフォン画面で見る操作手順/);
  assert.match(app,/赤い枠の場所を順番に押してください/);
  assert.match(css,/guide-phone-grid/);
});

test('運営管理は申込の再送・手動承認と運営者メール変更を備える',async()=>{
  const admin=await readFile(new URL('../js/service-admin.js',import.meta.url),'utf8');
  assert.match(admin,/確認メールを再送/);
  assert.match(admin,/手動承認・URL発行/);
  assert.match(admin,/運営者メールを変更/);
  assert.match(admin,/ログインIDと無料体験申込の通知先を同時に変更/);
});

test('申込メール障害時は技術的な設定エラーを申込者へ表示しない',async()=>{
  const apply=await readFile(new URL('../functions/api/trial/apply.js',import.meta.url),'utf8');
  const client=await readFile(new URL('../js/trial.js',import.meta.url),'utf8');
  assert.match(apply,/体験開始までお待ちください/);
  assert.match(client,/運営者が申込内容を確認後/);
  assert.doesNotMatch(client,/メール送信設定が完了していません/);
});
