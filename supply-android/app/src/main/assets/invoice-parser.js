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
 const months=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
 const named=new RegExp('(?:^|\\s)([А-Яа-яA-Za-z0-9/-]*\\d[А-Яа-яA-Za-z0-9/-]*)\\s+(?:от\\s*)?(\\d{1,2})\\s+('+months.join('|')+')\\s+(\\d{4})(?:\\s|$|[.,])','gi');
 const candidates=[];
 for(const l of lines){for(const m of l.matchAll(named)){const d=date(m[2],String(months.indexOf(m[3].toLowerCase())+1),m[4]);if(d)candidates.push([m[1],d]);}}
 const namedKeys=[...new Set(candidates.map(x=>JSON.stringify(x)))];
 if(!out.number&&namedKeys.length===1){[out.number,out.date]=JSON.parse(namedKeys[0]);out.warnings.push('Номер и дата предложены по текстовой дате; проверьте шапку документа.');}
 const found=new Set();
 for(const l of lines){const x=l.toLowerCase();if(/(?:^|[^а-яё])вирго(?:$|[^а-яё])/.test(x))found.add('ООО «Вирго»');if(/(?:^|[^а-яё])веста(?:$|[^а-яё])/.test(x))found.add('ООО «Веста»');if(suppliers[2][1].test(x))found.add('Восток-Запад');if(suppliers[3][1].test(x))found.add('ИП Османова');}
 if(found.size===1)out.supplier=[...found][0];
 const totals=[];const totalRe=new RegExp('(?:всего к оплате|итого к оплате|всего по накладной|всего к оплате с ндс)\\s*[:=]?\\s*('+money+')\\s*(?:руб\\.?|₽)?$','i');
 for(const l of lines){const m=l.match(totalRe);if(m)totals.push(number(m[1]));}
 const unique=[...new Set(totals.filter(Boolean))];if(unique.length===1)out.total=unique[0];
 // Accept simple rows ONLY when quantity × gross unit price = gross line total.
 // Multi-column VAT tables or unreadable rows are never silently guessed.
 const rowRe=new RegExp('^(?:\\d{1,3}[.)]?\\s+)?(.{3,180}?)\\s+(кг|мл|г|л|шт|уп|кор)\\.?\\s+('+qty+')\\s+('+money+')\\s+('+money+')\\s*$','i');
 for(const l of lines){if(/^(?:итого|всего|ндс|сумма|цена|количество)/i.test(l))continue;const m=l.replace(/^[|│]+\s*/,'').replace(/\s*[|│]\s*/g,' ').replace(/\s+/g,' ').trim().match(rowRe);if(!m)continue;
  const q=number(m[3]),p=number(m[4]),t=number(m[5]);if(!q||!p||!t||Math.abs(q*p-t)>Math.max(.02,q*.005+.01))continue;
  out.items.push({productId:m[1].trim(),comparisonGroupId:'',quantity:q,unit:units[m[2].toLowerCase()],grossTotal:t,source:l});
 }

 const vatRe=new RegExp('^(?:\\d{1,3}[.)]?\\s+)?(.{3,180}?)\\s+(?:\\d{3}\\s+)?(кг|мл|г|л|шт|уп|кор)\\.?\\s+('+qty+')\\s+('+money+')\\s+('+money+')\\s+(?:(?:без акциза|[-–]|х|x)\\s+)?(\\d{1,2})\\s*%\\s+('+money+')\\s+('+money+')\\s*$','i');
 for(const l of lines){
  if(/^(?:итого|всего|ндс|сумма|цена|количество)/i.test(l))continue;
  const v=l.replace(/[|│]/g,' ').replace(/\s+/g,' ').trim().match(vatRe);if(!v)continue;
  const q=number(v[3]),price=number(v[4]),net=number(v[5]),rate=Number(v[6]),tax=number(v[7]),gross=number(v[8]);
  if(q&&price&&net&&tax&&gross&&rate>0&&rate<=30&&Math.abs(q*price-net)<=Math.max(.02,q*.005+.01)&&Math.abs(net*rate/100-tax)<=.02&&Math.abs(net+tax-gross)<=.02){
   out.items.push({productId:v[1].trim(),comparisonGroupId:'',quantity:q,unit:units[v[2].toLowerCase()],grossTotal:gross,source:l});
  }
 }
 if(!out.items.length)out.warnings.push('Табличные строки не распознаны надёжно. Обрежьте скриншот до самой накладной или заполните по оригиналу.');
 // Preserve legible product fragments as editable suggestions only; never infer quantities, units or prices from damaged OCR.
 out.fragments=[];
 const quantityHintRe=/(?:^|\s)(\d{1,6}[.,:]\d{3})\s+\d+[.,]\d{2}(?:\s|$)/;

 for(const l of lines){if(out.items.some(x=>x.source===l))continue;const m=l.match(/^\s*[|│]?\s*(?:\d{1,3}[.)]\s*)?((?:рис|лебеди|соус|сыр|креветк\w*|майонез|форель|лосось|угорь|нори|имбирь|васаби|кунжут|краб\w*|маскарпоне|сливки|омлет|куриц\w*)[а-яёa-z0-9% .,/()\-]{2,100})/iu);if(!m)continue;let name=m[1].split(/\s+\d+[,.]\d{2,}|\s+[;|│]|\s+-\s+/)[0].trim();if(name.length>=4&&!out.fragments.some(x=>x.productId===name)){const tail=l.match(new RegExp('('+money+')\\s*[|│]?\\s*$'));const qm=l.match(quantityHintRe);const qHint=qm?number(qm[1].replace(':','.')):null;
 const previous=out.fragments[out.fragments.length-1];
 const continuation=/^(?:[А-ЯЁA-Z]+\s+){1,5}(?:меш(?:ок)?|уп(?:ак)?|кор(?:об)?)\s*[/\\-]?\s*\d+\s*(?:кг|г|л|мл|шт)\.?$/iu.test(l)&&!tail&&!qHint;
 if(continuation&&previous&&previous.amountHint&&lines.indexOf(l)===lines.indexOf(previous.source)+1&&/^(?:рис|сыр|соус|мука|сахар)\s/i.test(previous.productId)){
   previous.productId+=' '+l;previous.source+=' / '+l;previous.joinedHint=true;
 }else{out.fragments.push({productId:name,source:l,amountHint:tail?number(tail[1]):null,quantityHint:qHint});}}}
 if(out.fragments.length)out.warnings.push('Найдены неполные названия: количество и цены оставлены пустыми.');
 if(out.items.some(x=>['уп','кор'].includes(x.unit)))out.warnings.push('Уточните фасовку упаковок.');
 if(out.items.length&&out.total!==null&&Math.abs(out.items.reduce((s,x)=>s+x.grossTotal,0)-out.total)>.02)out.warnings.push('Сумма предложенных строк не совпадает с итогом: возможны пропущенные строки.');
 return out;
}
const api={parse};if(typeof module==='object'&&module.exports)module.exports=api;else root.supplyInvoiceParser=api;
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const clean=s=>String(s||'').replace(/[\u00a0\u202f]/g,' ').trim();
const val=s=>Number(s.replace(/\s/g,'').replace(',','.'));
function parseSimple(text){
 const rows=String(text||'').split(/\r?\n/).map(clean).filter(Boolean),legacy=api.parse(text);
 const explicit=[...new Set(rows.map(l=>l.match(/^(?:поставщик|продавец)\s*[:=]\s*(.+)$/i)).filter(Boolean).map(m=>m[1].split(/(?:[,;]\s*|\s+)(?:ИНН|КПП|адрес|ОГРН)(?:\s|:)/iu)[0].trim()))];
 const supplier=explicit.length===1?explicit[0]:explicit.length?'':legacy.supplier||'';
 const items=[],seen=new Set();
 function add(name,price,source){name=clean(name);if(!name)return;const key=name.toLowerCase()+'|'+(price??'')+'|'+source;if(seen.has(key))return;seen.add(key);items.push({name,price,source,uncertain:true});}
 for(const x of legacy.items){
   const vat=x.source.match(/(?:^|\s)(\d{1,2})\s*%\s+(?:\d[\d ]*[,.]\d{2})\s+(?:\d[\d ]*[,.]\d{2})\s*$/);
   const price=Math.round(x.grossTotal/x.quantity/(vat?1+Number(vat[1])/100:1)*100)/100;
   add(x.productId+' / '+x.unit+(vat?' (без НДС)':''),price,x.source);
 }
 const header=rows.some(l=>/(?:товар|наименование)/i.test(l)&&/цен[аы]/i.test(l)&&!/(?:сумм|количеств|ндс|стоимост)/i.test(l))&&!rows.some(l=>/(?:товар|наименование)/i.test(l)&&/(?:сумм|количеств|ндс|стоимост)/i.test(l));
 if(header)for(const l of rows){
   if(legacy.items.some(x=>x.source===l)||/^(?:итого|всего|ндс|сумма|цена|количество|поставщик|продавец|накладная|номер|дата|товар\s*цена)/i.test(l))continue;
   const m=l.replace(/[|│]/g,' ').trim().match(/^(?:\d{1,3}[.)]?\s+)?([^\d].*?)\s+((?:\d{1,3}(?: \d{3})+|\d+)[,.]\d{2})\s*(?:₽|руб\.?)?$/i);
   if(m&&/[а-яёa-z]/i.test(m[1])&&!/(?:ИНН|КПП|ОГРН)/i.test(m[1]))add(m[1],val(m[2]),l);
 }
 for(const x of legacy.fragments||[])if(!items.some(y=>y.source===x.source||y.name.toLowerCase().startsWith(x.productId.toLowerCase())))add(x.productId,null,x.source);
 return {supplier,items};
}
api.parseSimple=parseSimple;
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const original=api.parseSimple;
api.parseSimple=function(text){
 const raw=String(text||'');
 const normalized=raw.replace(/[\u00a0\u202f]/g,' ').replace(/[|│]/g,' ')
 .replace(/(\d)[ ]*,[ ]*(\d{2,5})(?!\d)/g,'$1,$2')
 .replace(/(?:^|\s)(?:796|166|112|113|163|111)\s+(шт|кг|л|г|мл|уп|кор)\.?(?=\s|$)/gi,' $1')
 .replace(/(шт|кг|л|г|мл|уп|кор)\.?\s+(?:796|166|112|113|163|111)(?=\s|$)/gi,'$1')
 .replace(/(без\s+акциза|без\s+ндс)/gi,m=>m.toLowerCase());
 const base=original(normalized);
 const lines=normalized.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 const unit=/(?:^|\s)(?:кг|мл|г|л|шт|уп|кор)\.?(?=\s|$)/i;
 const stop=/^(?:итого|всего|ндс|сумма|цена|количество|поставщик|продавец|покупатель|грузо|накладная|адрес|инн|кпп|основание)/i;
 const all=base.items.slice();
 // Join adjacent numeric fragments only where a complete row passes quantity/price/total checks.
 for(let i=0;i<lines.length;i++){
  const first=lines[i];
  if(stop.test(first)||!/[а-яёa-z]/i.test(first)||first.length>180)continue;
  for(let j=i+1;j<=Math.min(i+3,lines.length-1);j++){
   const part=lines[j];
   if(stop.test(part)||!/^[\d\s,.%:|xх–—-]+$|^(?:(?:796|166|112|113|163|111)\s+)?(?:кг|мл|г|л|шт|уп|кор)\.?(?:\s|$)|^без акциза(?:\s|$)/i.test(part))break;
   const joined=lines.slice(i,j+1).join(' ');
   if(!unit.test(joined))continue;
   const parsed=original(joined).items.filter(x=>x.price!=null);
   if(parsed.length===1){const item=parsed[0];if(!all.some(x=>x.price!=null&&x.name.toLowerCase()===item.name.toLowerCase()))all.push(item);i=j;break;}
  }
 }
 const priced=all.filter(x=>x.price!=null);
 return {supplier:base.supplier,items:all.filter(x=>x.price!=null||!priced.some(y=>y.source.startsWith(x.source+' ')||y.source===x.source||y.name.toLowerCase().startsWith(x.name.toLowerCase())))};
};
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const previous=api.parseSimple;
const money='(?:\\d{1,3}(?: \\d{3})+|\\d+)[,.]\\d{2}';
const n=s=>Number(s.replace(/\s/g,'').replace(',','.'));
const stop=/^(?:итого|всего|ндс|сумма|стоимость|цена|количество|поставщик|продавец|покупатель|грузо|накладная|адрес|инн|кпп|основание|подпись|руководитель|бухгалтер|счет|счёт|наименование)/i;
api.parseSimple=function(text){
 const normalized=String(text||'').replace(/[\u00a0\u202f]/g,' ').replace(/[ \t]+/g,' ')
 .replace(/(?:^|\s)(?:упак(?:овка)?|пач(?:ка)?|пак(?:ет)?)\.?(?=\s+\d)/gi,' уп')
 .replace(/(?:^|\s)(?:короб(?:ка)?|ящик)\.?(?=\s+\d)/gi,' кор')
 .replace(/(?:^|\s)(?:штук(?:а)?|ед(?:иница)?)\.?(?=\s+\d)/gi,' шт');
 // Correct OCR unit aliases and a possible table-border digit only with independent arithmetic checks.
 const corrected=normalized.replace(/(^|[ \t])(?:[kк][rгg]|[kк][tт])\.?(?=[ \t]+\d+(?:[,.]\d{1,5})?[ \t])/giu,'$1кг');
 const vatLine=new RegExp('^(.*?\\s(?:кг|мл|г|л|шт|уп|кор)\\.?\\s+)(\\d+(?:[,.]\\d{1,5})?)\\s+(1\\d+[,.]\\d{2})\\s+('+money+')\\s+(?:(?:без акциза|[-–]|х|x)\\s+)?(\\d{1,2})\\s*%\\s+('+money+')\\s+('+money+')\\s*$','i');
 const repaired=corrected.split(/\r?\n/).map(row=>{
  const l=row.replace(/[|│]/g,' ').replace(/[ \t]+/g,' ').trim(),m=l.match(vatLine);
  if(!m)return row;
  const q=n(m[2]),p=n(m[3]),candidate=n(m[3].slice(1)),net=n(m[4]),rate=Number(m[5]),tax=n(m[6]),gross=n(m[7]);
  const tol=Math.max(.02,q*.005+.01);
  if(q>0&&candidate>0&&rate>0&&rate<=30&&Math.abs(q*p-net)>tol&&Math.abs(q*candidate-net)<=tol&&Math.abs(net*rate/100-tax)<=.02&&Math.abs(net+tax-gross)<=.02)return l.replace(m[1]+m[2]+' '+m[3],m[1]+m[2]+' '+m[3].slice(1));
  return row;
 }).join('\n');
 const base=previous(repaired), lines=repaired.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 const items=base.items.slice();
 const head=lines.findIndex((l,i)=>/(?:наименование|товар)/i.test(l)&&/цен[аы]/i.test(lines.slice(i,i+5).join(' ')));
 if(head<0)return base;
 const exact=new RegExp('^(?:\\d{1,4}[.)]?\\s+)?(.{3,180}?)\\s+(?:\\d{3}\\s+)?(кг|мл|г|л|шт|уп|кор)\\.?\\s+(\\d+(?:[,.]\\d{1,5})?)\\s+('+money+')\\s+('+money+')(?:\\s+(?:без акциза|без ндс|[-–—xх]))?\\s*$', 'i');
 const incomplete=new RegExp('^\\s*(?:\\d{1,4}[.)]?\\s+)?(.{3,180}?)\\s+(?:\\d{3}\\s+)?(кг|мл|г|л|шт|уп|кор)\\.?\\s+(\\d+(?:[,.]\\d{1,5})?)(?:\\s|$)','i');
 function add(name,price,source){
  name=name.trim().replace(/\s+/g,' ');
  if(!/[а-яёa-z]{2}/i.test(name)||stop.test(name))return;
  const key=name.toLowerCase();
  if(items.some(x=>x.source===source&&x.price!=null||x.name.toLowerCase()===key&&x.price!=null))return;
  for(let i=items.length-1;i>=0;i--)if(items[i].price==null&&(items[i].source===source||items[i].name.toLowerCase()===key))items.splice(i,1);
  if(!items.some(x=>x.name.toLowerCase()===key&&x.price===price))items.push({name,price,source,uncertain:true});
 }
 for(let i=head+1;i<lines.length;i++){
   const l=lines[i].replace(/[|│]/g,' ').replace(/\s+/g,' ').trim();
   if(/^(?:всего к оплате|итого|всего по|руководитель|бухгалтер|подпись)/i.test(l))break;
   if(stop.test(l))continue;
   const m=l.match(exact);
   if(m){const q=n(m[3]),p=n(m[4]),total=n(m[5]);if(q>0&&p>0&&Math.abs(q*p-total)<=Math.max(.02,q*.005+.01)){add(m[1]+' / '+m[2].toLowerCase(),p,l);continue;}}
   const f=l.match(incomplete);
   if(f&&!items.some(x=>x.source===l||x.name.toLowerCase().startsWith(f[1].toLowerCase())))add(f[1]+' / '+f[2].toLowerCase(),null,l);
 }
 return {supplier:base.supplier,items};
};
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const previous=api.parseSimple;
const positive=v=>{const n=Number(String(v??'').replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)&&n>0?n:null};
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
function packWeight(name){
 const product=String(name||'').replace(/\s*\/\s*(?:кг|г|л|мл|шт|уп|кор)(?:\s+\(без НДС\))?$/i,'');
 if(/\d\s*[xх×*]\s*\d/i.test(product))return null;
 const matches=[...product.matchAll(/(?:^|[^\d.,])(\d+(?:[,.]\d+)?)\s*(кг|г)(?=$|[^а-яёa-z0-9])/gi)];
 if(matches.length!==1)return null;
 const amount=positive(matches[0][1]);return amount?amount/(matches[0][2].toLowerCase()==='г'?1000:1):null;
}
function lineMetrics(row){
 const quantity=positive(row.quantity),price=positive(row.price),packKg=positive(row.packKg),unit=row.unit||'';
 const kgPerUnit=unit==='кг'?1:unit==='г'?.001:['шт','уп','кор'].includes(unit)?packKg:null;
 const kg=quantity&&kgPerUnit?Math.round(quantity*kgPerUnit*1000000)/1000000:null;
 return {totalKg:kg,pricePerKg:price&&kgPerUnit?round(price/kgPerUnit):null,totalPrice:quantity&&price?round(quantity*price):null};
}
api.packWeight=packWeight;api.lineMetrics=lineMetrics;
api.parseSimple=function(text){
 const result=previous(text);
 for(const item of result.items){
  const unitMatch=item.name.match(/\s*\/\s*(кг|г|л|мл|шт|уп|кор)(?:\s+\(без НДС\))?$/i);
  if(!unitMatch)continue;
  item.unit=unitMatch[1].toLowerCase();
  if(['шт','уп','кор'].includes(item.unit))item.packKg=packWeight(item.name);
  if(item.price==null)continue;
  const source=String(item.source||'').replace(/[|│]/g,' ').replace(/\s+/g,' ');
  const row=source.match(/(?:^|\s)(кг|г|л|мл|шт|уп|кор)\.?\s+(\d+(?:[,.]\d{1,5})?)\s+((?:\d{1,3}(?: \d{3})+|\d+)[,.]\d{2})(?=\s|$)/gi);
  if(row&&row.length===1){
   const p=row[0].trim().match(/^(кг|г|л|мл|шт|уп|кор)\.?\s+(\d+(?:[,.]\d{1,5})?)\s+(.+)$/i);
   if(p&&p[1].toLowerCase()===item.unit&&Math.abs(positive(p[3])-item.price)<.011)item.quantity=positive(p[2]);
  }
  Object.assign(item,lineMetrics(item));
 }
 return result;
};
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const original=api.parseSimple;
// Accept a common invoice order: quantity then unit (3 шт or 3шт).
// Normalize only a row ending in two monetary columns; the existing arithmetic gate remains.
api.parseSimple=function(text){
 const normalized=String(text||'').split(/\r?\n/).map(line=>{
  const s=line.replace(/[|│]/g,' ').replace(/[ \t]+/g,' ').trim();
  const m=s.match(/^(.{3,180}?)\s+(\d+(?:[,.]\d{1,5})?)\s*(шт|уп|кор|кг|г|л|мл)\.?\s+((?:\d{1,3}(?: \d{3})+|\d+)[,.]\d{2})\s+((?:\d{1,3}(?: \d{3})+|\d+)[,.]\d{2})$/i);
  if(!m)return line;
  const standard=original(s);
  if(standard.items.some(x=>x.price!=null))return line;
  if(!/[а-яёa-z]/i.test(m[1])||/^(?:итого|всего|ндс|сумма|цена|количество)/i.test(m[1]))return line;
  const n=v=>Number(v.replace(/\s/g,'').replace(',','.'));
  const q=n(m[2]),price=n(m[4]),total=n(m[5]);
  if(q<=0||price<=0||Math.abs(q*price-total)>Math.max(.02,q*.005+.01))return line;
  return [m[1],m[3],m[2],m[4],m[5]].join(' ');
 }).join('\n');
 return original(normalized);
};
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const original=api.parseSimple;
const num=s=>{s=String(s||'').replace(/\s/g,'');if(/,\d{3}\.\d{2}$/.test(s))s=s.replace(/,/g,'');else if(/\.\d{3},\d{2}$/.test(s))s=s.replace(/\./g,'').replace(',','.');else s=s.replace(',','.');return Number(s)};
const cash='(?:\\d{1,3}(?:[, .]\\d{3})+[.,]\\d{2}|\\d+[.,]\\d{2})';
const dec='\\d+(?:[.,]\\d{1,3})?';
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
api.parseSimple=function(text){
 const raw=String(text||''),flat=raw.replace(/[|│]/g,' ').replace(/\s+/g,' ');
 const isTtn=/товарно[-–\s]*транспортная\s+накладная/i.test(flat)||/товарный\s+раздел/i.test(flat);
 const layout=/сумма\s*с\s*ндс/i.test(flat)&&/количество\s+мест/i.test(flat)&&/масс[аы]\s+брутто/i.test(flat);
 if(!isTtn||!layout)return original(text);
 const b=original(text),supplier=/восток\s*[-–]?\s*запад/i.test(flat)?'Восток-Запад':b.supplier;
 const items=[];
 // TTN column order: product, article, shipping unit, OKEI, VAT rate, gross amount,
 // shipping quantity, gross mass. The gross mass is never used as net product weight.
 const row=new RegExp('^(?:\\d{1,3}[.)]?\\s+)?(.{3,260}?)\\s+(\\d{7,12})\\s+(шт|кг|уп|кор|[kк][rгg])\\.?\\s+(796|166|778)\\s+('+dec+')\\s*%?\\s+('+cash+')\\s+('+dec+')\\s+('+dec+')(?:\\s|$)','i');
 const lines=raw.split(/\r?\n/).map(l=>l.replace(/[|│]/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean);
 const stop=/^(?:итого|всего|подпись|руководитель|бухгалтер|масса груза|в том числе)/i;
 const names=[];
 for(let i=0;i<lines.length;i++){
  if(stop.test(lines[i]))continue;
  if(/^(?:наименование товара|товарный раздел|поставщик|грузо|покупатель|плательщик|основание|товарно[-–])/i.test(lines[i]))continue;
  for(let end=i;end<Math.min(i+5,lines.length);end++){
   if(end>i&&stop.test(lines[end]))break;
   const s=lines.slice(i,end+1).join(' ');
   if(s.length>420)break;
   const m=s.match(row);if(!m)continue;
   let name=m[1].trim().replace(/^\d{1,3}[.)]?\s*/,'');
   if(!/[а-яёa-z]{3}/i.test(name)||/наименование товара|порядковый|сумма с ндс|ставка ндс|количество мест|код окей/i.test(name))break;
   const unit=/^(?:кг|[kк][rгg])$/i.test(m[3])?'кг':m[3].toLowerCase(),code=m[4],rate=num(m[5]),total=num(m[6]),quantity=num(m[7]),grossMass=num(m[8]);
   if((unit==='кг'&&code!=='166')||(unit==='шт'&&code!=='796')||![0,5,7,10,20,22].includes(rate)||!(total>0&&quantity>0&&grossMass>0))break;
   // Names can wrap below the numeric cells; preserve a short plausible continuation.
   if(end+1<lines.length&&/^(?:\d+[,.]?\d*\s*к[гт]\s*\/\s*\d+\s*л|соленая\s+пищевая\s+рыбная\s+продукция)$/i.test(lines[end+1])){name+=' '+lines[++end]}
   name=name.replace(/(\d+(?:[,.]\d+)?)\s*кт(?=\s*\/\s*\d+\s*л)/gi,'$1кг');
   const packKg=['шт','уп','кор'].includes(unit)?api.packWeight(name):null;
   if(unit==='кг'&&grossMass+0.001<quantity||packKg&&grossMass+0.001<packKg*quantity)break;
   const price=round(total/quantity),item={name:name+' / '+unit+' (с НДС)',price,quantity,unit,packKg,uncertain:true,source:s,invoiceTotal:total,priceDerived:true};
   Object.assign(item,api.lineMetrics(item));item.totalPrice=total;
   if(!names.includes(m[2])){names.push(m[2]);items.push(item)}
   i=end;break;
  }
 }
 // A printed document total independently verifies all parsed rows when present.
 const totalMatch=flat.match(new RegExp('всего\\s+к\\s+оплате\\s*[:=]?\\s*('+cash+')','i'));
 if(totalMatch&&items.length&&Math.abs(items.reduce((sum,x)=>sum+x.invoiceTotal,0)-num(totalMatch[1]))>.02){for(const x of items){x.price=null;x.pricePerKg=null;x.totalPrice=null;}}
 return {supplier,items};
};
})(globalThis);
