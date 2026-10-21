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
 const due=(day)=>day<clock.day||(day===clock.day&&clock.due);
 // No synthetic delivery, inspection, defrosting, or hygiene outcomes.
 if(h.dailyControls.includes(kind)){
  for(const point of current){
   const equipment=(kind==='temperature'?h.equipment.filter(e=>e.pointId===point.id):[null]);
   const subjects=equipment.length?equipment:[null];
   for(let n=1;n<=days;n++){
    const day=formatDay(month,n);
    for(const item of subjects){
     const exists=actual.some(r=>r.pointId===point.id&&measurementDate(r.at)===day
      &&(kind!=='temperature'||r.details.equipmentId===item?.id)
      &&(kind!=='cleaning'||r.details.cleaningType!=='general'));
     if(exists)continue;
     result.push({type:'planned',kind,pointId:point.id,day,
      due:due(day),equipment:item,cleaningType:kind==='cleaning'?'daily':undefined});
    }
   }
  }
 }
 if(kind==='cleaning'&&h.generalCleaningTarget>0){
  for(const point of current){
   const dates=new Set(actual.filter(r=>r.pointId===point.id&&r.status==='ok'
     &&r.details.cleaningType==='general').map(r=>measurementDate(r.at)));
   for(let i=dates.size;i<h.generalCleaningTarget;i++){
    result.push({type:'planned-general',kind,pointId:point.id,day:null,due:false,
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
export function plannedCell(row,key,points=[]){
 if(row.type==='confirmed')throw Error('Use factual record cells for confirmed rows.');
 const point=points.find(p=>p.id===row.pointId)?.name||'Точка не задана';
 const text=row.type==='planned-general'?'ПО ГРАФИКУ':row.due?'НЕ ПРОВЕРЕНО':'ЗАПЛАНИРОВАНО';
 if(key==='at')return row.day?row.day+' · 11:00 МСК':'Дата по графику';
 if(key==='point')return point;
 if(key==='equipment')return row.equipment?.name||'—';
 if(key==='temperatureLimits'){
  const e=row.equipment;
  return !e||e.min==null&&e.max==null?'Не заданы':
   e.min==null?'до '+e.max:e.max==null?'от '+e.min:e.min+' … '+e.max;
 }
 if(key==='cleaningType')return row.type==='planned-general'?'Генеральная':'Текущая';
 if(['status','result','checks','decision','decisionText'].includes(key))return text;
 if(key==='notes')return row.type==='planned-general'?'2 раза в месяц по утверждённому графику':
  row.due?'Подтверждения нет':'Проверка ещё не наступила';
 // Blank actual readings, decisions and people: never guess them.
 return '';
}
export function automaticJournalSummary(haccp,{month,pointId='',now=new Date()}={}){
 const kinds=Object.keys(journalTypes);
 const sections=kinds.map(kind=>({kind,rows:automaticJournalRows(haccp,{kind,month,pointId,now})}));
 return {sections,kinds:kinds.length,confirmed:sections.reduce((sum,x)=>sum+x.rows.filter(r=>r.type==='confirmed').length,0),
  planned:sections.reduce((sum,x)=>sum+x.rows.filter(r=>r.type!=='confirmed').length,0)};
}
