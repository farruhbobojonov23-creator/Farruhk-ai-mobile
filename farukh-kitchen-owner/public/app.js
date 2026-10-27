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
function cleanItem(x){return {name:String(x?.name||'').slice(0,130),gross:x?.gross===null||x?.gross===''?null:(Number.isFinite(Number(x?.gross))?Math.max(0,Number(x.gross)):null),grams:x?.grams===null||x?.grams===''?null:(Number.isFinite(Number(x?.grams))?Math.max(0,Number(x.grams)):null)}}
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
 shelfLifeHours:x?.shelfLifeHours===null||x?.shelfLifeHours===''||x?.shelfLifeHours===undefined?null:Math.max(0,Number(x.shelfLifeHours)||0),shelfBasis:safe(x?.shelfBasis,500),
 organoleptic:safe(x?.organoleptic,2500),safety:safe(x?.safety,2500),nutrition,
 approvedBy:safe(x?.approvedBy,150),approvedDate:safe(x?.approvedDate,15),
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
function row(item={}){
 const el=document.createElement('div');el.className='ingredient-row';
 el.innerHTML='<label class="ingredient-name">Ингредиент<input aria-label="Ингредиент" placeholder="Рис, нори, сыр…" maxlength="130"></label><label class="ingredient-gross">Брутто, г<input type="number" aria-label="Брутто, граммы" placeholder="—" min="0" max="1000000" step=".1" inputmode="decimal"></label><label class="ingredient-net">Нетто, г<input type="number" aria-label="Нетто, граммы" placeholder="—" min="0" max="1000000" step=".1" inputmode="decimal"></label><button type="button" title="Удалить ингредиент" aria-label="Удалить ингредиент" class="remove-row">×</button>';
 el.querySelector('.ingredient-name input').value=item.name||'';
 el.querySelector('.ingredient-gross input').value=item.gross??'';
 el.querySelector('.ingredient-net input').value=item.grams??'';
 return el;
}
function addRow(item){$('#ingredient-rows').appendChild(row(item));sumIngredients()}
function sumIngredients(){
 const rows=$$('#ingredient-rows .ingredient-row');
 const total=(sel)=>rows.reduce((sum,r)=>sum+(Number(r.querySelector(sel)?.value)||0),0);
 $('#sum-gross').textContent=total('.ingredient-gross input').toLocaleString('ru-RU',{maximumFractionDigits:2})+' г';
 $('#sum-net').textContent=total('.ingredient-net input').toLocaleString('ru-RU',{maximumFractionDigits:2})+' г';
}
function setStep(step){
 wizardStep=Math.max(0,Math.min(2,step));
 $$('[data-panel]').forEach(p=>p.hidden=Number(p.dataset.panel)!==wizardStep);
 $$('.wizard-tab').forEach(t=>{const active=Number(t.dataset.step)===wizardStep;t.classList.toggle('current',active);t.classList.toggle('completed',Number(t.dataset.step)<wizardStep);if(active)t.setAttribute('aria-current','step');else t.removeAttribute('aria-current')});
 $('#step-prev').hidden=wizardStep===0;
 $('#step-next').hidden=wizardStep===2;
 $('#save-record').hidden=wizardStep!==2;
 const scroll=$('.editor');if(scroll)scroll.scrollTop=0;
}
function applyPreset(code,{initial=false}={}){
 const p=PRESETS[code];if(!p)return;
 const rows=$$('#ingredient-rows .ingredient-row');
 const hasManual=rows.some(r=>r.querySelector('.ingredient-name input')?.value.trim()||r.querySelector('.ingredient-net input')?.value);
 if(!initial&&hasManual&&!confirm('Заменить список ингредиентов готовым шаблоном? Указанные граммовки будут потеряны.')){$('#preset').value=state.records.find(x=>x.id===state.editing)?.preset||'';return}
 const f=$('#record-form');
 f.elements.namedItem('category').value=p.category;
 $('#editor-kicker').textContent=badgePage(p.type);
 $('#editor-title').textContent=p.type==='prep'?'Новый полуфабрикат':'Новая ТТК блюда';
 $('#ingredient-rows').replaceChildren();
 p.ingredients.forEach(name=>addRow({name,grams:null,gross:null}));
 const steps=f.elements.namedItem('steps');
 if(!steps.value.trim())steps.value=p.hint;
 toast('Шаблон готов: заполни граммовки по проработке');
}
function showEditor(idOrType='dish'){
 const existing=state.records.find(x=>x.id===idOrType);
 state.editing=existing?existing.id:null;state.photo=existing?safePhoto(existing.photo):null;
 const f=$('#record-form');f.reset();
 const put=(name,val)=>{const el=f.elements.namedItem(name);if(el)el.value=val??''};
 const values={
 name:existing?.name||'',category:existing?.category||'',yield:existing?.yield||'',status:existing?.status||'Черновик',
 version:existing?.version||'1.0',steps:existing?.steps||'',notes:existing?.notes||'',
 preset:existing?.preset||'',documentType:existing?.documentType||'ТТК',cardNumber:existing?.cardNumber||'',
 organization:existing?.organization||'',scope:existing?.scope||'',rawRequirements:existing?.rawRequirements||'',
 developmentAct:existing?.developmentAct||'',presentation:existing?.presentation||'',storage:existing?.storage||'',
 shelfLifeHours:existing?.shelfLifeHours??'',shelfBasis:existing?.shelfBasis||'',
 organoleptic:existing?.organoleptic||'',safety:existing?.safety||'',
 protein:existing?.nutrition?.protein??'',fat:existing?.nutrition?.fat??'',carb:existing?.nutrition?.carb??'',kcal:existing?.nutrition?.kcal??'',
 approvedBy:existing?.approvedBy||'',approvedDate:existing?.approvedDate||''
 };
 Object.entries(values).forEach(([name,val])=>put(name,val));
 $('#editor-title').textContent=existing?'Редактирование · '+existing.name:(idOrType==='prep'?'Новый полуфабрикат':'Новая ТТК блюда');
 $('#editor-kicker').textContent=badgePage(existing?.type||idOrType);
 $('#ingredient-rows').replaceChildren();
 const ingredients=existing?.ingredients||[];
 if(ingredients.length)ingredients.forEach(addRow);
 else if(existing)addRow();
 else{const code=idOrType==='prep'?'sauce':'cold';put('preset',code);applyPreset(code,{initial:true})}
 if(existing&&ingredients.length)sumIngredients();
 updatePhoto();setStep(0);
 $('#editor-backdrop').hidden=false;document.body.style.overflow='hidden';$('#close-editor').focus();
}
function updatePhoto(){const p=$('#image-preview');if(state.photo){p.src=state.photo;p.hidden=false}else{p.hidden=true;p.removeAttribute('src')}}
function closeEditor(){$('#editor-backdrop').hidden=true;document.body.style.overflow='';state.editing=null;state.photo=null}
async function filePhoto(file){if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Нужна фотография JPG, PNG или WEBP');if(file.size>8*1024*1024)throw Error('Файл слишком большой (максимум 8 МБ)');
 const img=await createImageBitmap(file);const scale=Math.min(1,720/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);img.close();
 let data=canvas.toDataURL('image/jpeg',.67);if(data.length>400000){canvas.width=Math.round(canvas.width*.7);canvas.height=Math.round(canvas.height*.7);const image=await createImageBitmap(file);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close();data=canvas.toDataURL('image/jpeg',.54)}
 if(data.length>400000)throw Error('Фотография не поместилась в локальное хранилище');return data;
}

