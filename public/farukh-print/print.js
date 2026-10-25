(()=>{'use strict';
const $=id=>document.getElementById(id);
const KEY='farukh-print:catalog:v1';
// Названия получены от владельца. СанПиН 2.3/2.4.4282-26 (с 01.09.2026)
// не задаёт единого срока годности для каждой из этих заготовок.
// Черновики НЕ пригодны для печати до подтверждения технологической документации.
const STARTER_PREP_NAMES=[
 'Соус спайси','Соус сырный','Фирменный соус','Огурцы','Капуста',
 'Такуан','Форель','Угорь','Креветка','Курица готовая','Снежный краб',
 'Сливочный соус','Перец','Омлет','Морковь','Бульон Том Ям',
 'Унаги соус','Терияки соус','Сладкий чили'
];
// Рекомендации по оформлению сведений без назначения вымышленных сроков.
// Категория описывает ожидаемый способ использования, но не доказывает
// безопасность, отсутствие термообработки или исходную температуру.
const PREP_GUIDANCE={
 'Соус спайси':['Соус собственного приготовления, без нагрева','ТТК, состав, документы на майонез после вскрытия; 48 ч — только предложение владельца, не норма СанПиН.'],
 'Соус сырный':['Соус собственного приготовления','ТТК с полным составом, технологией и утверждённым сроком смешанной продукции.'],
 'Фирменный соус':['Соус собственного приготовления','ТТК с полным составом, обработкой и утверждённым сроком хранения.'],
 'Сливочный соус':['Соус собственного приготовления','ТТК: уточнить состав, наличие нагрева, охлаждение и срок.'],
 'Огурцы':['Свежие овощи, подготовленные к использованию','Форма обработки: цельные, промытые или нарезанные; срок после обработки по ТТК.'],
 'Капуста':['Свежие овощи, подготовленные к использованию','Состав заготовки и обработка: целая, шинкованная, маринованная; срок по ТТК.'],
 'Перец':['Свежие овощи, подготовленные к использованию','Форма нарезки, мойка, режим хранения и утверждённая ТТК.'],
 'Морковь':['Свежие овощи, подготовленные к использованию','Мойка, очистка и нарезка; технология и срок по ТТК.'],
 'Такуан':['Готовый к использованию маринованный продукт','Маркировка поставщика и указанный изготовителем срок после вскрытия; факт нарезки.'],
 'Форель':['Рыба для приготовления блюд','Особо важно: происхождение, сырой/солёный/термообработанный вид, размораживание, температура по маркировке, ТТК.'],
 'Угорь':['Рыба/рыбная заготовка','Уточнить, готовый ли термообработанный угорь или иной продукт; маркировка поставщика после вскрытия и ТТК.'],
 'Креветка':['Морепродукт для приготовления блюд','Уточнить сырая/варёная/размороженная, упаковка, дата вскрытия и условия изготовителя.'],
 'Курица готовая':['Готовая птица после тепловой обработки','ТТК: достаточность термообработки, охлаждение, порционирование и утверждённый срок.'],
 'Снежный краб':['Готовый крабовый продукт/сурими — тип уточняется','Маркировка изготовителя, фактический состав, режим и срок после вскрытия; ТТК при смешивании.'],
 'Омлет':['Готовый продукт из яиц','ТТК, термообработка, охлаждение, хранение; не переносить срок другого продукта.'],
 'Бульон Том Ям':['Готовая заготовка бульона','ТТК: термообработка, охлаждение, контейнер, хранение; срок обосновать.'],
 'Унаги соус':['Соус: готовый заводской или собственный — уточняется','Для заводского — маркировка после вскрытия; для собственного — рецептура и ТТК.'],
 'Терияки соус':['Соус: готовый заводской или собственный — уточняется','Для заводского — маркировка после вскрытия; для собственного — рецептура и ТТК.'],
 'Сладкий чили':['Соус: готовый заводской или собственный — уточняется','Для заводского — маркировка после вскрытия; для собственного — рецептура и ТТК.']
};
const guideFor=p=>p?.kind==='prep'?PREP_GUIDANCE[p.name]||['Полуфабрикат','Состав, технологию, температуру и срок подтвердить по ТТК/производителю.']:null;
let adviceLoader=null;
function openProductAdvice(p){
 // Load only if the employee asks for advice, keeping the print catalog fast.
 if(!adviceLoader)adviceLoader=import('./employee-advice.js?v=4').catch(e=>{adviceLoader=null;throw e});
 void adviceLoader.then(({openAdvice})=>openAdvice({
  ...p,category:p.category||(p.kind==='ready'?window.FarukhPrintCategories?.category?.(p):'')
 },{
  onPrint:(product)=>{
   if(!products.some(x=>x.id===product.id&&x.kind===product.kind))return;
   if(kind!==product.kind)openCatalog(product.kind);
   selected=product.id;haccpDraft=null;$('haccp-limit').value='';
   if(kind==='prep')$('point-name').value=window.FARUKH_PRINT_STAFF_API?.point()||product.point||'';
   renderCatalog();openWorkerPreview();
  }
 })).catch(e=>status('Советы недоступны: '+e.message,true));
}

// 203 dpi printer: 30 mm × 20 mm = 240 × 160 dots; ready product remains 58 × 40 mm.
const WIDTH={ready:464,prep:240},HEIGHT={ready:320,prep:160};
let products=[],kind='ready',manageKind='ready',selected=null,editing=null,busy=false,previewError='',editFromCatalog=null,cloudPaired=false;
let activeCategory='';
let HACCP=null,haccpDraft=null;
let bundledPrepPhotos=null,bundledBrothPhoto='';
const isHaccp=p=>!!HACCP?.getTemplate(p);
// Original FARUKH PRINT APK accepts only a 31×20 mm TSPL transport.
// Preserve the 30×20 mm visual layout and pad exactly 1 mm of EMPTY bits
// solely when the old native validator explicitly rejects 30×20.
let legacyNative30Transport=false,pendingNativePrint=null,editorPhoto='',favoritesOnly=false,activePrintEvent=null,manualPremium=false,manualPrepPremium=false,editorPhotoChanged=false;
const native=typeof window.FarukhPrinter?.postMessage==='function';
const sendNative=packet=>window.FarukhPrinter.postMessage(JSON.stringify(packet));
const status=(message,error=false)=>{const node=$('print-message');node.textContent=message;node.dataset.error=error?'yes':'no'};
const nowLocal=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};
const formatted=epoch=>new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(epoch)).replace(',','');
const nv=n=>String(n).replace('.',',');
const str=s=>String(s??'').trim();
const makeId=()=>globalThis.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2);
// Pechagin Professional 67%, dry spices, cold-mixed, as supplied by the
// owner. 48 h is an OWNER-PROPOSED interval, NOT a shelf life verified by
// SanPiN or the manufacturer; printing stays disabled until separate approval.
const SPICY_PROPOSAL={storage:'+2…+6 °C',hours:48,recipeMemo:'Майонез «Печагин» 67%, сухие специи; смешивание без нагрева.',needsReview:true};
function isSpicy(p){return p.kind==='prep'&&str(p.name).toLocaleLowerCase('ru')==='соус спайси'}
function draftFor(name){const row={id:makeId(),kind:'prep',name,storage:'',hours:null,point:'',needsReview:true};return isSpicy(row)?{...row,...SPICY_PROPOSAL}:row}
function fillSpicyProposal(){
 let changed=false;
 for(const row of products){
  if(!isSpicy(row)||row.needsReview!==true)continue;
  // Only fill *empty* owner-unreviewed drafts. Never overwrite a chosen
  // storage temperature, a shelf life, or a confirmed recipe.
  const fillHours=row.hours===null||row.hours===undefined||row.hours==='';
  const fillStorage=!str(row.storage);
  if(fillHours){row.hours=SPICY_PROPOSAL.hours;changed=true}
  if(fillStorage){row.storage=SPICY_PROPOSAL.storage;changed=true}
  if(!row.recipeMemo){row.recipeMemo=SPICY_PROPOSAL.recipeMemo;changed=true}
 }
 return changed;
}
function mergeStarterPrep(){
 const existing=new Set(products.filter(p=>p.kind==='prep').map(p=>str(p.name).toLocaleLowerCase('ru')));
 const additions=STARTER_PREP_NAMES.filter(name=>!existing.has(name.toLocaleLowerCase('ru')));
 if(additions.length)products.push(...additions.map(draftFor));
 return additions.length;
}
function load(){
 let saved=null;
 try{saved=localStorage.getItem(KEY);const old=JSON.parse(saved||'[]');products=Array.isArray(old)?old.filter(x=>x&&['ready','prep'].includes(x.kind)&&typeof x.name==='string').slice(0,1000):[]}catch{products=[]}
 // Only fresh installations are seeded automatically. Existing user data is
 // never overwritten and can be supplemented with the explicit import button.
 // A staff-only first visit must not create a separate local catalogue before
 // the owner's approved cloud catalogue is downloaded.
 if(saved===null){if(!window.FARUKH_PRINT_EMPLOYEE_ENTRY){mergeStarterPrep();save()}}
 else if(!window.FARUKH_PRINT_EMPLOYEE_ENTRY&&fillSpicyProposal())save()
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(products));return true}catch(e){alert('Не удалось сохранить базу на этом устройстве: '+e.message);return false}}
function node(tag,cls,txt){const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x}
function current(){return products.find(p=>p.id===selected&&p.kind===kind)||null}
const isManaged=()=>window.FARUKH_PRINT_EMPLOYEE_ENTRY===true||localStorage.getItem('farukh-print:staff-managed:v1')==='1';
let workerLoggedIn=null;
const pref=which=>'farukh-print:'+which+':v1:'+(workerLoggedIn?.login||'local');
const favs=()=>{try{const x=JSON.parse(localStorage.getItem(pref('favs'))||'[]');return Array.isArray(x)?x:[]}catch{return []}};
const lastSent=()=>{try{return JSON.parse(localStorage.getItem(pref('last-sent'))||'null')}catch{return null}};
function renderShortcuts(){
 const worker=isManaged()&&!!workerLoggedIn;$('worker-shortcuts').hidden=!worker;if(!worker)return;
 $('worker-fav-filter').classList.toggle('selected',favoritesOnly);
 $('worker-fav-filter').setAttribute('aria-pressed',String(favoritesOnly));
 const row=lastSent(),p=row&&products.find(x=>x.id===row.id&&x.kind===row.kind);
 $('worker-repeat').disabled=!p||!!p.needsReview||(!isHaccp(p)&&(!p.hours||!p.storage));
 $('worker-repeat').textContent=p?'↻ Повторить: '+p.name+' · '+row.copies+' шт.':'↻ Повторить отправку';
 $('worker-repeat-hint').textContent=p?(isHaccp(p)?'Повтор с сохранёнными датами':'Новая дата и повторная проверка доступа'):'Нет предыдущей отправки';
}
function saveLast(p,copies){
 if(!p)return;
 try{localStorage.setItem(pref('last-sent'),JSON.stringify({id:p.id,kind:p.kind,copies}))}catch{}
 renderShortcuts();
}
function toggleFav(id){
 const set=new Set(favs());set.has(id)?set.delete(id):set.add(id);
 try{localStorage.setItem(pref('favs'),JSON.stringify([...set].slice(0,1000)))}catch{}
 renderCatalog();
}
async function repeatLast(){
 if(busy||!workerLoggedIn)return;
 const old=lastSent(),p=old&&products.find(x=>x.id===old.id&&x.kind===old.kind);
 if(!p||p.needsReview||(!isHaccp(p)&&(!p.hours||!p.storage))){status('Последнюю этикетку нельзя повторить — проверь товар.',true);return}
 if(kind!==p.kind)openCatalog(p.kind);
 activeCategory='';
 selected=p.id;$('printed-at').value=nowLocal();$('copies').value=String(Math.min(20,Math.max(1,Number(old.copies)||1)));
 if(p.kind==='prep')$('point-name').value=workerLoggedIn.point;
 favoritesOnly=false;renderCatalog();openWorkerPreview();await doPrint(false);
}

