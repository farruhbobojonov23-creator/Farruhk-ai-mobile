import {journalTypes,validateHaccp} from './haccp-model.js';
import {measurementDate} from './temperature-journal.js';

// These are due CHECKS, never synthetic control results. The owner chooses
// applicability using the documented HACCP programme for each facility.
export function moscowCheckpoint(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
 }).formatToParts(new Date(now)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return {day:parts.year+'-'+parts.month+'-'+parts.day,month:parts.year+'-'+parts.month,
  clock:parts.hour+':'+parts.minute,due:Number(parts.hour)>=11};
}
export function dueRecords(raw,{day,pointId='',kinds}={}){
 const h=validateHaccp(raw),active=kinds||h.dailyControls;
 if(!Array.isArray(active)||active.some(k=>!journalTypes[k]))throw Error('Неверный план ХАССП.');
 const checks=h.points.filter(p=>!pointId||p.id===pointId)
  .flatMap(point=>active.map(kind=>{
   const records=h.records.filter(r=>r.pointId===point.id&&r.kind===kind&&measurementDate(r.at).slice(0,10)===day&&!(kind==='cleaning'&&r.details.cleaningType==='general'));
   return {pointId:point.id,point:point.name,kind,name:journalTypes[kind],records:records.length,
    deviations:records.filter(r=>r.status==='deviation').length,
    complete:records.length>0};
  }));
 return {checks,confirmed:checks.filter(x=>x.complete).length,waiting:checks.filter(x=>!x.complete).length,total:checks.length};
}
export function deepCleaningProgress(raw,{month,pointId=''}={}){
 const h=validateHaccp(raw);
 const points=h.points.filter(p=>!pointId||p.id===pointId);
 const rows=points.map(point=>{
  // Two confirmed GENErAL cleans on separate dates. Multiple zones recorded on
  // the same day do not falsely count as separate monthly sessions.
  const days=new Set(h.records.filter(r=>r.kind==='cleaning'&&r.pointId===point.id&&
   r.status==='ok'&&r.details.cleaningType==='general'&&measurementDate(r.at).slice(0,7)===month)
   .map(r=>measurementDate(r.at).slice(0,10)));
  return {pointId:point.id,point:point.name,done:days.size,target:h.generalCleaningTarget,
   remaining:Math.max(0,h.generalCleaningTarget-days.size)};
 });
 return {rows,done:rows.reduce((n,x)=>n+Math.min(x.done,x.target),0),
  target:rows.reduce((n,x)=>n+x.target,0),remaining:rows.reduce((n,x)=>n+x.remaining,0)};
}