function submit(e){
 e.preventDefault();const f=e.currentTarget,field=name=>f.elements.namedItem(name)?.value??'';
 const list=$$('#ingredient-rows .ingredient-row').map(row=>{
  const name=row.querySelector('.ingredient-name input').value.trim();
  const gross=row.querySelector('.ingredient-gross input').value;
  const net=row.querySelector('.ingredient-net input').value;
  return {name,gross:gross===''?null:Number(gross),grams:net===''?null:Number(net)}
 }).filter(x=>x.name);
 const was=state.records.find(x=>x.id===state.editing);
 const r=cleanRecord({
 id:was?.id||uuid(),type:was?.type||(PRESETS[field('preset')]?.type||'dish'),
 name:field('name').trim(),category:field('category').trim(),yield:field('yield'),status:field('status'),
 version:field('version'),steps:field('steps'),notes:field('notes'),photo:state.photo,ingredients:list,
 preset:field('preset'),documentType:field('documentType'),cardNumber:field('cardNumber'),organization:field('organization'),
 scope:field('scope'),rawRequirements:field('rawRequirements'),developmentAct:field('developmentAct'),
 presentation:field('presentation'),storage:field('storage'),shelfLifeHours:field('shelfLifeHours'),shelfBasis:field('shelfBasis'),
 organoleptic:field('organoleptic'),safety:field('safety'),
 nutrition:{protein:field('protein'),fat:field('fat'),carb:field('carb'),kcal:field('kcal')},
 approvedBy:field('approvedBy'),approvedDate:field('approvedDate'),updatedAt:new Date().toISOString()
 });
 if(!r.name||r.yield<=0){setStep(0);toast('Заполни наименование и фактический выход');return}
 if(r.shelfLifeHours!==null&&r.shelfLifeHours>0&&!r.shelfBasis.trim()){setStep(2);toast('Для срока годности укажи документальное обоснование');return}
 if(r.status==='Утверждена'){
  const mandatory=r.ingredients.length>0&&r.ingredients.every(x=>x.name&&x.gross!==null&&x.grams!==null)&&r.steps.trim()&&r.rawRequirements.trim()&&r.developmentAct.trim()&&r.presentation.trim()&&r.storage.trim()&&r.organoleptic.trim()&&r.safety.trim()&&r.approvedBy.trim()&&r.approvedDate;
  if(!mandatory){setStep(2);toast('Не все обязательные разделы заполнены. Сохрани как черновик.');return}
  if(!confirm('Утверждение означает, что рецептура проработана, условия хранения обоснованы, а документ подписан руководителем. Подтверждаешь?'))return;
 }
 const before=state.records.slice();
 if(was)state.records=state.records.map(x=>x.id===r.id?r:x);else state.records.unshift(r);
 if(!keep()){state.records=before;return}
 closeEditor();state.search='';state.filter='Все';render();toast('ТТК сохранена локально. Не забудь экспорт JSON.');
}
function exportJson(){const out={format:'FARUKH_KITCHEN_OWNER_DRAFTS',version:1,exportedAt:new Date().toISOString(),records:state.records};const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='FARUKH_KITCHEN_BACKUP_'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('Резервная копия подготовлена')}
async function importJson(file){if(!file)return;if(file.size>5e6){toast('Файл больше 5 МБ — импорт отменён');return}try{const data=JSON.parse(await file.text());if(data.format!=='FARUKH_KITCHEN_OWNER_DRAFTS'||!Array.isArray(data.records)||data.records.length>500)throw Error('Неизвестный формат резервной копии');if(!confirm('Заменить все текущие локальные черновики содержимым файла?'))return;const items=data.records.map(cleanRecord);const prev=state.records;state.records=items;if(!keep()){state.records=prev;return}render();toast('Импортировано ТТК: '+items.length)}catch(e){toast('Ошибка импорта: '+e.message)}}
async function logout(){await fetch('/api/logout',{method:'POST',credentials:'same-origin'});location.replace('/')}

