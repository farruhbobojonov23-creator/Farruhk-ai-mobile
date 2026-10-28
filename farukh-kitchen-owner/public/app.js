'use strict';
const $$=s=>Array.from(document.querySelectorAll(s)), $=s=>document.querySelector(s);
const key='fk_owner_drafts_v07';let sheet='';
const state={page:'home',filter:'Все',search:'',editing:null,photo:null,records:read()};
const uuid=()=>('FK-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)).toUpperCase();
function read(){try{const d=JSON.parse(localStorage.getItem(key));return Array.isArray(d)?d:[]}catch{return []}}
function esc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function safePhoto(x){return typeof x==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(x)&&x.length<450000?x:''}
function keep(){try{localStorage.setItem(key,JSON.stringify(state.records));return true}catch(e){toast('Недостаточно памяти браузера. Экспортируйте JSON.');return false}}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),3400)}
const n=(v)=>Number(v)||0;
function safeNum(v){if(v===null||v===undefined||String(v).trim()==='')return null;const x=Number(v);return Number.isFinite(x)&&x>=0?x:null}
function cleanItem(x){
 const nutr={};for(const k of ['protein','fat','carb','kcal'])nutr[k]=safeNum(x?.nutrition?.[k]);
 return {name:String(x?.name||'').slice(0,130),gross:safeNum(x?.gross),grams:safeNum(x?.grams),nutrition:nutr};
}

