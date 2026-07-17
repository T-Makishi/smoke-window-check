export const yen=n=>`${Number(n||0).toLocaleString('ja-JP')}円`;
export const dateTime=iso=>iso?new Intl.DateTimeFormat('ja-JP',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso)):'—';
export const uid=()=>`case_${Date.now().toString(36)}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
export const clone=v=>JSON.parse(JSON.stringify(v));
export const h=(tag,attrs={},children=[])=>{const el=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>{if(k==='class')el.className=v;else if(k==='text')el.textContent=v;else if(k.startsWith('on'))el.addEventListener(k.slice(2).toLowerCase(),v);else if(v!==false&&v!=null)el.setAttribute(k,v===true?'':String(v));});(Array.isArray(children)?children:[children]).forEach(c=>el.append(c instanceof Node?c:document.createTextNode(String(c))));return el};
export const debounce=(fn,delay=250)=>{let id;return(...args)=>{clearTimeout(id);id=setTimeout(()=>fn(...args),delay)}};
export const download=(name,text,type='application/json')=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
export const fullAddress=s=>[s.postalCode&&`〒${s.postalCode}`,s.prefecture,s.city,s.address,s.buildingName,s.floor,s.room].filter(Boolean).join(' ');
export const safeNumber=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)&&n>=0?n:fallback};
