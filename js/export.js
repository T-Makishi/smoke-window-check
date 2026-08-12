import {dateTime,fullAddress,yen} from './utils.js';
import {LABELS,SYMPTOMS} from './estimate-config.js';
import {symptomLabels} from './estimate.js';
import {createPresentedResult,interviewRows,presentedResultRows} from './interview-config.js?v=20260812c';

const field=(label,value)=>value===undefined||value===null||value===''?null:`${label}：${value}`;
const section=(title,rows)=>[`■ ${title}`,...rows.filter(Boolean),''];
const detailRows=rows=>rows.flatMap(([label,value])=>value?[`${label}：`,`  ${value}`]:[]);

export function caseText(c,settings){
  const d=c.diagnosis,cu=c.customer;
  const result=c.presentedResult||createPresentedResult(c,c.estimate,settings,c.updatedAt||c.createdAt||new Date().toISOString());
  const questions=interviewRows(d);
  const resultRows=presentedResultRows(result,{contractor:true}).filter(([label])=>!label.includes('概算')&&!label.includes('現地調査費'));
  const quantity=LABELS.quantity[d.quantity]||(d.quantity==='5plus'?'5か所以上':d.quantity?`${d.quantity}か所`:'未入力');
  return [
    `【${settings.app.name}】`,
    '新しい事前チェックを受け付けました。','',
    ...section('受付情報',[
      field('運営会社',settings.company.name),
      field('保存日時',dateTime(c.createdAt))
    ]),
    ...section('ご依頼者情報',[
      field('依頼者区分',LABELS.customerType[c.customerType]||c.customerType),
      field('会社名',cu.companyName),field('店舗名',cu.storeName),field('施設名',cu.facilityName),
      field('担当者名',cu.contactName),field('電話番号',cu.phone),field('メール',cu.email)
    ]),
    ...section('現場・症状',[
      field('現場住所',fullAddress(c.site)),field('現場名',c.site.siteName),
      field('症状',symptomLabels(d).join('、')||SYMPTOMS[d.symptom]?.[0]||d.symptom),
      field('設置高さ',LABELS.height[d.heightType]||d.heightType),field('対象数量',quantity),
      field('緊急度',LABELS.urgency[d.urgency]||d.urgency),field('補足',d.notes)
    ]),
    ...section('選択式問診の回答',questions.length
      ?questions.flatMap(([question,answer],index)=>[`Q${index+1}. ${question}`,`A. ${answer}`,''])
      :['回答はありません。']),
    ...section('お客様に提示した事前チェック結果',[
      ...detailRows(resultRows),
      result.disclaimer&&'注意事項：',result.disclaimer&&`  ${result.disclaimer}`
    ]),
    ...section('費用のご案内',[
      field('概算費用',`${yen(c.estimate?.minimumPrice)}〜${yen(c.estimate?.maximumPrice)}`),
      field('現地調査費',`現地調査のみの場合 ${yen(c.inspectionFee.amount)}`),
      field('工事を正式依頼',`工事代金から${yen(c.inspectionFee.deductionOnFormalOrder)}を差し引く`),
      field('現地調査費確認',c.inspectionFee.agreed?'確認済み':'未確認')
    ]),
    ...section('添付ファイル',[
      field('写真・動画',`${c.media.count}点`),
      !c.media.count&&'※写真・動画の添付はありません。'
    ])
  ].filter(value=>value!==null&&value!==undefined).join('\n').trim();
}

export async function copyText(text){if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return}const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.append(t);t.select();document.execCommand('copy');t.remove()}

export function buildMailto(c,settings){
  const recipient=String(settings.company.email||'').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))throw new Error('有効な問診受付メールアドレスが設定されていません。');
  const subject=`【排煙窓事前チェック】${c.customer.companyName||c.customer.storeName||c.customer.facilityName||c.customer.contactName||'新規相談'}`;
  const mediaNote=c.media.count>0?`\n\n※写真・動画 ${c.media.count}点を、このメール作成画面で添付してください。`:'';
  return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(caseText(c,settings)+mediaNote)}`;
}
