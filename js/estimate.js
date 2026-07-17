import {SYMPTOMS} from './estimate-config.js';

const workMap={wontOpen:['開閉機構の固着・部品劣化','調整または開閉部品の交換'],wontClose:['開閉機構のずれ・部品劣化','調整または開閉部品の交換'],spins:['ハンドルまたは内部ギアの摩耗','ハンドル・オペレーターの交換'],heavy:['可動部の汚れ・摩耗・ずれ','清掃、注油、建付け調整'],noise:['可動部の摩耗・干渉','点検、調整、必要部品の交換'],wire:['ワイヤーの断線・劣化','ワイヤー交換と動作調整'],detached:['固定部品の緩み・破損','部品の再固定または交換'],stops:['開閉機構の引っ掛かり・摩耗','動作調整または部品交換'],leak:['パッキン・シール・建付けの不具合','止水部の点検・補修'],unknown:['開閉機構または周辺部品の不具合','現場での動作・部品確認'],other:['入力情報だけでは特定できません','現場確認後に修理方法を提案']};

export const selectedSymptoms=diagnosis=>{
  const values=Array.isArray(diagnosis?.symptoms)?diagnosis.symptoms.filter(key=>SYMPTOMS[key]):[];
  if(values.length)return [...new Set(values)];
  return diagnosis?.symptom&&SYMPTOMS[diagnosis.symptom]?[diagnosis.symptom]:[];
};

export function calculateEstimate(draft,settings){
  const d=draft.diagnosis,p=settings.pricing,selected=selectedSymptoms(d);
  const symptomKeys=selected.length?selected:['unknown'];
  const primary=symptomKeys.reduce((best,key)=>(p.symptoms[key]||p.symptoms.unknown)[1]>(p.symptoms[best]||p.symptoms.unknown)[1]?key:best,symptomKeys[0]);
  const base=p.symptoms[primary]||p.symptoms.unknown;
  const symptomExtra=Math.max(0,symptomKeys.length-1)*(p.additionalSymptomFee||0);
  const height=p.height[d.heightType]??p.height.unknown;
  const qty=d.quantity==='5plus'?5:Math.max(1,Number(d.quantity)||1);
  const extra=Math.max(0,qty-1)*p.additionalWindow;
  const urgent=d.urgency==='immediate'||d.urgency==='falling'?p.emergency:0;
  const uncertainty=d.makerStatus==='unknown'?3000:0;
  const building=['factory','warehouse','commercial'].includes(d.buildingType)?5000:0;
  const descriptions=symptomKeys.map(key=>workMap[key]||workMap.unknown);
  const faults=[...new Set(descriptions.map(x=>x[0]))].join('／');
  const repairs=[...new Set(descriptions.map(x=>x[1]))].join('／');
  const high=['largeLadder','secondFloor','highLift'].includes(d.heightType);
  return {minimumPrice:base[0]+symptomExtra+height+extra+urgent+building,maximumPrice:base[1]+symptomExtra*2+height+extra+urgent+building+uncertainty,estimatedFault:faults,estimatedWork:repairs,estimatedTime:qty>=3||symptomKeys.length>=3?'半日〜1日':'1〜4時間',workers:high||qty>=3?'2名程度':'1〜2名',highPlacePossible:high,partsPossible:symptomKeys.some(key=>!['heavy','noise'].includes(key)),urgency:d.urgency==='falling'?'非常に高い':d.urgency==='immediate'?'高い':d.urgency==='business'||d.urgency==='safety'?'やや高い':'通常',reason:'設置状況、部品の型式、症状同士の関連、劣化範囲を写真と問診だけでは確定できないためです。',tools:high?'大型脚立または高所作業機材、測定工具、交換部品':'脚立、測定工具、調整工具、交換部品',disclaimer:'この結果は入力内容に基づく概算です。正式な修理内容と金額は、現場確認後に確定します。'};
}

export const symptomLabel=key=>SYMPTOMS[key]?.[0]||'未選択';
export const symptomLabels=diagnosis=>selectedSymptoms(diagnosis).map(symptomLabel);
