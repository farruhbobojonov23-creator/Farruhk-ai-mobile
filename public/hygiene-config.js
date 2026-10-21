// Hygienic observations are workplace process checks, NOT medical diagnoses.
// Names and positions are entered only as needed for an actual shift.
export const HYGIENE_CHECKS=Object.freeze([
 ['uniform','Чистота спецодежды'],
 ['hands','Чистота рук и ногтей'],
 ['headwear','Убранные волосы и головной убор'],
 ['personalItems','Отсутствие запрещённых украшений и личных предметов'],
 ['workplaceRules','Соблюдение прочих требований внутренней инструкции']
]);
export const HYGIENE_OUTCOMES=Object.freeze({
 ok:'Соответствует',problem:'Замечание',na:'Не применимо'
});
export const HYGIENE_DEFAULT=Object.freeze({
 reviewer:'Старший смены',
 roles:Object.freeze(['Сушист','Повар','Старший смены','Сотрудник кухни']),
 schedule:'before-shift'
});
const cleanNames=(list,label)=>{
 if(!Array.isArray(list)||list.length>100)throw Error('Проверь список: '+label);
 const values=list.map(v=>String(v??'').trim()).filter(Boolean);
 if(values.some(v=>v.length>120)||
   new Set(values.map(v=>v.toLocaleLowerCase('ru-RU'))).size!==values.length)
  throw Error('Проверь названия в списке: '+label);
 return values;
};

