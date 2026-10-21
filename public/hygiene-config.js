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
export function hygieneSettings(haccp,pointId){
 const saved=haccp?.hygieneSettings?.[pointId];
 return {
  employees:Array.isArray(saved?.employees)?[...saved.employees]:[],
  roles:Array.isArray(saved?.roles)?[...saved.roles]:[...HYGIENE_DEFAULT.roles],
  reviewer:typeof saved?.reviewer==='string'?saved.reviewer:HYGIENE_DEFAULT.reviewer,
  schedule:'before-shift'
 };
}
export function updateHygieneSettings(state,pointId,{employees,roles,reviewer}){
 if(!state?.haccp?.points?.some(p=>p.id===pointId))throw Error('Выбери точку.');
 const value={employees:cleanNames(employees,'сотрудники'),
  roles:cleanNames(roles,'должности'),
  reviewer:String(reviewer??'').trim().slice(0,120),
  schedule:'before-shift'};
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