function closeWorkerPreview(){
 document.body.classList.remove('worker-preview-open');
 $('worker-preview-backdrop').hidden=true;
 $('worker-close-preview').hidden=true;
}
function openWorkerPreview(){
 if(!isManaged()||!workerLoggedIn)return;
 document.body.classList.add('worker-preview-open');
 $('worker-preview-backdrop').hidden=false;
 $('worker-close-preview').hidden=false;
 if(window.innerWidth>770)$('printing-panel').scrollIntoView?.({behavior:'smooth',block:'nearest'});
}
function renderWorker(){
 const managed=isManaged(),showWorker=managed&&!!workerLoggedIn;
 document.body.classList.toggle('worker-managed',managed);
 document.body.classList.toggle('worker-logged-in',showWorker);
 $('worker-dashboard').hidden=!showWorker;
 renderShortcuts();
 $('worker-staff-info').textContent=showWorker?'Повар: '+workerLoggedIn.name:'Войди под личным логином.';
 $('worker-point').textContent=showWorker?'Точка · '+workerLoggedIn.point:'Точка не выбрана';
 $('worker-ready-tab').classList.toggle('selected',kind==='ready');
 $('worker-prep-tab').classList.toggle('selected',kind==='prep');
 $('open-settings').hidden=managed;
 $('manage-from-home').hidden=managed;
 $('home-premium-template').hidden=managed||cloudPaired;
 $('home-premium-prep').hidden=managed||cloudPaired;
 $('use-premium-prep').disabled=managed||cloudPaired;
 $('use-premium-template').disabled=managed||cloudPaired;
 if(managed)$('point-field').hidden=true;
 if(!showWorker)closeWorkerPreview();
}
function updateWorkerSession(staff){
 const wasLoggedIn=!!workerLoggedIn;
 workerLoggedIn=staff||null;
 renderWorker();
 if(isManaged()&&workerLoggedIn&&!wasLoggedIn){
   openCatalog('prep');
 }else if(isManaged()&&!workerLoggedIn){
   selected=null;closeWorkerPreview();show('home');
 }
}
function show(section){
 for(const id of ['home','catalog','manage'])$(id).hidden=id!==section;
 window.scrollTo?.({top:0,behavior:'instant'});
}
function renderHome(){
 $('home-premium-template').hidden=isManaged()||cloudPaired;
 $('home-premium-prep').hidden=isManaged()||cloudPaired;
 $('use-premium-prep').disabled=isManaged()||cloudPaired;
 $('use-premium-template').disabled=isManaged()||cloudPaired;
 $('count-ready').textContent=products.filter(x=>x.kind==='ready').length;
 $('count-prep').textContent=products.filter(x=>x.kind==='prep').length;
 $('manage-count-ready').textContent=products.filter(x=>x.kind==='ready').length;
 $('manage-count-prep').textContent=products.filter(x=>x.kind==='prep').length;
}
function openCatalog(type){
 closeWorkerPreview();
 kind=type;selected=null;activeCategory='';$('catalog-search').value='';
 $('catalog-title').textContent=type==='ready'?'Готовая продукция · 58 × 40':'Полуфабрикаты · 30 × 20';
 $('catalog-kicker').textContent=type==='ready'?'ГОТОВАЯ ПРОДУКЦИЯ':'ПОЛУФАБРИКАТЫ';
 $('print-size-badge').textContent=type==='ready'?'58 × 40 мм':'30 × 20 мм';
 $('point-field').hidden=type==='ready'||isManaged();
 $('printed-at').value=nowLocal();$('copies').value='1';
 show('catalog');renderWorker();renderCatalog();
}
function renderCategories(){
 const bar=$('catalog-categories');
 bar.hidden=kind!=='ready';
 if(bar.hidden)return;
 const api=window.FarukhPrintCategories;
 const names=api.list(products);
 if(activeCategory&&!names.includes(activeCategory))activeCategory='';
 bar.replaceChildren();
 for(const name of ['',...names]){
  const count=products.filter(p=>p.kind==='ready'&&(!name||api.category(p)===name)).length;
  const button=node('button','category-chip'+(name===activeCategory?' selected':''));button.type='button';
  button.setAttribute('aria-pressed',String(name===activeCategory));
  button.append(node('span','',name||'Все'),node('small','',String(count)));
  button.onclick=()=>{activeCategory=name;selected=null;closeWorkerPreview();renderCatalog()};
  bar.append(button);
 }
}
// The studio atlas is decoded asynchronously after initial paint; repaint
// only the visible gallery. This changes images, never product/shelf data.
if(typeof window.addEventListener==='function'){
 const refreshIngredientArt=()=>{
  if(typeof document!=='undefined'&&document.getElementById('catalog')&&!$('catalog').hidden)renderCatalog();
 };
 window.addEventListener('farukh-studio-ready',refreshIngredientArt);
 window.addEventListener('farukh-approved-3d-ready',refreshIngredientArt);
}
function renderCatalog(){
 renderCategories();
 const list=$('product-list');list.replaceChildren();
 const q=str($('catalog-search').value).toLocaleLowerCase('ru'),favorite=new Set(favs()),worker=isManaged()&&!!workerLoggedIn;
 const items=products.filter(p=>p.kind===kind&&(kind!=='ready'||!activeCategory||window.FarukhPrintCategories.category(p)===activeCategory)&&p.name.toLocaleLowerCase('ru').includes(q)&&(!worker||!favoritesOnly||favorite.has(p.id)))
  .sort((a,b)=>worker?Number(favorite.has(b.id))-Number(favorite.has(a.id))||a.name.localeCompare(b.name,'ru'):a.name.localeCompare(b.name,'ru'));
 if(selected&&!products.some(p=>p.id===selected&&p.kind===kind))selected=null;
 $('catalog-empty').hidden=items.length!==0;
 $('catalog-empty').textContent=q?'По этому запросу ничего не найдено.':worker&&favoritesOnly?'Избранных пока нет. Нажми ☆ на карточке товара.':activeCategory==='ХАССП'?'Категория ХАССП пока пуста.':activeCategory?'В категории «'+activeCategory+'» пока нет товаров.':'В этой категории нет товаров.';
 for(const p of items){
  const item=node('div','product-item product-tile'+(p.id===selected?' selected':'')),select=node('button','product-select');select.type='button';
  select.setAttribute('aria-label','Открыть этикетку: '+p.name);
  const visual=node('span','product-visual');
  // Owner-approved visually rich 3D-style renders take priority for the
  // 12 matching prep ingredients. Other prep items use their real/studio
  // food imagery before a vector fallback. Never mutate p.photo or labels.
  const approved=p.kind==='prep'?window.FarukhApprovedPrep3D?.find(p):null;
  const threeD=p.kind==='prep'?window.FarukhPrep3DElements?.find(p):null;
  const fallback=p.kind==='prep'?window.FarukhPrepPhotoLibrary?.find(p):null;
  const original=p.photo&&window.FarukhPrintPhotos?.isPhoto(p.photo)?p.photo:'';
  // Existing owner images saved before photoStyle was introduced must also
  // win over the default 3D artwork if they differ from the bundled stock.
  const bundled=p.kind==='prep'?(p.name==='Бульон Том Ям'?bundledBrothPhoto:bundledPrepPhotos?.photoFor(p)||''):'';
  const usingCustom=!!original&&(p.photoStyle==='manual'||(!p.photoStyle&&!!bundled&&original!==bundled));
  const displayed=usingCustom?original:(approved?.url||threeD?.url||original||fallback?.url||'');
  if(displayed){
   if(displayed===approved?.url)visual.classList.add('prep-photo3d-preview');
   else if(displayed===threeD?.url)visual.classList.add('prep-3d-preview');
   else if(displayed===fallback?.url&&fallback?.studio)visual.classList.add('studio-preview');
   const img=node('img','product-photo');img.src=displayed;
   img.alt=(displayed===approved?.url?'Реалистичный 3D-рендер: ':displayed===threeD?.url?'3D-иллюстрация: ':'Изображение продукта: ')+p.name;
   img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
   if(displayed===approved?.url)img.title='Утверждённый объёмный рендер FARUKH PRINT — '+p.name;
   let triedFallback=false;
   img.onerror=()=>{
    const backup=original||fallback?.url||threeD?.url;
    if(!triedFallback&&backup&&backup!==displayed){
     triedFallback=true;img.src=backup;
     visual.classList.remove('prep-photo3d-preview','prep-3d-preview');
     return;
    }
    img.remove();visual.append(node('span','product-photo-placeholder',window.FarukhPrepPhotoLibrary?.mark(p)||'◇'));
   };
   visual.append(img);
  }else visual.append(node('span','product-photo-placeholder',window.FarukhPrepPhotoLibrary?.mark(p)||'◇'));
  const bottom=node('span','product-tile-info');bottom.append(node('strong','',p.name));
  const meta=node('small','product-tile-meta'+(p.needsReview?' needs-review':''),isHaccp(p)?(p.mode==='place'?'Место хранения · 58 × 40':p.mode==='shift'?'Замена до конца смены':p.days+' дней · 58 × 40'):p.needsReview?(p.hours&&p.storage?p.hours+' ч · '+p.storage+' · требует подтверждения':'Срок требует проверки'):p.hours+' ч · '+p.storage);
  select.append(visual,bottom);select.onclick=()=>{selected=p.id;haccpDraft=null;$('haccp-limit').value='';if(kind==='prep')$('point-name').value=window.FARUKH_PRINT_STAFF_API?.point()||p.point||'';renderCatalog();openWorkerPreview()};item.append(select);
  const tipsButton=node('button','product-tips','▣ Советы');
  tipsButton.type='button';tipsButton.setAttribute('aria-label','Советы по хранению: '+p.name);
  tipsButton.onclick=()=>openProductAdvice(p);
  item.append(tipsButton,meta);
  if(worker){const star=node('button','product-favorite'+(favorite.has(p.id)?' is-favorite':''),favorite.has(p.id)?'★':'☆');star.type='button';star.setAttribute('aria-label',(favorite.has(p.id)?'Убрать из избранного: ':'В избранное: ')+p.name);star.setAttribute('aria-pressed',String(favorite.has(p.id)));star.onclick=()=>toggleFav(p.id);item.append(star)}
  list.append(item);
 }
 renderShortcuts();updatePreview();
}
function openManage(type=manageKind){
 if(isManaged())return;
 manageKind=type;show('manage');renderManage();
}
function renderManage(){
 renderHome();$('manage-ready').classList.toggle('selected',manageKind==='ready');$('manage-prep').classList.toggle('selected',manageKind==='prep');
 $('premium-template-card').hidden=manageKind!=='ready';$('premium-prep-card').hidden=manageKind!=='prep';
 const list=$('manage-list');list.replaceChildren();
 const items=products.filter(p=>p.kind===manageKind).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
 $('manage-empty').hidden=items.length>0;
 for(const p of items){
  const row=node('div','manage-item'), info=node('div');
  info.append(node('strong','',p.name));
  const guide=guideFor(p);
  if(guide){info.append(node('small','prep-kind',guide[0]));info.append(node('small','prep-guide',guide[1]))}
  info.append(node('small','',isHaccp(p)?'ХАССП · Чёткая таблица':p.needsReview?(isSpicy(p)&&p.hours===48?'Предложено владельцем: 48 ч · +2…+6 °C · печать до подтверждения заблокирована':(p.hours&&p.storage?'Предложено: '+p.hours+' ч · '+p.storage+' · печать до подтверждения заблокирована':'Требуется подтверждение данных · печать заблокирована')):manageKind==='ready'?('Вес '+p.weight+' г · '+p.hours+' ч · '+p.storage):(p.hours+' ч · '+p.storage)));
  const actions=node('div');const edit=node('button','','Изменить'),del=node('button','delete','Удалить');
  edit.type='button';del.type='button';edit.disabled=cloudPaired||isHaccp(p);del.disabled=cloudPaired;edit.onclick=()=>openEditor(p);
  del.onclick=()=>{if(cloudPaired)return;if(!confirm('Удалить этикетку «'+p.name+'» из базы?'))return;products=products.filter(x=>x.id!==p.id);if(save()){renderManage();if(selected===p.id)selected=null}};
  actions.append(edit,del);row.append(info,actions);list.append(row);
 }
}
function setFormKind(type){
 $('ready-fields').hidden=type!=='ready';$('prep-fields').hidden=type!=='prep';
 $('ready-fields').querySelectorAll('input,textarea').forEach(el=>el.disabled=type!=='ready');
 $('prep-fields').querySelectorAll('input').forEach(el=>el.disabled=type!=='prep');
 // Both manually created ready food and semi-finished products require
 // explicit review of the actual TTK/supplier storage conditions.
 $('approval-area').hidden=false;
}
function renderEditorPhoto(){
 const img=$('edit-photo-preview'),empty=$('edit-photo-empty');
 const ok=!!editorPhoto;
 img.hidden=!ok;empty.hidden=ok;
 if(ok)img.src=editorPhoto;else img.removeAttribute('src');
 $('edit-photo-clear').disabled=!ok;
}
async function chooseEditorPhoto(ev){
 const file=ev.target.files?.[0];ev.target.value='';if(!file)return;
 try{
  editorPhoto=await window.FarukhPrintPhotos.compress(file);
  editorPhotoChanged=true;
  renderEditorPhoto();
 }catch(e){alert('Фото не добавлено: '+e.message)}
}
function openEditor(p,fromPremiumTemplate=false){
 if(isManaged())return;
 if(cloudPaired){alert('Каталог управляется из FARUKH AI. Здесь можно только печатать и скачать резервную копию.');return}
 manualPremium=!!fromPremiumTemplate;
 manualPrepPremium=fromPremiumTemplate==='prep';
 manageKind=p?.kind||(manualPrepPremium?'prep':manualPremium?'ready':manageKind);
 editing=p?.id||null;
 editorPhoto=window.FarukhPrintPhotos?.isPhoto(p?.photo)?p?.photo||'':'';
 editorPhotoChanged=false;
 renderEditorPhoto();
 const type=p?.kind||manageKind;
 setFormKind(type);
 $('ready-category-options').replaceChildren(...window.FarukhPrintCategories.list(products).map(name=>{const option=node('option');option.value=name;return option}));
 $('edit-category').value=p?window.FarukhPrintCategories.category(p):'';
 $('editor-title').textContent=manualPrepPremium?'Эталон 30 × 20 · Вручную':manualPremium?'Эталон 58 × 40 · Вручную':p?'Изменить этикетку':'Новый товар';
 const vals={name:p?.name||'',composition:p?.composition||'',p:p?.p??'',f:p?.f??'',c:p?.c??'',kcal:p?.kcal??'',weight:p?.weight??'',tolerance:p?.tolerance??(manualPremium?'':10),point:p?.point||'',storage:p?.storage??(manualPremium?'':type==='ready'?'+2…+6 °C':''),hours:p?.hours??(manualPremium?'':type==='ready'?12:'')};
 for(const [key,val] of Object.entries(vals))$('edit-'+key).value=val;
 $('edit-approval').checked=!!p&&!p.needsReview;
 $('edit-prep-event').value=p?.prepEvent||'prepared';
 const tip=guideFor(p||{kind:type,name:str($('edit-name').value)});
 $('sanpin-item-guidance').hidden=!tip;
 $('sanpin-item-guidance').textContent=tip?'Для проверки: '+tip[1]:'';
 $('manual-template-preview').hidden=false;
 $('manual-template-preview').querySelector('strong').textContent=type==='prep'?'Предпросмотр · Премиум 30 × 20':'Предпросмотр · Премиум 58 × 40';
 $('editor').showModal();updateManualPreview();setTimeout(()=>$('edit-name').focus(),30);
}
function updateManualPreview(){
 if($('manual-template-preview').hidden||!$('editor').open)return;
 const hint=$('manual-template-preview-hint'),host=$('manual-template-preview-svg');
 const type=manageKind;
 const keys=type==='prep'?['name','storage','hours']:['name','composition','p','f','c','kcal','weight','tolerance','storage','hours'];
 if(keys.some(k=>!str($('edit-'+k).value))){host.replaceChildren();hint.textContent='Заполни название, полный состав, КБЖУ, вес, условия и срок хранения. Никаких примерных сроков не подставляется.';return}
 const p={};for(const key of keys)p[key]=['p','f','c','kcal','weight','tolerance','hours'].includes(key)?Number($('edit-'+key).value):str($('edit-'+key).value);
 try{
  const prep=type==='prep';
  if(prep)p.prepEvent=$('edit-prep-event').value;
  const surface=window.FarukhLabelSVG.surface(prep?240:464,prep?160:320);
  if(prep)window.FarukhPremiumPrep.draw(surface.g,p,Date.now(),{formatDate:formatted});
  else window.FarukhPremiumReady.draw(surface.g,p,Date.now(),{formatDate:formatted});
  host.replaceChildren(window.FarukhLabelSVG.element(surface.c.toSVG()));
  hint.textContent='Предпросмотр с твоими данными. Фактическую дату изготовления выберешь перед печатью; неподтверждённые сроки печатать нельзя.';
 }catch(e){host.replaceChildren();hint.textContent='Предпросмотр: '+e.message}
}
function saveEditor(ev){
 ev.preventDefault();
 if(cloudPaired)return;
 const type=manageKind;
 const hoursText=str($('edit-hours').value);
 const needsReview=!$('edit-approval').checked;
 const fields={name:str($('edit-name').value),kind:type,storage:str($('edit-storage').value),hours:hoursText?Number(hoursText):null,photo:editorPhoto};
 if(type==='prep')fields.photoStyle=editorPhotoChanged?(editorPhoto?'manual':'3d'):(products.find(p=>p.id===editing)?.photoStyle||'3d');
 if(!fields.name||fields.name.length>90||hoursText&&(!Number.isSafeInteger(fields.hours)||fields.hours<1||fields.hours>8760)){
  alert('Укажи название и корректный срок годности, если он известен.');return;
 }
 if(!needsReview&&(!fields.storage||!Number.isSafeInteger(fields.hours)||fields.hours<1)){
  alert('Подтверди условия хранения и срок годности.');return;
 }
 if(type==='ready'){
  fields.category=str($('edit-category').value).slice(0,60);
  fields.composition=str($('edit-composition').value);
  for(const x of ['p','f','c','kcal','weight','tolerance'])fields[x]=Number($('edit-'+x).value);
  if(!fields.composition||['p','f','c','kcal','weight','tolerance'].some(x=>$('edit-'+x).value===''||!Number.isFinite(fields[x]))||fields.weight<=0||fields.tolerance<0){
   alert('Заполни состав, вес и все значения КБЖУ. Неизвестные цифры нельзя заменять нулями.');return;
  }
 }else{fields.point=str($('edit-point').value)}
 fields.needsReview=needsReview;
 if(type==='prep')fields.prepEvent=$('edit-prep-event').value;
 if(type==='ready'&&manualPremium&&!editing)fields.labelStyle='premium-ready-58x40';
 if(type==='prep'&&manualPrepPremium&&!editing)fields.labelStyle='premium-prep-30x20';
 if(!editing&&products.some(p=>p.kind===type&&p.name.toLocaleLowerCase('ru')===fields.name.toLocaleLowerCase('ru'))){
  alert('Этикетка с таким названием уже есть в выбранной категории.');return;
 }
 if(editing){const at=products.findIndex(p=>p.id===editing);if(at>=0)products[at]={...products[at],...fields}}
 else products.push({id:makeId(),...fields});
 if(save()){
  $('editor').close();
  if(editFromCatalog){
    selected=editFromCatalog;editFromCatalog=null;
    show('catalog');renderCatalog();
  }else renderManage();
}
}
const rect=(g,x,y,w,h,line=2)=>{g.lineWidth=line;g.strokeRect(x+.5,y+.5,w-1,h-1)};
const hLine=(g,y,x1,x2)=>{g.beginPath();g.moveTo(x1,y+.5);g.lineTo(x2,y+.5);g.stroke()};
const vLine=(g,x,y1,y2)=>{g.beginPath();g.moveTo(x+.5,y1);g.lineTo(x+.5,y2);g.stroke()};
function fit(g,value,max,size=15,min=8,weight='700'){
 let fontSize=size;
 for(;fontSize>=min;fontSize-=.5){g.font=weight+' '+fontSize+'px Arial,sans-serif';if(g.measureText(value).width<=max)break}
 g.font=weight+' '+Math.max(min,fontSize)+'px Arial,sans-serif';
 return g.measureText(value).width<=max;
}
function write(g,value,x,y,opts={}){
 const content=String(value??'');
 if(!fit(g,content,opts.width??400,opts.size??14,opts.min??8,opts.weight??'700'))throw Error('Надпись «'+content.slice(0,25)+'…» слишком длинная для этикетки.');
 g.textAlign=opts.align||'left';g.fillText(content,x,y);
}
function wrap(g,text,maxWidth,maxLines,size,weight='400'){
 g.font=weight+' '+size+'px Arial,sans-serif';
 const words=String(text).split(/\s+/).filter(Boolean);const out=[];let row='';
 for(const word of words){
  const next=row?row+' '+word:word;
  if(g.measureText(next).width<=maxWidth)row=next;
  else{
   if(row)out.push(row);
   row='';
   for(const letter of word){if(row&&g.measureText(row+letter).width>maxWidth){out.push(row);row=letter}else row+=letter}
  }
 }
 if(row)out.push(row);
 if(out.length>maxLines)throw Error('Состав не помещается на этикетку 58 × 40. Сократи текст или название ингредиентов.');
 return out;
}
function canvasBase(w,h,scale=1,vector=false){
 if(vector){
  if(!window.FarukhLabelSVG)throw Error('SVG-движок этикеток не загрузился.');
  const {c,g}=window.FarukhLabelSVG.surface(w,h);
  g.fillStyle='#fff';g.fillRect(0,0,w,h);g.fillStyle='#000';g.strokeStyle='#000';g.textBaseline='middle';
  return {c,g};
 }
 // Native V3 BT works at 203 dpi; its bitmap has fixed physical dimensions.
 const c=document.createElement('canvas');c.width=w*scale;c.height=h*scale;
 const g=c.getContext('2d',{willReadFrequently:scale===1});
 if(!g)throw Error('Canvas недоступен');
 if(scale!==1)g.scale(scale,scale);
 g.fillStyle='#fff';g.fillRect(0,0,w,h);g.fillStyle='#000';g.strokeStyle='#000';g.textBaseline='middle';
 return {c,g};
}
// Crisp monochrome layout v3. Physical raster: 58×40 mm = 464×320 dots.
// The saved TTK, production times, nutritional values and shelf-life are the
// only data used. Decorative example values are NEVER inserted into labels.
// Approved 58×40 premium image: second concept + icon set from first.
// Both FARUKH PRINT and FARUKH AI use the same vector geometry.
function drawReady(p,epoch,scale=1,vector=false){
 if(!window.FarukhPremiumReady?.draw)return drawReadyPrevious(p,epoch,scale,vector);
 const {c,g}=canvasBase(464,320,scale,vector);
 window.FarukhPremiumReady.draw(g,p,epoch,{formatDate:formatted});
 return c;
}
function drawReadyPrevious(p,epoch,scale=1,vector=false){
 const {c,g}=canvasBase(464,320,scale,vector);
 // Single strong border consumes less ink and stays legible at 203 dpi.
 rect(g,6,6,452,308,2);
 write(g,'СУШИ БЕРИ',18,26,{size:19,min:16,weight:'900',width:240});
 write(g,'ГОТОВАЯ ПРОДУКЦИЯ',444,26,{size:11.5,min:9,weight:'800',align:'right',width:190});
 g.lineWidth=2;hLine(g,42,14,450);

 const title=str(p.name).toUpperCase();
 if(fit(g,title,419,25,16,'900')){
  write(g,title,232,70,{size:25,min:16,weight:'900',align:'center',width:422});
 }else{
  const lines=wrap(g,title,420,2,18,'900');
  lines.forEach((line,i)=>write(g,line,232,59+i*21,{size:18,min:13,weight:'900',align:'center',width:420}));
 }
 g.lineWidth=1.5;hLine(g,97,14,450);

 // Ingredients remain printable even when a recipe contains several words.
 // Never silently ellipsize or hide ingredients if the text doesn't fit.
 const full='Состав: '+str(p.composition);
 let lines,sz=11.8,step=13.1;
 try{lines=wrap(g,full,425,4,sz)}
 catch{sz=10.3;step=11.5;lines=wrap(g,full,425,5,sz)}
 g.font='600 '+sz+'px Arial,sans-serif';g.textAlign='left';
 lines.forEach((line,i)=>g.fillText(line,19,113+i*step));

 // KBZhU is a symmetrical fixed grid; no text overlaps the lines.
 rect(g,14,176,436,54,1.5);
 hLine(g,196,14,450);
 write(g,'КБЖУ НА 100 Г',232,185,{size:12.2,min:11,weight:'900',align:'center',width:412});
 const nutritional=[['Б',nv(p.p)],['Ж',nv(p.f)],['У',nv(p.c)],['ККАЛ',nv(p.kcal)]];
 const cellW=109;
 for(let i=0;i<4;i++){
  const x=14+cellW*i;
  if(i)g.lineWidth=1.2,vLine(g,x,196,230);
  const mid=x+cellW/2;
  write(g,nutritional[i][0],mid,203,{size:10.5,min:9.5,weight:'800',align:'center',width:cellW-8});
  write(g,nutritional[i][1],mid,218,{size:16,min:12,weight:'900',align:'center',width:cellW-8});
 }

 // Dates are explicit, both from the actual order/production timestamp.
 g.lineWidth=1.3;hLine(g,236,14,450);
 vLine(g,232,236,276);
 write(g,'ИЗГОТОВЛЕНО',22,246,{size:10.6,min:9.2,weight:'700',width:185});
 write(g,formatted(epoch),22,264,{size:15,min:11,weight:'900',width:195});
 write(g,'ГОДЕН ДО',243,246,{size:10.6,min:9.2,weight:'700',width:187});
 write(g,formatted(epoch+Number(p.hours)*3600000),243,264,{size:15,min:11,weight:'900',width:198});

 hLine(g,278,14,450);
 vLine(g,164,278,308);vLine(g,313,278,308);
 write(g,'ВЕС НЕТТО',20,285,{size:9.2,weight:'700',width:139});
 write(g,p.weight+' г ±'+p.tolerance+' г',20,299,{size:14.4,min:10,weight:'900',width:138});
 write(g,'ХРАНИТЬ',175,285,{size:9.2,weight:'700',width:130});
 write(g,p.storage,175,299,{size:13.7,min:10,weight:'900',width:129});
 write(g,'СРОК',324,285,{size:9.2,weight:'700',width:119});
 write(g,p.hours+' ч',324,299,{size:14.4,min:10,weight:'900',width:119});
 return c;
}

