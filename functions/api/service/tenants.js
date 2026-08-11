import {requireServiceAdmin,normalizeEmail,tenantIdFrom} from '../../_lib/auth.js';
import {database,findTenant,parseTenantSettings,publicTenant} from '../../_lib/db.js';
import {handleError,HttpError,json,readJson} from '../../_lib/http.js';
import {licenseState,normalizeTrialDays,productionWindow,trialWindow} from '../../_lib/trial.js';
import {settingsJson} from '../../_lib/settings.js';
import {DEFAULT_SETTINGS} from '../../../js/estimate-config.js';
import {requirePasscodeSession,SERVICE_PASSCODE_COOKIE,servicePasscodeSubject,vendorPasscodeSubject} from '../../_lib/passcode.js';

async function authorizedService(request,env){
  const email=await requireServiceAdmin(request,env);
  await requirePasscodeSession(request,env,{subject:servicePasscodeSubject(),email,cookieName:SERVICE_PASSCODE_COOKIE});
  return email;
}

export async function onRequestGet({request,env}){
  try{
    const email=await authorizedService(request,env);
    const result=await database(env).prepare('SELECT * FROM tenants ORDER BY created_at DESC').all();
    const tenants=(result.results||[]).map(row=>({...publicTenant(row,licenseState(row)),vendorEmail:row.vendor_email,updatedAt:row.updated_at}));
    return json({ok:true,user:{email},tenants});
  }catch(error){return handleError(error)}
}

export async function onRequestPost({request,env}){
  try{
    await authorizedService(request,env);
    const body=await readJson(request),companyName=String(body.companyName||'').trim().slice(0,200),vendorEmail=normalizeEmail(body.vendorEmail),licenseType=body.licenseType==='production'?'production':'trial',trialDays=licenseType==='production'?30:normalizeTrialDays(body.trialDays);
    if(!companyName)throw new HttpError(400,'invalid_company','会社名を入力してください。');
    const id=randomTenantId(),window=licenseType==='production'?productionWindow():trialWindow(trialDays),now=new Date().toISOString(),source=structuredClone(DEFAULT_SETTINGS);
    source.company.name=companyName;
    source.company.email=vendorEmail;
    const {json:serialized}=settingsJson(source);
    await database(env).prepare('INSERT INTO tenants (id, company_name, vendor_email, settings_json, license_type, trial_days, starts_at, expires_at, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)').bind(id,companyName,vendorEmail,serialized,licenseType,trialDays,window.startsAt,window.expiresAt,'active',now,now).run();
    const row=await findTenant(env,id);
    return json({ok:true,tenant:{...publicTenant(row,'active'),vendorEmail:row.vendor_email}},{status:201});
  }catch(error){return handleError(error)}
}

export async function onRequestPatch({request,env}){
  try{
    await authorizedService(request,env);
    const body=await readJson(request),id=tenantIdFrom(body.id),row=await findTenant(env,id);
    if(!row)throw new HttpError(404,'not_found','登録が見つかりません。');
    const companyName=body.companyName===undefined?row.company_name:String(body.companyName).trim().slice(0,200);
    const vendorEmail=body.vendorEmail===undefined?row.vendor_email:normalizeEmail(body.vendorEmail);
    const status=body.status===undefined?row.status:String(body.status);
    if(!companyName)throw new HttpError(400,'invalid_company','会社名を入力してください。');
    if(!['active','suspended'].includes(status))throw new HttpError(400,'invalid_status','利用状態が正しくありません。');
    let licenseType=row.license_type||'trial',trialDays=row.trial_days,startsAt=row.starts_at,expiresAt=row.expires_at;
    if(body.licenseType==='production'){licenseType='production';const window=productionWindow();startsAt=window.startsAt;expiresAt=window.expiresAt}
    else if(body.trialDays!==undefined){licenseType='trial';trialDays=normalizeTrialDays(body.trialDays);const window=trialWindow(trialDays);startsAt=window.startsAt;expiresAt=window.expiresAt}
    const settings=parseTenantSettings(row);
    settings.company.name=companyName;
    const {json:serialized}=settingsJson(settings),now=new Date().toISOString();
    await database(env).prepare('UPDATE tenants SET company_name=?1, vendor_email=?2, settings_json=?3, license_type=?4, trial_days=?5, starts_at=?6, expires_at=?7, status=?8, updated_at=?9 WHERE id=?10').bind(companyName,vendorEmail,serialized,licenseType,trialDays,startsAt,expiresAt,status,now,id).run();
    if(vendorEmail!==row.vendor_email){
      const subject=vendorPasscodeSubject(id);
      await database(env).prepare('DELETE FROM auth_sessions WHERE subject=?1').bind(subject).run();
      await database(env).prepare('DELETE FROM auth_credentials WHERE subject=?1').bind(subject).run();
    }
    const updated=await findTenant(env,id);
    return json({ok:true,tenant:{...publicTenant(updated,licenseState(updated)),vendorEmail:updated.vendor_email}});
  }catch(error){return handleError(error)}
}

function randomTenantId(){
  const bytes=crypto.getRandomValues(new Uint8Array(12));
  return `sw_${btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')}`;
}
