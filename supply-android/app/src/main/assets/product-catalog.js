(function(root){
'use strict';
// Separate product family, supplier-specific variant and alias. Never infer
// the brand, processing state, glaze or current price from a similar name.
const normalize=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/[«»"“”]/g,'').replace(/\s+/g,' ').trim();
const supplierKey=s=>normalize(s).replace(/^общество с ограниченной ответственностью\s+/,'ооо ');
const nameKey=s=>normalize(s).replace(/\s*\/\s*(?:шт|уп|кор|кг|г|л|мл)(?:\s*\((?:с|без)\s+ндс\))?$/i,'').trim();
const tokens=s=>new Set(nameKey(s).match(/[а-яa-z0-9]+(?:[\/,.-][0-9]+)*/gi)||[]);
const aliasKey=(supplier,row)=>{
 const s=supplierKey(supplier),n=nameKey(row.name),article=normalize(row.article);
 return s&&n?JSON.stringify([s,article,n,row.unit||'',Number(row.packKg)||null,Number(row.packL)||null]):null;
};
function suggest(name,catalog){
 const query=tokens(name);if(!query.size)return [];
 return catalog.map(p=>{
  const target=tokens(p.name),shared=[...query].filter(x=>target.has(x)).length;
  return {productId:p.id,name:p.name,score:shared/Math.max(query.size,target.size,1)};
 }).filter(x=>x.score>=.35).sort((a,b)=>b.score-a.score||String(a.name).localeCompare(String(b.name),'ru')).slice(0,5);
}
function resolve(row,supplier,catalog,aliases){
 const key=aliasKey(supplier,row);
 const exact=key&&Object.prototype.hasOwnProperty.call(aliases,key)?aliases[key]:null;
 if(exact&&catalog.some(p=>p.id===exact.productId))return {status:'known',productId:exact.productId,variantId:exact.variantId};
 const suggestions=suggest(row.name,catalog);
 return {status:suggestions.length?'review':'new',suggestions};
}
function confirm(row,supplier,productId,variantId,catalog,aliases){
 const key=aliasKey(supplier,row);
 if(!key||!variantId||!catalog.some(p=>p.id===productId))throw Error('Нужно подтвердить поставщика, товар и вариант');
 return {...aliases,[key]:{productId,variantId}};
}
function unlink(row,supplier,aliases){
 const next={...aliases},key=aliasKey(supplier,row);if(key)delete next[key];return next;
}
const api={normalize,aliasKey,resolve,confirm,unlink,suggest};
if(typeof module==='object'&&module.exports)module.exports=api;else root.supplyProductCatalog=api;
})(globalThis);