// Each line assigns a real person to a role and shift starting time.
// A prepared row is strictly an editor shortcut, NEVER a recorded inspection.
export function parseHygieneRoster(source){
 const lines=Array.isArray(source)?source:String(source||'').split(/\r?\n/);
 if(lines.length>100)throw Error('Слишком много строк в графике.');
 const roster=[],keys=new Set();
 for(const item of lines){
  const parts=typeof item==='string'?item.split('|'):null;
  const raw=parts?{
   name:parts[0],role:parts[1],startTime:parts[2],shift:parts[3]
  }:item;
  const name=String(raw?.name||'').trim();
  const role=String(raw?.role||'').trim();
  const startTime=String(raw?.startTime||'').trim();
  const shift=String(raw?.shift||'').trim();
  if(!name&&!role&&!startTime&&!shift)continue;
  if(!name||!role||!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime))
   throw Error('Для каждого сотрудника укажи ФИО | должность | время HH:MM | смену.');
  if([name,role,shift].some(x=>x.length>120))throw Error('Слишком длинная строка графика.');
  const key=name.toLocaleLowerCase('ru-RU')+'|'+startTime;
  if(keys.has(key))throw Error('Сотрудник с таким временем начала смены повторяется.');
  keys.add(key);roster.push({name,role,startTime,shift});
 }
 return roster;
}
export function preparedHygieneRows(haccp,pointId,day){
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(day)||Number.isNaN(Date.parse(day+'T12:00:00Z')))
  throw Error('Некорректный день осмотра.');
 const config=hygieneSettings(haccp,pointId);
 return config.roster.map(staff=>{
  const shiftStart=day+'T'+staff.startTime+':00+03:00';
  const shiftUtc=new Date(shiftStart).toISOString();
  const previous=(haccp?.records||[]).find(r=>
   r.kind==='hygiene'&&r.pointId===pointId&&
   String(r.details?.employee||'').toLocaleLowerCase('ru-RU')===staff.name.toLocaleLowerCase('ru-RU')&&
   r.details?.shiftStart===shiftUtc);
  return {...staff,pointId,day,shiftStart,complete:!!previous,
   recordedDecision:previous?.details?.decisionText||''};
 });
}
export function hygieneSettings(haccp,pointId){
 const saved=haccp?.hygieneSettings?.[pointId];
 return {
  employees:Array.isArray(saved?.employees)?[...saved.employees]:[],
  roster:Array.isArray(saved?.roster)?parseHygieneRoster(saved.roster):[],
  roles:Array.isArray(saved?.roles)?[...saved.roles]:[...HYGIENE_DEFAULT.roles],
  reviewer:typeof saved?.reviewer==='string'?saved.reviewer:HYGIENE_DEFAULT.reviewer,
  schedule:'before-shift'
 };
}
export function updateHygieneSettings(state,pointId,{employees,roles,reviewer,roster}){
 if(!state?.haccp?.points?.some(p=>p.id===pointId))throw Error('Выбери точку.');
 const saved=hygieneSettings(state.haccp,pointId);
 const rosterItems=roster===undefined?saved.roster:parseHygieneRoster(roster);
 const names=cleanNames(employees,'сотрудники');
 const value={
  employees:cleanNames([...new Set([...names,...rosterItems.map(x=>x.name)])],'сотрудники'),
  roster:rosterItems,
  roles:cleanNames([...new Set([...cleanNames(roles,'должности'),...rosterItems.map(x=>x.role)])],'должности'),
  reviewer:String(reviewer??'').trim().slice(0,120),
  schedule:'before-shift'
 };
 if(!value.roles.length||!value.reviewer)throw Error('Укажи должности и ответственного за осмотр.');
 state.haccp.hygieneSettings={...(state.haccp.hygieneSettings||{}),[pointId]:value};
 return value;
}
export function validateHygieneSettings(raw,pointIds){
 if(raw===undefined)return;
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>pointIds.length)
  throw Error('Повреждён справочник гигиены сотрудников.');
 for(const [id,item] of Object.entries(raw)){
  if(!pointIds.includes(id)||!item||typeof item!=='object'||Array.isArray(item))
   throw Error('Неизвестная точка в справочнике осмотров.');
  cleanNames(item.employees,'сотрудники');
  if(item.roster!==undefined)parseHygieneRoster(item.roster);
  if(!cleanNames(item.roles,'должности').length||
   !String(item.reviewer??'').trim()||item.schedule!=='before-shift')
   throw Error('Проверь настройки гигиенического осмотра.');
 }
}
export function hygieneObservation(input,at){
 const text=(key,max=200)=>String(input?.[key]??'').trim().slice(0,max);
 const req=(key,label,max=200)=>{
  const v=text(key,max);if(!v)throw Error('Укажи: '+label);return v;
 };
 const employee=req('employee','сотрудник',120);
 const role=req('role','должность',120);
 const shiftStart=req('shiftStart','начало смены',40);
 const shiftTime=Date.parse(shiftStart),inspected=Date.parse(at);
 if(!Number.isFinite(shiftTime)||!Number.isFinite(inspected))
  throw Error('Проверь дату и время осмотра.');
 if(inspected>shiftTime)throw Error('Гигиенический осмотр необходимо оформить до начала смены.');
 const decision=req('hygieneDecision','решение о допуске',12);
 if(!['admit','deny'].includes(decision))throw Error('Выбери решение о допуске.');
 const checks=HYGIENE_CHECKS.map(([key,label])=>{
  const value=req(key,label,12);
  if(!Object.hasOwn(HYGIENE_OUTCOMES,value))throw Error('Укажи результат: '+label);
  return {key,label,value};
 });
 const essential=checks.filter(c=>c.key!=='workplaceRules'&&c.value!=='ok');
 const problems=checks.filter(c=>c.value==='problem');
 if(decision==='admit'&&(essential.length||problems.length))
  throw Error('Нельзя допустить сотрудника при нарушении обязательных пунктов осмотра.');
 if(decision==='deny'&&!text('notes',2000))
  throw Error('Укажи служебное действие при недопуске, без медицинских диагнозов.');
 return {
  employee,role,shift:text('shift',60),
  shiftStart:new Date(shiftTime).toISOString(),
  reviewer:req('reviewer','ФИО проверившего сотрудника',120),
  hygieneDecision:decision,
  decisionText:decision==='admit'?'Допущен к работе':'Не допущен к работе',
  checks:checks.map(c=>c.label+': '+HYGIENE_OUTCOMES[c.value]).join('; '),
  ...Object.fromEntries(checks.map(c=>[c.key,c.value]))
 };
}
