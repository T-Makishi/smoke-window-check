import {findTenant,parseTenantSettings,publicTenant} from '../../_lib/db.js';
import {handleError,json} from '../../_lib/http.js';
import {tenantIdFrom} from '../../_lib/auth.js';
import {licenseState} from '../../_lib/trial.js';

export async function onRequestGet({request,env}){
  try{
    const url=new URL(request.url),id=tenantIdFrom(url.searchParams.get('tenant'));
    const row=await findTenant(env,id),state=licenseState(row);
    if(!row)return json({ok:false,tenant:{state}},{status:404});
    if(state!=='active')return json({ok:false,tenant:publicTenant(row,state)},{status:state==='expired'?410:403});
    return json({ok:true,tenant:publicTenant(row,state,parseTenantSettings(row))});
  }catch(error){return handleError(error)}
}
