import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDraft} from '../js/state.js';
import {inquiryInput,inquirySummary,randomCaseNumber} from '../functions/_lib/inquiries.js';
import {inquiriesToCsv} from '../functions/_lib/inquiry-csv.js';

function validSubmission(){
  const inquiry=createDraft();
  inquiry.id='case_test_12345678';inquiry.customerType='corporate';
  Object.assign(inquiry.customer,{companyName:'試験設備株式会社',contactName:'山田 太郎',phone:'098-000-0000',email:'test@example.com'});
  Object.assign(inquiry.site,{prefecture:'沖縄県',city:'那覇市',address:'久茂地1-1',siteName:'試験ビル'});
  Object.assign(inquiry.diagnosis,{symptom:'heavy',symptoms:['heavy'],urgency:'normal'});
  inquiry.estimate={minimumPrice:12000,maximumPrice:30000};inquiry.inspectionFee.agreed=true;
  return {clientSubmissionId:inquiry.id,agreed:true,inquiry};
}

test('企業サーバーへの送信は明示同意を必須とする',()=>{
  const input=validSubmission();input.agreed=false;
  assert.throws(()=>inquiryInput(input),/同意が必要/);
});

test('サーバー保存用の問診は顧客入力を限定して整形する',()=>{
  const result=inquiryInput(validSubmission());
  assert.equal(result.inquiry.customer.companyName,'試験設備株式会社');
  assert.equal(result.inquiry.site.city,'那覇市');
  assert.equal(result.inquiry.status,'unconfirmed');
  assert.equal(result.inquiry.memo,'');
});

test('受付番号は日付と推測しにくいランダム5文字で発行する',()=>{
  assert.match(randomCaseNumber(new Date('2026-08-12T03:00:00Z')),/^SW-20260812-[A-Z0-9]{5}$/);
});

test('一覧用データは詳細問診を含めず、詳細取得時だけ含める',()=>{
  const row={id:'inq_example_123456',case_number:'SW-20260812-ABCDE',customer_name:'山田 太郎',customer_email:'',customer_phone:'098',site_address:'那覇市',site_name:'試験ビル',symptom_summary:'動きが重い',urgency:'normal',estimate_min:12000,estimate_max:30000,media_count:1,media_names_json:'["window.jpg"]',payload_json:'{"customerType":"corporate"}',status:'unconfirmed',assignee:'',internal_memo:'',email_status:'sent',received_at:'2026-08-12T03:00:00Z',updated_at:'2026-08-12T03:00:00Z'};
  assert.equal('inquiry' in inquirySummary(row),false);
  assert.equal(inquirySummary(row,{includePayload:true}).inquiry.customerType,'corporate');
});

test('業者APIの閲覧・更新・削除はすべて企業IDで絞り込む',async()=>{
  const source=await readFile(new URL('../functions/api/vendor/inquiries.js',import.meta.url),'utf8');
  assert.match(source,/id=\?1 AND tenant_id=\?2/);
  assert.match(source,/WHERE id=\?5 AND tenant_id=\?6/);
  assert.match(source,/DELETE FROM vendor_inquiries WHERE id=\?1 AND tenant_id=\?2/);
});

test('サービス運営APIには顧客問い合わせの閲覧処理を置かない',async()=>{
  const source=await readFile(new URL('../functions/api/service/tenants.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/SELECT .*vendor_inquiries/i);
});

test('CSVバックアップはExcel向けBOM・全問診データ・数式注入対策を含む',()=>{
  const row={case_number:'SW-20260812-ABCDE',received_at:'2026-08-12T03:00:00Z',updated_at:'2026-08-12T03:00:00Z',status:'unconfirmed',assignee:'',internal_memo:'=HYPERLINK("bad")',symptom_summary:'開かない',urgency:'normal',estimate_min:12000,estimate_max:30000,media_count:1,media_names_json:'["window.jpg"]',payload_json:JSON.stringify({customerType:'corporate',customer:{companyName:'試験設備株式会社',contactName:'山田 太郎'},site:{city:'那覇市',address:'久茂地1-1'},diagnosis:{makerName:'試験メーカー',quantity:'1',interviewAnswers:{operation:'動かない'}},inspectionFee:{amount:5000}})};
  const csv=inquiriesToCsv([row]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv,/受付番号/);
  assert.match(csv,/試験設備株式会社/);
  assert.match(csv,/案件データ\(JSON\)/);
  assert.match(csv,/"'=HYPERLINK\(""bad""\)"/);
});

test('CSV出力APIはログイン企業IDで全案件を絞り込む',async()=>{
  const source=await readFile(new URL('../functions/api/vendor/inquiries-export.js',import.meta.url),'utf8');
  assert.match(source,/WHERE tenant_id=\?1/);
  assert.doesNotMatch(source,/LIMIT 200/);
  assert.match(source,/authorizedTenant/);
});
