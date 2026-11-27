
/* FARUKH SUPPLY v98: seven supplier column schemas, dynamic items and totals.
   Never infer numbers from sample invoices or another supplier's catalog. */
;(function(root){
'use strict';
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const old=api.parseSimple,oldPasses=api.parseSamePhotoPasses;
const profiles=Object.freeze([
 {id:'chistyakova',name:'ИП Чистякова Ирина Юрьевна',form:'УПД',re:/чистяков[а-яё]*\s+ирин[а-яё]*\s+юрьевн[а-яё]*/iu},
 {id:'virgo',name:'ООО «ВИРГО»',form:'УПД',re:/(?:ооо|общество\s+с\s+ограниченной\s+ответственностью)\s*["«]?\s*вирго\b/iu},
 {id:'vesta',name:'ООО «ВЕСТА»',form:'УПД',re:/(?:ооо|общество\s+с\s+ограниченной\s+ответственностью)\s*["«]?\s*веста\b/iu},
 {id:'vostok_zapad',name:'ООО «ВОСТОК-ЗАПАД»',form:'ТТН',re:/восток\s*[-–—]?\s*запад/iu},
 {id:'marr',name:'ООО «МАРР РУССИЯ»',form:'Реализация',re:/марр\s+руссия/iu},
 {id:'shanghai',name:'ООО «ШАНХАЙ-ТОРГ»',form:'УПД, цена с НДС',re:/шанхай\s*[-–—]?\s*торг/iu},
 {id:'alidi',name:'ООО «АЛИДИ ПРОФ»',form:'УПД, несколько страниц',re:/алиди\s+проф/iu}
]);
const norm=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/[\u00a0\u202f]/g,' ').replace(/[ \t]+/g,' ').trim();
const key=s=>norm(s).replace(/[^а-яa-z0-9%]+/g,'');
const num=s=>{const v=String(s??'').replace(/[\s\u00a0\u202f]/g,'').replace(',','.');return /^\d+(?:\.\d{1,4})?$/.test(v)&&Number(v)>0?Number(v):null;};
const cents=n=>Math.round((n+Number.EPSILON)*100);
const unitNames={шт:'шт',штука:'шт',штук:'шт',кг:'кг',килограмм:'кг',г:'г',л:'л',литр:'л',мл:'мл',уп:'уп',упак:'уп',упаковка:'уп',кор:'кор',коробка:'кор',пакет:'уп',мешок:'уп'};
const okei={796:'шт',778:'уп',990:'уп',166:'кг',163:'г',112:'л',111:'мл'};
function detect(text){
 const s=norm(String(text??'').slice(0,5000)),found=profiles.filter(p=>p.re.test(s));
 return found.length===1?found[0]:null;
}
function columns(header,p){
 const h=header.map(key),find=re=>h.findIndex(t=>re.test(t));
 const c={
  name:find(/^(наименование|наименованиетовар|названиетовара|товар|номенклатура)$|характеристикитовара/),
  quantity:find(/^(количество|колво|колвов|количествомест|количествообъем)/),
  unit:find(/^(едизм|единицаизмерения|условноеобозначение|наименованиеединицы|единица|наименованиесокращенное)$/),
  code:find(/^(кодокеи|кодпоокеи|океикод|кодединицыизмерения)$/),
  priceGross:find(/ценасндс|цена(?:заединицу)?сндс|ценасучетомндс|ценавключаяндс/),
  priceNet:find(/^(ценатарифзаединицуизмерения|ценатарифзаединицу|ценабезндс|ценатариф|цена)$/),
  sumGross:find(/^(суммасндс|стоимостьсндс|стоимостьтоваров.*сналогом|стоимостьтоваров.*включаяналог|всегосндс|общаястоимость|суммакоплате|сумма)$/),
  sumNet:find(/^(стоимостьтоваров.*безналога|стоимостьбезндс|суммабезндс)$/),
  tax:find(/^(сумманалога|сумманалогапредъявляемаяпокупателю|суммандс|ндссумма)$/),
  weight:find(/^(вескг|веснеттокг|веснетто|массанетто)$/),
  article:find(/^(артикул|кодтовара|кодпродукции|код)$/)
 };
 if(p.id==='marr'&&c.priceGross<0)c.priceGross=find(/^цена$/);
 if(p.id==='vostok_zapad'&&c.unit<0)c.unit=find(/^наименование$/);
 if(c.name<0||c.quantity<0||c.sumGross<0||new Set([c.name,c.quantity,c.sumGross]).size!==3)return null;
 return c;
}
function parseTable(profileId,header,rows,{printedTotal=null,sourcePage=1}={}){
 const p=typeof profileId==='string'?profiles.find(x=>x.id===profileId):profileId;
 if(!p||!Array.isArray(header)||!Array.isArray(rows)||rows.length>1000||rows.some(r=>!Array.isArray(r)))return null;
 const col=columns(header,p);if(!col)return null;
 let skipped=0;const items=[],warnings=[];
 for(let i=0;i<rows.length;i++){
  const r=rows[i],field=k=>col[k]<0?'':String(r[col[k]]??'').trim();
  const name=field('name').replace(/^[0()]+\s*\([^)]{2,70}\)\s*/,'').trim();
  if(!name||/^(итого|всего|место\s+хранения|наименование)$/iu.test(name)||!/[\p{L}]/u.test(name))continue;
  const q=num(field('quantity')),sum=num(field('sumGross'));
  if(!(q>0&&sum>0)){skipped++;warnings.push('Строка '+(i+1)+': нет количества или суммы');continue;}
  let unit=unitNames[key(field('unit'))]||'';
  const code=field('code').replace(/\s/g,'');
  if(code&&okei[code]){if(unit&&unit!==okei[code]){unit='';warnings.push('Строка '+(i+1)+': конфликт ОКЕИ');}else unit=unit||okei[code];}
  const grossPrice=num(field('priceGross')),net=num(field('sumNet')),vat=num(field('tax'))||0,netPrice=num(field('priceNet'));
  if(net!=null&&vat>0&&Math.abs(net+vat-sum)>.03){skipped++;warnings.push('Строка '+(i+1)+': неверная сумма НДС');continue;}
  if(grossPrice!=null&&Math.abs(q*grossPrice-sum)>Math.max(.02,q*.01+.01)){skipped++;warnings.push('Строка '+(i+1)+': цена с НДС не сходится');continue;}
  if(netPrice!=null&&net!=null&&Math.abs(q*netPrice-net)>Math.max(.02,q*.01+.01)){skipped++;warnings.push('Строка '+(i+1)+': цена без НДС не сходится');continue;}
  const item={name,unit,quantity:q,price:Math.round((grossPrice??sum/q)*100)/100,invoiceTotal:sum,
   templateId:p.id,sourceRow:String(i+1),sourcePage,article:field('article')||undefined,uncertain:true,
   priceSource:grossPrice!=null?'напечатанная цена с НДС':'цена с НДС = сумма / количество'};
  const w=num(field('weight'));if(w!=null)item.invoiceWeightKg=w;
  if(unit&&unit!=='кг'){const kg=api.packWeight?.(name),litres=api.packVolume?.(name);if(kg>0)item.packKg=kg;if(litres>0)item.packL=litres;}
  if(!unit)warnings.push('Строка '+(i+1)+': единица требует подтверждения');
  if(grossPrice==null)warnings.push('Строка '+(i+1)+': цена с НДС вычислена из суммы');
  items.push(item);
 }
 if(!items.length)return null;
 const exp=num(printedTotal),actual=items.reduce((s,x)=>s+cents(x.invoiceTotal),0);
 const verified=exp!=null&&actual===cents(exp)&&!skipped&&items.every(x=>x.unit);
 if(exp!=null&&actual!==cents(exp))warnings.push('Итог строк не совпадает с накладной');
 if(skipped)warnings.push('Пропущено строк: '+skipped);
 return {supplier:p.name,templateId:p.id,items,printedTotal:exp,warnings:[...new Set(warnings)],
   documentVerified:verified,pageVerified:false,supplierLayoutUsed:true,needsReview:!verified};
}
function parseDelimited(raw){
 const p=detect(raw);if(!p)return null;
 const ls=String(raw??'').split(/\r?\n/).filter(x=>x.includes('\t')||/\s\|\s/.test(x));
 const fields=x=>x.includes('\t')?x.split('\t').map(s=>s.trim()):x.replace(/^\s*\|/,'').replace(/\|\s*$/,'').split(/\s*\|\s*/).map(s=>s.trim());
 for(let i=0;i<ls.length-1;i++){
  const header=fields(ls[i]);if(!columns(header,p))continue;
  const rows=[];let total=null;
  for(const line of ls.slice(i+1)){
   const cells=fields(line);
   if(/^(итого|всего)/iu.test(cells.find(Boolean)||'')){const m=cells.map(num).filter(v=>v!=null);if(m.length===1)total=m[0];break;}
   if(cells.length===header.length)rows.push(cells);
  }
  return parseTable(p,header,rows,{printedTotal:total});
 }
 return null;
}
api.supplierTemplates=profiles;
api.detectSupplierTemplate=detect;
api.parseSupplierTable=parseTable;
api.parseSupplierDelimited=parseDelimited;
api.parseSimple=function(raw){
 const oldResult=old(raw),profile=detect(raw);
 const base=profile&&!String(oldResult.supplier||'').trim()?{...oldResult,supplier:profile.name}:oldResult;
 const mapped=parseDelimited(raw);
 const score=r=>r?.items?.filter(x=>x.name&&x.price>0&&x.quantity>0&&x.unit&&x.invoiceTotal>0).length||0;
 if(mapped&&score(mapped)>score(base)&&!base.documentVerified&&!base.pageVerified)
  return api.auditCandidate?api.auditCandidate(mapped):mapped;
 return profile?{...base,templateId:profile.id}:base;
};
api.parseSamePhotoPasses=function(texts){
 const entries=oldPasses(texts),ids=[...new Set(texts.map(t=>detect(t)?.id).filter(Boolean))];
 const p=ids.length===1?profiles.find(x=>x.id===ids[0]):null;
 const out=entries.map(r=>p&&!r.supplier?{...r,supplier:p.name,templateId:p.id}:r);
 for(const text of texts){const mapped=parseDelimited(text);if(mapped)out.push(api.auditCandidate?api.auditCandidate(mapped):mapped);}
 return out;
};
})(globalThis);
