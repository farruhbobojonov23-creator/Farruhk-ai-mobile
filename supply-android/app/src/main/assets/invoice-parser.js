(function(root){
'use strict';
const clean=s=>String(s||'').replace(/[\u00a0\u202f]/g,' ').replace(/[ \t]+/g,' ').trim();
const number=s=>{if(!s)return null;const n=Number(s.replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)&&n>0?n:null;};
const money='(?:\\d{1,3}(?: \\d{3})+|\\d+)[,.]\\d{2}';
const qty='(?:\\d+(?:[,.]\\d{1,5})?)';
const units={'кг':'кг','г':'г','л':'л','мл':'мл','шт':'шт','уп':'уп','кор':'кор'};
const date=(day,month,year)=>{const d=year+'-'+month.padStart(2,'0')+'-'+day.padStart(2,'0');return Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d?d:null;};
const suppliers=[['ООО «Вирго»',/\b(?:вирго)\b/i],['ООО «Веста»',/\b(?:веста)\b/i],['Восток-Запад',/восток\s*[-–]?\s*запад/i],['ИП Османова',/ип\s+османова/i]];
function parse(text){
 const lines=String(text||'').split(/\r?\n/).map(clean).filter(Boolean);
 const all=lines.join('\n');const out={number:null,date:null,supplier:null,total:null,items:[],warnings:[]};
 const heads=[...all.matchAll(/(?:товарно[- ]транспортная\s+накладная|товарная\s+накладная|накладная|сч[её]т[- ]фактура|упд)\s*(?:№|N[oо]?\.?)?\s*([А-Яа-яA-Za-z0-9\/-]{1,40})\s+(?:от\s*)?(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/gi)];
 const keys=[...new Set(heads.map(h=>JSON.stringify([h[1],date(h[2],h[3],h[4])])))];if(keys.length===1){[out.number,out.date]=JSON.parse(keys[0]);if(!out.date)out.number=null;}
 const found=new Set();
 for(const l of lines){const x=l.toLowerCase();if(/(?:^|[^а-яё])вирго(?:$|[^а-яё])/.test(x))found.add('ООО «Вирго»');if(/(?:^|[^а-яё])веста(?:$|[^а-яё])/.test(x))found.add('ООО «Веста»');if(suppliers[2][1].test(x))found.add('Восток-Запад');if(suppliers[3][1].test(x))found.add('ИП Османова');}
 if(found.size===1)out.supplier=[...found][0];
 const totals=[];const totalRe=new RegExp('(?:всего к оплате|итого к оплате|всего по накладной|всего к оплате с ндс)\\s*[:=]?\\s*('+money+')\\s*(?:руб\\.?|₽)?$','i');
 for(const l of lines){const m=l.match(totalRe);if(m)totals.push(number(m[1]));}
 const unique=[...new Set(totals.filter(Boolean))];if(unique.length===1)out.total=unique[0];
 // Accept simple rows ONLY when quantity × gross unit price = gross line total.
 // Multi-column VAT tables or unreadable rows are never silently guessed.
 const rowRe=new RegExp('^(?:\\d{1,3}[.)]?\\s+)?(.{3,180}?)\\s+(кг|мл|г|л|шт|уп|кор)\\.?\\s+('+qty+')\\s+('+money+')\\s+('+money+')\\s*$','i');
 for(const l of lines){if(/^(?:итого|всего|ндс|сумма|цена|количество)/i.test(l))continue;const m=l.match(rowRe);if(!m)continue;
  const q=number(m[3]),p=number(m[4]),t=number(m[5]);if(!q||!p||!t||Math.abs(q*p-t)>Math.max(.02,q*.005+.01))continue;
  out.items.push({productId:m[1].trim(),comparisonGroupId:'',quantity:q,unit:units[m[2].toLowerCase()],grossTotal:t,source:l});
 }
 if(!out.items.length)out.warnings.push('Табличные строки не распознаны надёжно. Заполните по оригиналу.');
 if(out.items.some(x=>['уп','кор'].includes(x.unit)))out.warnings.push('Уточните фасовку упаковок.');
 if(out.items.length&&out.total!==null&&Math.abs(out.items.reduce((s,x)=>s+x.grossTotal,0)-out.total)>.02)out.warnings.push('Сумма предложенных строк не совпадает с итогом: возможны пропущенные строки.');
 return out;
}
const api={parse};if(typeof module==='object'&&module.exports)module.exports=api;else root.supplyInvoiceParser=api;
})(globalThis);
