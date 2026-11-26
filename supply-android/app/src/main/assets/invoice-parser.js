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
 const base=previous(normalized), lines=normalized.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
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