function cleanRecord(x){
 const t=x?.type==='prep'?'prep':'dish',stat=['Черновик','На проверке','Утверждена'].includes(x?.status)?x.status:'Черновик';
 const safe=(v,max=2500)=>String(v??'').slice(0,max);
 const nutrition={};
 for(const k of ['protein','fat','carb','kcal'])nutrition[k]=x?.nutrition?.[k]===null||x?.nutrition?.[k]===''||x?.nutrition?.[k]===undefined?null:Math.max(0,Number(x.nutrition[k])||0);
 return {id:safe(x?.id||uuid(),65),type:t,
 name:safe(x?.name,140),category:safe(x?.category,90),yield:Math.max(0,n(x?.yield)),status:stat,version:safe(x?.version||'1.0',12),photo:safePhoto(x?.photo),
 documentType:x?.documentType==='ТК'?'ТК':'ТТК',preset:safe(x?.preset,60),cardNumber:safe(x?.cardNumber,50),organization:safe(x?.organization,160),
 scope:safe(x?.scope,2000),rawRequirements:safe(x?.rawRequirements,2500),developmentAct:safe(x?.developmentAct,150),
 presentation:safe(x?.presentation,2500),storage:safe(x?.storage,2500),
 shelfLifeHours:safeNum(x?.shelfLifeHours),shelfBasis:safe(x?.shelfBasis,500),
 organoleptic:safe(x?.organoleptic,2500),appearance:safe(x?.appearance,1600),safety:safe(x?.safety,2500),nutrition,nutritionAuto:x?.nutritionAuto!==false,
 approvedBy:safe(x?.approvedBy,150),approvedDate:safe(x?.approvedDate,15),chefName:safe(x?.chefName,150),productionDate:safe(x?.productionDate,15),quantity:safe(x?.quantity||'8 шт.',24),stepSections:x?.stepSections&&typeof x.stepSections==='object'?{prep:safe(x.stepSections.prep,4000),make:safe(x.stepSections.make,4000),serve:safe(x.stepSections.serve,4000)}:null,
 ingredients:Array.isArray(x?.ingredients)?x.ingredients.slice(0,100).map(cleanItem):[],steps:safe(x?.steps,8000),notes:safe(x?.notes,4000),updatedAt:safe(x?.updatedAt||new Date().toISOString(),40)};
}
function chip(s){return '<span class="status '+(s==='Утверждена'?'approved':s==='На проверке'?'review':'')+'">'+esc(s)+'</span>'}
function badgePage(type){return type==='prep'?'ПОЛУФАБРИКАТ':'ТЕХНОЛОГИЧЕСКАЯ КАРТА'}
function render(){
 const titles={home:'Обзор',dish:'ТТК блюд',prep:'Полуфабрикаты',packages:'Пакеты для продажи',settings:'База и экспорт'};
 $('#top-title').textContent=titles[state.page]||'Обзор';
 $$('[data-page]').forEach(el=>{const yes=el.dataset.page===state.page;el.classList.toggle('selected',yes);if(yes)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});
 $('#main').innerHTML=({home:home,dish:()=>catalog('dish'),prep:()=>catalog('prep'),packages:packages,settings:settings}[state.page]||home)();
}
function home(){
 const all=state.records;const checked=all.filter(x=>x.status==='Утверждена').length;
 return `<section class="welcome"><div><div class="eyebrow">CHEF CONTROL · CHAMPAGNE GOLD</div><h1>Твоя технологическая база</h1><p>Создавай собственные ТТК японской кухни, добавляй полуфабрикаты, фотографии, граммовки и технологию. Публичные покупатели эти черновики не видят.</p></div><button class="main-button" data-new="dish">＋ Создать ТТК</button></section>
 <div class="stats"><div class="stat"><span class="symbol">▦</span><strong>${all.filter(x=>x.type==='dish').length}</strong><small>ТТК блюд</small></div><div class="stat"><span class="symbol">◇</span><strong>${all.filter(x=>x.type==='prep').length}</strong><small>ТТК ПФ</small></div><div class="stat"><span class="symbol">✓</span><strong>${checked}</strong><small>Отмечено утверждёнными</small></div><div class="stat"><span class="symbol">♧</span><strong>${all.filter(x=>x.status!=='Утверждена').length}</strong><small>Ожидают проверки</small></div></div>
 <div class="two-pane"><section class="panel"><div class="eyebrow">ПЕРВЫЕ ШАГИ</div><h2>С чего начать разработку</h2><div class="workflow"><div class="step"><b>01 · Добавь ТТК блюда</b><p>Название, выход, ингредиенты и технология приготовления.</p></div><div class="step"><b>02 · Создай связанные полуфабрикаты</b><p>Подготовленный рис, заправки, соусы и заготовки; все параметры нужно проверить.</p></div><div class="step"><b>03 · Сохрани резервную копию</b><p>Экспортируй JSON, чтобы не потерять черновики при очистке браузера.</p></div></div><div class="actions"><button class="main-button" data-new="dish">＋ Ролл / блюдо</button><button class="outline" data-new="prep">＋ Полуфабрикат</button></div></section>
 <section class="panel"><div class="eyebrow">БЕЗОПАСНОСТЬ</div><h2>Два независимых контура</h2><p><b>Этот кабинет:</b> доступен только после входа владельца, черновики сохраняются локально.</p><p><b>Публичный сайт:</b> показывает только отдельные демо-ТТК, новые записи сюда автоматически не попадают.</p><div class="note">⚠ Пока нет синхронизации с Google Sheets и серверной базы. Изменения с другого устройства здесь не появятся. Это прототип редактора.</div><div class="actions"><button class="outline" data-page="settings">Резервные копии →</button><a class="outline" href="${sheet}" target="_blank" rel="noopener noreferrer">Моя Google-база ↗</a></div></section></div>
 <div class="section-head"><h2>Последние черновики</h2><button class="outline" data-page="dish">Все ТТК →</button></div><div class="record-grid">${all.length?all.slice().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,3).map(recordCard).join(''):empty('Пока нет технологических карт','Создай первую ТТК и начни формировать собственную базу японской кухни.')}</div>`;
}
function empty(t,p){return `<div class="empty"><div style="font-size:35px">🍣</div><b>${esc(t)}</b><p>${esc(p)}</p><button class="main-button" data-new="${state.page==='prep'?'prep':'dish'}">＋ Создать первую карту</button></div>`}
function recordCard(r){
 const total=(r.ingredients||[]).length, icon=r.type==='prep'?'🥑':'🍣';
 return `<article class="record"><div class="record-image">${safePhoto(r.photo)?`<img loading="lazy" src="${safePhoto(r.photo)}" alt="Фото: ${esc(r.name)}">`:`<span aria-hidden="true">${icon}</span>`}<span class="type-badge">${r.type==='prep'?'ПФ':'ТТК'}</span></div><div class="record-content">${chip(r.status)}<h3>${esc(r.name)}</h3><p>${esc(r.category||'Категория не указана')}</p><div class="muted">Выход: ${r.yield||'—'} г · Ингредиенты: ${total} · Версия ${esc(r.version)}</div><div class="record-actions"><button data-edit="${esc(r.id)}">Редактировать ↗</button><button data-print="${esc(r.id)}" aria-label="Печать ТТК">🖨</button><button class="delete" aria-label="Удалить" data-delete="${esc(r.id)}">✕</button></div></div></article>`;
}
function catalog(type){
 const title=type==='dish'?'ТТК готовых блюд':'ТТК полуфабрикатов',list=state.records.filter(x=>x.type===type),filtered=list.filter(x=>(state.filter==='Все'||x.status===state.filter)&&([x.name,x.category].join(' ').toLowerCase().includes(state.search.toLowerCase())));
 return `<div class="eyebrow">ТЕХНОЛОГИЧЕСКАЯ БАЗА · ${type==='prep'?'ПФ':'БЛЮДА'}</div><h1 class="page-title">${title}</h1><p class="page-lead">Добавляй авторские рецептуры, сохраняй выход и граммовки, редактируй технологии. Материалы не публикуются автоматически.</p><div class="toolbar"><label class="search">⌕ <input id="search" type="search" placeholder="Поиск по названию" value="${esc(state.search)}"></label><button class="main-button" data-new="${type}">＋ ${type==='prep'?'Добавить ПФ':'Добавить ТТК'}</button></div><div class="filters">${['Все','Черновик','На проверке','Утверждена'].map(x=>`<button data-filter="${x}" class="filter ${state.filter===x?'selected':''}">${x}</button>`).join('')}</div><div class="section-head"><h2>Карточки</h2><small>Найдено: ${filtered.length}</small></div><div class="record-grid">${filtered.length?filtered.map(recordCard).join(''):empty('Карточек не найдено','Добавь собственную ТТК или измени поиск.')}</div>`;
}
function packages(){
 const data=[['START','20 ТТК блюд + связанные ПФ','19 900 ₽'],['PRO','50 ТТК блюд + ПФ + калькуляция','39 900 ₽'],['PREMIUM','100 ТТК блюд + ПФ + инструкции','69 900 ₽']];
 return `<div class="eyebrow">МОДЕЛЬ БИЗНЕСА</div><h1 class="page-title">Пакеты для продажи</h1><p class="page-lead">Это примерные предложения. Продажи ещё не запущены, доступ покупателей не выдаётся.</p><div class="note">🔒 Пока нельзя автоматически публиковать ТТК и продавать эти пакеты. Для запуска необходимы утверждённая база, серверное хранение, лицензия и платежи.</div><div class="packages-grid">${data.map((x,i)=>`<article class="package ${i===1?'highlight':''}"><div class="eyebrow">${i===1?'ПОПУЛЯРНЫЙ':'КОНЦЕПЦИЯ'}</div><h3>${x[0]}</h3><div class="price">${x[2]}</div><p>${x[1]}</p><p>Цена и наполнение ещё не утверждены.</p><button class="outline" data-page="settings">Открыть план запуска →</button></article>`).join('')}</div>`;
}
function settings(){return `<div class="eyebrow">ХРАНЕНИЕ И БЕЗОПАСНОСТЬ</div><h1 class="page-title">База и резервные копии</h1><p class="page-lead">Пока данные этого редактора хранятся только в браузере. Экспортируй их регулярно.</p><div class="two-pane"><div class="exportbox"><h3>Скачать все мои ТТК</h3><p>Файл JSON с твоими локальными черновиками, граммовками, технологией и небольшими фотографиями. Храни его в надёжном месте.</p><div class="import-section"><button class="main-button" id="export">↓ Экспорт JSON</button><button class="outline" id="import">↑ Импорт JSON</button></div><div class="note">Импорт заменит текущие локальные черновики после твоего подтверждения. Сделай экспорт перед импортом.</div></div><div class="exportbox"><h3>Отдельная приватная Google-база</h3><p>В Google Drive уже создана структура из восьми таблиц: ТТК, ПФ, состав, технология, пакеты, покупатели и журнал изменений.</p><a class="outline" href="${sheet}" target="_blank" rel="noopener noreferrer">Открыть приватную Google-таблицу ↗</a><div class="note">Синхронизация между этим редактором и Google Sheets пока НЕ подключена. Экспорт JSON не загружает данные туда автоматически.</div></div></div><div class="panel" style="margin-top:20px"><h2>Что дальше будет в коммерческой версии</h2><p>Защищённое серверное хранение, вход владельца по личному аккаунту, версии ТТК, фотоэталоны, связь ТТК/ПФ, подготовка лицензий и управление покупателями. Ни одной опубликованной рецептуры до проверки.</p></div>`}
function closeSidebar(){$('#sidebar').classList.remove('open');$('#shade').classList.remove('visible');$('#shade').hidden=true}
function nav(page){if(!['home','dish','prep','packages','settings'].includes(page))return;state.page=page;state.search='';state.filter='Все';closeSidebar();render();window.scrollTo(0,0)}

