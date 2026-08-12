import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SETTINGS} from '../js/estimate-config.js';
import {calculateEstimate} from '../js/estimate.js';
import {createDraft} from '../js/state.js';
import {caseText} from '../js/export.js';
import {createPresentedResult,interviewQuestionsFor,interviewRows,photoGuidanceFor,pruneInterviewAnswers,presentedResultRows} from '../js/interview-config.js';
import {renderStep} from '../js/ui.js';

test('選択した症状に応じて対話型問診を構成する',()=>{
  const draft=createDraft();
  draft.diagnosis.symptoms=['heavy','noise'];
  const ids=interviewQuestionsFor(draft.diagnosis).map(question=>question.id);
  assert.deepEqual(ids,['resistance_timing','noise_type','noise_timing']);
});

test('症状を変更した場合は対象外の回答だけを除外する',()=>{
  const draft=createDraft();
  Object.assign(draft.diagnosis,{symptoms:['heavy'],interviewAnswers:{resistance_timing:'middle',noise_type:'metal'}});
  pruneInterviewAnswers(draft.diagnosis);
  assert.deepEqual(draft.diagnosis.interviewAnswers,{resistance_timing:'middle'});
});

test('症状に合わせた撮影案内を3点に整理する',()=>{
  const draft=createDraft();draft.diagnosis.symptoms=['wire'];
  const guidance=photoGuidanceFor(draft.diagnosis);
  assert.equal(guidance.length,3);
  assert.match(guidance.map(item=>item.title).join('、'),/ワイヤー/);
});

test('顧客提示結果と業者メールへ同じスナップショットを使う',()=>{
  const draft=createDraft();
  Object.assign(draft.diagnosis,{symptoms:['wire'],interviewAnswers:{wire_state:'frayed',falling_risk:'no'},heightType:'reachable',quantity:'1',buildingType:'office',urgency:'normal',makerStatus:'known',makerName:'テストメーカー'});
  draft.media.count=2;draft.estimate=calculateEstimate(draft,DEFAULT_SETTINGS);draft.presentedResult=createPresentedResult(draft,draft.estimate,DEFAULT_SETTINGS,'2026-08-12T00:00:00.000Z');
  const rows=presentedResultRows(draft.presentedResult,{contractor:true});
  const text=caseText(draft,DEFAULT_SETTINGS);
  assert.equal(interviewRows(draft.diagnosis)[0][1],'ほつれている');
  for(const [,value] of rows)assert.match(text,new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(text,/お客様に提示した事前チェック結果/);
});

test('症状選択後は一問ずつ回答する画面を表示する',()=>{
  const draft=createDraft();draft.diagnosis.symptoms=['heavy'];
  const html=renderStep(2,draft,DEFAULT_SETTINGS,[],{interviewIndex:0});
  assert.match(html,/質問 1 \/ 1/);
  assert.match(html,/重さを感じるのは/);
  assert.match(html,/最も近い状態を1つ選んでください/);
});
