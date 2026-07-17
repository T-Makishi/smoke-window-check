import {yen} from './utils.js';
export function feeExplanation(settings){const i=settings.inspection,tax=i.taxType==='included'?'税込':'税別';return `正式なお見積りを作成するために現地確認が必要な場合は、現地調査費として${yen(i.fee)}（${tax}）が発生します。現地調査後、当社へ修理または交換工事を正式にご依頼いただいた場合は、工事代金から現地調査費${yen(i.deduction)}を差し引きます。現地調査のみで終了した場合は、現地調査費${yen(i.fee)}を申し受けます。`;}