// Same sharp typography, simplified for a dense 240×160 monochrome raster.
// The previous 30-mm layout is retained for known V3 BT / older APK compatibility.
function drawPrep(p,epoch,point,scale=1,vector=false){
 if(window.FarukhPremiumPrep?.draw){
  const {c,g}=canvasBase(240,160,scale,vector);
  window.FarukhPremiumPrep.draw(g,p,epoch,{formatDate:formatted});
  return c;
 }
 return drawPrepPrevious(p,epoch,point,scale,vector);
}
// Emergency fallback for an outdated APK that has the old template cached.
function drawPrepPrevious(p,epoch,point,scale=1,vector=false){
 const {c,g}=canvasBase(240,160,scale,vector);
 rect(g,4,4,232,152,2);
 write(g,'FARUKH PRINT',13,16,{size:11,min:9,weight:'900',width:145});
 const pointName=point&&fit(g,str(point).toUpperCase(),77,10,8,'800')?str(point).toUpperCase():'П/Ф';
 write(g,pointName,227,16,{size:10,min:8,weight:'800',align:'right',width:77});
 g.lineWidth=1.5;hLine(g,29,11,229);
 const name=str(p.name).toUpperCase();
 if(fit(g,name,210,22.5,14.5,'900')){
  write(g,name,120,51,{size:22.5,min:14.5,weight:'900',align:'center',width:210});
 }else{
  const lines=wrap(g,name,207,2,15,'900');
  lines.forEach((line,i)=>write(g,line,120,44+i*20,{size:15,min:10.5,weight:'900',align:'center',width:210}));
 }
 g.lineWidth=1.8;hLine(g,77,11,229);
 write(g,'Изгот.:',13,94,{size:11.1,min:10,weight:'800',width:80});
 write(g,formatted(epoch),228,94,{size:12.5,min:10,weight:'900',align:'right',width:129});
 g.lineWidth=1;hLine(g,106,11,229);
 write(g,'Годен до:',13,120,{size:11.1,min:10,weight:'800',width:83});
 write(g,formatted(epoch+Number(p.hours)*3600000),228,120,{size:12.5,min:10,weight:'900',align:'right',width:129});
 g.lineWidth=1.5;hLine(g,134,11,229);
 write(g,'Хранить:',13,146,{size:10.5,min:9.3,weight:'800',width:82});
 write(g,p.storage,228,146,{size:13,min:10,weight:'900',align:'right',width:129});
 return c;
}

