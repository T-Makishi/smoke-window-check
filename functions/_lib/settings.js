import {HttpError} from './http.js';

const MAX_TEXT=2000,MAX_AMOUNT=100000000,MAX_LOGO=1800;
const EMAIL_PATTERN=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGO_PATTERN=/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+=*$/i;
const COMPANY_KEYS=['name','tradeName','postalCode','address','phone','email','hours','holidays','contactGuide','logoDataUrl'];
const APP_KEYS=['name','subtitle','guide','mainColor','accentColor','notes','privacy'];
const INSPECTION_TEXT_KEYS=['taxType','condition','transport','parking','highway','cancellation','absence'];
const INSPECTION_NUMBER_KEYS=['fee','deduction','remoteArea','heightSurvey','specialSurvey'];
const HEIGHT_KEYS=['reachable','smallLadder','largeLadder','secondFloor','highLift','unknown'];
const SYMPTOM_KEYS=['wontOpen','wontClose','spins','heavy','noise','wire','detached','stops','leak','unknown','other'];

const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const text=value=>String(value??'').slice(0,MAX_TEXT);
const amount=value=>{const n=Number(value);return Number.isFinite(n)?Math.min(MAX_AMOUNT,Math.max(0,n)):0};
const pickText=(source,keys)=>Object.fromEntries(keys.map(key=>[key,text(source[key])]));
const pickNumber=(source,keys)=>Object.fromEntries(keys.map(key=>[key,amount(source[key])]));

export function sanitizeSettings(value){
  const source=object(value),company=pickText(object(source.company),COMPANY_KEYS),app=pickText(object(source.app),APP_KEYS),inspectionSource=object(source.inspection),pricingSource=object(source.pricing),symptomsSource=object(pricingSource.symptoms);
  if(!company.name)throw new HttpError(400,'invalid_settings','設備会社名を入力してください。');
  if(!EMAIL_PATTERN.test(company.email))throw new HttpError(400,'invalid_settings','有効な受付メールアドレスを入力してください。');
  if(company.logoDataUrl&&(!LOGO_PATTERN.test(company.logoDataUrl)||company.logoDataUrl.length>MAX_LOGO))throw new HttpError(400,'invalid_settings','ロゴ画像が大きすぎるか、形式が正しくありません。');
  app.mainColor=/^#[0-9a-f]{6}$/i.test(app.mainColor)?app.mainColor:'#1E5E3A';
  app.accentColor=/^#[0-9a-f]{6}$/i.test(app.accentColor)?app.accentColor:'#FF8A00';
  const inspection={...pickText(inspectionSource,INSPECTION_TEXT_KEYS),...pickNumber(inspectionSource,INSPECTION_NUMBER_KEYS)};
  inspection.taxType=inspection.taxType==='excluded'?'excluded':'included';
  const pricing={
    height:pickNumber(object(pricingSource.height),HEIGHT_KEYS),
    emergency:amount(pricingSource.emergency),
    additionalWindow:amount(pricingSource.additionalWindow),
    additionalSymptomFee:amount(pricingSource.additionalSymptomFee),
    symptoms:Object.fromEntries(SYMPTOM_KEYS.map(key=>{
      const pair=Array.isArray(symptomsSource[key])?symptomsSource[key]:[];
      return [key,[amount(pair[0]),amount(pair[1])]];
    })),
  };
  return {company,app,inspection,pricing};
}

export function settingsJson(value){
  const settings=sanitizeSettings(value),json=JSON.stringify(settings);
  if(new TextEncoder().encode(json).byteLength>60000)throw new HttpError(413,'settings_too_large','設定内容が大きすぎます。');
  return {settings,json};
}