const PRESETS={
 cold:{category:'Холодные роллы',type:'dish',ingredients:['Рис подготовленный','Нори','Сыр сливочный','Огурец','Рыба / морепродукт'],hint:'1. Проверить сырьё, маркировку и подготовку рабочих поверхностей.\n2. Подготовить рис, нори и начинку по утверждённому эталону.\n3. Сформировать ролл по утверждённой технологии.\n4. Проверить выход, количество частей и соответствие фотоэталону.'},
 baked:{category:'Запечённые роллы',type:'dish',ingredients:['Рис подготовленный','Нори','Сыр сливочный','Начинка','Соус для запекания'],hint:'1. Провести входной контроль компонентов.\n2. Сформировать ролл и нанести соус.\n3. Выполнить обработку по проверенным времени и температуре.\n4. Проконтролировать готовность и выход.'},
 tempura:{category:'Темпурные роллы',type:'dish',ingredients:['Рис подготовленный','Нори','Начинка','Кляр темпура','Сухари панко','Масло фритюрное'],hint:'1. Проверить сырьё и состояние масла.\n2. Подготовить и сформировать ролл.\n3. Выполнить панировку и жарку по утверждённому режиму.\n4. Проверить готовность, выход и качество.'},
 onigiri:{category:'Онигири',type:'dish',ingredients:['Рис подготовленный','Начинка','Нори'],hint:'1. Проверить ингредиенты и их маркировку.\n2. Подготовить начинку и рис.\n3. Сформировать онигири по эталону.\n4. Проверить массу, целостность и упаковку.'},
 sushi:{category:'Суши',type:'dish',ingredients:['Рис подготовленный','Рыба / морепродукты'],hint:'1. Подготовить и проверить компоненты.\n2. Сформировать порцию риса.\n3. Подготовить и уложить верхний ингредиент.\n4. Проверить выход и качество.'},
 sauce:{category:'Соусы и заготовки',type:'prep',ingredients:['Основа соуса','Дополнительный ингредиент','Специи / приправы'],hint:'1. Проверить входящее сырьё.\n2. Дозировать компоненты согласно проработанной рецептуре.\n3. Смешать по утверждённой технологии.\n4. Определить фактический выход, промаркировать партию.'},
 rice:{category:'Рис и основы',type:'prep',ingredients:['Рис сухой','Вода','Заправка рисовая'],hint:'1. Проверить сырьё и подготовить оборудование.\n2. Промыть рис по установленной технологии.\n3. Приготовить и внести заправку по проверенному режиму.\n4. Замерить выход и определить контрольные точки.'},
 seafood:{category:'Рыба и морепродукты',type:'prep',ingredients:['Рыба / морепродукты исходные'],hint:'1. Проверить сопроводительные документы и условия приёмки.\n2. Выполнить разделку/очистку по утверждённому способу.\n3. Провести необходимую обработку по верифицированному режиму.\n4. Зафиксировать потери, выход и маркировку.'}
};
let wizardStep=0;
let pendingPdfExport=false;
let lastPresetCode="";

