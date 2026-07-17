export const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE=/^[0-9+()\-\s]{8,20}$/;
const req=(v,msg)=>String(v||'').trim()?null:msg;
export function validateStep(step,d){
  const e={};
  if(step===1){
    if(!d.customerType)e.customerType='依頼者区分を選択してください。';
    const c=d.customer;
    if(d.customerType==='corporate')e['customer.companyName']=req(c.companyName,'会社名を入力してください。');
    if(d.customerType==='store')e['customer.storeName']=req(c.storeName,'店舗名を入力してください。');
    if(d.customerType==='facility'&&!c.companyName&&!c.facilityName)e['customer.companyName']='管理会社名または施設名のどちらかを入力してください。';
    e['customer.contactName']=req(c.contactName,d.customerType==='individual'?'氏名を入力してください。':'担当者名を入力してください。');
    e['customer.phone']=req(c.phone,'電話番号を入力してください。');
    if(c.phone&&!PHONE.test(c.phone))e['customer.phone']='電話番号を半角数字とハイフンで入力してください。';
    if(c.email&&!EMAIL.test(c.email))e['customer.email']='メールアドレスの形式を確認してください。';
  }
  if(step===2&&!(Array.isArray(d.diagnosis.symptoms)&&d.diagnosis.symptoms.length)&&!d.diagnosis.symptom)e['diagnosis.symptoms']='当てはまる症状を1つ以上選択してください。';
  if(step===4){
    e['site.prefecture']=req(d.site.prefecture,'都道府県を選択してください。');
    e['site.city']=req(d.site.city,'市区町村を入力してください。');
    e['site.address']=req(d.site.address,'番地を入力してください。');
    if(d.site.sitePhone&&!PHONE.test(d.site.sitePhone))e['site.sitePhone']='電話番号の形式を確認してください。';
  }
  if(step===5)for(const [k,m] of [['buildingType','建物の種類'],['heightType','設置高さ'],['quantity','対象数量'],['makerStatus','メーカー情報'],['onset','発生時期'],['urgency','緊急性']])e[`diagnosis.${k}`]=req(d.diagnosis[k],`${m}を選択してください。`);
  if(step===6&&!d.inspectionFee.agreed)e.agreed='料金条件を確認し、チェックを入れてください。';
  return Object.fromEntries(Object.entries(e).filter(([,v])=>v));
}
