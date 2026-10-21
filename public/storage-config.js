// Storage references are branch-specific hints only. A product's shelf life
// and storage temperatures must come from a verified TTK, label or SOP.
export const STORAGE_GROUPS=Object.freeze([
 ['raw','Сырьё'],
 ['semifinished','Полуфабрикат'],
 ['prepared','Готовая продукция'],
 ['opened','Вскрытая упаковка'],
 ['other','Прочее']
]);
export const DEFAULT_STORAGE_ITEMS=Object.freeze([
 'Лосось','Тунец','Креветки','Угорь','Рис для суши','Творожный сыр',
 'Огурцы','Авокадо','Соус спайси','Соус унаги','Соус шрирача',
 'Заготовки для роллов','Начинка для роллов','Готовые роллы'
]);
export const DEFAULT_STORAGE_ZONES=Object.freeze([
 'Холодильник','Морозильник','Сухой склад','Производственная зона'
]);
export const STORAGE_CHECKS=Object.freeze([
 ['labelCheck','Маркировка и дата читаемы'],
 ['conditionsCheck','Фактические условия хранения соблюдены']
]);
export const STORAGE_RESULTS=Object.freeze({
 ok:'Соответствует',problem:'Есть нарушение'
});
function safeList(value,label){
 if(!Array.isArray(value)||value.length>80)throw Error('Проверь список «'+label+'».');
 const normalized=value.map(x=>String(x??'').trim()).filter(Boolean);
 if(normalized.some(x=>x.length>120)||new Set(normalized.map(x=>x.toLocaleLowerCase('ru-RU'))).size!==normalized.length)
  throw Error('Проверь названия в списке «'+label+'».');
 return normalized;
}
export function storageSettings(raw,pointId){
 const settings=raw?.storageSettings?.[pointId];
 return {
  products:Array.isArray(settings?.products)?[...settings.products]:[...DEFAULT_STORAGE_ITEMS],
  zones:Array.isArray(settings?.zones)?[...settings.zones]:[...DEFAULT_STORAGE_ZONES]
 };
}
export function updateStorageSettings(state,pointId,{products,zones}){
 if(!state?.haccp?.points?.some(p=>p.id===pointId))throw Error('Неизвестная точка.');
 const value={products:safeList(products,'продукты'),zones:safeList(zones,'зоны')};
 if(!value.zones.length)throw Error('Укажи хотя бы одну зону хранения.');
 state.haccp.storageSettings={...(state.haccp.storageSettings||{}),[pointId]:value};
 return value;
}
export function validateStorageSettings(value,pointIds){
 if(value===undefined)return;
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>pointIds.length)
  throw Error('Неверный справочник хранения.');
 for(const [id,settings] of Object.entries(value)){
  if(!pointIds.includes(id)||!settings||typeof settings!=='object'||Array.isArray(settings))
   throw Error('Неверная точка справочника хранения.');
  safeList(settings.products,'продукты');
  if(!safeList(settings.zones,'зоны').length)throw Error('Отсутствуют зоны хранения.');
 }
}
export function storageRecordState(input){
 const results=STORAGE_CHECKS.filter(([key])=>input[key]!==undefined);
 if(!results.length)return null; // Existing historical records retain old semantics.
 if(results.length!==STORAGE_CHECKS.length)throw Error('Заполни оба пункта проверки маркировки и хранения.');
 const invalid=results.find(([key])=>!STORAGE_RESULTS[input[key]]);
 if(invalid)throw Error('Выбери результат проверки: '+invalid[1]);
 return results.some(([key])=>input[key]==='problem')?'deviation':'ok';
}
