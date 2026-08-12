import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_SETTINGS} from '../js/estimate-config.js';
import {renderCustomerGuide,renderHome,renderPrintReport,renderSettings} from '../js/ui.js';

test('顧客トップに開始・操作ガイド・電話の導線を表示する',()=>{
  const settings=structuredClone(DEFAULT_SETTINGS);
  Object.assign(settings.company,{name:'テスト設備株式会社',phone:'03-1234-5678'});
  const html=renderHome(settings,false);
  assert.match(html,/テスト設備株式会社/);
  assert.match(html,/事前チェックを始める/);
  assert.match(html,/現地調査前に必要な症状・設置状況・写真を整理/);
  assert.match(html,/操作方法を見る/);
  assert.doesNotMatch(html,/説明書を印刷・PDF保存/);
  assert.doesNotMatch(html,/data-action="print-guide"/);
  assert.match(html,/tel:0312345678/);
});

test('顧客操作ガイドに4手順・注意事項・QR印刷領域を表示する',()=>{
  const settings=structuredClone(DEFAULT_SETTINGS);
  const html=renderCustomerGuide(settings,'https://example.com/?t=sw_test');
  assert.match(html,/案内URL・QRを開く/);
  assert.match(html,/症状を選び、質問に答える/);
  assert.match(html,/画面の案内どおりに撮影する/);
  assert.match(html,/結果を確認して送る/);
  assert.match(html,/guideQrCanvas/);
  assert.match(html,/PCSAPO \/ マキシ企画/);
});

test('印刷用の問診結果票に完了画面の操作ボタンを含めない',()=>{
  const settings=structuredClone(DEFAULT_SETTINGS);
  const draft={customerType:'corporate',customer:{companyName:'テスト設備',contactName:'山田',phone:'090-0000-0000',email:''},site:{city:'那覇市',address:'1-1',siteName:'テスト現場'},diagnosis:{symptoms:['heavy'],interviewAnswers:{},buildingType:'office',heightType:'smallLadder',quantity:'1',makerName:'',urgency:'normal',notes:''},media:{count:0},estimate:{minimumPrice:20000,maximumPrice:40000},inspectionFee:{agreed:true},presentedResult:{heading:'現地確認をご案内します',summary:'入力内容を確認しました',nextAction:'業者から連絡します',urgency:'通常',disclaimer:'概算です'},createdAt:'2026-08-12T10:00:00.000Z'};
  const html=renderPrintReport(draft,settings);
  assert.match(html,/問診結果票/);
  assert.match(html,/テスト設備/);
  assert.match(html,/症状・選択式問診/);
  assert.doesNotMatch(html,/問診内容をメールで送る/);
  assert.doesNotMatch(html,/data-action="print"/);
});

test('無料体験フォームは申込操作と本人確認後の処理を明示する',async()=>{
  const html=await readFile(new URL('../trial.html',import.meta.url),'utf8');
  assert.match(html,/7日間無料体験を申し込む/);
  assert.match(html,/確認完了後、運営者へ正式申込として通知され、会社専用URLが発行されます/);
  assert.match(html,/業者が見積依頼者へ案内する事前問診画面/);
  assert.match(html,/browser-mock/);
  assert.match(html,/index\.html\?demo=1&amp;embed=1/);
  assert.doesNotMatch(html,/>確認メールを受け取る</);
});

test('顧客操作ガイドは同一比率の実画面プレビュー4枚を表示する',async()=>{
  const app=await readFile(new URL('../js/app.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../css/components.css',import.meta.url),'utf8');
  assert.match(app,/実際の画面で見る操作手順/);
  assert.match(app,/guidePreview=/);
  assert.match(app,/\$\{demoPath\}home/);
  assert.match(app,/\$\{demoPath\}2/);
  assert.match(app,/\$\{demoPath\}3/);
  assert.match(app,/\$\{demoPath\}7/);
  assert.match(app,/スマートフォン枠の中でも実際に操作できます/);
  assert.doesNotMatch(app,/printCustomerGuide/);
  assert.match(css,/guide-screen-grid/);
  assert.match(css,/aspect-ratio: 390 \/ 780/);
});

test('業者向けLPフッターに運営者専用の管理入口を表示する',async()=>{
  const html=await readFile(new URL('../trial.html',import.meta.url),'utf8');
  assert.match(html,/サービス運営者ログイン/);
  assert.match(html,/href="\/service\.html"/);
  assert.match(html,/利用契約管理画面/);
});

test('運営管理は申込の再送・手動承認と運営者メール変更を備える',async()=>{
  const admin=await readFile(new URL('../js/service-admin.js',import.meta.url),'utf8');
  assert.match(admin,/本人確認メールを再送/);
  assert.match(admin,/手動承認・URL発行/);
  assert.match(admin,/メール確認後に自動承認/);
  assert.match(admin,/業者を手動登録する/);
  assert.match(admin,/通常は不要/);
  assert.match(admin,/要メール設定/);
  assert.match(admin,/利用者を完全に削除/);
  assert.match(admin,/admin-collapsible/);
  assert.match(admin,/運営者メールを変更/);
  assert.match(admin,/ログインIDと無料体験申込の通知先を同時に変更/);
});

test('運営管理は業者ごとの確認メール制限とパスコードロックを別々に解除できる',async()=>{
  const admin=await readFile(new URL('../js/service-admin.js',import.meta.url),'utf8');
  const endpoint=await readFile(new URL('../functions/api/service/tenants.js',import.meta.url),'utf8');
  assert.match(admin,/確認メール送信制限を解除/);
  assert.match(admin,/パスコード入力ロックを解除/);
  assert.match(admin,/確認のため会社名を入力/);
  assert.match(endpoint,/reset_login_email_limit/);
  assert.match(endpoint,/reset_passcode_lock/);
  assert.match(endpoint,/WHERE tenant_id=\?2 AND used_at IS NULL/);
  assert.match(endpoint,/確認用の会社名が一致しません/);
});

