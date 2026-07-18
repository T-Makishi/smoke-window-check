import {HttpError} from './http.js';

export function database(env){
  if(!env.APP_DB)throw new HttpError(503,'database_unavailable','利用情報を確認できません。');
  return env.APP_DB;
}

export async function findTenant(env,id){
  return database(env).prepare('SELECT * FROM tenants WHERE id = ?1').bind(id).first();
}

export function parseTenantSettings(row){
  try{return JSON.parse(row.settings_json)}catch{throw new HttpError(500,'invalid_stored_settings','登録設定を読み取れません。')}
}

export function publicTenant(row,state,settings=null){
  return {
    id:row.id,
    companyName:row.company_name,
    trialDays:row.trial_days,
    startsAt:row.starts_at,
    expiresAt:row.expires_at,
    status:row.status,
    state,
    ...(settings?{settings}:{}),
  };
}
