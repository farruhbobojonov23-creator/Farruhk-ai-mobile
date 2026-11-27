'use strict';
const {moneyOK}=require('./ocr-draft-parser');
function reviewedInvoice(draft, meta, rows, confirmation){
 if(confirmation!==true)throw Error('Подтверди сверку с оригиналом');
 if(!draft||draft.source!=='offline_ocr_draft')throw Error('Неизвестный формат черновика');
 const supplier=String(meta?.supplier??'').trim(),number=String(meta?.number??'').trim(),date=String(meta?.date??'');
 if(!supplier||!number||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('Проверь поставщика, номер и дату');
 const tax=meta.tax_status;if(!['included','excluded','unknown'].includes(tax))throw Error('Укажи налоговую базу');
 if(!Array.isArray(rows)||!rows.length)throw Error('Нет товарных строк');
 const out=rows.map((r,i)=>{
  const name=String(r.name??'').trim();
  if(r.reviewed!==true||!name||!['кг','шт','л'].includes(r.unit)||!Number.isFinite(r.factor)||r.factor<=0||!moneyOK(r.qty,r.price,r.amount))throw Error('Проверь строку '+(i+1));
  return {name,qty:r.qty,factor:r.factor,unit:r.unit,amount:r.amount,product_key:String(r.product_key??'').trim()};
 });
 const total=meta.total;
 const sum=out.reduce((n,r)=>n+Math.round(r.amount*100),0);
 if(meta.complete===true&&(!Number.isFinite(total)||Math.abs(Math.round(total*100)-sum)>1))throw Error('Итог накладной не совпадает с суммой строк');
 if(total!=null&&(!Number.isFinite(total)||total<0))throw Error('Некорректный итог');
 return {supplier,number,date,total:total??null,tax_status:tax,complete:meta.complete===true,source:'offline_ocr_reviewed',rows:out};
}
module.exports={reviewedInvoice};
