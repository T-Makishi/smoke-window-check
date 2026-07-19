const TENANT_PARAM='t';
const TENANT_PATTERN=/^sw_[A-Za-z0-9_-]{12,32}$/;

export function readTenantId(inputUrl){
  const value=new URL(inputUrl).searchParams.get(TENANT_PARAM)||'';
  return TENANT_PATTERN.test(value)?value:null;
}

export function isTenantUrl(inputUrl){return new URL(inputUrl).searchParams.has(TENANT_PARAM)}

export function wantsAdmin(inputUrl){return new URL(inputUrl).searchParams.get('admin')==='1'}

export function buildTenantCustomerUrl(tenantId,inputUrl){
  if(!TENANT_PATTERN.test(String(tenantId||'')))throw new Error('お客様用URLを作成できません。業者登録を確認してください。');
  const url=new URL(inputUrl);
  url.pathname='/';url.search='';url.hash='';url.searchParams.set(TENANT_PARAM,tenantId);
  return url.toString();
}

export function vendorLoginUrl(tenantId,inputUrl){
  const base=new URL(inputUrl);
  const url=new URL('/api/vendor/login',base.origin);
  url.searchParams.set('tenant',tenantId);
  return url.toString();
}

export async function loadPublicTenant(tenantId,{fetcher=fetch,origin=location.origin}={}){
  const url=new URL('/api/public/config',origin);url.searchParams.set('tenant',tenantId);
  return requestJson(url,{fetcher});
}

export async function loadVendorTenant(tenantId,{fetcher=fetch,origin=location.origin}={}){
  const url=new URL('/api/vendor/settings',origin);url.searchParams.set('tenant',tenantId);
  return requestJson(url,{fetcher,credentials:'same-origin'});
}

export async function saveVendorTenant(tenantId,settings,{fetcher=fetch,origin=location.origin}={}){
  const url=new URL('/api/vendor/settings',origin);url.searchParams.set('tenant',tenantId);
  return requestJson(url,{fetcher,credentials:'same-origin',method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({settings})});
}

export function mergePublicSettings(base,incoming){
  if(!incoming||typeof incoming!=='object')return base;
  return {
    ...base,
    company:{...base.company,...incoming.company},
    app:{...base.app,...incoming.app},
    inspection:{...base.inspection,...incoming.inspection},
    pricing:{
      ...base.pricing,
      ...incoming.pricing,
      height:{...base.pricing.height,...incoming.pricing?.height},
      symptoms:{...base.pricing.symptoms,...incoming.pricing?.symptoms},
    },
    security:base.security,
  };
}

async function requestJson(url,{fetcher,credentials,method='GET',headers,body}={}){
  let response;
  try{response=await fetcher(url.toString(),{method,headers,body,credentials})}
  catch{throw platformError('network_error','利用情報を確認できません。通信状態を確認してください。')}
  const type=response.headers?.get?.('content-type')||'';
  if(!type.includes('application/json'))throw platformError('authentication_required','メール確認が必要です。');
  let data;
  try{data=await response.json()}catch{throw platformError('invalid_response','利用情報を読み取れません。')}
  if(!response.ok||!data.ok){
    const error=platformError(data.error?.code||data.tenant?.state||'request_failed',data.error?.message||stateMessage(data.tenant?.state));
    error.status=response.status;error.tenant=data.tenant;throw error;
  }
  return data;
}

function platformError(code,message){const error=new Error(message);error.code=code;return error}
function stateMessage(state){return ({expired:'試験利用期間が終了しています。',suspended:'このアプリは現在停止されています。',not_found:'お客様用URLを確認できません。'}[state]||'利用情報を確認できません。')}
