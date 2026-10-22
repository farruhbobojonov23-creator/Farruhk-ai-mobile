// Frying-oil internal operating policy: the kitchen reported use of
// "Масло для фритюра Печагин" and replacement every 3 days.
// 72 hours is the owner's schedule, NOT a universal SanPiN oil safety limit.
// Stop / replace sooner whenever measured quality or visual conditions fail.
export const OIL_DEFAULTS=Object.freeze({
 oil:'Масло для фритюра Печагин',
 fryerNames:Object.freeze(['Фритюрница']),
 intervalDays:3,
 executor:'Сушист',
 reviewer:'Старший смены'
});
export const OIL_CHECKS=Object.freeze([
 ['color','Цвет и прозрачность масла'],
 ['odor','Запах масла'],
 ['foam','Вспенивание при работе'],
 ['smoke','Дымление при работе']
]);
export const OIL_CHECK_RESULTS=Object.freeze({ok:'Норма',problem:'Отклонение',na:'Не проверено / не применимо'});
const required=(value,label,length=200)=>{
 const text=String(value??'').trim();
 if(!text||text.length>length)throw Error('Укажи: '+label);
 return text;
};
const optional=(value,length=200)=>{
 const text=String(value??'').trim();
 if(text.length>length)throw Error('Слишком длинное значение.');
 return text;
};
const list=(values,label)=>{
 if(!Array.isArray(values)||values.length>30)throw Error('Проверь список '+label);
 const filtered=values.map(x=>String(x??'').trim()).filter(Boolean);
 if(filtered.some(x=>x.length>120)||new Set(filtered.map(x=>x.toLocaleLowerCase('ru-RU'))).size!==filtered.length)
  throw Error('Проверь повторения и длину названий: '+label);
 return filtered;
};
export function oilSettings(raw,pointId){
 const value=raw?.oilSettings?.[pointId];
 return {
  oil:typeof value?.oil==='string'?value.oil:OIL_DEFAULTS.oil,
  fryerNames:Array.isArray(value?.fryerNames)?[...value.fryerNames]:[...OIL_DEFAULTS.fryerNames],
  intervalDays:Number.isInteger(value?.intervalDays)?value.intervalDays:OIL_DEFAULTS.intervalDays,
  executor:typeof value?.executor==='string'?value.executor:OIL_DEFAULTS.executor,
  reviewer:typeof value?.reviewer==='string'?value.reviewer:OIL_DEFAULTS.reviewer
 };
}
export function updateOilSettings(state,pointId,{oil,fryerNames,intervalDays,executor,reviewer}){
 if(!state?.haccp?.points?.some(p=>p.id===pointId))throw Error('Укажи торговую точку.');
 const days=Number(intervalDays);
 if(!Number.isInteger(days)||days<1||days>30)throw Error('Интервал полной замены масла должен быть от 1 до 30 дней.');
 const value={
  oil:required(oil,'марка масла',160),
  fryerNames:list(fryerNames,'фритюрниц'),
  intervalDays:days,
  executor:required(executor,'ответственный',120),
  reviewer:required(reviewer,'проверяющий',120)
 };
 if(!value.fryerNames.length)throw Error('Добавь хотя бы одну фритюрницу.');
 state.haccp.oilSettings={...(state.haccp.oilSettings||{}),[pointId]:value};
 return value;
}
export function validateOilSettings(raw,points){
 if(raw===undefined)return;
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>points.length)
  throw Error('Неверные настройки фритюрного масла.');
 for(const [pointId,value] of Object.entries(raw)){
  if(!points.includes(pointId)||!value||typeof value!=='object'||Array.isArray(value))
   throw Error('Неизвестная точка в настройках фритюра.');
  if(!required(value.oil,'марка масла',160)||!required(value.executor,'ответственный',120)||
   !required(value.reviewer,'проверяющий',120))throw Error('Неверная настройка фритюра.');
  if(!list(value.fryerNames,'фритюрниц').length)throw Error('Добавь фритюрницу.');
  if(!Number.isInteger(value.intervalDays)||value.intervalDays<1||value.intervalDays>30)
   throw Error('Некорректный интервал замены масла.');
 }
}
const num=(value,label)=>{
 if(value===null||value===undefined||String(value).trim()==='')return null;
 const n=Number(String(value).trim().replace(',','.'));
 if(!Number.isFinite(n))throw Error('Проверь показатель: '+label);
 return n;
};
const date=(value,label)=>{
 const source=required(value,label,65),time=Date.parse(source);
 if(!Number.isFinite(time))throw Error('Неверная дата: '+label);
 return time;
};
export function oilInspection(input,at,settings){
 const recorded=date(at,'дата контроля');
 const filled=date(input.startedAt,'фактическая дата заливки масла');
 if(filled>recorded)throw Error('Дата заливки масла не может быть позже проверки.');
 const oil=required(input.product,'марка масла',160);
 const equipment=required(input.equipment,'фритюрница',120);
 if(!settings.fryerNames.includes(equipment))throw Error('Выбери зарегистрированную фритюрницу этой точки.');
 const checked=OIL_CHECKS.map(([key,label])=>{
  const result=required(input[key],label,12);
  if(!Object.hasOwn(OIL_CHECK_RESULTS,result))throw Error('Проверь: '+label);
  return {key,label,result};
 });
 const decision=required(input.oilDecision,'решение по маслу',14);
 if(!['continue','replace','stop'].includes(decision))throw Error('Выбери решение о дальнейшем использовании масла.');
 const bad=checked.some(x=>x.result==='problem');
 const unknown=checked.some(x=>x.result==='na');
 const oilTemp=num(input.measured,'температура масла');
 if(oilTemp!==null&&(oilTemp< -30||oilTemp>300))throw Error('Проверь измеренную температуру масла.');
 const tpm=num(input.tpm,'TPM');
 const approvedTpm=num(input.approvedTpm,'утверждённый предельный TPM');
 if(tpm!==null&&(tpm<0||tpm>100)||approvedTpm!==null&&(approvedTpm<=0||approvedTpm>100))
  throw Error('Неверный процент TPM.');
 if(approvedTpm!==null&&tpm===null&&decision==='continue')
  throw Error('Задан предел TPM, но фактическое измерение отсутствует.');
 const tpmOutside=tpm!==null&&approvedTpm!==null&&tpm>approvedTpm;
 const ageHours=Math.round((recorded-filled)/3600000*100)/100;
 const due=ageHours>=settings.intervalDays*24;
 if(decision==='continue'&&(bad||unknown||tpmOutside||due))
  throw Error('Нельзя продолжить использование при неполной проверке, нарушении или истечении вашего графика полной замены. Замени масло либо останови использование.');
 const changedAt=input.changedAt?date(input.changedAt,'фактическая дата полной замены'):null;
 if(decision==='replace'&&changedAt===null)
  throw Error('Для замены укажи фактические дату и время полной замены масла.');
 if(changedAt!==null&&decision!=='replace')
  throw Error('Отметь «Масло полностью заменено», если вводишь дату замены.');
 if(changedAt!==null&&(changedAt<filled||changedAt>recorded))
  throw Error('Дата замены должна быть после заливки и не позже проверки.');
 if((bad||tpmOutside||decision==='stop')&&!String(input.notes||'').trim())
  throw Error('Укажи замечание и принятое действие в комментарии.');
 return {
  equipment,product:oil,
  oilBatch:optional(input.oilBatch,120),startedAt:new Date(filled).toISOString(),
  intervalDays:settings.intervalDays,
  ageHours,replaceDue:due,
  checks:checked.map(item=>item.label+': '+OIL_CHECK_RESULTS[item.result]).join('; '),
  ...Object.fromEntries(checked.map(item=>[item.key,item.result])),
  measured:oilTemp,tpm,approvedTpm,
  oilDecision:decision,changedAt:changedAt===null?null:new Date(changedAt).toISOString(),
  decisionText:decision==='replace'?'Полностью заменено':decision==='stop'?'Использование прекращено':'Разрешено продолжить',
  reviewer:required(input.reviewer,'ФИО старшего смены',120),
  abnormal:bad||tpmOutside
 };
}
export function oilCycleState(raw,pointId,equipment,now=new Date()){
 const rows=(raw?.records||[]).filter(r=>r.kind==='frying'&&r.pointId===pointId&&r.details?.equipment===equipment);
 // Only an actual saved replacement starts a new cycle automatically.
 let lastFill=null;
 for(const row of rows){
  const values=[row.details.changedAt,row.details.startedAt].filter(Boolean);
  for(const value of values){
   const time=Date.parse(value);
   if(Number.isFinite(time)&&time<=now.getTime()&&(lastFill===null||time>lastFill))lastFill=time;
  }
 }
 const config=oilSettings(raw,pointId);
 const hours=lastFill===null?null:Math.round((now.getTime()-lastFill)/3600000*100)/100;
 return {
  filledAt:lastFill===null?null:new Date(lastFill).toISOString(),
  ageHours:hours,
  dueAt:lastFill===null?null:new Date(lastFill+config.intervalDays*86400000).toISOString(),
  isDue:hours!==null&&hours>=config.intervalDays*24
 };
}
