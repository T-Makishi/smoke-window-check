import {authenticatedEmail,tenantIdFrom} from '../../_lib/auth.js';
import {findTenant} from '../../_lib/db.js';
import {handleError} from '../../_lib/http.js';
import {licenseState} from '../../_lib/trial.js';

export async function onRequestGet({request,env}){
  try{
    const email=authenticatedEmail(request),url=new URL(request.url),id=tenantIdFrom(url.searchParams.get('tenant'));
    const row=await findTenant(env,id),state=licenseState(row);
    if(!row||String(row.vendor_email).toLowerCase()!==email)return message('この業者設定を利用できるメールアドレスではありません。',403);
    if(state!=='active')return message(state==='expired'?'試験利用期間が終了しています。運営者へ延長をご依頼ください。':'このアプリは現在停止されています。運営者へお問い合わせください。',403);
    const target=new URL('/',url.origin);
    target.searchParams.set('t',id);
    target.searchParams.set('admin','1');
    return Response.redirect(target.toString(),302);
  }catch(error){return handleError(error)}
}

function message(text,status){
  const escaped=String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  return new Response(`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>業者ログイン</title><style>body{font-family:system-ui,sans-serif;background:#f5f7f6;color:#18312a;margin:0;padding:32px}.card{max-width:560px;margin:10vh auto;background:#fff;padding:32px;border-radius:18px;box-shadow:0 8px 30px #0001}a{color:#17623d}</style><div class="card"><h1>業者設定を開けません</h1><p>${escaped}</p><p><a href="/">トップ画面へ戻る</a></p></div></html>`,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
