const ALLOWED_DAYS=new Set([7,14,30]);
const JST_OFFSET_MS=9*60*60*1000;
const DAY_MS=24*60*60*1000;

export function normalizeTrialDays(value){
  const days=Number(value);
  if(!ALLOWED_DAYS.has(days))throw new Error('試験期間は7日、14日、30日から選択してください。');
  return days;
}

export function trialWindow(daysValue,nowValue=new Date()){
  const days=normalizeTrialDays(daysValue),now=new Date(nowValue);
  if(Number.isNaN(now.getTime()))throw new Error('開始日時が正しくありません。');
  const jstNow=new Date(now.getTime()+JST_OFFSET_MS);
  const startOfJstDayUtc=Date.UTC(jstNow.getUTCFullYear(),jstNow.getUTCMonth(),jstNow.getUTCDate())-JST_OFFSET_MS;
  const expiresAt=new Date(startOfJstDayUtc+days*DAY_MS-1);
  return {startsAt:now.toISOString(),expiresAt:expiresAt.toISOString()};
}

export function licenseState(row,nowValue=new Date()){
  if(!row)return 'not_found';
  if(row.status!=='active')return 'suspended';
  const expiresAt=new Date(row.expires_at),now=new Date(nowValue);
  if(Number.isNaN(expiresAt.getTime()))return 'invalid';
  return now.getTime()<=expiresAt.getTime()?'active':'expired';
}
