import {extraJournals,extraFieldNames} from './haccp-extra.js';
import {measurementDate,monthLabel} from './temperature-journal.js';
import {moscowCheckpoint,dueRecords,deepCleaningProgress} from './haccp-schedule.js?v=1';
import {paperColumns,paperCell} from './haccp-paper-layout.js?v=1';
import {automaticJournalSummary} from './haccp-auto-journals.js?v=2';
import {saveAutoTemplate,dueAutoDrafts,generateAutoDrafts,confirmAutoDraft} from './haccp-template-drafts.js?v=2';
import {journalTypes,auditItems,emptyHaccp,validateHaccp,addEquipment,updateEquipment,addJournalRecord,closeCorrectiveAction,journalCsv} from './haccp-model.js';
import {mountTemperatureGrid} from './temperature-grid-ui.js?v=71';
import {plasmaPresetNeeded,seedPlasmaTemperatures} from './temperature-point-config.js?v=1';
const statuses={ok:'Без замечаний по записи',deviation:'Отклонение',unconfigured:'Не оценено: нет заданных границ / применимых пунктов',open:'Открыто',closed:'Проверено и закрыто'};
const localDate=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};
const displayDate=v=>v?new Date(v).toLocaleString('ru-RU'):'—';
const fieldNames={cleaningType:'Тип уборки',...extraFieldNames,equipment:'Оборудование',measured:'Измерено, °C',min:'Заданный минимум, °C',max:'Заданный максимум, °C',zone:'Зона / инвентарь',method:'Обработка',agent:'Средство / способ',concentration:'Концентрация',exposure:'Время выдержки',result:'Результат',supplier:'Поставщик',product:'Продукт / партия',quantity:'Количество',expiry:'Годен до',checks:'Проверка',decision:'Решение',batch:'Партия',startedAt:'Приготовлено / вскрыто',useBy:'Использовать до',conditions:'Условия хранения'};
const values={daily:'Ежедневная',general:'Генеральная',done:'Выполнено',problem:'Есть замечание',accepted:'Принято',rejected:'Отказ в приёмке',yes:'Да',no:'Нет',na:'Не применимо'};
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
function button(text,fn,cls){const b=el('button',text,cls);b.type='button';b.onclick=fn;return b}
function options(select,items,blank=false){const current=select.value;select.replaceChildren();if(blank)select.append(new Option('Выбери…',''));for(const [id,name] of items)select.append(new Option(name,id));if([...select.options].some(o=>o.value===current))select.value=current}
function selectField(parent,label,name,items,{required=true,blank=true}={}){const l=el('label',label),s=el('select');s.name=name;s.required=required;options(s,items,blank);l.append(s);parent.append(l);return s}
function inputField(parent,label,name,{type='text',required=false,value='',maxLength=2000}={}){const l=el('label',label),s=el(type==='textarea'?'textarea':'input');s.name=name;if(type!=='textarea')s.type=type;if(type==='number')s.step='any';s.required=required;s.maxLength=maxLength;s.value=value;l.append(s);parent.append(l);return s}
function fileField(parent,label,accept){const f=inputField(parent,label,'attachment',{type:'file'});f.accept=accept;return f}
function download(blob,name){const u=URL.createObjectURL(blob),a=el('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000)}
async function fileData(file,max,photo=false){if(!file)return null;if(!file.size)throw Error('Выбран пустой файл.');if(file.size>max)throw Error(photo?'Фото должно быть не больше 2 МБ.':'Документ должен быть не больше 5 МБ.');if(photo&&!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Для фото подходят JPEG, PNG и WebP.');const type=/^(image\/(png|jpeg|webp)|application\/(pdf|octet-stream|vnd\.[\w.+-]+|msword)|text\/plain)$/.test(file.type)?file.type:'application/octet-stream';return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).replace(/^data:[^;]*;/,'data:'+type+';'));reader.onerror=()=>reject(Error('Файл не удалось прочитать.'));reader.readAsDataURL(file)})}
function attachmentLink(data,name,label){const a=el('a',label);a.href='#';a.onclick=e=>{e.preventDefault();const [header,body]=data.split(','),bytes=Uint8Array.from(atob(body),c=>c.charCodeAt(0));download(new Blob([bytes],{type:header.slice(5).split(';')[0]}),name)};return a}
export function mountHaccp(root,{getState,save,notify}){
 let tab=null,lastRevision=null,loaded=false,temperaturePointInitialized=false;const temperatureSelection={};let currentMonth=measurementDate().slice(0,7);
 root.replaceChildren();root.classList.add('haccp-workspace');const heading=el('div',undefined,'bar');heading.append(el('h1','ХАССП'));root.append(heading,el('p','Журналы кухни по точкам. Границы температур, способы обработки и сроки задаются по вашим утверждённым процедурам.','small'));
 const banner=el('p','Записи хранятся на этом устройстве. Скачивай резервную копию в «Данных устройства».','haccp-banner');root.append(banner);const guidance=el('details'),guidanceTitle=el('summary','Формы журналов и применимость');guidance.append(guidanceTitle,el('p','Это рабочие формы учёта. Состав журналов, критерии контроля и порядок подписания утвердите для своей кухни. Дополнительные журналы используются при наличии соответствующих процессов. Имя ответственного в записи не заменяет требуемую подпись.','small'));const source=el('a','СанПиН 2.3/2.4.4282-26 — текст и рекомендуемые образцы');source.href='https://legalacts.ru/doc/postanovlenie-glavnogo-gosudarstvennogo-sanitarnogo-vracha-rf-ot-02062026-n_1/';source.target='_blank';source.rel='noopener';guidance.append(source);root.append(guidance);
 const metrics=el('div',undefined,'haccp-metrics');root.append(metrics);
 const controls=el('div',undefined,'haccp-controls fields'),pointFilter=selectField(controls,'Точка','pointFilter',[['','Все точки']],{required:false,blank:false}),fromDate=inputField(controls,'С даты','fromDate',{type:'date'}),toDate=inputField(controls,'По дату','toDate',{type:'date'});root.append(controls);
 const monthBar=el('div',undefined,'haccp-month-controls'),monthFilter=inputField(monthBar,'Месяц журнала','journalMonth',{type:'month',value:currentMonth}),archive=selectField(monthBar,'Сохранённые месяцы','archive',[[currentMonth,'Текущий месяц']],{required:false,blank:false});const periodHint=el('p',undefined,'small');monthBar.append(button('Текущий месяц',()=>{monthFilter.value=currentMonth;selectMonth()}));root.append(monthBar,periodHint);
 const nav=el('nav',undefined,'haccp-tabs');nav.setAttribute('aria-label','Журналы ХАССП');root.append(nav);
 const message=el('p',undefined,'haccp-message');message.setAttribute('role','status');root.append(message);
 const body=el('div',undefined,'haccp-body'),history=el('div',undefined,'haccp-history');root.append(body,history);const back=button('← Все журналы',()=>{tab=null;build();root.scrollIntoView({block:'start'})},'haccp-back');heading.prepend(back);const pageTitle=heading.querySelector('h1');
 const filters=el('details',undefined,'haccp-period-panel');filters.append(el('summary','Точка, месяц и архив'),controls,monthBar,periodHint);root.insertBefore(filters,body);
 const allTabs={...journalTypes,actions:'Корректирующие действия',documents:'Документы',settings:'Точки и оборудование'};
 function catalog(){
 const grid=el('div',undefined,'haccp-catalog');let index=0;const groupNames={temperature:'Оборудование и условия',receiving:'Продукты и процессы',cleaning:'Чистота, персонал и контроль'};
 for(const kind of ['temperature','humidity','frying','receiving','storage','cooking','defrosting','quality','cleaning','hygiene','pests','audit']){const title=journalTypes[kind];index=Object.keys(journalTypes).indexOf(kind);
  if(groupNames[kind])grid.append(el('h3',groupNames[kind],'haccp-group-label'));const card=button('',()=>{tab=kind;build();root.scrollIntoView({block:'start'})},'haccp-journal-card');card.dataset.journal=kind;
  const photo=el('span',undefined,'haccp-journal-photo');photo.setAttribute('aria-hidden','true');photo.style.backgroundPosition=`${(index%4)*100/3}% ${Math.floor(index/4)*50}%`;
  const copy=el('span',undefined,'haccp-journal-copy');copy.append(el('strong',title),el('small',h().records.filter(r=>r.kind===kind).length+' записей · Открыть журнал'));
  card.append(photo,copy);grid.append(card);index++;
 }
 const autoPanel=el('section',undefined,'haccp-autofill-panel');
 autoPanel.append(el('h2','Автозаполнение · 12 журналов А4'),
  el('p','FARRUH AI самостоятельно готовит даты, контрольные точки, оборудование и уже сохранённые реальные записи. По сохранённым образцам создаются черновики, которые ты можешь проверить и поправить перед подтверждением.','small'));
 const autoForm=el('div',undefined,'haccp-auto-controls');
 const autoMonth=inputField(autoForm,'Месяц для печати','autoMonth',{type:'month',value:currentMonth});
 const autoPoint=selectField(autoForm,'Точка для печати','autoPoint',[['','Все точки'],...pointOptions()],{required:false,blank:false});
 if(pointFilter.value)autoPoint.value=pointFilter.value;
 const autoStats=el('p','','haccp-auto-stats');
 const updateAutoStats=()=>{
  try{
   const sum=automaticJournalSummary(h(),{month:autoMonth.value,pointId:autoPoint.value});
   autoStats.textContent='Готово к печати: '+sum.kinds+' журналов · '+sum.confirmed+
    ' фактических записей · '+sum.planned+' строк по графику без подтверждения.';
  }catch(error){autoStats.textContent=error.message}
 };
 autoMonth.onchange=autoPoint.onchange=updateAutoStats;
 const exportAll=button('↓ Скачать все 12 автозаполненных журналов (PDF А4)',
  safe(async()=>{
   exportAll.disabled=true;
   try{
    const compact={...h(),records:h().records.map(({photo,...r})=>({...r,photo:null})),actions:[],documents:[]};
    const response=await fetch('/api/haccp/auto-pack/pdf',{
     method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({haccp:compact,month:autoMonth.value,pointId:autoPoint.value}),
     signal:AbortSignal.timeout(85000)
    });
    if(!response.ok){
     const data=await response.json().catch(()=>({}));
     throw Error(data.error||'Не удалось подготовить сборник журналов.');
    }
    download(await response.blob(),'ХАССП_все_12_журналов_'+autoMonth.value+'.pdf');
    say('Все 12 журналов автоматически подготовлены в PDF. Фактические проверки не были выдуманы.');
   }finally{exportAll.disabled=false}
  }),'primary');
 autoPanel.append(autoForm,autoStats,exportAll,
  el('p','План обновляется по московскому времени с 11:00, а при закрытом приложении — при следующем открытии. В PDF внесены только реальные записи и неподтверждённые строки по графику. Распечатка не заменяет фактический контроль.','small'));
 updateAutoStats();
 body.append(dailyOverview(),autoPanel,el('h2','Журналы кухни'),grid);root.append(banner,guidance);
 const utilities=el('div',undefined,'haccp-utilities');for(const key of ['actions','documents','settings'])utilities.append(button(allTabs[key],()=>{tab=key;build();root.scrollIntoView({block:'start'})}));body.append(utilities);
 }
 function dailyDrafts(){
  const {day:today,due:active}=moscowCheckpoint();
  const panel=el('section',undefined,'haccp-daily-overview');
  panel.append(el('h2','Ежедневный шаблон · 11:00, Мурманск'));
  const configKey='farruh-haccp-template-v1-'+tab;
  const defaultTemplate=tab==='cleaning'?'Зона: рабочая поверхность; обработка: согласно утверждённому графику и инструкции':tab==='temperature'?'Измерить фактическую температуру каждого холодильника и морозильника':tab==='receiving'?'Проверить фактически поступившие партии, сроки, упаковку и документы':tab==='storage'?'Проверить маркировку и сроки фактических партий':'Выполнить контроль по утверждённой процедуре и записать фактический результат';
  let template=defaultTemplate;
  try{template=localStorage.getItem(configKey)||defaultTemplate}catch{}
  const details=el('details',undefined,'haccp-template-settings'),summary=el('summary','Настроить текст плана проверки');
  const editor=el('textarea');editor.value=template;editor.maxLength=1200;editor.setAttribute('aria-label','Образец для журнала');
  const saveTemplate=button('Сохранить образец',()=>{try{localStorage.setItem(configKey,editor.value.trim()||defaultTemplate);template=editor.value.trim()||defaultTemplate;say('Образец сохранён на этом устройстве.')}catch{say('Не удалось сохранить образец.',true)}});
  details.append(summary,el('p','Образец задаёт план проверки, но не подтверждает её выполнение.','small'),editor,saveTemplate);
  panel.append(details);
  const scheduled=h().dailyControls.includes(tab);
  if(!scheduled){panel.insertBefore(el('p','Этот журнал ведётся по событию или утверждённому графику. Ежедневные пропуски не начисляются. Для включения в ежедневный план открой «Настройки ХАССП».','small'),details);return panel}
  if(tab==='cleaning'){
   const prog=deepCleaningProgress(h(),{month:monthFilter.value,pointId:pointFilter.value});
   panel.append(el('p','Генеральная уборка: '+prog.done+' из '+prog.target+' подтверждённых выполнений в месяц по выбранным точкам. Даты выбираются по вашему графику.','small'));
  }
  const table=el('table',undefined,'haccp-status-table'),head=el('tr');
  for(const name of ['Дата','Точка','Состояние','Действие'])head.append(el('th',name));table.append(head);
  const [year,month]=monthFilter.value.split('-').map(Number);
  const days=new Date(year,month,0).getDate();
  const points=pointFilter.value?h().points.filter(p=>p.id===pointFilter.value):h().points;
  let pending=0;
  for(let day=1;day<=days;day++){
   const date=monthFilter.value+'-'+String(day).padStart(2,'0');
   if(date>today||(date===today&&!active))continue;
   for(const point of points){
    const done=h().records.some(r=>r.kind===tab&&r.pointId===point.id&&measurementDate(r.at).slice(0,10)===date&&(tab!=='cleaning'||r.details.cleaningType!=='general'));
    if(!done)pending++;
    const row=el('tr');
    for(const value of [date,point.name,done?'Запись сохранена':'Ожидает фактической проверки'])row.append(el('td',value));
    const cell=el('td');
    if(!done){
     const btn=button('Заполнить',()=>{
      const form=body.querySelector('form.haccp-sheet');
      if(!form){say('Для архивного месяца запись можно просмотреть, но не добавить.',true);return}
      const at=form.querySelector('[name=at]');if(at)at.value=date+'T11:00';
      const pointSelect=form.querySelector('[name=pointId]');if(pointSelect){pointSelect.value=point.id;pointSelect.dispatchEvent(new Event('change'))}
      form.querySelector('.haccp-sheet-toolbar button')?.click();
      form.scrollIntoView({block:'start',behavior:'smooth'});
     });btn.disabled=monthFilter.value!==currentMonth;cell.append(btn);
    }
    row.append(cell);table.append(row);
   }
  }
  panel.insertBefore(el('p','Ожидают проверки: '+pending+'. План: '+template,'small'),details);
  const dates=el('details');dates.append(el('summary','План проверок по дням месяца'),table);panel.append(dates,el('p','Строки рассчитываются автоматически для каждого дня после 11:00 МСК, включая дни, когда приложение было закрыто. Они не считаются сохранёнными результатами до подтверждения.','small'));
  return panel;
 }
 function dailyOverview(){
  const panel=el('section',undefined,'haccp-daily-overview');
  const title=el('h2','Ежедневный контроль · 11:00');
  const today=moscowCheckpoint();
  const points=pointFilter.value?h().points.filter(p=>p.id===pointFilter.value):h().points;
  const plan=dueRecords(h(),{day:today.day,pointId:pointFilter.value});
  panel.append(title,el('p',today.due?'После 11:00 (Москва): подтверждено '+plan.confirmed+' из '+plan.total+' запланированных проверок. Ожидают фактического контроля: '+plan.waiting+'.':'До 11:00 (Москва): план на сегодня — '+plan.total+' проверок. Уже записано: '+plan.confirmed+'. Результаты необходимо подтвердить фактически.','small'));
  const general=deepCleaningProgress(h(),{month:today.month,pointId:pointFilter.value});
  panel.append(el('p','Генеральная уборка: '+general.done+' / '+general.target+' в этом месяце (по утверждённому графику; подтверждены только сохранённые записи).','small'));
  const table=el('table',undefined,'haccp-status-table'),head=el('tr');
  for(const label of ['Журнал','Подтверждено','Ожидает'])head.append(el('th',label));
  table.append(head);
  for(const [kind,name] of Object.entries(journalTypes)){
    const scheduled=h().dailyControls.includes(kind);
    const confirmed=dueRecords(h(),{day:today.day,pointId:pointFilter.value,kinds:[kind]}).confirmed;
    const row=el('tr');row.append(el('td',name),el('td',scheduled?String(confirmed):'По событию'),el('td',scheduled?(today.due?String(points.length-confirmed):'После 11:00'):'—'));
    row.onclick=()=>{tab=kind;build()};row.tabIndex=0;row.onkeydown=e=>{if(e.key==='Enter')row.click()};table.append(row);
  }
  const disclosure=el('details');disclosure.append(el('summary','Подробная сводка по журналам'),table);panel.append(disclosure,el('p','Дата и перечень контрольных точек формируются автоматически. Замеры, уборка и осмотры не отмечаются выполненными без подтверждения.','small'));
  return panel;
 }
 function sheet(form){
  const kind=tab,columns=paperColumns(kind);
  form.classList.add('haccp-sheet','haccp-a4-editor','haccp-paper-premium');
  form.querySelector('h2').textContent='ЖУРНАЛ · '+journalTypes[kind];
  const toolbar=el('div',undefined,'haccp-sheet-toolbar');
  const edit=button('✎ Заполнить строку',()=>{setMode('form');form.querySelector('[name=pointId]')?.focus()},'primary');
  const save=button('✓ Сохранить запись',()=>{setMode('form');form.requestSubmit()});
  const pdf=button('↓ Скачать А4 PDF',safe(()=>exportJournalPdf(currentRecords())));
  const sample=button('💾 Сохранить образец',safe(async()=>{
   const pointId=form.querySelector('[name=pointId]')?.value;
   await commit(state=>saveAutoTemplate(state,{kind,pointId,
    form:Object.fromEntries(new FormData(form))}));
   say('Образец сохранён для '+journalTypes[kind]+'. С 11:00 по Москве по нему будут создаваться черновики.');
  }));
  const loadSample=button('↻ Загрузить образец',safe(()=>{
   const pointId=form.querySelector('[name=pointId]')?.value;
   const template=h().autoTemplates.find(t=>t.kind===kind&&t.pointId===pointId);
   if(!template)throw Error('Сначала сохрани образец для выбранной точки.');
   fillFormFromTemplate(form,template.form);
   say('Образец загружен. Можно отредактировать и сохранить заново.');
  }));
  toolbar.append(edit,save,sample,loadSample,pdf);
  const modes=el('nav',undefined,'journal-modes');
  const fill=button('✎ Заполнение',()=>setMode('form')),paperView=button('▦ Лист А4',()=>setMode('paper'));
  modes.append(paperView,fill);
  const paperHint=el('p','Это предварительный вид журнала. Только сохранённые записи подтверждают выполненные проверки. Для ввода нажми «Заполнение».','haccp-paper-hint');
  const wrapper=el('div',undefined,'haccp-a4-scroll');
  wrapper.setAttribute('role','region');wrapper.setAttribute('aria-label','Лист А4: '+journalTypes[kind]);
  wrapper.tabIndex=0;
  const paper=el('section',undefined,'haccp-a4-paper');
  paper.setAttribute('aria-label','Предпросмотр журнала А4');
  const kicker=el('div','ХАССП · ЖУРНАЛ КОНТРОЛЯ','haccp-a4-kicker');
  const title=el('h3',journalTypes[kind],'haccp-a4-caption');
  const meta=el('div',undefined,'haccp-a4-meta');
  const table=el('table',undefined,'haccp-a4-table');
  const head=el('thead'),headRow=el('tr'),tbody=el('tbody');
  for(const col of columns){
   const th=el('th',col.label);th.scope='col';
   th.style.width=(col.weight/columns.reduce((n,c)=>n+c.weight,0)*100).toFixed(2)+'%';
   headRow.append(th);
  }
  head.append(headRow);table.append(head,tbody);
  const note=el('p','Проверил: ____________________    Подпись: ____________________    Дата: _______________','haccp-a4-signature');
  paper.append(kicker,title,meta,table,note);wrapper.append(paper);
  const indicator=el('p','Лист А4 расположен горизонтально. Сдвигай таблицу пальцем вправо или влево.','haccp-a4-swipe');
  form.prepend(toolbar,modes,paperHint,wrapper,indicator);
  const draftValue=()=>{
   const raw=Object.fromEntries(new FormData(form));
   const details={...raw};
   for(const key of ['at','startedAt','finishedAt','useBy','expiry']){
    if(details[key]&&/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(details[key]))
     details[key]=details[key]+':00+03:00';
   }
   if(kind==='temperature'){
    const equipment=h().equipment.find(item=>item.id===raw.equipmentId);
    if(equipment)Object.assign(details,{equipment:equipment.name,min:equipment.min,max:equipment.max});
   }
   if(kind==='audit'){
    details.checks=auditItems.map((label,i)=>({label,result:raw['check'+i]||'na'}));
   }
   return {pointId:raw.pointId,at:details.at,owner:raw.owner,notes:raw.notes,details,
    status:'unconfigured'};
  };
  const refreshPaper=()=>{
   if(!form.isConnected)return;
   const selectedPoint=form.querySelector('[name=pointId]')?.value;
   const actual=currentRecords().filter(r=>!selectedPoint||r.pointId===selectedPoint);
   const saved=actual.slice(0,14).reverse();
   meta.textContent=monthLabel(monthFilter.value)+'   ·   '+(selectedPoint?pointName(selectedPoint):'Все точки')+
     '   ·   Сохранено записей: '+actual.length+(actual.length>14?' (показаны последние 14)':'');
   tbody.replaceChildren();
   const rows=[...saved.map(r=>({record:r,draft:false})),{record:draftValue(),draft:true}];
   for(const {record,draft} of rows){
    const tr=el('tr');if(draft)tr.className='haccp-draft-row';
    for(const col of columns){
     const cell=el('td',paperCell(record,col.key,h().points,{draft}));
     cell.dataset.column=col.key;tr.append(cell);
    }
    tbody.append(tr);
   }
   // Unsaved blank slots are strictly empty and never marked as inspected.
   for(let i=rows.length;i<8;i++){
    const tr=el('tr',undefined,'haccp-blank-row');
    for(const col of columns)tr.append(el('td',''));
    tbody.append(tr);
   }
  };
  function setMode(value){
   form.dataset.mode=value;
   const showPaper=value==='paper';
   fill.setAttribute('aria-pressed',String(!showPaper));
   paperView.setAttribute('aria-pressed',String(showPaper));
   if(showPaper)refreshPaper();
  }
  form.addEventListener('input',()=>{if(form.dataset.mode==='paper')refreshPaper()});
  form.addEventListener('change',()=>{if(form.dataset.mode==='paper')refreshPaper()});
  setMode('paper');
 }
 function fillFormFromTemplate(form,data){
  const fields={...data};
  const point=form.querySelector('[name=pointId]');
  if(point&&fields.pointId){point.value=fields.pointId;point.dispatchEvent(new Event('change',{bubbles:true}))}
  for(const [name,value] of Object.entries(fields)){
   if(name==='pointId'||name==='photo')continue;
   const field=Array.from(form.elements).find(x=>x.name===name);
   if(!field)continue;
   if(field.type==='file'||field.type==='submit')continue;
   if(field.type==='checkbox')field.checked=value==='true';else field.value=value;
   field.dispatchEvent(new Event('change',{bubbles:true}));
  }
 }
 function journalAutoDrafts(){
  const drafts=(h().autoDrafts||[]).filter(d=>d.kind===tab&&
   d.day.slice(0,7)===monthFilter.value&&(!pointFilter.value||d.pointId===pointFilter.value))
   .sort((a,b)=>b.day.localeCompare(a.day));
  const card=el('section',undefined,'haccp-drafts-panel');
  card.append(el('h2','Автозаполненные черновики: '+drafts.length),
   el('p','Каждый образец повторяется в 11:00 по московскому времени. Проверь реальные показатели, при необходимости исправь и нажми «Сохранить запись». До этого черновик не считается выполненной проверкой.','small'));
  if(!drafts.length){card.append(el('p','Черновиков пока нет. Заполни поля выше и нажми «Сохранить образец».','small'));body.append(card);return}
  for(const draft of drafts.slice(0,90)){
   const line=el('div',undefined,'haccp-draft-line');
   line.append(el('span',draft.day+' · '+pointName(draft.pointId)+' · Черновик'));
   const open=button('Проверить / изменить',()=>{
    const form=body.querySelector('form.haccp-sheet');
    if(!form){say('Открой текущий месяц для работы с черновиком.',true);return}
    fillFormFromTemplate(form,draft.form);
    form.dataset.autoDraftId=draft.id;
    const holder=form.closest('details');if(holder)holder.open=true;
    form.querySelector('.journal-modes button:nth-child(2)')?.click();
    const banner=el('p','Редактируешь черновик за '+draft.day+'. Сохранение подтвердит фактическую проверку.','haccp-draft-banner');
    form.querySelector('.haccp-draft-banner')?.remove();
    form.querySelector('.journal-modes')?.after(banner);
    form.scrollIntoView({block:'start',behavior:'smooth'});
   });
   line.append(open);card.append(line);
  }
  if(drafts.length>90)card.append(el('p','Показаны 90 последних черновиков. Предыдущие находятся в архиве по месяцам.','small'));
  body.append(card);
 }
 function h(){return getState()?.haccp||emptyHaccp()}
 function say(text,error=false){message.textContent=text;message.classList.toggle('error',error);if(error)notify(text,true)}
 async function commit(change){if(!getState())throw Error('Данные устройства ещё не загрузились.');await save(state=>{change(state);state.haccp.revision=(Number(state.haccp.revision)||0)+1;state.haccp.updatedAt=new Date().toISOString()});say('Сохранено на устройстве.')}
 function safe(fn){return async e=>{e?.preventDefault();try{await fn(e)}catch(error){say(error.message||'Не удалось сохранить запись.',true)}}}
 function pointOptions(){return h().points.map(p=>[p.id,p.name])}
 function pointName(id){return h().points.find(p=>p.id===id)?.name||'Все точки'}
 function currentRecords(){return h().records.filter(r=>r.kind===tab&&measurementDate(r.at).slice(0,7)===monthFilter.value&&(!pointFilter.value||r.pointId===pointFilter.value)&&(!fromDate.value||r.at>=new Date(fromDate.value+'T00:00:00').toISOString())&&(!toDate.value||r.at<=new Date(toDate.value+'T23:59:59.999').toISOString())).sort((a,b)=>b.at.localeCompare(a.at))}
 function detailsText(r){return Object.entries(r.details||{}).filter(([k])=>k!=='equipmentId').map(([k,v])=>{if(Array.isArray(v))return v.map(c=>c.label+': '+values[c.result]).join('; ');if(['expiry','startedAt','finishedAt','useBy'].includes(k))v=displayDate(v);return (fieldNames[k]||k)+': '+(values[v]??v??'не задано')}).join('\n')}
 function metricsRender(){metrics.replaceChildren();const records=h().records.filter(r=>!pointFilter.value||r.pointId===pointFilter.value),actions=h().actions.filter(a=>a.status==='open'&&(!pointFilter.value||a.pointId===pointFilter.value));for(const [n,label] of [[records.length,'записей'],[actions.length,'открытых действий'],[h().equipment.filter(e=>!pointFilter.value||e.pointId===pointFilter.value).length,'единиц оборудования']]){const box=el('div',undefined,'haccp-metric');box.append(el('strong',String(n)),el('span',label));metrics.append(box)}}
 function formShell(title){const f=el('form',undefined,'haccp-form panel');f.append(el('h2',title));body.append(f);return f}
 function submitForm(form,fn,label='Сохранить запись'){const b=el('button',label,'primary');b.type='submit';form.append(b);let submitting=false;form.onsubmit=safe(async()=>{if(submitting)return;if(!form.reportValidity())return;submitting=true;b.disabled=true;try{await fn(Object.fromEntries(new FormData(form)),form);build();say('Сохранено на устройстве.')}finally{submitting=false;b.disabled=false}})}
 function common(form){const grid=el('div',undefined,'fields');form.append(grid);const point=selectField(grid,'Точка','pointId',pointOptions());if(pointFilter.value)point.value=pointFilter.value;inputField(grid,'Дата и время записи','at',{type:'datetime-local',required:true,value:localDate()});inputField(grid,'Ответственный','owner',{required:true,maxLength:120});inputField(grid,'Срок устранения, если будет отклонение','due',{type:'datetime-local'});return {grid,point}}
 function journalForm(){const form=formShell('Новая запись: '+journalTypes[tab]),{grid,point}=common(form);let equipment;
  if(tab==='temperature'){equipment=selectField(grid,'Оборудование','equipmentId',[],{});const measured=inputField(grid,'Измеренная температура, °C','measured',{type:'number',required:true});const hint=el('p','Сначала добавь оборудование и его утверждённые границы в настройках.','small');form.append(hint);const sync=()=>{options(equipment,h().equipment.filter(e=>e.pointId===point.value).map(e=>[e.id,e.name]),true);updateHint()};const updateHint=()=>{const item=h().equipment.find(e=>e.id===equipment.value);hint.textContent=!item?'Выбери оборудование этой точки.':item.min===null&&item.max===null?'Границы не заданы. Измерение сохранится без оценки соответствия.':'Заданные границы: '+(item.min??'без минимума')+' … '+(item.max??'без максимума')+' °C. Границы попадут в запись.'};point.onchange=sync;equipment.onchange=updateHint;sync();measured.inputMode='decimal'}
  if(tab==='cleaning'){selectField(grid,'Тип уборки','cleaningType',[['daily','Ежедневная / текущая'],['general','Генеральная (2 раза в месяц по графику)']],{blank:false});inputField(grid,'Зона / инвентарь','zone',{required:true,maxLength:200});inputField(grid,'Что обработали и каким способом','method',{required:true,maxLength:500});inputField(grid,'Средство или способ обработки','agent',{required:true,maxLength:200});inputField(grid,'Концентрация по инструкции, если применимо','concentration',{maxLength:100});inputField(grid,'Время выдержки по инструкции','exposure',{maxLength:100});selectField(grid,'Результат','result',[['done','Выполнено'],['problem','Есть замечание']])}
  if(tab==='receiving'){for(const [label,name] of [['Поставщик','supplier'],['Продукт / партия','product'],['Количество и единица (например, 5 кг)','quantity']])inputField(grid,label,name,{required:true,maxLength:300});inputField(grid,'Температура при приёмке, °C (если измеряли)','measured',{type:'number'});inputField(grid,'Годен до (по маркировке)','expiry',{type:'datetime-local'});inputField(form,'Проверка маркировки, упаковки, сроков и сопроводительных документов','checks',{type:'textarea',required:true,maxLength:1000});selectField(grid,'Решение','decision',[['accepted','Принято'],['rejected','Отказ в приёмке']])}
  if(tab==='storage'){inputField(grid,'Продукт / полуфабрикат','product',{required:true,maxLength:300});inputField(grid,'Номер партии / маркировки','batch',{maxLength:100});inputField(grid,'Приготовлено / вскрыто','startedAt',{type:'datetime-local',required:true});inputField(grid,'Использовать до (по утверждённому сроку)','useBy',{type:'datetime-local',required:true});inputField(form,'Утверждённые условия хранения','conditions',{type:'textarea',required:true,maxLength:500});form.append(el('p','Срок не назначается автоматически: укажи дату и условия из утверждённой инструкции на этот продукт.','small'))}
  if(extraJournals[tab]){const spec=extraJournals[tab];form.append(el('p',spec.hint,'small'));for(const field of spec.fields)inputField(grid,field.label,field.name,{type:field.type,required:true,maxLength:1000});selectField(grid,'Результат контроля','result',[['done','Соответствует заданным условиям'],['problem','Отклонение — требуется действие'],['na','Не оценено']])}
  if(tab==='audit'){form.append(el('p','Рабочий чек-лист точки. Он не заменяет ваш утверждённый план ХАССП.','small'));for(let i=0;i<auditItems.length;i++)selectField(form,auditItems[i],'check'+i,[['yes','Да'],['no','Нет — замечание'],['na','Не применимо']])}
  inputField(form,'Комментарий / замечание','notes',{type:'textarea'});const photo=fileField(form,'Фото, при необходимости (JPEG / PNG / WebP, до 2 МБ)','image/jpeg,image/png,image/webp');
  const kind=tab;submitForm(form,async raw=>{if(measurementDate(raw.at).slice(0,7)!==monthFilter.value)throw Error('Дата записи должна быть в выбранном месяце.');const data={...raw,kind,photo:await fileData(photo.files[0],2*1024*1024,true)};
    const draftId=form.dataset.autoDraftId;
    await commit(state=>draftId?confirmAutoDraft(state,draftId,data):addJournalRecord(state,data))});sheet(form);
 }
 function journalHistory(){const records=currentRecords(),bar=el('div',undefined,'bar');bar.append(el('h2','Записи: '+records.length));const csv=button('Скачать CSV',()=>download(new Blob([journalCsv(records,h().points)],{type:'text/csv;charset=utf-8'}),'ХАССП_'+tab+'_'+new Date().toISOString().slice(0,10)+'.csv'));bar.append(csv,button('Скачать PDF',safe(()=>exportJournalPdf(records))),button('Печатать журнал',()=>printJournal(records)));history.append(bar);if(!records.length){history.append(el('p','В выбранном журнале пока нет записей.','empty'));return}if(records.length>100)history.append(el('p','На экране — последние 100 записей. CSV и печать включают весь выбранный период.','small'));
  for(const record of records.slice(0,100)){const box=el('article',undefined,'haccp-record '+record.status),top=el('div',undefined,'bar');top.append(el('strong',displayDate(record.at)+' · '+pointName(record.pointId)),el('span',statuses[record.status]));box.append(top,el('p','Ответственный: '+record.owner),el('pre',detailsText(record)));if(record.notes)box.append(el('p',record.notes));if(record.photo)box.append(attachmentLink(record.photo,'ХАССП_фото_'+record.id+'.jpg','Скачать фото'));history.append(box)}
 }
 function printJournal(records){
  const popup=window.open('','_blank');
  if(!popup){say('Разреши открытие окна печати для этого сайта.',true);return}
  const d=popup.document;d.open();d.write('<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>ХАССП · Журнал</title><style>@page{size:A4 landscape;margin:11mm}body{font:11px/1.45 Arial,sans-serif;color:#24445e;margin:0;padding:15px;background:white}h1{color:#1a4e74;font-size:21px;margin:12px 0}small{color:#50738c}table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:9px;margin:18px 0}td,th{border:1px solid #afc3d2;padding:7px 5px;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}thead th{background:#e2f2ff;color:#214d6e}tr:nth-child(even){background:#f4faff}tbody tr{break-inside:avoid}footer{border-top:1px solid #aac2d3;margin-top:20px;padding-top:12px}button{padding:10px 20px;background:#307eae;color:#fff;border:0;border-radius:9px}@media print{button{display:none}}</style></head><body></body></html>');d.close();
  const heading=d.createElement('h1');heading.textContent=journalTypes[tab];d.body.append(heading);
  const sub=d.createElement('small');sub.textContent=monthLabel(monthFilter.value)+' · '+(pointFilter.value?pointName(pointFilter.value):'Все точки')+' · Фактические записи с устройства. Пустые строки не подтверждают контроль.';d.body.append(sub);
  const table=d.createElement('table'),head=d.createElement('thead'),tr=d.createElement('tr'),tbody=d.createElement('tbody');
  const cols=paperColumns(tab),sum=cols.reduce((n,c)=>n+c.weight,0);
  for(const col of cols){const th=d.createElement('th');th.textContent=col.label;th.style.width=(col.weight/sum*100).toFixed(2)+'%';tr.append(th)}
  head.append(tr);table.append(head);
  for(const record of records){
   const row=d.createElement('tr');for(const col of cols){const td=d.createElement('td');td.textContent=paperCell(record,col.key,h().points);row.append(td)}tbody.append(row);
   if(record.notes&&!cols.some(col=>col.key==='notes')){
    const more=d.createElement('tr'),td=d.createElement('td');td.colSpan=cols.length;td.textContent='Примечание: '+record.notes;more.append(td);tbody.append(more);
   }
  }
  if(!records.length){
   const info=d.createElement('p');info.textContent='Подтверждённых записей нет. Бланк для ручного заполнения.';d.body.append(info);
   for(let i=0;i<10;i++){const row=d.createElement('tr');for(const col of cols)row.append(d.createElement('td'));tbody.append(row)}
  }
  table.append(tbody);d.body.append(table);
  const footer=d.createElement('footer');footer.textContent='Проверил: _____________________     Подпись: _____________________     Дата: ____________';d.body.append(footer);
  const print=d.createElement('button');print.type='button';print.textContent='Печатать А4';print.onclick=()=>popup.print();d.body.prepend(print);popup.focus();
 }
 async function exportJournalPdf(records){const compact={...h(),records:records.map(({photo,...r})=>({...r,photo:null})),actions:[],documents:[]};const response=await fetch('/api/haccp/journal/pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({haccp:compact,kind:tab,month:monthFilter.value,pointId:pointFilter.value}),signal:AbortSignal.timeout(30000)});if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||'Не удалось скачать журнал.')}download(await response.blob(),'ХАССП_'+tab+'_'+monthFilter.value+'.pdf');say('PDF подготовлен.')}
 function actionsView(){const actions=h().actions.filter(a=>!pointFilter.value||a.pointId===pointFilter.value).sort((a,b)=>Number(a.status!=='open')-Number(b.status!=='open')||b.createdAt.localeCompare(a.createdAt));body.append(el('h2','Корректирующие действия'),el('p','Создаются автоматически по отклонениям журналов. Закрывай только после выполнения и проверки результата.','small'));if(!actions.length)body.append(el('p','Открытых или закрытых действий пока нет.','empty'));
  for(const action of actions){const box=el('article',undefined,'haccp-record '+(action.status==='open'?'deviation':'ok'));box.append(el('h3',action.text),el('p',pointName(action.pointId)+' · '+statuses[action.status]),el('p','Ответственный: '+action.owner+' · Срок: '+displayDate(action.due)));const source=h().records.find(r=>r.id===action.sourceId);if(source)box.append(el('pre',detailsText(source)),el('p',source.notes||''));if(action.status==='closed')box.append(el('p','Сделано: '+action.action),el('p','Проверил: '+action.reviewer+' · '+displayDate(action.closedAt)));else{const f=el('form',undefined,'haccp-action-form');inputField(f,'Что сделано для устранения','action',{type:'textarea',required:true});inputField(f,'Кто проверил результат','reviewer',{required:true,maxLength:120});submitForm(f,async raw=>commit(state=>closeCorrectiveAction(state,action.id,raw)),'Подтвердить выполнение и проверку');box.append(f)}body.append(box)}
 }
 function documentsView(){const f=formShell('Добавить документ');inputField(f,'Название документа','title',{required:true,maxLength:200});selectField(f,'Раздел','category',[['plan','План ХАССП'],['instruction','Инструкция'],['journal','Форма журнала'],['other','Другое']]);inputField(f,'Ответственный за документ','owner',{required:true,maxLength:120});inputField(f,'Дата / версия','version',{maxLength:100});const file=fileField(f,'Файл до 5 МБ','.pdf,.docx,.xlsx,.txt,.png,.jpg,.jpeg,.webp');file.required=true;submitForm(f,async raw=>{const chosen=file.files[0];const data=await fileData(chosen,5*1024*1024);await commit(state=>{const next=validateHaccp(state.haccp);next.documents.push({id:crypto.randomUUID(),title:raw.title.trim(),category:raw.category,owner:raw.owner.trim(),version:raw.version.trim(),fileName:chosen.name,size:chosen.size,data,createdAt:new Date().toISOString()});state.haccp=validateHaccp(next)})},'Сохранить документ');history.append(el('h2','Документы на устройстве'));if(!h().documents.length)history.append(el('p','Загрузи утверждённый план, инструкции или формы журналов вашей кухни.','empty'));for(const doc of h().documents){const box=el('article',undefined,'haccp-record');box.append(el('h3',doc.title),el('p',doc.owner+' · '+(doc.version||'версия не указана')+' · '+displayDate(doc.createdAt)),attachmentLink(doc.data,doc.fileName,'Скачать '+doc.fileName));history.append(box)}}
 function settingsView(){const f=formShell('Названия точек');for(const point of h().points)inputField(f,'Название '+point.name,point.id,{required:true,value:point.name,maxLength:120});submitForm(f,async raw=>commit(state=>{const next=validateHaccp(state.haccp);for(const point of next.points)point.name=String(raw[point.id]).trim();if(new Set(next.points.map(p=>p.name)).size!==next.points.length)throw Error('Названия точек должны различаться.');state.haccp=validateHaccp(next)}),'Сохранить названия');
  const planForm=formShell('План ежедневного контроля · 11:00 МСК');
  planForm.classList.add('haccp-plan-settings');
  planForm.append(el('p','Выбери журналы, которые действительно проверяются ежедневно по вашей программе производственного контроля. Остальные журналы остаются доступными по событию и не создают ложных «пропусков». В 11:00 формируется список ожидаемых проверок — фактические результаты записывает ответственный.','small'));
  const checklist=el('div',undefined,'haccp-plan-list');
  for(const [kind,title] of Object.entries(journalTypes)){
   const label=el('label',undefined,'haccp-plan-check');
   const box=el('input');box.type='checkbox';box.name='plan_'+kind;box.value=kind;
   box.checked=h().dailyControls.includes(kind);
   label.append(box,el('span',title));checklist.append(label);
  }
  planForm.append(checklist);
  const goal=inputField(planForm,'Генеральные уборки на каждой точке за месяц (по утверждённому графику)','generalCleaningTarget',{type:'number',required:true,value:h().generalCleaningTarget});
  goal.min='0';goal.max='10';goal.step='1';
  submitForm(planForm,async(raw)=>{
   const selected=Object.keys(journalTypes).filter(kind=>raw['plan_'+kind]===kind);
   const target=Number(raw.generalCleaningTarget);
   if(!Number.isInteger(target)||target<0||target>10)throw Error('Укажи от 0 до 10 генеральных уборок за месяц.');
   await commit(state=>{const next=validateHaccp(state.haccp);next.dailyControls=selected;next.generalCleaningTarget=target;state.haccp=validateHaccp(next)});
  },'Сохранить план контроля');
  const e=formShell('Добавить оборудование');selectField(e,'Точка','pointId',pointOptions());inputField(e,'Название оборудования','name',{required:true,maxLength:120});inputField(e,'Утверждённый минимум, °C (необязательно)','min',{type:'number'});inputField(e,'Утверждённый максимум, °C (необязательно)','max',{type:'number'});e.append(el('p','Вводи границы из утверждённых процедур. Без границ измерения сохраняются без оценки. В старых записях остаются границы, действовавшие при замере.','small'));submitForm(e,async raw=>commit(state=>addEquipment(state,raw)),'Добавить оборудование');history.append(el('h2','Оборудование'));for(const item of h().equipment){const f=el('form',undefined,'haccp-record');f.append(el('h3',pointName(item.pointId)+' · '+item.name));inputField(f,'Название','name',{required:true,value:item.name,maxLength:120});inputField(f,'Минимум, °C','min',{type:'number',value:item.min??''});inputField(f,'Максимум, °C','max',{type:'number',value:item.max??''});submitForm(f,async raw=>commit(state=>updateEquipment(state,item.id,raw)),'Сохранить оборудование');history.append(f)}
 }
 function drawHistory(){history.replaceChildren();if(journalTypes[tab])journalHistory()}
 function build(){
 const isCatalog=tab===null,isJournal=!!journalTypes[tab];root.dataset.haccpView=isCatalog?'catalog':isJournal?'journal':'utility';back.hidden=isCatalog;filters.hidden=!isCatalog&&!isJournal;filters.open=isCatalog;pageTitle.textContent=isCatalog?'ХАССП':allTabs[tab];
 controls.hidden=!isCatalog&&!isJournal;monthBar.hidden=periodHint.hidden=isCatalog||!isJournal;fromDate.parentElement.hidden=toDate.parentElement.hidden=isCatalog;metrics.hidden=!isCatalog;banner.hidden=!isCatalog;guidance.hidden=!isCatalog;nav.hidden=true;
 const past=monthFilter.value<currentMonth;temperatureSelection.month=monthFilter.value;periodHint.textContent=past?'Архив: '+monthLabel(monthFilter.value)+'. Записи доступны для просмотра, печати и скачивания.':monthFilter.value===currentMonth?'Текущий месяц. При смене месяца записи остаются в архиве.':'Будущий месяц: доступна пустая форма для печати.';body.replaceChildren();history.replaceChildren();message.textContent='';for(const b of nav.children)b.setAttribute('aria-pressed',String(b.dataset.tab===tab));if(!loaded){body.append(el('p','Загружаю данные устройства…'));return}if(tab===null){catalog();return}if(tab==='temperature'){
   // Open at a single branch, rather than accidentally mixing settings from four.
   if(!temperaturePointInitialized){
    temperaturePointInitialized=true;
    if(!pointFilter.value)pointFilter.value=(h().points.find(p=>p.name.trim().toLocaleLowerCase('ru-RU')==='плазма')||h().points[0])?.id||'';
   }
   mountTemperatureGrid(body,{getHaccp:h,pointId:pointFilter.value,selection:temperatureSelection,onPointChange:id=>{pointFilter.value=id;metricsRender();build()},onMonthChange:value=>{monthFilter.value=value;build()},commit,onSettings:()=>{tab='settings';build()},notify});const single=el('details',undefined,'haccp-single-record');single.append(el('summary','Отдельный замер с фотографией'));if(monthFilter.value===currentMonth)journalForm();else body.append(el('p','В архиве новые замеры не добавляются.','small'));single.append(body.lastElementChild);body.append(single);journalHistory()}else if(journalTypes[tab]){if(monthFilter.value===currentMonth)journalForm();body.append(dailyDrafts());journalAutoDrafts();journalHistory()}else if(tab==='actions')actionsView();else if(tab==='documents')documentsView();else settingsView()}
 for(const [key,label] of Object.entries(allTabs)){const b=button(label,()=>{tab=key;build()});b.dataset.tab=key;nav.append(b)}
 function selectMonth(){if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(monthFilter.value)){say('Выбери корректный месяц.',true);return}fromDate.value=toDate.value='';build()}monthFilter.onchange=selectMonth;archive.onchange=()=>{monthFilter.value=archive.value;selectMonth()};
 pointFilter.onchange=()=>{metricsRender();build()};fromDate.onchange=toDate.onchange=()=>{if(fromDate.value&&toDate.value&&fromDate.value>toDate.value){say('Начало периода позже окончания.',true);return}if(journalTypes[tab])drawHistory()};
 let plasmaPresetRunning=false;
 async function ensurePlasmaPreset(){
  if(!getState()||plasmaPresetRunning||!plasmaPresetNeeded(h()))return;
  plasmaPresetRunning=true;
  try{
   await save(state=>{
    if(!plasmaPresetNeeded(state.haccp))return;
    if(seedPlasmaTemperatures(state)){
     state.haccp.revision=(Number(state.haccp.revision)||0)+1;
     state.haccp.updatedAt=new Date().toISOString();
    }
   });
  }catch(error){console.warn('Не удалось настроить оборудование Плазмы:',error)}
  finally{plasmaPresetRunning=false}
 }
 let autoSyncRunning=false;
 async function syncAutoDrafts(){
  if(!getState()||autoSyncRunning)return;
  let pending;
  try{pending=dueAutoDrafts(h())}catch(error){console.warn('ХАССП автозаполнение:',error);return}
  if(!pending.length)return;
  autoSyncRunning=true;
  try{await save(state=>{const created=generateAutoDrafts(state);
   if(created){state.haccp.revision=(Number(state.haccp.revision)||0)+1;state.haccp.updatedAt=new Date().toISOString()}
  })}catch(error){console.warn('Автосоздание черновиков будет повторено:',error.message)}
  finally{autoSyncRunning=false}
 }
 function render(state){if(!state)return;const data=validateHaccp(state.haccp);queueMicrotask(()=>{void ensurePlasmaPreset().then(()=>syncAutoDrafts())});if(loaded&&lastRevision===(data.revision||0))return;loaded=true;lastRevision=data.revision||0;const months=[...new Set([currentMonth,...data.records.map(r=>measurementDate(r.at).slice(0,7))])].sort().reverse();options(archive,months.map(m=>[m,m===currentMonth?'Текущий месяц':monthLabel(m)]));options(pointFilter,[['','Все точки'],...data.points.map(p=>[p.id,p.name])],false);metricsRender();build()}
 let lastClockStage=moscowCheckpoint(),lastSeenRevision=null;
 setInterval(()=>{
  const next=moscowCheckpoint(),changedMonth=next.month!==currentMonth;
  const changedDay=next.day!==lastClockStage.day,changedStage=next.due!==lastClockStage.due;
  lastClockStage=next;
  if(changedMonth){if(monthFilter.value===currentMonth)monthFilter.value=next.month;currentMonth=next.month;lastRevision=null;render(getState());return}
  if(changedDay||changedStage){void syncAutoDrafts();if(loaded&&root.isConnected&&root.closest('[hidden]')===null)build()}
  else if(next.due&&loaded)void syncAutoDrafts();
 },60000);
 build();return {render,open(kind){if(!journalTypes[kind])return false;tab=kind;build();return true}};
}
