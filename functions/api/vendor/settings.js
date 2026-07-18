import {authenticatedEmail,tenantIdFrom} from '../../_lib/auth.js';
import {findTenant,parseTenantSettings,publicTenant,database} from '../../_lib/db.js';
import {handleError,HttpError,json,readJson} from '../../_lib/http.js';
import {licenseState} from '../../_lib/trial.js';
import {settingsJson} from '../../_lib/settings.js';

async function authorizedTenant(request,env){
  const email=authenticatedEmail(request),url=new URL(request.url),id=tenantIdFrom(url.searchParams.get('tenant'));
  const row=await findTenant(env,id);
  if(!row||String(row.vendor_email).toLowerCase()!==email)throw new HttpError(403,'forbidden','この業者設定を利用できません。');
  const state=licenseState(row);
  if(state!=='active')throw new HttpError(state==='expired'?410:403,state,state==='expired'?'試験利用期間が終了しています。':'このアプリは現在停止されています。');
  return {row,email};
}

export async function onRequestGet({request,env}){
  try{
    const {row,email}=await authorizedTenant(request,env);
    return json({ok:true,user:{email},tenant:publicTenant(row,'active',parseTenantSettings(row))});
  }catch(error){return handleError(error)}
}

export async function onRequestPut({request,env}){
  try{
    const {row}=await authorizedTenant(request,env),body=await readJson(request),{settings,json:serialized}=settingsJson(body.settings),now=new Date().toISOString();
    await database(env).prepare('UPDATE tenants SET company_name = ?1, settings_json = ?2, updated_at = ?3 WHERE id = ?4').bind(settings.company.name,serialized,now,row.id).run();
    const updated={...row,company_name:settings.company.name,settings_json:serialized,updated_at:now};
    return json({ok:true,tenant:publicTenant(updated,'active',settings)});
  }catch(error){return handleError(error)}
}
