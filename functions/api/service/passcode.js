import {requireServiceAdmin} from '../../_lib/auth.js';
import {handleError,HttpError,json,readJson} from '../../_lib/http.js';
import {changeRegisteredPasscode,destroyPasscodeSession,passcodeStatus,registerPasscode,resetRegisteredPasscode,verifyRegisteredPasscode,SERVICE_PASSCODE_COOKIE,servicePasscodeSubject} from '../../_lib/passcode.js';

async function scope(request,env){const email=await requireServiceAdmin(request,env);return {email,subject:servicePasscodeSubject()}}

export async function onRequestGet({request,env}){
  try{const context=await scope(request,env);return json({ok:true,user:{email:context.email},passcode:await passcodeStatus(env,{...context,request,cookieName:SERVICE_PASSCODE_COOKIE})})}
  catch(error){return handleError(error)}
}

export async function onRequestPost({request,env}){
  try{
    const context=await scope(request,env),body=await readJson(request,4096),options={...context,request,cookieName:SERVICE_PASSCODE_COOKIE};
    let cookie;
    if(body.action==='register')cookie=await registerPasscode(env,{...options,passcode:body.passcode});
    else if(body.action==='verify')cookie=await verifyRegisteredPasscode(env,{...options,passcode:body.passcode});
    else if(body.action==='reset')cookie=await resetRegisteredPasscode(env,{...options,passcode:body.passcode});
    else if(body.action==='change')cookie=await changeRegisteredPasscode(env,{...options,currentPasscode:body.currentPasscode,newPasscode:body.newPasscode});
    else throw new HttpError(400,'invalid_action','パスコード操作が正しくありません。');
    return json({ok:true,passcode:{configured:true,verified:true}},{headers:{'set-cookie':cookie}});
  }catch(error){return handleError(error)}
}

export async function onRequestDelete({request,env}){
  try{await scope(request,env);return json({ok:true},{headers:{'set-cookie':await destroyPasscodeSession(request,env,{cookieName:SERVICE_PASSCODE_COOKIE})}})}
  catch(error){return handleError(error)}
}
