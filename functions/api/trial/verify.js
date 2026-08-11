import {database} from '../../_lib/db.js';
import {handleError,HttpError,json,readJson} from '../../_lib/http.js';
import {sha256} from '../../_lib/onboarding.js';
import {issueTrialApplication} from '../../_lib/trial-issuance.js';

export async function onRequestPost({request,env}){
  try{
    const body=await readJson(request),token=String(body.token||'');
    if(!/^[A-Za-z0-9_-]{40,60}$/.test(token))throw new HttpError(400,'invalid_token','確認リンクが正しくありません。');
    const tokenHash=await sha256(token),db=database(env),application=await db.prepare('SELECT * FROM trial_applications WHERE token_hash=?1').bind(tokenHash).first(),now=new Date();
    if(!application)throw new HttpError(404,'verification_not_found','確認リンクが無効です。申込画面から確認メールを再送してください。');
    if(application.status==='issued'&&application.tenant_id)return json({ok:true,alreadyVerified:true,...await issueTrialApplication(request,env,application)});
    if(application.status!=='pending')throw new HttpError(410,'verification_unavailable','この申込は現在利用できません。');
    if(Date.parse(application.token_expires_at)<now.getTime())throw new HttpError(410,'verification_expired','確認リンクの有効期限が切れています。申込画面からもう一度お申し込みください。');
    const result=await issueTrialApplication(request,env,application);return json({ok:true,...result});
  }catch(error){return handleError(error)}
}
