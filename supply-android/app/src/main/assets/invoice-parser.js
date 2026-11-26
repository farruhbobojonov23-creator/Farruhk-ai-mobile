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
 return {totalKg:kg,pricePerKg:price&&kgPerUnit?round(price/kgPerUnit):null,totalPrice:positive(row.invoiceTotal)??(quantity&&price?round(quantity*price):null)};
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

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const old=api.parseSimple;
const num=s=>{s=String(s).replace(/\s/g,'');if(/,\d{3}\.\d{2}$/.test(s))s=s.replace(/,/g,'');else if(/\.\d{3},\d{2}$/.test(s))s=s.replace(/\./g,'').replace(',','.');else s=s.replace(',','.');return Number(s)};
const cash='(?:\\d{1,3}(?:[, .]\\d{3})+[.,]\\d{2}|\\d+[.,]\\d{2})',dec='\\d+(?:[.,]\\d{1,3})?';
const rx=new RegExp('(\\d{7,12})\\s+([а-яёa-z]{1,5})\\s+(796|166|778)\\s+('+dec+')\\s*[°%]?\\s+('+cash+')\\s+('+dec+')\\s+('+dec+')(?:\\s|$)','i');
const stop=/^(?:итого|всего|в том числе|подпись|масса|наименование|порядков|товар|измерения|количество|код|характеристики|отгрузки|непринятое)/i;
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
api.parseSimple=function(text){
 const raw=String(text||''),flat=raw.replace(/[|│]/g,' ').replace(/\s+/g,' ');
 const b=old(raw);
 // Use the OKEI unit code to recover a damaged unit glyph, but only on this known TTN table layout.
 const known=/восток\s*[-–]?\s*запад/i.test(flat)||b.supplier==='Восток-Запад';
 const table=/сумма\s*с\s*ндс/i.test(flat)&&/брутто/i.test(flat)&&/(?:океи|оке[мй]|товарно[-–\s]*транспортная|товарный раздел)/i.test(flat);
 if(!known||!table)return b;
 const lines=raw.split(/\r?\n/).map(l=>l.replace(/[|│]/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean);
 const items=[];
 for(let i=0;i<lines.length;i++){
  const l=lines[i],m=l.match(rx);if(!m)continue;
  const unit=({'796':'шт','166':'кг','778':'уп'})[m[3]],rate=num(m[4]),total=num(m[5]),quantity=num(m[6]),gross=num(m[7]);
  if(![0,5,7,10,20,22].includes(rate)||!(total>0&&quantity>0&&gross>=quantity))continue;
  let name=l.slice(0,m.index).replace(/^\s*\d{1,3}[.)]?\s+/,'').replace(/[—–]+\s*$/,'').trim();
  const prev=lines[i-1]||'',next=lines[i+1]||'';
  if(prev&&/[а-яёa-z]{3}/i.test(prev)&&!stop.test(prev)&&!rx.test(prev)&&!/\d{5,}/.test(prev)&&/^(?:майонез|форель|сыр|рис|креветк|соус|масло|мука|лосось|угорь)/i.test(prev)&&!/^(?:майонез|форель|сыр|рис|креветк|соус|масло|мука|лосось|угорь)/i.test(name))name=prev+' '+name;
  const pack=next.match(/^\s*(\d+(?:[.,]\d+)?)\s*к[гт]\s*\/\s*([0-9ОоO]+)\s*л(?:\s|$)/i);
  if(pack&&!api.packWeight(name))name+=' '+pack[1].replace('.',',')+'кг/'+pack[2].replace(/[ОоO]/g,'0')+'л';
  else if(/^(?:[A-Z]{1,3}\s+)?соленая пищевая рыбная продукция/i.test(next))name+=' соленая пищевая рыбная продукция';
  if(!/[а-яёa-z]{3}/i.test(name)||stop.test(name))continue;
  const packKg=unit==='кг'?null:api.packWeight(name);
  if(packKg&&gross+.001<quantity*packKg)continue;
  const x={name:name+' / '+unit+' (с НДС)',price:round(total/quantity),quantity,unit,packKg,uncertain:true,source:l,invoiceTotal:total,priceDerived:true,article:m[1]};
  Object.assign(x,api.lineMetrics(x));x.totalPrice=total;
  if(!items.some(y=>y.article===x.article))items.push(x);
 }
 if(!items.length)return b;
 const totalMatch=flat.match(new RegExp('всего\\s+к\\s+оплате\\s*[:=]?\\s*('+cash+')','i'));
 if(totalMatch&&Math.abs(items.reduce((s,x)=>s+x.invoiceTotal,0)-num(totalMatch[1]))>.02){for(const x of items){x.price=null;x.pricePerKg=null;x.totalPrice=null;}}
 // Keep a previous complete result if this stricter rescue found fewer valid rows.
 if(b.items.filter(x=>x.price!=null).length>items.filter(x=>x.price!=null).length)return b;
 return {supplier:'Восток-Запад',items};
};
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const prior=api.parseSimple;
const cash='(?:\\d{1,3}(?:[, .]\\d{3})+[.,]\\d{2}|\\d+[.,]\\d{2})',dec='\\d+(?:[.,]\\d{1,3})?';
const num=s=>{s=String(s).replace(/\s/g,'');if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf('.')>s.lastIndexOf(',')?s.replace(/,/g,''):s.replace(/\./g,'').replace(',','.');else s=s.replace(',','.');return Number(s)};
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const anchor=/^(.*\S)\s+(\d{7,12})\s+(кг|шт|уп|кор)(?:\s+(166|796|778))?\.?\s*$/i;
const values=new RegExp('^('+dec+')\\s*%?\\s+('+cash+')\\s+('+dec+')\\s+('+dec+')(?:\\s+[A-ZА-Я]-\\d+)?\\s*$','i');
const vatRe=new RegExp('^в\\s+том\\s+числе\\s+ндс\\s*[:=]?\\s+('+cash+')\\s*$','i');
const totalRe=new RegExp('^всего\\s+к\\s+оплате\\s*[:=]?\\s+('+cash+')\\s*$','i');
const stop=/^(?:поставщик|плательщик|грузо|товарная|товарно|накладная|наименование|количество|итого|всего|в том числе|подпись|масса|код|ставка|основание|покупатель)/i;
api.parseSimple=function(text){
 const raw=String(text||''),b=prior(raw);
 if(b.supplier!=='Восток-Запад'&&!/восток\s*[-–]?\s*запад/i.test(raw))return b;
 const lines=raw.split(/\r?\n/).map(l=>l.replace(/[|│]/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean);
 const items=[];
 for(let i=0;i<lines.length-1;i++){
  const m=lines[i].match(anchor),n=lines[i+1].match(values);if(!m||!n)continue;
  const unit=m[3].toLowerCase(),code=m[4],rate=num(n[1]),amount=num(n[2]),quantity=num(n[3]),gross=num(n[4]);
  if(code&&({кг:'166',шт:'796',уп:'778'})[unit]!==code)continue;
  if(![0,5,7,10,20,22].includes(rate)||!(amount>0&&quantity>0&&gross>0))continue;
  if(unit==='кг'&&gross+.001<quantity)continue;
  if(unit!=='кг'&&!Number.isInteger(quantity))continue;
  let name=m[1].replace(/^\d{1,3}[.)]?\s+/,'').trim();
  const prev=lines[i-1]||'',next=lines[i+2]||'';
  // Only join a preceding product name already identified by the earlier parser.
  if(prev&&!stop.test(prev)&&b.items.some(x=>x.name===prev||x.name.startsWith(prev+' /'))&&!name.toLowerCase().startsWith(prev.toLowerCase()))name=prev+' '+name;
  if(/^сол[её]ная пищевая рыбная продукция$/i.test(next))name+=' '+next;
  else if(/^\d+(?:[.,]\d+)?\s*кг\s*\/\s*\d+\s*л$/i.test(next)&&!api.packWeight(name))name+=' '+next;
  if(!/[а-яёa-z]{3}/i.test(name)||stop.test(name))continue;
  const packKg=unit==='кг'?null:api.packWeight(name);
  if(packKg&&gross+.001<packKg*quantity)continue;
  if(items.some(x=>x.article===m[2]))continue;
  const x={name:name+' / '+unit+' (с НДС)',price:round(amount/quantity),unit,quantity,packKg,invoiceTotal:amount,priceDerived:true,uncertain:true,article:m[2],source:lines.slice(Math.max(0,i-1),i+3).join('\n')};
  Object.assign(x,api.lineMetrics(x));x.totalPrice=amount;items.push({x,vat:round(amount*rate/(100+rate))});
 }
 if(!items.length)return b;
 // When the heading or OKEI column is missing, validate against the independent
 // VAT total or the document payment total before using any recovered numbers.
 const vats=lines.map(l=>l.match(vatRe)).filter(Boolean).map(m=>num(m[1]));
 const totals=lines.map(l=>l.match(totalRe)).filter(Boolean).map(m=>num(m[1]));
 const amount=items.reduce((s,z)=>s+z.x.invoiceTotal,0),tax=items.reduce((s,z)=>s+z.vat,0);
 const vatOK=vats.length===1&&Math.abs(vats[0]-tax)<=.02;
 const totalOK=totals.length===1&&Math.abs(totals[0]-amount)<=.02;
 if((vats.length&&!vatOK)||(totals.length&&!totalOK)||(!vatOK&&!totalOK))return b;
 const recovered=items.map(z=>z.x);
 if(b.items.filter(x=>x.price!=null).length>=recovered.length)return b;
 return {supplier:'Восток-Запад',items:recovered};
};
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const previous=api.parseSimple;
const cash='(?:\\d{1,3}(?:[, .]\\d{3})+[.,]\\d{2}|\\d+[.,]\\d{2})',dec='\\d+(?:[.,]\\d{1,3})?';
const num=s=>{s=String(s).replace(/\s/g,'');if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf('.')>s.lastIndexOf(',')?s.replace(/,/g,''):s.replace(/\./g,'').replace(',','.');else s=s.replace(',','.');return Number(s)};
const tail=new RegExp('^(.+?)\\s+(\\d{7,12})\\s+(кг|шт|уп|кор)(?:\\s+(166|796|778))?\\s+('+dec+')\\s*%?\\s+('+cash+')\\s+('+dec+')\\s+('+dec+')(?:\\s+[A-ZА-Я]-\\d+)?\\s*$','i');
const anchor=/^(.+?)\s+(\d{7,12})\s+(кг|шт|уп|кор)(?:\s+(166|796|778))?\s*$/i;
const values=new RegExp('^('+dec+')\\s*%?\\s+('+cash+')\\s+('+dec+')\\s+('+dec+')(?:\\s+[A-ZА-Я]-\\d+)?\\s*$','i');
const vat=new RegExp('^в\\s+том\\s+числе\\s+ндс\\s*[:=]?\\s+('+cash+')\\s*$','i'),total=new RegExp('^всего\\s+к\\s+оплате\\s*[:=]?\\s+('+cash+')\\s*$','i');
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
const clean=s=>String(s).split(/\r?\n/).map(x=>x.replace(/[|│]/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean);
const stop=/^(?:поставщик|плательщик|грузо|товарная|товарно|накладная|наименование|количество|итого|всего|в том числе|подпись|масса|код|ставка|основание|покупатель)/i;
const collect=(lines,re)=>[...new Set(lines.map(l=>l.match(re)).filter(Boolean).map(m=>num(m[1])))];
function recover(text,context){
 const b=previous(text);if(b.supplier!=='Восток-Запад')return b;
 const lines=clean(text),items=[];
 for(let i=0;i<lines.length;i++){
  let m=lines[i].match(tail),last=i;
  if(!m){const x=lines[i].match(anchor),y=(lines[i+1]||'').match(values);if(x&&y){m=[lines[i]+' '+lines[i+1],...x.slice(1),...y.slice(1)];last=i+1;}}
  if(!m)continue;
  let name=m[1].replace(/^\d{1,3}[.)]?\s+/,'').trim();
  const prev=lines[i-1]||'',next=lines[last+1]||'';
  if(prev&&!stop.test(prev)&&b.items.some(x=>x.name===prev||x.name.startsWith(prev+' /'))&&!name.toLowerCase().startsWith(prev.toLowerCase()))name=prev+' '+name;
  if(/^сол[её]ная пищевая рыбная продукция$/i.test(next))name+=' '+next;
  else if(/^\d+(?:[.,]\d+)?\s*к[гт]\s*\/\s*[0-9ОоO]+\s*л$/i.test(next)&&!api.packWeight(name))name+=' '+next.replace(/кт/ig,'кг').replace(/[ОоO](?=л)/g,'0');
  if(stop.test(name)||!/[а-яёa-z]{3}/i.test(name))continue;
  const unit=m[3].toLowerCase(),code=m[4],rate=num(m[5]),amount=num(m[6]),quantity=num(m[7]),gross=num(m[8]);
  if(code&&({кг:'166',шт:'796',уп:'778'})[unit]!==code)continue;
  if(![0,5,7,10,20,22].includes(rate)||!(amount>0&&quantity>0&&gross>0))continue;
  const packKg=unit==='кг'?null:api.packWeight(name);
  if(unit==='кг'&&gross+.001<quantity||unit!=='кг'&&!Number.isInteger(quantity)||packKg&&gross+.001<packKg*quantity)continue;
  if(items.some(z=>z.x.article===m[2]))continue;
  const x={name:name+' / '+unit+' (с НДС)',unit,quantity,packKg,price:round(amount/quantity),invoiceTotal:amount,priceDerived:true,uncertain:true,article:m[2],source:lines.slice(i,last+1).join('\n')};
  Object.assign(x,api.lineMetrics(x));x.totalPrice=amount;items.push({x,tax:round(amount*rate/(100+rate))});
  i=last;
 }
 if(!items.length)return b;
 const gross=items.reduce((s,z)=>s+z.x.invoiceTotal,0),tax=items.reduce((s,z)=>s+z.tax,0);
 const vs=collect(lines,vat),ts=collect(lines,total);
 // A footer read by another pass of this same image can independently verify a row.
 const cv=context?.vat||[],ct=context?.total||[];
 const vv=vs.length?vs:cv,tt=ts.length?ts:ct;
 const vok=vv.length===1&&Math.abs(vv[0]-tax)<=.02,tok=tt.length===1&&Math.abs(tt[0]-gross)<=.02;
 if((vv.length&&!vok)||(tt.length&&!tok)||(!vok&&!tok))return b;
 const recovered=items.map(z=>z.x);
 if(b.items.filter(x=>x.price!=null).length>=recovered.length)return b;
 return {supplier:b.supplier,items:recovered};
}
api.parseSimple=text=>recover(text,null);
api.parseSamePhotoPasses=function(texts){
 const originals=texts.filter(x=>typeof x==='string'&&x.trim());
 const suppliers=[...new Set(originals.map(x=>previous(x).supplier).filter(Boolean))];
 const all=originals.flatMap(clean);
 const context={vat:collect(all,vat),total:collect(all,total)};
 return originals.map(text=>{
  let raw=text;
  if(suppliers.length===1&&!previous(text).supplier)raw='Поставщик: '+suppliers[0]+'\n'+text;
  return recover(raw,suppliers.length===1?context:null);
 });
};
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const parse=api.parseSimple,passes=api.parseSamePhotoPasses;
const key=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
function enrich(r,texts){
 if(r.supplier!=='Восток-Запад')return r;
 const result={...r,items:r.items.map(x=>{
  if(x.packKg||!['шт','уп','кор'].includes(x.unit)||x.price==null)return x;
  const evidence=[];
  const amount=s=>Number(String(s).replace(/\s/g,'').replace(',','.'));
  const money=s=>{s=s.replace(/\s/g,'');if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf('.')>s.lastIndexOf(',')?s.replace(/,/g,''):s.replace(/\./g,'').replace(',','.');else s=s.replace(',','.');return Number(s)};
  const identity=key(x.name.replace(/\s*\/\s*(?:шт|уп|кор)(?:\s+\(с НДС\))?$/i,''));
  const article=x.article&&/^\d{7,12}$/.test(String(x.article))?new RegExp('(?:^|\\D)'+x.article+'(?:\\D|$)'):null;
  for(const raw of texts){
   const lines=String(raw||'').split(/\r?\n/).map(l=>l.replace(/[|│]/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean);
   const totals=lines.map(l=>l.match(/^всего\s+к\s+оплате\s*[:=]?\s+([\d ,.]+)\s*$/i)).filter(Boolean).map(m=>money(m[1]));
   const singleVerified=r.items.length===1&&x.invoiceTotal>0&&totals.length>0&&totals.every(v=>Math.abs(v-x.invoiceTotal)<.011);
   for(let i=0;i<lines.length;i++){
    const byArticle=article&&article.test(lines[i]);
    const byName=singleVerified&&identity.length>=8&&key(lines[i].replace(/^\d{1,3}[.)]?\s+/,'' )).startsWith(identity);
    if(!byArticle&&!byName)continue;
    const before=byArticle?lines[i].split(String(x.article))[0]:lines[i];
    const near=[before];
    for(let j=i+1;j<=Math.min(i+7,lines.length-1);j++){
     const line=lines[j];
     if(/^(?:итого|всего|в том числе|масса|подпись|товарная|поставщик|грузо|наименование)/i.test(line)||/\d{7,12}/.test(line))break;
     // A continuation may also include the shipping count, gross weight and unused columns.
     const mixed=line.match(/^(\d+(?:[.,]\d+)?\s*к[гт]\s*\/\s*[0-9ОоO]+\s*л)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)(?:\s+[xх\-–—]+)*\s*$/i);
     if(mixed){
      const normalized=mixed[1].replace(/кт/ig,'кг').replace(/[ОоO](?=л)/g,'0');
      const kg=api.packWeight(normalized),qty=amount(mixed[2]),gross=amount(mixed[3]);
      if(kg&&qty===x.quantity&&gross+.001>=kg*qty)evidence.push({kg,text:normalized});
      continue;
     }
     if(byArticle&&/^\d+(?:[.,]\d+)?\s*(?:кг|кт|г)(?:\s*\/\s*[0-9ОоO]+\s*л)?\s*$/i.test(line))near.push(line);
     else if(byArticle&&/^(?:запекания|для запекания|с массовой долей жирности)/i.test(line))near.push(line);
     else if(/^(?:\d{1,3}[.)]?\s+)?(?:майонез|сыр|рис|форель|лосось|креветк|соус|масло|мука|нори|угорь|сливки)\s/i.test(line))break;
    }
    for(const s of near){
     if(!byArticle)continue;
     const normalized=s.replace(/(\d)\s*кт(?=\s*\/|\s*$)/ig,'$1кг').replace(/[ОоO](?=л)/g,'0');
     const kg=api.packWeight(normalized);
     if(kg)evidence.push({kg,text:normalized});
    }
   }
  }
  const weights=[...new Set(evidence.map(z=>z.kg))];if(weights.length!==1)return x;
  const kg=weights[0],next={...x,packKg:kg};
  if(!api.packWeight(next.name)){
   const suffix=evidence.find(z=>z.kg===kg).text.match(/\d+(?:[.,]\d+)?\s*(?:кг|г)(?:\s*\/\s*\d+\s*л)?/i)?.[0];
   if(suffix)next.name=next.name.replace(/(?:\s*\/\s*(?:шт|уп|кор)(?:\s+\(с НДС\))?)$/i,m=>' '+suffix+m);
  }
  Object.assign(next,api.lineMetrics(next));if(x.invoiceTotal!=null)next.totalPrice=x.invoiceTotal;
  return next;
 })};return result;
}
api.parseSimple=text=>enrich(parse(text),[text]);
api.parseSamePhotoPasses=texts=>passes(texts).map(r=>enrich(r,texts));
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const old=api.parseSimple;
// Keep the original line total where a separately validated source row matches.
api.parseSimple=function(text){
 const r=old(text), verified=api.parse(text).items;
 for(const x of r.items){
  if(x.invoiceTotal!=null||x.price==null||x.quantity==null)continue;
  const matches=verified.filter(y=>y.source===x.source&&y.unit===x.unit&&Math.abs(y.quantity-x.quantity)<0.000001);
  if(matches.length===1){x.invoiceTotal=matches[0].grossTotal;Object.assign(x,api.lineMetrics(x));}
 }
 return r;
};
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const parse=api.parseSimple,passes=api.parseSamePhotoPasses;
const num=s=>{s=String(s).replace(/\s/g,'');if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf('.')>s.lastIndexOf(',')?s.replace(/,/g,''):s.replace(/\./g,'').replace(',','.');else s=s.replace(',','.');return Number(s)};
const money='(?:\\d{1,3}(?:[, .]\\d{3})+[.,]\\d{2}|\\d+[.,]\\d{2})',dec='\\d+(?:[.,]\\d{1,3})?';
const footer=new RegExp('^всего\\s+по\\s+накладной\\s*[:=]?\\s*('+money+')\\s+('+dec+')\\s+('+dec+')(?:\\s+[xх–—-]+)*\\s*$','i');
const payable=new RegExp('^всего\\s+к\\s+оплате\\s*[:=]?\\s*('+money+')\\s*$','i');
const pack=/^(\d+(?:[.,]\d+)?)\s*к[гт]\s*\/\s*([0-9ОоO]+)\s*л\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)(?:\s+[xх–—-]+)*\s*$/i;
// A single-item TTN can be independently reconciled using its document
// total, shipment count and gross mass, even if the OCR crop lost the article.
function reconcile(r,texts){
 if(r.supplier!=='Восток-Запад'||r.items.length!==1)return r;
 const x=r.items[0];
 if(x.packKg||!['шт','уп','кор'].includes(x.unit)||!Number.isInteger(x.quantity)||!(x.quantity>0&&x.price>0&&x.invoiceTotal>0))return r;
 const candidates=[],allTotals=[];
 for(const raw of texts){
  const lines=String(raw||'').split(/\r?\n/).map(l=>l.replace(/[|│]/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean);
  for(const line of lines){
   const f=line.match(footer),v=line.match(payable);
   if(f)allTotals.push(num(f[1]));
   if(v)allTotals.push(num(v[1]));
  }
  for(let i=0;i<lines.length;i++){
   const m=lines[i].match(pack);if(!m)continue;
   const kg=num(m[1]),qty=num(m[3]),gross=num(m[4]);
   if(!(kg>0&&qty===x.quantity&&gross+.001>=kg*qty))continue;
   const after=lines.slice(i+1,i+5);
   // No intervening product name or unrelated data: only totals may follow.
   const f=after.find(l=>footer.test(l));
   if(!f||!after.slice(0,after.indexOf(f)).every(l=>/^итого\b|^итого\s*:/i.test(l)))continue;
   const v=f.match(footer);
   if(Math.abs(num(v[1])-x.invoiceTotal)>.011||num(v[2])!==qty||Math.abs(num(v[3])-gross)>.001)continue;
   candidates.push({kg,suffix:m[1]+'кг/'+m[2].replace(/[ОоO]/g,'0')+'л'});
  }
 }
 if(!allTotals.length||allTotals.some(v=>Math.abs(v-x.invoiceTotal)>.011)||new Set(candidates.map(z=>z.kg)).size!==1)return r;
 const evidence=candidates[0],next={...x,packKg:evidence.kg};
 next.name=x.name.replace(/(\s*\/\s*(?:шт|уп|кор)(?:\s+\(с НДС\))?)$/i,m=>' '+evidence.suffix+m);
 Object.assign(next,api.lineMetrics(next));
 return {...r,items:[next]};
}
api.parseSimple=text=>reconcile(parse(text),[text]);
api.parseSamePhotoPasses=texts=>passes(texts).map(r=>reconcile(r,texts));
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const previous=api.parseSimple;
const money='(?:\\d{1,3}(?: \\d{3})+|\\d+)[.,]\\d{2}';
const number=s=>Number(String(s).replace(/\s/g,'').replace(',','.'));
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
const amounts=s=>[...s.matchAll(new RegExp('(?:^|\\s)('+money+')(?=\\s|$)','g'))].map(m=>({n:number(m[1]),at:m.index+m[0].indexOf(m[1])}));
const quantity=s=>[...s.matchAll(/(?:^|\s)(\d+[.,]\d{3})(?=\s|$)/g)].map(m=>number(m[1]));
const rates=[0,5,7,10,20,22];
const close=(a,b,tol=.021)=>Math.abs(a-b)<=tol;
const unitWord='(?:меш(?:ок)?|упак(?:овка)?|уп|шт|кор|кг|г|л|мл|yna)';
const unitSuffix=new RegExp('(?:\\s+(\\d{2,3}))?\\s+('+unitWord+')\\.?$','i');
const unitAliases={'меш':'уп','мешок':'уп','упак':'уп','упаковка':'уп','yna':'уп'};
const clean=s=>s.replace(/[|│]/g,' ').replace(/\s+/g,' ').trim();
// Recover displaced columns of a Russian UPD only when all printed document
// totals and row arithmetic independently agree. Preserve the printed net unit
// price and VAT-inclusive line total separately.
function upd(text,b){
 const lines=String(text||'').split(/\r?\n/).map(clean).filter(Boolean);
 const head=lines.findIndex((l,i)=>/наименование товара/i.test(l)&&/налог|стоимость|цена/i.test(lines.slice(Math.max(0,i-5),i+6).join(' ')));
 const end=lines.findIndex((l,i)=>i>head&&/^всего\s+к\s+оплате\s*\(?9\)?/i.test(l));
 if(head<0||end<0||!b.supplier)return b;
 let stop=end,totals=amounts(lines[end]).map(v=>v.n);
 if(totals.length===1&&end>head&&amounts(lines[end-1]).length===2&&!/[а-яёa-z]/i.test(lines[end-1])){
  totals.push(...amounts(lines[end-1]).map(v=>v.n));stop--;
 }
 if(totals.length!==3||!close(totals[0]+totals[1],totals[2]))return b;
 const rows=[];
 for(let i=head+1;i<stop;i++){
  const a=amounts(lines[i]);if(a.length!==3&&a.length!==4)continue;
  const [price,net]=a.map(v=>v.n),gross=a[a.length-1].n,tax=a.length===4?a[2].n:round(gross-net);
  if(!(price>0&&net>0&&gross>=net&&tax>=0&&close(net+tax,gross)))continue;
  const printedRate=lines[i].match(/(?:^|\s)(\d{1,2})\s*%/);
  const possible=rates.filter(r=>close(net*r/100,tax));
  if(!possible.length||printedRate&&!possible.includes(Number(printedRate[1])))continue;
  rows.push({i,prefix:lines[i].slice(0,a[0].at).trim(),price,net,tax,gross});
 }
 if(!rows.length||!close(rows.reduce((s,x)=>s+x.net,0),totals[0])||!close(rows.reduce((s,x)=>s+x.tax,0),totals[1])||!close(rows.reduce((s,x)=>s+x.gross,0),totals[2]))return b;
 const items=[];
 for(let k=0;k<rows.length;k++){
  const row=rows[k],next=rows[k+1]?.i??stop;
  const rest=lines.slice(row.i+1,next),qs=[...quantity(row.prefix),...rest.flatMap(quantity)];
  const q=[...new Set(qs)].filter(v=>v>0&&close(v*row.price,row.net,Math.max(.02,v*.005+.011)));
  if(q.length!==1)return b;
  const stripQty=s=>s.replace(/(?:^|\s)\d+[.,]\d{3}(?=\s|$)/g,' ').trim();
  let first=stripQty(row.prefix),unit='',code='';
  const parts=rest.filter(s=>/[а-яёa-z]{2}/i.test(s)&&!amounts(s).length);
  if(!/[а-яёa-z]{2}/i.test(first))first=stripQty(parts.shift()||'');
  const u=first.match(unitSuffix);
  if(u){unit=unitAliases[u[2].toLowerCase()]||u[2].toLowerCase();code=u[1]||'';first=first.slice(0,u.index).trim();}
  else {const c=first.match(/\s+(?:796|778|990|96)$/);if(c){code=c[0].trim();first=first.slice(0,c.index).trim();}}
  first=first.replace(/^\d{1,3}[.)]?\s+/,'').trim();
  if(!/[а-яёa-z]{3}/i.test(first))return b;
  const name=[first,...parts.map(stripQty)].join(' ').trim();
  // Unit aliases and a damaged 796 code are review suggestions only.
  if(!unit)unit=({'796':'шт','96':'шт','778':'уп','990':'уп'})[code]||(/\d/.test(name)&&/(?:блок|мешок|меш\s*\/|упаковка)/i.test(name)&&Number.isInteger(q[0])?'шт':'');
  const packKg=['шт','уп','кор'].includes(unit)?api.packWeight(name):null;
  const x={name:name+(unit?' / '+unit:'')+' (без НДС)',unit,quantity:q[0],price:row.price,packKg,invoiceTotal:row.gross,uncertain:true,source:[lines[row.i],...rest].join('\n')};
  Object.assign(x,api.lineMetrics(x));items.push(x);
 }
 return {...b,items};
}
api.parseSimple=function(text){const b=previous(text);return upd(text,b)};
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const previous=api.parseSimple;
const cash='(?:\\d{1,3}(?: \\d{3})+|\\d+)[.,]\\d{2}',qty='\\d+[.,]\\d{3}';
const n=s=>Number(s.replace(/\s/g,'').replace(',','.'));
const near=(a,b,t=.021)=>Math.abs(a-b)<=t;
const clean=s=>s.replace(/[|│]/g,' ').replace(/\s+/g,' ').trim();
const rowStart=new RegExp('^(.+?)\\s+(778|796|990)\\s+(упак|уп|шт|меш|ynak|ynаk)\\s+('+cash+')\\s+('+cash+')(?:\\s+[\\da-zа-я]+)*$','i');
const continuation=new RegExp('^(.+?)\\s+('+qty+')\\s+(\\d{1,2})%\\s+('+cash+')\\s+('+cash+')$','i');
const full=new RegExp('^(.+?)\\s+('+qty+')\\s+('+cash+')\\s+('+cash+')\\s+[EЕ]?(\\d{1,2})%\\s+('+cash+')\\s+('+cash+')$','i');
const footer=new RegExp('(?:^|\\s)('+cash+')\\s+('+cash+')\\s+('+cash+')\\s*$','i');
const normalizeName=s=>s.replace(/(?:^|\s)(?:yn|yп|уп)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(?:kr|kг|кr|кг)(?=\s|$|[()])/ig,' уп/$1кг').replace(/\s+/g,' ').trim();
const rates=[0,5,7,10,20,22];
function recover(text,b){
 const lines=String(text||'').split(/\r?\n/).map(clean).filter(Boolean);
 const doc=lines.findIndex(l=>/универсальный\s+передаточный\s+документ|счет[- ]фактура/i.test(l));
 if(doc<0)return b;
 // Seller name split by the OCR label; require the legal entity and surname
 // directly followed by the given name and patronymic.
 const seller=lines.slice(doc,doc+18).join('\n').match(/индивидуальный предприниматель\s+([а-яё-]+)\s*\n(?:продавец\s*:\s*)?([а-яё-]+)\s+([а-яё-]+)(?=\s|$)/i);
 if(seller&&/(?:овна|евна|ична|ович|евич|ич)$/i.test(seller[3]))b={...b,supplier:'ИП '+seller.slice(1).join(' ')};
 const head=lines.findIndex((l,i)=>i>doc&&/(?:код\s+налога\s*-\s*всего|наименование товара)/i.test(l));
 const end=lines.findIndex((l,i)=>i>head&&/^всего\s+к\s+оплате\s*\(?9\)?/i.test(l));
 if(head<0||end<0||!b.supplier)return b;
 const totals=lines[end].match(footer)||lines[end+1]?.match(footer);
 if(!totals)return b;
 const [netTotal,taxTotal,grossTotal]=totals.slice(1).map(n);
 if(!near(netTotal+taxTotal,grossTotal))return b;
 const rows=[];
 for(let i=head+1;i<end;i++){
  const a=lines[i].match(rowStart),c=lines[i+1]?.match(continuation),f=lines[i].match(full);
  if(a&&c){
   let name=a[1]+' '+c[1],j=i+2;
   if(j<end&&!full.test(lines[j])&&!rowStart.test(lines[j])&&/^\d+\s*шт\b|^\d+\s*ш[тt]\s/i.test(lines[j]))name+=' '+lines[j++];
   rows.push({name,unit:a[2]==='796'?'шт':'уп',q:n(c[2]),price:n(a[4]),net:n(a[5]),rate:+c[3],tax:n(c[4]),gross:n(c[5]),source:lines.slice(i,j).join('\n')});i=j-1;
  }else if(f){
   let name=normalizeName(f[1]),unit='';
   const u=name.match(/\s+(796|778|990)\s+(шт|упак|уп|меш|ynak)$/i);
   if(u){unit=u[1]==='796'?'шт':'уп';name=name.slice(0,u.index);}
   const prefix=name.match(/^(уп\s*\/\s*\d+(?:[.,]\d+)?\s*кг)\s+(.+)$/i);
   if(prefix){name=prefix[2]+' '+prefix[1];if(!unit)unit='шт';}
   if(!unit)continue;
   rows.push({name,unit,q:n(f[2]),price:n(f[3]),net:n(f[4]),rate:+f[5],tax:n(f[6]),gross:n(f[7]),source:lines[i]});
  }
 }
 if(!rows.length||rows.length<=b.items.filter(x=>x.price!=null).length)return b;
 if(rows.some(x=>!rates.includes(x.rate)||!(x.q>0&&x.price>0&&x.net>0&&x.gross>=x.net)||!near(x.q*x.price,x.net,Math.max(.02,x.q*.005+.011))||!near(x.net*x.rate/100,x.gross-x.net)||Math.abs(x.tax-(x.gross-x.net))>.25))return b;
 if(!near(rows.reduce((s,x)=>s+x.net,0),netTotal)||!near(rows.reduce((s,x)=>s+x.gross-x.net,0),taxTotal)||!near(rows.reduce((s,x)=>s+x.gross,0),grossTotal))return b;
 const items=rows.map(x=>{const name=normalizeName(x.name),v={name:name+' / '+x.unit+' (без НДС)',unit:x.unit,quantity:x.q,price:x.price,packKg:api.packWeight(name),invoiceTotal:x.gross,uncertain:true,source:x.source};Object.assign(v,api.lineMetrics(v));return v});
 return {...b,items};
}
api.parseSimple=text=>recover(text,previous(text));
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const previous=api.parseSimple,passes=api.parseSamePhotoPasses;
const cash='(?:\\d{1,3}(?: \\d{3})+|\\d+)[.,]\\d{2}',qty='\\d+[.,]\\d{3}';
const n=s=>Number(s.replace(/\s/g,'').replace(',','.'));
const near=(a,b,t=.021)=>Math.abs(a-b)<=t;
const clean=s=>s.normalize('NFKC').replace(/[|│]/g,' ').replace(/\s+/g,' ').trim();
const row=new RegExp('^(.*?)\\b(796|778|990|166)\\s+(?:(?:шт|упак|уп|меш|кг|[wшuу][tт]|ynak)\\s+)?('+cash+')\\s+('+cash+')\\s+(?:(?:[б65]е[з3])\\s+)?(\\d{1,2})%\\s+('+cash+')\\s+('+cash+')$','i');
const footer=new RegExp('^('+cash+')\\s+[xх–—-]\\s+('+cash+')\\s+('+cash+')$','i');
const quant=new RegExp('(?:^|\\s)('+qty+')(?=\\s|$)','g');
const nameClean=s=>s.replace(/^\s*\d{1,3}[.)]?\s*/,'').replace(/\s*(?:акциза|без акциза)$/i,'').replace(/(?:^|\s)(?:yn|уп|п)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(кг|г|л|мл)/ig,' уп/$1$2').replace(/\s+[EЕ]$/,'').trim();
const sellerClean=s=>s.toUpperCase().replace(/[ABCEHKMOPTXY]/g,c=>({A:'А',B:'В',C:'С',E:'Е',H:'Н',K:'К',M:'М',O:'О',P:'Р',T:'Т',X:'Х',Y:'У'})[c]);
function recover(text,b){
 const lines=String(text||'').split(/\r?\n/).map(clean).filter(Boolean);
 const doc=lines.findIndex(l=>/счет[- ]фактура|универсальный\s+передаточный/i.test(l));
 if(doc<0)return b;
 const header=lines.slice(doc,doc+18);let supplier=b.supplier;
 for(const l of header){
  const m=l.match(/^(?:продавец\s*:\s*)?["«]?([А-ЯЁA-Z][А-ЯЁA-Z -]{1,45})["»]\s*\(2\)/i);
  if(m){const token=sellerClean(m[1].trim()),legal=header.some(h=>/общество с ограниченной ответственностью/i.test(h)),known=api.parse('ООО '+token).supplier;if(known||legal)supplier=known||'ООО «'+token+'»';}
 }
 const head=lines.findIndex((l,i)=>i>doc&&/наименование товара/i.test(l)&&/стоимость|налог|цена/i.test(lines.slice(Math.max(0,i-5),i+6).join(' ')));
 const end=lines.findIndex((l,i)=>i>head&&/^всего\s+к\s+оплате\s*\(?9\)?/i.test(l));
 if(head<0||end<0||!supplier)return b;
 const foot=lines[end-1]?.match(footer);if(!foot)return b;
 const totals=foot.slice(1).map(n);if(!near(totals[0]+totals[1],totals[2]))return b;
 const anchors=[];for(let i=head+1;i<end-1;i++){const m=lines[i].match(row);if(m)anchors.push({i,m});}
 if(!anchors.length)return b;
 const items=[],checks=[];
 for(let k=0;k<anchors.length;k++){
  const {i,m}=anchors[k],next=anchors[k+1]?.i??end-1;
  const [price,net,rate,tax,gross]=m.slice(3).map(n);
  if(![0,5,7,10,20,22].includes(rate)||!(price>0&&net>0&&gross>=net)||!near(net+tax,gross)||!near(net*rate/100,tax))return b;
  const rest=lines.slice(i+1,next),qs=[...rest.join(' ').matchAll(quant)].map(v=>n(v[1]));
  const q=[...new Set(qs)].filter(v=>v>0&&near(v*price,net,Math.max(.02,v*.005+.011)));if(q.length!==1)return b;
  const name=[m[1],...rest.map(l=>l.replace(quant,' '))].map(nameClean).filter(l=>/[а-яёa-z]{2}/i.test(l)).join(' ').trim();
  if(!name||/всего к оплате|руководитель организации/i.test(name))return b;
  const unit=({'796':'шт','778':'уп','990':'уп','166':'кг'})[m[2]];
  const x={name:name+' / '+unit+' (без НДС)',unit,quantity:q[0],price,packKg:unit==='кг'?null:api.packWeight(name),invoiceTotal:gross,uncertain:true,source:lines.slice(i,next).join('\n')};
  Object.assign(x,api.lineMetrics(x));items.push(x);checks.push([net,tax,gross]);
 }
 if(!totals.every((v,j)=>near(v,checks.reduce((s,x)=>s+x[j],0))))return b;
 return {supplier,items,documentVerified:true};
}
api.parseSimple=text=>{
 const r=recover(text,previous(text));
 if(!r.documentVerified&&/счет[- ]фактура|универсальный\s+передаточный/i.test(String(text||'')))return {...r,items:r.items.map(x=>x.quantity==null&&x.price!=null?{...x,price:null,pricePerKg:null,totalPrice:null}:x)};
 return r;
};
api.parseSamePhotoPasses=texts=>[...texts.map(api.parseSimple),...passes(texts)];
})(globalThis);