const nutrKeys=['protein','fat','carb','kcal'];
const NUTRIENT_LIB='fk_kitchen_verified_nutrition_v1';
let nutrientLibrary={};try{nutrientLibrary=JSON.parse(localStorage.getItem(NUTRIENT_LIB)||'{}')||{}}catch{}
let weightBasis=null;
let lastAutofilledTitle='';
const fmt=(v,d=2)=>v===null||v===undefined?'—':Number(v).toLocaleString('ru-RU',{maximumFractionDigits:d});
const numeric=(s)=>safeNum(s);
function nutrientInputs(r){
 return '<details class="ingredient-nutrients"><summary>КБЖУ на 100 г ↳</summary><div class="ingredient-nutrient-grid">'+
 nutrKeys.map((k,i)=>'<label>'+['Белки','Жиры','Углеводы','Ккал'][i]+'<input type="number" min="0" max="10000" step=".01" data-nutrient="'+k+'" inputmode="decimal" placeholder="—"></label>').join('')+
 '</div><small>Только значения с упаковки или подтверждённого справочника.</small></details>';
}
function row(item={}){
 const el=document.createElement('div');el.className='ingredient-row';
 el.innerHTML='<label class="ingredient-name">Сырьё<input aria-label="Название ингредиента" placeholder="Рис, нори, сыр…" maxlength="130" list="nutrition-names"></label>'+
 '<label class="ingredient-gross">Брутто, г<input type="number" aria-label="Брутто" placeholder="—" min="0" max="1000000" step=".01" inputmode="decimal"></label>'+
 '<label class="ingredient-net">Нетто, г<input type="number" aria-label="Нетто" placeholder="—" min="0" max="1000000" step=".01" inputmode="decimal"></label>'+
 '<output class="ingredient-waste" aria-label="Отходы">—</output>'+
 '<button type="button" title="Удалить ингредиент" aria-label="Удалить ингредиент" class="remove-row">×</button>'+
 nutrientInputs();
 el.querySelector('.ingredient-name input').value=item.name||'';
 el.querySelector('.ingredient-gross input').value=item.gross??'';
 el.querySelector('.ingredient-net input').value=item.grams??'';
 const nut=item.nutrition||nutrientLibrary[String(item.name||'').toLowerCase().trim()]||{};
 nutrKeys.forEach(k=>{el.querySelector('[data-nutrient="'+k+'"]').value=nut[k]??''});
 return el;
}
function renderNutritionTable(){
 const root=$('#ttk-ingredient-nutrients');if(!root)return;
 const rows=$$('#ingredient-rows .ingredient-row');
 if(!rows.length){root.innerHTML='<p>Нет ингредиентов</p>';return}
 root.innerHTML='<div class="ttk-global-nutri-row ttk-nutri-header"><span>Ингредиент</span><span>Б, г</span><span>Ж, г</span><span>У, г</span><span>Ккал</span></div>'+
 rows.map((row,i)=>{
  const name=row.querySelector('.ingredient-name input')?.value.trim()||'Ингредиент '+(i+1);
  const nut=rowValues(row).nutrition;
  return '<div class="ttk-global-nutri-row"><span>'+esc(name)+'</span>'+
    nutrKeys.map(k=>'<input aria-label="'+esc(name)+' — '+k+'" data-nutri-row="'+i+'" data-nutri-key="'+k+'" type="number" min="0" max="10000" step=".01" inputmode="decimal" value="'+(nut[k]??'')+'" placeholder="—">').join('')+
  '</div>'
 }).join('');
}
function addRow(item){
 if($$('#ingredient-rows .ingredient-row').length>=100){toast('Максимум 100 ингредиентов');return}
 $('#ingredient-rows').appendChild(row(item));sumIngredients();renderNutritionTable();
}
function rowValues(row){
 const nut={};nutrKeys.forEach(k=>nut[k]=safeNum(row.querySelector('[data-nutrient="'+k+'"]')?.value));
 return {name:row.querySelector('.ingredient-name input').value.trim(),
 gross:safeNum(row.querySelector('.ingredient-gross input').value),
 grams:safeNum(row.querySelector('.ingredient-net input').value),nutrition:nut};
}
function rememberNutrition(row){
 const item=rowValues(row);if(!item.name||!nutrKeys.every(k=>item.nutrition[k]!==null))return;
 nutrientLibrary[item.name.toLowerCase()]=item.nutrition;
 try{localStorage.setItem(NUTRIENT_LIB,JSON.stringify(nutrientLibrary))}catch{}
}
function useNutritionLibrary(row){
 const name=row.querySelector('.ingredient-name input')?.value.trim().toLowerCase();
 const n=nutrientLibrary[name];if(!n)return;
 const hasData=nutrKeys.some(k=>row.querySelector('[data-nutrient="'+k+'"]')?.value!=='');
 if(hasData)return;
 nutrKeys.forEach(k=>row.querySelector('[data-nutrient="'+k+'"]').value=n[k]??'');
 sumIngredients();
}
function sumIngredients(){
 const rows=$$('#ingredient-rows .ingredient-row'),ingredients=rows.map(rowValues).filter(x=>x.name);
 const gross=ingredients.reduce((a,x)=>a+(x.gross||0),0),net=ingredients.reduce((a,x)=>a+(x.grams||0),0);
 $('#sum-gross').textContent=fmt(gross)+' г';$('#sum-net').textContent=fmt(net)+' г';
 $('#sum-waste').textContent=gross>0?fmt((gross-net)/gross*100,1)+' %':'—';
 rows.forEach(row=>{
  const x=rowValues(row),out=row.querySelector('.ingredient-waste');
  out.textContent=x.gross!==null&&x.gross>0&&x.grams!==null?fmt((x.gross-x.grams)/x.gross*100,1)+' %':'—';
  out.classList.toggle('negative',x.gross!==null&&x.grams!==null&&x.grams>x.gross);
 });
 const auto=$('#nutrition-auto')?.checked!==false,f=$('#record-form'),yieldG=safeNum(f?.elements.namedItem('yield')?.value);
 for(const k of nutrKeys){
  const el=f?.elements.namedItem(k);if(el)el.readOnly=auto;
 }
 const hasNutrients=ingredients.length>0&&yieldG>0&&ingredients.every(x=>x.grams!==null&&nutrKeys.every(k=>x.nutrition[k]!==null));
 const n={};
 if(auto){
  for(const k of nutrKeys){const v=hasNutrients?ingredients.reduce((total,x)=>total+x.grams*x.nutrition[k]/100,0)*100/yieldG:null;n[k]=v;
   const el=f?.elements.namedItem(k);if(el)el.value=v===null?'':v.toFixed(2);
  }
 }else for(const k of nutrKeys)n[k]=safeNum(f?.elements.namedItem(k)?.value);
 nutrKeys.forEach(k=>{
  const el=$('#per-portion-'+k);
  if(el)el.textContent=n[k]!==null&&yieldG>0?fmt(n[k]*yieldG/100):'—';
 });
 const msg=$('#nutrition-message');
 if(msg)msg.textContent=auto?(hasNutrients?'✓ КБЖУ рассчитаны из данных ингредиентов. Проверь выход и потери.':'⚠ Для точного расчёта добавь нетто, КБЖУ на 100 г каждого ингредиента и выход.'):'Ручное заполнение: значения требуют подтверждения.';
 checkA4Fit({quiet:true});
}
function setStep(){const scroll=$('#record-form');if(scroll)scroll.scrollTop=0;}
function checkA4Fit({quiet=false}={}){
 const rows=$$('#ingredient-rows .ingredient-row').length;
 const field=(name)=>$('#record-form')?.elements.namedItem(name)?.value||'';
 const textLength=['scope','rawRequirements','stepPrep','stepMake','stepServe','presentation','storage','organoleptic','safety','notes'].reduce((v,k)=>v+field(k).length,0);
 const danger=rows>22||textLength>2700;
 const e=$('#ttk-fit-status');if(e){e.textContent=danger?'⚠ Переполнение А4 возможно — проверь PDF':'✓ Цель: компактный лист А4';e.classList.toggle('fit-warn',danger)}
 if(!quiet)toast(danger?'Слишком много текста или строк для читаемого А4. Возможно приложение к ТТК.':'Компактность проверена по объёму. Точный размер проверь в PDF.');
 return !danger;
}


