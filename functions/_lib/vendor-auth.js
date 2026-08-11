import {authenticatedEmail,emailsMatch,tenantIdFrom} from './auth.js';
import {findTenant} from './db.js';
import {HttpError} from './http.js';
import {requirePasscodeSession,VENDOR_PASSCODE_COOKIE,vendorPasscodeSubject} from './passcode.js';

export async function authorizedTenant(request,env){
  const email=authenticatedEmail(request),url=new URL(request.url),id=tenantIdFrom(url.searchParams.get('tenant')),row=await findTenant(env,id);
  if(!row||!emailsMatch(row.vendor_email,email))throw new HttpError(403,'forbidden','この業者設定を利用できません。');
  await requirePasscodeSession(request,env,{subject:vendorPasscodeSubject(id),email,cookieName:VENDOR_PASSCODE_COOKIE});
  return {email,row};
}
