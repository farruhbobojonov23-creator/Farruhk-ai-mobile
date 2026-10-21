import {measurementDate,measurementTime,monthLabel,monthDays,temperatureGrid,temperatureLimits,saveDailyTemperatures} from './temperature-journal.js?v=1';
import {saveAutoTemplate} from './haccp-template-drafts.js?v=1';

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const button=(text,fn,cls)=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b};
function field(parent,label,type,value){const l=el('label',label),i=el('input');i.type=type;i.value=value||'';l.append(i);parent.append(l);return i}
function download(bytes,name){const url=URL.createObjectURL(bytes),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
export function mountTemperatureGrid(root,{getHaccp,pointId,selection,onMonthChange,commit,onSettings,notify}){
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
 const sampleInfo=el('p','Первый раз заполни ответственного и температуры всех нужных холодильников ниже. Нажми «Сохранить образец». Затем ежедневно в 11:00 появятся редактируемые черновики по этому примеру.','small');
 const sampleStatus=el('p','','haccp-temperature-sample-status');
 const sampleActions=el('div',undefined,'haccp-temperature-sample-actions');
 const sampleSave=button('💾 Сохранить образец',()=>{void storeTemplate()},'primary');
 const sampleLoad=button('↻ Загрузить образец',()=>loadTemplate());
 sampleActions.append(sampleSave,sampleLoad);
 samplePanel.append(sampleInfo,sampleActions,sampleStatus);
 entry.append(samplePanel);

 const fields=el('div',undefined,'fields');entry.append(fields);
 const today=measurementDate(),date=field(fields,'Дата замеров','date',selection.month&&selection.month!==today.slice(0,7)?selection.month+'-01':today),time=field(fields,'Время замеров (Мурманск / Москва)','time',measurementTime()),owner=field(fields,'Ответственный','text',selection.owner||'');date.required=time.required=owner.required=true;owner.maxLength=120;
 const equipmentInputs=el('div',undefined,'haccp-daily-equipment');entry.append(equipmentInputs);
 const submit=el('button','Сохранить замеры за день','primary');submit.type='submit';entry.append(submit);
 const hint=el('p',undefined,'haccp-message');hint.setAttribute('role','status');entry.append(hint);
 const detail=el('section',undefined,'haccp-cell-detail');detail.hidden=true;box.append(detail);
 let grid,inputs=[],saving=false;
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
  sampleStatus.textContent='Образцов сохранено: '+saved+' из '+total+' единиц оборудования. Каждый холодильник получит собственную строку.';
  sampleLoad.disabled=!saved;
 }
 async function storeTemplate(){
  if(saving)return;
  const h=getHaccp();
  const filled=inputs.filter(i=>String(i.measured.value).trim()!=='');
  if(!owner.value.trim()){hint.textContent='Сначала укажи ответственного.';owner.focus();return}
  if(!filled.length){hint.textContent='Впиши температуры в поля ниже, затем сохрани образец.';return}
  saving=true;sampleSave.disabled=true;
  try{
   const today=measurementDate();
   await commit(state=>{
    for(const row of filled){
     const equip=state.haccp.equipment.find(e=>e.id===row.equipmentId);
     if(!equip)throw Error('Оборудование удалено.');
     saveAutoTemplate(state,{kind:'temperature',pointId:equip.pointId,form:{
      pointId:equip.pointId,at:today+'T11:00',owner:owner.value.trim(),
      equipmentId:equip.id,measured:row.measured.value,notes:row.notes.value
     }});
    }
   });
   hint.textContent='Образец сохранён для '+filled.length+' единиц оборудования. Ежедневные значения появятся в черновиках.';
   updateTemplateStatus();
  }catch(e){error(e)}finally{saving=false;sampleSave.disabled=false}
 }
 function loadTemplate(){
  const templates=getHaccp().autoTemplates||[];
  const available=inputs.map(i=>({input:i,template:templates.find(t=>t.kind==='temperature'&&t.form?.equipmentId===i.equipmentId)})).filter(x=>x.template);
  if(!available.length){hint.textContent='Сначала сохрани образец.';return}
  if(available[0].template.form.owner)owner.value=available[0].template.form.owner;
  for(const {input,template} of available){
   input.measured.value=template.form.measured||'';
   input.notes.value=template.form.notes||'';
  }
  hint.textContent='Образец загружен в форму. Можно изменить значения и сохранить новый образец.';
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
    for(const input of inputs){
     const saved=group.find(d=>d.form.equipmentId===input.equipmentId);
     input.measured.value=saved?.form.measured||'';
     input.notes.value=saved?.form.notes||'';
    }
    setMode('day');
    hint.textContent='Черновик за '+day+' загружен. Сверь значения с измерениями, исправь и нажми «Сохранить замеры за день».';
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
  pdf.disabled=false;detail.hidden=true;viewport.replaceChildren();equipmentInputs.replaceChildren();inputs=[];
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