function printTTK(id){
 const r=state.records.find(x=>x.id===id);if(!r)return toast('Карта не найдена');
 const line=x=>esc(x||'—').replace(/\n/g,'<br>');
 const rows=(r.ingredients||[]).map((it,i)=>`<tr><td>${i+1}</td><td>${esc(it.name)}</td><td>${it.gross??'—'}</td><td>${it.grams??'—'}</td></tr>`).join('');
 const val=x=>x===null||x===undefined||x===''?'—':esc(x);
 const nutr=r.nutrition||{};
 const print=document.getElementById('print-area')||document.createElement('div');
 print.id='print-area';
 print.innerHTML=`<div class="print-document">
 <div class="print-approval"><span>УТВЕРЖДАЮ<br>${val(r.approvedBy)}<br>Дата: ${val(r.approvedDate)}</span><span>Статус: <b>${esc(r.status)}</b><br>Версия: ${esc(r.version)}</span></div>
 <div class="print-brand">FARUKH KITCHEN · ТЕХНОЛОГИЧЕСКИЕ ДОКУМЕНТЫ</div>
 <h1>${r.documentType==='ТК'?'ТЕХНОЛОГИЧЕСКАЯ КАРТА':'ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ КАРТА'} № ${val(r.cardNumber)}</h1>
 <h2>${esc(r.name)}</h2><p><b>Предприятие:</b> ${val(r.organization)} &nbsp; <b>Категория:</b> ${val(r.category)}</p>
 <h3>1. Область применения</h3><p>${line(r.scope)}</p>
 <h3>2. Требования к сырью</h3><p>${line(r.rawRequirements)}</p>
 <h3>3. Рецептура / нормы закладки</h3>
 <table><thead><tr><th>№</th><th>Наименование сырья / ПФ</th><th>Брутто, г</th><th>Нетто, г</th></tr></thead><tbody>${rows||'<tr><td colspan="4">Не заполнено</td></tr>'}</tbody></table>
 <p><b>Выход готового изделия / ПФ:</b> ${val(r.yield)} г. <b>Проработка:</b> ${val(r.developmentAct)}</p>
 <h3>4. Технологический процесс</h3><p>${line(r.steps)}</p>
 <h3>5. Оформление, подача, реализация и хранение</h3><p><b>Оформление и подача:</b> ${line(r.presentation)}</p><p><b>Условия:</b> ${line(r.storage)}</p><p><b>Срок:</b> ${r.shelfLifeHours??'не установлен'}${r.shelfLifeHours?' ч':''}. <b>Обоснование:</b> ${line(r.shelfBasis)}</p>
 <h3>6. Качество и безопасность</h3><p><b>Органолептика:</b> ${line(r.organoleptic)}</p><p><b>Контроль безопасности:</b> ${line(r.safety)}</p>
 <h3>7. Пищевая и энергетическая ценность на 100 г</h3><table><thead><tr><th>Белки, г</th><th>Жиры, г</th><th>Углеводы, г</th><th>Ккал</th></tr></thead><tbody><tr><td>${val(nutr.protein)}</td><td>${val(nutr.fat)}</td><td>${val(nutr.carb)}</td><td>${val(nutr.kcal)}</td></tr></tbody></table>
 <h3>8. Примечания и аллергены</h3><p>${line(r.notes)}</p>
 <div class="print-status">${r.status==='Утверждена'?'Запись обозначена как утверждённая владельцем; проверьте оригиналы подтверждающих документов и подпись.':'ЧЕРНОВИК · НЕ УТВЕРЖДЕНО · НЕ ДЛЯ ПРОИЗВОДСТВА'}</div>
 <p class="print-foot">Структура разделов: ГОСТ 31987-2012. СанПиН 2.3/2.4.3590-20 регулирует безопасность производства; данный шаблон не заменяет выполнение санитарных правил и документальную верификацию.</p>
 </div>`;
 if(!print.parentNode)document.body.appendChild(print);
 window.print();
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
 if(t.dataset.new){showEditor(t.dataset.new);return}
 if(t.dataset.print){printTTK(t.dataset.print);return}
 if(t.dataset.edit){showEditor(t.dataset.edit);return}
 if(t.dataset.delete){const r=state.records.find(x=>x.id===t.dataset.delete);if(!r||!confirm('Удалить «'+r.name+'» из локальной базы?'))return;const before=state.records;state.records=before.filter(x=>x.id!==r.id);if(!keep()){state.records=before;return}render();toast('ТТК удалена локально');return}
 if(t.dataset.filter){state.filter=t.dataset.filter;render();return}
 if(t.id==='close-editor'||t.id==='cancel-editor'){closeEditor();return}
 if(t.dataset.step!==undefined){setStep(Number(t.dataset.step));return}
 if(t.id==='step-next'){setStep(wizardStep+1);return}
 if(t.id==='step-prev'){setStep(wizardStep-1);return}
 if(t.id==='add-ingredient'){if($$('#ingredient-rows .ingredient-row').length>=100)return toast('Достигнут лимит 100 ингредиентов');addRow();return}
 if(t.classList.contains('remove-row')){const rows=$$('#ingredient-rows .ingredient-row');if(rows.length>1)t.closest('.ingredient-row')?.remove();else rows[0].querySelectorAll('input').forEach(x=>x.value='');return}
 if(t.id==='clear-photo'){state.photo=null;$('#photo-input').value='';updatePhoto();return}
 if(t.id==='export'){exportJson();return}
 if(t.id==='import'){$('#import-json').click();return}
 });
 document.addEventListener('input',e=>{if(e.target.closest('#ingredient-rows'))sumIngredients();if(e.target.id==='search'){state.search=e.target.value;const pos=e.target.selectionStart;render();$('#search')?.focus();try{$('#search')?.setSelectionRange(pos,pos)}catch{}}});
 document.addEventListener('change',async e=>{if(e.target.id==='preset')applyPreset(e.target.value);if(e.target.id==='photo-input'){try{state.photo=await filePhoto(e.target.files?.[0]);updatePhoto();toast('Фотография добавлена в черновик')}catch(err){toast(err.message)}}if(e.target.id==='import-json'){await importJson(e.target.files?.[0]);e.target.value=''}});
 $('#record-form').addEventListener('submit',submit);
 $('#shade').addEventListener('click',closeSidebar);
 $('#editor-backdrop').addEventListener('click',e=>{if(e.target.id==='editor-backdrop')closeEditor()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#editor-backdrop').hidden?closeSidebar():closeEditor()}});
 render();
}
bind();
