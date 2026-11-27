'use strict';
/**
 * Offline, isolated, deterministic UPD OCR mapping trial.
 * No vendor's current assortment or prices are stored here.
 * This is NOT a universal visual OCR engine: it reads text returned by OCR,
 * and refuses to declare an invoice verified if line alignment is ambiguous.
 */
const RUB=/\b\d{1,3}(?:[ \u00a0\u202f]\d{3})*[,.]\d{2}\b|\b\d{4,9}[,.]\d{2}\b/gu;
const QTY=/\b796\s+(?:[ШW][ТT]\s+)?(\d{1,7}[,.]\d{3})\s+(\d{1,3}(?:[ \u00a0]\d{3})*|\d+)[,.](\d{2})\s+(\d{1,3}(?:[ \u00a0]\d{3})*|\d+)[,.](\d{2})(?!\d)/iu;
const CODE=/\b([A-ZА-ЯЁ][\d]{3,9})\b/u;
const parseDecimal=s=>Number(String(s).replace(/[\u00a0\u202f ]/gu,'').replace(',','.'));
const cents=s=>Math.round(parseDecimal(s)*100);
const priceCents=(integer,decimal)=>cents(integer+','+decimal);
function moneyValues(s){return Array.from(s.matchAll(RUB),x=>cents(x[0]));}
function hasChars(s){return /[А-ЯЁA-Z]{2}/iu.test(s);}
const taxNoise=/^(?:(?:6[еe]3|без\s+акциза|акциза)(?:\s|$)|\d+(?:[,.]\d+)?\s*%\s*$)/iu;
function cleanNameFragment(source){
 let s=String(source||'').trim();
 if(!s||!hasChars(s)||taxNoise.test(s)||moneyValues(s).length>=1&&/(?:6[еe]3|акциза)/iu.test(s))return '';
 if(/^(?:\d+\s+)?(?:беларусь|беларус|корея|китай|республика|ика)(?:\s|$)/iu.test(s))return '';
 s=s.replace(/\s+\d+\(\+\d+\).*$/u,'')
    .replace(/\b\d+\(\+\d+\).*$/u,'')
    .replace(/\s+(?:(?:10|20|22)\s+)?(?:БЕЛАРУС[А-ЯЁ]*|КОРЕЯ|КИТАЙ|РЕСПУБЛ[А-ЯЁ]*|ИКА)(?:\s|,|$).*$/iu,'')
    .replace(/\s+(?:10|20|22)(?=\s*$)/u,'')
    .replace(/\s+(?:WT|ШТ)\s+акциза$/iu,'')
    .replace(/\s+акциза$/iu,'')
    .replace(/^\s*\d{1,3}\s+(?=[А-ЯЁ])/iu,'')
    .replace(/^[\s.,—–-]+|[\s.,—–-]+$/gu,'')
    .replace(/\s+/gu,' ').trim();
 if(/^(?:шт|кг|кг\)|kr|кr|kr\))$/iu.test(s))return '';
 return hasChars(s)?s:'';
}
function parseCodeTail(line,expectedIndex){
 const m=String(line).match(/^\s*([A-ZА-ЯЁ]\d{3,9})(?:\s+(\d{1,3}))?(?:\s+(.*))?$/u);
 if(!m)return null;
 if(m[2]&&Number(m[2])!==expectedIndex)return {invalid:true,reason:'Порядок товарных строк нарушен'};
 let continuation=String(m[3]||'').trim();
 continuation=continuation.replace(/\b(?:WT|ШТ|акциза)\b/giu,'').replace(/^[\s.–-]+|[\s.–-]+$/gu,'').trim();
 if(/^([KК][rгГΓ])\)?$/iu.test(continuation))continuation='';
 return {article:m[1],continuation:cleanNameFragment(continuation),raw:m[3]||''};
}
function parsePack(name){
 const str=String(name||'');
 const vol=str.match(/(?<!\d)(\d+(?:[,.]\d+)?)\s*(л|литр(?:а|ов)?)(?!\p{L})/iu);
 const mass=str.match(/(?<!\d)(\d+(?:[,.]\d+)?)\s*(кг|г)(?!\p{L})/iu);
 const pieces=str.match(/(?<!\d)(\d+)\s*(лист(?:ов|а)?|пар(?:ы)?)(?!\p{L})/iu);
 return {volumeL:vol?parseDecimal(vol[1]):null,weightKg:mass?parseDecimal(mass[1])*(mass[2].toLowerCase()==='г'?.001:1):null,countPerPack:pieces?Number(pieces[1]):null,packMeasure:pieces?pieces[2].toLowerCase():null};
}
function normalizeName(t){
 let name=t.replace(/\s+\d+\s*\/\s*\d+\s*,\s*$/u,s=>s.trim());
 name=name.replace(/\s+\b(?:Kr|KГ|KΓ|кг)\)\s*$/iu,' кг)')
          .replace(/\(\s*(\d+(?:[,.]\d+)?)\s+кг\)/iu,'($1 кг)')
          .replace(/\s+/gu,' ').trim();
 return name;
}
function rowAnchor(line){
 const m=QTY.exec(String(line));if(!m)return null;
 const quantity=parseDecimal(m[1]),net=priceCents(m[2],m[3]),gross=priceCents(m[4],m[5]);
 if(!(quantity>0&&quantity<=1000000&&gross>0&&net<=gross))return null;
 return {match:m,quantity,unit:'шт',priceCents:gross,netPriceCents:net};
}
function parseShanghai(raw){
 const ocr=String(raw||''),warnings=[];
 if(!/ШАНХАЙ[\s\-–—]*ТОРГ/iu.test(ocr))return {status:'unsupported',reason:'Не определён поставщик ШАНХАЙ-ТОРГ',items:[]};
 if(!/(?:\bУПД\b|Сч[её]т-?фактура|универсальн)/iu.test(ocr))return {status:'unsupported',reason:'Не определён формат УПД',items:[]};
 const lines=ocr.split(/\r?\n/u).map(s=>s.replace(/[\u00a0\u202f]/gu,' ').trim()).filter(Boolean);
 const anchors=[];
 for(let i=0;i<lines.length;i++){const a=rowAnchor(lines[i]);if(a)anchors.push({...a,lineIndex:i});}
 if(!anchors.length)return {status:'review',reason:'Не найдены строки количества/цены ОКЕИ 796',items:[]};
 if(anchors.length>20)return {status:'review',reason:'Более 20 строк: требуется постраничный анализ',items:[]};
 // Locate start of product block after the column heading A/1; never use earlier administrative words as a product.
 const first=anchors[0].lineIndex;let begin=Math.max(0,first-7);
 for(let i=Math.max(0,first-40);i<first;i++)if(/^A\s+1$/iu.test(lines[i])||(/^[AА]$/u.test(lines[i])&&/^1$/u.test(lines[i+1]||'')))begin=i+(/^[AА]$/u.test(lines[i])?2:1);
 let cursor=begin;
 const items=[];
 for(let n=0;n<anchors.length;n++){
  const a=anchors[n],window=lines.slice(cursor,a.lineIndex);
  const beforeLine=lines[a.lineIndex].slice(0,a.match.index).trim();
  let article=null,continuation='';
  const leadingCode=beforeLine.match(/^([A-ZА-ЯЁ]\d{3,9})\s+\d{1,3}\s*(.*)$/u);
  if(leadingCode){article=leadingCode[1];if(!/^(?:[KК][rгГΓ]\)?\s*[-–—]?)$/iu.test(leadingCode[2]||''))continuation=cleanNameFragment(leadingCode[2]);}
  else continuation=cleanNameFragment(beforeLine);
  let consume=0;
  const tail=lines[a.lineIndex+1]||'';
  const tailCode=parseCodeTail(tail,n+1);
  if(tailCode){
   if(tailCode.invalid){warnings.push(tailCode.reason);}
   else {article=article||tailCode.article;if(tailCode.continuation)window.push(tailCode.continuation);consume=1;}
  }
  const material=window.map(cleanNameFragment).filter(Boolean);
  if(continuation)material.push(continuation);
  let name=normalizeName(material.join(' '));
  if(/^[KК][rгГΓ]/iu.test(String(tailCode?.raw||''))&&/\d+[,.]\d+$/.test(name))name+=' кг';
  // An incomplete weight expression may end in a split OCR cell "Kr)" before column 796.
  if(/\(\s*\d+(?:[,.]\d+)?$/.test(name)&&/\b[KК][rгГΓ]\)/iu.test(beforeLine))name+=' кг)';
  const total=a.priceCents*a.quantity;
  const nearest=lines.slice(Math.max(0,cursor-1),Math.min(lines.length,a.lineIndex+2));
  const printed=nearest.flatMap(moneyValues);
  const rowMatched=printed.some(x=>Math.abs(x-total)<1.01);
  const sourceLines=lines.slice(cursor,a.lineIndex+1+consume);
  const issues=[];
  if(!rowMatched)issues.push('Не найдена напечатанная сумма строки');
  if(!name||name.length>230||/^(?:название|наименование|артикул|код товара|цена|количество)/iu.test(name))issues.push('Название не удалось отделить от заголовка');
  if(!article)issues.push('Артикул не извлечён');
  if(!Number.isInteger(total)||total<=0)issues.push('Проверка арифметики не пройдена');
  const pack=parsePack(name);
  items.push({index:n+1,article,name,pack,quantity:a.quantity,unit:a.unit,unitCode:796,unitPriceRub:a.priceCents/100,lineTotalRub:total/100,issues,sourceLines});
  cursor=a.lineIndex+1+consume;
 }
 const footer=lines.slice(anchors.at(-1).lineIndex+1);
 const sumCents=items.reduce((s,x)=>s+Math.round(x.lineTotalRub*100),0);
 const totalLines=footer.slice(0,12).filter(x=>/вс[еe]го\s+к\s+оплате/iu.test(x));
 const footerMatch=totalLines.length>0 || /вс[еe]го\s+к\s+оплате/iu.test(footer.join('\n'));
 const printedCents=footer.slice(0,15).flatMap(moneyValues);
 const matchesFooter=footerMatch&&printedCents.includes(sumCents);
 if(!footerMatch)warnings.push('Нет надёжного итога «Всего к оплате»');
 else if(!matchesFooter)warnings.push('Итог накладной не совпадает с суммой товарных строк');
 const supplier='ШАНХАЙ-ТОРГ';
 const heading=lines.slice(0,first).join(' ');
 const dates=Array.from(heading.matchAll(/\b(\d{2})[.](\d{2})[.](20\d{2})\b/gu),x=>`${x[3]}-${x[2]}-${x[1]}`);
 const numberMatch=heading.match(/(?:УПД|Счет-?фактура|Счёт-?фактура)\s*№\s*([A-ZА-ЯЁ0-9]{5,})/iu);
 const docNumber=numberMatch?numberMatch[1].replace(/[OoОо]/gu,'0'):null;
 const unique=items.map(x=>x.article).filter(Boolean);
 if(new Set(unique).size!==unique.length)warnings.push('Повторяющиеся артикулы');
 if(!docNumber)warnings.push('Номер документа требует проверки');
 if(!dates.length)warnings.push('Дата документа требует проверки');
 const complete=matchesFooter&&items.every(x=>!x.issues.length)&&new Set(unique).size===unique.length&&!!docNumber&&!!dates.length;
 return {status:complete?'review':'incomplete',verified:false,reason:complete?'Распределено по строкам; визуальное подтверждение обязательно':'Неполная или сомнительная привязка',supplier,number:docNumber,date:dates.at(-1)||null,items,printedTotalRub:matchesFooter?sumCents/100:null,calculatedTotalRub:sumCents/100,warnings,ocrRawPreserved:true};
}
function recognizeOcrText(raw){return parseShanghai(raw);}
module.exports={recognizeOcrText,parseShanghai,parsePack,rowAnchor,cleanNameFragment};