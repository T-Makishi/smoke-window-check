import {tenantIdFrom} from '../../_lib/auth.js';
import {handleError} from '../../_lib/http.js';

export async function onRequestGet({request,env}){
  try{
    const url=new URL(request.url),id=tenantIdFrom(url.searchParams.get('tenant'));
    const target=new URL('/',url.origin);
    target.searchParams.set('t',id);
    target.searchParams.set('admin','1');
    if(url.searchParams.get('resetPasscode')==='1')target.searchParams.set('resetPasscode','1');
    return Response.redirect(target.toString(),302);
  }catch(error){return handleError(error)}
}
