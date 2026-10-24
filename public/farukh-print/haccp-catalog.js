// Dedicated non-food templates. Durations are not food expiry fields.
export const version='haccp-2026-10-24-v1';
const definitions=[
 ['nika-stock','Ника-2 · запас раствора','НИКА-2','ЗАПАС РАБОЧЕГО РАСТВОРА','stock',21],
 ['nika-knives','Ника-2 · для ножей','НИКА-2','ДЛЯ ЗАМАЧИВАНИЯ НОЖЕЙ','shift',0],
 ['nika-cloths','Ника-2 · для ветоши','НИКА-2','ДЛЯ ЗАМАЧИВАНИЯ ВЕТОШИ','shift',0],
 ['deco-hands','DECO S9 · для рук','DECO S9','АНТИСЕПТИК ДЛЯ РУК','replacement',30],
 ['deco-surfaces','DECO S9 · для поверхностей','DECO S9','ДЛЯ ПОВЕРХНОСТЕЙ','replacement',30],
 ['soap','Жидкое мыло · для рук','ЖИДКОЕ МЫЛО','ДЛЯ МЫТЬЯ РУК','replacement',30],
 ['mop','Место хранения швабры','МЕСТО ХРАНЕНИЯ','ШВАБРЫ','place',0],
 ['bucket','Место хранения ведра','МЕСТО ХРАНЕНИЯ','ВЕДРА','place',0],
 ['broom','Место хранения искусственного веника','МЕСТО ХРАНЕНИЯ','ИСКУССТВЕННОГО ВЕНИКА','place',0]
];
export const templates=definitions.map(([template,name,title,subtitle,mode,days])=>({id:'haccp-'+template,kind:'ready',category:'ХАССП',template,name,title,subtitle,mode,days,needsReview:false}));
export const getTemplate=p=>p&&templates.find(t=>t.template===p.template);
export function merge(existing){return [...existing,...templates.filter(t=>!existing.some(p=>p.template===t.template)).map(t=>({...t}))]}
export function deadline(t,start,limit){
 if(t.mode==='place')return null;
 if(!Number.isFinite(start))throw Error('Неверная дата приготовления.');
 if(t.mode==='shift'){
  if(!Number.isFinite(limit)||limit<=start||limit>start+24*3600000)throw Error('Укажи окончание текущей смены (не позднее 24 часов).');
  return limit;
 }
 const end=start+t.days*86400000;
 if(t.mode==='replacement'){
  if(!Number.isFinite(limit)||limit<=start)throw Error('Укажи действующий заводской срок годности.');
  return Math.min(end,limit);
 }
 return end;
}
export function rows(t,b,format){
 if(t.mode==='place')return [t.title,t.subtitle,...(t.template==='broom'?['ИНВЕНТАРЬ ДЛЯ УБОРКИ']:['КУХНЯ','ДЛЯ МЫТЬЯ ПОЛА'])];
 if(!b)return [t.title,t.subtitle,t.mode==='stock'?'Хранение до использования · 21 день':t.mode==='shift'?'Отдельная порция · до конца смены':'Готовое средство · замена через 30 дней','Начало: при первой печати',t.mode==='stock'?'Годен до: расчёт при печати':'Заменить до: расчёт при печати',t.mode==='replacement'?'Не позже заводского срока':'Повтор сохраняет исходные даты'];
 if(t.mode==='stock')return [t.title,t.subtitle,'Хранение до использования · 21 день','Приготовлен: '+format(b.start),'Годен до: '+format(b.end)];
 if(t.mode==='shift')return [t.title,t.subtitle,t.template==='nika-cloths'?'Ветошь для оборудования':'Отдельная порция из запаса','Налито: '+format(b.start),'Заменить до: '+format(b.end),'При изменении вида — раньше'];
 return [t.title,t.subtitle,'Готовое средство · замена через 30 дней','Заполнено: '+format(b.start),'Заменить до: '+format(b.end),'Не позже заводского срока'];
}
