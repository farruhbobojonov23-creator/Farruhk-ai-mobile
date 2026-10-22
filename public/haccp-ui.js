import {extraJournals,extraFieldNames} from './haccp-extra.js?v=2';
import {measurementDate,monthLabel} from './temperature-journal.js';
import {moscowCheckpoint,dueRecords,deepCleaningProgress} from './haccp-schedule.js?v=1';
import {paperColumns,paperCell} from './haccp-paper-layout.js?v=10';
import {automaticJournalSummary} from './haccp-auto-journals.js?v=9';
import {saveAutoTemplate,dueAutoDrafts,generateAutoDrafts,confirmAutoDraft} from './haccp-template-drafts.js?v=9';
import {journalTypes,auditItems,emptyHaccp,validateHaccp,addEquipment,updateEquipment,addJournalRecord,closeCorrectiveAction,journalCsv} from './haccp-model.js?v=7';
import {mountTemperatureGrid} from './temperature-grid-ui.js?v=72';
import {plasmaPresetNeeded,seedPlasmaTemperatures} from './temperature-point-config.js?v=1';
import {cleaningPlan,cleaningPlanNeedsSeed,seedCleaningPlan,updateCleaningPlan} from './cleaning-plan.js?v=1';
import {RECEIVING_GROUPS,RECEIVING_CHECKS,RECEIVING_CHECK_VALUES,receivingSettings,updateReceivingSettings} from './receiving-config.js?v=1';
import {STORAGE_GROUPS,STORAGE_CHECKS,STORAGE_RESULTS,storageSettings,updateStorageSettings} from './storage-config.js?v=1';
import {thawProducts,thawMethod,thawElapsed,thawConfig,updateThawConfig} from './thaw-config.js?v=1';
import {QUALITY_CRITERIA,QUALITY_RESULTS,qualityPlan,qualityPlanNeedsSeed,seedQualityDailyPlan,updateQualityPlan} from './quality-control.js?v=1';
import {HYGIENE_CHECKS,HYGIENE_OUTCOMES,hygieneSettings,updateHygieneSettings,preparedHygieneRows} from './hygiene-config.js?v=3';
import {OIL_CHECKS,OIL_CHECK_RESULTS,oilSettings,updateOilSettings,oilCycleState} from './frying-oil-config.js?v=1';
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
 function hygieneSettingsPanel(){
  const pointId=pointFilter.value||h().points[0]?.id;
  if(!pointId)return el('p','Сначала добавь точку в настройках.');
  const point=h().points.find(p=>p.id===pointId),config=hygieneSettings(h(),pointId);
  const box=el('section',undefined,'haccp-daily-overview haccp-hygiene-settings');
  box.append(el('h2','Гигиенический осмотр · '+point.name),
   el('p','Сотрудники: '+config.employees.length+' · назначенных смен: '+config.roster.length+'. Проверку проводит '+config.reviewer+'.','small'),
   el('p','Добавь сотрудника через карточку. ФИО, должность и время смены заполняются отдельно — никаких строк с символами «|».','small'));
  const details=el('details',undefined,'haccp-template-settings haccp-hygiene-card-settings');
  details.append(el('summary','⚙ Сотрудники и график смен'));
  const form=el('form',undefined,'haccp-form haccp-hygiene-card-form');
  form.append(el('h3','Карточка сотрудника'));
  const grid=el('div',undefined,'haccp-hygiene-card-fields');
  const name=inputField(grid,'ФИО сотрудника','name',{required:true,maxLength:120});
  name.placeholder='Например: Иванов Иван Иванович';
  name.setAttribute('list','haccp-hygiene-card-known-names');
  const knownNames=el('datalist');knownNames.id='haccp-hygiene-card-known-names';
  knownNames.append(...config.employees.map(value=>{const o=el('option');o.value=value;return o}));
  grid.append(knownNames);
  const role=inputField(grid,'Должность','role',{required:true,maxLength:120});
  role.placeholder='Например: Шеф-повар';
  role.setAttribute('list','haccp-hygiene-card-known-roles');
  const knownRoles=el('datalist');knownRoles.id='haccp-hygiene-card-known-roles';
  knownRoles.append(...config.roles.map(value=>{const o=el('option');o.value=value;return o}));
  grid.append(knownRoles);
  const startTime=inputField(grid,'Начало смены','startTime',{type:'time',required:true});
  const shift=inputField(grid,'Название смены','shift',{maxLength:120});
  shift.placeholder='Например: Дневная';
  form.append(grid);
  form.append(el('p','Дата подставится автоматически. Время начала смены указывай по Москве. Проверки и решение о допуске остаются пустыми.','small'));
  const reviewer=inputField(form,'Проводит осмотр (должность)','reviewer',{
   required:true,value:config.reviewer,maxLength:120
  });
  const actions=el('div',undefined,'haccp-hygiene-card-actions');
  const saveButton=el('button','＋ Добавить сотрудника','primary');
  saveButton.type='submit';
  const cancelEdit=button('Отменить изменение',()=>{
   editing=-1;form.reset();reviewer.value=config.reviewer;
   saveButton.textContent='＋ Добавить сотрудника';cancelEdit.hidden=true;
  });
  cancelEdit.hidden=true;
  const saveReviewer=button('Сохранить проверяющего',safe(async()=>{
   await persist(currentRoster);
  }));
  actions.append(saveButton,cancelEdit,saveReviewer);form.append(actions);
  details.append(form);
  const rosterBox=el('section',undefined,'haccp-hygiene-roster-section');
  rosterBox.append(el('h3','Назначенные смены'));
  const list=el('div',undefined,'haccp-hygiene-roster-list');
  rosterBox.append(list);details.append(rosterBox);
  box.append(details);

  let currentRoster=config.roster.map(item=>({...item}));
  let editing=-1,busy=false;
  const same=(a,b)=>String(a||'').trim().toLocaleLowerCase('ru-RU')===String(b||'').trim().toLocaleLowerCase('ru-RU');
  const unique=values=>values.filter((item,index,array)=>
   item&&array.findIndex(other=>same(item,other))===index);
  async function persist(updated){
   if(busy)return;
   if(!reviewer.value.trim())throw Error('Укажи должность проверяющего.');
   busy=true;saveButton.disabled=true;saveReviewer.disabled=true;
   try{
    await commit(state=>{
     const stored=hygieneSettings(state.haccp,pointId);
     const notScheduled=stored.employees.filter(employee=>
      !stored.roster.some(staff=>same(staff.name,employee)));
     updateHygieneSettings(state,pointId,{
      employees:unique([...notScheduled,...updated.map(item=>item.name)]),
      roles:unique([...stored.roles,...updated.map(item=>item.role)]),
      roster:updated,reviewer:reviewer.value.trim()
     });
     state.haccp=validateHaccp(state.haccp);
    });
    build();
    body.querySelector('.haccp-hygiene-card-settings')?.setAttribute('open','');
   }finally{busy=false;saveButton.disabled=false;saveReviewer.disabled=false}
  }
  function refreshList(){
   list.replaceChildren();
   if(!currentRoster.length)list.append(el('p','График ещё пуст. Заполни карточку выше и нажми «Добавить сотрудника».','small'));
   for(const [index,staff] of currentRoster.entries()){
    const card=el('article',undefined,'haccp-hygiene-staff-card');
    card.append(el('strong',staff.name),
     el('p',staff.role+' · '+staff.startTime+(staff.shift?' · '+staff.shift:''),'small'));
    const toolbar=el('div',undefined,'haccp-hygiene-staff-buttons');
    toolbar.append(button('✎ Изменить',()=>{
     editing=index;
     name.value=staff.name;role.value=staff.role;
     startTime.value=staff.startTime;shift.value=staff.shift;
     saveButton.textContent='✓ Сохранить изменения';
     cancelEdit.hidden=false;name.focus();form.scrollIntoView({behavior:'smooth',block:'start'});
    }),button('Удалить',safe(async()=>{
     if(!window.confirm('Убрать смену сотрудника «'+staff.name+'» из графика?'))return;
     await persist(currentRoster.filter((_,i)=>i!==index));
    })));
    card.append(toolbar);list.append(card);
   }
   const unscheduled=config.employees.filter(employee=>
    !currentRoster.some(staff=>same(staff.name,employee)));
   if(unscheduled.length)rosterBox.append(el('p',
    'Из старого справочника без времени смены: '+unscheduled.join(', ')+
    '. Выбери ФИО в карточке и укажи время.','small'));
  }
  form.onsubmit=safe(async event=>{
   event.preventDefault();
   if(busy||!form.reportValidity())return;
   const updated={
    name:name.value.trim(),role:role.value.trim(),
    startTime:startTime.value,shift:shift.value.trim()
   };
   // Editing an existing row should not preserve its old value as an extra shift.
   const next=currentRoster.filter((_,index)=>index!==editing);
   next.push(updated);
   await persist(next);
  });
  refreshList();
  return box;
 }
 function hygienePreparedPanel(){
  const pointId=pointFilter.value||h().points[0]?.id;
  if(!pointId)return el('p','Сначала настрой точку.');
  const day=moscowCheckpoint().day;
  const place=h().points.find(p=>p.id===pointId);
  const settings=hygieneSettings(h(),pointId);
  const rows=preparedHygieneRows(h(),pointId,day);
  const panel=el('section',undefined,'haccp-daily-overview haccp-hygiene-prepared');
  panel.append(el('h2','К осмотру перед сменой · '+place.name),
   el('p','Дата: '+day.slice(8)+'.'+day.slice(5,7)+'.'+day.slice(0,4)+
    '. Эти строки подготавливаются из графика автоматически при открытии приложения. Они не являются записями осмотра и не попадают в PDF до проверки.','small'));
  if(!rows.length){
   panel.append(el('p',settings.employees.length?
    'Сотрудники есть в справочнике, но им ещё не назначено время смены. Открой «Сотрудники и график смен» и заполни карточку.':
    'Список сотрудников пока пуст. Нажми «Сотрудники и график смен», укажи ФИО, должность и время, затем «Добавить сотрудника».','small'));
   return panel;
  }
  const total=rows.filter(r=>!r.complete).length;
  panel.append(el('p','В графике '+rows.length+' смен; требуют фактического осмотра: '+total+'.','small'));
  const list=el('div',undefined,'haccp-hygiene-prepared-list');
  for(const item of rows){
   const row=el('div',undefined,'haccp-record haccp-prepared-person');
   row.append(el('strong',item.name+' · '+item.role),
    el('p',(item.shift||'Смена')+' · начало '+item.startTime+
     (item.complete?' · '+item.recordedDecision:' · Осмотр не записан'),'small'));
   if(!item.complete){
    const choose=button('✎ Открыть осмотр',()=>{
     const form=body.querySelector('.haccp-sheet');
     if(!form){say('Открой текущий месяц для заполнения осмотра.',true);return}
     const chooseField=(name,value)=>{
      const input=form.querySelector('[name="'+name+'"]');
      if(!input)return;
      input.value=value;
      input.dispatchEvent(new Event('change',{bubbles:true}));
     };
     chooseField('pointId',item.pointId);
     chooseField('employee',item.name);
     chooseField('role',item.role);
     chooseField('shift',item.shift);
     chooseField('shiftStart',item.day+'T'+item.startTime);
     // Never prefill the inspector's identity, inspection observations or admission decision.
     for(const name of ['owner','reviewer','hygieneDecision',...HYGIENE_CHECKS.map(([key])=>key)]){
      const f=form.querySelector('[name="'+name+'"]');
      if(f)f.value='';
     }
     const notes=form.querySelector('[name=notes]');
     if(notes)notes.value='';
     form.querySelector('.journal-modes button:nth-child(2)')?.click();
     form.scrollIntoView({behavior:'smooth',block:'start'});
    },'primary');
    row.append(choose);
   }
   list.append(row);
  }
  panel.append(list);
  const unassigned=settings.employees.filter(name=>
   !settings.roster.some(staff=>staff.name.toLocaleLowerCase('ru-RU')===name.toLocaleLowerCase('ru-RU')));
  if(unassigned.length)panel.append(el('p','Без графика: '+unassigned.join(', ')+
   '. Их смены не подготавливаются автоматически.','small'));
  return panel;
 }
 function qualitySettingsPanel(){
  const pointId=pointFilter.value||h().points[0]?.id;
  if(!pointId)return el('p','Добавь торговую точку.');
  const point=h().points.find(p=>p.id===pointId),plan=qualityPlan(h(),pointId);
  const recipes=(getState()?.recipes||[]).filter(r=>r.name?.trim());
  const categories=[...new Set(recipes.map(r=>r.category||'Без категории'))];
  const panel=el('section',undefined,'haccp-daily-overview haccp-quality-settings');
  panel.append(el('h2','Бракераж готовых блюд · '+point.name),
   el('p','Режим В: контроль перед началом реализации каждый день и дополнительно каждой новой партии. Сушист готовит, старший смены проверяет и принимает решение.','small'),
   el('p','ТТК доступны из общего каталога: '+recipes.length+' блюд в '+categories.length+' категориях. Можно выбрать блюдо или указать фактически приготовленное вручную.','small'),
   el('p','Ежедневный черновик подготавливается после 11:00 МСК при работающем приложении или при следующем открытии. Он не означает, что блюдо уже проверено, и не разрешает продажу.','small'));
  const details=el('details');details.append(el('summary','⚙ Настроить ответственных этой точки'));
  const form=el('form',undefined,'haccp-form');
  inputField(form,'Готовит и вносит запись','executor',{required:true,value:plan.executor,maxLength:120});
  inputField(form,'Проверяет и разрешает реализацию','reviewer',{required:true,value:plan.reviewer,maxLength:120});
  const submit=el('button','Сохранить ответственных','primary');submit.type='submit';form.append(submit);
  form.onsubmit=safe(async e=>{
   e.preventDefault();if(!form.reportValidity())return;
   submit.disabled=true;
   try{const raw=Object.fromEntries(new FormData(form));
    await commit(state=>{
     updateQualityPlan(state,pointId,{executor:raw.executor,reviewer:raw.reviewer});
     state.haccp=validateHaccp(state.haccp);
    });build();
   }finally{submit.disabled=false}
  });
  details.append(form);panel.append(details);
  return panel;
 }
 function defrostSettingsPanel(){
  const pointId=pointFilter.value||h().points[0]?.id;
  if(!pointId)return el('p','Добавь точку в настройках.');
  const point=h().points.find(p=>p.id===pointId),config=thawConfig(h(),pointId);
  const panel=el('section',undefined,'haccp-daily-overview haccp-defrost-settings');
  panel.append(el('h2','Размораживание · '+point.name),
   el('p','Метод по вашему стандарту: в холодильнике +2…+6 °C (при соблюдении указаний производителя). Исполнитель: '+config.executor+'. Проверяет: '+config.reviewer+'.','small'),
   el('p','СанПиН 2.3/2.4.4282-26 не задаёт единого количества часов размораживания для всех продуктов. Время определяется технологической инструкцией конкретного сырья; система измеряет фактическую длительность.','small'));
  const details=el('details');
  details.append(el('summary','⚙ Редактировать продукты, способы и ответственных'));
  const form=el('form',undefined,'haccp-form');
  const products=inputField(form,'Продукты (каждый с новой строки)','products',{type:'textarea',value:config.products.join('\n'),maxLength:8000});
  products.rows=7;
  const methods=inputField(form,'Способы размораживания по утверждённой инструкции','methods',{type:'textarea',value:config.methods.join('\n'),required:true,maxLength:8000});
  methods.rows=4;
  inputField(form,'Исполнитель','executor',{value:config.executor,required:true,maxLength:120});
  inputField(form,'Проверяющий','reviewer',{value:config.reviewer,required:true,maxLength:120});
  const buttonSave=el('button','Сохранить настройки размораживания','primary');buttonSave.type='submit';form.append(buttonSave);
  form.onsubmit=safe(async e=>{
   e.preventDefault();if(!form.reportValidity())return;
   const raw=Object.fromEntries(new FormData(form));
   const lines=value=>String(value||'').split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
   buttonSave.disabled=true;
   try{
    await commit(state=>{
     updateThawConfig(state,pointId,{products:lines(raw.products),methods:lines(raw.methods),executor:raw.executor,reviewer:raw.reviewer});
     state.haccp=validateHaccp(state.haccp);
    });build();
   }finally{buttonSave.disabled=false}
  });
  details.append(form);panel.append(details);
  return panel;
 }
 function storageSettingsPanel(){
  const selectedId=pointFilter.value||h().points[0]?.id;
  if(!selectedId)return el('p','Сначала добавь точку в настройках.');
  const point=h().points.find(p=>p.id===selectedId);
  const config=storageSettings(h(),selectedId);
  const panel=el('section',undefined,'haccp-daily-overview haccp-storage-settings');
  panel.append(el('h2','Маркировка и хранение · '+point.name),
   el('p','Продукты и зоны — справочные подсказки. Срок годности и условия для каждой партии вводятся вручную по этикетке, ТТК или утверждённой инструкции.','small'),
   el('p','Продуктов в справочнике: '+config.products.length+
    ' · зон хранения: '+config.zones.length+'.','small'));
  if(!pointFilter.value)panel.append(el('p','Показана первая точка. Выбери другой филиал в фильтре, чтобы редактировать его настройки отдельно.','small'));
  const details=el('details',undefined,'haccp-template-settings');
  details.append(el('summary','⚙ Изменить продукты и зоны хранения'));
  const form=el('form',undefined,'haccp-form');
  const products=inputField(form,'Продукты (по одному на строке)','products',{
   type:'textarea',value:config.products.join('\n'),maxLength:8000});
  products.rows=8;
  const zones=inputField(form,'Зоны хранения (по одной на строке)','zones',{
   type:'textarea',required:true,value:config.zones.join('\n'),maxLength:6000});
  zones.rows=5;
  form.append(el('p','Не вводи сюда универсальные сроки хранения — они зависят от конкретного продукта и его утверждённой технологии.','small'));
  const saveButton=el('button','Сохранить справочник хранения','primary');saveButton.type='submit';form.append(saveButton);
  form.onsubmit=safe(async e=>{
   e.preventDefault();if(!form.reportValidity())return;
   const raw=Object.fromEntries(new FormData(form));
   const list=value=>String(value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
   saveButton.disabled=true;
   try{
    await commit(state=>{
     updateStorageSettings(state,selectedId,{products:list(raw.products),zones:list(raw.zones)});
     state.haccp=validateHaccp(state.haccp);
    });
    build();
   }finally{saveButton.disabled=false}
  });
  details.append(form);panel.append(details);
  const past=h().records.filter(r=>r.kind==='storage'&&r.pointId===selectedId)
   .sort((a,b)=>b.at.localeCompare(a.at)).slice(0,4);
  if(past.length){
   const historyNote=el('details');
   historyNote.append(el('summary','Последние записи маркировки · '+past.length),
    el('p','Это исторические проверки, не подтверждение наличия товара на складе сейчас.','small'));
   for(const r of past)historyNote.append(el('p',
    (r.details?.product||'Продукт')+' · '+displayDate(r.at)+' · срок до '+displayDate(r.details?.useBy)+
    ' · '+(r.status==='deviation'?'Было замечание':'Запись сохранена'),'small'));
   panel.append(historyNote);
  }
  return panel;
 }
 function fryingOilSettingsPanel(){
  const pointId=pointFilter.value||h().points[0]?.id;
  if(!pointId)return el('p','Сначала добавь точку.');
  const cfg=oilSettings(h(),pointId);
  const point=h().points.find(p=>p.id===pointId);
  const panel=el('section',undefined,'haccp-daily-overview haccp-frying-settings');
  panel.append(el('h2','Фритюрное масло · '+point.name),
   el('p','Масло: '+cfg.oil+'. Внутренний график: полная замена через '+cfg.intervalDays+' суток ('+(cfg.intervalDays*24)+' часов). При ухудшении качества менять раньше.','small'),
   el('p','Указанные три дня — ваш производственный график, а не универсальная норма безопасности.','small'));
  for(const name of cfg.fryerNames){
   const cycle=oilCycleState(h(),pointId,name),card=el('article',undefined,'haccp-fryer-status');
   card.append(el('strong',name),el('p',cycle.filledAt?
    'Последняя сохранённая заливка: '+displayDate(cycle.filledAt)+' · замена по графику: '+displayDate(cycle.dueAt)+
    (cycle.isDue?' · Срок замены наступил':''):
    'Последняя заливка пока неизвестна. Укажи её фактическое время при первой проверке.','small'));
   panel.append(card);
  }
  const details=el('details',undefined,'haccp-template-settings');
  details.append(el('summary','⚙ Масло, количество фритюрниц и график'));
  const form=el('form',undefined,'haccp-form haccp-frying-settings-form');
  inputField(form,'Название фритюрного масла','oil',{required:true,value:cfg.oil,maxLength:160});
  const names=inputField(form,'Фритюрницы (каждая с новой строки)','fryerNames',{
   type:'textarea',value:cfg.fryerNames.join('\n'),required:true,maxLength:4500});
  names.rows=5;
  inputField(form,'Полная замена каждые N дней','intervalDays',{
   type:'number',required:true,value:String(cfg.intervalDays)});
  inputField(form,'Ведёт журнал','executor',{required:true,value:cfg.executor,maxLength:120});
  inputField(form,'Проверяет','reviewer',{required:true,value:cfg.reviewer,maxLength:120});
  form.append(el('p','Укажи фактическое количество фритюрниц на этой точке. У каждой точки отдельный список оборудования.','small'));
  const saveButton=el('button','Сохранить настройки фритюра','primary');
  saveButton.type='submit';form.append(saveButton);
  form.onsubmit=safe(async event=>{
   event.preventDefault();if(!form.reportValidity())return;
   const raw=Object.fromEntries(new FormData(form));
   saveButton.disabled=true;
   try{
    await commit(state=>{
     updateOilSettings(state,pointId,{
      ...raw,fryerNames:String(raw.fryerNames||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean)
     });
     state.haccp=validateHaccp(state.haccp);
    });build();
   }finally{saveButton.disabled=false}
  });
  details.append(form);panel.append(details);
  return panel;
 }
 function receivingSettingsPanel(){
  const selectedId=pointFilter.value||h().points[0]?.id;
  if(!selectedId)return el('p','Сначала добавь точку в настройках.');
  const point=h().points.find(p=>p.id===selectedId);
  const settings=receivingSettings(h(),selectedId);
  const panel=el('section',undefined,'haccp-daily-overview haccp-receiving-settings');
  panel.append(el('h2','Приёмка сырья · '+point.name),
   el('p','Учет ведётся по факту поступления. Без поставки строка не создаётся и не отмечается выполненной.','small'),
   el('p','Поставщиков сохранено: '+settings.suppliers.length+' · товаров в подсказках: '+settings.products.length+'. Другого поставщика и продукт можно указать вручную.','small'));
  if(!pointFilter.value)panel.append(el('p','Сейчас показаны настройки первой точки. Выбери другую точку в фильтре, чтобы настроить её отдельно.','small'));
  const details=el('details',undefined,'haccp-template-settings');
  details.append(el('summary','⚙ Изменить список поставщиков и товаров'));
  const form=el('form',undefined,'haccp-form');
  const vendors=inputField(form,'Поставщики (по одному на строке)','suppliers',{
   type:'textarea',value:settings.suppliers.join('\n'),maxLength:8000});
  vendors.rows=5;
  const products=inputField(form,'Товары для подсказок (по одному на строке)','products',{
   type:'textarea',value:settings.products.join('\n'),maxLength:8000});
  products.rows=9;
  form.append(el('p','Это только подсказки ввода. Они не создают поставку и не подставляют результаты проверки.','small'));
  const action=el('button','Сохранить справочник точки','primary');action.type='submit';form.append(action);
  form.onsubmit=safe(async e=>{
   e.preventDefault();if(!form.reportValidity())return;
   const list=value=>String(value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
   const values=Object.fromEntries(new FormData(form));
   action.disabled=true;
   try{await commit(state=>{
    updateReceivingSettings(state,selectedId,{suppliers:list(values.suppliers),products:list(values.products)});
    state.haccp=validateHaccp(state.haccp);
   });build()}finally{action.disabled=false}
  });
  details.append(form);panel.append(details);
  return panel;
 }
 function cleaningSettingsPanel(){
  const selectedId=pointFilter.value||h().points[0]?.id;
  if(!selectedId)return el('p','Сначала добавь точку в настройках.');
  const point=h().points.find(p=>p.id===selectedId),plan=cleaningPlan(h(),selectedId);
  const panel=el('section',undefined,'haccp-daily-overview haccp-cleaning-settings');
  panel.append(el('h2','План уборки · '+point.name),
   el('p','Ежедневно: '+plan.dailyExecutor+' · проверка: '+plan.reviewer+'. Генеральная: '+plan.generalExecutor+' — '+plan.generalDays.join(' и ')+' числа каждого месяца.','small'),
   el('p','Зоны ежедневной уборки: '+plan.dailyZones.join('; ')+'.','small'),
   el('p','Генеральная уборка: '+plan.generalZones.join('; ')+'.','small'),
   el('p','Доступные средства: '+plan.agents.join(', ')+'. Концентрацию, выдержку, совместимость с поверхностями и необходимость смывания проверяйте по инструкции конкретного средства. Не смешивайте составы.','small'));
  if(!pointFilter.value)panel.append(el('p','Сейчас отображён план первой точки. Чтобы редактировать другой филиал, выбери его в фильтре «Точка, месяц и архив».','small'));
  const details=el('details');details.append(el('summary','⚙ Изменить зоны, средства, персонал и график'));
  const form=el('form',undefined,'haccp-form');
  const daily=inputField(form,'Зоны ежедневной уборки (по одной в строке)','dailyZones',{type:'textarea',required:true,value:plan.dailyZones.join('\n'),maxLength:2500});
  daily.rows=8;
  const general=inputField(form,'Зоны генеральной уборки (по одной в строке)','generalZones',{type:'textarea',required:true,value:plan.generalZones.join('\n'),maxLength:2500});
  general.rows=8;
  const agents=inputField(form,'Моющие и дезинфицирующие средства (по одному в строке)','agents',{type:'textarea',required:true,value:plan.agents.join('\n'),maxLength:500});
  agents.rows=3;
  inputField(form,'Ежедневная уборка — исполнитель','dailyExecutor',{required:true,value:plan.dailyExecutor,maxLength:120});
  inputField(form,'Кто проверяет','reviewer',{required:true,value:plan.reviewer,maxLength:120});
  inputField(form,'Генеральная уборка — исполнитель','generalExecutor',{required:true,value:plan.generalExecutor,maxLength:120});
  const dates=el('div',undefined,'fields');
  const first=inputField(dates,'Первое число генеральной уборки','firstDay',{type:'number',required:true,value:String(plan.generalDays[0])});
  const second=inputField(dates,'Второе число генеральной уборки','secondDay',{type:'number',required:true,value:String(plan.generalDays[1])});
  for(const input of [first,second]){input.min='1';input.max='28';input.step='1'}
  form.append(dates,el('p','Черновики готовятся с 11:00 МСК. Выполненные уборки не отмечаются автоматически. Изменения графика применяются к новым черновикам.','small'));
  const saveBtn=el('button','Сохранить план уборки','primary');saveBtn.type='submit';form.append(saveBtn);
  form.onsubmit=safe(async e=>{
   e.preventDefault();
   if(!form.reportValidity())return;
   const raw=Object.fromEntries(new FormData(form));
   const list=value=>String(value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
   saveBtn.disabled=true;
   try{
    await commit(state=>updateCleaningPlan(state,selectedId,{
     dailyZones:list(raw.dailyZones),generalZones:list(raw.generalZones),agents:list(raw.agents),
     dailyExecutor:raw.dailyExecutor,reviewer:raw.reviewer,generalExecutor:raw.generalExecutor,
     generalDays:[Number(raw.firstDay),Number(raw.secondDay)]
    }));
    build();
   }finally{saveBtn.disabled=false}
  });
  details.append(form);panel.append(details);
  return panel;
 }
 function dailyDrafts(){
  if(['receiving','defrosting','hygiene','frying'].includes(tab)){
   const box=el('section',undefined,'haccp-daily-overview');
   box.append(el('h2',tab==='frying'?'Фактический контроль фритюрного масла':tab==='hygiene'?'Осмотр перед каждой сменой':tab==='defrosting'?'Размораживание по факту начала процесса':'Приёмка по факту поставки'),
    el('p',tab==='frying'?'Плановая замена через каждые три суток после фактической заливки. Контроль и замену записывают только после выполнения.':tab==='hygiene'?'Создавай запись для каждого фактически осмотренного сотрудника перед началом его смены. Записи без осмотра и решения не создаются.':tab==='defrosting'?'Запиши фактическое начало, затем окончание, замеры и проверку старшего смены. Без фактического процесса завершённая запись не создаётся.':'Журнал заполняется только при реальной доставке. Ежедневные черновики и фиктивные поступления не создаются. Для новой партии открой «Заполнение».','small'));
   return box;
  }
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
   panel.append(el('p','Генеральная уборка: '+prog.done+' из '+prog.target+' подтверждённых выполнений за месяц. Плановые даты — 1-е и 15-е число (или изменённый график выбранной точки).','small'));
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
  // A delivery is an event, never an automatic daily check or pre-approved receipt.
  if(['receiving','defrosting','quality','hygiene','frying'].includes(kind))toolbar.append(edit,save,pdf);
  else toolbar.append(edit,save,sample,loadSample,pdf);
  const modes=el('nav',undefined,'journal-modes');
  const fill=button('✎ Заполнение',()=>setMode('form')),paperView=button('▦ Лист А4',()=>setMode('paper'));
  modes.append(paperView,fill);
  const paperHint=el('p','Лист А4: отображаются заполненные и сохранённые записи. Для новой записи нажми «Заполнение».','haccp-paper-hint');
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
  const refreshPaper=()=>{
   if(!form.isConnected)return;
   const selectedPoint=form.querySelector('[name=pointId]')?.value;
   const actual=currentRecords().filter(r=>!selectedPoint||r.pointId===selectedPoint);
   const saved=actual.slice(0,14).reverse();
   meta.textContent=monthLabel(monthFilter.value)+'   ·   '+
    (selectedPoint?pointName(selectedPoint):'Все точки');
   tbody.replaceChildren();
   // Official A4 form: only real, saved records appear in the document.
   // The edit form is kept separate; no unsaved inspection or artificial
   // timestamps, verdicts, signoffs or operational labels enter a paper row.
   for(const record of saved){
    const tr=el('tr');
    for(const col of columns){
     const cell=el('td',paperCell(record,col.key,h().points));
     cell.dataset.column=col.key;tr.append(cell);
    }
    tbody.append(tr);
   }
   // Clean blank lines for handwritten additions, without 'draft',
   // 'not confirmed' or invented positive/negative observations.
   for(let i=saved.length;i<10;i++){
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
 function journalForm(){const form=formShell('Новая запись: '+journalTypes[tab]),{grid,point}=common(form);let equipment,cleaningChecks;
  if(tab==='temperature'){equipment=selectField(grid,'Оборудование','equipmentId',[],{});const measured=inputField(grid,'Измеренная температура, °C','measured',{type:'number',required:true});const hint=el('p','Сначала добавь оборудование и его утверждённые границы в настройках.','small');form.append(hint);const sync=()=>{options(equipment,h().equipment.filter(e=>e.pointId===point.value).map(e=>[e.id,e.name]),true);updateHint()};const updateHint=()=>{const item=h().equipment.find(e=>e.id===equipment.value);hint.textContent=!item?'Выбери оборудование этой точки.':item.min===null&&item.max===null?'Границы не заданы. Измерение сохранится без оценки соответствия.':'Заданные границы: '+(item.min??'без минимума')+' … '+(item.max??'без максимума')+' °C. Границы попадут в запись.'};point.onchange=sync;equipment.onchange=updateHint;sync();measured.inputMode='decimal'}
  if(tab==='cleaning'){
   const type=selectField(grid,'Тип уборки','cleaningType',[['daily','Ежедневная / текущая'],['general','Генеральная (по графику)']],{blank:false});
   const zone=inputField(grid,'Зона / инвентарь','zone',{required:true,maxLength:200});
   inputField(grid,'Что обработали и каким способом','method',{required:true,maxLength:500,
    value:'Мойка и дезинфекция согласно утверждённой инструкции для каждой зоны'});
   const agent=selectField(grid,'Фактически применённое средство','agent',[],{blank:true});
   inputField(grid,'Концентрация по инструкции, если применимо','concentration',{maxLength:100});
   inputField(grid,'Время выдержки по инструкции','exposure',{maxLength:100});
   inputField(grid,'ФИО проверяющего (старший смены)','checker',{required:true,maxLength:120});
   selectField(grid,'Фактический результат','result',[['done','Выполнено и проверено'],['problem','Есть замечание / не завершено']]);
   cleaningChecks=el('section',undefined,'haccp-cleaning-checklist panel');
   cleaningChecks.append(el('h3','Чек-лист зон · отметь только действительно обработанные'));
   const checkRows=el('div',undefined,'haccp-plan-list');cleaningChecks.append(checkRows);
   const reminder=el('p','','small');cleaningChecks.append(reminder);
   const updateChecklist=()=>{
    const plan=cleaningPlan(h(),point.value),zones=type.value==='general'?plan.generalZones:plan.dailyZones;
    zone.value=type.value==='general'?'Производственные зоны · генеральная уборка':'Производственные зоны · ежедневная уборка';
    checkRows.replaceChildren();
    for(const label of zones){
     const wrapper=el('label',undefined,'haccp-plan-check'),box=el('input');
     box.type='checkbox';box.dataset.zone=label;wrapper.append(box,el('span',label));checkRows.append(wrapper);
    }
    options(agent,plan.agents.map(name=>[name,name]),true);
    agent.value='';
    reminder.textContent='Исполнитель: '+(type.value==='general'?plan.generalExecutor:plan.dailyExecutor)+
     '. Проверяет: '+plan.reviewer+'. Укажи фактически использованное средство и ФИО. Все пункты обязательны для отметки «Выполнено».';
   };
   point.addEventListener('change',updateChecklist);type.addEventListener('change',updateChecklist);
   updateChecklist();form.append(cleaningChecks);
  }
  if(tab==='receiving'){
   const supplier=inputField(grid,'Поставщик (фактический)','supplier',{required:true,maxLength:200});
   const product=inputField(grid,'Продукт / сырьё','product',{required:true,maxLength:300});
   const vendors=el('datalist');vendors.id='haccp-receiving-suppliers';
   const products=el('datalist');products.id='haccp-receiving-products';
   supplier.setAttribute('list',vendors.id);product.setAttribute('list',products.id);
   form.append(vendors,products);
   const syncReceivingLists=()=>{
    const list=receivingSettings(h(),point.value);
    vendors.replaceChildren(...list.suppliers.map(v=>{const n=el('option');n.value=v;return n}));
    products.replaceChildren(...list.products.map(v=>{const n=el('option');n.value=v;return n}));
   };
   point.addEventListener('change',syncReceivingLists);syncReceivingLists();
   inputField(grid,'Количество с единицей (например, 5 кг)','quantity',{required:true,maxLength:100});
   inputField(grid,'Номер партии / серия (по этикетке)','batch',{maxLength:100});
   inputField(grid,'Накладная / номер документа (если есть)','invoice',{maxLength:120});
   const category=selectField(grid,'Режим хранения сырья','category',RECEIVING_GROUPS,{blank:true});
   const decision=selectField(grid,'Решение по факту проверки','decision',[['accepted','Принято'],['rejected','Отказ в приёмке']]);
   const measured=inputField(grid,'Фактическая температура продукта при приёмке, °C','measured',{type:'number'});
   measured.inputMode='decimal';
   const min=inputField(grid,'Утверждённый минимум, °C (если задан)','min',{type:'number'});
   const max=inputField(grid,'Утверждённый максимум, °C (если задан)','max',{type:'number'});
   const temperatureHelp=el('p','Для охлаждённого и замороженного сырья записывай фактическую температуру. Допустимые границы бери из вашей утверждённой документации и маркировки; универсальные цифры не подставляются.','small');
   form.append(temperatureHelp);
   const updateRequired=()=>{
    const cold=['chilled','frozen'].includes(category.value);
    measured.required=cold&&decision.value==='accepted';
    temperatureHelp.textContent=cold?
     'При приёмке охлаждённых и замороженных товаров укажи фактическую температуру. При отказе замер может отсутствовать. Без утверждённых границ автоматическая оценка температуры невозможна.':
     'Для прочих товаров укажи температуру, только если она фактически измерена.';
   };
   category.onchange=updateRequired;decision.onchange=updateRequired;updateRequired();
   inputField(grid,'Годен до (как на этикетке)','expiry',{type:'date'});
   const review=el('section',undefined,'haccp-receiving-checklist panel');
   review.append(el('h3','Проверка поступившей партии'));
   const fields=el('div',undefined,'fields');
   for(const [key,label] of RECEIVING_CHECKS){
    selectField(fields,label,key,[
     ['ok',RECEIVING_CHECK_VALUES.ok],['problem',RECEIVING_CHECK_VALUES.problem],
     ['na',RECEIVING_CHECK_VALUES.na]
    ]);
   }
   review.append(fields,el('p','Отметь результат каждого пункта. При нарушении нельзя выбрать «Принято». Для отказа укажи причину в комментарии.','small'));
   form.append(review);
  }
  if(tab==='frying'){
   const owner=grid.querySelector('[name=owner]'),at=grid.querySelector('[name=at]');
   if(owner)owner.placeholder='ФИО сушиста, проводившего контроль';
   if(at)at.value=new Date(Date.now()+3*3600000).toISOString().slice(0,16);
   const fryer=selectField(grid,'Фактическая фритюрница','equipment',[],{blank:true});
   const oil=inputField(grid,'Марка масла','product',{required:true,maxLength:160});
   inputField(grid,'Партия масла (если известна)','oilBatch',{maxLength:120});
   const filled=inputField(grid,'Фактическая дата заливки масла','startedAt',{
    type:'datetime-local',required:true
   });
   const last=el('p','Укажи фактическую дату заливки, если записей ещё нет.','small');
   form.append(last);
   const checks=el('section',undefined,'haccp-frying-checklist panel');
   checks.append(el('h3','Осмотр качества масла'));
   const results=el('div',undefined,'fields');
   for(const [key,label] of OIL_CHECKS){
    selectField(results,label,key,[
     ['ok',OIL_CHECK_RESULTS.ok],
     ['problem',OIL_CHECK_RESULTS.problem],
     ['na',OIL_CHECK_RESULTS.na]
    ]);
   }
   checks.append(results,el('p','Оцени фактическое состояние. При изменении запаха, цвета, сильном вспенивании или дымлении прекрати использование или замени масло раньше трёх суток.','small'));
   form.append(checks);
   inputField(grid,'Температура масла, °C (если измерялась)','measured',{type:'number'});
   inputField(grid,'TPM, % (если измерялось)','tpm',{type:'number'});
   inputField(grid,'Предельный TPM, % по вашей утверждённой инструкции','approvedTpm',{type:'number'});
   const decision=selectField(grid,'Решение старшего смены','oilDecision',[
    ['continue','Продолжить использование'],
    ['replace','Масло полностью заменено'],
    ['stop','Прекратить использование']
   ]);
   const changed=inputField(grid,'Фактические дата и время полной замены','changedAt',{type:'datetime-local'});
   const reviewer=inputField(grid,'ФИО проверившего старшего смены','reviewer',{required:true,maxLength:120});
   form.append(el('p','График полной замены — 3 дня по вашему стандарту. Положительные результаты и замена не подставляются автоматически.','small'));
   function syncDecision(){
    changed.required=decision.value==='replace';
    changed.closest('label').hidden=decision.value!=='replace';
    if(decision.value!=='replace')changed.value='';
   }
   function updateCycle(){
    const cfg=oilSettings(h(),point.value);
    const cycle=fryer.value?oilCycleState(h(),point.value,fryer.value):null;
    if(cycle?.filledAt){
     filled.value=new Date(new Date(cycle.filledAt).getTime()+3*3600000).toISOString().slice(0,16);
     last.textContent='По последней записи масло залито '+displayDate(cycle.filledAt)+
      '; замена по графику до '+displayDate(cycle.dueAt)+
      (cycle.isDue?' · Три дня прошли, проверь необходимость замены.':'');
    }else{
     filled.value='';
     last.textContent='Дата заливки неизвестна. Укажи фактическое время, чтобы система рассчитала срок замены.';
    }
   }
   function refresh(){
    const cfg=oilSettings(h(),point.value),selected=fryer.value;
    options(fryer,cfg.fryerNames.map(v=>[v,v]),true);
    if(cfg.fryerNames.includes(selected))fryer.value=selected;
    oil.value=cfg.oil;
    reviewer.placeholder=cfg.reviewer+' · фактическое ФИО';
    if(owner)owner.placeholder=cfg.executor+' · фактическое ФИО';
    updateCycle();
   }
   fryer.addEventListener('change',updateCycle);
   point.addEventListener('change',refresh);
   decision.addEventListener('change',syncDecision);
   refresh();syncDecision();
  }
  if(tab==='storage'){
   const product=inputField(grid,'Продукт / полуфабрикат','product',{required:true,maxLength:300});
   const suggestions=el('datalist');suggestions.id='haccp-storage-products';product.setAttribute('list',suggestions.id);
   form.append(suggestions);
   const category=selectField(grid,'Тип продукта','storageType',STORAGE_GROUPS,{blank:true});
   const zone=selectField(grid,'Фактическая зона хранения','storageZone',[],{blank:true});
   const refreshStorage=()=>{
    const config=storageSettings(h(),point.value);
    const chosen=zone.value;
    options(zone,config.zones.map(z=>[z,z]),true);
    if(config.zones.includes(chosen))zone.value=chosen;
    suggestions.replaceChildren(...config.products.map(name=>{const o=el('option');o.value=name;return o}));
   };
   point.addEventListener('change',refreshStorage);
   refreshStorage();
   inputField(grid,'Номер партии / маркировки','batch',{maxLength:100});
   inputField(grid,'Фактическая дата приготовления / вскрытия','startedAt',{type:'datetime-local',required:true});
   const expiry=inputField(grid,'Использовать до (по утверждённому сроку)','useBy',{type:'datetime-local',required:true});
   inputField(form,'Утверждённые условия хранения (из ТТК / маркировки)','conditions',{type:'textarea',required:true,maxLength:500});
   const checks=el('section',undefined,'haccp-storage-checklist panel');
   checks.append(el('h3','Фактическая проверка маркировки и хранения'));
   const fields=el('div',undefined,'fields');
   for(const [key,label] of STORAGE_CHECKS){
    selectField(fields,label,key,[
     ['ok',STORAGE_RESULTS.ok],['problem',STORAGE_RESULTS.problem]
    ]);
   }
   checks.append(fields,el('p','При замечании укажи причину и принятое действие в комментарии. Положительные результаты не заполняются автоматически.','small'));
   form.append(checks);
   const dueHint=el('p','Укажи настоящий срок партии: система не назначает даты и не подтверждает соблюдение условий без проверки.','small');
   expiry.addEventListener('change',()=>{
    const at=form.querySelector('[name=at]')?.value;
    dueHint.textContent=expiry.value&&at&&Date.parse(expiry.value)<=Date.parse(at)?
     '⚠ На дату проверки указанный срок истёк. Запись будет с замечанием; укажи действие с продуктом.':
     'Срок должен подтверждаться вашей ТТК, маркировкой или инструкцией. Автоматического продления срока нет.';
   });
   form.append(dueHint);
  }
  if(tab==='hygiene'){
   const owner=grid.querySelector('[name=owner]'),time=grid.querySelector('[name=at]');
   if(owner)owner.placeholder='ФИО старшего смены, который проводил осмотр';
   if(time)time.value=new Date(Date.now()+3*3600000).toISOString().slice(0,16);
   const employee=inputField(grid,'ФИО сотрудника','employee',{required:true,maxLength:120});
   const known=el('datalist');known.id='haccp-hygiene-employees';employee.setAttribute('list',known.id);
   form.append(known);
   const role=selectField(grid,'Должность','role',[],{required:true,blank:true});
   const shift=inputField(grid,'Наименование смены (если нужно)','shift',{maxLength:60});
   shift.placeholder='Например: утренняя';
   const start=inputField(grid,'Начало смены','shiftStart',{type:'datetime-local',required:true});
   start.value='';
   const reviewer=inputField(grid,'ФИО проверяющего (старший смены)','reviewer',{required:true,maxLength:120});
   const refresh=()=>{
    const list=hygieneSettings(h(),point.value);
    const chosen=role.value;
    options(role,list.roles.map(x=>[x,x]),true);
    if(list.roles.includes(chosen))role.value=chosen;
    known.replaceChildren(...list.employees.map(name=>{const o=el('option');o.value=name;return o}));
    reviewer.placeholder=list.reviewer+' · фактическое ФИО';
   };
   point.addEventListener('change',refresh);refresh();
   const checks=el('section',undefined,'haccp-hygiene-checklist panel');
   checks.append(el('h3','Осмотр сотрудника перед началом смены'));
   const group=el('div',undefined,'fields');
   for(const [key,label] of HYGIENE_CHECKS){
    selectField(group,label,key,[
     ['ok',HYGIENE_OUTCOMES.ok],
     ['problem',HYGIENE_OUTCOMES.problem],
     ['na',HYGIENE_OUTCOMES.na]
    ]);
   }
   checks.append(group,el('p','Заполняй только фактически проверенные пункты. Не вноси сведения о диагнозах, симптомах и причинах заболеваний.','small'));
   form.append(checks);
   selectField(grid,'Решение о допуске к смене','hygieneDecision',[
    ['admit','Допущен к работе'],
    ['deny','Не допущен к работе']
   ],{blank:true});
   form.append(el('p','Для недопуска запиши только служебное действие, например «Отстранён от работы, направлен к ответственному».','small'));
  }
  if(tab==='quality'){
   const own=grid.querySelector('[name=owner]');
   if(own)own.placeholder='ФИО сушиста, который готовил и записывал проверку';
   const recordAt=grid.querySelector('[name=at]');
   if(recordAt)recordAt.value=new Date(Date.now()+3*3600000).toISOString().slice(0,16);
   const kind=selectField(grid,'Периодичность / тип контроля','qualityType',[
    ['batch','Каждая новая партия готового блюда'],
    ['daily','Ежедневная проверка перед реализацией']
   ],{blank:false});
   const product=inputField(grid,'Фактически приготовленное блюдо из ТТК','product',{required:true,maxLength:300});
   const datalist=el('datalist');datalist.id='haccp-quality-ttk-products';
   product.setAttribute('list',datalist.id);form.append(datalist);
   const reference=el('input');reference.type='hidden';reference.name='recipeId';form.append(reference);
   const category=el('input');category.type='hidden';category.name='category';form.append(category);
   const ttkInfo=el('p','Начни вводить название блюда: появятся все позиции из сохранённых ТТК.','small');
   form.append(ttkInfo);
   const updateRecipes=()=>{
    const recipes=(getState()?.recipes||[]).filter(r=>r.name?.trim());
    datalist.replaceChildren(...recipes.map(r=>{
     const opt=el('option');opt.value=r.name;opt.label=(r.category||'Без категории')+(r.status==='ready'?' · готово':' · проект ТТК');return opt;
    }));
   };
   updateRecipes();
   product.addEventListener('input',()=>{
    const match=(getState()?.recipes||[]).find(r=>r.name.trim().toLocaleLowerCase('ru-RU')===product.value.trim().toLocaleLowerCase('ru-RU'));
    reference.value=match?.id||'';category.value=match?.category||'';
    ttkInfo.textContent=match?
     'ТТК: '+(match.category||'Без категории')+' · '+(match.status==='ready'?'готово':'проект, требует проверки')+
      ' · выход '+(match.netYieldGrams??'не указан')+' г. Это не фактический вес партии и не автоматическое разрешение на продажу.':
     'Новая позиция: проверь название и фактическую рецептуру. Выбор из ТТК не обязателен.';
   });
   const batch=inputField(grid,'Номер фактической партии','batch',{maxLength:120,required:true});
   inputField(grid,'Количество готовой продукции (например, 12 шт.)','quantity',{required:true,maxLength:100});
   inputField(grid,'Время фактического приготовления','startedAt',{type:'datetime-local',required:true});
   const measured=inputField(grid,'Фактическая температура, °C (если требуется по ТТК)','measured',{type:'number'});
   measured.inputMode='decimal';
   const reviewer=inputField(grid,'ФИО проверяющего старшего смены','reviewer',{required:true,maxLength:120});
   const checks=el('section',undefined,'haccp-quality-checklist panel');
   checks.append(el('h3','Фактическая органолептическая оценка'));
   const fields=el('div',undefined,'fields');
   for(const [key,label] of QUALITY_CRITERIA){
    selectField(fields,label,key,[['ok',QUALITY_RESULTS.ok],['problem',QUALITY_RESULTS.problem],['na',QUALITY_RESULTS.na]]);
   }
   checks.append(fields,el('p','Не отмечай «соответствует» без проверки. Вкус оценивают только когда проба безопасна и предусмотрена процедурой. При любом нарушении нельзя допустить партию к реализации.','small'));
   form.append(checks);
   selectField(grid,'Решение старшего смены','decision',[
    ['accepted','Допущено к реализации'],
    ['rejected','Не допущено к реализации — требуется действие']
   ]);
   const refresh=()=>{
    batch.required=kind.value==='batch';
    reviewer.placeholder=qualityPlan(h(),point.value).reviewer+' · ФИО';
   };
   kind.addEventListener('change',refresh);point.addEventListener('change',refresh);refresh();
  }
  if(tab==='defrosting'){
   const config=thawConfig(h(),point.value);
   const ownerInput=grid.querySelector('[name=owner]');
   if(ownerInput)ownerInput.placeholder=config.executor+' — фактическое ФИО';
   const product=inputField(grid,'Продукт / партия','product',{required:true,maxLength:300});
   const products=el('datalist');products.id='haccp-thaw-products';product.setAttribute('list',products.id);form.append(products);
   inputField(grid,'Маркировка / номер партии','batch',{maxLength:120});
   inputField(grid,'Масса (например 5 кг)','quantity',{required:true,maxLength:100});
   const method=selectField(grid,'Фактический способ размораживания','method',[],{required:true,blank:true});
   const refreshThaw=()=>{
    const local=thawConfig(h(),point.value);
    options(method,local.methods.map(v=>[v,v]),true);
    products.replaceChildren(...local.products.map(v=>{const o=el('option');o.value=v;return o}));
   };
   point.addEventListener('change',refreshThaw);refreshThaw();
   const start=inputField(grid,'Дата и время начала','startedAt',{type:'datetime-local',required:true});
   const finish=inputField(grid,'Дата и время окончания (когда завершено)','finishedAt',{type:'datetime-local'});
   const measured=inputField(grid,'Фактическая температура продукта, °C (по измерению)','measured',{type:'number'});
   const chamber=inputField(grid,'Фактическая температура холодильника, °C','chamberTemperature',{type:'number'});
   inputField(grid,'Утверждённая длительность, часов (если указана в ТТК / инструкции)','approvedHours',{type:'number'});
   inputField(grid,'Источник срока: этикетка, ТТК или утверждённая инструкция','approvedSource',{maxLength:300});
   const reviewer=inputField(grid,'Проверил (ФИО старшего смены)','reviewer',{maxLength:120});
   const status=selectField(grid,'Результат процесса','result',[
    ['na','В процессе — ещё не завершено'],
    ['done','Завершено — фактические показатели проверены'],
    ['problem','Нарушение — требуется действие']
   ],{blank:false});
   status.value='na';
   form.append(el('p','Рабочий диапазон холодильника по вашим настройкам: +2…+6 °C. Сверь его с маркировкой продукта. В поле часов нельзя указывать произвольный «норматив СанПиН».','small'));
   const elapsedText=el('p','Продолжительность появится после фактического окончания.','small');
   form.append(elapsedText);
   const sync=()=>{
    const elapsed=thawElapsed(start.value,finish.value);
    elapsedText.textContent=elapsed===null?'Продолжительность появится после фактического окончания.':
     'Фактическая длительность: '+elapsed.toLocaleString('ru-RU')+' ч.';
    const done=status.value==='done';
    finish.required=done;measured.required=done;chamber.required=done;reviewer.required=done;
    const local=thawConfig(h(),point.value);
    reviewer.placeholder=local.reviewer+': имя и фамилия';
   };
   start.addEventListener('input',sync);finish.addEventListener('input',sync);
   status.addEventListener('change',sync);point.addEventListener('change',sync);sync();
  }
  if(extraJournals[tab]&&!['defrosting','quality','hygiene','frying'].includes(tab)){const spec=extraJournals[tab];form.append(el('p',spec.hint,'small'));for(const field of spec.fields)inputField(grid,field.label,field.name,{type:field.type,required:true,maxLength:1000});selectField(grid,'Результат контроля','result',[['done','Соответствует заданным условиям'],['problem','Отклонение — требуется действие'],['na','Не оценено']])}
  if(tab==='audit'){form.append(el('p','Рабочий чек-лист точки. Он не заменяет ваш утверждённый план ХАССП.','small'));for(let i=0;i<auditItems.length;i++)selectField(form,auditItems[i],'check'+i,[['yes','Да'],['no','Нет — замечание'],['na','Не применимо']])}
  inputField(form,'Комментарий / замечание','notes',{type:'textarea'});const photo=fileField(form,'Фото, при необходимости (JPEG / PNG / WebP, до 2 МБ)','image/jpeg,image/png,image/webp');
  if(tab==='hygiene')photo.closest('label').hidden=true;
  const kind=tab;submitForm(form,async raw=>{
   if(['defrosting','quality','hygiene','frying'].includes(kind)){
    // The sushi branches operate in Moscow/Murmansk time (UTC+03 year-round).
    // HTML datetime-local contains no timezone. Attach the intended offset
    // before the backend parses/stores UTC timestamps.
    for(const key of ['at','startedAt','finishedAt','shiftStart']){
     if(/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(raw[key]||'')))
      raw[key]+=':00+03:00';
    }
   }
   if(measurementDate(raw.at).slice(0,7)!==monthFilter.value)throw Error('Дата записи должна быть в выбранном месяце.');
   if(kind==='cleaning'){
    const checks=[...cleaningChecks.querySelectorAll('input[type=checkbox]')];
    const done=checks.filter(x=>x.checked).map(x=>x.dataset.zone),missed=checks.filter(x=>!x.checked).map(x=>x.dataset.zone);
    if(raw.result==='done'&&missed.length)throw Error('Чтобы подтвердить уборку, отметь все зоны. Если что-то не выполнено — выбери «Есть замечание».');
    if(!String(raw.checker||'').trim())throw Error('Введи ФИО проверяющего.');
    raw.notes=[String(raw.notes||'').trim(),'Проверил: '+raw.checker,
     'Обработанные зоны: '+(done.join('; ')||'не отмечены'),
     missed.length?'Не выполнено: '+missed.join('; '):''].filter(Boolean).join(' | ');
   }
   const data={...raw,kind,photo:await fileData(photo.files[0],2*1024*1024,true)};
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
  const sub=d.createElement('small');sub.textContent=monthLabel(monthFilter.value)+' · '+(pointFilter.value?pointName(pointFilter.value):'Все точки')+' · МСК';d.body.append(sub);
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
   for(let i=0;i<10;i++){
    const row=d.createElement('tr');
    for(const col of cols)row.append(d.createElement('td'));
    tbody.append(row);
   }
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
   mountTemperatureGrid(body,{getHaccp:h,pointId:pointFilter.value,selection:temperatureSelection,onPointChange:id=>{pointFilter.value=id;metricsRender();build()},onMonthChange:value=>{monthFilter.value=value;build()},commit,onSettings:()=>{tab='settings';build()},notify});const single=el('details',undefined,'haccp-single-record');single.append(el('summary','Отдельный замер с фотографией'));if(monthFilter.value===currentMonth)journalForm();else body.append(el('p','В архиве новые замеры не добавляются.','small'));single.append(body.lastElementChild);body.append(single);journalHistory()}else if(journalTypes[tab]){
   if(tab==='cleaning')body.append(cleaningSettingsPanel());
   if(tab==='receiving')body.append(receivingSettingsPanel());
   if(tab==='storage')body.append(storageSettingsPanel());
   if(tab==='defrosting')body.append(defrostSettingsPanel());
   if(tab==='quality')body.append(qualitySettingsPanel());
   if(tab==='frying')body.append(fryingOilSettingsPanel());
   if(tab==='hygiene'){
    body.append(hygieneSettingsPanel());
    if(monthFilter.value===currentMonth)body.append(hygienePreparedPanel());
   }
   if(monthFilter.value===currentMonth)journalForm();
   body.append(dailyDrafts());
   if(!['receiving','defrosting','hygiene','frying'].includes(tab))journalAutoDrafts();
   journalHistory();
  }else if(tab==='actions')actionsView();else if(tab==='documents')documentsView();else settingsView()}
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
 let cleaningPresetRunning=false;
 async function ensureCleaningPreset(){
  if(!getState()||cleaningPresetRunning||!cleaningPlanNeedsSeed(h()))return;
  cleaningPresetRunning=true;
  try{
   await save(state=>{
    if(seedCleaningPlan(state)){
     state.haccp.revision=(Number(state.haccp.revision)||0)+1;
     state.haccp.updatedAt=new Date().toISOString();
    }
   });
  }catch(error){console.warn('Не удалось добавить план уборки:',error)}
  finally{cleaningPresetRunning=false}
 }
 let qualityPresetRunning=false;
 async function ensureQualityPreset(){
  if(!getState()||qualityPresetRunning||!qualityPlanNeedsSeed(h()))return;
  qualityPresetRunning=true;
  try{
   await save(state=>{
    if(seedQualityDailyPlan(state)){
     state.haccp.revision=(Number(state.haccp.revision)||0)+1;
     state.haccp.updatedAt=new Date().toISOString();
    }
   });
  }catch(error){console.warn('Не удалось включить ежедневный бракераж:',error)}
  finally{qualityPresetRunning=false}
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
 function render(state){if(!state)return;const data=validateHaccp(state.haccp);queueMicrotask(()=>{void ensurePlasmaPreset().then(()=>ensureCleaningPreset()).then(()=>ensureQualityPreset()).then(()=>syncAutoDrafts())});if(loaded&&lastRevision===(data.revision||0))return;loaded=true;lastRevision=data.revision||0;const months=[...new Set([currentMonth,...data.records.map(r=>measurementDate(r.at).slice(0,7))])].sort().reverse();options(archive,months.map(m=>[m,m===currentMonth?'Текущий месяц':monthLabel(m)]));options(pointFilter,[['','Все точки'],...data.points.map(p=>[p.id,p.name])],false);metricsRender();build()}
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