const stageExamples={
 cold:['Проверить маркировку сырья, температуру и состояние полуфабрикатов. Подготовить рис, нори, начинку и инвентарь.','По утверждённой рецептуре распределить рис и начинку. Сформировать ролл, соблюдая нормы закладки и технологию предприятия.','Нарезать ролл на части по утверждённому фотоэталону. Проверить выход и оформление.'],
 baked:['Проверить маркировку и подготовить полуфабрикаты и начинки.','Сформировать ролл. Добавить соус. Запекать по установленному и подтверждённому режиму.','Проверить готовность, внешний вид, массу и условия реализации.'],
 tempura:['Проверить сырьё, подготовить кляр, панировку и фритюрное оборудование.','Сформировать ролл, выполнить панировку и тепловую обработку по подтверждённым времени и температуре.','Проверить готовность, массу и внешний вид; оформить подачу.'],
 onigiri:['Проверить компоненты, подготовить рис и начинку.','Сформировать изделие с начинкой, при необходимости оформить нори.','Проверить форму, выход, маркировку и упаковку.'],
 sushi:['Подготовить рис и проверенное сырьё.','Сформировать суши согласно рецептуре и утверждённому способу.','Проверить массу, внешний вид и условия реализации.'],
 sauce:['Провести входной контроль сырья, подготовить тару и инвентарь.','Дозировать, соединить и перемешать компоненты по утверждённой технологии.','Зафиксировать выход, маркировку и подтверждённые условия хранения.'],
 rice:['Провести входной контроль сухого риса, подготовить оборудование и ингредиенты.','Промыть, сварить, внести заправку по проверенному режиму.','Проконтролировать выход и условия использования заготовки.'],
 seafood:['Проверить документы и состояние исходного сырья.','Провести разделку, очистку и при необходимости обработку в установленном режиме.','Зафиксировать отходы, выход, маркировку и условия хранения.']
};
const titlePresets=[
 [/филадельф/i,{code:'cold',names:['Рис подготовленный','Нори','Сыр сливочный','Огурец','Лосось подготовленный']}],
 [/калифорни/i,{code:'cold',names:['Рис подготовленный','Нори','Крабовая начинка','Огурец','Икра масаго']}],
 [/канада/i,{code:'cold',names:['Рис подготовленный','Нори','Сыр сливочный','Огурец','Угорь','Соус унаги']}],
 [/темпур/i,{code:'tempura'}],[/запеч|под чеддером/i,{code:'baked'}],
 [/онигири/i,{code:'onigiri'}],[/суши|нигири/i,{code:'sushi'}],
 [/рис|заправка/i,{code:'rice'}],[/соус|майонез|спайси/i,{code:'sauce'}],
 [/креветк|лосось подготов|угорь подготов/i,{code:'seafood'}]
];
function applyPreset(code,{initial=false}={}){
 const preset=PRESETS[code];if(!preset)return;
 const previous=PRESETS[lastPresetCode];
 const rows=$$('#ingredient-rows .ingredient-row');
 const hasManual=rows.some((r,i)=>{
  const x=rowValues(r);
  return x.gross!==null||x.grams!==null||x.name&&(x.name!==previous?.ingredients[i]);
 });
 if(!initial&&hasManual&&!confirm('Заменить список ингредиентов шаблоном? Введённые значения потеряются.')){$('#preset').value=lastPresetCode;return}
 const f=$('#record-form'),put=(name,value)=>{const el=f.elements.namedItem(name);if(el)el.value=value??''};
 put('category',preset.category);
 if(code==='sauce'||code==='rice'||code==='seafood')put('quantity','Партия');
 else if(code==='sushi')put('quantity','1 шт.');
 else put('quantity','8 шт.');
 $('#editor-kicker').textContent=badgePage(preset.type);
 $('#ingredient-rows').replaceChildren();
 preset.ingredients.forEach(name=>addRow({name}));
 const stages=stageExamples[code]||[];
 ['stepPrep','stepMake','stepServe'].forEach((field,i)=>{
  const el=f.elements.namedItem(field);
  if(el&&!el.value.trim())el.value=stages[i]||'';
 });
 if(!f.elements.namedItem('scope').value.trim())put('scope','Техкарта предназначена для изготовления блюда «'+(f.elements.namedItem('name').value||'указанного наименования')+'» на предприятии, использующем данную рецептуру. Требования и применимость проверить перед утверждением.');
 if(!f.elements.namedItem('rawRequirements').value.trim())put('rawRequirements','Использовать сырьё и полуфабрикаты с прослеживаемостью, сопроводительной документацией, действующей маркировкой и подтверждённой пригодностью. Соблюдать условия приёмки, хранения и разделение потоков.');
 if(!f.elements.namedItem('presentation').value.trim())put('presentation',preset.type==='prep'?'Выход и упаковка по проверенному стандарту.':'Оформление, комплектность и внешний вид по согласованному фотоэталону; контролировать массу и количество частей.');
 if(!f.elements.namedItem('safety').value.trim())put('safety','Контроль по программе производственного контроля и процедурам ХАССП предприятия; конкретные показатели и режимы установить по действующим документам и проверенной технологии.');
 if(!f.elements.namedItem('appearance').value.trim())put('appearance','Форма и оформление соответствуют утверждённому фотоэталону; без посторонних включений.');
 lastPresetCode=code;
 sumIngredients();
 if(!initial)toast('Стандартные разделы заполнены. Проверь текст и реальные данные.');
}
function autoFillByTitle(){
 const f=$('#record-form'),name=f.elements.namedItem('name').value.trim();
 if(!name)return toast('Сначала введи название блюда');
 if(state.editing===null)lastAutofilledTitle=name.toLowerCase();
 const matching=state.records.find(x=>x.name.toLowerCase().trim()===name.toLowerCase().trim()&&x.id!==state.editing);
 if(matching){
   if(!confirm('Найден сохранённый рецепт «'+matching.name+'». Заполнить поля и граммовки из него?'))return;
   const originalNumber=f.elements.namedItem('cardNumber').value;
   const currentId=state.editing;
   fillFromRecord(matching,{preserveName:name,preserveNumber:originalNumber});
   weightBasis=matching.yield>0?matching.yield:null;
   toast('Загружен сохранённый рецепт. Проверь проработку и дату.');
   return;
 }
 const title=titlePresets.find(x=>x[0].test(name.toLowerCase()));
 if(!title)return toast('Точного шаблона нет. Выбери категорию — общие разделы будут заполнены.');
 const code=title[1].code;$('#preset').value=code;
 applyPreset(code);
 if(title[1].names){
   const hasManual=$$('#ingredient-rows .ingredient-row').some(r=>rowValues(r).grams!==null);
   if(!hasManual){$('#ingredient-rows').replaceChildren();title[1].names.forEach(name=>addRow({name}));}
 }
 const scope=f.elements.namedItem('scope');
 if(scope)scope.value='Настоящая карта применяется для изготовления «'+name+'» на предприятии, использующем разработанную рецептуру. Требуется проверка для конкретной площадки.';
 toast('Шаблон по названию готов — нормы закладки и выход не выдуманы.');
}
function fillFromRecord(r,{preserveName='',preserveNumber=''}={}){
 const f=$('#record-form');const put=(n,v)=>{const e=f.elements.namedItem(n);if(e)e.value=v??''};
 const fields=['category','yield','preset','organization','scope','rawRequirements','presentation','storage','shelfLifeHours','shelfBasis','appearance','organoleptic','safety','productionDate','quantity','chefName','developmentAct'];
 fields.forEach(k=>put(k,r[k]));
 put('name',preserveName||r.name);put('cardNumber',preserveNumber||r.cardNumber);put('status','Черновик');
 const st=r.stepSections||{};
 const parts=r.steps?.split(/\n(?=\d+\.|Формовка|Нарезка)/)||[];
 ['stepPrep','stepMake','stepServe'].forEach((k,i)=>put(k,st[['prep','make','serve'][i]]||parts[i]||''));
 $('#ingredient-rows').replaceChildren();(r.ingredients||[]).forEach(addRow);
 if(!r.ingredients?.length)addRow();
 put('protein',r.nutrition?.protein);put('fat',r.nutrition?.fat);put('carb',r.nutrition?.carb);put('kcal',r.nutrition?.kcal);
 $('#nutrition-auto').checked=r.nutritionAuto!==false;
 $('#ttk-act').value=r.developmentAct||'';
 sumIngredients();
}
function showEditor(idOrType='dish'){
 const existing=state.records.find(x=>x.id===idOrType);
 state.editing=existing?existing.id:null;state.photo=existing?safePhoto(existing.photo):null;lastAutofilledTitle='';
 const f=$('#record-form');f.reset();pendingPdfExport=false;lastPresetCode=existing?.preset||'';
 const put=(name,val)=>{const el=f.elements.namedItem(name);if(el)el.value=val??''};
 if(existing){
  fillFromRecord(existing);
  put('status',existing.status);put('version',existing.version);put('approvedBy',existing.approvedBy);
  put('approvedDate',existing.approvedDate);put('notes',existing.notes);
  weightBasis=existing.yield>0?existing.yield:null;
 }else{
  const prefix=idOrType==='prep'?'ПФ':'ТТК',seen=new Set(state.records.map(x=>x.cardNumber).filter(Boolean));
  let index=state.records.filter(x=>x.type===(idOrType==='prep'?'prep':'dish')).length+1;
  let card=prefix+'-'+String(index).padStart(4,'0');while(seen.has(card)){index++;card=prefix+'-'+String(index).padStart(4,'0')}
  put('cardNumber',card);put('quantity',idOrType==='prep'?'Партия':'8 шт.');
  put('productionDate',new Date().toLocaleDateString('en-CA'));
  const code=idOrType==='prep'?'sauce':'cold';put('preset',code);applyPreset(code,{initial:true});
  weightBasis=null;
 }
 $('#editor-title').textContent=existing?'Редактирование · '+existing.name:(idOrType==='prep'?'Новая ТТК полуфабриката':'Новая ТТК блюда');
 $('#editor-kicker').textContent=badgePage(existing?.type||idOrType);
 updatePhoto();sumIngredients();renderNutritionTable();
 $('#editor-backdrop').hidden=false;document.body.style.overflow='hidden';
 $('#record-form').scrollTop=0;
}
function scaleRecipe(){
 const f=$('#record-form'),y=safeNum(f.elements.namedItem('yield').value);
 if(!y||!weightBasis)return toast('Сначала открой сохранённую ТТК с граммовками и укажи новый выход.');
 const ratio=y/weightBasis;
 if(ratio<0.05||ratio>20)return toast('Коэффициент слишком большой — проверь выход');
 const rows=$$('#ingredient-rows .ingredient-row');
 if(!rows.length||rows.every(r=>rowValues(r).grams===null))return toast('В рецептуре нет числовых норм закладки');
 rows.forEach(row=>{
  for(const sel of ['.ingredient-net input','.ingredient-gross input']){const el=row.querySelector(sel);const v=safeNum(el?.value);if(v!==null)el.value=(v*ratio).toFixed(2)}
 });
 weightBasis=y;sumIngredients();
 toast('Граммовки пересчитаны пропорционально: коэффициент '+fmt(ratio,3)+'. Проверь технологические потери.');
}

