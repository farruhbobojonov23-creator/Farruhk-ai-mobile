const module={exports:{}};
'use strict';
// Confirmed invoice lines only. Monetary totals are gross (including VAT).
const norm = v => String(v ?? '').normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
const round = (v, n=2) => Math.round((v + Number.EPSILON)*10**n)/10**n;
function positive(v, field) { if (v === '' || v == null || !Number.isFinite(Number(v)) || Number(v)<=0) throw Error(field); return Number(v); }
function quantity(q, unit, pack) {
  q=positive(q,'Количество'); unit=norm(unit);
  const units={'кг':['кг',1],'г':['кг',.001],'л':['л',1],'мл':['л',.001],'шт':['шт',1]};
  if (units[unit]) return {value:q*units[unit][1],unit:units[unit][0]};
  if (['уп','уп.','кор','кор.','упаковка','коробка'].includes(unit)) {
    if (!pack || !units[norm(pack.unit)]) throw Error('Уточните фасовку');
    return quantity(q*positive(pack.size,'Фасовка'),pack.unit);
  }
  throw Error('Неизвестная единица измерения');
}
function linePrice(line) {
  const q=quantity(line.quantity,line.unit,line.pack);
  const total=positive(line.grossTotal,'Сумма с НДС');
  return {quantity:q.value,unit:q.unit,price:round(total/q.value,4)};
}
function invoiceKey(doc) {
  const parts=[doc.supplierId,doc.number,doc.date,doc.pointId].map(norm);
  if(parts.some(v=>!v)) throw Error('Не заполнены реквизиты');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(parts[2]) || !Number.isFinite(Date.parse(parts[2])) || new Date(parts[2]).toISOString().slice(0,10)!==parts[2]) throw Error('Дата');
  return JSON.stringify(parts);
}
function observations(docs) {
  const seen=new Set(),out=[];
  for(const doc of docs) {
    if(doc.status!=='confirmed') continue;
    const key=invoiceKey(doc);
    if(seen.has(key)) throw Error('Дубликат накладной: '+doc.number);
    seen.add(key);
    const grouped=new Map();
    for(const line of doc.lines || []) {
      // productId = approved SKU (brand, specification, processing);
      // comparisonGroupId = approved equivalent grade/specification.
      if(line.status!=='confirmed'||!line.productId||!line.comparisonGroupId) continue;
      const p=linePrice(line);
      const id=JSON.stringify([line.productId,line.comparisonGroupId,p.unit]);
      const old=grouped.get(id)||{quantity:0,grossTotal:0};
      grouped.set(id,{...old,quantity:old.quantity+p.quantity,grossTotal:old.grossTotal+Number(line.grossTotal),productId:line.productId,comparisonGroupId:line.comparisonGroupId,unit:p.unit});
    }
    for(const line of grouped.values()) out.push({...line,price:round(line.grossTotal/line.quantity,4),supplierId:doc.supplierId,pointId:doc.pointId,date:doc.date,invoiceId:doc.id,invoiceNumber:doc.number});
  }
  return out;
}
function series(rows, keyFn) {
  const map=new Map();
  for(const row of rows) {const key=keyFn(row); if(!map.has(key))map.set(key,[]); map.get(key).push(row);}
  // Aggregate equal-date observations by actual purchased quantity; no fictitious ordering.
  return [...map.values()].map(list=>{
    const dates=new Map();
    for(const row of list) {const d=dates.get(row.date)||{...row,quantity:0,grossTotal:0,invoices:[]};d.quantity+=row.quantity;d.grossTotal+=row.grossTotal;d.invoices.push(row.invoiceId);dates.set(row.date,d);}
    return [...dates.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(d=>({...d,price:round(d.grossTotal/d.quantity,4)}));
  });
}
function changes(rows) {
  return series(rows,r=>JSON.stringify([r.supplierId,r.pointId,r.productId,r.unit])).filter(s=>s.length>=2).map(s=>{
    const a=s[s.length-2],b=s[s.length-1];
    return {...b,previousPrice:a.price,previousDate:a.date,delta:round(b.price-a.price,4),percent:round((b.price/a.price-1)*100)};
  });
}
function compare(rows,{groupId,unit,pointId,asOf,maxAgeDays=30}) {
  if(!asOf || !groupId || !unit) throw Error('Укажите дату, группу и единицу');
  const end=Date.parse(asOf);if(!Number.isFinite(end)||!Number.isFinite(maxAgeDays)||maxAgeDays<0)throw Error('Период');
  const filtered=rows.filter(r=>r.comparisonGroupId===groupId&&r.unit===unit&&(!pointId||r.pointId===pointId)&&Date.parse(r.date)<=end&&Date.parse(r.date)>=end-maxAgeDays*864e5);
  return series(filtered,r=>JSON.stringify([r.supplierId,r.productId,r.pointId,r.unit])).map(s=>s[s.length-1]).sort((a,b)=>a.price-b.price);
}
function potentialSaving(current,best,qty) {
  if(current.comparisonGroupId!==best.comparisonGroupId||current.unit!==best.unit||current.pointId!==best.pointId)throw Error('Несопоставимые позиции');
  return round(Math.max(0,current.price-best.price)*positive(qty,'Объем'));
}
module.exports={quantity,linePrice,invoiceKey,observations,changes,compare,potentialSaving};

window.supplyAnalytics=module.exports;
