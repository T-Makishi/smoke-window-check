import {SYMPTOMS} from './estimate-config.js';
import {selectedSymptoms} from './estimate.js';
import {yen} from './utils.js';

export const INTERVIEW_VERSION=1;
export const INTERVIEW_MAX_QUESTIONS=5;

const ANSWERS={
  yesNoUnknown:[['yes','はい'],['no','いいえ'],['unknown','分からない']],
  movement:[['none','まったく動かない'],['slight','少し動く'],['halfway','途中まで動く'],['unknown','分からない']]
};

export const INTERVIEW_QUESTIONS=[
  {id:'control_response',symptoms:['wontOpen','spins'],question:'ハンドルや開閉装置を操作したとき、どのような状態ですか？',answers:[['moves','動くが窓は開かない'],['notMove','まったく動かない'],['spins','空回りする'],['unknown','分からない']]},
  {id:'open_movement',symptoms:['wontOpen','stops'],question:'排煙窓は、どこまで動きますか？',answers:ANSWERS.movement},
  {id:'close_state',symptoms:['wontClose'],question:'閉める操作をしたとき、どのような状態ですか？',answers:[['open','開いたまま動かない'],['partial','途中まで閉まる'],['reopens','閉めても戻る'],['unknown','分からない']]},
  {id:'visible_obstruction',symptoms:['wontClose','stops'],question:'窓や金具の周辺に、物の挟まりや目立つ変形はありますか？',answers:ANSWERS.yesNoUnknown},
  {id:'resistance_timing',symptoms:['heavy'],question:'重さを感じるのは、どのタイミングですか？',answers:[['start','動かし始め'],['middle','開閉の途中'],['always','操作中ずっと'],['unknown','分からない']]},
  {id:'noise_type',symptoms:['noise'],question:'どのような音がしますか？',answers:[['metal','金属がこすれる音'],['click','カチカチ・空回りする音'],['creak','きしむ音'],['other','その他の音'],['unknown','分からない']]},
  {id:'noise_timing',symptoms:['noise'],question:'音がするのは、どのタイミングですか？',answers:[['opening','開けるとき'],['closing','閉めるとき'],['both','開閉の両方'],['unknown','分からない']]},
  {id:'wire_state',symptoms:['wire'],question:'ワイヤーは、どのように見えますか？',answers:[['cut','切れている'],['loose','たるんでいる'],['frayed','ほつれている'],['other','その他の異常'],['unknown','分からない']]},
  {id:'detached_state',symptoms:['detached'],question:'外れた部品は、現在どのような状態ですか？',answers:[['kept','外れた部品を保管している'],['hanging','ぶら下がっている'],['missing','見当たらない'],['unknown','分からない']]},
  {id:'falling_risk',symptoms:['detached','wire'],question:'窓や部品が落下しそうな状態ですか？',answers:ANSWERS.yesNoUnknown},
  {id:'leak_timing',symptoms:['leak'],question:'雨漏りは、いつ発生しますか？',answers:[['heavyRain','強い雨のとき'],['everyRain','雨のたびに'],['afterRain','雨が止んだ後'],['unknown','分からない']]},
  {id:'leak_location',symptoms:['leak'],question:'水が入る場所は分かりますか？',answers:[['top','窓の上側'],['side','窓の左右'],['bottom','窓の下側'],['multiple','複数箇所'],['unknown','分からない']]},
  {id:'unknown_visible',symptoms:['unknown','other'],question:'見た目で気になる状態はありますか？',answers:[['damage','破損や変形が見える'],['loose','部品の緩み・外れが見える'],['stain','水の跡や汚れがある'],['none','見た目では分からない'],['unknown','分からない']]}
];

// 複数症状が選ばれても、高齢者を含む利用者が途中離脱しないよう、
// 安全確認と初動判断に必要な質問を優先して最大5問に絞る。
const QUESTION_PRIORITY=[
  'falling_risk','wire_state','detached_state','control_response','close_state',
  'open_movement','resistance_timing','noise_type','leak_timing',
  'visible_obstruction','noise_timing','leak_location','unknown_visible'
];

const PHOTO_GUIDANCE={
  base:[
    {id:'whole',title:'排煙窓の全体',detail:'窓全体と周囲が入る位置から撮影してください。'},
    {id:'control',title:'ハンドル・開閉装置',detail:'操作部分を近くから撮影してください。'},
    {id:'label',title:'メーカー・型番ラベル',detail:'文字が読める距離で撮影してください。'}
  ],
  noise:{id:'operationVideo',title:'開閉操作時の動画',detail:'安全に操作できる場合だけ、音が分かる短い動画を撮影してください。'},
  wire:{id:'wire',title:'ワイヤーと接続部分',detail:'切れ・たるみ・ほつれが分かるように撮影してください。'},
  detached:{id:'damage',title:'外れた部品・破損箇所',detail:'触らずに、状態が分かる距離から撮影してください。'},
  leak:{id:'leak',title:'水が入る箇所',detail:'水跡と窓枠の位置関係が分かるように撮影してください。'},
  spins:{id:'controlClose',title:'操作部分の接写',detail:'ハンドルや開閉装置を正面から撮影してください。'},
  stops:{id:'stopped',title:'止まった位置の全景',detail:'窓がどの位置で止まるか分かるように撮影してください。'}
};

