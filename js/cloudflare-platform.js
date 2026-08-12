const TENANT_PARAM='t';
const TENANT_PATTERN=/^sw_[A-Za-z0-9_-]{12,32}$/;

export function readTenantId(inputUrl){
  const value=new URL(inputUrl).searchParams.get(TENANT_PARAM)||'';
  return TENANT_PATTERN.test(value)?value:null;
}

export function isTenantUrl(inputUrl){return new URL(inputUrl).searchParams.has(TENANT_PARAM)}

export function wantsAdmin(inputUrl){return new URL(inputUrl).searchParams.get('admin')==='1'}

export function remainingTrialDays(tenant,now=Date.now()){
  if(!tenant||tenant.licenseType==='production')return null;
  const expiresAt=Date.parse(tenant.expiresAt),current=now instanceof Date?now.getTime():Number(now);
  if(!Number.isFinite(expiresAt)||!Number.isFinite(current))return null;
  const remaining=expiresAt-current;
  return remaining<=0?0:Math.ceil(remaining/(24*60*60*1000));
}

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
  if(base.searchParams.get('resetPasscode')==='1')url.searchParams.set('resetPasscode','1');
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

export async function submitPublicInquiry(tenantId,inquiry,{fetcher=fetch,origin=location.origin}={}){
  const url=new URL('/api/public/inquiries',origin);url.searchParams.set('tenant',tenantId);
  return requestJson(url,{fetcher,method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientSubmissionId:inquiry.id,agreed:inquiry.submission?.agreed===true,inquiry})});
}

export async function loadVendorInquiries(tenantId,{query='',status='',id=''},{fetcher=fetch,origin=location.origin}={}){
  const url=new URL('/api/vendor/inquiries',origin);url.searchParams.set('tenant',tenantId);if(query)url.searchParams.set('q',query);if(status)url.searchParams.set('status',status);if(id)url.searchParams.set('id',id);
  return requestJson(url,{fetcher,credentials:'same-origin'});
}

export async function exportVendorInquiriesCsv(tenantId,{fetcher=fetch,origin=location.origin}={}){
  const url=new URL('/api/vendor/inquiries-export',origin);url.searchParams.set('tenant',tenantId);
  let response;
  try{response=await fetcher(url.toString(),{credentials:'same-origin'})}
  catch{throw platformError('network_error','CSVを保存できません。通信状態を確認してください。')}
  if(!response.ok){
    const type=response.headers?.get?.('content-type')||'';
    if(type.includes('application/json'))try{const data=await response.json();throw platformError(data.error?.code||'export_failed',data.error?.message||'CSVを保存できませんでした。')}catch(error){if(error?.code)throw error}
    throw platformError('export_failed','CSVを保存できませんでした。時間をおいて再度お試しください。');
  }
  return {blob:await response.blob(),filename:csvFilename(response.headers?.get?.('content-disposition')),count:Number(response.headers?.get?.('x-record-count')||0)};
}

export async function updateVendorInquiry(tenantId,input,{fetcher=fetch,origin=location.origin}={}){
  const url=new URL('/api/vendor/inquiries',origin);url.searchParams.set('tenant',tenantId);
  return requestJson(url,{fetcher,credentials:'same-origin',method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
}

export async function deleteVendorInquiry(tenantId,id,{fetcher=fetch,origin=location.origin}={}){
  const url=new URL('/api/vendor/inquiries',origin);url.searchParams.set('tenant',tenantId);
  return requestJson(url,{fetcher,credentials:'same-origin',method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({id})});
}

export async function loadVendorPasscodeState(tenantId,{fetcher=fetch,origin=location.origin}={}){
  const url=new URL('/api/vendor/passcode',origin);url.searchParams.set('tenant',tenantId);
  return requestJson(url,{fetcher,credentials:'same-origin'});
}

export async function submitVendorPasscode(tenantId,body,{fetcher=fetch,origin=location.origin}={}){
  const url=new URL('/api/vendor/passcode',origin);url.searchParams.set('tenant',tenantId);
  return requestJson(url,{fetcher,credentials:'same-origin',method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
}

export async function clearVendorPasscodeSession(tenantId,{fetcher=fetch,origin=location.origin}={}){
  const url=new URL('/api/vendor/passcode',origin);url.searchParams.set('tenant',tenantId);
  return requestJson(url,{fetcher,credentials:'same-origin',method:'DELETE'});
}

export async function requestVendorIdentityLink(tenantId,{email,purpose='login'},{fetcher=fetch,origin=location.origin}={}){
  const url=new URL('/api/vendor/identity',origin);url.searchParams.set('tenant',tenantId);
  return requestJson(url,{fetcher,credentials:'same-origin',method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,purpose})});
}

export async function clearVendorIdentitySession(tenantId,{fetcher=fetch,origin=location.origin}={}){
  const url=new URL('/api/vendor/identity',origin);url.searchParams.set('tenant',tenantId);
  return requestJson(url,{fetcher,credentials:'same-origin',method:'DELETE'});
}

export async function loadProductionRequest(tenantId,{fetcher=fetch,origin=location.origin}={}){
  const url=new URL('/api/vendor/production-request',origin);url.searchParams.set('tenant',tenantId);
  return requestJson(url,{fetcher,credentials:'same-origin'});
}

export async function submitProductionRequest(tenantId,body,{fetcher=fetch,origin=location.origin}={}){
  const url=new URL('/api/vendor/production-request',origin);url.searchParams.set('tenant',tenantId);
  return requestJson(url,{fetcher,credentials:'same-origin',method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
}

export async function loadVendorSubscription(tenantId,{fetcher=fetch,origin=location.origin}={}){
  const url=new URL('/api/vendor/subscription',origin);url.searchParams.set('tenant',tenantId);
  return requestJson(url,{fetcher,credentials:'same-origin'});
}

export async function updateVendorSubscription(tenantId,body,{fetcher=fetch,origin=location.origin}={}){
  const url=new URL('/api/vendor/subscription',origin);url.searchParams.set('tenant',tenantId);
  return requestJson(url,{fetcher,credentials:'same-origin',method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
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
function csvFilename(disposition){const matched=String(disposition||'').match(/filename="?([^";]+)"?/i);return matched?.[1]||`smoke-window-inquiries-${new Date().toISOString().slice(0,10)}.csv`}