;(function(root){
'use strict';
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const prior=api.parseSimple,passes=api.parseSamePhotoPasses;
const tidy=s=>String(s||'').replace(/[\u00a0\u202f]/g,' ').trim();
const money='(?:\\d{1,3}(?:[ .]\\d{3})+[,.]\\d{2}|\\d+[,.]\\d{2})';
const number=s=>Number(s.replace(/\s/g,'').replace(/\.(?=\d{3}[,.])/g,'').replace(',','.'));
const qty='\\d+(?:[,.]\\d{1,5})?';
const unit='(?:кг|г|л|мл|шт\\.?|уп\\.?|упак\\.?|упаковка|кор\\.?|коробка|мешок|меш\\.?)';
const aliases={'упак':'уп','упаковка':'уп','коробка':'кор','мешок':'уп','меш':'уп'};
const asUnit=s=>aliases[s.toLowerCase().replace(/\.$/,'')]||s.toLowerCase().replace(/\.$/,'');
const fields=[
 ['name','(?:наименование(?:\\s+(?:товара|продукции))?|товар|продукция|номенклатура)'],
 ['qty','(?:количество|кол[- ]?во|кол\\.)'],
 ['unit','(?:единица(?:\\s+измерения)?|ед\\.?\\s*изм\\.?|ед\\.?)'],
 ['price','(?:цена(?:\\s+за\\s+(?:единицу|ед\\.?|упаковку|уп\\.?))?)'],
 ['total','(?:сумма|стоимость)'],
 ['index','(?:№(?:\\s*п\\/п)?|номер)']
];
const headerPattern=new RegExp(fields.map(([k,v])=>'(?<'+k+'>'+v+')').join('|'),'giu');
const colPattern={name:'(.+?)',qty:'('+qty+')',unit:'('+unit+')',price:'('+money+')',total:'('+money+')',index:'(\\d+[.)]?)'};
const close=(x,y,t=.021)=>Math.abs(x-y)<=t;
function generic(text,base){
 const lines=String(text||'').split(/\r?\n/).map(tidy).filter(Boolean);
 // Simple trade documents only; VAT and TTN layouts retain the specialized parsers.
 if(lines.some(l=>/сч[её]т[- ]фактура|универсальный\s+передаточный|товарно[- ]транспортная/i.test(l)))return base;
 let head=-1,cols=[],sep='';
 for(let i=0;i<Math.min(lines.length,80);i++){
  const l=lines[i],tokens=[...l.matchAll(headerPattern)];
  const keys=tokens.map(m=>Object.keys(m.groups).find(k=>m.groups[k]!==undefined));
  const left=l.replace(headerPattern,'').replace(/[\s|;:\t,.]/g,'');
  if(left||new Set(keys).size!==keys.length||!['name','qty','unit','price','total'].every(k=>keys.includes(k)))continue;
  head=i;cols=keys;sep=l.includes('|')?'|':l.includes(';')?';':l.includes('\t')?'\t':'';break;
 }
 if(head<0)return base;
 const totalPattern=new RegExp('^(?:итого|всего(?:\\s+к\\s+оплате|\\s+по\\s+накладной)?)\\s*[:|;]?\\s*('+money+')\\s*(?:₽|руб\\.?)?$','i');
 const footer=lines.findIndex((l,i)=>i>head&&totalPattern.test(l));
 if(footer<0||footer-head>250)return base;
 const expected=number(lines[footer].match(totalPattern)[1]);
 const expr=new RegExp('^'+cols.map(k=>colPattern[k]).join('\\s+')+'$','i');
 const items=[];
 const incomplete=()=>({...base,items:base.items.map(x=>({...x,price:null,invoiceTotal:null,totalPrice:null,pricePerKg:null})),documentVerified:false});
 for(let i=head+1;i<footer;i++){
  const l=lines[i],row=sep?l.split(sep).map(s=>s.trim()).filter((s,j,a)=>s||j>0&&j<a.length-1):l.match(expr)?.slice(1);
  if(!row||row.length!==cols.length)return incomplete();
  const cells=Object.fromEntries(cols.map((k,j)=>[k,row[j]]));
  if(!/[\p{L}]{2}/u.test(cells.name)||!new RegExp('^'+unit+'$','i').test(cells.unit)||!new RegExp('^'+qty+'$').test(cells.qty)||!['price','total'].every(k=>new RegExp('^'+money+'$').test(cells[k])))return incomplete();
  const q=number(cells.qty),price=number(cells.price),total=number(cells.total),u=asUnit(cells.unit);
  if(!(q>0&&price>0&&total>0)||!close(q*price,total,Math.max(.02,q*.005+.011)))return incomplete();
  if(['шт','уп','кор'].includes(u)&&!Number.isInteger(q))return incomplete();
  const name=cells.name.trim(),x={name:name+' / '+u,unit:u,quantity:q,price,invoiceTotal:total,packKg:['шт','уп','кор'].includes(u)?api.packWeight(name):null,source:l,uncertain:true};
  Object.assign(x,api.lineMetrics(x));items.push(x);
 }
 if(!items.length||!close(items.reduce((s,x)=>s+x.invoiceTotal,0),expected))return incomplete();
 if(!base.supplier)return base;
 return {supplier:base.supplier,items,documentVerified:true};
}
api.parseSimple=text=>{const b=prior(text);return b.documentVerified?b:generic(text,b)};
api.parseSamePhotoPasses=texts=>[...texts.map(api.parseSimple),...passes(texts)];
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const previous=api.lineMetrics,positive=v=>{const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)&&n>0?n:null};
function packVolume(name){
 const product=String(name||'').replace(/\s*\/\s*(?:кг|г|л|мл|шт|уп|кор)(?:\s+\((?:с|без)\s+НДС\))?$/i,'');
 if(/\d\s*[xх×*]\s*\d/i.test(product))return null;
 const matches=[...product.matchAll(/(?:^|[^\d.,])(\d+(?:[,.]\d+)?)\s*(мл|л)(?=$|[^а-яёa-z0-9])/gi)];
 if(matches.length!==1)return null;
 const v=positive(matches[0][1]);return v?v/(matches[0][2].toLowerCase()==='мл'?1000:1):null;
}
api.packVolume=packVolume;
api.lineMetrics=row=>{
 const base=previous(row),u=row.unit||'';
 const per=u==='л'?1:u==='мл'?.001:['шт','уп','кор'].includes(u)&&!positive(row.packKg)?positive(row.packL):null;
 const q=positive(row.quantity),p=positive(row.price);
 return {...base,totalL:q&&per?Math.round(q*per*1e6)/1e6:null,pricePerL:p&&per?Math.round((p/per+Number.EPSILON)*100)/100:null};
};
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const prior=api.parseSimple,passes=api.parseSamePhotoPasses,weight=api.packWeight;
api.packWeight=name=>weight(String(name||'').replace(/(\d)\s*гр\.?(?=$|[\s,;()[\]])/gi,'$1 г'));

const isAct=s=>/(?:акт|akt)\s+при[её]ма\s*[-–]\s*передачи\s+по\s+упд/i.test(s);
const clean=s=>String(s||'').replace(/[|│]/g,' ').replace(/\s+/g,' ').trim();
const n=s=>Number(s.replace(/\s/g,'').replace(',','.'));
const cash='(?:\\d{1,3}(?: \\d{3})+|\\d+)[.,]\\d{2}';
const number='\\d+(?:[.,]\\d{1,3})?';
const tail=new RegExp('^(.+?)\\s+(шт|уп|кг|г|л|мл|кор)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d{1,2})%?\\s+('+cash+')\\s+('+cash+')\\s+('+number+')\\s+(\\d{2}\\.\\d{2}\\.\\d{4})$','i');
function act(text,base){
 if(!isAct(text))return base;
 const lines=String(text).split(/\r?\n/).map(clean).filter(Boolean);
 const doc=lines.findIndex(isAct),header=lines.slice(doc,doc+40);
 let supplier=base.supplier;
 for(const l of header){const m=l.match(/(?:продавец\s*:?\s*)?(?:общество с ограниченной ответственностью|ООО)\s*["«]([^"»]{2,80})["»]/i);if(m){supplier='ООО «'+m[1].trim()+'»';break;}}
 const page=String(text).match(/(?:стр\.|страница|cmp\.)\s*([1-9]\d*|I)\s*(?:из|u3)\s*(\d+)/i);
 const pageInfo=page?{page:page[1].toUpperCase()==='I'?1:Number(page[1]),pages:Number(page[2])}:null;
 const unknown={...base,supplier,items:base.items.map(x=>({...x,price:null,invoiceTotal:null,totalPrice:null,pricePerKg:null})),pageInfo};
 const head=lines.findIndex((l,i)=>i>doc&&/наименование товара/i.test(l));
 const headings=lines.slice(Math.max(doc,head-7),head+15).join(' ');
 if(head<0||!supplier||!(/отгружено|отгру[\s-]*жено/i.test(headings)||(/общая/i.test(headings)&&/ставка/i.test(headings)&&/количество/i.test(headings)&&/годности/i.test(headings)&&/\b8 9 10 11 12\b/.test(headings))))return unknown;
 const rows=[];
 // The printed line number can be missing or glued to the barcode.
 // Prefer an explicit number; recover a glued number only if it is the next
 // consecutive row and leaves an 8–14 digit product code.
 for(let i=head+1;i<lines.length;i++){
  const l=lines[i],m=l.match(tail);if(!m)continue;
  let label=m[1],index=null,article=null;
  const expected=rows.length?rows[rows.length-1].index+1:pageInfo?.page===1?1:null;
  const explicit=label.match(/^(\d{1,3})[.)]?\s+(\d{8,14})\s*(?=[а-яёa-z])/i);
  const fused=label.match(/^(\d{9,17})\s*(?=[а-яёa-z])/i);
  if(explicit){index=+explicit[1];article=explicit[2];label=label.slice(explicit[0].length);}
  else if(fused){
   const digits=fused[1],prefix=String(expected??'');
   if(expected!==null&&digits.startsWith(prefix)&&digits.length-prefix.length>=8&&digits.length-prefix.length<=14&&digits.length>13){index=expected;article=digits.slice(prefix.length);}
   else if(digits.length>=8&&digits.length<=14){index=expected??1;article=digits;}
   else return unknown;
   label=label.slice(fused[0].length);
  }else{
   const code=label.match(/^(\d{8,14})\s*(?=[а-яёa-z])/i);
   if(!code)return unknown;
   index=expected??1;article=code[1];label=label.slice(code[0].length);
  }
  if(expected!==null&&index!==expected)return unknown;
  // The end of a product name can be below the numeric cells (wrapped line).
  let j=i+1;
  while(j<lines.length&&j<=i+3){
   const next=lines[j];
   if(/^[\[\]|]+$/.test(next)){j++;continue;}
   if(/^\d|^(?:итого|всего|стр\.|cmp\.|страница|подпись)/i.test(next)||tail.test(next))break;
   if(!/[а-яёa-z]/i.test(next)||!/(?:\d+(?:[.,]\d+)?\s*(?:кг|гр?\.?|л|мл)(?![а-яёa-z])|\[\d+\])/i.test(next))break;
   label+=' '+next;j++;
  }
  label=label.replace(/\[\s*(\d(?:\s*\d)+)\s*\]/g,(_,v)=>'['+v.replace(/\s/g,'')+']').trim();
  const [per,full,part,rate,price,total,shipped]=m.slice(3,10).map(n);
  const unit=m[2].toLowerCase();
  if(![0,5,7,10,20,22].includes(rate)||!(per>0&&full>=0&&part>=0&&price>0&&shipped>0)||part>=per||Math.abs(per*full+part-shipped)>.00001||Math.abs(price*shipped-total)>.021)return unknown;
  const pack=['шт','уп','кор'].includes(unit),packKg=pack?api.packWeight(label):null;
  const x={name:label+' / '+unit+' (с НДС)',article,unit,quantity:shipped,price,invoiceTotal:total,packKg,packL:pack&&!packKg?api.packVolume(label):null,uncertain:true,source:lines.slice(i,j).join('\n')};
  Object.assign(x,api.lineMetrics(x));rows.push({index,x});i=j-1;
 }
 if(!rows.length||rows.some((r,i)=>i>0&&r.index!==rows[i-1].index+1)||pageInfo?.page===1&&rows[0].index!==1)return unknown;
 // If a row-like line was missed, do not claim verification.
 const table=lines.slice(head+1);
 const anchors=table.filter(l=>/^\d{1,3}[.)]?\s+\d{8,14}\s*(?=[а-яёa-z])|^\d{12,17}\s*(?=[а-яёa-z])/i.test(l));
 if(anchors.length!==rows.length)return unknown;
 return {supplier,items:rows.map(r=>r.x),pageVerified:true,pageInfo};
}
api.parseSimple=text=>act(text,prior(text));
api.parseSamePhotoPasses=texts=>[...texts.map(api.parseSimple),...passes(texts)];
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const positive=v=>{const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)&&n>0?n:null};
const round=(v,d=2)=>Math.round((v+Number.EPSILON)*10**d)/10**d;
const count=v=>{const n=positive(v);return Number.isSafeInteger(n)?n:null};
api.purchaseMetrics=row=>{
 const m=api.lineMetrics(row),name=String(row.name||''),u=row.unit,pack=['шт','уп','кор'].includes(u);
 const explicit=count(name.match(/(?:^|[\s(])(\d+)\s*(?:шт(?:ук[аи]?)?\.?|пакетик(?:ов|а)?)(?=$|[\s,;)\]])/i)?.[1]);
 const portion=/порцион|индивидуальн\w*\s+упаков/i.test(name);
 const mass=!!(row.packKg||row.packL||api.packWeight(name)||api.packVolume(name));
 const discrete=portion||/салфет|контейнер|палочк\w*\s+(?:для еды|для суши)|зубочист|стакан|крышк|перчат|пакет(?:ы|ов)?\s+(?:бумаж|фасов|майк)/i.test(name)||(!mass&&explicit>1);
 const per=count(row.piecesPerPack)||explicit||(portion?count(name.match(/\[\s*(\d+)\s*\]/)?.[1]):null);
 const piece=pack&&(discrete||(!row.packKg&&!row.packL&&!api.packWeight(name)&&!api.packVolume(name)&&u==='шт'));
 const q=positive(row.quantity),p=positive(row.price);
 const factor=u==='шт'?1:per;
 return {...m,basis:piece?'шт':m.totalL!=null||m.pricePerL!=null||['л','мл'].includes(u)||!!row.packL?'л':m.totalKg!=null||m.pricePerKg!=null||['кг','г'].includes(u)||!!row.packKg?'кг':null,
 piecesPerPack:piece?per:null,totalPieces:piece&&q&&factor&&Number.isSafeInteger(q*factor)?q*factor:null,pricePerPiece:piece&&p&&factor?round(p/factor):null};
};
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const prior=api.parseSimple,passes=api.parseSamePhotoPasses;
const money='(?:\\d{1,3}(?: \\d{3})+|\\d+)[.,]\\d{2}',qty='\\d+[.,]\\d{3}';
const n=s=>Number(s.replace(/\s/g,'').replace(',','.'));
const near=(a,b,t=.021)=>Math.abs(a-b)<=t;
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
const units={778:'уп',796:'шт',990:'уп',166:'кг',163:'г',112:'л',111:'мл'};
const row=new RegExp('^(.+?)\\s+(778|796|990|166|163|112|111)\\s+(?:(упак|уп|шт|меш|кг|г|л|мл|ynak|ynаk|упaк)\\.?\\s+)?('+qty+')\\s+('+money+')\\s+(.+?)\\s+(0|5|7|10|20|22)\\s*%\\s+(.+?)\\s+('+money+')$','i');
const footer=new RegExp('^всего\\s+к\\s+оплате\\s*(?:\\(9\\))?\\s*('+money+')\\s+(?:[xх×]\\s+)?('+money+')\\s+('+money+')\\s*$','i');
const cashToken=new RegExp('(?:^|\\s)'+money+'(?=\\s|$)');
const normalizeName=s=>s.replace(/(?:^|\s)(?:yn|yп|уп)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(?:kr|kг|кr|кг)(?=$|[\s()])/ig,' уп/$1 кг').replace(/(\d+)\s*[шШ][tTтТ](?=$|[\s)])/g,'$1 шт').replace(/\s+/g,' ').trim();
// Damaged net/tax cells are not treated as prices. Validate each readable
// quantity, unit price, rate and gross against all document footer totals.
function recover(text,b){
 if(b.documentVerified||b.pageVerified||!b.supplier)return b;
 const lines=String(text||'').split(/\r?\n/).map(l=>l.replace(/[|│]/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean);
 const doc=lines.findIndex(l=>/сч[её]т[- ]фактура|универсальный\s+передаточный\s+документ/i.test(l));
 if(doc<0)return b;
 const end=lines.findIndex((l,i)=>i>doc&&footer.test(l));
 if(end<0)return b;
 const [netTotal,taxTotal,grossTotal]=lines[end].match(footer).slice(1).map(n);
 if(!near(netTotal+taxTotal,grossTotal))return b;
 const items=[],nets=[],taxes=[];
 for(let i=doc+1;i<end;i++){
  const m=lines[i].match(row);if(!m)continue;
  const [,label,code,printedUnit,q,p,netCell,rate,vatCell,grossCell]=m;
  const quantity=n(q),price=n(p),gross=n(grossCell),taxRate=Number(rate),unit=units[code];
  if(!/[а-яё]{3}/i.test(label)||!/\d/.test(netCell)||!/\d/.test(vatCell)||!(quantity>0&&price>0&&gross>0))return b;
  const alias=printedUnit&&(/^(?:уп|yn|меш)/i.test(printedUnit)?'уп':printedUnit.toLowerCase());
  if(alias&&alias!==unit)return b;
  const net=round(gross/(1+taxRate/100)),tax=round(gross-net);
  if(!near(quantity*price,net,Math.max(.021,quantity*.005+.011)))return b;
  let name=label.replace(/^\d{1,3}[.)]?\s+/,'');let j=i+1;
  for(;j<end&&!row.test(lines[j]);j++){
   const l=lines[j];
   if(!/[а-яёa-z]{2}/i.test(l)||cashToken.test(l)||/%/.test(l)||/^(?:всего|итого|документ|продавец|покупатель)/i.test(l))return b;
   name+=' '+l;
  }
  name=normalizeName(name);
  const pack=['шт','уп','кор'].includes(unit),packKg=pack?api.packWeight(name):null;
  const x={name:name+' / '+unit+' (без НДС)',unit,quantity,price,invoiceTotal:gross,packKg,packL:pack&&!packKg?api.packVolume(name):null,uncertain:true,source:lines.slice(i,j).join('\n')};
  Object.assign(x,api.lineMetrics(x));items.push(x);nets.push(net);taxes.push(tax);i=j-1;
 }
 if(!items.length||items.length<b.items.filter(x=>x.price!=null).length)return b;
 const sum=a=>a.reduce((s,x)=>s+x,0);
 if(!near(sum(items.map(x=>x.invoiceTotal)),grossTotal)||!near(sum(nets),netTotal,.021+items.length*.011)||!near(sum(taxes),taxTotal,.021+items.length*.011))return b;
 return {...b,items,documentVerified:true};
}
api.parseSimple=text=>recover(text,prior(text));
api.parseSamePhotoPasses=texts=>[...texts.map(api.parseSimple),...passes(texts)];
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const earlier=api.parseSamePhotoPasses;
const clean=s=>String(s||'').normalize('NFKC').replace(/[|│\[\]]/g,' ').replace(/\s+/g,' ').trim();
const money=/(?:^|\s)((?:\d{1,3}(?: \d{3})+|\d+)[.,]\d{2})(?=\s|$)/g;
const number=s=>Number(s.replace(/\s/g,'').replace(',','.'));
const amounts=s=>[...s.matchAll(money)].map(m=>number(m[1]));
const near=(a,b,t=.021)=>Math.abs(a-b)<=t;
const sum=a=>a.reduce((s,x)=>s+x,0);
const footer=/^(?:всего|сего|cero|вcего)\s+к\s+оплате/i;
const packEnd=/\d+(?:[.,]\d+)?\s*(?:кг|г|л|мл|n|kr|r)(?:\s+[А-ЯЁA-Z][А-ЯЁA-Z -]{1,45})?$/i;
const normalize=s=>s.replace(/(\d)\s*kr\b/ig,'$1 кг').replace(/(\d)\s*r\b/ig,'$1 г').replace(/(\d)\s*n\b/ig,'$1 л').replace(/\s+/g,' ').trim();
function recover(forward,backward,supplier){
 const a=forward.split(/\r?\n/).map(clean).filter(Boolean),b=backward.split(/\r?\n/).map(clean).filter(Boolean);
 const head=a.findIndex(l=>/наименование товара/i.test(l)),end=a.findIndex((l,i)=>i>head&&footer.test(l));
 if(head<0||end<0||!supplier||!/сч[её]т[- ]фактура/i.test(forward)||!/сч[её]т[- ]фактура/i.test(backward))return null;
 const totals=amounts(a[end]);if(!totals.length)return null;const total=totals.at(-1);
 const names=[];
 for(let i=head+1;i<end;i++){
  const l=a[i];if(!packEnd.test(l)||!/[а-яё]{2}/i.test(l))continue;
  const prev=a[i-1],lead=l.replace(/^[a-z]{1,4}\s+(?=[а-яё])/i,'');
  // Only join a separate label line immediately before the explicit pack size.
  if(i>head+1&&/[а-яё]{3}/i.test(prev)&&!packEnd.test(prev)&&!/\d+[.,]\d{2}(?!\d)|наименование товара|код товара|стоимость/i.test(prev))names.push(normalize(prev+' '+lead));
  else names.push(normalize(lead));
 }
 const N=names.length;if(N<2)return null;
 // A column-order read must independently contain the same product anchors
 // in reverse order. Never align unrelated documents or a missing product.
 const flat=b.join(' ').toLowerCase();let cursor=0;
 for(const name of names.slice().reverse()){
  const token=name.match(/^[а-яё]{3,}/i)?.[0]?.toLowerCase();if(!token)return null;
  const matches=[...flat.matchAll(new RegExp('(?:^|[^а-яёa-z])('+token+')(?=$|[^а-яёa-z])','giu'))];
  if(matches.length!==1)return null;
  const at=matches[0].index+matches[0][0].length-token.length;
  if(at<cursor)return null;
  cursor=at+token.length;
 }
 const qs=[];
 for(let i=0;i<b.length;i++){
  const q=[...b[i].matchAll(/(?:^|\s)(\d+[.,]\d{3})(?=\s|$)/g)].map(m=>number(m[1]));
  if(q.length===N&&q.every(x=>Number.isSafeInteger(x)&&x>0))qs.push({i,q});
 }
 const result=[];
 for(const {i,q} of qs){
  const candidates=b.slice(i+1).map((l,j)=>({j:i+1+j,v:amounts(l)}));
  for(const gross of candidates.filter(c=>c.v.length===N+1&&near(c.v[0],total)&&near(sum(c.v.slice(1)),total))){
   for(const price of candidates.filter(c=>c.j<gross.j&&c.v.length===N)){
    for(const tax of candidates.filter(c=>c.j>price.j&&c.j<gross.j&&c.v.length===N+1&&near(sum(c.v.slice(1)),c.v[0]))){
     const g=gross.v.slice(1),vat=tax.v.slice(1);
     if(!q.every((v,k)=>{const net=g[k]-vat[k];return price.v[k]>0&&net>0&&near(v*price.v[k],net,Math.max(.021,v*.005+.011))&&[0,5,7,10,20,22].some(rate=>near(net*rate/100,vat[k]));}))continue;
     const items=names.map((name,k)=>{const j=N-1-k,packKg=api.packWeight(name),packL=packKg?null:api.packVolume(name);const x={name:name+' / уп (без НДС)',unit:'уп',quantity:q[j],price:price.v[j],invoiceTotal:g[j],packKg,packL,uncertain:true,source:name+'; восстановлено из столбцов, единица нормализована до упаковки'};Object.assign(x,api.lineMetrics(x));return x;});
     if(items.every(x=>x.packKg||x.packL))result.push(items);
    }
   }
  }
 }
 const distinct=[...new Map(result.map(x=>[JSON.stringify(x),x])).values()];
 if(distinct.length!==1)return null;
 return {supplier,items:distinct[0],documentVerified:true};
}
api.parseSamePhotoPasses=texts=>{
 const original=earlier(texts);
 const suppliers=[...new Set(original.map(x=>x.supplier).filter(Boolean))];
 if(suppliers.length!==1||original.some(x=>x.documentVerified))return original;
 const recovered=[];
 for(let i=0;i<texts.length;i++)for(let j=0;j<texts.length;j++)if(i!==j){
  const x=recover(String(texts[i]||''),String(texts[j]||''),suppliers[0]);if(x)recovered.push(x);
 }
 const unique=[...new Map(recovered.map(x=>[JSON.stringify(x.items),x])).values()];
 return unique.length===1?[unique[0],...original]:original;
};
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const prior=api.parseSimple,passes=api.parseSamePhotoPasses;
const cash='(?:\\d{1,3}(?: \\d{3})+|\\d+)[.,]\\d{2}';
const num=s=>Number(s.replace(/\s/g,'').replace(',','.'));
const near=(a,b,t=.021)=>Math.abs(a-b)<=t;
const clean=s=>String(s).replace(/[|│]/g,' ').replace(/\s+/g,' ').trim();
const places=/\s*\d+\s*\(\+\s*\d+\s*\)?/g;
const row=new RegExp('^([A-ZА-Я]?\\d{4,6})\\s*(.*?)\\s+796\\s+(?:шт|[wш][iі]?t|wт|шt)\\s+(\\d+[.,]\\d{3})\\s+(?:\\d+\\(\\+\\d+\\)\\s+)?('+cash+')\\s+('+cash+')\\s+('+cash+')\\s+.{0,24}?(\\d{1,2})\\s*%\\s+('+cash+')\\s+('+cash+')(?:\\s+.*)?$','i');
const stop=/^(?:всего|итого|подпись|руководитель|бухгалтер|сч[её]т[- ]фактура|расходная накладная)/i;
const isHeader=s=>/наиме\s*нование товара|цена с ндс|количество мест|прослежи|прослежива|измерения|налога\s*-\s*всего|^(?:[aа]|\d+[aа]?)\s+(?:\d+[aа]?\s*)+$/i.test(s);
function recover(text,b){
 const raw=String(text||''),lines=raw.split(/\r?\n/).map(clean).filter(Boolean);
 if(!/сч[её]т[- ]фактура/i.test(raw))return b;
 const seller=raw.match(/(?:^|\n)\s*продавец\s*:?\s*(?:ООО|000)\s*["«]([^"»\n]{2,80})["»]/i);
 if(!seller||!/^ША[NН]ХАЙ[-– ]ТОРГ$/i.test(seller[1].trim()))return b;
 const supplier='ООО «ШАНХАЙ-ТОРГ»';
 // This supplier prints net and gross unit prices and a separate place count.
 if(!/цена\s+с\s+ндс/i.test(raw)||!/количество\s+количество|количество\s+мест/i.test(raw))return {...b,supplier};
 const head=lines.findIndex(l=>/наиме\s*нование товара/i.test(l));
 if(head<0)return {...b,supplier};
 const items=[];let previous=head;
 const incomplete=()=>({...b,supplier,documentVerified:false,pageVerified:false,items:b.items.filter(x=>!/^([A-ZА-Я]?\d{4,6})(?:\s|$)/i.test(x.name)).map(x=>({...x,price:null,invoiceTotal:null,totalPrice:null,pricePerKg:null}))});
 for(let i=head+1;i<lines.length;i++){
  if(stop.test(lines[i]))break;
  const line=lines[i],m=line.match(row);
  if(!m){if(/^[A-ZА-Я]?\d{4,6}\s+.*\b796\b/i.test(line)||/(?:^|\s)796\s+(?:шт|[wш][iі]?t|wт|шt)\s+\d/i.test(line))return incomplete();continue;}
  const [,article,ending,q,netUnit,grossUnit,netValue,rateToken,taxValue,grossValue]=m;
  const quantity=num(q),netPrice=num(netUnit),price=num(grossUnit),net=num(netValue),tax=num(taxValue),total=num(grossValue);
  if(!(Number.isSafeInteger(quantity)&&quantity>0&&netPrice>0&&price>0&&net>0&&tax>=0&&total>0))return incomplete();
  const rate=[0,5,7,10,20,22].find(r=>near(net*r/100,tax));
  const printedRate=Number(rateToken);
  // A clipped rate glyph is accepted only if both price columns and all
  // monetary amounts reconcile. No rate or amount is invented.
  if(rate===undefined||!(printedRate===rate||String(rate).length===2&&String(rate)[0]===rateToken)||!near(quantity*netPrice,net,Math.max(.021,quantity*.005+.011))||!near(quantity*price,total,Math.max(.021,quantity*.005+.011))||!near(net+tax,total))return incomplete();
  const parts=[];
  for(let j=i-1;j>previous&&j>=i-3;j--){
   const s=lines[j].replace(places,'').trim();
   if(!s)continue;
   if(isHeader(s)||stop.test(s)||!/[а-яёa-z]{2}/i.test(s)||new RegExp(cash).test(s))break;
   parts.unshift(s);
  }
  const name=[...parts,ending.replace(places,'')].join(' ').replace(/\s+/g,' ').trim()
   .replace(/(?:^|\s)[kк][rгg](?=$|[\s)])/giu,' кг').replace(/(\d)\s*n(?=$|[\s)])/ig,'$1 л');
  if(!/[а-яё]{3}/i.test(name)||isHeader(name)||items.some(x=>x.article===article))return incomplete();
  const packKg=api.packWeight(name),packL=packKg?null:api.packVolume(name);
  const x={name:name+' / шт (с НДС)',article,unit:'шт',quantity,price,netPrice,invoiceTotal:total,packKg,packL,uncertain:true,source:line};
  Object.assign(x,api.lineMetrics(x));items.push(x);previous=i;
 }
 if(!items.length)return incomplete();
 // Prefer reconciled visible rows, but do not assert the full document total.
 return {...b,supplier,items,pageVerified:true,documentVerified:false};
}
api.parseSimple=text=>recover(text,prior(text));
api.parseSamePhotoPasses=texts=>[...texts.map(api.parseSimple),...passes(texts)];
})(globalThis);

