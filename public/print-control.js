// FARUKH AI — управление независимой базой FARUKH PRINT.
// Одна локальная база для страниц одного браузера/домена.
// Android APK используют отдельные WebView-хранилища: перенос JSON вручную.
const DB_KEY='farukh-print:catalog:v1',LOG_KEY='farukh-print:control-log:v1';
const MAX=1000;
const uid=()=>crypto.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
const text=v=>String(v??'').trim();
const date=v=>new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(new Date(v));
function readDatabase(){
  const raw=localStorage.getItem(DB_KEY);
  if(raw===null)return {records:[],initialized:false,broken:false};
  try{
    const parsed=JSON.parse(raw);
    if(!Array.isArray(parsed))throw Error('В хранилище находится не массив.');
    return {records:parsed.filter(p=>p&&['ready','prep'].includes(p.kind)&&typeof p.name==='string'),initialized:true,broken:false};
  }catch(e){return {records:[],initialized:false,broken:true,error:e.message}}
}
function readLog(){
 try{const a=JSON.parse(localStorage.getItem(LOG_KEY)||'[]');return Array.isArray(a)?a.slice(-100):[]}catch{return []}
}
function pushLog(action,name){
 try{
  const log=readLog();log.push({at:new Date().toISOString(),action,name:String(name||'').slice(0,100)});
  localStorage.setItem(LOG_KEY,JSON.stringify(log.slice(-100)));
 }catch{/* User can still export an in-memory copy on storage errors. */}
}
function validate(entry){
 if(!entry||!['ready','prep'].includes(entry.kind))throw Error('Неизвестный формат этикетки.');
 const name=text(entry.name),storage=text(entry.storage),hours=entry.hours;
 if(!name||name.length>90)throw Error('Название товара должно быть до 90 символов.');
 if(storage.length>60)throw Error('Условия хранения слишком длинные (до 60 символов).');
 const unverified=entry.needsReview===true;
 if(!unverified&&(!storage||!Number.isInteger(hours)||hours<1||hours>8760))throw Error('Для подтверждённого товара укажи условия и срок годности.');
 if(entry.kind==='ready'&&!unverified){
  if(!text(entry.composition)||text(entry.composition).length>600)throw Error('Нужен состав готовой продукции.');
  for(const key of ['p','f','c','kcal','weight','tolerance'])if(!Number.isFinite(entry[key])||entry[key]<0)throw Error('Проверь КБЖУ и вес: '+key);
  if(entry.weight<=0)throw Error('Вес должен быть больше нуля.');
 }
 return {...entry,name,storage,needsReview:unverified};
}
function validateBackup(content){
 if(content?.format!=='farukh-print-catalog-v1'||!Array.isArray(content.products)||content.products.length>MAX)throw Error('Неверный формат резервной копии FARUKH PRINT.');
 const used=new Set();
 return content.products.map(raw=>{
  const p=validate(raw),uniq=p.kind+'|'+p.name.toLocaleLowerCase('ru');
  if(used.has(uniq))throw Error('В файле повторяется товар «'+p.name+'».');
  used.add(uniq);return {...p,id:uid()};
 });
}
function el(tag,cls,content){const x=document.createElement(tag);if(cls)x.className=cls;if(content!==undefined)x.textContent=content;return x}
function btn(label,cls,handler){const x=el('button',cls,label);x.type='button';x.addEventListener('click',handler);return x}
const empty={name:'',kind:'prep',storage:'',hours:null,composition:'',p:'',f:'',c:'',kcal:'',weight:'',tolerance:10,point:'',needsReview:true};
export function mountPrintControl({root}){
 if(!root)throw Error('Контейнер центра FARUKH PRINT не найден.');
 let group='prep',query='',records=[],warn='',log=[],currentEdit=null,lastAction='',loaded=false,form;
 const head=el('div','pc-hero');
 const headInfo=el('div');
 headInfo.append(el('span','pc-kicker','ПОДКЛЮЧЕННЫЙ ИНСТРУМЕНТ · FARUKH PRINT'),el('h1','','Управляющий центр'),el('p','','Каталог двух форматов, контроль готовности этикеток и перенос базы на телефон или планшет.'));
 const pill=el('span','pc-badge','База этого устройства');
 head.append(headInfo,pill);
 const notice=el('p','pc-alert');notice.hidden=true;
 const cardGrid=el('div','pc-stats');
 const statReady=el('div','pc-stat'),statPrep=el('div','pc-stat'),statReview=el('div','pc-stat'),statApproved=el('div','pc-stat');
 for(const [card,title] of [[statReady,'58 × 40 · готовая'],[statPrep,'31 × 20 · полуфабрикаты'],[statReview,'Требуют проверки'],[statApproved,'Готовы к печати']]){card.append(el('small','',title),el('strong','','0'));cardGrid.append(card)}
 const toolbar=el('div','pc-toolbar');
 const left=el('div','pc-tabs');
 const readyTab=btn('58 × 40','pc-tab',()=>{group='ready';query='';search.value='';render()});
 const prepTab=btn('31 × 20','pc-tab',()=>{group='prep';query='';search.value='';render()});
 left.append(readyTab,prepTab);
 const right=el('div','pc-toolbar-actions');
 const add=btn('＋ Добавить этикетку','pc-primary',()=>edit(null));
 const open=el('a','pc-secondary','Открыть FARUKH PRINT ↗');open.href='/farukh-print/';open.target='_blank';open.rel='noopener noreferrer';
 right.append(add,open);toolbar.append(left,right);
 const search=el('input','pc-search');search.type='search';search.placeholder='Поиск по названию';search.setAttribute('aria-label','Поиск по названию');search.addEventListener('input',()=>{query=search.value.toLocaleLowerCase('ru').trim();renderRows()});
 const table=el('div','pc-list');
 const sub=el('div','pc-transfer');
 const transferHead=el('div');transferHead.append(el('h2','','Перенос базы'),el('p','','На одном браузере FARUKH AI и FARUKH PRINT видят общую базу. Android-приложения имеют отдельные хранилища: после изменений скачай копию и загрузи её в FARUKH PRINT на нужном устройстве.'));
 const transferActions=el('div','pc-transfer-buttons');
 const download=btn('↓ Скачать базу JSON','pc-primary',exportBackup);
 const importButton=btn('↑ Загрузить базу JSON','pc-secondary',()=>fileInput.click());
 const fileInput=el('input');fileInput.type='file';fileInput.accept='.json,application/json';fileInput.hidden=true;fileInput.addEventListener('change',importBackup);
 const openManager=el('a','pc-secondary','Управление в FARUKH PRINT ↗');openManager.href='/farukh-print/?manage=prep';openManager.target='_blank';openManager.rel='noopener noreferrer';
 transferActions.append(download,importButton,openManager,fileInput);sub.append(transferHead,transferActions);
 const integration=el('div','pc-integration');
 integration.append(el('h2','','Что уже подключено'),el('p','','Состав и сроки этикеток, быстрый поиск, просмотр готовности, выгрузка и загрузка одной базы для FARUKH PRINT. ТТК из основного FARUKH AI автоматически не подмешиваются.'));
 const roadmap=el('p','pc-roadmap','Пока не подключены: удалённая автоматическая синхронизация между Android-приложениями, персональные логины, журнал входов и удалённая блокировка сотрудников. Для этого понадобится отдельный серверный доступ и защищённое постоянное хранилище.');
 integration.append(roadmap);
 const logSection=el('details','pc-log');const summary=el('summary','','История изменений на этом устройстве');logSection.append(summary);const logBox=el('div','pc-log-body');logSection.append(logBox);
 root.append(head,notice,cardGrid,toolbar,search,table,sub,integration,logSection);
 // The editor lives in the same root; controls are never inserted from user HTML.
 const dialog=el('dialog','pc-dialog');
 const content=el('form','pc-form');content.noValidate=true;
 const formTitle=el('h2','','Редактирование этикетки');
 const fields={};
 function field(name,label,type='text',opts={}){
  const holder=el('label','pc-field'),title=el('span','',label);
  const input=el(type==='textarea'?'textarea':'input');
  if(type!=='textarea')input.type=type;
  input.dataset.key=name;input.id='pc-field-'+name;
  if(opts.placeholder)input.placeholder=opts.placeholder;
  if(opts.step)input.step=opts.step;
  if(opts.min!==undefined)input.min=opts.min;
  if(opts.max!==undefined)input.max=opts.max;
  if(opts.maxlength)input.maxLength=opts.maxlength;
  fields[name]=input;holder.append(title,input);return holder;
 }
 const formHeading=el('div','pc-form-title');
 formHeading.append(formTitle,btn('✕','pc-close',()=>dialog.close()));
 content.append(formHeading,field('name','Название','text',{maxlength:90}));
 const readyFields=el('div','pc-ready-fields');
 readyFields.append(field('composition','Состав','textarea',{maxlength:600}));
 const nutr=el('div','pc-form-four');
 for(const [key,label] of [['p','Белки /100 г'],['f','Жиры /100 г'],['c','Углеводы /100 г'],['kcal','Ккал /100 г']])nutr.append(field(key,label,'number',{min:0,step:'.01'}));
 readyFields.append(nutr);
 const weights=el('div','pc-form-two');
 weights.append(field('weight','Вес, г','number',{min:1,step:'1'}),field('tolerance','Допуск ±, г','number',{min:0,step:'1'}));
 readyFields.append(weights);content.append(readyFields);
 const prepFields=el('div');
 prepFields.append(field('point','Точка по умолчанию','text',{maxlength:40}));
 content.append(prepFields);
 const bottom=el('div','pc-form-two');
 bottom.append(field('storage','Условия хранения','text',{maxlength:60}),field('hours','Срок годности, часы','number',{min:1,max:8760,step:'1'}));
 content.append(bottom);
 const checkbox=el('label','pc-approval');
 const verify=document.createElement('input');verify.type='checkbox';checkbox.append(verify,el('span','','Подтверждаю, что срок и режим установлены по ТТК или маркировке изготовителя. Без подтверждения печать на FARUKH PRINT останется заблокированной.'));
 content.append(checkbox);
 const actions=el('div','pc-form-actions');actions.append(btn('Отмена','pc-secondary',()=>dialog.close()));
 const save=el('button','pc-primary','Сохранить');save.type='submit';actions.append(save);
 const formError=el('p','pc-error');formError.hidden=true;
 content.append(formError,actions);content.addEventListener('submit',event=>{event.preventDefault();saveEditor()});
 dialog.append(content);root.append(dialog);
 function message(value,isError=false){warn=value;notice.hidden=!value;notice.textContent=value;notice.classList.toggle('error',isError)}
 function reload(){
  const data=readDatabase();
  records=data.records;log=readLog();loaded=true;
  if(data.broken)message('Локальная база повреждена. НЕ сохраняй новые этикетки до восстановления резервной копии: '+data.error,true);
  else if(!data.initialized)message('База FARUKH PRINT на этом устройстве пока пустая. Она может находиться в отдельном Android-приложении — перенеси её через файл JSON.');
  else message('');
  for(const [node,count] of [[statReady,records.filter(p=>p.kind==='ready').length],[statPrep,records.filter(p=>p.kind==='prep').length],[statReview,records.filter(p=>p.needsReview===true).length],[statApproved,records.filter(p=>p.needsReview!==true).length]])node.querySelector('strong').textContent=count;
 }
 function renderRows(){
  table.replaceChildren();
  const selected=records.filter(p=>p.kind===group&&p.name.toLocaleLowerCase('ru').includes(query)).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  if(!selected.length){table.append(el('p','pc-empty',query?'Ничего не найдено.':'В этой категории нет этикеток на данном устройстве.'));return}
  for(const p of selected){
   const row=el('div','pc-row');
   const desc=el('div','pc-item');
   desc.append(el('strong','',p.name));
   const details=el('small','',p.needsReview===true?'Срок не подтверждён · печать заблокирована':(p.hours? p.hours+' ч · '+(p.storage||'нет условий хранения'):'Проверь условия и срок'));
   desc.append(details);
   const controls=el('div','pc-row-controls');
   controls.append(el('span','pc-tag '+(p.needsReview===true?'pc-wait':'pc-ok'),p.needsReview===true?'На проверке':'Подтверждено'));
   controls.append(btn('Изменить','pc-edit',()=>edit(p)));
   controls.append(btn('×','pc-remove',()=>remove(p)));
   row.append(desc,controls);table.append(row);
  }
 }
 function renderLog(){
  logBox.replaceChildren();
  const history=log.slice().reverse().slice(0,18);
  if(!history.length){logBox.append(el('p','','Пока изменений из этого центра не было. Печать и входы сотрудников здесь не отслеживаются.'));return}
  for(const row of history){
   const item=el('div','pc-log-item');
   const at=new Date(row.at);item.append(el('time','',Number.isFinite(at.getTime())?date(row.at):'—'),el('span','',row.action+' · '+row.name));
   logBox.append(item);
  }
 }
 function render(){
  reload();readyTab.classList.toggle('active',group==='ready');prepTab.classList.toggle('active',group==='prep');renderRows();renderLog();
 }
 function commit(next,action,name){
  if(next.length>MAX)throw Error('Лимит '+MAX+' этикеток.');
  // All edits and imports are persisted atomically through a single write.
  // Never overwrite a damaged database.
  if(readDatabase().broken)throw Error('Текущая база повреждена. Сначала восстанови резервную копию.');
  localStorage.setItem(DB_KEY,JSON.stringify(next));
  pushLog(action,name);lastAction=action+' · '+name;render();message('Сохранено на этом устройстве: '+lastAction+'. Для другого Android-приложения скачай копию JSON.');
 }
 function edit(product){
  currentEdit=product?.id||null;const v=product||{...empty,kind:group};
  formTitle.textContent=(product?'Изменить':'Добавить')+' · '+(v.kind==='ready'?'58 × 40 мм':'31 × 20 мм');
  readyFields.hidden=v.kind!=='ready';prepFields.hidden=v.kind!=='prep';
  const values={...empty,...v};
  for(const [key,input] of Object.entries(fields))input.value=values[key]??'';
  verify.checked=product?product.needsReview!==true:false;
  formError.hidden=true;
  dialog.showModal();
 }
 function saveEditor(){
  const existing=currentEdit?records.find(p=>p.id===currentEdit):null,kind=existing?.kind||group;
  const name=text(fields.name.value);
  const hoursValue=text(fields.hours.value);
  const p={...existing,id:existing?.id||uid(),name,kind,storage:text(fields.storage.value),hours:hoursValue?Number(hoursValue):null,needsReview:!verify.checked};
  if(kind==='prep')p.point=text(fields.point.value);
  else{
   p.composition=text(fields.composition.value);
   for(const key of ['p','f','c','kcal','weight','tolerance']){
    const x=text(fields[key].value);p[key]=x?Number(x):null;
   }
  }
  try{
   const validated=validate(p);
   if(records.some(r=>r.id!==p.id&&r.kind===p.kind&&r.name.toLocaleLowerCase('ru')===p.name.toLocaleLowerCase('ru')))throw Error('Этикетка с таким именем уже есть.');
   const next=records.filter(r=>r.id!==p.id);next.push(validated);
   commit(next,existing?'Изменено':'Добавлено',p.name);dialog.close();
  }catch(e){formError.textContent=e.message;formError.hidden=false}
 }
 function remove(p){
  if(!confirm('Удалить этикетку «'+p.name+'»? Отменить удаление можно только через резервную копию.'))return;
  try{commit(records.filter(x=>x.id!==p.id),'Удалено',p.name)}catch(e){message(e.message,true)}
 }
 function exportBackup(){
  try{
   const state=readDatabase();
   if(state.broken)throw Error('База повреждена. Экспорт не выполнен.');
   const backup={format:'farukh-print-catalog-v1',createdAt:new Date().toISOString(),products:state.records};
   const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob);
   const a=el('a');a.href=url;a.download='farukh-print-backup-'+new Date().toISOString().slice(0,10)+'.json';
   document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),8000);
   pushLog('Экспорт резервной копии',state.records.length+' поз.');renderLog();
   message('База выгружена. Передай JSON на Android-устройство и импортируй в FARUKH PRINT → Управление этикетками.');
  }catch(e){message(e.message,true)}
 }
 async function importBackup(){
  const file=fileInput.files?.[0];fileInput.value='';if(!file)return;
  try{
   if(file.size>2*1024*1024)throw Error('Размер копии превышает 2 МБ.');
   const parsed=validateBackup(JSON.parse(await file.text()));
   if(!confirm('Заменить всю локальную базу ('+records.length+' шт.) данными из файла ('+parsed.length+' шт.)? Перед заменой рекомендуется скачать резервную копию.'))return;
   // Allow recovery from corrupted data ONLY through validated import.
   localStorage.setItem(DB_KEY,JSON.stringify(parsed));pushLog('Импорт резервной копии',parsed.length+' поз.');render();message('Загружено '+parsed.length+' этикеток. Проверь карточки и сроки.');
  }catch(e){message('Не удалось загрузить базу: '+e.message,true)}
 }
 window.addEventListener('storage',event=>{if([DB_KEY,LOG_KEY].includes(event.key))render()});
 return {render,kind:()=>group,count:()=>records.length};
}
