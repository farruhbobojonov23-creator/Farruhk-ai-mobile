import {measurementDate,measurementTime,monthLabel,monthDays,temperatureGrid,temperatureLimits,saveDailyTemperatures} from './temperature-journal.js?v=1';
import {saveAutoTemplate} from './haccp-template-drafts.js?v=2';
import {addEquipment,updateEquipment} from './haccp-model.js';

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const button=(text,fn,cls)=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b};
function field(parent,label,type,value){const l=el('label',label),i=el('input');i.type=type;i.value=value||'';l.append(i);parent.append(l);return i}
function download(bytes,name){const url=URL.createObjectURL(bytes),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
export function mountTemperatureGrid(root,{getHaccp,pointId,selection,onPointChange,onMonthChange,commit,onSettings,notify}){
 // Selecting a location must never display the other locations' equipment.
 const pointBar=el('div',undefined,'haccp-temperature-point-selector');
 const locationLabel=el('label','Точка / филиал'),locationSelect=el('select');
 locationSelect.setAttribute('aria-label','Выбери точку для температурного журнала');
 locationSelect.append(new Option('Все точки (просмотр)',''));
 for(const p of getHaccp().points)locationSelect.append(new Option(p.name,p.id));
 locationSelect.value=pointId||'';
 locationSelect.onchange=()=>onPointChange?.(locationSelect.value);
 locationLabel.append(locationSelect);
 const pointSummary=el('p','','small');
 const selectedPoint=getHaccp().points.find(p=>p.id===pointId);
 const assigned=getHaccp().equipment.filter(e=>e.pointId===pointId);
 pointSummary.textContent=selectedPoint
  ?selectedPoint.name+' · '+assigned.length+' единиц оборудования. Параметры этой точки сохраняются отдельно от остальных.'
  :'Все точки: только общий просмотр. Выбери филиал для сохранения его образца.';
 pointBar.append(locationLabel,pointSummary);root.append(pointBar);
 const box=el('section',undefined,'haccp-monthly');root.append(box);
 box.append(el('h2','Журнал температур холодильного и морозильного оборудования'));
 const bar=el('div',undefined,'haccp-month-controls');box.append(bar);
 const month=field(bar,'Месяц','month',selection.month||measurementDate().slice(0,7));
 const periodLabel=el('label','Период'),period=el('select');for(const [v,t] of [['all','Весь месяц'],['first','1–15 число'],['second','16–последнее число']])period.append(new Option(t,v));period.value=selection.period||'all';periodLabel.append(period);bar.append(periodLabel);
 const pdf=button('Скачать PDF',exportPdf,'primary');bar.append(pdf,button('Точки и оборудование',onSettings));
 const summary=el('p',undefined,'small'),viewport=el('div',undefined,'haccp-grid-viewport');viewport.tabIndex=0;viewport.setAttribute('aria-label','Таблица температур по дням месяца');box.append(summary,viewport);
 const entry=el('form',undefined,'haccp-form panel haccp-daily-form');root.append(entry);
 entry.append(el('h2','Заполнить замеры за день'),el('p','Введи измеренные температуры. Пустые поля не сохраняются. Для повторного замера укажи новое время.','small'));
 // Temperature uses the batch grid instead of the individual journal form.
 // Keep sample controls here where the user can actually see and use them.
 const samplePanel=el('section',undefined,'haccp-temperature-sample');
 samplePanel.append(el('h3','МОЙ ОБРАЗЕЦ · ТЕМПЕРАТУРЫ'));
 const sampleInfo=el('p','Настрой допустимый диапазон °C отдельно для каждого холодильника и морозильника на выбранной точке. Укажи ответственного ниже и сохрани образец. Ежедневно с 11:00 подготовятся черновики без выдуманных температур: фактический замер ты внесёшь при проверке.','small');
 const sampleOwner=field(samplePanel,'Ответственный для образца','text',selection.owner||'');sampleOwner.maxLength=120;
 const sampleRanges=el('div',undefined,'haccp-temperature-range-grid');
 const sampleStatus=el('p','','haccp-temperature-sample-status');
 const sampleActions=el('div',undefined,'haccp-temperature-sample-actions');
 const sampleSave=button('💾 Сохранить образец',()=>{void storeTemplate()},'primary');
 const sampleLoad=button('↻ Загрузить образец',()=>loadTemplate());
 sampleActions.append(sampleSave,sampleLoad);
 // Add any number of refrigerators/freezers without leaving the journal.
 const equipmentAdd=el('div',undefined,'haccp-temperature-add');
 const toggleEquipment=button('➕ Добавить холодильник / морозильник',()=>{
  equipmentEditor.hidden=!equipmentEditor.hidden;
  toggleEquipment.setAttribute('aria-expanded',String(!equipmentEditor.hidden));
  if(!equipmentEditor.hidden)equipmentName.focus();
 });
 toggleEquipment.setAttribute('aria-expanded','false');
 const equipmentEditor=el('div',undefined,'haccp-temperature-add-editor');equipmentEditor.hidden=true;
 const equipmentTitle=el('h4','Новое оборудование · температурный контроль');
 const equipmentFields=el('div',undefined,'haccp-temperature-range-fields haccp-temperature-add-fields');
 const pointLabel=el('label','Точка'),equipmentPoint=el('select');
 equipmentPoint.setAttribute('aria-label','Точка нового оборудования');
 for(const point of getHaccp().points)equipmentPoint.append(new Option(point.name,point.id));
 if(pointId&&getHaccp().points.some(p=>p.id===pointId)){equipmentPoint.value=pointId;equipmentPoint.disabled=true}
 pointLabel.append(equipmentPoint);
 const equipmentName=field(equipmentFields,'Название холодильника / морозильника','text','');
 equipmentName.maxLength=120;
 const equipmentMin=field(equipmentFields,'Минимум, °C','number','');
 const equipmentMax=field(equipmentFields,'Максимум, °C','number','');
 equipmentMin.step=equipmentMax.step='any';
 equipmentFields.prepend(pointLabel);
 const equipmentFeedback=el('p','','haccp-temperature-add-feedback');
 equipmentFeedback.setAttribute('role','status');
 const equipmentSave=button('✓ Добавить оборудование',async()=>{
  if(!equipmentName.value.trim()){equipmentFeedback.textContent='Введи название оборудования.';equipmentName.focus();return}
  const min=equipmentMin.value.trim(),max=equipmentMax.value.trim();
  if(min&&max&&Number(min)>Number(max)){equipmentFeedback.textContent='Минимум температуры должен быть не выше максимума.';return}
  equipmentSave.disabled=true;
  try{
   await commit(state=>addEquipment(state,{
    pointId:equipmentPoint.value,name:equipmentName.value.trim(),min,max
   }));
   // Parent remounts the temperature screen after saving; new equipment then
   // appears in the sample limit cards and in the daily readings list.
  }catch(err){equipmentFeedback.textContent=err.message||'Не удалось добавить оборудование.';notify(equipmentFeedback.textContent,true)}
  finally{equipmentSave.disabled=false}
 },'primary');
 equipmentEditor.append(equipmentTitle,equipmentFields,equipmentFeedback,equipmentSave);
 equipmentAdd.append(toggleEquipment,equipmentEditor);
 samplePanel.append(sampleInfo,equipmentAdd,sampleRanges,sampleActions,sampleStatus);
 entry.append(samplePanel);

 const fields=el('div',undefined,'fields');entry.append(fields);
 const today=measurementDate(),date=field(fields,'Дата замеров','date',selection.month&&selection.month!==today.slice(0,7)?selection.month+'-01':today),time=field(fields,'Время замеров (Мурманск / Москва)','time',measurementTime()),owner=field(fields,'Ответственный','text',selection.owner||'');date.required=time.required=owner.required=true;owner.maxLength=120;
 const equipmentInputs=el('div',undefined,'haccp-daily-equipment');entry.append(equipmentInputs);
 const submit=el('button','Сохранить замеры за день','primary');submit.type='submit';entry.append(submit);
 const hint=el('p',undefined,'haccp-message');hint.setAttribute('role','status');entry.append(hint);
 const detail=el('section',undefined,'haccp-cell-detail');detail.hidden=true;box.append(detail);
 let grid,inputs=[],ranges=[],saving=false;
 const draftPanel=el('section',undefined,'haccp-temperature-drafts');
 const draftTitle=el('h3','Ежедневные черновики');
 const draftItems=el('div',undefined,'haccp-temperature-draft-items');
 draftPanel.append(draftTitle,draftItems);
 entry.append(draftPanel);
 function updateTemplateStatus(){
  const h=getHaccp();
  const templates=h.autoTemplates||[];
  const total=inputs.length,saved=inputs.filter(input=>
   templates.some(t=>t.kind==='temperature'&&t.pointId===h.equipment.find(e=>e.id===input.equipmentId)?.pointId&&t.form?.equipmentId===input.equipmentId)).length;
  if(!pointId){
   sampleStatus.textContent='Выбери одну точку выше, чтобы сохранить её собственный образец.';
   sampleSave.disabled=true;sampleLoad.disabled=true;return;
  }
  sampleStatus.textContent='На точке «'+(h.points.find(p=>p.id===pointId)?.name||'')+'» образцов сохранено: '+saved+' из '+total+' единиц оборудования.';
  sampleSave.disabled=saving;
  sampleLoad.disabled=!saved;
 }
 async function storeTemplate(){
  if(!pointId){hint.textContent='Сначала выбери конкретную точку.';return}
  if(saving)return;
  const responsible=(sampleOwner.value||owner.value).trim();
  if(!responsible){hint.textContent='Укажи ответственного в блоке «Мой образец».';sampleOwner.focus();return}
  owner.value=responsible;selection.owner=responsible;
  if(!ranges.length){hint.textContent='Добавь холодильники в «Точки и оборудование», чтобы настроить образец.';return}
  const values=[];
  for(const row of ranges){
   const min=row.min.value.trim().replace(',','.'),max=row.max.value.trim().replace(',','.');
   if(min&&!Number.isFinite(Number(min))||max&&!Number.isFinite(Number(max)))return error(Error('Проверь диапазон «'+row.name+'»: нужны числа.'));
   if(min&&max&&Number(min)>Number(max))return error(Error('У «'+row.name+'» минимум больше максимума.'));
   values.push({id:row.equipmentId,min,max});
  }
  saving=true;sampleSave.disabled=true;
  try{
   const today=measurementDate();
   await commit(state=>{
    for(const row of values){
     const equip=state.haccp.equipment.find(e=>e.id===row.id);
     if(!equip)throw Error('Оборудование удалено.');
     updateEquipment(state,equip.id,{name:equip.name,min:row.min,max:row.max});
     const current=state.haccp.equipment.find(e=>e.id===row.id);
     saveAutoTemplate(state,{kind:'temperature',pointId:current.pointId,form:{
      pointId:current.pointId,at:today+'T11:00',owner:responsible,
      equipmentId:current.id,min:row.min,max:row.max
     }});
    }
   });
   hint.textContent='Образцы и допустимые диапазоны сохранены. Каждый день появятся строки для фактических замеров, а не одинаковые цифры.';
   updateTemplateStatus();
  }catch(e){error(e)}finally{saving=false;sampleSave.disabled=false}
 }
 function loadTemplate(){
  const templates=getHaccp().autoTemplates||[];
  const available=inputs.map(i=>({input:i,template:templates.find(t=>t.kind==='temperature'&&t.form?.equipmentId===i.equipmentId)})).filter(x=>x.template);
  if(!available.length){hint.textContent='Сначала сохрани образец.';return}
  if(available[0].template.form.owner){owner.value=available[0].template.form.owner;sampleOwner.value=owner.value}
  for(const {input,template} of available){
   const row=ranges.find(r=>r.equipmentId===input.equipmentId);
   if(row){row.min.value=template.form.min??row.min.value;row.max.value=template.form.max??row.max.value}
  }
  hint.textContent='Диапазоны из образцов загружены. При необходимости исправь границы и сохрани образец заново. Замеры остаются пустыми.';
  entry.scrollIntoView({block:'start',behavior:'smooth'});
 }
 function refreshDrafts(){
  draftItems.replaceChildren();
  const months=month.value;
  const drafts=(getHaccp().autoDrafts||[]).filter(d=>d.kind==='temperature'&&d.day.startsWith(months)&&(!pointId||d.pointId===pointId));
  const dates=[...new Set(drafts.map(d=>d.day))].sort().reverse();
  draftTitle.textContent='Ежедневные черновики · '+drafts.length+' замеров';
  for(const day of dates.slice(0,35)){
   const group=drafts.filter(d=>d.day===day),row=el('div',undefined,'haccp-temperature-draft-line');
   row.append(el('span',day+' · '+group.length+' строк по образцу · Черновик'));
   row.append(button('Проверить / поправить',()=>{
    const draftTime=group[0].form.at?.slice(11,16);
    date.value=day;time.value=draftTime||'11:00';
    owner.value=group[0].form.owner||'';
    sampleOwner.value=owner.value;
    for(const input of inputs){
     const saved=group.find(d=>d.form.equipmentId===input.equipmentId);
     input.measured.value=''; // Never copy legacy sample measurements into a new factual reading.
     input.notes.value=saved?.form.notes||'';
    }
    setMode('day');
    hint.textContent='Черновик за '+day+' открыт. Измерь температуру каждого холодильника, введи реальные цифры и нажми «Сохранить замеры за день».';
    entry.scrollIntoView({block:'start',behavior:'smooth'});
   }));
   draftItems.append(row);
  }
  if(!dates.length)draftItems.append(el('p','После сохранения образца система будет готовить черновики к 11:00 по московскому времени.','small'));
 }

 function error(e){hint.textContent=e.message||'Не удалось выполнить действие.';notify(hint.textContent,true)}
 function draw(){
  selection.month=month.value;selection.period=period.value;entry.hidden=month.value!==measurementDate().slice(0,7);
  try{grid=temperatureGrid(getHaccp(),{month:month.value,period:period.value,pointId});}catch(e){pdf.disabled=true;error(e);return}
  pdf.disabled=false;detail.hidden=true;viewport.replaceChildren();equipmentInputs.replaceChildren();sampleRanges.replaceChildren();inputs=[];ranges=[];
  const done=new Set(grid.readings.map(r=>r.details.equipmentId+'|'+measurementDate(r.at))),deviations=grid.readings.filter(r=>r.status==='deviation').length;
  summary.textContent=monthLabel(grid.month)+' · '+grid.rows.length+' единиц оборудования · '+done.size+' заполненных дней оборудования'+(deviations?' · Отклонений: '+deviations:'')+'. Нажми заполненную ячейку, чтобы увидеть время и ответственного.';
  const table=el('table',undefined,'haccp-month-table');table.style.setProperty('--haccp-columns',grid.days.length);const caption=el('caption','Температура, °C · '+monthLabel(grid.month));table.append(caption);
  const head=el('thead'),tr=el('tr');const equipmentHead=el('th','Оборудование / точка');equipmentHead.scope='col';tr.append(equipmentHead);
  for(const day of grid.days){const th=el('th',String(day));th.scope='col';if(grid.month+'-'+String(day).padStart(2,'0')===today)th.className='is-today';tr.append(th)}head.append(tr);table.append(head);
  const tbody=el('tbody');for(const row of grid.rows){
   const tr=el('tr'),name=el('th');name.scope='row';name.append(el('strong',row.name),el('small',row.point),el('small',temperatureLimits(row)));tr.append(name);
   for(const cell of row.cells){const td=el('td');if(cell.records.length){const deviation=cell.records.some(r=>r.status==='deviation'),value=cell.records.map(r=>String(r.details.measured)).join(' / '),b=button(value,()=>showCell(row,cell));b.className=deviation?'temperature-deviation':'temperature-measured';b.setAttribute('aria-label',row.name+', '+cell.day+' число: '+value+' °C'+(deviation?', отклонение':''));b.title=cell.records.map(r=>measurementTime(r.at)+' · '+r.details.measured+' °C · '+r.owner).join('\n');td.append(b)}else{td.textContent='—';td.className='temperature-empty'}tr.append(td)}tbody.append(tr);
   // Entry forms always show the selected point's equipment, including blank measurements.
   if(getHaccp().equipment.some(e=>e.id===row.id)){
    const range=el('div',undefined,'haccp-temperature-range');
    range.append(el('strong',row.name),el('small',row.point+' · утверждённые пределы °C'));
    const rangeFields=el('div',undefined,'haccp-temperature-range-fields');
    const min=field(rangeFields,'Минимум, °C','number',row.min==null?'':String(row.min));
    const max=field(rangeFields,'Максимум, °C','number',row.max==null?'':String(row.max));
    min.step=max.step='any';min.inputMode=max.inputMode='decimal';
    range.append(rangeFields);sampleRanges.append(range);
    ranges.push({equipmentId:row.id,name:row.name,min,max});
    const wrap=el('div',undefined,'haccp-daily-row'),label=el('label'),nameText=el('strong',row.name);label.append(nameText,el('small',row.point+' · '+temperatureLimits(row)));const measured=el('input');measured.type='number';measured.step='any';measured.inputMode='decimal';measured.placeholder='°C';measured.setAttribute('aria-label','Температура: '+row.name+' · '+row.point);label.append(measured);const notes=el('input');notes.type='text';notes.maxLength=2000;notes.placeholder='Комментарий (если нужен)';notes.setAttribute('aria-label','Комментарий: '+row.name);wrap.append(label,notes);equipmentInputs.append(wrap);inputs.push({equipmentId:row.id,measured,notes});
   }
  }table.append(tbody);viewport.append(table);
  if(!grid.rows.length){viewport.append(el('p','Добавь холодильники и морозильники в «Точки и оборудование». После этого здесь появятся строки журнала.','empty'));submit.disabled=true}else submit.disabled=!inputs.length;
  updateTemplateStatus();refreshDrafts();
 }
 function showCell(row,cell){detail.hidden=false;detail.replaceChildren(el('h3',row.name+' · '+row.point+' · '+cell.day+' '+monthLabel(grid.month)));for(const r of cell.records){const p=el('p',measurementTime(r.at)+' · '+r.details.measured+' °C · '+r.owner+(r.status==='deviation'?' · Отклонение':r.status==='unconfigured'?' · Границы не заданы':'')+(r.notes?'\n'+r.notes:''));detail.append(p)}detail.append(button('Закрыть',()=>{detail.hidden=true}));detail.scrollIntoView({block:'nearest',behavior:'smooth'})}
 async function exportPdf(){pdf.disabled=true;try{
  const h=getHaccp(),selected=temperatureGrid(h,{month:month.value,period:period.value,pointId});
  const compact={...h,equipment:selected.rows.map(({cells,point,...e})=>e),records:selected.readings.map(({photo,...r})=>({...r,photo:null})),actions:[],documents:[]};
  const response=await fetch('/api/haccp/temperature/pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({haccp:compact,month:month.value,period:period.value,pointId}),signal:AbortSignal.timeout(30000)});
  if(!response.ok){const result=await response.json().catch(()=>({}));throw Error(result.error||'Не удалось подготовить PDF.')}
  download(await response.blob(),'Журнал_температур_'+month.value+'_'+period.value+'.pdf');hint.textContent='PDF подготовлен для скачивания.';
 }catch(e){error(e)}finally{pdf.disabled=false}}
 entry.onsubmit=async e=>{e.preventDefault();if(saving||!entry.reportValidity())return;saving=true;submit.disabled=true;try{
  if(date.value.slice(0,7)!==month.value||month.value!==measurementDate().slice(0,7))throw Error('Вноси замеры текущего месяца. Архив доступен для просмотра.');const payload={date:date.value,time:time.value,owner:owner.value,entries:inputs.map(i=>({equipmentId:i.equipmentId,measured:i.measured.value,notes:i.notes.value}))};selection.owner=owner.value;
  // Validate and save the complete batch in one device transaction.
  await commit(state=>{
   const saved=saveDailyTemperatures(state,payload);
   const ids=new Set(saved.map(r=>r.details.equipmentId));
   state.haccp.autoDrafts=(state.haccp.autoDrafts||[]).filter(d=>
    d.kind!=='temperature'||d.day!==payload.date||!ids.has(d.form.equipmentId));
  });
 }catch(e){error(e)}finally{saving=false;submit.disabled=!inputs.length}};
 month.onchange=()=>{try{monthDays(month.value);const current=date.value;date.value=current.startsWith(month.value)?current:month.value+'-01';if(onMonthChange)onMonthChange(month.value);else draw()}catch(e){error(e)}};period.onchange=draw;
 const modes=el('nav',undefined,'journal-modes');modes.setAttribute('aria-label','Вид журнала температур');const daily=button('Замеры за сегодня',()=>setMode('day')),monthly=button('Таблица за месяц',()=>setMode('month'));modes.append(daily,monthly);root.prepend(modes);
 function setMode(mode){selection.mode=mode;const current=month.value===measurementDate().slice(0,7);daily.disabled=!current;box.hidden=mode==='day'&&current;entry.hidden=mode!=='day'||!current;daily.setAttribute('aria-pressed',String(mode==='day'&&current));monthly.setAttribute('aria-pressed',String(mode==='month'||!current));}
 draw();setMode(selection.mode||(month.value===measurementDate().slice(0,7)?'day':'month'));
 if(!inputs.length){const setup=button('Добавить оборудование',onSettings);entry.insertBefore(el('p','Добавьте холодильники и морозильники, чтобы внести первые замеры.','small'),submit);entry.insertBefore(setup,submit)}
}