export function interviewQuestionsFor(diagnosis){
  const symptoms=selectedSymptoms(diagnosis);
  const relevant=INTERVIEW_QUESTIONS.filter(question=>question.symptoms.some(symptom=>symptoms.includes(symptom)));
  return relevant
    .sort((a,b)=>QUESTION_PRIORITY.indexOf(a.id)-QUESTION_PRIORITY.indexOf(b.id))
    .slice(0,INTERVIEW_MAX_QUESTIONS);
}

export function interviewAnswerLabel(questionId,value){
  const question=INTERVIEW_QUESTIONS.find(item=>item.id===questionId);
  return question?.answers.find(([key])=>key===value)?.[1]||value||'未回答';
}

export function interviewRows(diagnosis){
  const answers=diagnosis?.interviewAnswers||{};
  return interviewQuestionsFor(diagnosis)
    .filter(question=>answers[question.id])
    .map(question=>[question.question,interviewAnswerLabel(question.id,answers[question.id])]);
}

export function pruneInterviewAnswers(diagnosis){
  const allowed=new Set(interviewQuestionsFor(diagnosis).map(question=>question.id));
  const answers=diagnosis?.interviewAnswers||{};
  diagnosis.interviewAnswers=Object.fromEntries(Object.entries(answers).filter(([key])=>allowed.has(key)));
  diagnosis.interviewVersion=INTERVIEW_VERSION;
  return diagnosis.interviewAnswers;
}

export function photoGuidanceFor(diagnosis){
  const symptoms=selectedSymptoms(diagnosis);
  const priority=['wire','detached','noise','leak','spins','stops'];
  const extra=priority.find(symptom=>symptoms.includes(symptom));
  if(!extra)return PHOTO_GUIDANCE.base;
  return [PHOTO_GUIDANCE.base[0],PHOTO_GUIDANCE[extra],PHOTO_GUIDANCE.base[2]];
}

export function createPresentedResult(draft,estimate,settings,generatedAt=new Date().toISOString()){
  const diagnosis=draft.diagnosis||{},answers=diagnosis.interviewAnswers||{},missing=[];
  if(diagnosis.makerStatus==='unknown'||!diagnosis.makerName&&diagnosis.makerStatus!=='photo')missing.push('メーカー・型番の写真または情報');
  if(!draft.media?.count)missing.push('排煙窓全体・操作部分などの写真');
  const falling=diagnosis.urgency==='falling'||answers.falling_risk==='yes';
  const high=['largeLadder','secondFloor','highLift','unknown'].includes(diagnosis.heightType);
  const symptoms=selectedSymptoms(diagnosis);
  const focus=symptoms.includes('leak')?'窓枠・シール部分と水が入る位置':symptoms.includes('wire')?'ワイヤーと接続部分':symptoms.includes('detached')?'外れた部品と固定部分':'開閉装置・可動部分・周辺部品';
  const recommendation=falling
    ?'窓や部品に触れず、安全な場所から早めに業者へご相談ください。'
    :high||missing.length
      ?'写真と入力内容を業者が確認し、必要に応じて現地調査をご案内します。'
      :'入力内容を業者へ送り、修理方法と現地調査の要否をご確認ください。';
  return {
    version:INTERVIEW_VERSION,generatedAt,
    heading:'入力内容から分かること',
    summary:`${symptoms.map(key=>SYMPTOMS[key]?.[0]).filter(Boolean).join('、')||'症状未選択'}について、${focus}の確認が必要です。`,
    missingItems:missing,
    recommendation,
    safetyNotice:falling?'落下の可能性があるため、ご自身で分解・修理を行わないでください。':'写真と問診だけでは故障原因を確定できません。',
    priceLabel:`${yen(estimate?.minimumPrice)}〜${yen(estimate?.maximumPrice)}`,
    inspectionLabel:`現地調査のみの場合 ${yen(settings.inspection.fee)}`,
    disclaimer:estimate?.disclaimer||'表示金額は入力内容に基づく概算です。正式な修理内容と金額は業者の確認後に確定します。'
  };
}

export function presentedResultRows(result,{contractor=false}={}){
  if(!result)return [];
  return [
    ['確認が必要な内容',result.summary],
    ['不足している情報',result.missingItems?.length?result.missingItems.join('、'):'現在の入力項目はそろっています'],
    ['次の対応',result.recommendation],
    ['安全上のご案内',result.safetyNotice],
    [contractor?'お客様に提示した概算':'修理・交換工事の概算',result.priceLabel],
    [contractor?'お客様に提示した現地調査費':'現地調査費',result.inspectionLabel]
  ];
}
