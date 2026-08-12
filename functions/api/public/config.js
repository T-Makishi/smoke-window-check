import {database,findTenant,parseTenantSettings,publicTenant} from '../../_lib/db.js';
import {handleError,json} from '../../_lib/http.js';
import {tenantIdFrom} from '../../_lib/auth.js';
import {licenseState} from '../../_lib/trial.js';
import {billingAccessState} from '../../_lib/billing.js';

export async function onRequestGet({request,env}){
  try{
    const url=new URL(request.url),id=tenantIdFrom(url.searchParams.get('tenant'));
    const row=await findTenant(env,id);let state=licenseState(row);
    if(!row)return json({ok:false,tenant:{state}},{status:404});
    if(state==='active'&&row.license_type==='production'){
      const subscription=await database(env).prepare('SELECT status,current_period_end,grace_ends_at FROM billing_subscriptions WHERE tenant_id=?1').bind(id).first();
      if(billingAccessState(subscription)!=='active')state='suspended';
    }
    if(state!=='active')return json({ok:false,tenant:publicTenant(row,state)},{status:state==='expired'?410:403});
    return json({ok:true,tenant:publicTenant(row,state,parseTenantSettings(row))});
  }catch(error){return handleError(error)}
}