function haccpKey(p){return 'farukh-print:haccp-batch:v1:'+encodeURIComponent(workerLoggedIn?.point||'local')+':'+p.id}
function haccpSaved(p){try{return JSON.parse(localStorage.getItem(haccpKey(p))||'null')}catch{return null}}
function haccpBatch(p){return haccpDraft?.id===p.id?haccpDraft.batch:haccpSaved(p)}
function prepareHaccp(p){
 const t=HACCP.getTemplate(p);if(t.mode==='place')return;
 let b=haccpBatch(p);
 if(!b){const start=Date.now(),limit=new Date($('haccp-limit').value).getTime();b={start,end:HACCP.deadline(t,start,limit),limit:Number.isFinite(limit)?limit:null};}
 if(!Number.isFinite(b.start)||!Number.isFinite(b.end)||b.end<=Date.now())throw Error('Срок этой порции истёк. Приготовь новую и нажми «Новая порция / заполнение».');
 // Persist before dispatch: cancelled or failed printing must not extend dates.
 localStorage.setItem(haccpKey(p),JSON.stringify(b));haccpDraft=null;
 $('printed-at').value=new Date(b.start-new Date(b.start).getTimezoneOffset()*60000).toISOString().slice(0,16);
}
function haccpControls(p){
 const yes=isHaccp(p),box=$('haccp-controls');if(!box)return;
 box.hidden=!yes;$('printed-at').parentElement.hidden=yes;
 if(!yes)return;
 const t=HACCP.getTemplate(p),b=haccpBatch(p),limited=['shift','replacement'].includes(t.mode);
 $('haccp-new').hidden=t.mode==='place';
 $('haccp-limit-field').hidden=!limited;
 $('haccp-limit-title').textContent=t.mode==='shift'?'Окончание текущей смены':'Заводской срок годности (с упаковки)';
 $('haccp-limit').disabled=!!b;
 if(b?.limit)$('haccp-limit').value=new Date(b.limit-new Date(b.limit).getTimezoneOffset()*60000).toISOString().slice(0,16);
 $('haccp-help').textContent=t.mode==='place'?'Маркировка места хранения.':t.mode==='stock'?'Отдельный запас раствора, 21 день. Печатай при приготовлении. Концентрация и режим обработки — по инструкции средства.':t.mode==='shift'?'Отдельная порция для замачивания. Укажи конец смены. Режим обработки — по инструкции средства.':'30 дней — срок замены, заданный владельцем, не подтверждённый срок производителя. Укажи заводской срок; если после вскрытия он короче — укажи более раннюю дату. DECO S9: название сохранено со слов владельца.';
}
function drawHaccp(p,scale,vector=false){
 const {c,g}=canvasBase(464,320,scale,vector),t=HACCP.getTemplate(p);
 const rows=HACCP.rows(t,haccpBatch(p),formatted);
 rect(g,7,7,450,306);const heights=rows.map((_,i)=>i===0?58:i===1?48:(306-106)/(rows.length-2));
 let y=7;
 rows.forEach((s,i)=>{const h=heights[i];if(i)hLine(g,y,7,457);write(g,s,232,y+h/2,{width:432,size:i===0?34:i===1?23:19,min:12,align:'center',weight:i<2?'900':'600'});y+=h;});
 return c;
}
function makePreview(scale=1,vector=false){
 const p=current();if(!p){previewError='';return null}
 if(isHaccp(p))return drawHaccp(p,scale,vector);
 if(p.needsReview||!str(p.storage)||!Number.isInteger(p.hours)||p.hours<=0){
   throw Error('Этот продукт пока не готов к печати. Укажи срок и условия хранения по ТТК или маркировке изготовителя и подтверди их.');
 }
 const when=new Date($('printed-at').value).getTime();
 if(!Number.isFinite(when))throw Error('Укажи дату и время изготовления.');
 return kind==='ready'?drawReady(p,when,scale,vector):drawPrep(p,when,str($('point-name').value)||p.point,scale,vector);
}
function makeSVG(){
 const surface=makePreview(1,true);
 return surface?.toSVG()||null;
}
function updatePreview(){
 const p=current();
 const dateField=$('printed-at').parentElement;
 if(dateField&&dateField.firstChild?.nodeType===Node.TEXT_NODE){
  dateField.firstChild.textContent=(p?.kind==='prep'&&p.prepEvent==='thawed'?'Дата и время разморозки':p?.kind==='prep'&&p.prepEvent==='opened'?'Дата и время вскрытия':'Дата и время изготовления');
 }
 haccpControls(p);$('no-preview').hidden=!!p;$('preview-canvas').hidden=true;
 const vectorHost=$('preview-svg');if(vectorHost)vectorHost.hidden=true;
 $('print-now').disabled=!p;
 $('fix-label').hidden=!p||!p.needsReview||isManaged();
 if(!p){status('Выбери товар из списка.');return}
 try{
  if(window.FarukhLabelSVG&&vectorHost){
   // True resolution-independent vector SVG; no bitmap scaling in the preview.
   vectorHost.replaceChildren(window.FarukhLabelSVG.element(makeSVG()));
   vectorHost.hidden=false;
  }else{
   const canvas=makePreview(3);const prev=$('preview-canvas');
   prev.width=canvas.width;prev.height=canvas.height;
   const pg=prev.getContext('2d');pg.clearRect(0,0,prev.width,prev.height);
   pg.drawImage(canvas,0,0);prev.hidden=false;
  }
  previewError='';$('no-preview').textContent='Выбери товар для просмотра';
  status(native?'Готово. Bluetooth-печать из приложения.':'Готово. Браузер откроет системную печать.');
 }catch(e){
  previewError=e.message;$('preview-canvas').hidden=true;
  if(vectorHost){vectorHost.hidden=true;vectorHost.replaceChildren()}
  $('no-preview').hidden=false;
  $('no-preview').textContent='Срок и условия хранения не подтверждены';
  status('Проверь данные: '+e.message,true);$('print-now').disabled=true
 }
}
function tspl(canvas,copies,{legacy30=false}={}){
 const w=canvas.width,h=canvas.height;
 if(!((w===464&&h===320)||(w===240&&h===160)))throw Error('Неподдерживаемый формат этикетки.');
 const info=canvas.getContext('2d').getImageData(0,0,w,h).data;
 if(legacy30&&!(w===240&&h===160))throw Error('Совместимость допустима только для этикетки 30 × 20 мм.');
 const rowBytes=legacy30?31:w/8;
 const bitmap=new Uint8Array(rowBytes*h);bitmap.fill(255);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;
  if((info[i]*299+info[i+1]*587+info[i+2]*114)/1000<164&&info[i+3]>80)bitmap[y*rowBytes+(x>>3)]&=~(128>>(x&7));
 }
 const mm=w===464?'58 mm,40 mm':(legacy30?'31 mm,20 mm':'30 mm,20 mm');
 const prefix=new TextEncoder().encode('\r\nSIZE '+mm+'\r\nGAP 2 mm,0 mm\r\nSPEED 3\r\nDENSITY 8\r\nDIRECTION 0,0\r\nREFERENCE 0,0\r\nCLS\r\nBITMAP 0,0,'+rowBytes+','+h+',0,');
 const suffix=new TextEncoder().encode('\r\nPRINT 1,'+copies+'\r\n');
 const result=new Uint8Array(prefix.length+bitmap.length+suffix.length);
 result.set(prefix);result.set(bitmap,prefix.length);result.set(suffix,prefix.length+bitmap.length);return result;
}
function toBase64(bytes){
 let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);
}
function job(){
 const p=current();if(!p)throw Error('Выбери товар.');
 const copies=Number($('copies').value);
 if(!Number.isInteger(copies)||copies<1||copies>20)throw Error('Количество — от 1 до 20.');
 const canvas=makePreview();
 const svg=window.FarukhLabelSVG?makeSVG():null;
 return {canvas,svg,copies};
}
function browserPrint({canvas,svg,copies}){
 const paper=$('print-paper');paper.replaceChildren();
 const width=canvas.width===464?58:30,height=canvas.height===320?40:20;
 const printStyle=$('print-size-style')||node('style');printStyle.id='print-size-style';
 printStyle.textContent='@media print{@page{size:'+width+'mm '+height+'mm;margin:0}.paper-only{width:'+width+'mm!important}.paper-only .print-label,.paper-only svg,.paper-only img{width:'+width+'mm!important;height:'+height+'mm!important}}';
 if(!printStyle.parentElement)document.head.append(printStyle);
 if(svg&&window.FarukhLabelSVG){
  // Browser print and PDF keep paths and text as actual SVG vectors.
  for(let i=0;i<copies;i++){
   const label=node('div','print-label');
   label.append(window.FarukhLabelSVG.element(svg));
   paper.append(label);
  }
 }else{
  const highRes=makePreview(3),url=highRes.toDataURL('image/png');
  for(let i=0;i<copies;i++){const img=node('img');img.src=url;img.alt='Этикетка';paper.append(img)}
 }
 window.print();
}
async function doPrint(forceSystem=false){
 if(busy)return;
 let value;try{
  if(localStorage.getItem('farukh-print:staff-managed:v1')==='1'){
   const point=window.FARUKH_PRINT_STAFF_API?.point();
   if(!point)throw Error('Сначала войди под своим логином в разделе «Доступ сотрудников».');
   $('point-name').value=point;
  }
  if(isHaccp(current())){prepareHaccp(current());updatePreview();}
  value=job();
 }catch(e){status(e.message,true);return}
 busy=true;$('print-now').disabled=true;
 try{
  if(localStorage.getItem('farukh-print:staff-managed:v1')==='1'){
   const api=window.FARUKH_PRINT_STAFF_API;
   if(!api)throw Error('Проверка сотрудников ещё не загрузилась. Закрой и открой приложение.');
   status('Проверяю права сотрудника и утверждённую этикетку…');
   const authorized=await api.authorize({...value,product:current(),dateValue:$('printed-at').value});
   activePrintEvent=authorized.eventId||null;
  }
  if(!native||forceSystem){
   browserPrint(value);busy=false;$('print-now').disabled=false;
   if(activePrintEvent)void window.FARUKH_PRINT_STAFF_API?.reportPrint(activePrintEvent,'system','Открыт системный диалог, не факт печати.');
   activePrintEvent=null;saveLast(current(),value.copies);
   status('Открыт системный диалог печати. Физическая печать не подтверждена.');return;
  }
  // V3 BT receives the SAME SVG rasterized only at the physical 203-dpi grid.
  if(value.svg&&window.FarukhLabelSVG?.rasterize){
   value.canvas=await window.FarukhLabelSVG.rasterize(value.svg,value.canvas.width,value.canvas.height);
  }
  const legacy=legacyNative30Transport&&value.canvas.width===240;
  pendingNativePrint={...value,legacy,eventId:activePrintEvent,product:current()};activePrintEvent=null;
  status(legacy?'Печатаю 30-мм макет в режиме совместимости старого Android-приложения…':'Передаю этикетку на Bluetooth-принтер V3 BT…');
  sendNative({type:'print',tspl:toBase64(tspl(value.canvas,value.copies,{legacy30:legacy}))});
 }catch(e){
  const id=activePrintEvent||pendingNativePrint?.eventId;
  if(id)void window.FARUKH_PRINT_STAFF_API?.reportPrint(id,'failed',e.message);
  activePrintEvent=null;busy=false;pendingNativePrint=null;$('print-now').disabled=false;
  status('Печать не выполнена: '+e.message,true);
 }
}
function choosePrinter(){
 if(!native){status('Прямое подключение доступно в Android-приложении FARUKH PRINT. В браузере используй системную печать.');return}
 if(busy)return;busy=true;pendingNativePrint=null;status('Выбери Printer001 в списке Bluetooth-устройств…');
 try{sendNative({type:'select'})}catch(e){busy=false;status('Ошибка: '+e.message,true)}
}
if(native){
 window.FarukhPrinter.onmessage=event=>{
  let answer;
  try{answer=JSON.parse(event.data)}catch{answer={ok:false,message:'Не удалось прочитать ответ Android.'}}
  // Retry ONLY after native rejected the TSPL header, before any Bluetooth
  // transmission took place. Never retry failures that may have printed.
  const oldValidator=answer.ok===false&&/размер должен быть\s*58\s*[×x]\s*40\s*или\s*31\s*[×x]\s*20/i.test(String(answer.message||''));
  if(oldValidator&&pendingNativePrint?.canvas.width===240&&!pendingNativePrint.legacy){
   const job=pendingNativePrint;
   try{
    const bytes=tspl(job.canvas,job.copies,{legacy30:true});
    legacyNative30Transport=true;
    pendingNativePrint={...job,legacy:true};
    status('Обнаружена старая версия FARUKH PRINT. Повторяю через совместимый протокол 31 мм; изображение остаётся шириной 30 мм. Проверь первую наклейку.');
    sendNative({type:'print',tspl:toBase64(bytes)});
    return;
   }catch(e){answer={ok:false,message:'Ошибка режима совместимости: '+e.message}}
  }
  busy=false;
  if(pendingNativePrint?.eventId)void window.FARUKH_PRINT_STAFF_API?.reportPrint(pendingNativePrint.eventId,answer.ok?'sent':'failed',answer.message||'');
  if(answer.ok&&pendingNativePrint?.product)saveLast(pendingNativePrint.product,pendingNativePrint.copies);
  if(answer.ok&&pendingNativePrint?.legacy){
   status(String(answer.message||'Этикетка отправлена.')+' Режим совместимости со старым APK: макет 30 мм в транспортном поле 31 мм. Проверь выравнивание первой наклейки.');
  }else status(answer.message,answer.ok===false);
  pendingNativePrint=null;
  $('print-now').disabled=!current()||!!previewError;
 };
}
function exportDB(){
 const output={format:'farukh-print-catalog-v1',createdAt:new Date().toISOString(),products};
 const blob=new Blob([JSON.stringify(output,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);const link=node('a');link.href=url;link.download='farukh-print-backup-'+new Date().toISOString().slice(0,10)+'.json';
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
async function importDB(ev){
 const file=ev.target.files?.[0];ev.target.value='';if(!file)return;
 if(file.size>2*1024*1024){alert('Файл базы слишком большой (лимит 2 МБ).');return}
 try{
  const payload=JSON.parse(await file.text());
  if(payload.format!=='farukh-print-catalog-v1'||!Array.isArray(payload.products)||payload.products.length>1000)throw Error('Неверный формат базы FARUKH PRINT.');
  const items=[];const used=new Set();
  for(const p of payload.products){
   if(!p||!['ready','prep'].includes(p.kind)||typeof p.name!=='string'||!str(p.name))throw Error('Не все товары имеют названия.');
   if(p.template){const t=HACCP?.getTemplate(p);if(!t)throw Error('Неизвестная этикетка ХАССП');items.push({...t,id:p.id||makeId()});continue;}
   if(!p.needsReview&&(!str(p.storage)||!Number.isSafeInteger(p.hours)||p.hours<1||p.hours>8760))throw Error('Не все действующие этикетки имеют подтверждённый срок и хранение.');
   if(p.photo&&!window.FarukhPrintPhotos?.isPhoto(p.photo))throw Error('Некорректный формат фотографии.');
   if(p.kind==='ready'&&(!str(p.composition)||!['p','f','c','kcal','weight','tolerance'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k]))))throw Error('Ошибка состава, веса или КБЖУ.');
   const key=p.kind+'|'+p.name.toLocaleLowerCase('ru');if(used.has(key))throw Error('В резервной копии есть дублирующиеся товары.');used.add(key);
   items.push({...p,id:makeId(),name:p.name.slice(0,90),storage:p.storage.slice(0,60),composition:str(p.composition).slice(0,600),point:str(p.point).slice(0,40)});
  }
  if(cloudPaired){alert('Отключи облачную синхронизацию, прежде чем импортировать локальную базу.');return}
  if(!confirm('Заменить текущую базу из '+products.length+' товаров на '+items.length+' товаров из резервной копии?'))return;
  const old=products;products=items;if(!save()){products=old;return}
  selected=null;renderManage();alert('Готово! Импортировано '+items.length+' товаров.');
 }catch(e){alert('Не удалось загрузить базу: '+e.message)}
}
window.FARUKH_PRINT_SYNC_API={
 get:()=>structuredClone(products),
 setPaired:yes=>{
  cloudPaired=!!yes;
  if($('add-item'))$('add-item').disabled=cloudPaired;
  $('use-premium-template').disabled=cloudPaired||isManaged();
  $('home-premium-template').hidden=cloudPaired||isManaged();
  $('use-premium-prep').disabled=cloudPaired||isManaged();
  $('home-premium-prep').hidden=cloudPaired||isManaged();
  if($('load-starter-prep'))$('load-starter-prep').disabled=cloudPaired;
  if($('import-db'))$('import-db').disabled=cloudPaired;
  if(!$('manage').hidden)renderManage();
 },
 replace:newProducts=>{
  if(!Array.isArray(newProducts)||newProducts.length>1000||newProducts.some(p=>!p||!['ready','prep'].includes(p.kind)||typeof p.name!=='string'||(p.photo&&!window.FarukhPrintPhotos?.isPhoto(p.photo))))throw Error('Получена повреждённая облачная база.');
  const old=products;products=structuredClone(newProducts);
  if(!save()){products=old;throw Error('Невозможно сохранить базу на Android.')}
  renderHome();
  if(!$('catalog').hidden)renderCatalog();
  if(!$('manage').hidden)renderManage();
 }
};
function boot(){
 import('./broth-photo.js?v=1').then(m=>{bundledBrothPhoto=m.photo;if(!$('catalog').hidden)renderCatalog();if(isManaged()||cloudPaired)return;const marker='farukh-print:import:'+m.version;if(localStorage.getItem(marker))return;products=m.merge(products);if(save())localStorage.setItem(marker,'1');renderHome();if(!$('catalog').hidden)renderCatalog();}).catch(e=>status('Фото: '+e.message,true));
 import('./supplemental-photos.js?v=1').then(m=>{bundledPrepPhotos=m;if(!$('catalog').hidden)renderCatalog();if(isManaged()||cloudPaired)return;const marker='farukh-print:import:'+m.version;if(localStorage.getItem(marker))return;products=m.merge(products);if(save())localStorage.setItem(marker,'1');renderHome();if(!$('catalog').hidden)renderCatalog();}).catch(e=>status('Фото: '+e.message,true));
 import('./haccp-catalog.js?v=2').then(m=>{HACCP=m;if(!isManaged()&&!cloudPaired&&!localStorage.getItem('farukh-print:import:'+m.version)){products=m.merge(products);if(save())localStorage.setItem('farukh-print:import:'+m.version,'1');}renderHome();if(!$('catalog').hidden)renderCatalog();}).catch(e=>status('ХАССП: '+e.message,true));
 importReadyCatalog();
 // Add once for standalone owner installations; paired/staff clients receive
 // the same version directly from the protected FARUKH AI cloud catalogue.
 load();
 void import('./japanese-prep-catalog.js?v=1').then(catalog=>{
  if(isManaged()||cloudPaired)return;
  const marker='farukh-print:import:'+catalog.version;
  if(localStorage.getItem(marker))return;
  const before=products,updated=catalog.merge(products);
  if(updated.some((p,i)=>p!==before[i])&&updated.length<=1000){
   products=updated;
   if(!save()){products=before;return}
  }
  localStorage.setItem(marker,'1');
  renderHome();if(!$('catalog').hidden)renderCatalog();if(!$('manage').hidden)renderManage();
 }).catch(e=>status('Предложения сроков для полуфабрикатов: '+e.message,true));
 renderHome();$('printed-at').value=nowLocal();
 renderWorker();
 window.addEventListener('farukh-print-staff-changed',e=>updateWorkerSession(e.detail?.staff||null));
 window.addEventListener('farukh-print-sync-status',e=>{
   const data=e.detail||{};
   $('worker-sync-status').textContent=data.message||'Каталог: ожидание связи';
 });
 $('worker-fav-filter').onclick=()=>{favoritesOnly=!favoritesOnly;renderCatalog()};
 $('worker-repeat').onclick=()=>void repeatLast();
 $('worker-ready-tab').onclick=()=>openCatalog('ready');
 $('worker-prep-tab').onclick=()=>openCatalog('prep');
 $('worker-refresh').onclick=()=>{
  const api=window.FARUKH_PRINT_DEVICE_SYNC;
  if(!api){$('worker-sync-status').textContent='Обновление недоступно: проверь подключение устройства';return}
  if(!api.state().connected){
   $('worker-sync-status').textContent='Нет подключения к управляющему центру. Попроси владельца привязать устройство.';
   return;
  }
  $('worker-sync-status').textContent='Загружаю товары из FARUKH AI…';
  void api.refresh();
 };
 $('worker-close-preview').onclick=closeWorkerPreview;
 $('worker-preview-backdrop').onclick=closeWorkerPreview;
 $('choose-ready').onclick=()=>openCatalog('ready');$('choose-prep').onclick=()=>openCatalog('prep');
 $('manage-from-home').onclick=()=>openManage('ready');$('open-settings').onclick=()=>openManage('ready');
 $('go-home').onclick=()=>{show('home');renderHome()};
 $('catalog-back').onclick=()=>{show('home');renderHome()};$('manage-back').onclick=()=>{show('home');renderHome()};
 $('catalog-search').addEventListener('input',renderCatalog);
 $('printed-at').addEventListener('input',updatePreview);
 $('haccp-new').onclick=()=>{const p=current();if(!isHaccp(p))return;if(!confirm('Начать новую порцию для этой ёмкости? Нажимай только после приготовления или заполнения.'))return;haccpDraft={id:p.id,batch:null};$('haccp-limit').value='';updatePreview();};
 $('haccp-limit').addEventListener('input',updatePreview);
 $('point-name').addEventListener('input',updatePreview);
 $('manage-ready').onclick=()=>openManage('ready');$('manage-prep').onclick=()=>openManage('prep');
 $('load-starter-prep').onclick=async()=>{
  if(isManaged()||cloudPaired){alert('Каталог сотрудников управляется только из FARUKH AI.');return}
  try{
   const catalog=await import('./japanese-prep-catalog.js?v=1');
   const next=catalog.merge(products),added=next.length-products.length;
   if(!next.some((p,i)=>p!==products[i])){alert('Все 36 заготовок уже есть. Проверь сроки в карточках.');return}
   if(!confirm('Добавить '+added+' новых заготовок и заполнить пустые поля предложенным ВНУТРЕННИМ сроком 12 ч? Это НЕ норма СанПиН. Новые сроки требуют подтверждения ТТК/маркировкой и до него печать заблокирована.'))return;
   const old=products;products=next;
   if(save()){openManage('prep');alert('Добавлено '+added+' полуфабрикатов. Предложения заполнены, но печать до подтверждения недоступна.')}else products=old;
  }catch(e){alert('Не удалось обновить базу: '+e.message)}
 };
 $('add-item').onclick=()=>openEditor(null);
 const openPremiumTemplate=()=>{
  if(isManaged()||cloudPaired){alert('На подключённом устройстве новые товары создаются в управляющем центре FARUKH AI.');return}
  manageKind='ready';openManage('ready');openEditor(null,true);
 };
 $('use-premium-template').onclick=openPremiumTemplate;
 $('home-premium-template').onclick=openPremiumTemplate;
 const openPremiumPrep=()=>{
  if(isManaged()||cloudPaired){alert('На подключённом устройстве новые позиции создаются только владельцем в FARUKH AI.');return}
  openManage('prep');openEditor(null,'prep');
 };
 $('use-premium-prep').onclick=openPremiumPrep;
 $('home-premium-prep').onclick=openPremiumPrep;
 let manualPreviewTimer;
 $('editor-form').addEventListener('input',()=>{clearTimeout(manualPreviewTimer);manualPreviewTimer=setTimeout(updateManualPreview,200)});
 $('editor-form').addEventListener('submit',saveEditor);
 $('edit-photo-file').addEventListener('change',chooseEditorPhoto);
 $('edit-photo-pick').onclick=()=>$('edit-photo-file').click();
 $('edit-photo-clear').onclick=()=>{editorPhoto='';editorPhotoChanged=true;renderEditorPhoto()};
 $('cancel-editor').onclick=()=>{editFromCatalog=null;$('editor').close()};
 $('close-editor').onclick=()=>{editFromCatalog=null;$('editor').close()};
 $('editor').addEventListener('cancel',()=>{editFromCatalog=null});
 $('fix-label').onclick=()=>{
   const p=current();if(!p)return;
   editFromCatalog=p.id;manageKind=p.kind;openEditor(p);
 };
 $('print-now').onclick=()=>doPrint(false);$('print-system').onclick=()=>doPrint(true);
 $('select-printer').onclick=choosePrinter;
 $('export-db').onclick=exportDB;$('import-db').onclick=()=>$('import-file').click();
 $('import-file').addEventListener('change',importDB);
 window.addEventListener('afterprint',()=>$('print-paper').replaceChildren());
 $('preview-canvas').hidden=true;$('no-preview').hidden=false;$('print-now').disabled=true;
 if(!native){$('select-printer').textContent='Android Bluetooth';}
 const requested=new URLSearchParams(location.search).get('manage');
 if(['ready','prep'].includes(requested))openManage(requested);
 window.addEventListener('storage',ev=>{
  if(ev.key!==KEY)return;
  // Same-origin FARUKH AI center may have changed this database in another tab.
  const focused=document.activeElement?.closest?.('#editor');
  if(focused||$('editor').open)return;
  const saved=localStorage.getItem(KEY);
  try{const newList=JSON.parse(saved||'[]');if(Array.isArray(newList))products=newList.filter(x=>x&&['ready','prep'].includes(x.kind)&&typeof x.name==='string').slice(0,1000)}catch{return}
  renderHome();
  if(!$('catalog').hidden)renderCatalog();
  if(!$('manage').hidden)renderManage();
 });
}
function importReadyCatalog(){
// One-time additive import for standalone devices. Managed devices receive the
// same import through their authenticated cloud catalog, never a local override.
import('./ready-catalog.js?v=2').then(catalog=>{
 const marker='farukh-print:import:'+catalog.version;
 if(isManaged()||cloudPaired||localStorage.getItem(marker))return;
 const previous=products;
 products=catalog.merge(products,!!localStorage.getItem('farukh-print:import:'+catalog.previousVersion));
 if(!save()){products=previous;return}
 localStorage.setItem(marker,'1');
 renderHome();
 if(!$('catalog').hidden)renderCatalog();
 if(!$('manage').hidden)renderManage();
}).then(importCatalogPhotos).catch(e=>status('Не удалось загрузить роллы: '+e.message,true));
}
async function importCatalogPhotos(){
 if(isManaged()||cloudPaired)return;
 const catalog=await import('./catalog-photos.js?v=1');
 const marker='farukh-print:import:'+catalog.version;
 if(isManaged()||cloudPaired||localStorage.getItem(marker))return;
 const previous=products;
 products=catalog.merge(products);
 if(!save()){products=previous;return}
 localStorage.setItem(marker,'1');
 if(!$('catalog').hidden)renderCatalog();
 if(!$('manage').hidden)renderManage();
}
boot();
})();
