import {measurementDate,measurementTime,monthLabel,monthDays,temperatureGrid,temperatureLimits,saveDailyTemperatures} from './temperature-journal.js?v=1';

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const button=(text,fn,cls)=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b};
function field(parent,label,type,value){const l=el('label',label),i=el('input');i.type=type;i.value=value||'';l.append(i);parent.append(l);return i}
function download(bytes,name){const url=URL.createObjectURL(bytes),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
export function mountTemperatureGrid(root,{getHaccp,pointId,selection,commit,onSettings,notify}){
 const box=el('section',undefined,'haccp-monthly');box.hidden=true;root.append(box);
 box.append(el('h2','Журнал температур холодильного и морозильного оборудования'));
 const bar=el('div',undefined,'haccp-month-controls');box.append(bar);
 const month=field(bar,'Месяц','month',selection.month||measurementDate().slice(0,7));
 const periodLabel=el('label','Период'),period=el('select');for(const [v,t] of [['all','Весь месяц'],['first','1–15 число'],['second','16–последнее число']])period.append(new Option(t,v));period.value=selection.period||'all';periodLabel.append(period);bar.append(periodLabel);
 const pdf=button('Скачать PDF',exportPdf,'primary');bar.append(pdf,button('Точки и оборудование',onSettings));
 const summary=el('p',undefined,'small'),viewport=el('div',undefined,'haccp-grid-viewport');viewport.tabIndex=0;viewport.setAttribute('aria-label','Таблица температур по дням месяца');box.append(summary,viewport);
 const entry=el('form',undefined,'haccp-form panel haccp-daily-form');root.append(entry);
 entry.append(el('h2','Замеры на сегодня'),el('p','Только фактические измерения. Пустые поля не сохраняются.','small'));
 const toggle=button('Журнал за месяц',()=>{box.hidden=!box.hidden;toggle.setAttribute('aria-expanded',String(!box.hidden));if(!box.hidden)box.scrollIntoView({block:'start',behavior:'smooth'})});toggle.setAttribute('aria-expanded','false');entry.append(toggle);
 const fields=el('div',undefined,'fields');entry.append(fields);
 const today=measurementDate(),date=field(fields,'Дата замеров','date',selection.month&&selection.month!==today.slice(0,7)?selection.month+'-01':today),time=field(fields,'Время замеров (Мурманск / Москва)','time',measurementTime()),owner=field(fields,'Ответственный','text',selection.owner||'');date.required=time.required=owner.required=true;owner.maxLength=120;
 const equipmentInputs=el('div',undefined,'haccp-daily-equipment');entry.append(equipmentInputs);
 const submit=el('button','Сохранить замеры','primary');submit.type='submit';entry.append(submit);
 const hint=el('p',undefined,'haccp-message');hint.setAttribute('role','status');entry.append(hint);
 const detail=el('section',undefined,'haccp-cell-detail');detail.hidden=true;box.append(detail);
 let grid,inputs=[],saving=false;
 function error(e){hint.textContent=e.message||'Не удалось выполнить действие.';notify(hint.textContent,true)}
 function draw(){
  selection.month=month.value;selection.period=period.value;
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
    const wrap=el('div',undefined,'haccp-daily-row'),label=el('label'),nameText=el('strong',row.name);label.append(nameText,el('small',row.point+' · '+temperatureLimits(row)));const measured=el('input');measured.type='number';measured.step='any';measured.inputMode='decimal';measured.placeholder='Введите °C';measured.setAttribute('aria-label','Температура: '+row.name+' · '+row.point);label.append(measured);const notes=el('input');notes.type='text';notes.maxLength=2000;notes.placeholder='Комментарий (если нужен)';notes.setAttribute('aria-label','Комментарий: '+row.name);const status=el('span','Ожидает замера','chef-measure-status');measured.addEventListener('input',()=>{status.textContent=measured.value===''?'Ожидает замера':'Введено · не сохранено'});wrap.append(label,status,notes);equipmentInputs.append(wrap);inputs.push({equipmentId:row.id,measured,notes});
   }
  }table.append(tbody);viewport.append(table);
  if(!grid.rows.length){equipmentInputs.append(el('p','Добавь оборудование своей точки, чтобы вводить замеры.','chef-empty'),button('Добавить оборудование',onSettings));viewport.append(el('p','Добавь холодильники и морозильники в «Точки и оборудование». После этого здесь появятся строки журнала.','empty'));submit.disabled=true}else submit.disabled=!inputs.length;
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
  const payload={date:date.value,time:time.value,owner:owner.value,entries:inputs.map(i=>({equipmentId:i.equipmentId,measured:i.measured.value,notes:i.notes.value}))};selection.owner=owner.value;
  // Validate and save the complete batch in one device transaction.
  await commit(state=>saveDailyTemperatures(state,payload));
 }catch(e){error(e)}finally{saving=false;submit.disabled=!inputs.length}};
 month.onchange=()=>{try{monthDays(month.value);const current=date.value;date.value=current.startsWith(month.value)?current:month.value+'-01';draw()}catch(e){error(e)}};period.onchange=draw;
 root.insertBefore(entry,box);draw();
}
