import {requireServiceAdmin} from '../../_lib/auth.js';
import {handleError} from '../../_lib/http.js';

export function onRequestGet({request,env}){
  try{
    requireServiceAdmin(request,env);
    return Response.redirect(new URL('/service.html',request.url).toString(),302);
  }catch(error){return handleError(error)}
}
