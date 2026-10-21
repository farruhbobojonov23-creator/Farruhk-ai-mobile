// Branch-specific receiving presets. Suppliers are intentionally empty until
// the owner enters actual counterparties; sample products are suggestions only.
export const RECEIVING_GROUPS=Object.freeze([
 ['chilled','Охлаждённые продукты'],
 ['frozen','Замороженные продукты'],
 ['ambient','Сухие / бакалейные продукты'],
 ['produce','Овощи, зелень и фрукты'],
 ['other','Прочее']
]);
export const RECEIVING_CHECKS=Object.freeze([
 ['inspectPackage','Целостность упаковки'],
 ['inspectLabel','Маркировка, производитель и партия'],
 ['inspectExpiry','Срок годности по этикетке'],
 ['inspectDocs','Сопроводительные документы'],
 ['inspectQuality','Внешний вид и признаки порчи'],
 ['inspectTransport','Условия перевозки / температурный режим']
]);
export const RECEIVING_CHECK_VALUES=Object.freeze({
 ok:'Соответствует',problem:'Нарушение',na:'Не применимо'
});
export const RECEIVING_DEFAULT_PRODUCTS=Object.freeze([
 'Лосось','Тунец','Креветки','Угорь','Крабовые палочки',
 'Рис','Нори','Творожный сыр','Огурцы','Авокадо',
 'Соусы','Икра','Упаковка и расходные материалы'
]);
const cleanList=(list,name,max=80)=>{
 if(!Array.isArray(list)||list.length>max)throw Error('Проверь список «'+name+'».');
 const output=list.map(x=>String(x??'').trim()).filter(Boolean);
 if(output.some(x=>x.length>120))throw Error('Слишком длинное название в списке «'+name+'».');
 if(new Set(output.map(x=>x.toLocaleLowerCase('ru-RU'))).size!==output.length)
  throw Error('В списке «'+name+'» повторяются названия.');
 return output;
};
export function receivingSettings(haccp,pointId){
 const saved=haccp?.receivingSettings?.[pointId];
 return {
  suppliers:Array.isArray(saved?.suppliers)?[...saved.suppliers]:[],
  products:Array.isArray(saved?.products)?[...saved.products]:[...RECEIVING_DEFAULT_PRODUCTS]
 };
}
export function updateReceivingSettings(state,pointId,{suppliers,products}){
 if(!state?.haccp?.points?.some(p=>p.id===pointId))throw Error('Укажи существующую точку.');
 const value={suppliers:cleanList(suppliers,'поставщики'),products:cleanList(products,'товары')};
 state.haccp.receivingSettings={...(state.haccp.receivingSettings||{}),[pointId]:value};
 return value;
}
export function validateReceivingSettings(raw,pointIds){
 if(raw===undefined)return;
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>pointIds.length)
  throw Error('Повреждены настройки поставщиков.');
 for(const [id,value] of Object.entries(raw)){
  if(!pointIds.includes(id)||!value||typeof value!=='object'||Array.isArray(value))
   throw Error('Неверная точка в настройках приёмки.');
  cleanList(value.suppliers,'поставщики');cleanList(value.products,'товары');
 }
}
export function receivingInspection(input){
 const structured=RECEIVING_CHECKS.some(([key])=>input[key]!==undefined);
 if(!structured)return null; // Older unstructured receiving entries remain supported.
 const checked=RECEIVING_CHECKS.map(([key,label])=>{
  const value=String(input[key]??'').trim();
  if(!RECEIVING_CHECK_VALUES[value])throw Error('Заполни проверку: '+label);
  return {key,label,value};
 });
 const failed=checked.filter(x=>x.value==='problem');
 return {
  failed,
  text:checked.map(x=>x.label+': '+RECEIVING_CHECK_VALUES[x.value]).join('; ')
 };
}
