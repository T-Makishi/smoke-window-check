import {database} from '../../_lib/db.js';
import {handleError,HttpError,json,readJson} from '../../_lib/http.js';
import {inquiryDeleteInput,inquirySummary,inquiryUpdate} from '../../_lib/inquiries.js';
import {authorizedTenant} from '../../_lib/vendor-auth.js';

export async function onRequestGet({request,env}){
  try{
    const {row}=await authorizedTenant(request,env),url=new URL(request.url),query=String(url.searchParams.get('q')||'').trim().slice(0,100),status=String(url.searchParams.get('status')||'').trim(),id=String(url.searchParams.get('id')||'').trim(),db=database(env);
    if(id){const item=await db.prepare('SELECT * FROM vendor_inquiries WHERE id=?1 AND tenant_id=?2').bind(id,row.id).first();if(!item)throw new HttpError(404,'not_found','問い合わせが見つかりません。');return json({ok:true,inquiry:inquirySummary(item,{includePayload:true})})}
    const clauses=['tenant_id=?1'],bindings=[row.id];
    if(status){clauses.push(`status=?${bindings.length+1}`);bindings.push(status)}
    if(query){clauses.push(`(case_number LIKE ?${bindings.length+1} OR customer_name LIKE ?${bindings.length+1} OR customer_phone LIKE ?${bindings.length+1} OR site_address LIKE ?${bindings.length+1} OR site_name LIKE ?${bindings.length+1})`);bindings.push(`%${query}%`)}
    const statement=db.prepare(`SELECT * FROM vendor_inquiries WHERE ${clauses.join(' AND ')} ORDER BY received_at DESC LIMIT 200`).bind(...bindings),result=await statement.all();
    return json({ok:true,inquiries:(result.results||[]).map(item=>inquirySummary(item))});
  }catch(error){return handleError(error)}
}

export async function onRequestPatch({request,env}){
  try{const {row}=await authorizedTenant(request,env),input=inquiryUpdate(await readJson(request)),now=new Date().toISOString(),db=database(env);const result=await db.prepare('UPDATE vendor_inquiries SET status=?1,assignee=?2,internal_memo=?3,updated_at=?4 WHERE id=?5 AND tenant_id=?6').bind(input.status,input.assignee,input.internalMemo,now,input.id,row.id).run();if(!result.meta?.changes)throw new HttpError(404,'not_found','問い合わせが見つかりません。');const saved=await db.prepare('SELECT * FROM vendor_inquiries WHERE id=?1 AND tenant_id=?2').bind(input.id,row.id).first();return json({ok:true,inquiry:inquirySummary(saved,{includePayload:true})})}catch(error){return handleError(error)}
}

export async function onRequestDelete({request,env}){
  try{const {row}=await authorizedTenant(request,env),id=inquiryDeleteInput(await readJson(request)),result=await database(env).prepare('DELETE FROM vendor_inquiries WHERE id=?1 AND tenant_id=?2').bind(id,row.id).run();if(!result.meta?.changes)throw new HttpError(404,'not_found','問い合わせが見つかりません。');return json({ok:true,deletedId:id})}catch(error){return handleError(error)}
}
