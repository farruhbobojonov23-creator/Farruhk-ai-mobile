import {getTemplate as getHaccpTemplate} from './farukh-print/haccp-catalog.js?v=2';
import './farukh-print/categories.js?v=2';
import {guidanceForProduct,REFERENCES} from './farukh-print/shelf-life-guidance.js?v=2';
import {storageAdviceFor,PRACTICE_REFERENCES} from './farukh-print/storage-advice.js?v=1';
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
 if(entry?.template){const t=getHaccpTemplate(entry);if(!t)throw Error('Неизвестный шаблон ХАССП');return {...t,id:entry.id||t.id};}
 if(!entry||!['ready','prep'].includes(entry.kind))throw Error('Неизвестный формат этикетки.');
 const name=text(entry.name),storage=text(entry.storage),hours=entry.hours;
 if(!name||name.length>90)throw Error('Название товара должно быть до 90 символов.');
 if(storage.length>60)throw Error('Условия хранения слишком длинные (до 60 символов).');
 const unverified=entry.needsReview===true;
 const photo=entry.photo||'';
 if(photo&&(!window.FarukhPrintPhotos?.isPhoto(photo)))throw Error('Фото должно быть JPG или прозрачным WEBP не более 45 КБ. Выбери его повторно.');
 if(!unverified&&(!storage||!Number.isInteger(hours)||hours<1||hours>8760))throw Error('Для подтверждённого товара укажи условия и срок годности.');
 if(entry.kind==='ready'){
  if(!text(entry.composition)||text(entry.composition).length>600)throw Error('Нужен состав готовой продукции.');
  for(const key of ['p','f','c','kcal','weight','tolerance'])if(!Number.isFinite(entry[key])||entry[key]<0)throw Error('Проверь КБЖУ и вес: '+key);
  if(entry.weight<=0)throw Error('Количество нетто должно быть больше нуля.');
  if(entry.weightUnit!==undefined&&!['г','кг','мл','л','шт'].includes(entry.weightUnit))throw Error('Неизвестная единица нетто.');
 }
 return {...entry,name,storage,needsReview:unverified,photo};
}
function validateBackup(content){
 if(content?.format!=='farukh-print-catalog-v1'||!Array.isArray(content.products)||content.products.length>MAX)throw Error('Неверный формат резервной копии FARUKH PRINT.');
 const used=new Set();
 return content.products.map(raw=>{
  const p=validate(raw),uniq=p.kind+'|'+p.name.toLocaleLowerCase('ru');
  if(used.has(uniq))throw Error('В файле повторяется товар «'+p.name+'».');
  used.add(uniq);return {...p,id:p.template?p.id:uid()};
 });
}
function el(tag,cls,content){const x=document.createElement(tag);if(cls)x.className=cls;if(content!==undefined)x.textContent=content;return x}
function btn(label,cls,handler){const x=el('button',cls,label);x.type='button';x.addEventListener('click',handler);return x}
const empty={name:'',kind:'prep',storage:'',hours:null,composition:'',p:'',f:'',c:'',kcal:'',weight:'',tolerance:10,point:'',needsReview:true};
export function mountPrintControl({root}){
 if(!root)throw Error('Контейнер центра FARUKH PRINT не найден.');
 let group='prep',query='',records=[],warn='',log=[],currentEdit=null,lastAction='',loaded=false,form,manualTemplate=false;
 let category='all',page=1,onlyPending=false;const PAGE_SIZE=8;
 const cloudPhotos=new Map();let supplementalPhotos=null,brothPhoto='',readyPhotos=null,prepLoading=null,readyLoading=null;
 const photoKey=p=>p.kind+'|'+text(p.name).toLocaleLowerCase('ru').replace(/ё/g,'е');
 let photoLibraryLoading=null;
 // Atlas onload finishes after import(): re-render when thumbnails are ready.
 window.addEventListener('farukh-studio-ready',()=>{
  if(group==='prep'){renderRows();if(dialog?.open)showPhoto();}
 });
 function displayPhoto(p){
  // isPhoto('') is deliberately true for optional form fields, but an empty
  // string is not an actual image. Do not stop before cloud/static fallbacks.
  if(p.photo&&window.FarukhPrintPhotos?.isPhoto(p.photo))return p.photo;
  const remote=cloudPhotos.get(p.id)||cloudPhotos.get(photoKey(p));
  if(remote&&window.FarukhPrintPhotos?.isPhoto(remote))return remote;
  if(p.kind==='prep'&&text(p.name)==='Бульон Том Ям'&&brothPhoto)return brothPhoto;
  const supplement=supplementalPhotos?.photoFor(p);if(supplement)return supplement;
  if(p.kind==='ready'&&readyPhotos){const withPhoto=readyPhotos.merge([p])[0];if(withPhoto.photo)return withPhoto.photo}
  // Built-in licensed representative photo, not a saved owner upload.
  return p.kind==='prep'?window.FarukhPrepPhotoLibrary?.find(p)?.url||'':'';
 }
 function loadPhotoAssets(){
  if(group==='prep'&&!photoLibraryLoading){
   photoLibraryLoading=Promise.all([
    import('./farukh-print/prep-studio-images.js?v=1').then(()=>import('./farukh-print/prep-studio-atlas.js?v=2')).then(()=>import('./farukh-print/prep-photo-library.js?v=2')), 
    import('./farukh-print/prep-sanpin-sources.js?v=1')
   ]).then(()=>{renderRows();if(dialog?.open)showPhoto()}).catch(()=>{});
  }
  if(group==='prep'&&!prepLoading){prepLoading=Promise.all([import('./farukh-print/supplemental-photos.js?v=2'),import('./farukh-print/broth-photo.js?v=2')]).then(([supplement,broth])=>{supplementalPhotos=supplement;brothPhoto=broth.photo;renderRows()}).catch(()=>{});}
  if(group==='ready'&&!readyLoading){readyLoading=import('./farukh-print/catalog-photos.js?v=2').then(m=>{readyPhotos=m;renderRows()}).catch(()=>{});}
 }
 function categoryFor(p){
  if(p.kind==='prep'&&text(p.category))return text(p.category);
  if(p.kind==='ready')return window.FarukhPrintCategories?.category(p)||'Без категории';
  if(p.template)return 'ХАССП';const n=text(p.name).toLocaleLowerCase('ru');
  if(/соус|унаги|терияки|чили|спайси|майонез/.test(n))return 'Соусы';
  if(/кревет|краб|форел|угор|рыб|лосос|тунец/.test(n))return 'Рыба и морепродукты';
  if(/куриц|мясо|говяд/.test(n))return 'Мясо и птица';
  if(/огур|капуст|перец|морков|такуан|овощ/.test(n))return 'Овощи';
  return 'Прочие заготовки';
 }
 function categoryItems(){return [...new Set(records.filter(p=>p.kind===group).map(categoryFor))].sort((a,b)=>a.localeCompare(b,'ru'))}

 const head=el('div','pc-hero');
 const headInfo=el('div');
 headInfo.append(el('span','pc-kicker','ПОДКЛЮЧЕННЫЙ ИНСТРУМЕНТ · FARUKH PRINT'),el('h1','','Управляющий центр'),el('p','','Каталог двух форматов, контроль готовности этикеток и перенос базы на телефон или планшет.'));
 const pill=el('span','pc-badge','База этого устройства');
 head.append(headInfo,pill);
 const notice=el('p','pc-alert');notice.hidden=true;
 const workspaceNav=el('nav','pc-workspace-tabs');workspaceNav.setAttribute('aria-label','Разделы управления печатью');
 root.dataset.pcWorkspace='catalog';
 for(const [view,label] of [['catalog','Товары'],['staff','Сотрудники'],['cloud','Облако'],['backup','Копии и настройки']]){
  const item=btn(label,'pc-workspace-tab'+(view==='catalog'?' active':''),()=>{
   root.dataset.pcWorkspace=view;
   for(const b of workspaceNav.children){const active=b.dataset.workspace===view;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false')}
  });item.dataset.workspace=view;item.setAttribute('aria-current',view==='catalog'?'page':'false');workspaceNav.append(item);
 }
 const cardGrid=el('div','pc-stats');
 const statReady=el('div','pc-stat'),statPrep=el('div','pc-stat'),statReview=el('div','pc-stat'),statApproved=el('div','pc-stat');
 for(const [card,title] of [[statReady,'58 × 40 · готовая'],[statPrep,'30 × 20 · полуфабрикаты'],[statReview,'Требуют проверки'],[statApproved,'Готовы к печати']]){card.append(el('small','',title),el('strong','','0'));cardGrid.append(card)}
 const readiness=el('div','pc-readiness');const readinessLabel=el('strong','','Готовность каталога');const readinessCount=el('span','','0%');const readinessTrack=el('div','pc-readiness-track');const readinessFill=el('div','pc-readiness-fill');readinessTrack.append(readinessFill);readiness.append(readinessLabel,readinessCount,readinessTrack);
 const toolbar=el('div','pc-toolbar');
 const left=el('div','pc-tabs');
 const readyTab=btn('58 × 40','pc-tab',()=>{group='ready';query='';category='all';onlyPending=false;page=1;search.value='';render()});
 const prepTab=btn('30 × 20','pc-tab',()=>{group='prep';query='';category='all';onlyPending=false;page=1;search.value='';render()});
 left.append(readyTab,prepTab);
 const right=el('div','pc-toolbar-actions');
 const pending=btn('Сроки: проверить','pc-secondary pc-pending',()=>{
  if(group!=='prep'){group='prep';query='';search.value='';category='all';}
  onlyPending=!onlyPending;page=1;render();
 });
 const add=btn('＋ Добавить этикетку','pc-primary',()=>edit(null));
 const seed=btn('＋ 36 заготовок японской кухни','pc-secondary',importStarter);
 const open=el('a','pc-secondary','Открыть FARUKH PRINT ↗');open.href='/farukh-print/';open.target='_blank';open.rel='noopener noreferrer';
 right.append(pending,add,seed,open);toolbar.append(left,right);
 const templateCard=el('section','pc-premium-template');
 const templateIntro=el('div','pc-premium-template-text');
 templateIntro.append(el('span','pc-premium-template-badge','УТВЕРЖДЁННЫЙ ЭТАЛОН · 58 × 40 ММ'),el('h2','','Премиальная этикетка'),el('p','','Сохранённый чёрно-белый шаблон: рамки, состав, таблица КБЖУ, даты и иконки. Создай новую позицию вручную — эталон применится автоматически.'));
 const templateButton=btn('＋ Заполнить вручную','pc-primary pc-premium-template-button',()=>{group='ready';query='';category='all';onlyPending=false;page=1;search.value='';render();edit(null,true)});
 templateCard.append(templateIntro,templateButton);
 const prepCard=el('section','pc-premium-template pc-prep-template');
 const prepIntro=el('div','pc-premium-template-text');
 prepIntro.append(el('span','pc-premium-template-badge','УТВЕРЖДЁННЫЙ ЭТАЛОН · 30 × 20 ММ'),
  el('h2','','Премиальная этикетка полуфабриката'),
  el('p','','Строго выбранный третий вариант: двойная рамка, название, изготовлено/разморожено, годен до, температура и срок. Без состава.'));
 const prepButton=btn('＋ Заполнить вручную','pc-primary pc-premium-template-button',()=>{group='prep';query='';category='all';onlyPending=false;page=1;search.value='';render();edit(null,'prep')});
 prepCard.append(prepIntro,prepButton);
 const search=el('input','pc-search');search.type='search';search.placeholder='Поиск по названию';search.setAttribute('aria-label','Поиск по названию');search.addEventListener('input',()=>{query=search.value.toLocaleLowerCase('ru').trim();page=1;renderRows()});
 const categorySelect=el('select','pc-search pc-category-filter');categorySelect.setAttribute('aria-label','Фильтр по категории');categorySelect.addEventListener('change',()=>{category=categorySelect.value;page=1;renderRows()});
 const filters=el('div','pc-filters');filters.append(search,categorySelect);
 const normativeNotice=el('div','pc-normative-notice');
 normativeNotice.append(el('strong','','Нормативная справка для всех товаров'),
  el('span','','Нажми «Нормы» у любой позиции. Для полуфабрикатов возможен черновой внутренний ориентир 12 ч при +2…+6 °C — это НЕ единый срок по СанПиН. Пока фактический срок не подтверждён по ТТК/изготовителю, печать запрещена.'));
 const guideLink=el('a','','Действующий СанПиН 2.3/2.4.4282-26 ↗');
 guideLink.href=REFERENCES[0].url;guideLink.target='_blank';guideLink.rel='noopener noreferrer';normativeNotice.append(guideLink);
 const table=el('div','pc-list');
 const pagination=el('div','pc-pagination');const paginationText=el('span','','');const prev=btn('← Назад','pc-pager',()=>{if(page>1){page--;renderRows()}});const next=btn('Далее →','pc-pager',()=>{page++;renderRows()});pagination.append(paginationText,prev,next);
 const sub=el('div','pc-transfer');
 const transferHead=el('div');transferHead.append(el('h2','','Перенос базы'),el('p','','Главный каталог хранится в облаке FARUKH AI и обновляется на подключённых телефонах и планшетах. Если на старом устройстве остались отдельные позиции, скачай там копию и добавь её через «Объединить старую базу» ниже.'));
 const transferActions=el('div','pc-transfer-buttons');
 const download=btn('↓ Скачать базу JSON','pc-primary',exportBackup);
 const importButton=btn('↑ Загрузить базу JSON','pc-secondary',()=>fileInput.click());
 const legacyButton=btn('⇄ Объединить старую базу телефона / планшета','pc-secondary',()=>legacyFileInput.click());
 const legacyFileInput=el('input');legacyFileInput.type='file';legacyFileInput.accept='.json,application/json';legacyFileInput.hidden=true;legacyFileInput.addEventListener('change',importLegacyFromDevice);
 const fileInput=el('input');fileInput.type='file';fileInput.accept='.json,application/json';fileInput.hidden=true;fileInput.addEventListener('change',importBackup);
 const openManager=el('a','pc-secondary','Управление в FARUKH PRINT ↗');openManager.href='/farukh-print/?manage=prep';openManager.target='_blank';openManager.rel='noopener noreferrer';
 transferActions.append(download,importButton,legacyButton,openManager,fileInput,legacyFileInput);sub.append(transferHead,transferActions);
 const integration=el('div','pc-integration');
 integration.append(el('h2','','Что уже подключено'),el('p','','Состав и сроки этикеток, быстрый поиск, просмотр готовности, выгрузка и загрузка одной базы для FARUKH PRINT. ТТК из основного FARUKH AI автоматически не подмешиваются.'));
 const roadmap=el('p','pc-roadmap','Общая база, привязка устройств, логины сотрудников и журнал доступа работают через защищённое облако. Перед печатью на новом устройстве подключи его по коду владельца и войди в аккаунт сотрудника.');
 integration.append(roadmap);
 const logSection=el('details','pc-log');const summary=el('summary','','История изменений на этом устройстве');logSection.append(summary);const logBox=el('div','pc-log-body');logSection.append(logBox);
 root.append(head,notice,workspaceNav,cardGrid,readiness,toolbar,templateCard,prepCard,filters,normativeNotice,table,pagination,sub,integration,logSection);
 // The editor lives in the same root; controls are never inserted from user HTML.
 const guideDialog=el('dialog','pc-dialog pc-guide-dialog');
 const guideBody=el('div','pc-guide-body');guideDialog.append(guideBody);root.append(guideDialog);
 function showGuidance(p){
  const item={...p,...(p.kind==='ready'&&!p.template?{category:categoryFor(p)}:{})};
  const g=guidanceForProduct(item),tips=storageAdviceFor(item);
  guideBody.replaceChildren();
  guideBody.append(el('h2','',p.template?'Нормы и советы · '+p.name:'Практические советы · '+p.name));
  const currentStatus=p.template?'Служебная этикетка ХАССП: сроки пищевых продуктов к ней не применяются.'
   :(p.needsReview===true||!p.hours||!p.storage)
    ?'Срок или условия хранения не подтверждены — печать должна оставаться заблокированной.'
    :'В каталоге: '+p.hours+' ч · '+p.storage+'. Эти параметры не изменены.';
  guideBody.append(el('p','pc-guide-current',currentStatus));
  guideBody.append(el('p','pc-advice-intro','Главное — практические действия на кухне. Температура и сроки из справки не заменяют маркировку производителя, ТТК и требования ХАССП.'));
  const adviceSection=el('section','pc-advice-section');
  adviceSection.append(el('h3','','Как правильно хранить и контролировать'));
  const grid=el('div','pc-advice-grid');
  for(const [title,body] of [
   ['Температура хранения',tips.temperature],
   ['В каком виде лучше хранить',tips.form],
   ['Тара и маркировка',tips.packaging],
   ['Как распознать возможную порчу',tips.spoilage],
   ['Контроль на смене',tips.control],
   ['Типичные ошибки',tips.avoid]
  ]){
   const card=el('article','pc-advice-card');
   card.append(el('h4','',title),el('p','',body));
   grid.append(card);
  }
  adviceSection.append(grid);
  guideBody.append(adviceSection);
  const safety=el('p','pc-advice-safety',p.template?'Не используйте бытовые продукты или пищевой инвентарь для работы с химическими растворами.':
   'Важно: по запаху, цвету и вкусу невозможно надёжно определить безопасность пищи. Не пробуйте сомнительные продукты; при нарушении срока или температуры применяйте процедуру списания.');
  guideBody.append(safety);
  const normDetails=el('details','pc-guide-norm-details');
  normDetails.append(el('summary','','Нормативная справка и источники'));
  if(p.kind==='prep'){
   const sr=window.FarukhPrepShelfReference?.get(p.name);
   if(sr){
    const box=el('section','pc-guide-example');
    box.append(el('strong','','Срок по санитарным таблицам: '+sr.category));
    if(sr.clause)box.append(el('p','',sr.clause+(sr.hours?' · '+sr.hours+' ч при '+sr.temp:'')));
    box.append(el('p','',sr.warning));
    if(sr.kind==='analogy')box.append(el('p','','Это СРАВНИМАЯ категория, не норма автоматически для данного продукта.'));
    normDetails.append(box);
   }
  }
  const normContent=el('div','pc-guide-norm-content');
  normContent.append(el('h3','',g.group),el('p','',g.question),el('div','pc-guide-example',g.example));
  normContent.append(el('p','pc-guide-warning',p.template?
   'Для служебной этикетки применяйте инструкции по используемому средству и внутренние процедуры ХАССП.' :
   'Примеры не вносятся в этикетку автоматически и не означают утверждённый срок для конкретной рецептуры.'));
  normContent.append(el('strong','','Документы и материалы'));
  const links=p.template?[REFERENCES[0],PRACTICE_REFERENCES[1]]:[...REFERENCES,...PRACTICE_REFERENCES];
  for(const ref of links){
   const link=el('a','pc-guide-link',ref.name+' ↗');
   link.href=ref.url;link.rel='noopener noreferrer';link.target='_blank';normContent.append(link);
  }
  normDetails.append(normContent);guideBody.append(normDetails);
  const photoCredit=p.kind==='prep'?window.FarukhPrepPhotoLibrary?.find(p):null;
  if(photoCredit&&displayPhoto(p)===photoCredit.url){
   if(photoCredit.creditUrl){const credit=el('a','pc-guide-link','Фото: '+photoCredit.author+' · '+photoCredit.license+' · Wikimedia Commons ↗');credit.href=photoCredit.creditUrl;credit.target='_blank';credit.rel='noopener noreferrer';guideBody.append(credit)}
   else guideBody.append(el('small','','Студийный образец: FARUKH PRINT'));
  }
  const actions=el('div','pc-form-actions');
  actions.append(btn('Закрыть','pc-secondary',()=>guideDialog.close()));
  if(!p.template)actions.append(btn('Редактировать срок и условия','pc-primary',()=>{guideDialog.close();edit(p)}));
  guideBody.append(actions);
  if(typeof guideDialog.showModal==='function')guideDialog.showModal();else guideDialog.setAttribute('open','');
 }
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
 let chosenPhoto='',photoChanged=false;
 const photoPanel=el('section','pc-photo-field');
 const photoPreview=el('img','pc-photo-preview');
 photoPreview.alt='Фото товара';photoPreview.hidden=true;
 const photoEmpty=el('div','pc-photo-empty','◇');const photoCaption=el('div','pc-photo-controls');
 photoCaption.append(el('strong','','Фото для каталога'),el('small','','Можно выбрать или заменить самостоятельно. На чёрно-белых этикетках фото не печатается.'));
 const photoPick=btn('＋ Загрузить фото','pc-secondary',()=>photoFile.click());
 const photoRemove=btn('Убрать фото','pc-secondary',()=>{chosenPhoto='';photoChanged=true;showPhoto()});
 const photoFile=el('input');photoFile.type='file';photoFile.accept='image/jpeg,image/png,image/webp';photoFile.hidden=true;
 function showPhoto(){
  const entry=currentEdit?records.find(p=>p.id===currentEdit):null;
  const preview=chosenPhoto||(entry?displayPhoto(entry):'');
  photoPreview.hidden=!preview;photoEmpty.hidden=!!preview;photoRemove.disabled=!chosenPhoto;
  if(preview){photoPreview.src=preview;photoPreview.onerror=()=>{
   photoPreview.hidden=true;photoEmpty.hidden=false;photoPreview.removeAttribute('src');
  };}else photoPreview.removeAttribute('src');
 }
 photoFile.addEventListener('change',async()=>{
  const file=photoFile.files?.[0];photoFile.value='';if(!file)return;
  photoPick.disabled=true;
  try{chosenPhoto=await window.FarukhPrintPhotos.compress(file);photoChanged=true;showPhoto();formError.hidden=true}
  catch(e){formError.textContent='Не удалось загрузить фото: '+e.message;formError.hidden=false}
  finally{photoPick.disabled=false}
 });
 photoCaption.append(photoPick,photoRemove,photoFile);
 photoPanel.append(photoPreview,photoEmpty,photoCaption);
 const formHeading=el('div','pc-form-title');
 formHeading.append(formTitle,btn('✕','pc-close',()=>dialog.close()));
 content.append(formHeading,field('name','Название','text',{maxlength:90}),photoPanel);
 const readyFields=el('div','pc-ready-fields');
 readyFields.append(field('category','Категория','text',{maxlength:60,placeholder:'Выберите или введите свою'}));
 const categoryOptions=el('datalist');categoryOptions.id='pc-category-options';fields.category.setAttribute('list',categoryOptions.id);readyFields.append(categoryOptions);
 readyFields.append(field('composition','Состав','textarea',{maxlength:600}));
 const nutr=el('div','pc-form-four');
 for(const [key,label] of [['p','Белки /100 г'],['f','Жиры /100 г'],['c','Углеводы /100 г'],['kcal','Ккал /100 г']])nutr.append(field(key,label,'number',{min:0,step:'.01'}));
 readyFields.append(nutr);
 function updateNutritionUnits(){
  const basis=['мл','л'].includes(fields.weightUnit?.value)?'мл':'г';
  for(const [key,name] of [['p','Белки'],['f','Жиры'],['c','Углеводы'],['kcal','Ккал']])fields[key].parentElement.querySelector('span').textContent=name+' /100 '+basis;
 }
 const weights=el('div','pc-form-two');
 const unitHolder=el('label','pc-field'),unitSelect=el('select');
 fields.weightUnit=unitSelect;unitSelect.id='pc-field-weightUnit';
 for(const unit of ['г','кг','мл','л','шт']){const o=el('option','',unit);o.value=unit;unitSelect.append(o)}
 unitHolder.append(el('span','','Единица нетто'),unitSelect);
 unitSelect.addEventListener('change',()=>{updateNutritionUnits();updateTemplatePreview();});
 weights.append(field('weight','Количество нетто','number',{min:0.001,step:'any'}),unitHolder,field('tolerance','Допуск ± (в выбранной единице)','number',{min:0,step:'any'}));
 readyFields.append(weights);content.append(readyFields);
 const templatePreview=el('section','pc-template-preview');
 const templatePreviewTitle=el('strong','','Предпросмотр эталона · 58 × 40 мм');
 const templatePreviewHint=el('p','','Заполни название, состав, КБЖУ, вес, температуру и срок — здесь появится твоя этикетка. Незаполненные данные не подставляются.');
 const templatePreviewCanvas=el('div','pc-template-preview-art');
 templatePreview.append(templatePreviewTitle,templatePreviewHint,templatePreviewCanvas);content.append(templatePreview);
 const prepFields=el('div');
 prepFields.append(field('prepCategory','Категория полуфабриката','text',{maxlength:60,placeholder:'Выберите или введите свою'}));
 const prepCategoryOptions=el('datalist');prepCategoryOptions.id='pc-prep-category-options';fields.prepCategory.setAttribute('list',prepCategoryOptions.id);prepFields.append(prepCategoryOptions);
 prepFields.append(field('point','Точка по умолчанию','text',{maxlength:40}));
 const prepEventHolder=el('label','pc-field');
 const prepEventTitle=el('span','','Обозначение даты');
 const prepEventSelect=el('select');
 prepEventSelect.id='pc-field-prepEvent';fields.prepEvent=prepEventSelect;
 for(const [value,label] of [['prepared','Изготовлено'],['thawed','Разморожено'],['opened','Вскрыто']]){
  const option=el('option','',label);option.value=value;prepEventSelect.append(option);
 }
 prepEventHolder.append(prepEventTitle,prepEventSelect);prepFields.append(prepEventHolder);
 content.append(prepFields);
 const bottom=el('div','pc-form-two');
 bottom.append(field('storage','Условия хранения','text',{maxlength:60}),field('hours','Срок годности, часы','number',{min:1,max:8760,step:'1'}));
 content.append(bottom);
 const storageOptions=el('datalist');storageOptions.id='pc-storage-options';
 for(const option of ['+2…+6 °C','0…+4 °C','−18 °C','+5…+25 °C']){const o=el('option');o.value=option;storageOptions.append(o)}
 fields.storage.setAttribute('list',storageOptions.id);content.append(storageOptions);
 content.append(el('small','pc-storage-help','Условия и срок указывай по ТТК или маркировке. Варианты температур — подсказки, а не автоматическое подтверждение.'));
 const checkbox=el('label','pc-approval');
 const verify=document.createElement('input');verify.type='checkbox';checkbox.append(verify,el('span','','Подтверждаю, что срок и режим установлены по ТТК или маркировке изготовителя. Без подтверждения печать на FARUKH PRINT останется заблокированной.'));
 content.append(checkbox);
 const actions=el('div','pc-form-actions');actions.append(btn('Отмена','pc-secondary',()=>dialog.close()));
 const save=el('button','pc-primary','Сохранить');save.type='submit';actions.append(save);
 const formError=el('p','pc-error');formError.hidden=true;
 const premiumLoaders=new Map();let previewTimeout=null;
 function loadPremiumRenderer(kind='ready'){
  const prep=kind==='prep';
  if(window.FarukhLabelSVG?.surface&&(prep?window.FarukhPremiumPrep?.draw:window.FarukhPremiumReady?.draw))return Promise.resolve();
  if(premiumLoaders.has(kind))return premiumLoaders.get(kind);
  const addScript=(url)=>new Promise((resolve,reject)=>{
   const node=document.createElement('script');node.src=url;node.onload=resolve;node.onerror=()=>reject(Error('Не удалось загрузить шаблон этикетки.'));document.head.append(node);
  });
  const load=Promise.resolve().then(async()=>{
   if(!window.FarukhLabelSVG?.surface)await addScript('/farukh-print/label-svg.js?v=3');
   if(prep){if(!window.FarukhPremiumPrep?.draw)await addScript('/farukh-print/premium-prep-label.js?v=1')}
   else if(!window.FarukhPremiumReady?.draw)await addScript('/farukh-print/premium-ready-label.js?v=4');
  }).catch(e=>{premiumLoaders.delete(kind);throw e});
  premiumLoaders.set(kind,load);return load;
 }
 function updateTemplatePreview(){
  if(!dialog.open||templatePreview.hidden)return;
  const prep=readyFields.hidden;
  const keys=prep?['name','storage','hours']:['name','composition','p','f','c','kcal','weight','tolerance','storage','hours'];
  if(keys.some(k=>!text(fields[k].value))){templatePreviewCanvas.replaceChildren();templatePreviewHint.textContent='Заполни все поля выше. Для срока и температуры используются только твои значения — примерные цифры не вставляются.';return;}
  const p={};for(const k of keys)p[k]=['p','f','c','kcal','weight','tolerance','hours'].includes(k)?Number(fields[k].value):text(fields[k].value);
  if(!p.name||!p.storage||p.hours<=0||(!prep&&(!p.composition||p.weight<=0))){templatePreviewCanvas.replaceChildren();return}
  if(prep)p.prepEvent=fields.prepEvent.value;
  else{p.weightUnit=fields.weightUnit.value;p.category=fields.category.value;}
  loadPremiumRenderer(prep?'prep':'ready').then(()=>{
   if(!dialog.open||templatePreview.hidden)return;
   const surface=window.FarukhLabelSVG.surface(prep?240:464,prep?160:320);
   const fmt=ms=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms)).replace(',','');
   if(prep)window.FarukhPremiumPrep.draw(surface.g,p,Date.now(),{formatDate:fmt});
   else window.FarukhPremiumReady.draw(surface.g,p,Date.now(),{formatDate:fmt});
   templatePreviewCanvas.replaceChildren(window.FarukhLabelSVG.element(surface.c.toSVG()));
   templatePreviewHint.textContent='Это предварительный просмотр по заполненным полям. Дата изготовления задаётся при печати. До подтверждения срока печать запрещена.';
  }).catch(e=>{if(dialog.open){templatePreviewCanvas.replaceChildren();templatePreviewHint.textContent='Предпросмотр: '+e.message}});
 }
 content.addEventListener('input',()=>{clearTimeout(previewTimeout);previewTimeout=setTimeout(updateTemplatePreview,180)});
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
  const approved=records.filter(p=>p.needsReview!==true).length;
  const percent=records.length?Math.round(100*approved/records.length):0;readinessCount.textContent=percent+'% · '+approved+' из '+records.length;
  readinessFill.style.width=percent+'%';readinessTrack.setAttribute('role','progressbar');readinessTrack.setAttribute('aria-valuemin','0');readinessTrack.setAttribute('aria-valuemax','100');readinessTrack.setAttribute('aria-valuenow',String(percent));
 }
 function renderRows(){
  table.replaceChildren();
  categorySelect.replaceChildren();
  const all=el('option','','Все категории');all.value='all';categorySelect.append(all);
  for(const name of categoryItems()){const option=el('option','',name);option.value=name;categorySelect.append(option)}
  if(category!=='all'&&!categoryItems().includes(category))category='all';
  categorySelect.value=category;
  const selected=records.filter(p=>p.kind===group&&p.name.toLocaleLowerCase('ru').includes(query)&&(category==='all'||categoryFor(p)===category)&&(!onlyPending||p.needsReview===true||!p.hours||!p.storage))
   .sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  const pages=Math.max(1,Math.ceil(selected.length/PAGE_SIZE));page=Math.max(1,Math.min(page,pages));
  const offset=(page-1)*PAGE_SIZE;
  pagination.hidden=selected.length<=PAGE_SIZE;
  paginationText.textContent=selected.length?'Показано '+(offset+1)+'–'+Math.min(offset+PAGE_SIZE,selected.length)+' из '+selected.length:'Нет товаров';
  prev.disabled=page===1;next.disabled=page>=pages;
  if(!selected.length){table.append(el('p','pc-empty',query||category!=='all'?'Ничего не найдено. Сбрось фильтр или поиск.':'В этой категории пока нет этикеток на данном устройстве.'));return}
  for(const p of selected.slice(offset,offset+PAGE_SIZE)){
   const row=el('div','pc-row');
   const pic=el('div','pc-row-photo');
   const source=displayPhoto(p);
   if(source){
    const img=el('img');img.src=source;img.alt='Фото '+p.name;img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
    const cred=p.kind==='prep'?window.FarukhPrepPhotoLibrary?.find(p):null;
    if(cred&&source===cred.url)img.title=cred.studio?'Студийный образец FARUKH PRINT':'Справочное фото. '+cred.author+' · '+cred.license+' · Wikimedia Commons';
    img.onerror=()=>{img.remove();pic.append(el('span','pc-photo-placeholder',window.FarukhPrepPhotoLibrary?.mark(p)||'Фото недоступно'))};
    pic.append(img);
   }else pic.append(el('span','pc-photo-placeholder',window.FarukhPrepPhotoLibrary?.mark(p)||'Фото не загружено'));
   const desc=el('div','pc-item');
   desc.append(el('strong','',p.name));
   desc.append(el('small','pc-category-label',categoryFor(p)));
   const details=el('small','',p.template?'ХАССП · Таблица для печати':p.needsReview===true?(p.hours&&p.storage?p.hours+' ч · '+p.storage+' · ждёт подтверждения по ТТК':'Срок не подтверждён · печать заблокирована'):(p.hours?p.hours+' ч · '+(p.storage||'нет условий хранения'):'Проверь условия и срок'));
   desc.append(details);
   const controls=el('div','pc-row-controls');
   controls.append(el('span','pc-tag '+(p.needsReview===true?'pc-wait':'pc-ok'),p.needsReview===true?'На проверке':'Подтверждено'));
   controls.append(btn('Нормы','pc-edit pc-norms-btn',()=>showGuidance(p)));
   if(p.kind==='prep'&&p.needsReview)controls.append(btn('✓ Подтвердить по ТТК','pc-edit pc-verify-btn',()=>{edit(p);verify.focus()}));
   if(!p.template)controls.append(btn(p.homeCover===true?'★ Обложка':'☆ На главную','pc-edit pc-cover-btn'+(p.homeCover===true?' active':''),()=>setHomeCover(p)));
   if(!p.template)controls.append(btn('Фото','pc-edit pc-photo-btn',()=>{edit(p);photoPick.focus()}));
   if(!p.template)controls.append(btn('Изменить','pc-edit',()=>edit(p)));
   controls.append(btn('×','pc-remove',()=>remove(p)));
   row.append(pic,desc,controls);table.append(row);
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
  reload();readyTab.classList.toggle('active',group==='ready');prepTab.classList.toggle('active',group==='prep');
  pending.hidden=group!=='prep';
  const count=records.filter(p=>p.kind==='prep'&&(p.needsReview===true||!p.hours||!p.storage)).length;
  pending.textContent=onlyPending?'Все полуфабрикаты':'Сроки: проверить '+count;
  pending.classList.toggle('active',onlyPending);
  normativeNotice.hidden=group!=='prep';
  renderRows();renderLog();loadPhotoAssets();
 }
 function commit(next,action,name){
  if(next.length>MAX)throw Error('Лимит '+MAX+' этикеток.');
  // All edits and imports are persisted atomically through a single write.
  // Never overwrite a damaged database.
  if(readDatabase().broken)throw Error('Текущая база повреждена. Сначала восстанови резервную копию.');
  localStorage.setItem(DB_KEY,JSON.stringify(next));
  pushLog(action,name);lastAction=action+' · '+name;render();
  window.dispatchEvent(new CustomEvent('farukh-print-catalog-local-updated',{detail:{action,name}}));
  message('Сохранено на устройстве. Если облако подключено и каталоги согласованы, изменения отправляются автоматически.');
 }
 async function importStarter(){
  try{
   const catalog=await import('./farukh-print/japanese-prep-catalog.js?v=1');
   const next=catalog.merge(records),added=next.length-records.length;
   const changed=next.some((p,i)=>p!==records[i]);
   if(!changed){message('Все 36 заготовок уже в каталоге. Подтверждённые сроки не изменены.');return}
   if(!confirm('Добавить '+added+' новых полуфабрикатов и заполнить отсутствующие ПРЕДЛОЖЕННЫЕ сроки в черновиках? 12 ч при +2…+6 °C — внутренний ориентир, НЕ норма СанПиН. Неподтверждённые позиции запрещены для печати. Ранее утверждённые сроки сохраняются.'))return;
   commit(next,'Добавлены предложения для японских заготовок',added+' новых, 36 типов; требуется ТТК');
  }catch(e){message('Импорт полуфабрикатов не выполнен: '+e.message,true)}
 }
 function edit(product,fromTemplate=false){
  manualTemplate=fromTemplate===true?'ready':fromTemplate==='prep'?'prep':'';
  currentEdit=product?.id||null;const v=product||{...empty,kind:group,...(manualTemplate?{tolerance:''}:{})};
  formTitle.textContent=manualTemplate==='prep'?'Новая этикетка · Премиум 30 × 20 мм':manualTemplate==='ready'?'Новая этикетка · Премиум 58 × 40 мм':(product?'Изменить':'Добавить')+' · '+(v.kind==='ready'?'58 × 40 мм':'30 × 20 мм');
  readyFields.hidden=v.kind!=='ready';prepFields.hidden=v.kind!=='prep';templatePreview.hidden=false;
 templatePreviewTitle.textContent=v.kind==='prep'?'Предпросмотр эталона · 30 × 20 мм':'Предпросмотр эталона · 58 × 40 мм';
 templatePreviewCanvas.replaceChildren();
  // External illustrative references must never be saved as uploaded JPEGs.
  chosenPhoto=v.photo&&window.FarukhPrintPhotos?.isPhoto(v.photo)?v.photo:'';
  photoChanged=false;showPhoto();
  categoryOptions.replaceChildren(...window.FarukhPrintCategories.list(records).map(name=>{const o=el('option');o.value=name;return o}));
  prepCategoryOptions.replaceChildren(...window.FarukhPrintCategories.list(records).map(name=>{const o=el('option');o.value=name;return o}));
  const values={...empty,...v,prepEvent:v.prepEvent||'prepared',category:window.FarukhPrintCategories.category(v),prepCategory:v.category||'Полуфабрикаты',weightUnit:v.weightUnit||'г'};
  for(const [key,input] of Object.entries(fields))input.value=values[key]??'';
  updateNutritionUnits();
  verify.checked=product?product.needsReview!==true:false;
  formError.hidden=true;
  dialog.showModal();updateTemplatePreview();
 }
 function saveEditor(){
  const existing=currentEdit?records.find(p=>p.id===currentEdit):null,kind=existing?.kind||group;
  const name=text(fields.name.value);
  const hoursValue=text(fields.hours.value);
  const p={...existing,id:existing?.id||uid(),name,kind,storage:text(fields.storage.value),hours:hoursValue?Number(hoursValue):null,needsReview:!verify.checked,photo:chosenPhoto};
  // 3D thumbnails are defaults only: an uploaded owner photo must win on staff devices.
  if(kind==='prep'&&photoChanged)p.photoStyle=chosenPhoto?'manual':'3d';
  if(kind==='ready'&&manualTemplate==='ready'&&!existing)p.labelStyle='premium-ready-58x40';
  if(kind==='prep'&&manualTemplate==='prep'&&!existing)p.labelStyle='premium-prep-30x20';
  if(kind==='prep'){
   p.point=text(fields.point.value);
   p.category=text(fields.prepCategory.value).slice(0,60);
   p.prepEvent=['prepared','thawed','opened'].includes(fields.prepEvent.value)?fields.prepEvent.value:'prepared';
  }
  else{
   p.category=text(fields.category.value).slice(0,60);
   p.weightUnit=fields.weightUnit.value;
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
 function setHomeCover(p){
  try{
   const wasSelected=p.homeCover===true;
   const next=records.map(x=>x.kind!==p.kind?x:{...x,homeCover:x.id===p.id?!wasSelected:false});
   commit(next,wasSelected?'Обложка сброшена':'Обложка выбрана',p.name);
   message(wasSelected?'Обложка сброшена. На главной FARUKH PRINT появится автоматическое изображение.':'Обложка «'+p.name+'» выбрана для '+(p.kind==='prep'?'полуфабрикатов':'готовой продукции')+'. После публикации облака её увидят подключённые устройства.');
  }catch(e){message('Настройка обложки: '+e.message,true)}
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
 async function importLegacyFromDevice(){
  const file=legacyFileInput.files?.[0];legacyFileInput.value='';if(!file)return;
  try{
   if(file.size>5*1024*1024)throw Error('Файл больше 5 МБ. Выбери JSON-копию с телефона или планшета.');
   const payload=JSON.parse(await file.text());
   if(payload?.format!=='farukh-print-legacy-v1'||!Array.isArray(payload.products))
    throw Error('Нужна резервная копия старой FARUKH PRINT, скачанная на телефоне или планшете.');
   if(payload.products.length>1000)throw Error('В старой копии слишком много позиций.');
   const converted=[],seen=new Set();
   const number=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)&&n>=0?n:fallback};
   for(const raw of payload.products){
    if(!raw||!['semi','ready'].includes(raw.type))continue;
    const name=text(raw.name).slice(0,90),kind=raw.type==='semi'?'prep':'ready';
    if(!name)continue;
    const key=kind+'|'+name.toLocaleLowerCase('ru');
    if(seen.has(key))continue;seen.add(key);
    const hours=Number(raw.hours),safeHours=Number.isSafeInteger(hours)&&hours>=1&&hours<=8760?hours:null;
    const storage=text(raw.storage).slice(0,60);
    // Import does not endorse legacy shelf-life values: owner review is mandatory.
    const item={id:uid(),kind,name,storage,hours:safeHours,needsReview:true,
      recipeMemo:'Импорт из старой базы телефона/планшета. Срок и технология требуют проверки.',
      point:text(raw.point).slice(0,40),
      labelStyle:kind==='prep'?'premium-prep-30x20':'premium-ready-58x40'};
    if(typeof raw.photo==='string'&&raw.photo.length<=45000&&window.FarukhPrintPhotos?.isPhoto(raw.photo)){
      item.photo=raw.photo;if(kind==='prep')item.photoStyle='manual';
    }
    if(kind==='ready'){
      item.composition=text(raw.composition).slice(0,600)||'Состав требует уточнения';
      item.p=number(raw.protein);item.f=number(raw.fat);item.c=number(raw.carb);item.kcal=number(raw.kcal);
      item.weight=number(raw.weight,1)||1;item.tolerance=number(raw.tolerance,10);
    }
    converted.push(item);
   }
   if(!converted.length)throw Error('В резервной копии нет подходящих карточек.');
   // The source of truth is the current owner-authorized server revision,
   // NEVER a stale local browser catalog. Add new names only; preserve cloud
   // photos, approved expiry settings, staff and device access unchanged.
   const response=await fetch('/api/farukh-print/admin/catalog',{credentials:'same-origin',cache:'no-store'});
   const current=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(current.error||'Сначала войди как владелец в разделе «Облако».');
   const existing=new Set(current.products.map(p=>p.kind+'|'+p.name.toLocaleLowerCase('ru')));
   const additions=converted.filter(p=>!existing.has(p.kind+'|'+p.name.toLocaleLowerCase('ru')));
   const skipped=converted.length-additions.length;
   if(!additions.length){message('Новых позиций нет: все '+skipped+' уже есть в общей базе. Облачные фотографии и сроки сохранены.');return}
   if(current.products.length+additions.length>1000)throw Error('Слишком много товаров для облачной базы.');
   if(!confirm('Добавить в общую базу '+additions.length+' новых позиций из «'+file.name+'»? '+skipped+' совпадающих не изменятся. Новые карточки будут заблокированы для печати до проверки сроков владельцем.'))return;
   const upload=await fetch('/api/farukh-print/admin/catalog',{method:'PUT',credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:current.revision,products:[...current.products,...additions]})});
   const result=await upload.json().catch(()=>({}));
   if(!upload.ok)throw Error((result.error||'Не удалось опубликовать')+(upload.status===409?' База изменилась — повтори импорт файла.':''));
   localStorage.setItem(DB_KEY,JSON.stringify(result.products));
   pushLog('Объединение старой базы',additions.length+' нов. / '+skipped+' совп.');
   render();
   window.dispatchEvent(new Event('farukh-print-cloud-refresh'));
   message('✓ В общей базе '+result.products.length+' товаров. Добавлено '+additions.length+', пропущено совпадений '+skipped+'. Новые карточки ожидают проверки срока перед печатью.');
  }catch(e){message('Объединение не выполнено: '+e.message,true)}
 }
 async function importBackup(){
  const file=fileInput.files?.[0];fileInput.value='';if(!file)return;
  try{
   if(file.size>5*1024*1024)throw Error('Размер копии превышает 5 МБ.');
   const parsed=validateBackup(JSON.parse(await file.text()));
   if(!confirm('Заменить всю локальную базу ('+records.length+' шт.) данными из файла ('+parsed.length+' шт.)? Перед заменой рекомендуется скачать резервную копию.'))return;
   // Allow recovery from corrupted data ONLY through validated import.
   localStorage.setItem(DB_KEY,JSON.stringify(parsed));pushLog('Импорт резервной копии',parsed.length+' поз.');render();window.dispatchEvent(new CustomEvent('farukh-print-catalog-local-updated',{detail:{action:'Импорт',name:'Резервная копия'}}));message('Загружено '+parsed.length+' этикеток. Проверь карточки и сроки.');
  }catch(e){message('Не удалось загрузить базу: '+e.message,true)}
 }
 window.addEventListener('farukh-print-cloud-catalog',event=>{
  cloudPhotos.clear();for(const p of event.detail?.products||[]){if(!window.FarukhPrintPhotos?.isPhoto(p.photo))continue;cloudPhotos.set(p.id,p.photo);cloudPhotos.set(photoKey(p),p.photo)}renderRows();
 });
 window.addEventListener('storage',event=>{if([DB_KEY,LOG_KEY].includes(event.key))render()});
 return {render,kind:()=>group,count:()=>records.length};
}
