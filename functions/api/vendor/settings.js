import {parseTenantSettings,publicTenant,database} from '../../_lib/db.js';
import {handleError,json,readJson} from '../../_lib/http.js';
import {settingsJson} from '../../_lib/settings.js';
import {authorizedTenant} from '../../_lib/vendor-auth.js';

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
