export const thawProducts=['Лосось','Тунец','Креветки','Кальмар','Угорь','Морепродукты','Замороженный полуфабрикат'];
export const thawMethod='В холодильнике (+2…+6 °C; если разрешено маркировкой и утверждённой инструкцией)';
export const thawRoles={executor:'Сушист',reviewer:'Старший смены'};
export function thawElapsed(start,end){
 if(!start||!end)return null;
 const a=Date.parse(start),b=Date.parse(end);
 return Number.isFinite(a)&&Number.isFinite(b)&&b>=a?Math.round((b-a)/3600000*100)/100:null;
}
export function thawConfig(raw,pointId){
 const own=raw?.thawConfigs?.[pointId]||{};
 return {products:Array.isArray(own.products)?own.products:[...thawProducts],
  methods:Array.isArray(own.methods)?own.methods:[thawMethod],
  executor:own.executor||thawRoles.executor,reviewer:own.reviewer||thawRoles.reviewer,
  min:2,max:6};
}

function normalizeList(items,label){
 if(!Array.isArray(items)||items.length>60)throw Error('Проверь список: '+label);
 const values=items.map(x=>String(x??'').trim()).filter(Boolean);
 if(values.some(x=>x.length>160)||new Set(values.map(x=>x.toLocaleLowerCase('ru-RU'))).size!==values.length)throw Error('Повторяющиеся или слишком длинные названия: '+label);
 return values;
}
export function updateThawConfig(state,pointId,input){
 if(!state?.haccp?.points?.some(p=>p.id===pointId))throw Error('Выбери существующую точку.');
 const products=normalizeList(input.products,'продукты'),methods=normalizeList(input.methods,'способы');
 if(!methods.length)throw Error('Необходимо указать хотя бы один способ.');
 const executor=String(input.executor??'').trim().slice(0,120);
 const reviewer=String(input.reviewer??'').trim().slice(0,120);
 if(!executor||!reviewer)throw Error('Заполни ответственных сотрудников.');
 const value={products,methods,executor,reviewer};
 state.haccp.thawConfigs={...(state.haccp.thawConfigs||{}),[pointId]:value};
 return value;
}
export function validateThawConfigs(raw,points){
 if(raw===undefined)return;
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>points.length)throw Error('Повреждены настройки размораживания.');
 for(const [id,config] of Object.entries(raw)){
  if(!points.includes(id)||!config||typeof config!=='object'||Array.isArray(config))throw Error('Неверная точка размораживания.');
  normalizeList(config.products,'продукты');
  if(!normalizeList(config.methods,'способы').length||!String(config.executor||'').trim()||!String(config.reviewer||'').trim())throw Error('Неверные настройки размораживания.');
 }
}
