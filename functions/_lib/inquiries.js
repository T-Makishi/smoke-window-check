import {HttpError} from './http.js';

const STATUS_VALUES=new Set(['unconfirmed','consulting','sitePlanned','inspected','quoted','ordered','completed','onHold','cancelled']);
const EMAIL_PATTERN=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT=2000;

const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const text=(value,max=MAX_TEXT)=>String(value??'').trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max);
const amount=value=>{const number=Number(value);return Number.isFinite(number)?Math.max(0,Math.min(100_000_000,Math.round(number))):0};
const textObject=(value,keys)=>Object.fromEntries(keys.map(key=>[key,text(object(value)[key])]));

export function inquiryInput(body){
  const source=object(body),draft=object(source.inquiry),customer=textObject(draft.customer,['companyName','storeName','facilityName','departmentName','contactName','phone','email','managementNumber']);
  if(source.agreed!==true)throw new HttpError(400,'submission_agreement_required','問診回答の保存と送信への同意が必要です。');
  const site=textObject(draft.site,['postalCode','prefecture','city','address','buildingName','floor','room','siteName','parking','elevator','workHours','entryProcedure','siteContact','sitePhone']);
  const diagnosisSource=object(draft.diagnosis),answers=object(diagnosisSource.interviewAnswers);
  const diagnosis={
    symptom:text(diagnosisSource.symptom,50),
    symptoms:Array.isArray(diagnosisSource.symptoms)?diagnosisSource.symptoms.map(value=>text(value,50)).filter(Boolean).slice(0,12):[],
    interviewVersion:Math.max(1,Math.min(20,Number(diagnosisSource.interviewVersion)||1)),
    interviewAnswers:Object.fromEntries(Object.entries(answers).slice(0,20).map(([key,value])=>[text(key,80),text(value,200)])),
    ...textObject(diagnosisSource,['buildingType','heightType','quantity','makerStatus','makerName','onset','urgency','notes']),
  };
  const estimateSource=object(draft.estimate),inspectionSource=object(draft.inspectionFee),mediaSource=object(draft.media),presentedSource=object(draft.presentedResult);
  const estimate={minimumPrice:amount(estimateSource.minimumPrice),maximumPrice:amount(estimateSource.maximumPrice),estimatedFault:text(estimateSource.estimatedFault),estimatedWork:text(estimateSource.estimatedWork),estimatedTime:text(estimateSource.estimatedTime),workers:text(estimateSource.workers),highPlacePossible:Boolean(estimateSource.highPlacePossible),partsPossible:Boolean(estimateSource.partsPossible),urgency:text(estimateSource.urgency),reason:text(estimateSource.reason),tools:text(estimateSource.tools)};
  const inspectionFee={amount:amount(inspectionSource.amount),taxType:inspectionSource.taxType==='excluded'?'excluded':'included',chargeWhenInspectionOnly:Boolean(inspectionSource.chargeWhenInspectionOnly),deductionOnFormalOrder:amount(inspectionSource.deductionOnFormalOrder),agreed:inspectionSource.agreed===true,agreedAt:text(inspectionSource.agreedAt,50)};
  const mediaNames=Array.isArray(mediaSource.names)?mediaSource.names.map(value=>text(value,200)).filter(Boolean).slice(0,3):[];
  const media={count:Math.max(0,Math.min(3,Number(mediaSource.count)||0)),saved:false,names:mediaNames};
  const presentedResult={heading:text(presentedSource.heading),summary:text(presentedSource.summary),nextAction:text(presentedSource.nextAction),urgency:text(presentedSource.urgency),disclaimer:text(presentedSource.disclaimer)};
  const clientSubmissionId=text(source.clientSubmissionId,100),customerType=text(draft.customerType,50);
  if(!/^case_[A-Za-z0-9_-]{8,80}$/.test(clientSubmissionId))throw new HttpError(400,'invalid_submission','送信内容を確認できません。');
  if(!customerType||!customer.contactName||!customer.phone)throw new HttpError(400,'invalid_customer','依頼者名と電話番号を確認してください。');
  if(customer.email&&!EMAIL_PATTERN.test(customer.email))throw new HttpError(400,'invalid_email','メールアドレスを確認してください。');
  if(!site.city||!site.address)throw new HttpError(400,'invalid_site','現場住所を確認してください。');
  if(!diagnosis.symptoms.length)throw new HttpError(400,'invalid_diagnosis','症状を確認してください。');
  if(!inspectionFee.agreed)throw new HttpError(400,'agreement_required','料金条件の確認が必要です。');
  return {clientSubmissionId,inquiry:{id:clientSubmissionId,createdAt:text(draft.createdAt,50),updatedAt:text(draft.updatedAt,50),customerType,customer,site,diagnosis,estimate,presentedResult,inspectionFee,media,status:'unconfirmed',memo:''}};
}

export function inquirySummary(row,{includePayload=false}={}){
  let payload;
  if(includePayload)try{payload=JSON.parse(row.payload_json)}catch{payload=null}
  return {id:row.id,caseNumber:row.case_number,customerName:row.customer_name,customerEmail:row.customer_email,customerPhone:row.customer_phone,siteAddress:row.site_address,siteName:row.site_name,symptomSummary:row.symptom_summary,urgency:row.urgency,estimateMin:row.estimate_min,estimateMax:row.estimate_max,mediaCount:row.media_count,mediaNames:parseArray(row.media_names_json),status:row.status,assignee:row.assignee,internalMemo:row.internal_memo,emailStatus:row.email_status,receivedAt:row.received_at,updatedAt:row.updated_at,...(includePayload?{inquiry:payload}:{})};
}

export function inquiryUpdate(body){
  const source=object(body),id=text(source.id,80),status=text(source.status,30),assignee=text(source.assignee,100),internalMemo=text(source.internalMemo,4000);
  if(!/^inq_[A-Za-z0-9_-]{12,40}$/.test(id))throw new HttpError(400,'invalid_inquiry','問い合わせを確認できません。');
  if(!STATUS_VALUES.has(status))throw new HttpError(400,'invalid_status','対応状況を確認してください。');
  return {id,status,assignee,internalMemo};
}

export function inquiryDeleteInput(body){
  const id=text(object(body).id,80);
  if(!/^inq_[A-Za-z0-9_-]{12,40}$/.test(id))throw new HttpError(400,'invalid_inquiry','問い合わせを確認できません。');
  return id;
}

export function randomInquiryId(){return randomId('inq_',12)}
export function randomCaseNumber(now=new Date()){
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now).replaceAll('-','');
  const bytes=crypto.getRandomValues(new Uint8Array(5)),suffix=[...bytes].map(value=>(value%36).toString(36)).join('').toUpperCase();
  return `SW-${date}-${suffix}`;
}

function randomId(prefix,byteLength){const bytes=crypto.getRandomValues(new Uint8Array(byteLength));return `${prefix}${btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')}`}
function parseArray(value){try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{return []}}