;(function(root){
const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
const parse=api.parseSimple,passes=api.parseSamePhotoPasses;
const key=s=>String(s||'').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
function recoverName(r,texts){
 if(!r.supplier)return r;
 return {...r,items:r.items.map(x=>{
  if(!/^\d{7,12}$/.test(String(x.article||'')))return x;
  const suffix=x.name.match(/\s*\/\s*(?:шт|уп|кор|кг)(?:\s+\((?:с|без) НДС\))?$/i)?.[0]||'';
  const body=suffix?x.name.slice(0,-suffix.length):x.name;
  const pack=body.match(/\s+\d+(?:[.,]\d+)?\s*к[гт]\s*\/\s*[0-9ОоO]+\s*л$/i)?.[0]||'';
  const core=pack?body.slice(0,-pack.length):body;
  if(!/^(?:запекания|для запекания|с массовой долей жирности|малосоленая|мороженая|охлажденная)\b|^(?:запекания|для запекания|с массовой долей жирности|малосоленая|мороженая|охлажденная)(?:\s|,)/i.test(core))return x;
  const names=new Map();
  for(const raw of texts){
   const supplier=parse(raw).supplier;
   if(supplier&&key(supplier)!==key(r.supplier))continue;
   const lines=String(raw||'').split(/\r?\n/).map(s=>s.replace(/[|│]/g,' ').replace(/\s+/g,' ').trim());
   for(let i=1;i<lines.length;i++){
    const m=lines[i].match(new RegExp('^(.*?)\\s+'+x.article+'(?:\\s|$)'));
    if(!m)continue;
    const tail=m[1].replace(/^\d{1,3}[.)]?\s+/,'').trim();
    if(key(tail)!==key(core))continue;
    const prev=lines[i-1].replace(/^\d{1,3}[.)]?\s+/,'').trim();
    if(!/^(?:майонез|форель|сыр|рис|креветк\w*|соус|масло|мука|лосось|угорь|сливки)(?:\s|$)/i.test(prev)||/\d{7,}|(?:итого|всего к оплате)/i.test(prev))continue;
    const name=prev+' '+tail;
    names.set(key(name),name);
   }
  }
  if(names.size!==1)return x;
  return {...x,name:[...names.values()][0]+pack+suffix};
 })};
}
api.parseSimple=text=>recoverName(parse(text),[text]);
api.parseSamePhotoPasses=texts=>passes(texts).map(r=>recoverName(r,texts));
})(globalThis);

