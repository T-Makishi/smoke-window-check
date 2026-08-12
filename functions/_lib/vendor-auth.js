import {tenantIdFrom} from './auth.js';
import {requirePasscodeSession,VENDOR_PASSCODE_COOKIE,vendorPasscodeSubject} from './passcode.js';
import {requireVendorIdentity} from './vendor-identity.js';

export async function authorizedTenant(request,env){
  const url=new URL(request.url),id=tenantIdFrom(url.searchParams.get('tenant')),{email,row}=await requireVendorIdentity(request,env,id);
  await requirePasscodeSession(request,env,{subject:vendorPasscodeSubject(id),email,cookieName:VENDOR_PASSCODE_COOKIE});
  return {email,row};
}
