import {DEFAULT_SETTINGS} from './estimate-config.js';

const RECIPIENT_PARAM = 'recipient';
const CONFIG_PARAM = 'cfg';
const CONFIG_VERSION = 1;
const MAX_CONFIG_LENGTH = 12000;
const MAX_CUSTOMER_URL_LENGTH = 2800;
const MAX_TEXT_LENGTH = 2000;
const MAX_AMOUNT = 100000000;
const MAX_LOGO_DATA_URL_LENGTH = 1800;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGO_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+=*$/i;

const COMPANY_KEYS = ['name','tradeName','postalCode','address','phone','email','hours','holidays','contactGuide','logoDataUrl'];
const APP_KEYS = ['name','subtitle','guide','mainColor','accentColor','notes','privacy'];
const INSPECTION_KEYS = ['fee','taxType','deduction','condition','transport','parking','highway','remoteArea','cancellation','absence','heightSurvey','specialSurvey'];
const HEIGHT_KEYS = ['reachable','smallLadder','largeLadder','secondFloor','highLift','unknown'];
const SYMPTOM_KEYS = ['wontOpen','wontClose','spins','heavy','noise','wire','detached','stops','leak','unknown','other'];

export function normalizeRecipient(value) {
  const email = String(value ?? '').trim();
  return EMAIL_PATTERN.test(email) ? email : null;
}

export function readRecipientFromUrl(inputUrl) {
  const url = new URL(inputUrl);
  if (!url.searchParams.has(RECIPIENT_PARAM)) {
    return { present: false, email: null };
  }
  return {
    present: true,
    email: normalizeRecipient(url.searchParams.get(RECIPIENT_PARAM)),
  };
}

export function readCustomerConfigFromUrl(inputUrl) {
  const url = new URL(inputUrl);
  if (!url.searchParams.has(CONFIG_PARAM)) return {present:false,settings:null};
  try {
    const encoded=url.searchParams.get(CONFIG_PARAM)??'';
    if (!encoded || encoded.length>MAX_CONFIG_LENGTH) throw new Error('invalid config length');
    return {present:true,settings:unpackPublicSettings(JSON.parse(decodeBase64Url(encoded)))};
  } catch {
    return {present:true,settings:null};
  }
}

export function applyCustomerConfigFromUrl(settings, inputUrl) {
  const config=readCustomerConfigFromUrl(inputUrl);
  const recipient=readRecipientFromUrl(inputUrl);
  let next=settings;

  if(config.settings){
    const publicSettings=config.settings;
    next={
      ...settings,
      company:{...settings.company,...publicSettings.company},
      app:{...settings.app,...publicSettings.app},
      inspection:{...settings.inspection,...publicSettings.inspection},
      pricing:{
        ...settings.pricing,
        ...publicSettings.pricing,
        height:{...settings.pricing.height,...publicSettings.pricing.height},
        symptoms:{...settings.pricing.symptoms,...publicSettings.pricing.symptoms},
      },
    };
  }

  if(!recipient.present)return next;
  return {...next,company:{...next.company,email:recipient.email??''}};
}

// 旧URLとの互換性のため、従来名も残します。
export const applyRecipientFromUrl=applyCustomerConfigFromUrl;

export function buildCustomerUrl(settings, inputUrl) {
  const recipient=normalizeRecipient(settings?.company?.email);
  if(!recipient)throw new Error('有効な送信先メールアドレスを入力してください。');
  if(settings?.company?.logoDataUrl&&!normalizeLogoDataUrl(settings.company.logoDataUrl))throw new Error('ロゴ画像が大きすぎます。ロゴを選び直してください。');
  const publicSettings=publicSettingsFrom(settings);
  const encoded=encodeBase64Url(JSON.stringify(packPublicSettings(publicSettings)));
  if(encoded.length>MAX_CONFIG_LENGTH)throw new Error('設定内容が長すぎるため、お客様用URLを作成できません。案内文を短くしてください。');
  const url=new URL(inputUrl);
  url.search='';
  url.hash='';
  url.searchParams.set(RECIPIENT_PARAM,recipient);
  url.searchParams.set(CONFIG_PARAM,encoded);
  const result=url.toString();
  if(result.length>MAX_CUSTOMER_URL_LENGTH)throw new Error('お客様用リンクが長すぎます。案内文を短くするか、より単純なロゴ画像を選んでください。');
  return result;
}

function publicSettingsFrom(settings){
  return {
    company:objectFromKeys(settings?.company,DEFAULT_SETTINGS.company,COMPANY_KEYS),
    app:objectFromKeys(settings?.app,DEFAULT_SETTINGS.app,APP_KEYS),
    inspection:objectFromKeys(settings?.inspection,DEFAULT_SETTINGS.inspection,INSPECTION_KEYS),
    pricing:{
      height:objectFromKeys(settings?.pricing?.height,DEFAULT_SETTINGS.pricing.height,HEIGHT_KEYS),
      emergency:numberValue(settings?.pricing?.emergency,DEFAULT_SETTINGS.pricing.emergency),
      additionalWindow:numberValue(settings?.pricing?.additionalWindow,DEFAULT_SETTINGS.pricing.additionalWindow),
      additionalSymptomFee:numberValue(settings?.pricing?.additionalSymptomFee,DEFAULT_SETTINGS.pricing.additionalSymptomFee),
      symptoms:Object.fromEntries(SYMPTOM_KEYS.map(key=>[key,pairValue(settings?.pricing?.symptoms?.[key],DEFAULT_SETTINGS.pricing.symptoms[key])])),
    },
  };
}

