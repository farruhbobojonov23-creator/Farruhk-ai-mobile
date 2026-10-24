import {getTemplate as getHaccpTemplate} from './farukh-print/haccp-catalog.js?v=2';
import './farukh-print/categories.js?v=1';
import {guidanceForProduct,REFERENCES} from './farukh-print/shelf-life-guidance.js?v=2';
import {storageAdviceFor,PRACTICE_REFERENCES} from './farukh-print/storage-advice.js?v=1';
// FARUKH AI — управление независимой базой FARUKH PRINT.
// Одна локальная база для страниц одного браузера/домена.
// Android APK используют отдельные WebView-хранилища: перенос JSON вручную.
const DB_KEY='farukh-print:catalog:v1',LOG_KEY='farukh-print:control-log:v1';
const MAX=1000;
const BASIC_PREP=['Соус спайси','Соус сырный','Фирменный соус','Огурцы','Капуста','Такуан','Форель','Угорь','Креветка','Курица готовая','Снежный краб','Сливочный соус','Перец','Омлет','Морковь','Бульон Том Ям','Унаги соус','Терияки соус','Сладкий чили'];

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
 if(photo&&(!window.FarukhPrintPhotos?.isPhoto(photo)))throw Error('Фото должно быть JPEG не более 45 КБ. Выбери его повторно.');
 if(!unverified&&(!storage||!Number.isInteger(hours)||hours<1||hours>8760))throw Error('Для подтверждённого товара укажи условия и срок годности.');
 if(entry.kind==='ready'){
  if(!text(entry.composition)||text(entry.composition).length>600)throw Error('Нужен состав готовой продукции.');
  for(const key of ['p','f','c','kcal','weight','tolerance'])if(!Number.isFinite(entry[key])||entry[key]<0)throw Error('Проверь КБЖУ и вес: '+key);
  if(entry.weight<=0)throw Error('Вес должен быть больше нуля.');
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
 function displayPhoto(p){
  // isPhoto('') is deliberately true for optional form fields, but an empty
  // string is not an actual image. Do not stop before cloud/static fallbacks.
  if(p.photo&&window.FarukhPrintPhotos?.isPhoto(p.photo))return p.photo;
  const remote=cloudPhotos.get(p.id)||cloudPhotos.get(photoKey(p));
  if(remote&&window.FarukhPrintPhotos?.isPhoto(remote))return remote;
  if(p.kind==='prep'&&text(p.name)==='Бульон Том Ям'&&brothPhoto)return brothPhoto;
  const supplement=supplementalPhotos?.photoFor(p);if(supplement)return supplement;
  if(p.kind==='ready'&&readyPhotos){const withPhoto=readyPhotos.merge([p])[0];if(withPhoto.photo)return withPhoto.photo}
  return '';
 }
 function loadPhotoAssets(){
  if(group==='prep'&&!prepLoading){prepLoading=Promise.all([import('./farukh-print/supplemental-photos.js?v=2'),import('./farukh-print/broth-photo.js?v=2')]).then(([supplement,broth])=>{supplementalPhotos=supplement;brothPhoto=broth.photo;renderRows()}).catch(()=>{});}
  if(group==='ready'&&!readyLoading){readyLoading=import('./farukh-print/catalog-photos.js?v=2').then(m=>{readyPhotos=m;renderRows()}).catch(()=>{});}
 }
 function categoryFor(p){
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
 const seed=btn('＋ База 19 полуфабрикатов','pc-secondary',importStarter);
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
  el('span','','Нажми «Нормы» у любой позиции: роллов, полуфабрикатов или служебной этикетки. Указанные ориентиры не меняют срок автоматически: учитываются технология, маркировка изготовителя и ТТК.'));
 const guideLink=el('a','','Действующий СанПиН 2.3/2.4.4282-26 ↗');
 guideLink.href=REFERENCES[0].url;guideLink.target='_blank';guideLink.rel='noopener noreferrer';normativeNotice.append(guideLink);
 const table=el('div','pc-list');
 const pagination=el('div','pc-pagination');const paginationText=el('span','','');const prev=btn('← Назад','pc-pager',()=>{if(page>1){page--;renderRows()}});const next=btn('Далее →','pc-pager',()=>{page++;renderRows()});pagination.append(paginationText,prev,next);
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
 let chosenPhoto='';
 const photoPanel=el('section','pc-photo-field');
 const photoPreview=el('img','pc-photo-preview');
 photoPreview.alt='Фото товара';photoPreview.hidden=true;
 const photoEmpty=el('div','pc-photo-empty','◇');const photoCaption=el('div','pc-photo-controls');
 photoCaption.append(el('strong','','Фото для каталога'),el('small','','Можно выбрать или заменить самостоятельно. На чёрно-белых этикетках фото не печатается.'));
 const photoPick=btn('＋ Загрузить фото','pc-secondary',()=>photoFile.click());
 const photoRemove=btn('Убрать фото','pc-secondary',()=>{chosenPhoto='';showPhoto()});
 const photoFile=el('input');photoFile.type='file';photoFile.accept='image/jpeg,image/png,image/webp';photoFile.hidden=true;
 function showPhoto(){
  const filled=!!chosenPhoto;
  photoPreview.hidden=!filled;photoEmpty.hidden=filled;photoRemove.disabled=!filled;
  if(filled)photoPreview.src=chosenPhoto;else photoPreview.removeAttribute('src');
 }
 photoFile.addEventListener('change',async()=>{
  const file=photoFile.files?.[0];photoFile.value='';if(!file)return;
  photoPick.disabled=true;
  try{chosenPhoto=await window.FarukhPrintPhotos.compress(file);showPhoto();formError.hidden=true}
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
 const weights=el('div','pc-form-two');
 weights.append(field('weight','Вес, г','number',{min:1,step:'1'}),field('tolerance','Допуск ±, г','number',{min:0,step:'1'}));
 readyFields.append(weights);content.append(readyFields);
 const templatePreview=el('section','pc-template-preview');
 const templatePreviewTitle=el('strong','','Предпросмотр эталона · 58 × 40 мм');
 const templatePreviewHint=el('p','','Заполни название, состав, КБЖУ, вес, температуру и срок — здесь появится твоя этикетка. Незаполненные данные не подставляются.');
 const templatePreviewCanvas=el('div','pc-template-preview-art');
 templatePreview.append(templatePreviewTitle,templatePreviewHint,templatePreviewCanvas);content.append(templatePreview);
 const prepFields=el('div');
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
 const checkbox=el('label','pc-approval');
 const verify=document.createElement('input');verify.type='checkbox';checkbox.append(verify,el('span','','Подтверждаю, что срок и режим установлены по ТТК или маркировке изготовителя. Без подтверждения печать на FARUKH PRINT останется заблокированной.'));
 content.append(checkbox);
 const actions=el('div','pc-form-actions');actions.append(btn('Отмена','pc-secondary',()=>dialog.close()));
 const save=el('button','pc-primary','Сохранить');save.type='submit';actions.append(save);
 const formError=el('p','pc-error');formError.hidden=true;
 let premiumLoader=null,previewTimeout=null;
 function loadPremiumRenderer(kind='ready'){
  const prep=kind==='prep';
  if(window.FarukhLabelSVG?.surface&&(prep?window.FarukhPremiumPrep?.draw:window.FarukhPremiumReady?.draw))return Promise.resolve();
  if(premiumLoader)return premiumLoader;
  const addScript=(url)=>new Promise((resolve,reject)=>{
   const node=document.createElement('script');node.src=url;node.onload=resolve;node.onerror=()=>reject(Error('Не удалось загрузить шаблон этикетки.'));document.head.append(node);
  });
  premiumLoader=Promise.resolve().then(async()=>{
   if(!window.FarukhLabelSVG?.surface)await addScript('/farukh-print/label-svg.js?v=3');
   if(prep){if(!window.FarukhPremiumPrep?.draw)await addScript('/farukh-print/premium-prep-label.js?v=1')}
   else if(!window.FarukhPremiumReady?.draw)await addScript('/farukh-print/premium-ready-label.js?v=3');
  }).catch(e=>{premiumLoader=null;throw e});
  return premiumLoader;
 }
 function updateTemplatePreview(){
  if(!dialog.open||templatePreview.hidden)return;
  const prep=readyFields.hidden;
  const keys=prep?['name','storage','hours']:['name','composition','p','f','c','kcal','weight','tolerance','storage','hours'];
  if(keys.some(k=>!text(fields[k].value))){templatePreviewCanvas.replaceChildren();templatePreviewHint.textContent='Заполни все поля выше. Для срока и температуры используются только твои значения — примерные цифры не вставляются.';return;}
  const p={};for(const k of keys)p[k]=['p','f','c','kcal','weight','tolerance','hours'].includes(k)?Number(fields[k].value):text(fields[k].value);
  if(!p.name||!p.storage||p.hours<=0||(!prep&&(!p.composition||p.weight<=0))){templatePreviewCanvas.replaceChildren();return}
  if(prep)p.prepEvent=fields.prepEvent.value;
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
   if(source){const img=el('img');img.src=source;img.alt='Фото '+p.name;img.loading='lazy';img.decoding='async';pic.append(img)}
   else pic.append(el('span','pc-photo-placeholder','Фото не загружено'));
   const desc=el('div','pc-item');
   desc.append(el('strong','',p.name));
   desc.append(el('small','pc-category-label',categoryFor(p)));
   const details=el('small','',p.template?'ХАССП · Таблица для печати':p.needsReview===true?'Срок не подтверждён · печать заблокирована':(p.hours?p.hours+' ч · '+(p.storage||'нет условий хранения'):'Проверь условия и срок'));
   desc.append(details);
   const controls=el('div','pc-row-controls');
   controls.append(el('span','pc-tag '+(p.needsReview===true?'pc-wait':'pc-ok'),p.needsReview===true?'На проверке':'Подтверждено'));
   controls.append(btn('Нормы','pc-edit pc-norms-btn',()=>showGuidance(p)));
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
 function importStarter(){
  try{
   const exists=new Set(records.filter(r=>r.kind==='prep').map(r=>r.name.toLocaleLowerCase('ru')));
   const missing=BASIC_PREP.filter(name=>!exists.has(name.toLocaleLowerCase('ru')));
   if(!missing.length){message('Все 19 базовых полуфабрикатов уже есть в каталоге.');return}
   if(!confirm('Добавить '+missing.length+' полуфабрикатов в локальную базу центра? Непроверенные сроки останутся заблокированы для печати.'))return;
   const added=missing.map(name=>({
     id:uid(),kind:'prep',name,storage:name==='Соус спайси'?'+2…+6 °C':'',
     hours:name==='Соус спайси'?48:null,point:'',needsReview:true,
     ...(name==='Соус спайси'?{recipeMemo:'Майонез «Печагин» 67%, сухие специи, без нагрева. 48 ч предложено владельцем, не подтверждено нормативом.'}:{})
   }));
   commit([...records,...added],'Добавлена стартовая база',missing.length+' позиций');
  }catch(e){message(e.message,true)}
 }
 function edit(product,fromTemplate=false){
  manualTemplate=fromTemplate===true?'ready':fromTemplate==='prep'?'prep':'';
  currentEdit=product?.id||null;const v=product||{...empty,kind:group,...(manualTemplate?{tolerance:''}:{})};
  formTitle.textContent=manualTemplate==='prep'?'Новая этикетка · Премиум 30 × 20 мм':manualTemplate==='ready'?'Новая этикетка · Премиум 58 × 40 мм':(product?'Изменить':'Добавить')+' · '+(v.kind==='ready'?'58 × 40 мм':'30 × 20 мм');
  readyFields.hidden=v.kind!=='ready';prepFields.hidden=v.kind!=='prep';templatePreview.hidden=false;
 templatePreviewTitle.textContent=v.kind==='prep'?'Предпросмотр эталона · 30 × 20 мм':'Предпросмотр эталона · 58 × 40 мм';
 templatePreviewCanvas.replaceChildren();
  chosenPhoto=displayPhoto(v);
  showPhoto();
  categoryOptions.replaceChildren(...window.FarukhPrintCategories.list(records).map(name=>{const o=el('option');o.value=name;return o}));
  const values={...empty,...v,prepEvent:v.prepEvent||'prepared',category:window.FarukhPrintCategories.category(v)};
  for(const [key,input] of Object.entries(fields))input.value=values[key]??'';
  verify.checked=product?product.needsReview!==true:false;
  formError.hidden=true;
  dialog.showModal();updateTemplatePreview();
 }
 function saveEditor(){
  const existing=currentEdit?records.find(p=>p.id===currentEdit):null,kind=existing?.kind||group;
  const name=text(fields.name.value);
  const hoursValue=text(fields.hours.value);
  const p={...existing,id:existing?.id||uid(),name,kind,storage:text(fields.storage.value),hours:hoursValue?Number(hoursValue):null,needsReview:!verify.checked,photo:chosenPhoto};
  if(kind==='ready'&&manualTemplate==='ready'&&!existing)p.labelStyle='premium-ready-58x40';
  if(kind==='prep'&&manualTemplate==='prep'&&!existing)p.labelStyle='premium-prep-30x20';
  if(kind==='prep'){
   p.point=text(fields.point.value);
   p.prepEvent=['prepared','thawed','opened'].includes(fields.prepEvent.value)?fields.prepEvent.value:'prepared';
  }
  else{
   p.category=text(fields.category.value).slice(0,60);
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
   localStorage.setItem(DB_KEY,JSON.stringify(parsed));pushLog('Импорт резервной копии',parsed.length+' поз.');render();window.dispatchEvent(new CustomEvent('farukh-print-catalog-local-updated',{detail:{action:'Импорт',name:'Резервная копия'}}));message('Загружено '+parsed.length+' этикеток. Проверь карточки и сроки.');
  }catch(e){message('Не удалось загрузить базу: '+e.message,true)}
 }
 window.addEventListener('farukh-print-cloud-catalog',event=>{
  cloudPhotos.clear();for(const p of event.detail?.products||[]){if(!window.FarukhPrintPhotos?.isPhoto(p.photo))continue;cloudPhotos.set(p.id,p.photo);cloudPhotos.set(photoKey(p),p.photo)}renderRows();
 });
 window.addEventListener('storage',event=>{if([DB_KEY,LOG_KEY].includes(event.key))render()});
 return {render,kind:()=>group,count:()=>records.length};
}