;(function(root){
 const api=typeof module==='object'&&module.exports?module.exports:root.supplyInvoiceParser;
 const prior=api.parseSimple,priorPasses=api.parseSamePhotoPasses;
 const supplier='ООО «МАРР РУССИЯ»';
 const textOf=t=>String(t||'').replace(/[\u00a0\u202f]/g,' ').replace(/[|│]/g,' ');
 const tidy=t=>textOf(t).replace(/[ \t]+/g,' ').trim();
 const money='(?:\\d{1,3}(?: \\d{3})+|\\d+)[.,]\\d{2}';
 const num=s=>Number(String(s).replace(/\s/g,'').replace(',','.'));
 const cents=n=>Math.round(n*100),grams=n=>Math.round(n*1000);
 const matchSupplier=t=>/(?:официальное\s+наименование\s*:?\s*|поставщик\s*:?\s*)(?:[оo0]{3}\s*)?["«]?\s*[мm][аa][рp][рp]\s+[рp]усси[яa]/iu.test(tidy(t).replace(/\s+/g,' '));
 // Supplier article labels and nominal package sizes only. No buyer
 // information, transaction quantities, prices, dates or invoice identifiers.
 const catalog={
  '0945053074':['Икра красная с/м Масаго Путина 500 г',.5,'уп'],
  '0945053071':['Икра оранжевая с/м Масаго Путина 500 г',.5,'уп'],
  '2520140121':['Картофель фри в панировке 6 × 6 Expert We Fry 2,5 кг',2.5,'шт'],
  '0903309716':['Креветки Vannamei б/г очищенные б/хв., без пищ., свежемороженые 16/20 (Вьетнам) 1 кг',1,'уп'],
  '4166000120':['Мороженое ванильное с ЗМЖ Contadino 1 кг',1,'шт'],
  '2934502625':['Лук жареный Планета вкуса 1 кг',1,'шт'],
  '12401000':['Редька (редис) маринованная 500 г, Китай',.5,'уп'],
  '2934401710':['Чеснок измельчённый Kotanyi 860 г (1200 мл), Австрия',.86,'шт'],
  '1420050355':['Сыр для пиццы Моцарелла м.д.ж. 40% Le Plaisir кубик 1 кг',1,'шт'],
  '1420043011':['Пармезан 40% крошка Parmesan Primo 1 кг',1,'шт']
 };
 const knownCode=s=>{if(catalog[s])return s;const matches=Object.keys(catalog).filter(k=>s.endsWith(k)&&s.length-k.length<=2);return matches.length===1?matches[0]:null};
 const cash=t=>[...tidy(t).matchAll(new RegExp('(?<![\\d.,])('+money+')(?![\\d.,])','g'))].map(m=>num(m[1]));
 const decimals=t=>[...tidy(t).matchAll(/(?<![\d.,])\d+[.,]\d{3}(?![\d.,])/g)].map(m=>num(m[0]));
 const same=(a,b)=>Math.abs(a-b)<=.000001;
 const rowEnd=new RegExp('(?:^|\\s)(упак(?:овка)?|уп|шт|кг)\\.?\\s+(\\d+(?:[.,]\\d{1,3})?)\\s+(\\d+[.,]\\d{3})\\s+('+money+')\\s+('+money+')\\s*$','i');
 const rowStart=/^(?:\d{1,3}[.)]?\s+)?(\d{8,12})\s+(.*)$/;
 const category=/^\s*[0()]+\s*\([^)]{2,100}\)\s*/;
 const totalLine=/^итого\s*[:=]?\s+(\d+)\s+(\d+[.,]\d{3})\s+(.+)$/iu;
 function make(article,name,unit,q,w,p,t,source,nominal){
  const packKg=unit==='кг'?null:w/q;
  const r={article,name:name+' / '+unit,unit,quantity:q,price:p,invoiceTotal:t,packKg,nominalPackKg:nominal||null,uncertain:true,source};
  return {...r,...api.lineMetrics(r)};
 }
 function readRows(lines){
  let items=[],pending=null,footer=null;
  for(const l of lines){
   const f=l.match(totalLine);if(f){const sums=cash(f[3]);if(sums.length===1)footer=[num(f[1]),num(f[2]),sums[0]];pending=null;continue;}
   if(/^место хранения|^наименование|^код\s/i.test(l)){pending=null;continue;}
   const m=l.match(rowStart);if(m){pending={article:m[1],parts:[m[2]]};}
   else if(pending&&pending.parts.length<5)pending.parts.push(l);
   else continue;
   const s=pending.parts.join(' '),end=s.match(rowEnd);if(!end)continue;
   const q=num(end[2]),w=num(end[3]),p=num(end[4]),t=num(end[5]),article=knownCode(pending.article)||pending.article;
   let name=s.slice(0,end.index).replace(category,'').trim();
   if(!/[а-яёa-z]{3}/i.test(name)&&catalog[article])name=catalog[article][0];
   const unit=/^уп/i.test(end[1])?'уп':end[1].toLowerCase();
   if(/[а-яёa-z]{3}/i.test(name)&&q>0&&w>0&&p>0&&t>0&&Math.abs(cents(q*p)-cents(t))<=1&&(unit!=='кг'||same(q,w)))
    items.push(make(article,name,unit,q,w,p,t,s,api.packWeight(name)));
   pending=null;
  }
  const verified=!!footer&&items.length>0&&same(items.reduce((s,x)=>s+x.quantity,0),footer[0])&&items.reduce((s,x)=>s+grams(x.totalKg),0)===grams(footer[1])&&items.reduce((s,x)=>s+cents(x.invoiceTotal),0)===cents(footer[2]);
  return {items,verified};
 }
 const rotations=a=>[...new Map(a.map((_,i)=>{const b=[...a.slice(i),...a.slice(0,i)];return [b.join('|'),b]})).values()];
 function readColumns(lines){
  const codeLine=lines.find((l,i)=>/код/i.test([l,lines[i+1]||''].join(' '))&&[...l.matchAll(/(?<!\d)\d{8,12}(?!\d)/g)].length>=3);
  if(!codeLine)return null;
  const codes=[...codeLine.matchAll(/(?<!\d)\d{8,12}(?!\d)/g)].map(m=>knownCode(m[0]));
  if(codes.length<3||codes.length>100||codes.some(x=>!x))return null;
  const n=codes.length;
  const wi=lines.findIndex(l=>/(?:вес|[bв][eе][cс])\s*$/iu.test(l)&&decimals(l).length>=2);
  const pi=lines.findIndex(l=>/цена/i.test(l)&&cash(l.split(/цена/i)[0]).length>=2);
  const ti=lines.findIndex(l=>/[сc]умма/i.test(l)&&cash(l.split(/[сc]умма/i)[0]).length>=2);
  if(wi<0||pi<0||ti<0||wi===pi||pi===ti)return null;
  const weights=decimals(lines[wi].replace(/(?:вес|[bв][eе][cс])\s*$/iu,''));
  if(wi+1<lines.length&&/^[\d.,\s]+$/.test(lines[wi+1]))weights.push(...decimals(lines[wi+1]));
  const prices=cash(lines[pi].split(/цена/i)[0]);
  if(pi+1<lines.length&&/^[\d.,\s]+$/.test(lines[pi+1]))prices.push(...cash(lines[pi+1]));
  const totals=cash(lines[ti].split(/[сc]умма/i)[0]);
  if(ti+1<lines.length&&/^[\d.,\s]+$/.test(lines[ti+1]))totals.push(...cash(lines[ti+1]));
  if(weights.length!==n+1||prices.length!==n||totals.length<n-1||totals.length>n+1)return null;
  const grandWeight=weights[0],grand=totals[0],actual=totals.slice(1).map(cents);
  if(weights.slice(1).reduce((s,x)=>s+grams(x),0)!==grams(grandWeight)||!(grand>0))return null;
  const candidates=new Map();
  for(const ww of rotations(weights.slice(1))){
   const qq=ww.map((w,i)=>Math.round(w/catalog[codes[i]][1]));
   if(qq.some((q,i)=>q<1||Math.abs(ww[i]/catalog[codes[i]][1]-q)>.04))continue;
   for(const pp of rotations(prices)){
    const ts=pp.map((p,i)=>cents(p*qq[i]));
    if(ts.some(x=>x<=0)||ts.reduce((a,b)=>a+b,0)!==cents(grand))continue;
    const remaining=ts.slice();let support=0;
    for(const v of actual){const j=remaining.indexOf(v);if(j>=0){remaining.splice(j,1);support++;}}
    if(support<Math.max(n-2,Math.ceil(n*.8)))continue;
    const items=codes.map((c,i)=>make(c,catalog[c][0],catalog[c][2],qq[i],ww[i],pp[i],ts[i]/100,'МАРР: сверенные колонки OCR',catalog[c][1]));
    candidates.set(JSON.stringify(items.map(x=>[x.article,x.quantity,x.packKg,x.price,x.invoiceTotal])),items);
   }
  }
  if(candidates.size!==1)return null;
  return [...candidates.values()][0].reverse();
 }
 function officialName(raw){
  const m=String(raw||'').match(/(?:^|\n)\s*официальное\s+наименование\s*:\s*(?:\n\s*)?(?:([оo0]{3})\s*["«]([^"\n»]{2,90})["»]|["«]([^"\n»]{2,90})["»]\s*([оo0]{3}))(?=\s|$)/iu);
  return m?'ООО «'+(m[2]||m[3]).trim()+'»':'';
 }
 function recover(raw,b){
  if(!matchSupplier(raw)){const name=officialName(raw);return name&&!b.supplier?{...b,supplier:name}:b;}
  const lines=textOf(raw).split(/\r?\n/).map(tidy).filter(Boolean);
  const rows=readRows(lines),cols=readColumns(lines);
  if(rows.verified)return {...b,supplier,items:rows.items,documentVerified:true,pageVerified:true};
  if(cols)return {...b,supplier,items:cols,documentVerified:true,pageVerified:true};
  const partial=rows.items.length?rows.items:b.items.filter(x=>/[а-яёa-z]{3}/i.test(x.name.replace(/\s*\/\s*(?:кг|шт|уп|кор).*$/i,'')));
  return {...b,supplier,items:partial,documentVerified:false,pageVerified:false};
 }
 api.parseSimple=t=>recover(t,prior(t));
 api.parseSamePhotoPasses=texts=>{
  if(!texts.some(matchSupplier))return priorPasses(texts).map(r=>r.supplier?r:{...r,supplier:[...new Set(texts.map(officialName).filter(Boolean))].length===1?texts.map(officialName).find(Boolean):r.supplier});
  return texts.map(t=>api.parseSimple(matchSupplier(t)?t:'Поставщик: '+supplier+'\n'+t));
 };
})(globalThis);
