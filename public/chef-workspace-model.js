const trim=(v,max=500)=>String(v??'').trim().slice(0,max);
export const taskStatus=t=>t.done?'done':t.status==='active'?'active':'new';
export function setTaskStatus(task,status){if(!['new','active','done'].includes(status))throw Error('Неизвестный статус задачи.');task.status=status;task.done=status==='done'}
export const moscowDay=(value=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export function filterTasks(tasks,{point='',period='all',now=new Date()}={}){return tasks.filter(t=>!point||t.point===point).filter(t=>period==='all'||period==='today'&&t.due&&moscowDay(t.due)===moscowDay(now)||period==='late'&&!t.done&&t.due&&Date.parse(t.due)<+now).sort((a,b)=>Number(a.done)-Number(b.done)||(Date.parse(a.due)||Infinity)-(Date.parse(b.due)||Infinity))}
export function pointOverview(state){return (state.haccp?.points||[]).map(p=>({...p,items:(state.inspections||[]).filter(i=>!i.done&&(i.pointId===p.id||i.point===p.name)),tasks:(state.tasks||[]).filter(t=>!t.done&&t.point===p.name)}))}
export function createBatch(raw,recipes,id=crypto.randomUUID(),now=new Date()){
 const name=trim(raw.name,200),owner=trim(raw.owner,120),point=trim(raw.point,120),quantity=Number(raw.quantity),unit=trim(raw.unit,10);
 if(!name||!owner||!point)throw Error('Укажи название заготовки, точку и ответственного.');
 if(!Number.isFinite(quantity)||quantity<=0||quantity>100000)throw Error('Укажи количество больше нуля.');
 if(!['кг','г','л','мл','шт.'].includes(unit))throw Error('Выбери единицу измерения.');
 const date=trim(raw.preparedAt,40);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+':00+03:00')))throw Error('Укажи дату и время приготовления.');
 const useBy=trim(raw.useBy,40);if(useBy&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(useBy)||!Number.isFinite(Date.parse(useBy+':00+03:00'))||Date.parse(useBy+':00+03:00')<=Date.parse(date+':00+03:00')))throw Error('Срок использования должен быть позже приготовления.');
 const recipeId=trim(raw.recipeId,100);if(recipeId&&!recipes.some(r=>r.id===recipeId))throw Error('Связанная ТТК не найдена.');
 return {id,name,owner,point,quantity,unit,preparedAt:new Date(date+':00+03:00').toISOString(),useBy:useBy?new Date(useBy+':00+03:00').toISOString():null,recipeId:recipeId||null,conditions:trim(raw.conditions,500),createdAt:now.toISOString()};
}
export function validateBatches(value=[]){if(!Array.isArray(value)||value.some(b=>!b||typeof b.id!=='string'||!b.id||typeof b.name!=='string'||!b.name.trim()||!Number.isFinite(b.quantity)||b.quantity<=0||!['кг','г','л','мл','шт.'].includes(b.unit)||typeof b.owner!=='string'||!b.owner.trim()||typeof b.point!=='string'||!b.point.trim()||!Number.isFinite(Date.parse(b.preparedAt))||b.useBy&&(!Number.isFinite(Date.parse(b.useBy))||Date.parse(b.useBy)<=Date.parse(b.preparedAt))))throw Error('Повреждён раздел заготовок.');if(new Set(value.map(b=>b.id)).size!==value.length)throw Error('Повторяющиеся партии заготовок.');return structuredClone(value)}