function updatePhoto(){const p=$('#image-preview');if(!p)return;if(state.photo){p.src=state.photo;p.hidden=false}else{p.hidden=true;p.removeAttribute('src')}}
function closeEditor(){$('#editor-backdrop').hidden=true;document.body.style.overflow='';state.editing=null;state.photo=null}
async function filePhoto(file){if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Нужна фотография JPG, PNG или WEBP');if(file.size>8*1024*1024)throw Error('Файл слишком большой (максимум 8 МБ)');
 const img=await createImageBitmap(file);const scale=Math.min(1,720/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);img.close();
 let data=canvas.toDataURL('image/jpeg',.67);if(data.length>400000){canvas.width=Math.round(canvas.width*.7);canvas.height=Math.round(canvas.height*.7);const image=await createImageBitmap(file);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close();data=canvas.toDataURL('image/jpeg',.54)}
 if(data.length>400000)throw Error('Фотография не поместилась в локальное хранилище');return data;
}


function submit(e){
 e.preventDefault();
 const f=$('#record-form'),field=name=>f.elements.namedItem(name)?.value??'';
 const rows=$$('#ingredient-rows .ingredient-row');
 const ingredients=rows.map(rowValues).filter(x=>x.name);
 const was=state.records.find(x=>x.id===state.editing);
 const stage={prep:field('stepPrep'),make:field('stepMake'),serve:field('stepServe')};
 const steps=['Подготовка: '+stage.prep,'Формовка / приготовление: '+stage.make,'Нарезка / подача: '+stage.serve].join('\n');
 const r=cleanRecord({
  id:was?.id||uuid(),type:was?.type||(PRESETS[field('preset')]?.type||'dish'),
  name:field('name').trim(),category:field('category').trim(),yield:field('yield'),status:field('status'),
  cardNumber:field('cardNumber'),preset:field('preset'),version:field('version'),documentType:field('documentType'),
  photo:state.photo,organization:field('organization'),productionDate:field('productionDate'),quantity:field('quantity'),
  chefName:field('chefName'),scope:field('scope'),rawRequirements:field('rawRequirements'),developmentAct:$('#ttk-act').value,
  ingredients,stepSections:stage,steps,presentation:field('presentation'),storage:field('storage'),
  shelfLifeHours:field('shelfLifeHours'),shelfBasis:field('shelfBasis'),
  appearance:field('appearance'),organoleptic:field('organoleptic'),safety:field('safety'),
  nutritionAuto:$('#nutrition-auto').checked,
  nutrition:Object.fromEntries(nutrKeys.map(k=>[k,field(k)])),
  approvedBy:field('approvedBy'),approvedDate:field('approvedDate'),notes:field('notes'),
  updatedAt:new Date().toISOString()
 });
 if(!r.name){pendingPdfExport=false;toast('Укажи название ТТК');return}
 if(r.ingredients.some(x=>x.gross!==null&&x.grams!==null&&x.grams>x.gross)){
  if(!confirm('Есть ингредиент, у которого нетто превышает брутто. Проверить граммовки перед сохранением?')){pendingPdfExport=false;return}
 }
 if(r.shelfLifeHours!==null&&r.shelfLifeHours>0&&!r.shelfBasis.trim()){
  pendingPdfExport=false;toast('Укажи обоснование срока годности или убери срок');return
 }
 if(r.status==='Утверждена'){
  const nutritionReady=nutrKeys.every(k=>r.nutrition[k]!==null);
  const mandatory=r.yield>0&&r.ingredients.length>0&&r.ingredients.every(x=>x.name&&x.gross!==null&&x.grams!==null)
  &&r.stepSections&&Object.values(r.stepSections).every(v=>v.trim())&&r.rawRequirements.trim()&&r.developmentAct.trim()
  &&r.presentation.trim()&&r.storage.trim()&&r.shelfLifeHours>0&&r.shelfBasis.trim()
  &&r.organoleptic.trim()&&r.safety.trim()&&nutritionReady&&r.approvedBy.trim()&&r.approvedDate;
  if(!mandatory){pendingPdfExport=false;toast('Не все данные подтверждены. Сохрани как «Черновик» или «На проверке».');return}
  if(!confirm('Подтверждаешь реальную проработку, проверку КБЖУ и режимов, а также фактическое утверждение уполномоченным лицом?')){pendingPdfExport=false;return}
 }
 const before=state.records.slice();
 if(was)state.records=state.records.map(x=>x.id===r.id?r:x);else state.records.unshift(r);
 if(!keep()){state.records=before;pendingPdfExport=false;return}
 const pdf=pendingPdfExport;pendingPdfExport=false;
 closeEditor();render();toast(pdf?'Карта сохранена. В печати выбери «Сохранить как PDF».':'Черновик сохранён на этом устройстве. Экспортируй JSON для резервной копии.');
 if(pdf)printTTK(r);
}

