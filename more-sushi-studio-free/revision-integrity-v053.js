/* FARUKH REVISION PRO 0.5.3 — reports reflect SAVED history, never unsaved draft.
   Presentation/report fix only. Does not modify audits, cloud permissions or Android signing. */
(()=>{
 'use strict';
 function rev053Stats(record){
 const result={shortageKg:0,surplusKg:0,shortageRub:0,surplusRub:0,missingShort:0,missingSurplus:0,checked:0,matched:0,total:0};
 for(const item of (Array.isArray(record?.products)?record.products:[])){
  result.total++;
  const diff=Number(item?.diff);
  if(!Number.isFinite(diff))continue;
  result.checked++;
  if(Math.abs(diff)<0.0005){result.matched++;continue}
  const price=item?.price===null||item?.price===undefined||item?.price===''?null:Number(item.price);
  const priced=price!==null&&Number.isFinite(price)&&price>0;
  if(diff<0){result.shortageKg+=-diff;if(priced)result.shortageRub+=-diff*price;else result.missingShort++}
  else{result.surplusKg+=diff;if(priced)result.surplusRub+=diff*price;else result.missingSurplus++}
 }
 for(const key of ['shortageKg','surplusKg'])result[key]=Math.round(result[key]*1000)/1000;
 for(const key of ['shortageRub','surplusRub'])result[key]=Math.round(result[key]*100)/100;
 return result;
}
 const el=id=>document.getElementById(id);
 const num=(n,d=2)=>Number(n||0).toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d});
 const text=v=>safe(v===null||v===undefined?'':v);
 const isStart=r=>r.type==='start';
 const stats=rev053Stats;
 const badge=(rub,unpriced,zeroKg)=>unpriced?'нет цены':num(rub)+' ₽';
 const note=(kg,missing)=>num(kg,3)+' кг'+(missing?' · нет цены: '+missing:'');
 const status=r=>r.pendingSync?' · Ожидает облака':'';
 const time=r=>{
  const ts=Number(r.timestamp);if(!Number.isFinite(ts)||ts<=0)return '';
  return new Date(ts).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
 };
 function latestWeekly(store){
  return state.history.filter(r=>r.store===store&&r.type==='weekly')
   .sort((a,b)=>(Number(b.timestamp)||0)-(Number(a.timestamp)||0))[0]||null;
 }
 function allStores(){return [...el('store').options].map(o=>o.value)}
 function fillKpi(index,value,subtitle){
  const card=el('revisionKPIs')?.querySelectorAll('.kpi')[index];
  if(!card)return;
  const valueEl=card.querySelector('.number'),noteEl=card.querySelector('.note');
  if(valueEl)valueEl.textContent=value;
  if(noteEl)noteEl.textContent=subtitle;
 }
 function summaryKpis(){
  if(active!=='summary')return;
  const records=allStores().map(latestWeekly).filter(Boolean);
  const agg={shortageKg:0,surplusKg:0,shortageRub:0,surplusRub:0,missingShort:0,missingSurplus:0,checked:0,matched:0,total:0};
  for(const r of records){
   const s=stats(r);for(const k of Object.keys(agg))agg[k]+=s[k];
  }
  fillKpi(0,records.length?badge(agg.shortageRub,agg.missingShort,agg.shortageKg):'—',
   records.length?note(agg.shortageKg,agg.missingShort):'Нет повторных ревизий');
  fillKpi(1,records.length?badge(agg.surplusRub,agg.missingSurplus,agg.surplusKg):'—',
   records.length?note(agg.surplusKg,agg.missingSurplus):'Нет повторных ревизий');
  fillKpi(2,records.length?agg.matched+' / '+agg.total:'—',
   'По последним сохранённым ревизиям');
  fillKpi(3,records.length?agg.checked+' / '+agg.total:'—',
   'Точек с повторной ревизией: '+records.length+' из '+allStores().length);
  el('revisionKPIs')?.setAttribute('aria-label','Только сохранённые ревизии. Не включает черновики.');
 }
 const originalCalculate=calculate;
 calculate=function(){
  originalCalculate();
  if(active==='summary')summaryKpis();
  else if(active==='revision'){
   const hints=['Предварительный расчёт · ещё не сохранено','Предварительный расчёт · ещё не сохранено',
    'По введённым продуктам · черновик','По введённым продуктам · черновик'];
   for(let i=0;i<4;i++){const card=el('revisionKPIs')?.querySelectorAll('.kpi')[i];if(card)card.querySelector('.note').textContent=hints[i]}
  }
 };
 historyItem=function(r){
  const s=stats(r);
  const heading=(isStart(r)?'Начальные остатки':'Повторная ревизия')+' · '+text(r.date);
  const info=s.total+' позиций · '+text(r.store)+(time(r)?' · '+time(r):'')+status(r);
  const right=isStart(r)?'<b class="rev053-base">База остатков</b>':
   '<b class="red">'+(s.missingShort?'Недостача: нет цены':'− '+badge(s.shortageRub,0,s.shortageKg))+'</b>'+
   '<small>'+(s.missingSurplus?'Излишек: нет цены':'+'+badge(s.surplusRub,0,s.surplusKg))+'</small>';
  const bottom=isStart(r)?'Без расчёта расхождений':
    'Недостача '+note(s.shortageKg,s.missingShort)+' · Излишек '+note(s.surplusKg,s.missingSurplus);
  return '<div class="historyitem rev053-history-item"><div class="rev053-record-copy"><strong>'+heading+
    '</strong><small>'+info+'</small><small class="rev053-kg">'+bottom+'</small></div>'+
    '<div class="rev053-money">'+right+'</div></div>';
 };
 const originalSummary=renderSummary;
 renderSummary=function(){
  const stores=allStores();
  el('summaryCards').innerHTML=stores.map((name,index)=>{
   const r=latestWeekly(name),s=r?stats(r):null;
   const prior=state.history.some(v=>v.store===name&&v.type==='start');
   const heading=r?'Сохранено: '+text(r.date)+(r.pendingSync?' · Ожидает облака':''):
    (prior?'Начальная ревизия есть · сверка ещё не проводилась':'Начальная ревизия ещё не проведена');
   const shortage=s?badge(s.shortageRub,s.missingShort,s.shortageKg):'—';
   const surplus=s?badge(s.surplusRub,s.missingSurplus,s.surplusKg):'—';
   const extra=s?('<div class="rev053-store-kg">− '+note(s.shortageKg,s.missingShort)+'<br>+ '+note(s.surplusKg,s.missingSurplus)+'</div>'):'<div class="rev053-store-kg">'+(prior?'Готово к следующей сверке':'Нужно сначала зафиксировать фактические остатки')+'</div>';
   return '<div class="summarytile rev053-store-card" data-rev053-store="'+text(name)+'">'+
    '<img class="point-icon" src="'+(REVISION_STORE_ICONS[index]||REVISION_STORE_ICONS[0])+'" alt="" loading="lazy">'+
    '<div class="point-info"><strong>'+text(name)+'</strong><div class="hint">'+heading+'</div>'+
    '<div class="numbers"><div><span>Недостача</span><b class="red">'+shortage+'</b></div>'+
    '<div><span>Излишек</span><b class="green">'+surplus+'</b></div></div>'+extra+'</div>'+
    '<button class="btn soft point-open" type="button" data-summary-store="'+text(name)+'">Открыть точку <span aria-hidden="true">→</span></button></div>';
  }).join('');
  for(const tile of el('summaryCards').querySelectorAll('[data-rev053-store]')){
   const open=()=>{
    el('store').value=tile.dataset.rev053Store;
    go('revision',document.querySelectorAll('.menu button')[1]);refresh();
   };
   tile.querySelector('button').addEventListener('click',e=>{e.stopPropagation();open()});
   tile.addEventListener('click',open);
  }
  summaryKpis();
 };
 function productDetails(r){
  return (Array.isArray(r.products)?r.products:[]).map(p=>{
   const d=Number(p.diff),dir=Number.isFinite(d)?(d<0?'red':d>0?'green':'blue'):'';
   const price=p.price===null||p.price===undefined||p.price===''?null:Number(p.price);
   const priced=Number.isFinite(price)&&price>0;
   const gross=Number.isFinite(d)&&priced?Math.round(Math.abs(d*price)*100)/100:null;
   let breakdown='';
   if(p.raw!==undefined||p.pf!==undefined)breakdown='Склад '+num(p.raw,3)+' кг'+
    (p.pf!==undefined?' · ПФ '+num(p.pf,3)+' кг':'')+
    (p.loss?' · коэффициент +'+text(p.loss)+'%':'');
   return '<div class="rev053-product-line"><strong>'+text(p.name)+'</strong>'+
    '<span>Учёт '+num(p.program,3)+' кг · Факт '+num(p.actual,3)+' кг</span>'+
    (breakdown?'<small>'+breakdown+'</small>':'')+
    '<span class="'+dir+'">Разница '+(d>0?'+':'')+num(d,3)+' кг</span>'+
    '<small>Цена: '+(priced?num(price)+' ₽/кг':'не указана')+
    ' · Сумма: '+(gross===null?'не рассчитана':num(gross)+' ₽')+'</small></div>';
  }).join('');
 }
 renderHistory=function(){
  const rows=inStore();
  el('recent').innerHTML=rows.length?rows.slice(0,4).map(historyItem).join(''):
   '<div class="empty">Нет сохранённых ревизий</div>';
  el('allhistory').innerHTML=rows.length?rows.map(r=>
   '<article class="archive rev053-history-card"><details class="rev053-history-details">'+
   '<summary>'+historyItem(r)+'<span class="rev053-expand">Показать продукты ▾</span></summary>'+
   '<div class="rev053-products">'+productDetails(r)+'</div></details></article>').join(''):
   '<div class="rev053-empty" role="status"><strong>По этой точке пока нет ревизий</strong>'+
   '<p>Выберите другую точку или проведите первую ревизию.</p>'+
   '<button type="button" class="btn main" id="rev053Start">Начать ревизию →</button></div>';
  const historyCsv=el('view-history')?.querySelector('.sectionheading button');
  if(historyCsv){historyCsv.disabled=rows.length===0;historyCsv.title=rows.length?'Скачать ревизии этой точки':'Для выбранной точки нет записей'}
  el('rev053Start')?.addEventListener('click',()=>go('revision',document.querySelectorAll('.menu button')[1]));
 };
 const originalGo=go;
 go=function(view,button){
  originalGo(view,button);
  const isRevision=view==='revision',isHistory=view==='history';
  const selectors=el('revisionSelectors'),kpis=el('revisionKPIs');
  if(selectors)selectors.classList.toggle('hide',!(isRevision||isHistory));
  if(el('mode'))el('mode').style.display=isRevision?'':'none';
  if(el('when'))el('when').style.display=isRevision?'':'none';
  if(kpis)kpis.classList.toggle('hide',!(isRevision||view==='summary'));
  document.body.classList.toggle('rev053-summary',view==='summary');
  document.body.classList.toggle('rev053-history',isHistory);
  if(isRevision)calculate();
  if(view==='summary')summaryKpis();
 };
 const originalSave=saveRevision;
 saveRevision=async function(){
  const value=el('when')?.value||'';
  const date=new Date(value+'T12:00:00');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(date.getTime())||
    value>today()){
   notice('Укажи корректную дату проведения ревизии, не позднее сегодняшнего дня');
   el('when')?.focus();return;
  }
  return originalSave();
 };
 const originalPoints=downloadPointsSummary;
 downloadPointsSummary=function(){
  const rows=[['Точка','Дата последней повторной','Позиции','Недостача кг','Излишек кг',
   'Недостача ₽','Излишек ₽','Позиций без цены (недостача)','Позиций без цены (излишек)','Синхронизация']];
  for(const store of allStores()){
   const r=latestWeekly(store);
   if(!r){rows.push([store,'Нет повторной ревизии','','','','','','','','']);continue}
   const s=stats(r);
   rows.push([store,r.date,s.total,s.shortageKg,s.surplusKg,
    s.missingShort?'':s.shortageRub,s.missingSurplus?'':s.surplusRub,
    s.missingShort,s.missingSurplus,r.pendingSync?'Ожидает':'Сохранено']);
  }
  csvSave(rows,'farukh-revision-4-tochki-'+today()+'.csv');
  notice('Сводка по сохранённым ревизиям подготовлена');
 };
 const oldStatus=rev041DisplayStatus;
 rev041DisplayStatus=function(message){
  oldStatus(message);
  if(!cloudEnabled)return;
  const count=rev041Queue().length;
  const label=el('rev042CloudStatus');
  if(label)label.textContent=count?'● Облако · не отправлено: '+count:'● Облако MORE SUSHI подключено';
  if(count)el('compactToolsButton')?.setAttribute('title',count+' ревизий ждут отправки');
  else el('compactToolsButton')?.removeAttribute('title');
 };
 const dateField=el('when');
 if(dateField){dateField.max=today();dateField.setAttribute('aria-label','Дата проведения новой ревизии');dateField.title='Дата проведения новой ревизии';}
 const selectStore=el('store');if(selectStore){selectStore.setAttribute('aria-label','Торговая точка');selectStore.title='Выбор торговой точки';}
 const selectMode=el('mode');if(selectMode){selectMode.setAttribute('aria-label','Режим новой ревизии');}
 const first=document.querySelector('.menu button.active')||document.querySelector('.menu button');
 if(first)go(active||'summary',first);
 renderHistory();renderSummary();
})();
