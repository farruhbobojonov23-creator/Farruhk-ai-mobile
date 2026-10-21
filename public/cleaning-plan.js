import {validateHaccp} from './haccp-model.js';
import {saveAutoTemplate} from './haccp-template-drafts.js';
import {moscowCheckpoint} from './haccp-schedule.js';

// Editable operating plan, not evidence that any cleaning has been done.
// Product dilution, contact time and rinse requirements MUST come from the
// instructions on the exact containers used by the kitchen.
export const DEFAULT_CLEANING_PLAN=Object.freeze({
 dailyZones:[
  'Рабочие столы и поверхности суши-бара',
  'Разделочные доски, ножи и мелкий инвентарь',
  'Раковины, смесители и зоны мойки',
  'Полы производственной зоны',
  'Ручки дверей и контактные поверхности',
  'Наружные поверхности оборудования и холодильников',
  'Контейнеры для отходов',
  'Открытые полки и стеллажи'
 ],
 generalZones:[
  'Труднодоступные участки и пространство под оборудованием',
  'Стеллажи, полки и шкафы (полная обработка)',
  'Холодильники и морозильники по безопасному графику',
  'Стены, двери и другие доступные поверхности',
  'Вентиляционные решётки (доступные части)',
  'Раковины, сливы и сливные решётки',
  'Полы и плинтусы, включая углы',
  'Оборудование и производственный инвентарь'
 ],
 agents:['Deco S9','Ника-2'],
 dailyExecutor:'Сушист',
 reviewer:'Старший смены',
 generalExecutor:'Вся смена',
 generalDays:[1,15]
});
const uniqueList=(arr,label)=>{
 if(!Array.isArray(arr)||!arr.length||arr.length>20)throw Error('Проверь список: '+label);
 const values=arr.map(v=>String(v??'').trim()).filter(Boolean);
 if(!values.length||values.some(v=>v.length>120)||new Set(values).size!==values.length)throw Error('Проверь список: '+label);
 return values;
};
export function cleaningPlan(raw,pointId){
 const own=raw?.cleaningPlans?.[pointId];
 const base=DEFAULT_CLEANING_PLAN;
 return {...base,...(own&&typeof own==='object'&&!Array.isArray(own)?own:{}),
  dailyZones:Array.isArray(own?.dailyZones)?own.dailyZones:[...base.dailyZones],
  generalZones:Array.isArray(own?.generalZones)?own.generalZones:[...base.generalZones],
  agents:Array.isArray(own?.agents)?own.agents:[...base.agents],
  generalDays:Array.isArray(own?.generalDays)?own.generalDays:[...base.generalDays]};
}
export function cleaningScheduledDays(raw,pointId){
 const days=cleaningPlan(raw,pointId).generalDays;
 return days.filter(n=>Number.isInteger(n)&&n>=1&&n<=31);
}
export function cleaningTemplateForm(config,pointId,type){
 const general=type==='general';
 const zones=general?config.generalZones:config.dailyZones;
 return {
  pointId,at:'',owner:'',cleaningType:type,
  zone:general?'Производственные зоны · генеральная уборка':'Производственные зоны · ежедневная уборка',
  method:'Мойка и дезинфекция согласно утверждённой инструкции для каждой зоны',
  agent:'',concentration:'',exposure:'',result:'',
  notes:'Чек-лист: '+zones.join('; ')+'. Исполнитель: '+(general?config.generalExecutor:config.dailyExecutor)+'. Проверяет: '+config.reviewer+'. Средства на выбор: '+config.agents.join(', ')+'.'
 };
}
function templateFor(h,pointId,type){
 return h.autoTemplates.find(t=>t.kind==='cleaning'&&t.pointId===pointId&&
  (t.form?.cleaningType==='general'?'general':'daily')===type);
}
export function seedCleaningPlan(state,now=new Date()){
 const h=validateHaccp(state.haccp);
 let changed=false;
 for(const point of h.points){
  const plan=cleaningPlan(h,point.id);
  for(const type of ['daily','general']){
   if(templateFor(state.haccp,point.id,type))continue;
   const form=cleaningTemplateForm(plan,point.id,type);
   // Use a regular sample, so daily drafts follow the existing safe workflow.
   saveAutoTemplate(state,{kind:'cleaning',pointId:point.id,form,now});
   changed=true;
  }
 }
 return changed;
}
export function cleaningPlanNeedsSeed(raw){
 const h=validateHaccp(raw);
 return h.points.some(p=>['daily','general'].some(type=>!templateFor(h,p.id,type)));
}
export function updateCleaningPlan(state,pointId,input,now=new Date()){
 const h=validateHaccp(state.haccp);
 if(!h.points.some(p=>p.id===pointId))throw Error('Выбери точку.');
 const days=uniqueList(input.generalDays,'дни генеральной уборки').map(Number);
 if(days.length!==2||new Set(days).size!==2||days.some(x=>!Number.isInteger(x)||x<1||x>28))
  throw Error('Укажи два различных числа месяца от 1 до 28.');
 const current={
  dailyZones:uniqueList(input.dailyZones,'ежедневные зоны'),
  generalZones:uniqueList(input.generalZones,'генеральные зоны'),
  agents:uniqueList(input.agents,'средства'),
  dailyExecutor:String(input.dailyExecutor??'').trim().slice(0,120),
  reviewer:String(input.reviewer??'').trim().slice(0,120),
  generalExecutor:String(input.generalExecutor??'').trim().slice(0,120),
  generalDays:days.sort((a,b)=>a-b)
 };
 if(!current.dailyExecutor||!current.reviewer||!current.generalExecutor)throw Error('Укажи роли персонала.');
 h.cleaningPlans={...(h.cleaningPlans||{}),[pointId]:current};
 state.haccp=validateHaccp(h);
 for(const type of ['daily','general']){
  const prev=templateFor(state.haccp,pointId,type);
  const form=cleaningTemplateForm(current,pointId,type);
  const merged=prev?{...prev.form,...form,owner:'',result:'',agent:''}:form;
  saveAutoTemplate(state,{kind:'cleaning',pointId,form:merged,now});
 }
 return current;
}
