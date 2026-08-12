import {consumeVendorLoginToken} from '../../_lib/vendor-identity.js';

export async function onRequestGet({request,env}){
  try{
    const url=new URL(request.url),result=await consumeVendorLoginToken(env,url.searchParams.get('token')||''),target=new URL('/',url.origin);
    target.searchParams.set('t',result.tenant.id);target.searchParams.set('admin','1');
    if(result.purpose==='reset')target.searchParams.set('resetPasscode','1');
    return new Response(null,{status:302,headers:{location:target.toString(),'set-cookie':result.cookie,'cache-control':'no-store'}});
  }catch(error){return message(error?.message||'確認リンクを処理できませんでした。',error?.status||500)}
}

function message(text,status){
  const escaped=String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  return new Response(`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>メール確認</title><style>body{font-family:system-ui,sans-serif;background:#f5f7f6;color:#18312a;margin:0;padding:28px}.card{max-width:620px;margin:10vh auto;background:#fff;padding:32px;border-radius:18px;box-shadow:0 8px 30px #0001}a{display:inline-block;padding:14px 20px;border-radius:10px;background:#17623d;color:#fff;text-decoration:none;font-weight:700}</style><div class="card"><h1>メール確認を完了できませんでした</h1><p>${escaped}</p><p><a href="/">トップ画面へ戻る</a></p></div></html>`,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
