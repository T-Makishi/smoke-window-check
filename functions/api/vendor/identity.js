import {tenantIdFrom} from '../../_lib/auth.js';
import {findTenant,publicTenant} from '../../_lib/db.js';
import {handleError,HttpError,json,readJson} from '../../_lib/http.js';
import {destroyVendorIdentitySession,requestVendorLoginLink,requireVendorIdentity} from '../../_lib/vendor-identity.js';

export async function onRequestGet({request,env}){
  try{
    const url=new URL(request.url),id=tenantIdFrom(url.searchParams.get('tenant')),row=await findTenant(env,id);
    try{const context=await requireVendorIdentity(request,env,id);return json({ok:true,authenticated:true,user:{email:context.email},tenant:publicTenant(context.row,'active')})}
    catch(error){if(error?.code!=='identity_required')throw error;return json({ok:true,authenticated:false,tenant:row?publicTenant(row,'active'):null})}
  }catch(error){return handleError(error)}
}

export async function onRequestPost({request,env}){
  try{
    assertSameOrigin(request);
    const url=new URL(request.url),body=await readJson(request,4096);
    const result=await requestVendorLoginLink(request,env,{tenantId:tenantIdFrom(url.searchParams.get('tenant')),email:body.email,purpose:body.purpose==='reset'?'reset':'login'});
    return json({ok:true,...result,message:'登録メールアドレスへ確認リンクを送信しました。15分以内にメールを開いてください。'});
  }catch(error){return handleError(error)}
}

export async function onRequestDelete({request,env}){
  try{assertSameOrigin(request);return json({ok:true},{headers:{'set-cookie':await destroyVendorIdentitySession(request,env)}})}
  catch(error){return handleError(error)}
}

function assertSameOrigin(request){
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)throw new HttpError(403,'invalid_origin','不正な送信元です。');
}
