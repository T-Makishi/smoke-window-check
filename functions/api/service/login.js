import {requireServiceAdmin} from '../../_lib/auth.js';
import {handleError} from '../../_lib/http.js';

export async function onRequestGet({request,env}){
  try{
    await requireServiceAdmin(request,env);
    const requestUrl=new URL(request.url),target=new URL('/service.html',requestUrl.origin);
    if(requestUrl.searchParams.get('resetPasscode')==='1')target.searchParams.set('resetPasscode','1');
    return Response.redirect(target.toString(),302);
  }catch(error){return handleError(error)}
}
