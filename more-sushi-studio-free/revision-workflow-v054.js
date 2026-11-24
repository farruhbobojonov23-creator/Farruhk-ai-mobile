/* FARUKH REVISION PRO 0.5.4 — clear chef-led inventory workflow.
 * Preserves stock maths, stored audits, cloud authentication, local drafts and branding.
 * All imports are local drafts until the user explicitly saves the revision.
 */
(()=>{
 'use strict';
 const el=id=>document.getElementById(id);
 const ru=(value,d=3)=>Number(value||0).toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d});
 const esc=v=>safe(String(v===null||v===undefined?'':v));
 const menus=()=>document.querySelectorAll('.menu button');
 const selection=()=>el('store').value;
 const mode=()=>el('mode').value;
 const hasBaseline=store=>state.history.some(r=>r.store===store && r.type==='start');
 const latest=store=>state.history.filter(r=>r.store===store)
  .sort((a,b)=>(Number(b.timestamp)||0)-(Number(a.timestamp)||0))[0]||null;
 const $create=(tag,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;return n};
 function normalDate(v){const s=String(v||'');return /^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(8,10)+'.'+s.slice(5,7)+'.'+s.slice(0,4):s}
 function preferredMode(store){return hasBaseline(store)?'weekly':'start'}
 function launchRevision(store){
  if(![...el('store').options].some(o=>o.value===store))return;
  if(typeof rev040Snapshot==='function')rev040Snapshot();
  el('store').value=store;
  el('mode').value=preferredMode(store);
  refresh();
  go('revision',menus()[1]);
  requestAnimationFrame(()=>el('rev054Flow')?.scrollIntoView({block:'start',behavior:'smooth'}));
 }
 // The entire main screen is a clear three-step process, not a dashboard of unlabelled numbers.
 let guide=el('rev054Guide');
 if(!guide){
  guide=$create('section','rev054-guide');guide.id='rev054Guide';
  el('view-summary').prepend(guide);
 }
 function updateGuide(){
  if(!el('view-summary')||!guide.isConnected)return;
  const store=selection(),first=hasBaseline(store),last=latest(store),next=preferredMode(store);
  const word=next==='start'?'Начать первую ревизию':'Начать повторную ревизию';
  const stateLine=first?('Начальная база есть. '+(last?'Последняя запись: '+normalDate(last.date):'Можно проводить сверку.')):
   'Для этой точки начальные остатки ещё не сохранены.';
  guide.innerHTML='<div class="rev054-eyebrow">ПРОСТАЯ РЕВИЗИЯ · 3 ШАГА</div>'+
   '<h2>Проверяй остатки без путаницы</h2>'+
   '<div class="rev054-three"><span><b>1</b> Взвесь продукты</span>'+
   '<span><b>2</b> Установи базу во Frontpad</span>'+
   '<span><b>3</b> Через неделю сравни</span></div>'+
   '<p class="rev054-guide-status"><strong>'+esc(store)+'</strong> · '+esc(stateLine)+'</p>'+
   '<button type="button" class="btn main rev054-main-action" id="rev054Begin">'+word+' <span aria-hidden="true">→</span></button>'+
   '<details class="rev054-explain"><summary>Как это работает?</summary>'+
   '<p><b>В первый день:</b> взвесь склад и ПФ, сохрани начальные остатки и вручную установи эти значения во Frontpad.</p>'+
   '<p><b>При следующей проверке:</b> введи учёт из Frontpad, затем фактический вес. Программа рассчитает расхождения в килограммах.</p>'+
   '<p><b>Стоимость:</b> укажи закупочную цену ₽/кг, чтобы увидеть рубли. Прямого подключения к Frontpad сейчас нет.</p></details>';
  el('rev054Begin').addEventListener('click',()=>launchRevision(store));
 }
 const priorSummary=renderSummary;
 renderSummary=function(){
  priorSummary();
  updateGuide();
  // Remove the old click handlers so one tap cannot open a wrong mode twice.
  for(const tile of [...el('summaryCards').querySelectorAll('[data-rev053-store]')]){
   const name=tile.dataset.rev053Store;
   const newer=tile.cloneNode(true);
   tile.replaceWith(newer);
   const open=()=>launchRevision(name);
   newer.querySelector('.point-open').textContent=hasBaseline(name)?'Провести сверку →':'Начальные остатки →';
   newer.querySelector('.point-open').addEventListener('click',e=>{e.stopPropagation();open()});
   newer.addEventListener('click',open);
   newer.setAttribute('role','group');
   newer.setAttribute('aria-label','Точка '+name);
  }
  // This is the last persisted audit, not a partially entered draft.
  el('view-summary').setAttribute('data-values','saved-only');
 };
 // The revision explains the distinction between the three quantities.
 let flow=el('rev054Flow');
 if(!flow){
  flow=$create('section','rev054-flow');flow.id='rev054Flow';
  el('view-revision').insertBefore(flow,el('view-revision').firstElementChild);
 }
 let finalBox=el('rev054Final');
 if(!finalBox){
  finalBox=$create('section','rev054-final');finalBox.id='rev054Final';
  const buttonRow=el('view-revision').querySelector('.tablewrap + .row');
  buttonRow?.parentNode.insertBefore(finalBox,buttonRow);
 }
 function inspectDraft(){
  const start=mode()==='start';
  const values=[];
  let done=0,shortKg=0,extraKg=0,shortRub=0,extraRub=0,missingPrices=0,matching=0;
  for(const name of state.products){
   const v=getDraft(name),real=weightOf(name,v);
   const program=start?real:(v.program===''?null:number(v.program));
   const price=v.price===''?null:number(v.price);
   const valid=real!==null && program!==null;
   const diff=valid?Math.round((real-program)*1000)/1000:null;
   if(valid)done++;
   if(!start&&valid){
    if(diff<0)shortKg+=-diff;else if(diff>0)extraKg+=diff;else matching++;
    if(diff!==0){
     if(price===null || price<=0)missingPrices++;
     else if(diff<0)shortRub+=-diff*price;else extraRub+=diff*price;
    }
   }
   values.push({name,valid,real,program,diff,price});
  }
  return {start,values,done,total:state.products.length,shortKg,extraKg,shortRub,extraRub,missingPrices,matching};
 }
 function reviewResults(){
  const d=inspectDraft();
  if(!d.total){finalBox.innerHTML='<b>Добавьте хотя бы один продукт во вкладке «Товары».</b>';return}
  if(d.done<d.total){
   finalBox.innerHTML='<div class="rev054-result-title">Итог ревизии</div><div class="rev054-notice">'+
    'Заполнено <b>'+d.done+' из '+d.total+'</b>. Осталось '+(d.total-d.done)+
    ' позиций. Пустое поле означает «не проверено», а не ноль.</div>'+
    '<button type="button" class="btn soft" id="rev054FindMissing">Перейти к незаполненному →</button>';
   el('rev054FindMissing')?.addEventListener('click',()=>{
    const i=d.values.findIndex(x=>!x.valid),row=el('rows').querySelectorAll('tr[data-product]')[i];
    if(!row)return;
    const details=row.querySelector('details.rev-product');if(details)details.open=true;
    row.scrollIntoView({behavior:'smooth',block:'center'});
    setTimeout(()=>{const inputs=[...row.querySelectorAll('input')];const missing=inputs.find(input=>input.dataset.field!=='price'&&input.value==='');missing?.focus()},350);
   });
   return;
  }
  const priceWarning=d.missingPrices?
   '<p class="rev054-price-warning">⚠ У '+d.missingPrices+' позиций с расхождениями нет цены. Рубли не рассчитаны полностью.</p>':'';
  if(d.start){
   finalBox.innerHTML='<div class="rev054-result-title">✓ Начальные остатки готовы</div>'+
    '<p>Сохраните фактический вес. После этого вручную установите эти же остатки во Frontpad — только потом начинайте сравнения.</p>'+
    '<div class="rev054-result-line"><span>Проверено продуктов</span><b>'+d.done+' / '+d.total+'</b></div>';
  }else{
   finalBox.innerHTML='<div class="rev054-result-title">✓ Результат повторной ревизии · черновик</div>'+
    '<div class="rev054-results"><div><small>🔴 Недостача</small><strong>− '+ru(d.shortKg)+' кг</strong>'+
    '<span>'+(d.missingPrices?'Цена не у всех':ru(d.shortRub,2)+' ₽')+'</span></div>'+
    '<div><small>🟢 Излишек</small><strong>+ '+ru(d.extraKg)+' кг</strong>'+
    '<span>'+(d.missingPrices?'Цена не у всех':ru(d.extraRub,2)+' ₽')+'</span></div></div>'+
    '<div class="rev054-result-line"><span>Совпадений / Проверено</span><b>'+d.matching+' / '+d.done+'</b></div>'+priceWarning;
  }
  finalBox.innerHTML+='<p class="rev054-save-note">Это предварительный итог. В историю он попадёт только после нажатия «Сохранить».</p>';
 }
 function progress(){
  if(!el('rev054Flow'))return;
  const d=inspectDraft(),pct=d.total?Math.round(100*d.done/d.total):0,first=d.start;
  const header=first?'Шаг 1. Зафиксируй начальные остатки':'Шаг 2. Сверь Frontpad со складом';
  flow.innerHTML='<div class="rev054-flow-top"><span class="rev054-flow-eyebrow">'+
   (first?'НАЧАЛЬНАЯ РЕВИЗИЯ':'ПОВТОРНАЯ РЕВИЗИЯ')+' · ЧЕРНОВИК</span>'+
   '<strong>'+esc(selection())+'</strong></div>'+
   '<h2>'+header+'</h2>'+
   '<p>'+(first?'Введите вес на складе и вес полуфабрикатов. Учётные остатки пока не сравниваются.':
    'Сначала укажи остаток по Frontpad, затем вес на складе и ПФ. Разница появится автоматически.')+'</p>'+
   '<div class="rev054-progress-meta"><span>Проверено '+d.done+' из '+d.total+'</span><b>'+pct+'%</b></div>'+
   '<div class="rev054-progress-track" role="progressbar" aria-label="Заполнение ревизии" aria-valuenow="'+d.done+
   '" aria-valuemax="'+d.total+'" aria-valuemin="0"><span style="width:'+pct+'%"></span></div>'+
   '<div class="rev054-flow-tools"><button type="button" class="btn soft" id="rev054Jump">К результатам ↓</button>'+
   (!first?'<button type="button" class="btn soft" id="rev054Upload">Импорт учёта CSV</button>':'')+'</div>';
  el('rev054Jump')?.addEventListener('click',()=>{
   reviewResults();finalBox.scrollIntoView({block:'center',behavior:'smooth'});
  });
  el('rev054Upload')?.addEventListener('click',()=>el('rev054CsvFile')?.click());
  for(const [i,item] of d.values.entries()){
   const row=el('rows').querySelectorAll('tr[data-product]')[i],details=row?.querySelector('.rev-product');
   if(!details)continue;
   details.classList.toggle('rev054-filled',item.valid);
   details.classList.toggle('rev054-missing',!item.valid);
   details.classList.toggle('rev054-shortage',!first&&item.diff!==null&&item.diff<0);
   details.classList.toggle('rev054-surplus',!first&&item.diff!==null&&item.diff>0);
   details.classList.toggle('rev054-match',!first&&item.diff===0);
   const total=details.querySelector('.product-total');
   if(total){let status=total.querySelector('.rev054-product-status');
    if(!status){status=$create('small','rev054-product-status');total.appendChild(status)}
    status.textContent=!item.valid?'Не заполнено':first?'Взвешено':item.diff<0?'Недостача':item.diff>0?'Излишек':'Совпадает';
   }
  }
  reviewResults();
 }
 const oldRenderRows=renderRows;
 renderRows=function(){
  oldRenderRows();
  for(const [i,row] of [...el('rows').querySelectorAll('tr[data-product]')].entries()){
   const product=row.querySelector('.product-heading');
   if(product&&!product.querySelector('.rev054-item-n')){
    const n=$create('span','rev054-item-n');n.textContent=String(i+1).padStart(2,'0')+' / '+state.products.length;
    product.prepend(n);
   }
   const priceLabel=row.querySelector('.rev-advanced > summary');
   if(priceLabel)priceLabel.textContent='💰 Закупочная цена за кг (необязательно) ▾';
   const acc=row.querySelector('.rev-advanced');
   if(acc && !acc.querySelector('.rev054-price-tip')){
    const tip=$create('small','rev054-price-tip');
    tip.textContent='Нужна только для расчёта недостачи и излишка в рублях.';
    acc.appendChild(tip);
   }
  }
  progress();
 };
 const oldCalc=calculate;
 calculate=function(){oldCalc();if(active==='revision')progress()};
 const oldGo=go;
 go=function(view,button){
  // New locations begin from a baseline; existing locations can be checked again.
  if(view==='revision'&&!hasBaseline(selection())&&mode()==='weekly'){
   if(typeof rev040Snapshot==='function')rev040Snapshot();
   el('mode').value='start';
   refresh();
  }
  const result=oldGo(view,button);
  el('revisionSelectors')?.classList.toggle('hide',view==='products'||view==='summary' ? view==='products':false);
  document.body.classList.toggle('rev054-products',view==='products');
  document.body.classList.toggle('rev054-revision',view==='revision');
  if(view==='summary')updateGuide()
  if(view==='revision')progress();
  return result;
 };
 const oldHistory=renderHistory;
 renderHistory=function(){
  oldHistory();
  const empty=el('rev053Start');
  if(empty){
   const replacement=empty.cloneNode(true);empty.replaceWith(replacement);
   replacement.addEventListener('click',()=>launchRevision(selection()));
  }
 };
 const oldSave=saveRevision;
 saveRevision=async function(){
  const d=inspectDraft();
  if(d.total && d.done<d.total){
   notice('Сначала проверь все продукты: '+d.done+' из '+d.total);
   progress();finalBox.scrollIntoView({block:'center',behavior:'smooth'});return;
  }
  const previousIds=new Set(state.history.map(record=>record.id));
  await oldSave();
  const created=state.history.find(record=>!previousIds.has(record.id));
  if(created){
   go('history',menus()[2]);
   notice(created.pendingSync
    ?'Сохранено на устройстве. Отправится в облако после синхронизации.'
    :'Ревизия сохранена. Результат открыт в истории.');
  }
 };
 // Hide confusing filters on the product catalogue. All outlets use the same products.
 const priorProducts=renderProducts;
 renderProducts=function(){
  priorProducts();
  const root=el('view-products');
  if(!el('rev054CatalogIntro')){
   const n=$create('div','rev054-catalog-intro');
   n.id='rev054CatalogIntro';
   n.innerHTML='<strong>Единый список товаров</strong><p>Одинаков для всех четырёх точек. Здесь можно добавить продукт или настроить ПФ. Закупочную цену вводят при ревизии.</p>';
   root.querySelector('.desc')?.after(n);
  }
  [...root.querySelectorAll('#productsrows tr')].forEach((tr,index)=>{
   if(tr.querySelector('.rev054-edit-pf'))return;
   const name=state.products[index];if(!name)return;
   const config=$create('button','btn soft rev054-edit-pf');
   config.type='button';
   config.textContent='⚙ Настроить ПФ';
   config.addEventListener('click',()=>openPf(name));
   const first=tr.querySelector('td:first-child');
   if(first)first.appendChild(config);
  });
 };
 let pfDialog=el('rev054PfDialog');
 if(!pfDialog){
  pfDialog=$create('dialog','rev054-dialog');pfDialog.id='rev054PfDialog';
  pfDialog.innerHTML='<form id="rev054PfForm"><h2>Настройка продукта</h2>'+
   '<strong id="rev054PfName"></strong><label class="rev054-check"><input id="rev054HasPf" type="checkbox"> Учитывать полуфабрикаты</label>'+
   '<label class="rev054-pf-field">Добавка к весу ПФ, % <input id="rev054PfPercent" type="number" min="0" max="100" step="0.1" inputmode="decimal" required></label>'+
   '<p>Пример: ПФ 2 кг, добавка 20% → к факту прибавится 2,4 кг. Проверьте, соответствует ли правило вашей технологии.</p>'+
   '<div class="rev054-dialog-actions"><button class="btn" id="rev054PfCancel" type="button">Отмена</button>'+
   '<button class="btn main" type="submit" id="rev054PfSave">Сохранить правило</button></div>'+
   '<small id="rev054PfMessage" aria-live="polite"></small></form>';
  document.body.appendChild(pfDialog);
 }
 let pfName='';
 function hideDialog(dialog){if(typeof dialog.close==='function'&&dialog.open)dialog.close();else dialog.removeAttribute('open')}
 function showDialog(dialog){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','')}
 function openPf(name){
  if(!cloudEnabled){notice('Настройки ПФ доступны после подключения облака');return}
  pfName=name;
  const product=rev041Catalogue.get(name);
  if(!product){notice('Дождитесь синхронизации каталога');return}
  el('rev054PfName').textContent=name;
  el('rev054HasPf').checked=Boolean(product.has_semi_finished);
  el('rev054PfPercent').value=String(Number(product.pf_add_percent)||0);
  el('rev054PfPercent').disabled=!product.has_semi_finished;
  el('rev054PfMessage').textContent='';
  showDialog(pfDialog);
 }
 el('rev054HasPf').addEventListener('change',e=>{
  el('rev054PfPercent').disabled=!e.target.checked;
  if(!e.target.checked)el('rev054PfPercent').value='0';
 });
 el('rev054PfCancel').addEventListener('click',()=>hideDialog(pfDialog));
 el('rev054PfForm').addEventListener('submit',async event=>{
  event.preventDefault();
  if(!cloudEnabled)return;
  const hasPf=el('rev054HasPf').checked,percent=Number(el('rev054PfPercent').value);
  if(!Number.isFinite(percent)||percent<0||percent>100){el('rev054PfMessage').textContent='Процент должен быть от 0 до 100';return}
  const button=el('rev054PfSave');button.disabled=true;
  try{
   await rest('revision_products',{method:'PATCH',query:'?name=eq.'+encodeURIComponent(pfName),
    body:{has_semi_finished:hasPf,pf_add_percent:hasPf?percent:0}});
   hideDialog(pfDialog);
   await loadCloud();
   notice('Правило полуфабриката обновлено');
  }catch(e){el('rev054PfMessage').textContent='Ошибка: '+String(e.message||e)}
  finally{button.disabled=false}
 });
 // Generic CSV import: only recognised product names and numeric accounting balances;
 // never infer a Frontpad integration or overwrite actual weighed values.
 function normalize(v){return String(v||'').trim().toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/\s+/g,' ')}
 function parseCsv(source){
  const first=source.split(/\r?\n/,1)[0]||'';
  const counts=[';','\t',','].map(delim=>({delim,n:first.split(delim).length}));
  counts.sort((a,b)=>b.n-a.n);
  const delim=counts[0].n>1?counts[0].delim:';';
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<source.length;i++){
   const c=source[i];
   if(c==='"'){
    if(quoted&&source[i+1]==='"'){field+='"';i++}
    else quoted=!quoted;
   }else if(c===delim&&!quoted){row.push(field);field=''}
   else if((c==='\n'||c==='\r')&&!quoted){
    if(c==='\r'&&source[i+1]==='\n')i++;
    row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';
   }else field+=c;
  }
  if(quoted)throw Error('Незакрытые кавычки в CSV');
  row.push(field);if(row.some(v=>v.trim()))rows.push(row);
  return rows;
 }
 function parseBalanceCsv(csv){
  const rows=parseCsv(csv.replace(/^\uFEFF/,''));
  if(!rows.length)throw Error('CSV пуст');
  const head=rows[0].map(normalize);
  const nameIdx=head.findIndex(v=>/(^|[^а-я])(продукт|товар|номенклатура|наименование|название)([^а-я]|$)/.test(v));
  const qtyIdx=head.findIndex(v=>/(остаток|количество|кол-во|учет|учёт)/.test(v));
  if(nameIdx<0||qtyIdx<0||nameIdx===qtyIdx)throw Error('Нужны столбцы «Продукт» и «Остаток (кг)»');
  const originalHead=String(rows[0][qtyIdx]||'').toLowerCase();
  const grams=/\bграмм|\bг\b|[\(\[]г[\)\]]/.test(originalHead)&&!/(кг|килограмм)/.test(originalHead);
  const known=new Map(state.products.map(p=>[normalize(p),p]));
  const found=new Map(),duplicates=new Set();let skipped=0;
  for(const row of rows.slice(1)){
   const original=String(row[nameIdx]||''),key=normalize(original),product=known.get(key);
   const raw=String(row[qtyIdx]||'').trim().replace(/\s/g,'').replace(',','.');
   if(!product){skipped++;continue}
   if(!/^\d{1,10}(?:\.\d{1,3})?$/.test(raw)){skipped++;continue}
   if(found.has(product)){duplicates.add(product);continue}
   const value=Number(raw)/(grams?1000:1);
   if(!Number.isFinite(value)||value<0||value>1000000){skipped++;continue}
   found.set(product,value);
  }
  for(const dup of duplicates)found.delete(dup);
  return {matched:[...found].map(([name,value])=>({name,value})),skipped,duplicates:[...duplicates],grams};
 }
 let csvFile=el('rev054CsvFile');
 if(!csvFile){
  csvFile=$create('input');csvFile.id='rev054CsvFile';
  csvFile.type='file';csvFile.accept='.csv,text/csv,.txt';
  csvFile.hidden=true;document.body.appendChild(csvFile);
 }
 let csvDialog=el('rev054CsvDialog');
 if(!csvDialog){
  csvDialog=$create('dialog','rev054-dialog');
  csvDialog.id='rev054CsvDialog';document.body.appendChild(csvDialog);
 }
 csvFile.addEventListener('change',async()=>{
  const f=csvFile.files?.[0];if(!f)return;
  try{
   if(f.size>2*1024*1024)throw Error('Файл слишком большой (максимум 2 МБ)');
   const parsed=parseBalanceCsv(await f.text());
   if(!parsed.matched.length)throw Error('Нет совпадающих товаров. Проверьте названия и заголовки CSV');
   csvDialog.innerHTML='<div class="rev054-import"><h2>Проверка импорта</h2>'+
    '<p>Будут заполнены только поля «Учёт по Frontpad». Фактические веса и сохранённая история не изменятся.</p>'+
    '<div class="rev054-import-list">'+parsed.matched.map(v=>
    '<div><b>'+esc(v.name)+'</b><strong>'+ru(v.value)+' кг</strong></div>').join('')+'</div>'+
    '<small>Совпало '+parsed.matched.length+' · пропущено '+parsed.skipped+
    ' · дубли '+parsed.duplicates.length+'. Единица в исходном файле: '+(parsed.grams?'г':'кг')+'.</small>'+
    '<div class="rev054-dialog-actions"><button type="button" class="btn" id="rev054ImportCancel">Отмена</button>'+
    '<button type="button" class="btn main" id="rev054ImportApply">Заполнить учёт</button></div></div>';
   el('rev054ImportCancel').addEventListener('click',()=>hideDialog(csvDialog));
   el('rev054ImportApply').addEventListener('click',()=>{
    if(mode()==='start'){hideDialog(csvDialog);notice('Для начальной ревизии учёт не требуется');return}
    syncDraft();
    for(const item of parsed.matched){
     const prev=getDraft(item.name);
     draft[item.name]={...prev,program:String(item.value)};
    }
    renderRows();
    rev040Snapshot();
    hideDialog(csvDialog);
    notice('Учёт заполнен из CSV: '+parsed.matched.length+' продуктов. Проверьте веса и сохраните ревизию.');
   });
   showDialog(csvDialog);
  }catch(e){notice('Импорт CSV: '+String(e.message||e))}
  finally{csvFile.value=''}
 });
 // Display the configured workflow right away; future cloud refreshes invoke wrappers.
 const choose=el('store');
 choose?.addEventListener('change',()=>{if(active==='summary')updateGuide()});
 const header=el('view-history')?.querySelector('.sectionheading .desc');
 if(header)header.textContent='Сохранённые проверки по выбранной точке. Нажми на запись, чтобы увидеть продукты.';
 const help=el('view-revision')?.querySelector('.rev-help .desc');
 if(help)help.innerHTML='<b>Начальная ревизия:</b> внеси фактические остатки, сохрани и выровняй их во Frontpad.<br><br>'+
  '<b>Повторная:</b> введи учёт из Frontpad и фактический вес. Сохрани — и результат попадёт в историю.<br><br>'+
  '<b>ПФ +20%:</b> процент прибавляется только к весу полуфабрикатов, когда правило включено для продукта.';
 const toolbar=el('view-revision')?.querySelector('.tablewrap + .row');
 const saveButton=toolbar?.querySelector('button[onclick="saveRevision()"]');
 if(saveButton)saveButton.lastChild.textContent='Проверить и сохранить';
 const clearButton=toolbar?.querySelector('button[onclick="confirmClearDraft()"]');
 if(clearButton)clearButton.title='Очищает только незавершённый ввод, не историю';
 const oldInfo=showRevisionInfo;
 showRevisionInfo=function(){
  notice('FARUKH REVISION PRO 0.5.4 · Пошаговая ревизия, ясные итоги, CSV-учёт, настройки ПФ. Заставка сохранена, рабочие названия больше не печатаются по буквам.');
 };
 if(el('view-summary'))renderSummary();
 if(el('view-products'))renderProducts();
 if(el('view-history'))renderHistory();
 if(el('view-revision'))renderRows();
})();
