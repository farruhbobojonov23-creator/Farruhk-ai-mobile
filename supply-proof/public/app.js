'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const fmt=new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB'});
 const state={rows:[],invoice:null,ocrSource:'manual',scans:0,boxPages:[]};
 for(let n=1;n<=250;n++){const o=document.createElement('option');o.value=String(n);o.textContent=String(n);$('expected').append(o)}
 const escape=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const num=v=>{const n=Number(String(v??'').replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)?n:NaN};
 const money=n=>fmt.format(n);
 const safe=val=>Number.isFinite(val)?val:0;
 const warning=(msg,ok=false)=>{const n=$('state');n.textContent=msg;n.className='message '+(ok?'ok':'warning')};
 function chooseUnit(item){if(item.pack?.volumeL)return ['л',item.pack.volumeL];if(item.pack?.weightKg)return ['кг',item.pack.weightKg];return ['шт',1]}
 function adapt(item){const [packUnit,packSize]=chooseUnit(item);return {name:item.name||'',article:item.article||'',qty:item.quantity||'',unit:item.unit||'',price:item.unitPriceRub??'',packUnit,packSize,source:item.sourceLines||[],issues:item.issues||[],marked:false}}
 function rowHTML(r,i){const invalid=(r.issues||[]).length>0;
  return `<div class="item ${invalid?'invalid':''}" data-ix="${i}"><div class="item-header"><span>${i+1}</span><input aria-label="Наименование товара ${i+1}" data-k="name" value="${escape(r.name)}" placeholder="Полное название из накладной"><button data-remove="${i}" type="button" aria-label="Удалить товар">×</button></div><div class="fields"><label>Артикул<input data-k="article" value="${escape(r.article)}" placeholder="По документу"></label><label>Количество<input type="number" inputmode="decimal" step="any" min="0.001" data-k="qty" value="${escape(r.qty)}"></label><label>Ед. из накладной<select data-k="unit">${['шт','кг','л','уп','пар'].map(s=>`<option ${r.unit===s?'selected':''}>${s}</option>`).join('')}</select></label><label>Цена за ед., ₽<input type="number" inputmode="decimal" step="0.01" min="0" data-k="price" value="${escape(r.price)}"></label><label>Фасовка<input type="number" inputmode="decimal" step="any" min="0" data-k="packSize" value="${escape(r.packSize)}"></label><label>Фасовка, ед.<select data-k="packUnit">${['шт','кг','л','уп','пар'].map(s=>`<option ${r.packUnit===s?'selected':''}>${s}</option>`).join('')}</select></label><label>Общий объём / масса<input data-total-measure readonly></label><label>Цена за кг/л/шт<input data-rate readonly></label></div><div class="rowfooter"><small>${invalid?'⚠ Требует проверки: '+escape(r.issues.join('; ')):'ℹ Сверьте название с фотографией'}</small><strong data-rowtotal>—</strong></div>${r.source.length?`<details><summary class="tab">Показать исходные строки OCR</summary><pre>${escape(r.source.join('\n'))}</pre></details>`:''}</div>`}
 function update(){state.rows=[];let total=0,problems=[];
  const boxes=[...$('rows').querySelectorAll('.item')];
  for(let i=0;i<boxes.length;i++){
   const el=boxes[i],read=k=>el.querySelector(`[data-k="${k}"]`)?.value||'';
   const q=num(read('qty')),price=num(read('price')),pack=num(read('packSize'));
   const row={name:read('name').trim(),article:read('article').trim(),quantity:q,unit:read('unit'),unitPriceRub:price,packSize:pack,packUnit:read('packUnit')};
   state.rows.push(row);
   if(!row.name)problems.push(`Товар ${i+1}: название пустое`);
   if(!row.unit)problems.push(`Товар ${i+1}: выберите единицу измерения`);if(!(q>0&&price>0))problems.push(`Товар ${i+1}: проверьте количество и цену`);
   if(!(pack>0))problems.push(`Товар ${i+1}: укажите фасовку`);
   const line=q*price;total+=safe(line);
   el.querySelector('[data-rowtotal]').textContent=money(safe(line));
   el.querySelector('[data-total-measure]').value=(q>0&&pack>0?(q*pack).toLocaleString('ru-RU',{maximumFractionDigits:4})+' '+row.packUnit:'—');
   el.querySelector('[data-rate]').value=(pack>0&&price>0?(price/pack).toLocaleString('ru-RU',{maximumFractionDigits:3})+' ₽/'+row.packUnit:'—');
  }
  $('sum').textContent=money(total);
  if(boxes.length>250)problems.push('Больше 250 товарных позиций');
  if(boxes.length===0)problems.push('Нет товарных строк');
  const expected=num($('expected').value);if(expected>0&&boxes.length!==expected)problems.push(`Ожидается ${expected} строк, найдено ${boxes.length}`);
  const printed=state.invoice?.printedTotalRub;
  if(printed!=null && Math.abs(total-printed)>0.011)problems.push(`Сумма ${money(total)} не совпадает с напечатанными ${money(printed)}`);
  if(!$('supplier').value.trim())problems.push('Поставщик не указан');
  if(!$('number').value.trim())problems.push('Номер накладной не указан');
  if(!$('date').value)problems.push('Дата не указана');
  if(boxes.length&&boxes.length!==new Set(state.rows.map(x=>x.article).filter(Boolean)).size&&state.rows.every(x=>x.article))problems.push('Повторяющиеся артикулы');
  const ready=problems.length===0;
  const checked=$('reviewed').checked;
  $('integrity').textContent=problems.length?`⚠ ${problems.join('; ')}.`:`${checked?'✓':'⚠'} Арифметика корректна; ${checked?'ручная сверка подтверждена оператором':'нужна ручная сверка с оригиналом'}.`;
  $('integrity').className='message '+(ready&&checked?'ok':'warning');
  $('exportJson').disabled=$('exportCsv').disabled=!ready||!checked;
  return {total,problems,ready,checked};
 }
 function render(){ $('rows').innerHTML=state.display.map(rowHTML).join('');$('rows').querySelectorAll('[data-remove]').forEach(btn=>btn.addEventListener('click',()=>{state.display.splice(Number(btn.dataset.remove),1);$('reviewed').checked=false;render()}));$('rows').querySelectorAll('input:not([readonly]),select').forEach(el=>el.addEventListener('input',()=>{$('reviewed').checked=false;update()}));update(); }
 function apply(text){$('reviewed').checked=false;
  const legacy=window.FARUKH_RECOGNIZER.recognizeOcrText(text);
  const structured=window.FARUKH_LAYOUT?.parseSupplierDelimited(text);
  let result=legacy;
  if(structured?.documentVerified && structured.items?.length){
   const heading=String(text).slice(0,2500);
   const doc=heading.match(/(?:накладная|сч[её]т[- ]фактура|упд|реализация)\s*№\s*([A-Za-zА-Яа-яЁё0-9\/-]{3,35})\s+от\s+(\d{1,2})[.\/](\d{1,2})[.\/](20\d{2})/iu);
   const iso=doc?doc[4]+'-'+doc[3].padStart(2,'0')+'-'+doc[2].padStart(2,'0'):null;
   const dt=iso?new Date(iso):null;const parsedDate=dt&&!Number.isNaN(dt.getTime())&&dt.toISOString().slice(0,10)===iso?iso:null;
   result={...legacy,supplier:structured.supplier||legacy.supplier,number:legacy.number||doc?.[1]||null,date:legacy.date||parsedDate,
    status:'review',verified:false,printedTotalRub:structured.printedTotal,
    calculatedTotalRub:structured.items.reduce((a,x)=>a+Math.round(x.invoiceTotal*100),0)/100,
    warnings:[...(structured.warnings||[]),'Сверьте каждую строку с оригиналом перед экспортом.'],
    items:structured.items.map((x,i)=>({index:i+1,article:x.article||'',
     name:x.name,quantity:x.quantity,unit:x.unit,unitPriceRub:x.price,lineTotalRub:x.invoiceTotal,
     pack:window.FARUKH_RECOGNIZER.parsePack?.(x.name)||null,
     issues:x.unit?[]:['Неопределённая единица измерения'],
     sourceLines:['Товарная строка '+x.sourceRow+' распознанного текста']}))};
  }
  const candidate=state.boxPages.length===1?window.FARUKH_SPATIAL.parse(state.boxPages[0],
 {supplier:result.supplier||detect(text),number:result.number,date:result.date,printedTotalRub:result.printedTotalRub}):null;
  if(candidate&&candidate.items.length>result.items.length)result=candidate;
  // Use article-bounded OCR geometry for the explicitly identified supplier.
  // A partial match stays marked INCOMPLETE: it is never silently exported.
  if(state.boxPages.length===1&&window.FARUKH_MARR_BLOCK){
   const marr=window.FARUKH_MARR_BLOCK.parse(state.boxPages[0],
    {supplier:result.supplier||detect(text),number:result.number,date:result.date,printedTotalRub:result.printedTotalRub});
   if(marr.items.length>result.items.length)result=marr;
  }
  state.invoice=result;state.display=(result.items||[]).map(adapt);$('supplier').value=result.supplier||detect(text)||'';$('number').value=result.number||'';$('date').value=result.date||'';$('expected').value=String(result.items?.length||0);render();
  const issues=[...(result.warnings||[])];
  if(result.status==='unsupported')warning('OCR получен, но структура этого поставщика пока не поддерживается. Ничего не подставляю наугад. Добавьте строки для ручной проверки.');
  else if(result.status==='incomplete')warning('Таблица распознана частично. '+(issues.join('; ')||'Проверьте исходные строки')); 
  else warning(`Выделено ${result.items.length} позиций, сумма по строкам ${money(result.calculatedTotalRub)}. ${issues.length?issues.join('; '):'Сверьте с фото до экспорта.'}`,false);
 }
 function detect(t){const m=String(t).toUpperCase();const profiles=[['ШАНХАЙ-ТОРГ',/ШАНХАЙ\s*[-–—]?\s*ТОРГ/u],['АЛИДИ',/АЛИДИ/u],['ВЕСТА',/ВЕСТА/u],['ВИРГО',/ВИРГО/u],['ЧИСТЯКОВА',/ЧИСТЯКОВ/u],['ВОСТОК-ЗАПАД',/ВОСТОК\s*[-–—]?\s*ЗАПАД/u],['МАРР РУССИЯ',/МАРР\s*РУСС/u]];return profiles.find(x=>x[1].test(m))?.[0]||''}
 $('parse').onclick=()=>{state.ocrSource='manual-paste';state.boxPages=[];apply($('raw').value)};
 $('demo').onclick=()=>{const sample=['Счет-фактура № DEMO1234 от 17.11.2026','ООО «ШАНХАЙ-ТОРГ»','A 1','Тестовый продукт 1 кг','6e3 % 18,18 200,00','796 ШТ 2,000 90,91 100,00 181,82','X1001 1','Новый продукт 2 л','6e3 % 36,36 400,00','796 ШТ 2,000 181,82 200,00 363,64','X1002 2','Всего к оплате 600,00'].join('\n');$('raw').value=sample;apply(sample);warning('СИНТЕТИЧЕСКИЙ пример — не результат реальной накладной.',false)};
 $('clear').onclick=()=>{state.display=[];state.invoice=null;state.boxPages=[];$('raw').value='';$('supplier').value='';$('number').value='';$('date').value='';$('expected').value='0';$('reviewed').checked=false;render();warning('Очищено. Ранее введённые данные не загружались в облако.',true)};
 $('add').onclick=()=>{if(state.display.length>=250)return warning('Ограничение 250 позиций на одной странице; добавьте другую страницу.');state.display.push({name:'',article:'',qty:'',unit:'шт',price:'',packSize:1,packUnit:'шт',source:[],issues:['Ручной ввод']});$('reviewed').checked=false;render()};
 ['supplier','number','date','expected'].forEach(id=>$(id).addEventListener('input',()=>{$('reviewed').checked=false;update()}));$('reviewed').onchange=()=>update();
 $('photo').onchange=()=>{const images=[...$('photo').files].slice(0,20);$('previews').innerHTML='';for(const f of images){const el=new Image();el.src=URL.createObjectURL(f);el.onload=()=>URL.revokeObjectURL(el.src);el.alt='Исходная страница';$('previews').append(el)};warning('Выбрано страниц: '+images.length+'. Фото остаются локально. Нажмите «Распознать фото».',true)};
 $('runOcr').onclick=async()=>{const images=[...$('photo').files];if(!images.length)return warning('Сначала выберите фотографию.');const out=[],boxPages=[];$('runOcr').disabled=true;try{for(let i=0;i<images.length;i++){warning(`Распознавание страницы ${i+1}/${images.length}. Для сложных фотографий может потребоваться около минуты.`);const r=await fetch('/ocr',{method:'POST',headers:{'Content-Type':images[i].type},body:images[i]});const payload=await r.json();if(!r.ok)throw Error(payload.error||'OCR недоступен');out.push(payload.text);boxPages.push(payload.boxes||[])}state.boxPages=boxPages;$('raw').value=out.join('\n---\n');state.scans=images.length;state.ocrSource='local-tesseract';apply($('raw').value); }catch(e){warning('Автоматическое OCR не завершилось: '+e.message+'. Можно вставить распознанный текст вручную.');}finally{$('runOcr').disabled=false}};
 function doc(){const x=update();if(!x.ready||!x.checked)return null;return {schema:'farukh-supply-isolated-review-v1',checkedByOperator:true,source:state.ocrSource,supplier:$('supplier').value.trim(),number:$('number').value.trim(),date:$('date').value,items:state.rows.map(x=>({...x,lineTotalRub:Math.round(x.quantity*x.unitPriceRub*100)/100,totalMeasure:x.quantity*x.packSize,comparisonRateRub:x.unitPriceRub/x.packSize,comparisonUnit:x.packUnit})),totalRub:Math.round(x.total*100)/100};}
 function download(filename,body,type){const blob=new Blob([body],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 $('exportJson').onclick=()=>{const value=doc();if(value)download('farukh-supply-verified.json',JSON.stringify(value,null,2),'application/json;charset=utf-8')};
 $('exportCsv').onclick=()=>{const value=doc();if(!value)return;const cols=['article','name','quantity','unit','packSize','packUnit','unitPriceRub','lineTotalRub','comparisonRateRub','comparisonUnit'];const cell=v=>{const txt=String(v??'');return '"'+(/^[=+\-@]/.test(txt)?"'":"")+txt.replaceAll('"','""')+'"'};download('farukh-supply-verified.csv','\ufeff'+[cols.map(cell).join(';'),...value.items.map(item=>cols.map(x=>cell(item[x])).join(';'))].join('\r\n'),'text/csv;charset=utf-8')};
 state.display=[];render();
})();