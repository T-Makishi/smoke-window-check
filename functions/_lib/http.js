export const JSON_HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
};

export function json(data,{status=200,headers={}}={}){
  return new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...headers}});
}

export function error(status,code,message){
  return json({ok:false,error:{code,message}},{status});
}

export async function readJson(request,maxBytes=65536){
  const contentType=request.headers.get('content-type')||'';
  if(!contentType.toLowerCase().includes('application/json'))throw new HttpError(415,'unsupported_media_type','JSON形式で送信してください。');
  const contentLength=Number(request.headers.get('content-length')||0);
  if(contentLength>maxBytes)throw new HttpError(413,'payload_too_large','送信内容が大きすぎます。');
  const text=await request.text();
  if(new TextEncoder().encode(text).byteLength>maxBytes)throw new HttpError(413,'payload_too_large','送信内容が大きすぎます。');
  try{return JSON.parse(text)}catch{throw new HttpError(400,'invalid_json','送信内容を読み取れません。')}
}

export class HttpError extends Error{
  constructor(status,code,message){super(message);this.status=status;this.code=code}
}

export function handleError(value){
  if(value instanceof HttpError)return error(value.status,value.code,value.message);
  console.error(value);
  return error(500,'internal_error','処理中に問題が発生しました。時間をおいて再度お試しください。');
}