test('業者向けLP内で保存・送信しない操作モックを提供する',async()=>{
  const business=await readFile(new URL('../trial.html',import.meta.url),'utf8');
  const app=await readFile(new URL('../js/app.js',import.meta.url),'utf8');
  assert.match(business,/業者が見積依頼者へ案内する事前問診画面/);
  assert.match(business,/browser-mock/);
  assert.doesNotMatch(business,/href="\/\?demo=1"/);
  assert.match(business,/customer-demo-phone/);
  assert.match(business,/index\.html\?demo=1&amp;embed=1/);
  assert.match(business,/見るだけではありません。実際に操作できます/);
  assert.match(business,/操作体験を始める/);
  assert.match(business,/id="interactive-phone"/);
  assert.doesNotMatch(business,/href="\/customer\.html"/);
  assert.match(app,/demoSampleDraft/);
  assert.match(app,/if\(!platform\.demo\)/);
  assert.match(app,/入力内容を保存・送信していません/);
});

test('業者向けLPは現地調査前の価値・三者関係・初回設定と普段の受付を分けて説明する',async()=>{
  const business=await readFile(new URL('../trial.html',import.meta.url),'utf8');
  assert.match(business,/現地へ向かう前に/);
  assert.match(business,/必要な情報をそろえる/);
  assert.match(business,/現地調査前に、/);
  assert.match(business,/判断材料を整える/);
  assert.match(business,/アプリ運営者/);
  assert.match(business,/排煙窓業者/);
  assert.match(business,/見積依頼者/);
  assert.match(business,/最初の設定は1回だけ/);
  assert.match(business,/最初の1回だけ/);
  assert.match(business,/毎回行うのは、この3ステップ/);
  assert.match(business,/届いたメールを開く/);
  assert.match(business,/お客様へURLを送る/);
  assert.match(business,/回答メールを確認する/);
  assert.match(business,/症状・設置状況を回答し、写真・動画を添付/);
  assert.match(business,/workflow-phase--setup/);
  assert.match(business,/workflow-phase--daily/);
  assert.doesNotMatch(business,/workflow-list--six/);
});

test('運営者設定は重要操作を先頭に置き分類別に整理する',()=>{
  const html=renderSettings(structuredClone(DEFAULT_SETTINGS));
  assert.match(html,/settings-priority-card/);
  assert.match(html,/settings-jump-nav/);
  assert.match(html,/会社情報・ロゴ/);
  assert.match(html,/受付・お問い合わせ/);
  assert.match(html,/現地調査費・訪問条件/);
  assert.match(html,/概算料金・加算額/);
  assert.match(html,/画面表示・案内文/);
  assert.match(html,/問診結果を受け取るメールアドレス/);
});

test('会社別のお客様URLを問診画面へ直接統一する',async()=>{
  const app=await readFile(new URL('../js/app.js',import.meta.url),'utf8');
  const service=await readFile(new URL('../js/service-admin.js',import.meta.url),'utf8');
  const issuance=await readFile(new URL('../functions/_lib/trial-issuance.js',import.meta.url),'utf8');
  assert.doesNotMatch(app,/buildTenantGuideUrl/);
  assert.match(service,/location\.origin}\/\?t=/);
  assert.match(issuance,/new URL\('\/'/);
  assert.doesNotMatch(issuance,/customer\.html/);
});

test('業者設定の先頭にお客様への案内手段をまとめて表示する',async()=>{
  const app=await readFile(new URL('../js/app.js',import.meta.url),'utf8');
  assert.match(app,/お客様へ事前確認ページを案内する/);
  assert.match(app,/現地調査前の事前確認のお願い/);
  assert.match(app,/LINE・SMSなどで直接送る/);
  assert.match(app,/メール用の案内文をコピー/);
  assert.match(app,/QRコード画像を作成・送信/);
  assert.match(app,/お客様用URLをコピー/);
  assert.match(app,/form\.prepend\(card\)/);
});

test('旧顧客案内URLは識別番号を保持して問診へ自動転送する',async()=>{
  const redirect=await readFile(new URL('../customer.html',import.meta.url),'utf8');
  assert.match(redirect,/searchParams\.get\('t'\)/);
  assert.match(redirect,/location\.replace/);
  assert.match(redirect,/trial\.html#customer-demo/);
  assert.doesNotMatch(redirect,/サンプル排煙窓サービス/);
});

test('利用者削除は会社名確認と関連データ削除を要求する',async()=>{
  const tenantsApi=await readFile(new URL('../functions/api/service/tenants.js',import.meta.url),'utf8');
  const applicationsApi=await readFile(new URL('../functions/api/service/applications.js',import.meta.url),'utf8');
  assert.match(tenantsApi,/confirmation!==row\.company_name/);
  assert.match(tenantsApi,/DELETE FROM auth_sessions/);
  assert.match(tenantsApi,/DELETE FROM trial_applications WHERE tenant_id/);
  assert.match(applicationsApi,/tenant_delete_required/);
});

test('申込メール障害時は技術的な設定エラーを申込者へ表示しない',async()=>{
  const apply=await readFile(new URL('../functions/api/trial/apply.js',import.meta.url),'utf8');
  const client=await readFile(new URL('../js/trial.js',import.meta.url),'utf8');
  assert.match(apply,/体験開始までお待ちください/);
  assert.match(client,/運営者が申込内容を確認後/);
  assert.doesNotMatch(client,/メール送信設定が完了していません/);
});