function exportJson(){const out={format:'FARUKH_KITCHEN_OWNER_DRAFTS',version:1,exportedAt:new Date().toISOString(),records:state.records};const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='FARUKH_KITCHEN_BACKUP_'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('Резервная копия подготовлена')}
async function importJson(file){if(!file)return;if(file.size>5e6){toast('Файл больше 5 МБ — импорт отменён');return}try{const data=JSON.parse(await file.text());if(data.format!=='FARUKH_KITCHEN_OWNER_DRAFTS'||!Array.isArray(data.records)||data.records.length>500)throw Error('Неизвестный формат резервной копии');if(!confirm('Заменить все текущие локальные черновики содержимым файла?'))return;const items=data.records.map(cleanRecord);const prev=state.records;state.records=items;if(!keep()){state.records=prev;return}render();toast('Импортировано ТТК: '+items.length)}catch(e){toast('Ошибка импорта: '+e.message)}}
async function logout(){await fetch('/api/logout',{method:'POST',credentials:'same-origin'});location.replace('/')}


function printTTK(id){
 const r=typeof id==='object'?id:state.records.find(x=>x.id===id);
 if(!r)return toast('ТТК не найдена');
 const text=x=>esc(x===null||x===undefined||String(x).trim()===''?'—':x).replace(/\n/g,'<br>');
 const val=x=>x===null||x===undefined||x===''?'—':fmt(x);
 const nut=r.nutrition||{};
 const y=r.yield||0;
 const portion=k=>nut[k]===null||nut[k]===undefined||!y?'—':fmt(nut[k]*y/100);
 const items=(r.ingredients||[]).filter(x=>x.name);
 if(items.length>22||(['scope','rawRequirements','steps','presentation','storage','appearance','organoleptic','safety'].reduce((n,k)=>n+(r[k]||'').length,0)>2800)){
  if(!confirm('В этой ТТК много ингредиентов или текста. Один лист А4 может оказаться нечитаемым или понадобится приложение. Продолжить печать без обрезки данных?'))return;
 }
 const rows=items.length?items.map((it,i)=>{
  const waste=it.gross!==null&&it.gross>0&&it.grams!==null?fmt((it.gross-it.grams)/it.gross*100,1)+'%':'—';
  return `<tr><td>${i+1}. ${text(it.name)}</td><td>${val(it.gross)}</td><td>${val(it.grams)}</td><td>${waste}</td></tr>`;
 }).join(''):'<tr><td colspan="4">Рецептура не заполнена</td></tr>';
 const st=r.stepSections||{};
 const getStage=(k,idx)=>st[k]||(!r.stepSections?(r.steps||'').split(/\n/)[idx]:'')||'';
 const date=r.productionDate||'—';
 const totalG=items.reduce((a,x)=>a+(x.gross||0),0),totalN=items.reduce((a,x)=>a+(x.grams||0),0);
 const print=document.getElementById('print-area')||document.createElement('div');
 print.id='print-area';
 print.innerHTML=`<div class="print-document single-ttk ${items.length>24?'dense-paper':items.length>15?'compact-paper':''}">
 <div class="ttk-p-title">ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ КАРТА (FARUKH KITCHEN)</div>
 <table class="ttk-p-meta"><tbody>
 <tr><td>Блюдо: <b>${text(r.name)}</b></td><td>Дата разработки: ${text(date)}</td></tr>
 <tr><td>Категория: ${text(r.category)}</td><td>ТТК №: ${text(r.cardNumber)}</td></tr>
 <tr><td>Статус: ${text(r.status)}</td><td>Количество: ${text(r.quantity||'8 шт.')}</td></tr></tbody></table>
 <div class="ttk-p-dual">
 <section><h3>1. Область применения</h3><p>${text(r.scope)}</p></section>
 <section><h3>2. Требования к сырью</h3><p>${text(r.rawRequirements)}</p></section>
 </div>
 <section><h3>3. Рецептура</h3><table><thead><tr><th>Наименование сырья / полуфабриката</th><th>Брутто, г</th><th>Нетто, г</th><th>Отходы, %</th></tr></thead><tbody>${rows}</tbody></table>
 <div class="ttk-p-totals"><span>Выход: <b>${val(r.yield)} г</b></span><span>Σ брутто: ${fmt(totalG)} г</span><span>Σ нетто: ${fmt(totalN)} г</span></div></section>
 <section><h3>4. Технологический процесс</h3><table class="ttk-p-steps"><tbody><tr><td>Подготовка</td><td>${text(getStage('prep',0))}</td></tr><tr><td>Формовка / приготовление</td><td>${text(getStage('make',1))}</td></tr><tr><td>Нарезка / подача</td><td>${text(getStage('serve',2))}</td></tr></tbody></table></section>
 <div class="ttk-p-dual">
 <section><h3>5. Оформление, подача, реализация и хранение</h3><p>${text(r.presentation)}</p><p>${text(r.storage)}</p><p>Срок: ${r.shelfLifeHours?val(r.shelfLifeHours)+' ч':'не установлен'}. Основание: ${text(r.shelfBasis)}</p></section>
 <section><h3>6. Показатели качества</h3><p><b>Внешний вид:</b> ${text(r.appearance)}</p><p><b>Вкус, запах и консистенция:</b> ${text(r.organoleptic)}</p></section>
 </div>
 <section><h3>Безопасность</h3><p>${text(r.safety)}</p></section>
 <section><h3>7. Пищевая ценность (на 100 г / на порцию)</h3>
 <table class="ttk-p-nutri"><thead><tr><th>Показатель</th><th>Белки, г</th><th>Жиры, г</th><th>Углеводы, г</th><th>Ккал</th></tr></thead>
 <tbody><tr><td>На 100 г</td><td>${val(nut.protein)}</td><td>${val(nut.fat)}</td><td>${val(nut.carb)}</td><td>${val(nut.kcal)}</td></tr>
 <tr><td>На порцию</td><td>${portion('protein')}</td><td>${portion('fat')}</td><td>${portion('carb')}</td><td>${portion('kcal')}</td></tr></tbody></table></section>
 <table class="ttk-p-sign"><tbody><tr><td>Разработал (шеф): ${text(r.chefName)}</td><td>Утверждаю (руководитель): ${text(r.approvedBy)}</td></tr><tr><td>Акт проработки: ${text(r.developmentAct)}</td><td>Дата утверждения: ${text(r.approvedDate)}</td></tr></tbody></table>
 <div class="ttk-p-foot">Структура: ГОСТ 31987-2012 · Производственная безопасность: СанПиН 2.3/2.4.3590-20. ${r.status==='Утверждена'?'Требуется фактическое утверждение и подтверждающая документация.':'ЧЕРНОВИК · НЕ УТВЕРЖДЕНО · НЕ ДЛЯ ПРОИЗВОДСТВА'}</div>
 </div>`;
 if(!print.parentNode)document.body.appendChild(print);
 window.print();
}
function blankPDF(){
 const r={documentType:'ТТК',name:'________________',cardNumber:'_________',category:'_________',quantity:'8 шт.',status:'Черновик',
 productionDate:'__________',chefName:'__________',approvedBy:'____________',approvedDate:'________',
 yield:0,scope:'________________________',rawRequirements:'________________________',
 ingredients:Array.from({length:9},()=>({name:'________________',gross:null,grams:null})),
 stepSections:{prep:'____________________',make:'____________________',serve:'____________________'},
 presentation:'________________',storage:'________________',appearance:'________________',organoleptic:'________________',
 safety:'________________',shelfLifeHours:null,shelfBasis:'________________',nutrition:{protein:null,fat:null,carb:null,kcal:null}};
 printTTK(r);
}

