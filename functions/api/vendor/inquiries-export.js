import {database} from '../../_lib/db.js';
import {handleError} from '../../_lib/http.js';
import {inquiriesToCsv} from '../../_lib/inquiry-csv.js';
import {authorizedTenant} from '../../_lib/vendor-auth.js';

export async function onRequestGet({request,env}){
  try{
    const {row}=await authorizedTenant(request,env),result=await database(env).prepare('SELECT * FROM vendor_inquiries WHERE tenant_id=?1 ORDER BY received_at DESC').bind(row.id).all(),records=result.results||[],csv=inquiriesToCsv(records),date=new Date().toISOString().slice(0,10);
    return new Response(csv,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="smoke-window-inquiries-${date}.csv"`,'cache-control':'no-store','x-content-type-options':'nosniff','x-record-count':String(records.length)}});
  }catch(error){return handleError(error)}
}
