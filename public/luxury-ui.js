/* FARRUH AI · TTK Premium PRO, approved reference layout.
   Real data only: no invented recipe counts, calories, dates or photography.
   Existing document generator and device storage remain authoritative. */
import {categoryPhotos} from '/recipe-catalog.js?v=2';
import {showProductPhoto,preparePhoto} from '/product-photo.js';
const PROJECT_KEY='farruh-ai-project-catalog-v1';
const FILTER_KEY='farruh-ai-ttk-project-filter-v2';
const svgPaths={
 chef:'<path d="M8 18v-5a5 5 0 0 1-1-9 5 5 0 0 1 6 1 5 5 0 0 1 7 8v5zM8 18h12v4H8z"/>',
 all:'<rect x="2.5" y="2.5" width="7" height="7" rx="1.5"/><rect x="14.5" y="2.5" width="7" height="7" rx="1.5"/><rect x="2.5" y="14.5" width="7" height="7" rx="1.5"/><rect x="14.5" y="14.5" width="7" height="7" rx="1.5"/>',
 stack:'<path d="m3 7 9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4"/>',
 check:'<circle cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-6"/>',
 edit:'<path d="M4 20h16M6 16l10-10 3 3-10 10-4 1zM14 8l3 3"/>',
 archive:'<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v12h14V9M10 13h4"/>',
 search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/>',
 filter:'<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
 sort:'<path d="M7 3v18m0-18-4 4m4-4 4 4M17 21V3m0 18-4-4m4 4 4-4"/>',
 print:'<path d="M6 9V3h12v6M6 18H4V10h16v8h-2M6 15h12v7H6z"/>',
 copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
 star:'<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3L5.8 21 7 14.2 2 9.3l6.9-1z"/>',
 home:'<path d="m3 11 9-8 9 8M5 9v12h5v-7h4v7h5V9"/>',
 bag:'<path d="M4 9h16v12H4zM8 9V7a4 4 0 0 1 8 0v2"/>',
 box:'<path d="m3 7 9-4 9 4-9 5zM3 7v10l9 4 9-4V7M12 12v9"/>',
 shield:'<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6zM8 12l3 3 5-6"/>',
 bell:'<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
 doc:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 8h8M8 12h8M8 16h6"/>'
};
function icon(key){return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">'+(svgPaths[key]||svgPaths.doc)+'</svg>'}
function el(tag,cls='',label){const n=document.createElement(tag);if(cls)n.className=cls;if(label!==undefined)n.textContent=label;return n}
function btn(text,cls,fn){const n=el('button',cls,text);n.type='button';if(fn)n.addEventListener('click',fn);return n}
const formatNumber=x=>Number(x).toLocaleString('ru-RU',{maximumFractionDigits:1});
function readyNutrition(r){const n=r?.nutrition;return n&&['kcal','protein','fat','carbs'].every(k=>n[k]!==null&&n[k]!==undefined&&n[k]!==''&&Number.isFinite(Number(n[k])))}
function formatDay(input){if(!input)return '';const d=new Date(input);if(!Number.isFinite(d.valueOf()))return '';return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'})}
function getProjects(){try{const x=JSON.parse(localStorage.getItem(PROJECT_KEY)||'null');if(Array.isArray(x?.projects))return x.projects.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&p.name.trim())}catch{}return [{id:'more-sushi',name:'Море Суши'},{id:'sushi-beri',name:'Суши Бери'}]}
function readProject(){try{return localStorage.getItem(FILTER_KEY)||'all'}catch{return 'all'}}
function writeProject(v){try{localStorage.setItem(FILTER_KEY,v)}catch{}}
export function mountLuxuryUI(opts={}){
 document.body.classList.add('lx-pro');
 const root=document.getElementById('recipes');
 if(!root)return {updateStats(){},updateCategories(){},projectScoped:r=>r,matchStatus(){return true},renderList(){},attachEditor(){return null},selectedProject(){return ''}};
 root.classList.add('lx-recipes','lx-ref');
 const refresh=()=>opts.onRefresh?.();
 const header=document.querySelector('.aurora-top');
 if(header&&!header.querySelector('.lx-brand-mark')){
  const logo=el('span','lx-brand-mark','A');
  header.querySelector('.aurora-brand')?.before(logo);
  const brand=header.querySelector('.aurora-brand');
  if(brand){const line=el('span','lx-brand-headline');line.append(document.createTextNode('FARRUH '),el('strong','','AI'));brand.replaceChildren(line,el('small','','Профессиональная кухня'))}
  const bell=btn('','lx-header-icon lx-header-bell',()=>opts.onNavigate?.('tasks'));bell.innerHTML=icon('bell');bell.title='Задачи и уведомления';bell.setAttribute('aria-label','Задачи и уведомления');
  const person=btn('','lx-header-icon lx-header-user',()=>opts.onNavigate?.('site-settings'));person.innerHTML=icon('user');person.title='Профиль и настройки';person.setAttribute('aria-label','Профиль и настройки');header.append(bell,person);
 }
 const hero=root.querySelector(':scope > .bar');hero?.classList.add('lx-hero','lx-ref-hero');
 if(hero){
  const h=hero.querySelector('h1');if(h){h.textContent='Техкарты (ТТК)';const hat=el('span','lx-ref-hat');hat.innerHTML=icon('chef');h.before(hat)}
  const create=hero.querySelector('#newrecipe');if(create)create.textContent='＋ Создать ТТК';
 }
 const lead=root.querySelector(':scope > .section-subtitle');if(lead){lead.textContent='Рецептуры, технологии, нормы и стандарты кухни';hero?.append(lead)}
 const stats=el('div','lx-stats lx-ref-stats');
 const metrics=[['total','Всего ТТК','stack'],['ready','Готовые','check'],['draft','Черновики','edit'],['archive','Архив','archive']];
 for(const [key,label,symbol] of metrics){
  const card=el('div','lx-stat lx-stat-'+key);
  card.innerHTML='<span class="lx-stat-icon">'+icon(symbol)+'</span><span class="lx-stat-body"><small></small><strong data-lx-count="'+key+'">0</strong></span>';
  card.querySelector('small').textContent=label;
  if(key==='archive'){card.setAttribute('role','button');card.tabIndex=0;card.addEventListener('click',()=>selectStatus('archive'));card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectStatus('archive')}})}
  stats.append(card);
 }
 hero?.after(stats);
 const projectRow=el('div','lx-workspace-row lx-project-row');
 const chooser=el('label','lx-project-field');chooser.append(el('span','lx-project-caption','Проект:'));
 const select=el('select','lx-project-select');select.id='lx-project-select';select.setAttribute('aria-label','Выбрать проект для списка ТТК');
 chooser.append(select);projectRow.append(chooser);
 const projectButton=btn('','lx-project-manage',()=>opts.onOpenProjects?.());projectButton.innerHTML=icon('user')+'<span>Управление проектами</span>';projectRow.append(projectButton);
 root.querySelector('.catalog-heading')?.before(projectRow);
 let project=readProject();
 function syncProjects(){
  const current=project;select.replaceChildren();
  select.add(new Option('Все проекты','all'));
  select.add(new Option('Без проекта','general'));
  for(const p of getProjects())select.add(new Option(p.name,p.id));
  project=[...select.options].some(o=>o.value===current)?current:'all';
  select.value=project;
 }
 syncProjects();
 select.addEventListener('change',()=>{project=select.value;writeProject(project);refresh()});
 document.addEventListener('pf:projects',()=>{syncProjects();refresh()});
 // Ref puts search directly below compact horizontal category strip.
 const catNav=root.querySelector('#recipe-categories');
 const searchWrap=root.querySelector('.catalog-search');
 if(catNav&&searchWrap)catNav.after(searchWrap);
 if(searchWrap)searchWrap.querySelector('span')?.replaceChildren();
 if(searchWrap){const l=searchWrap.querySelector('span');if(l)l.innerHTML=icon('search')}
 const search=root.querySelector('#recipe-search');
 if(search)search.placeholder='Поиск по названию, составу, коду…';
 const filterBar=el('div','lx-ref-searchbar');
 if(searchWrap)searchWrap.before(filterBar);
 if(searchWrap)filterBar.append(searchWrap);
 const filters=el('details','lx-filter-menu');
 const filterSummary=el('summary');filterSummary.innerHTML=icon('filter')+'<span>Фильтры</span><b class="lx-filter-badge" hidden>0</b>';filters.append(filterSummary);
 const filterBody=el('div','lx-filter-body');
 const hasPhoto=el('label');const photoCheck=el('input');photoCheck.type='checkbox';hasPhoto.append(photoCheck,document.createTextNode(' Только с фото блюда'));
 const hasNutrition=el('label');const nutrientCheck=el('input');nutrientCheck.type='checkbox';hasNutrition.append(nutrientCheck,document.createTextNode(' Только с рассчитанным КБЖУ'));
 filterBody.append(hasPhoto,hasNutrition,btn('Сбросить фильтры','',()=>{photoCheck.checked=false;nutrientCheck.checked=false;filters.open=false;refresh()}));filters.append(filterBody);filterBar.append(filters);
 const sorting=el('label','lx-sort-control');sorting.innerHTML=icon('sort');
 const sort=el('select');sort.setAttribute('aria-label','Сортировка техкарт');
 for(const [v,t] of [['new','Сначала новые'],['name','По названию'],['old','Сначала старые'],['yield','По выходу']])sort.add(new Option(t,v));
 sorting.append(sort);filterBar.append(sorting);
 let status='all';
 const strip=el('nav','lx-status-filters lx-ref-status');strip.setAttribute('aria-label','Фильтр техкарт');
 const tabs=[['all','Все'],['ready','Готовые'],['draft','Черновики'],['favorites','Избранное'],['archive','Архив']];
 function selectStatus(v){status=v;strip.querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.lxStatus===v)));refresh()}
 for(const [key,label] of tabs){const b=btn('',key==='archive'?'lx-archive-tab':'');b.dataset.lxStatus=key;b.setAttribute('aria-pressed',String(key===status));b.innerHTML=(key==='favorites'?icon('star'):'')+'<span>'+label+'</span><small>0</small>';b.addEventListener('click',()=>selectStatus(key));strip.append(b)}
 const results=root.querySelector('#catalog-results');if(results)results.before(strip);
 // Existing legacy favorite tab remains functional but is replaced by reference status navigation.
 const oldFilters=root.querySelector('.catalog-filters');if(oldFilters)oldFilters.hidden=true;
 const title=root.querySelector('#catalog-title');if(title)title.textContent='Категории';
 function projectScoped(recipes){
  if(project==='all')return recipes;
  if(project==='general')return recipes.filter(r=>!r.projectId);
  return recipes.filter(r=>r.projectId===project);
 }
 function updateStats(recipes=[]){
  const active=recipes.filter(r=>!r.archived),ready=active.filter(r=>r.status==='ready').length;
  const values={total:active.length,ready,draft:active.length-ready,archive:recipes.length-active.length};
  for(const [key,v] of Object.entries(values)){const node=stats.querySelector('[data-lx-count="'+key+'"]');if(node)node.textContent=formatNumber(v)}
  const counts={all:active.length,ready,draft:active.length-ready,favorites:active.filter(r=>opts.isFavorite?.(r.id)).length,archive:recipes.length-active.length};
  for(const [key,v] of Object.entries(counts)){const n=strip.querySelector('[data-lx-status="'+key+'"] small');if(n)n.textContent=String(v)}
  const activeFilters=Number(photoCheck.checked)+Number(nutrientCheck.checked),badge=filters.querySelector('.lx-filter-badge');badge.hidden=!activeFilters;badge.textContent=String(activeFilters);
 }
 function updateCategories(category='Все'){
  if(catNav&&!catNav.querySelector('.lx-all-category')){
   const b=btn('','category-card lx-all-category',()=>opts.onAllCategories?.());b.innerHTML='<span class="lx-all-category-icon">'+icon('all')+'</span><span class="category-caption"><strong>Все</strong><small>Категории</small></span>';catNav.prepend(b);
  }
  catNav?.querySelectorAll('.category-card').forEach(b=>{
   const active=(category==='Все'&&b.classList.contains('lx-all-category'))||(category!=='Все'&&b.dataset.category===category);
   b.classList.toggle('lx-selected',active);b.setAttribute('aria-pressed',String(active));
  });
 }
 function matchStatus(r){
  if(status==='archive')return !!r.archived;
  if(r.archived)return false;
  if(status==='ready'&&r.status!=='ready')return false;
  if(status==='draft'&&r.status==='ready')return false;
  if(status==='favorites'&&!opts.isFavorite?.(r.id))return false;
  if(photoCheck.checked&&!r.photo)return false;
  if(nutrientCheck.checked&&!readyNutrition(r))return false;
  return true;
 }
 function sortList(input){
  return [...input].sort((a,b)=>{
   if(sort.value==='name')return (a.name||'').localeCompare(b.name||'','ru');
   if(sort.value==='yield')return Number(b.netYieldGrams||0)-Number(a.netYieldGrams||0);
   const ad=Date.parse(a.updatedAt||a.cardDate||a.createdAt||'')||0,bd=Date.parse(b.updatedAt||b.cardDate||b.createdAt||'')||0;
   return sort.value==='old'?ad-bd:bd-ad;
  });
 }
 for(const n of [photoCheck,nutrientCheck,sort])n.addEventListener('change',refresh);
 function imageFor(recipe){
  const box=el('div','lx-recipe-photo');const img=el('img');img.loading='lazy';img.decoding='async';img.alt='';
  if(typeof recipe.photo==='string'&&/^(data:image\/(png|webp|jpeg);base64,|\/assets\/)/i.test(recipe.photo)){img.src=recipe.photo;box.append(img)}
  else if(categoryPhotos[recipe.category]){
   showProductPhoto(img,categoryPhotos[recipe.category]);box.append(img);box.classList.add('lx-category-fallback');
  }else{box.classList.add('lx-photo-placeholder');box.innerHTML=icon('chef')}
  return box;
 }
 function cardButton(label,key,handler){const b=btn('','lx-card-action',handler);b.innerHTML=icon(key)+'<span>'+label+'</span>';return b}
 function renderList(host,recipes){
  if(!host)return;
  host.replaceChildren();
  const visible=sortList(recipes);
  if(!visible.length){const msg=el('div','lx-empty','В выбранном проекте или категории техкарт нет. Измени фильтры или создай новую ТТК.');host.append(msg);return}
  for(const r of visible){
   const card=el('article','lx-recipe lx-ref-card');
   card.append(imageFor(r));
   const main=el('div','lx-recipe-content');
   const header=el('div','lx-card-heading');
   const title=el('h3','lx-recipe-name',r.name||'Без названия');
   const statusNode=el('span','lx-card-state '+(r.archived?'is-archived':r.status==='ready'?'is-ready':'is-draft'),r.archived?'В архиве':r.status==='ready'?'✓ Готова':'✎ Черновик');
   header.append(title,statusNode);
   const category=el('div','lx-card-category',r.category||'Без категории');
   const info=el('div','lx-ref-meta');
   if(r.netYieldGrams>0)info.append(el('span','', '⚖ Выход: '+formatNumber(r.netYieldGrams)+' г'+(r.pieces?' ('+r.pieces+' шт.)':'')));
   if(readyNutrition(r))info.append(el('span','', '◌ КБЖУ: '+['kcal','protein','fat','carbs'].map(k=>formatNumber(r.nutrition[k])).join('/')));
   else info.append(el('span','lx-meta-missing','КБЖУ: нет данных'));
   const date=formatDay(r.updatedAt||r.cardDate||r.createdAt);if(date)info.append(el('span','','▢ Изменена: '+date));
   if(r.cardNumber)info.append(el('span','','№ '+r.cardNumber));
   const actions=el('div','lx-card-actions');
   actions.append(cardButton('Редактировать','edit',()=>opts.onEdit?.(r)));
   actions.append(cardButton('Просмотр','eye',()=>opts.onPreview?.(r)));
   actions.append(cardButton('Печать','print',()=>opts.onPrint?.(r)));
   actions.append(cardButton('Дублировать','copy',()=>opts.onDuplicate?.(r)));
   actions.append(cardButton(r.archived?'Вернуть':'В архив','archive',()=>opts.onArchive?.(r)));
   main.append(header,category,info);
   const details=el('details','lx-card-more');
   const summary=el('summary','', '⋮');summary.setAttribute('aria-label','Дополнительные действия с '+r.name);details.append(summary);
   const menu=el('div','lx-card-menu');
   menu.append(btn(opts.isFavorite?.(r.id)?'★ Убрать из избранного':'☆ В избранное','',()=>opts.onToggleFavorite?.(r)));
   menu.append(btn('↓ Скачать PDF','',()=>opts.onPdf?.(r)));
   menu.append(btn('↓ Скачать Word','',()=>opts.onWord?.(r)));
   menu.append(btn('Удалить ТТК','lx-delete-action',()=>opts.onDelete?.(r)));
   details.append(menu);
   card.append(main,details,actions);host.append(card);
  }
 }
 function attachEditor(editor,onDirty=()=>{}){
  if(!editor)return null;
  const panel=el('section','lx-editor-extras');
  const projectLabel=el('label','lx-editor-project','Проект ТТК');
  const projectInput=el('select');projectInput.id='recipe-project';projectInput.setAttribute('aria-label','Проект для техкарты');projectLabel.append(projectInput);
  const photoBox=el('div','lx-editor-photo-field');
  const photoLabel=el('label','','Фото блюда · прозрачный PNG');const photoFile=el('input');photoFile.type='file';photoFile.accept='image/png,image/webp,image/jpeg';photoFile.id='recipe-photo-file';photoLabel.append(photoFile);
  const photoPreview=el('div','lx-editor-photo-preview');photoPreview.innerHTML=icon('chef');
  const photoInfo=el('small','lx-photo-hint','Загрузи фото продукта. Однотонный фон удаляется автоматически; при сложном фоне нужен PNG без фона.');
  const remove=btn('Убрать фото','lx-remove-photo');photoBox.append(photoLabel,photoPreview,remove,photoInfo);
  panel.append(projectLabel,photoBox);
  editor.querySelector('.editor-modes')?.before(panel);
  let storedPhoto=null;
  function updatePreview(){
   photoPreview.replaceChildren();
   if(storedPhoto){const img=el('img');img.src=storedPhoto;img.alt='Фото готового блюда';photoPreview.append(img)}
   else photoPreview.innerHTML=icon('chef');
  }
  function fillProjects(){
   const prev=projectInput.value;
   projectInput.replaceChildren();projectInput.add(new Option('Без проекта',''));
   for(const p of getProjects())projectInput.add(new Option(p.name,p.id));
   if([...projectInput.options].some(o=>o.value===prev))projectInput.value=prev;
  }
  fillProjects();document.addEventListener('pf:projects',fillProjects);
  projectInput.addEventListener('change',onDirty);
  remove.addEventListener('click',()=>{storedPhoto=null;photoFile.value='';updatePreview();onDirty()});
  photoFile.addEventListener('change',async()=>{
   const file=photoFile.files?.[0];if(!file)return;
   if(file.size>12*1024*1024){photoInfo.textContent='Фото больше 12 МБ. Выбери файл меньшего размера.';photoFile.value='';return}
   photoInfo.textContent='Обрабатываю прозрачность фото…';
   try{
    let result=await preparePhoto(file,{ai:false,tolerance:40});
    const image=new Image();image.src=result;await image.decode();
    const width=Math.min(650,image.naturalWidth),height=Math.max(1,Math.round(image.naturalHeight*width/image.naturalWidth));
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    canvas.getContext('2d').drawImage(image,0,0,width,height);
    result=canvas.toDataURL('image/png');if(result.length>2_200_000)throw Error('Фото слишком большое после обработки. Уменьши изображение.');
    storedPhoto=result;updatePreview();onDirty();
    photoInfo.textContent='Готово: PNG с прозрачным фоном, изображение сохранится вместе с ТТК.';
   }catch(error){photoInfo.textContent='Не удалось убрать фон автоматически: '+error.message+' Загрузи PNG с прозрачностью.';photoFile.value=''}
  });
  return {
   populate(r){
    fillProjects();
    const v=r?.projectId||(project!=='all'&&project!=='general'?project:'');
    projectInput.value=[...projectInput.options].some(x=>x.value===v)?v:'';
    storedPhoto=typeof r?.photo==='string'?r.photo:null;
    photoFile.value='';updatePreview();
    photoInfo.textContent=storedPhoto?'Фото блюда загружено. Можно заменить его или убрать.':'Можно добавить фото блюда на прозрачном фоне.';
   },
   getProjectId:()=>projectInput.value,
   getPhoto:()=>storedPhoto
  };
 }
 // Bottom reference navigation is shared between inner views; real actions remain available.
 const bottom=document.querySelector('.mobile-tools');
 if(bottom&&!bottom.classList.contains('lx-ref-bottom')){
  bottom.classList.add('lx-ref-bottom');
  bottom.replaceChildren();
  for(const [key,label,target] of [
   ['home','Кабинет шефа','home'],['stack','Проекты','projects'],['chef','Техкарты','recipes'],
   ['box','Полуфабрикаты','preparations'],['bag','Товары','print-control'],['shield','ХАССП','lab'],['all','Ещё','more']
  ]){
   const b=btn('','lx-bottom-item');b.innerHTML=icon(key)+'<span>'+label+'</span>';
   if(target==='more'){b.id='mobile-more'}
   else if(target==='projects'){b.addEventListener('click',()=>opts.onOpenProjects?.())}
   else b.dataset.view=target;
   bottom.append(b);
  }
 }
 return {updateStats,updateCategories,projectScoped,matchStatus,renderList,attachEditor,selectedProject:()=>project==='all'||project==='general'?'':project};
}