async function bind(){
 const check=await fetch('/api/session',{credentials:'same-origin'}).then(r=>r.json()).catch(()=>({authenticated:false}));if(!check.authenticated){location.replace('/');return}
 const config=await fetch('/api/config',{credentials:'same-origin'}).then(r=>r.ok?r.json():{}).catch(()=>({}));sheet=config.sheetUrl||'';
 document.addEventListener('click',async(e)=>{
 const t=e.target.closest('button');if(!t)return;
 if(t.id==='logout'){await logout();return}
 if(t.id==='menu'){$('#sidebar').classList.add('open');$('#shade').hidden=false;$('#shade').classList.add('visible');return}
 if(t.dataset.page){nav(t.dataset.page);return}
 if(t.id==='quick-new'){showEditor('dish');return}
 if(t.id==='save-pdf'){pendingPdfExport=true;$('#record-form').requestSubmit();return}
 if(t.id==='ttk-autofill'){autoFillByTitle();return}
 if(t.id==='ttk-scale'){scaleRecipe();return}
 if(t.id==='ttk-check-fit'){checkA4Fit();return}
 if(t.id==='blank-pdf'){blankPDF();return}
 if(t.dataset.new){showEditor(t.dataset.new);return}
 if(t.dataset.print){printTTK(t.dataset.print);return}
 if(t.dataset.edit){showEditor(t.dataset.edit);return}
 if(t.dataset.delete){const r=state.records.find(x=>x.id===t.dataset.delete);if(!r||!confirm('Удалить «'+r.name+'» из локальной базы?'))return;const before=state.records;state.records=before.filter(x=>x.id!==r.id);if(!keep()){state.records=before;return}render();toast('ТТК удалена локально');return}
 if(t.dataset.filter){state.filter=t.dataset.filter;render();return}
 if(t.id==='close-editor'||t.id==='cancel-editor'){closeEditor();return}
 if(t.dataset.step!==undefined){setStep(Number(t.dataset.step));return}
 if(t.id==='step-next'){setStep(wizardStep+1);return}
 if(t.id==='step-prev'){setStep(wizardStep-1);return}
 if(t.id==='add-ingredient'){addRow();return}
 if(t.classList.contains('remove-row')){const rows=$$('#ingredient-rows .ingredient-row');if(rows.length>1)t.closest('.ingredient-row')?.remove();else rows[0].querySelectorAll('input').forEach(x=>x.value='');sumIngredients();renderNutritionTable();return}
 if(t.id==='clear-photo'){state.photo=null;$('#photo-input').value='';updatePhoto();return}
 if(t.id==='export'){exportJson();return}
 if(t.id==='import'){$('#import-json').click();return}
 });
 document.addEventListener('input',e=>{
 if(e.target.hasAttribute('data-nutri-row')){
  const row=$$('#ingredient-rows .ingredient-row')[Number(e.target.dataset.nutriRow)];
  const field=row?.querySelector('[data-nutrient="'+e.target.dataset.nutriKey+'"]');
  if(field){field.value=e.target.value;sumIngredients()}
 }
 if(e.target.closest('#ingredient-rows')||e.target.name==='yield'||e.target.name==='protein'||e.target.name==='fat'||e.target.name==='carb'||e.target.name==='kcal')sumIngredients();if(e.target.id==='search'){state.search=e.target.value;const pos=e.target.selectionStart;render();$('#search')?.focus();try{$('#search')?.setSelectionRange(pos,pos)}catch{}}});
 document.addEventListener('change',async e=>{
 if(e.target.name==='name'&&state.editing===null){
  const title=e.target.value.trim().toLowerCase();
  const hasEntered=$$('#ingredient-rows .ingredient-row').some(row=>rowValues(row).grams!==null||rowValues(row).gross!==null);
  const hasSaved=state.records.some(r=>r.name.toLowerCase().trim()===title);
  if(title&&title!==lastAutofilledTitle&&!hasEntered&&!hasSaved&&titlePresets.some(([re])=>re.test(title)))autoFillByTitle();
 }
 if(e.target.id==='preset')applyPreset(e.target.value);if(e.target.id==='nutrition-auto')sumIngredients();if(e.target.matches('.ingredient-name input')){useNutritionLibrary(e.target.closest('.ingredient-row'));renderNutritionTable()}if(e.target.matches('[data-nutrient]')){rememberNutrition(e.target.closest('.ingredient-row'));sumIngredients()} if(e.target.hasAttribute('data-nutri-row')){const row=$$('#ingredient-rows .ingredient-row')[Number(e.target.dataset.nutriRow)];if(row)rememberNutrition(row)}if(e.target.id==='photo-input'){try{state.photo=await filePhoto(e.target.files?.[0]);updatePhoto();toast('Фотография добавлена в черновик')}catch(err){toast(err.message)}}if(e.target.id==='import-json'){await importJson(e.target.files?.[0]);e.target.value=''}});
 $('#record-form').addEventListener('submit',submit);
 $('#shade').addEventListener('click',closeSidebar);
 $('#editor-backdrop').addEventListener('click',e=>{if(e.target.id==='editor-backdrop')closeEditor()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#editor-backdrop').hidden?closeSidebar():closeEditor()}});
 render();
}
bind();
