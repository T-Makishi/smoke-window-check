import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraft} from '../js/state.js';
import {DEFAULT_SETTINGS} from '../js/estimate-config.js';
import {caseText} from '../js/export.js';
import {formatInquiryReceivedEmail} from '../functions/_lib/email.js';

function exampleInquiry(){
  const inquiry=createDraft();
  inquiry.customerType='corporate';
  Object.assign(inquiry.customer,{companyName:'試験設備株式会社',contactName:'山田 太郎',phone:'098-000-0000',email:'customer@example.com'});
  Object.assign(inquiry.site,{postalCode:'900-0015',prefecture:'沖縄県',city:'那覇市',address:'久茂地1-1'});
  Object.assign(inquiry.diagnosis,{symptom:'wontOpen',symptoms:['wontOpen'],interviewAnswers:{control_response:'moves',open_movement:'slight'},heightType:'smallLadder',quantity:'1',urgency:'safety'});
  inquiry.estimate={minimumPrice:23000,maximumPrice:53000};
  Object.assign(inquiry.inspectionFee,{amount:8000,deductionOnFormalOrder:8000,agreed:true});
  inquiry.presentedResult={summary:'開閉装置の確認が必要です。',missingItems:['メーカー・型番の写真'],recommendation:'業者が内容を確認します。',safetyNotice:'原因は確定できません。',disclaimer:'正式金額は現場確認後に確定します。'};
  inquiry.createdAt='2026-08-12T10:15:00.000Z';
  return inquiry;
}

test('メールアプリ用本文は情報を見出しとQ&Aで整理する',()=>{
  const text=caseText(exampleInquiry(),DEFAULT_SETTINGS);
  assert.match(text,/■ ご依頼者情報/);
  assert.match(text,/■ 現場・症状/);
  assert.match(text,/Q1\. ハンドルや開閉装置/);
  assert.match(text,/A\. 動くが窓は開かない/);
  assert.match(text,/■ 費用のご案内/);
  assert.match(text,/対象数量：1か所/);
  assert.equal((text.match(/概算費用：/g)||[]).length,1);
  assert.match(text,/現地調査のみの場合 8,000円/);
});

test('自動送信メールはHTMLとテキストの両方を読みやすく整形する',()=>{
  const formatted=formatInquiryReceivedEmail({caseNumber:'SW-20260812-ABCDE',companyName:'受信会社',inquiry:exampleInquiry()});
  assert.match(formatted.text,/■ 受付情報/);
  assert.match(formatted.text,/Q2\. 排煙窓は、どこまで動きますか？\nA\. 少し動く/);
  assert.match(formatted.text,/■ お客様に提示した事前チェック結果/);
  assert.match(formatted.html,/選択式問診の回答/);
  assert.match(formatted.html,/background:#eef6f1/);
  assert.match(formatted.html,/SW-20260812-ABCDE/);
});