function packPublicSettings(settings){
  const defaults=publicSettingsFrom(DEFAULT_SETTINGS),packed={v:CONFIG_VERSION};
  addIfPresent(packed,'c',indexedChanges(COMPANY_KEYS,settings.company,defaults.company));
  addIfPresent(packed,'a',indexedChanges(APP_KEYS,settings.app,defaults.app));
  addIfPresent(packed,'i',indexedChanges(INSPECTION_KEYS,settings.inspection,defaults.inspection));
  const pricing={};
  addIfPresent(pricing,'h',indexedChanges(HEIGHT_KEYS,settings.pricing.height,defaults.pricing.height));
  if(settings.pricing.emergency!==defaults.pricing.emergency)pricing.e=settings.pricing.emergency;
  if(settings.pricing.additionalWindow!==defaults.pricing.additionalWindow)pricing.w=settings.pricing.additionalWindow;
  if(settings.pricing.additionalSymptomFee!==defaults.pricing.additionalSymptomFee)pricing.a=settings.pricing.additionalSymptomFee;
  addIfPresent(pricing,'s',indexedChanges(SYMPTOM_KEYS,settings.pricing.symptoms,defaults.pricing.symptoms));
  addIfPresent(packed,'p',pricing);
  return packed;
}

function unpackPublicSettings(packed){
  if(!plainObject(packed)||packed.v!==CONFIG_VERSION)throw new Error('invalid config');
  const settings=publicSettingsFrom(DEFAULT_SETTINGS);
  applyIndexedChanges(settings.company,COMPANY_KEYS,packed.c);
  applyIndexedChanges(settings.app,APP_KEYS,packed.a);
  applyIndexedChanges(settings.inspection,INSPECTION_KEYS,packed.i);
  if(packed.p!==undefined&&!plainObject(packed.p))throw new Error('invalid pricing config');
  if(plainObject(packed.p)){
    applyIndexedChanges(settings.pricing.height,HEIGHT_KEYS,packed.p.h);
    if(Object.hasOwn(packed.p,'e'))settings.pricing.emergency=packed.p.e;
    if(Object.hasOwn(packed.p,'w'))settings.pricing.additionalWindow=packed.p.w;
    if(Object.hasOwn(packed.p,'a'))settings.pricing.additionalSymptomFee=packed.p.a;
    applyIndexedChanges(settings.pricing.symptoms,SYMPTOM_KEYS,packed.p.s);
  }
  return publicSettingsFrom(settings);
}

function indexedChanges(keys,values,defaults){
  return Object.fromEntries(keys.flatMap((key,index)=>sameValue(values[key],defaults[key])?[]:[[index,values[key]]]));
}

function applyIndexedChanges(target,keys,changes){
  if(changes===undefined)return;
  if(!plainObject(changes))throw new Error('invalid indexed config');
  for(const [index,value] of Object.entries(changes)){
    if(!/^\d+$/.test(index)||Number(index)>=keys.length)throw new Error('invalid config index');
    target[keys[Number(index)]]=value;
  }
}

function addIfPresent(target,key,value){if(plainObject(value)&&Object.keys(value).length)target[key]=value}
function plainObject(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)}
function sameValue(left,right){return Array.isArray(left)&&Array.isArray(right)?left.length===right.length&&left.every((value,index)=>value===right[index]):left===right}

function objectFromKeys(source,fallback,keys){
  return Object.fromEntries(keys.map(key=>[key,valueForKey(key,source?.[key],fallback[key])]))
}

function valueForKey(key,value,fallback){
  if(typeof fallback==='number')return numberValue(value,fallback);
  const text=typeof value==='string'?value:String(fallback??'');
  if(key==='logoDataUrl')return normalizeLogoDataUrl(text)??'';
  if(key==='taxType')return text==='excluded'?'excluded':'included';
  if(key==='mainColor'||key==='accentColor')return /^#[0-9a-f]{6}$/i.test(text)?text:fallback;
  return text.slice(0,MAX_TEXT_LENGTH);
}

function numberValue(value,fallback){
  const number=Number(value);
  return Number.isFinite(number)?Math.min(MAX_AMOUNT,Math.max(0,number)):fallback;
}

function pairValue(value,fallback){
  const pair=Array.isArray(value)?value:[];
  return [numberValue(pair[0],fallback[0]),numberValue(pair[1],fallback[1])];
}

function normalizeLogoDataUrl(value){
  const logo=String(value??'');
  return logo.length<=MAX_LOGO_DATA_URL_LENGTH&&LOGO_PATTERN.test(logo)?logo:null;
}

function encodeBase64Url(text){
  const bytes=new TextEncoder().encode(text);
  let binary='';
  for(let index=0;index<bytes.length;index+=0x8000)binary+=String.fromCharCode(...bytes.subarray(index,index+0x8000));
  return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}

function decodeBase64Url(value){
  const normalized=value.replaceAll('-','+').replaceAll('_','/');
  const padded=normalized+'='.repeat((4-normalized.length%4)%4);
  const binary=atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary,char=>char.charCodeAt(0)));
}
