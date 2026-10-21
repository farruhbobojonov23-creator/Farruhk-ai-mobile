import {validateHaccp,journalTypes} from './haccp-model.js';
import {monthDays,measurementDate} from './temperature-journal.js';
import {moscowCheckpoint} from './haccp-schedule.js';

// Generated rows are a printable PLAN, never a saved record or evidence of work.
// Existing confirmed observations are always drawn from device state as-is.
const formatDay=(month,day)=>month+'-'+String(day).padStart(2,'0');
export function automaticJournalRows(raw,{month,kind,pointId='',now=new Date()}={}){
 const h=validateHaccp(raw);
 const days=monthDays(month);
 if(!journalTypes[kind])throw Error('Выбери журнал ХАССП.');
 if(pointId&&!h.points.some(p=>p.id===pointId))throw Error('Точка не найдена.');
 const clock=moscowCheckpoint(now);
 const current=h.points.filter(p=>!pointId||p.id===pointId);
 const actual=h.records.filter(r=>r.kind===kind&&(!pointId||r.pointId===pointId)
  &&measurementDate(r.at).slice(0,7)===month).sort((a,b)=>a.at.localeCompare(b.at));
 const result=actual.map(record=>({type:'confirmed',record,kind,pointId:record.pointId}));
 const pending=h.autoDrafts.filter(d=>d.kind===kind&&kind!=='hygiene'&&(!pointId||d.pointId===pointId)&&d.day.slice(0,7)===month);
 for(const draft of pending)result.push({type:'draft',kind,pointId:draft.pointId,day:draft.day,record:draft,form:draft.form});
 const due=(day)=>day<clock.day||(day===clock.day&&clock.due);
 // No synthetic delivery, inspection, defrosting, or hygiene outcomes.
 if(!['receiving','defrosting','hygiene'].includes(kind)&&h.dailyControls.includes(kind)){
  for(const point of current){
   const equipment=(kind==='temperature'?h.equipment.filter(e=>e.pointId===point.id):[null]);
   const subjects=equipment.length?equipment:[null];
   for(let n=1;n<=days;n++){
    const day=formatDay(month,n);
    for(const item of subjects){
     const exists=actual.some(r=>r.pointId===point.id&&measurementDate(r.at)===day
      &&(kind!=='temperature'||r.details.equipmentId===item?.id)
      &&(kind!=='cleaning'||r.details.cleaningType!=='general')
      &&(kind!=='quality'||r.details.qualityType==='daily'));
     if(exists||pending.some(d=>d.pointId===point.id&&d.day===day&&
      (kind!=='temperature'||d.form.equipmentId===item?.id)&&
      (kind!=='cleaning'||d.form.cleaningType!=='general')&&
      (kind!=='quality'||d.form.qualityType==='daily')))continue;
     result.push({type:'planned',kind,pointId:point.id,day,
      due:due(day),equipment:item,cleaningType:kind==='cleaning'?'daily':undefined});
    }
   }
  }
 }
 if(kind==='cleaning'&&h.generalCleaningTarget>0){
  for(const point of current){
   const scheduled=(h.cleaningPlans?.[point.id]?.generalDays||[1,15]).slice(0,h.generalCleaningTarget);
   const dates=new Set(actual.filter(r=>r.pointId===point.id&&
    r.details.cleaningType==='general').map(r=>measurementDate(r.at)));
   for(const number of scheduled){
    if(!Number.isInteger(number)||number<1||number>days)continue;
    const day=formatDay(month,number);
    if(dates.has(day)||pending.some(d=>d.pointId===point.id&&d.day===day&&d.form.cleaningType==='general'))continue;
    result.push({type:'planned-general',kind,pointId:point.id,day,due:due(day),
     cleaningType:'general',equipment:null});
   }
  }
 }
 return result.sort((a,b)=>{
  const x=a.type==='confirmed'?measurementDate(a.record.at):a.day||month+'-99';
  const y=b.type==='confirmed'?measurementDate(b.record.at):b.day||month+'-99';
  return x.localeCompare(y)||a.pointId.localeCompare(b.pointId);
 });
}
// A planned/auto-generated row is only a PRINTABLE BLANK for a scheduled
// inspection. All actual measurements, reviews and outcomes stay off the
// official document until a real saved record exists.
export function plannedCell(row,key,points=[]){
 if(row.type==='confirmed')throw Error('Use factual record cells for saved rows.');
 if(key==='at')return row.day?row.day.slice(8,10)+'.'+row.day.slice(5,7)+'.'+row.day.slice(0,4):'';
 if(key==='point')return points.find(p=>p.id===row.pointId)?.name||'';
 if(key==='equipment')return row.equipment?.name||'';
 if(key==='temperatureLimits'){
  const e=row.equipment;
  if(!e||e.min==null&&e.max==null)return '';
  return e.min==null?'до '+e.max:e.max==null?'от '+e.min:e.min+' … '+e.max;
 }
 if(key==='cleaningType')return row.type==='planned-general'?'Генеральная':'Текущая';
 if(key==='qualityType')return row.kind==='quality'?'Ежедневная':'';
 // No printed technical labels such as 'черновик', 'не подтверждено',
 // 'запланировано', and no auto-filled factual outcomes or signatures.
 return '';
}
export function automaticJournalSummary(haccp,{month,pointId='',now=new Date()}={}){
 const kinds=Object.keys(journalTypes);
 const sections=kinds.map(kind=>({kind,rows:automaticJournalRows(haccp,{kind,month,pointId,now})}));
 return {sections,kinds:kinds.length,confirmed:sections.reduce((sum,x)=>sum+x.rows.filter(r=>r.type==='confirmed').length,0),
  planned:sections.reduce((sum,x)=>sum+x.rows.filter(r=>r.type!=='confirmed').length,0)};
}
