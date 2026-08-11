import {authenticatedEmail,emailsMatch,tenantIdFrom} from '../../_lib/auth.js';
import {findTenant} from '../../_lib/db.js';
import {handleError} from '../../_lib/http.js';
import {licenseState} from '../../_lib/trial.js';

export async function onRequestGet({request,env}){
  try{
    const email=authenticatedEmail(request),url=new URL(request.url),id=tenantIdFrom(url.searchParams.get('tenant'));
    const row=await findTenant(env,id),state=licenseState(row);
    if(!row||!emailsMatch(row.vendor_email,email))return message('登録メールと現在ログイン中のメールが一致しません。',403,true);
    if(state!=='active')return message(state==='expired'?'試験利用期間が終了しています。運営者へ延長をご依頼ください。':'このアプリは現在停止されています。運営者へお問い合わせください。',403);
    const target=new URL('/',url.origin);
    target.searchParams.set('t',id);
    target.searchParams.set('admin','1');
    if(url.searchParams.get('resetPasscode')==='1')target.searchParams.set('resetPasscode','1');
    return Response.redirect(target.toString(),302);
  }catch(error){return handleError(error)}
}

function message(text,status,showRelogin=false){
  const escaped=String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const relogin=showRelogin?'<p><a class="button" href="/cdn-cgi/access/logout">現在のログインを解除する</a></p><p class="hint">ログアウト後、発行メールに記載された「業者設定URL」をもう一度開き、登録メールで認証してください。</p>':'';
  return new Response(`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>業者ログイン</title><style>body{font-family:system-ui,sans-serif;background:#f5f7f6;color:#18312a;margin:0;padding:32px}.card{max-width:560px;margin:10vh auto;background:#fff;padding:32px;border-radius:18px;box-shadow:0 8px 30px #0001}a{color:#17623d}.button{display:inline-block;padding:14px 20px;border-radius:10px;background:#17623d;color:#fff;text-decoration:none;font-weight:700}.hint{color:#65736c;font-size:.92rem;line-height:1.7}</style><div class="card"><h1>業者設定を開けません</h1><p>${escaped}</p>${relogin}<p><a href="/">トップ画面へ戻る</a></p></div></html>`,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
