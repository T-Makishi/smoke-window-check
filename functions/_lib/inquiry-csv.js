const STATUS_LABELS={unconfirmed:'未確認',consulting:'相談中',sitePlanned:'現地調査予定',inspected:'現地調査済み',quoted:'見積提出済み',ordered:'受注',completed:'完了',onHold:'保留',cancelled:'キャンセル'};

const text=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'');
const safeSpreadsheetValue=value=>{const valueText=text(value);return /^[\t\r\n ]*[=+\-@]/.test(valueText)?`'${valueText}`:valueText};
const cell=value=>`"${safeSpreadsheetValue(value).replaceAll('"','""')}"`;
const json=value=>value&&typeof value==='object'?JSON.stringify(value):'';
const payloadFrom=row=>{try{return JSON.parse(row.payload_json||'{}')}catch{return {}}};

export const INQUIRY_CSV_COLUMNS=[
  '受付番号','受信日時','更新日時','対応状況','担当者','社内メモ',
  '依頼者区分','会社名','店舗名','施設名','部署名','担当者名','電話番号','メールアドレス','管理番号',
  '郵便番号','都道府県','市区町村','住所','建物名','階数','部屋番号','現場名','現場担当者','現場電話番号',
  '症状','緊急度','メーカー','数量','概算下限','概算上限','現地調査費','写真・動画点数','写真・動画ファイル名',
  '問診回答(JSON)','案件データ(JSON)'
];

export function inquiryCsvRow(row){
  const payload=payloadFrom(row),customer=payload.customer||{},site=payload.site||{},diagnosis=payload.diagnosis||{},inspection=payload.inspectionFee||{};
  return [
    row.case_number,row.received_at,row.updated_at,STATUS_LABELS[row.status]||row.status,row.assignee,row.internal_memo,
    payload.customerType,customer.companyName,customer.storeName,customer.facilityName,customer.departmentName,customer.contactName,customer.phone,customer.email,customer.managementNumber,
    site.postalCode,site.prefecture,site.city,site.address,site.buildingName,site.floor,site.room,site.siteName,site.siteContact,site.sitePhone,
    row.symptom_summary,row.urgency,diagnosis.makerName,diagnosis.quantity,row.estimate_min,row.estimate_max,inspection.amount,row.media_count,parseNames(row.media_names_json).join(' / '),
    json(diagnosis.interviewAnswers),json(payload)
  ];
}

export function inquiriesToCsv(rows){
  const lines=[INQUIRY_CSV_COLUMNS,...rows.map(inquiryCsvRow)].map(values=>values.map(cell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

function parseNames(value){try{const names=JSON.parse(value||'[]');return Array.isArray(names)?names:[]}catch{return []}}
