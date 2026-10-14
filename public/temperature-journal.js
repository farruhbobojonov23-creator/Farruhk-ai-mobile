import {validateHaccp,addJournalRecord} from './haccp-model.js';

const moscowDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'});
const moscowTime=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function measurementDate(value=new Date()){return moscowDate.format(new Date(value))}
export function measurementTime(value=new Date()){return moscowTime.format(new Date(value))}
export function monthDays(month){
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw Error('Выбери месяц журнала.');
 const [year,m]=month.split('-').map(Number);return new Date(Date.UTC(year,m,0)).getUTCDate();
}
export function journalDays(month,period='all'){
 const count=monthDays(month);if(!['all','first','second'].includes(period))throw Error('Выбери период журнала.');
 const start=period==='second'?16:1,end=period==='first'?15:count;
 return Array.from({length:end-start+1},(_,i)=>start+i);
}
export function monthLabel(month){monthDays(month);return new Date(month+'-01T12:00:00+03:00').toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow',month:'long',year:'numeric'})}
export function temperatureGrid(raw,{month,period='all',pointId=''}={}){
 const h=validateHaccp(raw),days=journalDays(month,period),allowed=new Set(days);
 if(pointId&&!h.points.some(p=>p.id===pointId))throw Error('Точка не найдена.');
 const readings=h.records.filter(r=>r.kind==='temperature'&&(!pointId||r.pointId===pointId)&&measurementDate(r.at).slice(0,7)===month&&allowed.has(Number(measurementDate(r.at).slice(-2)))).sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
 for(const r of readings)if(typeof r.details.equipmentId!=='string'||typeof r.details.equipment!=='string'||!Number.isFinite(r.details.measured))throw Error('Повреждён замер температуры.');
 // Include historical equipment even if a future version archives its settings.
 const equipment=h.equipment.filter(e=>!pointId||e.pointId===pointId).map(e=>({...e}));
 for(const r of readings)if(!equipment.some(e=>e.id===r.details.equipmentId))equipment.push({id:r.details.equipmentId,pointId:r.pointId,name:r.details.equipment,min:r.details.min,max:r.details.max});
 const byCell=new Map();
 for(const r of readings){const key=r.details.equipmentId+'|'+Number(measurementDate(r.at).slice(-2));if(!byCell.has(key))byCell.set(key,[]);byCell.get(key).push(r)}
 const rows=equipment.map(e=>({...e,point:h.points.find(p=>p.id===e.pointId)?.name||e.pointId,cells:days.map(day=>({day,records:byCell.get(e.id+'|'+day)||[]}))}));
 return {month,period,pointId,days,rows,readings,points:h.points};
}
export function temperatureLimits(e){return e.min===null&&e.max===null?'Границы не заданы':(e.min===null?'до '+e.max:e.max===null?'от '+e.min:e.min+' … '+e.max)+' °C'}
export function saveDailyTemperatures(state,{date,time='09:00',owner,entries},now=new Date()){
 if(!/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00+03:00'))||measurementDate(date+'T12:00:00+03:00')!==date)throw Error('Укажи корректную дату замеров.');
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Укажи корректное время замеров.');
 if(!Array.isArray(entries)||!entries.length)throw Error('Введи хотя бы один замер.');
 const filled=entries.filter(e=>e&&e.measured!==null&&e.measured!==undefined&&String(e.measured).trim()!=='');
 if(!filled.length)throw Error('Введи хотя бы один замер.');
 if(new Set(filled.map(e=>e.equipmentId)).size!==filled.length)throw Error('Повтор оборудования в замерах.');
 const next={haccp:validateHaccp(state.haccp)},at=date+'T'+time+':00+03:00',saved=[];
 for(const entry of filled){
  const equipment=next.haccp.equipment.find(e=>e.id===entry.equipmentId);if(!equipment)throw Error('Оборудование не найдено.');
  // Repeated observations must retain their real times rather than overwrite a daily cell.
  if(next.haccp.records.some(r=>r.kind==='temperature'&&r.details.equipmentId===equipment.id&&Date.parse(r.at)===Date.parse(at)))throw Error('Замер для «'+equipment.name+'» на это время уже сохранён. Выбери время повторного замера.');
  saved.push(addJournalRecord(next,{kind:'temperature',pointId:equipment.pointId,equipmentId:equipment.id,at,owner,measured:String(entry.measured).replace(',','.'),notes:entry.notes||''},crypto.randomUUID(),now));
 }
 state.haccp=next.haccp;return saved;
}
