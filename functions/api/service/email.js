import {ensureServiceSettings,normalizeEmail,requireServiceAdmin} from '../../_lib/auth.js';
import {database} from '../../_lib/db.js';
import {sendServiceEmailChangeCode,sendServiceEmailChangedNotice} from '../../_lib/email.js';
import {handleError,HttpError,json,readJson} from '../../_lib/http.js';
import {confirmRegisteredPasscode,destroyPasscodeSession,requirePasscodeSession,SERVICE_PASSCODE_COOKIE,servicePasscodeSubject} from '../../_lib/passcode.js';
import {sha256} from '../../_lib/onboarding.js';

async function authorized(request,env){const email=await requireServiceAdmin(request,env),subject=servicePasscodeSubject();await requirePasscodeSession(request,env,{subject,email,cookieName:SERVICE_PASSCODE_COOKIE});return {email,subject}}

export async function onRequestGet({request,env}){try{const context=await authorized(request,env);return json({ok:true,email:context.email})}catch(error){return handleError(error)}}

export async function onRequestPost({request,env}){
  try{
    const context=await authorized(request,env),body=await readJson(request,4096),action=String(body.action||''),db=database(env);await ensureServiceSettings(env);
    if(action==='request'){
      const newEmail=normalizeEmail(body.newEmail);if(newEmail===context.email)throw new HttpError(409,'same_email','現在と異なるメールアドレスを入力してください。');
      await confirmRegisteredPasscode(env,{subject:context.subject,email:context.email,passcode:body.currentPasscode});
      const requestId=randomId('sec_'),code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1_000_000).padStart(6,'0'),codeHash=await sha256(`${requestId}:${code}`),now=new Date(),expiresAt=new Date(now.getTime()+10*60_000).toISOString();
      await db.prepare("UPDATE service_email_changes SET status='cancelled' WHERE current_email=?1 AND status='pending'").bind(context.email).run();
      await db.prepare("INSERT INTO service_email_changes (id,current_email,new_email,code_hash,expires_at,status,created_at) VALUES (?1,?2,?3,?4,?5,'pending',?6)").bind(requestId,context.email,newEmail,codeHash,expiresAt,now.toISOString()).run();
      await sendServiceEmailChangeCode(env,{requestId,currentEmail:context.email,newEmail,code});
      return json({ok:true,requestId,newEmail,message:'新しいメールアドレスへ6桁の確認コードを送信しました。'});
    }
    if(action==='confirm'){
      const requestId=String(body.requestId||''),code=String(body.code||'').trim();if(!/^sec_[A-Za-z0-9_-]{12,32}$/.test(requestId)||!/^\d{6}$/.test(code))throw new HttpError(400,'invalid_code','6桁の確認コードを入力してください。');
      const row=await db.prepare("SELECT * FROM service_email_changes WHERE id=?1 AND current_email=?2 AND status='pending'").bind(requestId,context.email).first();if(!row)throw new HttpError(404,'change_not_found','メール変更の申請が見つかりません。最初からやり直してください。');
      if(Date.parse(row.expires_at)<Date.now()){await db.prepare("UPDATE service_email_changes SET status='expired' WHERE id=?1").bind(requestId).run();throw new HttpError(410,'code_expired','確認コードの有効期限が切れました。最初からやり直してください。')}
      if(await sha256(`${requestId}:${code}`)!==row.code_hash)throw new HttpError(401,'invalid_code','確認コードが違います。');
      const now=new Date().toISOString();
      await db.batch([
        db.prepare('DELETE FROM auth_sessions WHERE subject=?1').bind(context.subject),
        db.prepare('DELETE FROM auth_credentials WHERE subject=?1 AND email=?2').bind(context.subject,row.new_email),
        db.prepare('UPDATE auth_credentials SET email=?1,updated_at=?2 WHERE subject=?3 AND email=?4').bind(row.new_email,now,context.subject,context.email),
        db.prepare("INSERT INTO service_settings (key,value,updated_at,updated_by) VALUES ('service_admin_email',?1,?2,?3) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(row.new_email,now,context.email),
        db.prepare("UPDATE service_email_changes SET status='confirmed',confirmed_at=?1 WHERE id=?2").bind(now,requestId),
      ]);
      await sendServiceEmailChangedNotice(env,{currentEmail:context.email,newEmail:row.new_email});
      return json({ok:true,email:row.new_email,message:'運営者のログインIDと申込通知先を変更しました。'},{headers:{'set-cookie':await destroyPasscodeSession(request,env,{cookieName:SERVICE_PASSCODE_COOKIE})}});
    }
    throw new HttpError(400,'invalid_action','メール変更の操作が正しくありません。');
  }catch(error){return handleError(error)}
}

function randomId(prefix){const bytes=crypto.getRandomValues(new Uint8Array(12));return `${prefix}${btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')}`}
