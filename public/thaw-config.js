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
