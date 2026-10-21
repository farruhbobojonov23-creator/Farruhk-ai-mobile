import {validateHaccp,journalTypes,addJournalRecord} from './haccp-model.js';
import {moscowCheckpoint} from './haccp-schedule.js';
import {measurementDate} from './temperature-journal.js';

// Owner-authored samples are never recorded as actual inspections.
// Auto-generated entries are drafts until the owner reviews and confirms them.
const validDate=value=>/^20\d{2}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z'));
const dateParts=value=>new Date(value+'T12:00:00Z');
const isoDay=date=>date.toISOString().slice(0,10);
const shiftDay=(value,days)=>{
 if(!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value))return value;
 const date=new Date(value.slice(0,16)+':00Z');
 if(!Number.isFinite(date.getTime()))return value;
 date.setUTCDate(date.getUTCDate()+days);
 return date.toISOString().slice(0,16);
};
const sanitize=(data)=>{
 const cleaned={};
 for(const [key,value] of Object.entries(data||{})){
  if(!/^[a-zA-Z][\w-]{0,39}$/.test(key)||['kind','photo','image','file','due'].includes(key))continue;
  if(typeof value!=='string')continue;
  cleaned[key]=value.slice(0,1200).trim();
 }
 return cleaned;
};
export function saveAutoTemplate(state,{kind,pointId,form,now=new Date()}){
 const h=validateHaccp(state.haccp);
 if(!journalTypes[kind]||!h.points.some(p=>p.id===pointId))throw Error('Выбери журнал и точку.');
 if(kind==='receiving')throw Error('Журнал приёмки ведётся только по факту поставки. Для подсказок используй справочник товаров и поставщиков.');
 if(kind==='defrosting')throw Error('Журнал размораживания ведётся только по факту процесса: без вымышленных завершений.');
 const fields=sanitize(form);
 // A sample may specify approved limits but must never become an invented measured temperature.
 if(kind==='temperature')delete fields.measured;
 if(kind==='quality'){
  if(fields.qualityType!=='daily')throw Error('Для бракеража доступны только ежедневные черновики. Новые партии проверяются по факту.');
  // Never copy a previous inspection, prepared batch or approval into tomorrow's draft.
  for(const key of ['product','quantity','batch','startedAt','checks','appearance','color','smell',
   'texture','taste','decision','decisionText','reviewer','owner','measured','result','recipeId','category'])
   delete fields[key];
 }
 if(kind==='cleaning'){
  // Templates have assigned roles but never reuse someone's previous approval,
  // actual agent, completed checklist or recorded outcome.
  delete fields.result;delete fields.checker;delete fields.owner;delete fields.agent;
 }
 if(kind==='storage'){
  // Labels and shelf-life dates are factual for each batch. A recurring
  // daily checklist can carry product/zone hints, never prior expiry or outcomes.
  for(const key of ['startedAt','useBy','batch','labelCheck','conditionsCheck','owner'])
   delete fields[key];
 }
 if(!Object.keys(fields).length)throw Error('Заполни хотя бы одно поле образца.');
 const day=moscowCheckpoint(now).day;
 const type=fields.cleaningType==='general'?'general':'daily';
 const candidate=kind+'|'+pointId+(kind==='temperature'?'|'+(fields.equipmentId||''):kind==='cleaning'?'|'+type:kind==='quality'?'|daily':'');
 // Reuse any older cleaning template for this branch to avoid duplicate daily rows.
 const existing=h.autoTemplates.find(t=>t.id===candidate)||
  (kind==='cleaning'&&type==='daily'?h.autoTemplates.find(t=>t.id==='cleaning|'+pointId):null);
 const id=existing?.id||candidate;
 const template={id,kind,pointId,form:fields,startDay:existing?.startDay||day,
  updatedAt:now.toISOString(),enabled:true};
 if(existing)Object.assign(existing,template);else h.autoTemplates.push(template);
 state.haccp=validateHaccp(h);
 return template;
}
export function dueAutoDrafts(raw,now=new Date()){
 const h=validateHaccp(raw),clock=moscowCheckpoint(now);
 if(!clock.due)return [];
 const drafts=[],known=new Set(h.autoDrafts.map(d=>d.id));
 for(const template of h.autoTemplates.filter(t=>t.enabled!==false&&!['receiving','defrosting'].includes(t.kind)&&
  (t.kind!=='quality'||t.form?.qualityType==='daily'))){
  if(!validDate(template.startDay))continue;
  const first=dateParts(template.startDay),last=dateParts(clock.day);
  const maxDay=Math.max(first.getTime(),last.getTime()-89*86400000);
  for(let time=maxDay;time<=last.getTime();time+=86400000){
   const day=isoDay(new Date(time)),id='auto|'+template.id+'|'+day;
   if(known.has(id))continue;
   const cleaningType=template.form.cleaningType==='general'?'general':'daily';
   if(template.kind==='cleaning'&&cleaningType==='general'){
    const scheduled=h.cleaningPlans?.[template.pointId]?.generalDays||[1,15];
    if(!scheduled.includes(Number(day.slice(8,10))))continue;
   }
   const already=h.records.some(r=>r.kind===template.kind&&r.pointId===template.pointId&&
    measurementDate(r.at)===day&&
    (template.kind!=='temperature'||r.details.equipmentId===template.form.equipmentId)&&
    (template.kind!=='cleaning'||(r.details.cleaningType||'daily')===cleaningType)&&
    (template.kind!=='quality'||r.details.qualityType==='daily'));
   if(already)continue;
   const offset=Math.round((time-first.getTime())/86400000),form={...template.form};
   form.at=day+'T11:00';
   form.pointId=template.pointId;
   if(template.kind==='temperature')delete form.measured;
   for(const key of ['startedAt','finishedAt','useBy']){
    if(form[key])form[key]=shiftDay(form[key],offset);
   }
   drafts.push({id,kind:template.kind,pointId:template.pointId,day,createdAt:now.toISOString(),
    templateId:template.id,form});
   known.add(id);
  }
 }
 return drafts;
}
export function generateAutoDrafts(state,now=new Date()){
 const fresh=dueAutoDrafts(state.haccp,now);
 if(!fresh.length)return 0;
 const h=validateHaccp(state.haccp);
 h.autoDrafts.push(...fresh);
 state.haccp=validateHaccp(h);
 return fresh.length;
}
export function updateAutoDraft(state,id,form){
 const h=validateHaccp(state.haccp),d=h.autoDrafts.find(x=>x.id===id);
 if(!d)throw Error('Черновик уже обработан.');
 const patch=sanitize(form);
 d.form={...d.form,...patch,pointId:d.pointId};
 d.updatedAt=new Date().toISOString();
 state.haccp=validateHaccp(h);return d;
}
export function confirmAutoDraft(state,id,form,now=new Date()){
 const h=validateHaccp(state.haccp),d=h.autoDrafts.find(x=>x.id===id);
 if(!d)throw Error('Черновик не найден или уже подтверждён.');
 const input={...sanitize(form),kind:d.kind,pointId:d.pointId};
 if(!input.at)input.at=d.form.at;
 const record=addJournalRecord(state,input,crypto.randomUUID(),now);
 state.haccp.autoDrafts=state.haccp.autoDrafts.filter(x=>x.id!==id);
 state.haccp=validateHaccp(state.haccp);
 return record;
}
