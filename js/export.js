import {dateTime,fullAddress,yen} from './utils.js';
import {LABELS,SYMPTOMS} from './estimate-config.js';
import {symptomLabels} from './estimate.js';
export function caseText(c,settings){const d=c.diagnosis,cu=c.customer;return [
  `【${settings.app.name}】`,`運営会社：${settings.company.name}`,`依頼者区分：${LABELS.customerType[c.customerType]||c.customerType}`,
  cu.companyName&&`会社名：${cu.companyName}`,cu.storeName&&`店舗名：${cu.storeName}`,cu.facilityName&&`施設名：${cu.facilityName}`,
  `担当者名：${cu.contactName}`,`電話番号：${cu.phone}`,`現場住所：${fullAddress(c.site)}`,c.site.siteName&&`現場名：${c.site.siteName}`,
  `症状：${symptomLabels(d).join('、')||SYMPTOMS[d.symptom]?.[0]||d.symptom}`,`設置高さ：${LABELS.height[d.heightType]||d.heightType}`,`対象数量：${d.quantity==='5plus'?'5か所以上':`${d.quantity}か所`}`,
  `緊急度：${LABELS.urgency[d.urgency]||d.urgency}`,`概算費用：${yen(c.estimate?.minimumPrice)}〜${yen(c.estimate?.maximumPrice)}`,
  `現地調査のみ：${yen(c.inspectionFee.amount)}`,`工事を正式依頼：工事代金から${yen(c.inspectionFee.deductionOnFormalOrder)}を差し引く`,`現地調査費確認：${c.inspectionFee.agreed?'確認済み':'未確認'}`,
  d.notes&&`補足：${d.notes}`,`添付：${c.media.count}点`,`保存日時：${dateTime(c.createdAt)}`
].filter(Boolean).join('\n')}

export async function copyText(text){if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return}const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.append(t);t.select();document.execCommand('copy');t.remove()}

export function buildMailto(c,settings){
  const recipient=String(settings.company.email||'').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))throw new Error('有効な問診受付メールアドレスが設定されていません。');
  const subject=`【排煙窓事前チェック】${c.customer.companyName||c.customer.storeName||c.customer.facilityName||c.customer.contactName||'新規相談'}`;
  const mediaNote=c.media.count>0?`\n\n※写真・動画 ${c.media.count}点は、このメール作成画面で添付してください。`:'\n\n※写真・動画の添付はありません。';
  return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(caseText(c,settings)+mediaNote)}`;
}
