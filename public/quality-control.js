import {validateHaccp} from './haccp-model.js';
import {saveAutoTemplate} from './haccp-template-drafts.js';
import {moscowCheckpoint} from './haccp-schedule.js';

export const QUALITY_CRITERIA=Object.freeze([
 ['appearance','Внешний вид и оформление'],
 ['color','Цвет'],
 ['smell','Запах'],
 ['texture','Консистенция'],
 ['taste','Вкус (если безопасно и предусмотрено процедурой)']
]);
export const QUALITY_RESULTS=Object.freeze({
 ok:'Соответствует',problem:'Отклонение',na:'Не оценивалось / не применимо'
});
export const QUALITY_DEFAULT=Object.freeze({
 executor:'Сушист',reviewer:'Старший смены',schedule:'daily-and-batch'
});
const role=x=>String(x??'').trim().slice(0,120);
export function qualityPlan(haccp,pointId){
 const saved=haccp?.qualityPlans?.[pointId];
 return {...QUALITY_DEFAULT,...(saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{})};
}
export function updateQualityPlan(state,pointId,{executor,reviewer}){
 if(!state?.haccp?.points?.some(p=>p.id===pointId))throw Error('Укажи действующую точку.');
 const plan={executor:role(executor),reviewer:role(reviewer),schedule:'daily-and-batch'};
 if(!plan.executor||!plan.reviewer)throw Error('Укажи ответственные должности.');
 state.haccp.qualityPlans={...(state.haccp.qualityPlans||{}),[pointId]:plan};
 return plan;
}
export function validateQualityPlans(raw,pointIds){
 if(raw===undefined)return;
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>pointIds.length)
  throw Error('Неверный план бракеража.');
 for(const [id,plan] of Object.entries(raw)){
  if(!pointIds.includes(id)||!plan||typeof plan!=='object'||Array.isArray(plan)||
   !role(plan.executor)||!role(plan.reviewer)||plan.schedule!=='daily-and-batch')
   throw Error('Повреждены настройки бракеража для точки.');
 }
}
export function qualityRecord(input,at){
 const required=(key,label,max=300)=>{
  const value=String(input?.[key]??'').trim().slice(0,max);
  if(!value)throw Error('Укажи: '+label);
  return value;
 };
 const qualityType=required('qualityType','вид проверки',12);
 if(!['daily','batch'].includes(qualityType))throw Error('Неверный вид бракеража.');
 const decision=required('decision','решение о реализации',20);
 if(!['accepted','rejected'].includes(decision))throw Error('Выбери допуск или запрет реализации.');
 const checked=QUALITY_CRITERIA.map(([key,label])=>{
  const value=required(key,label,12);
  if(!QUALITY_RESULTS[value])throw Error('Проверь критерий: '+label);
  return {key,label,value};
 });
 const misses=checked.filter(c=>c.value==='problem');
 const mandatory=checked.filter(c=>['appearance','smell','texture'].includes(c.key)&&c.value!=='ok');
 if(decision==='accepted'&&(misses.length||mandatory.length))
  throw Error('Не допускай продукцию с нарушением или без проверки внешнего вида, запаха и консистенции.');
 if(decision==='rejected'&&!String(input.notes??'').trim())
  throw Error('Для брака укажи причину и действие в комментарии.');
 const inspected=Date.parse(at),prepared=Date.parse(required('startedAt','время приготовления партии',45));
 if(!Number.isFinite(prepared)||!Number.isFinite(inspected)||prepared>inspected)
  throw Error('Проверь время приготовления и бракеража.');
 const batch=String(input.batch??'').trim().slice(0,120);
 if(qualityType==='batch'&&!batch)throw Error('Укажи номер приготовленной партии.');
 const details={
  qualityType,product:required('product','фактическое блюдо',300),
  batch,quantity:required('quantity','количество и единица',100),
  startedAt:new Date(prepared).toISOString(),
  category:String(input.category??'').trim().slice(0,120),
  recipeId:String(input.recipeId??'').trim().slice(0,100),
  reviewer:required('reviewer','ФИО проверяющего старшего смены',120),
  decision,decisionText:decision==='accepted'?'Допущено к реализации':'Не допущено к реализации',
  checks:checked.map(c=>c.label+': '+QUALITY_RESULTS[c.value]).join('; ')
 };
 for(const {key,value} of checked)details[key]=value;
 const temperature=String(input.measured??'').trim().replace(',','.');
 if(temperature){
  const measured=Number(temperature);
  if(!Number.isFinite(measured)||measured< -100||measured>150)
   throw Error('Некорректная фактическая температура.');
  details.measured=measured;
 }
 return details;
}
export function qualityPlanNeedsSeed(raw){
 const h=validateHaccp(raw);
 return !h.dailyControls.includes('quality')||h.points.some(p=>
  !h.autoTemplates.some(t=>t.kind==='quality'&&t.pointId===p.id&&t.form?.qualityType==='daily'));
}
export function seedQualityDailyPlan(state,now=new Date()){
 const h=validateHaccp(state.haccp);
 let changed=false;
 if(!h.dailyControls.includes('quality')){
  h.dailyControls.push('quality');state.haccp=validateHaccp(h);changed=true;
 }
 for(const point of h.points){
  if(state.haccp.autoTemplates.some(t=>t.kind==='quality'&&t.pointId===point.id&&t.form?.qualityType==='daily'))continue;
  saveAutoTemplate(state,{kind:'quality',pointId:point.id,now,form:{
   qualityType:'daily',pointId:point.id,
   notes:'Перед началом реализации проверь фактически приготовленное блюдо. Результаты проверки и подписи заполняются вручную.'
  }});
  changed=true;
 }
 return changed;
}
