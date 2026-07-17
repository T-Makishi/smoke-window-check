import {clone} from './utils.js';
const KEYS={settings:'smokeWindow.settings.v1',cases:'smokeWindow.cases.v1',draft:'smokeWindow.draft.v1'};
const parse=(raw,fallback)=>{try{return raw?JSON.parse(raw):fallback}catch{return fallback}};
export const storage={
  getSettings(defaults){return merge(defaults,parse(localStorage.getItem(KEYS.settings),{}))},saveSettings(v){save(KEYS.settings,v)},
  getCases(){const v=parse(localStorage.getItem(KEYS.cases),[]);return Array.isArray(v)?v:[]},saveCases(v){save(KEYS.cases,v)},
  getDraft(){return parse(localStorage.getItem(KEYS.draft),null)},saveDraft(v){save(KEYS.draft,v)},clearDraft(){localStorage.removeItem(KEYS.draft)},resetSettings(){localStorage.removeItem(KEYS.settings)}
};
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){throw new Error(e?.name==='QuotaExceededError'?'ブラウザの保存容量が不足しています。不要な履歴を削除してください。':'ブラウザへ保存できませんでした。')}}
function merge(base,over){if(!over||typeof over!=='object'||Array.isArray(over))return clone(base);const out=clone(base);for(const [k,v] of Object.entries(over)){if(v&&typeof v==='object'&&!Array.isArray(v)&&out[k])out[k]=merge(out[k],v);else out[k]=v}return out}
export function validBackup(data){return data&&typeof data==='object'&&data.version===1&&Array.isArray(data.cases)&&data.cases.every(c=>c&&typeof c.id==='string'&&c.customer&&c.site&&c.diagnosis&&c.inspectionFee)}
