import {DEFAULT_SETTINGS} from './estimate-config.js';
import {clone,safeNumber} from './utils.js';
export function settingsFromForm(form,current){const fd=new FormData(form),s=clone(current);for(const [path,value] of fd){const keys=path.split('.');let o=s;while(keys.length>1)o=o[keys.shift()];const key=keys[0];o[key]=form.elements[path]?.type==='number'?safeNumber(value,o[key]):value}return s}
export const resetSettings=()=>clone(DEFAULT_SETTINGS);
