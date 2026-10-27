'use strict';
const $$=s=>Array.from(document.querySelectorAll(s)), $=s=>document.querySelector(s);
const key='fk_owner_drafts_v07',sheet='https://docs.google.com/spreadsheets/d/1LSFx5vdj1aXUOqyAbiz4wiNMUMmjOxwgz1tU5eZZrfQ/edit';
const state={page:'home',filter:'Все',search:'',editing:null,photo:null,records:read()};
const uuid=()=>('FK-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)).toUpperCase();
function read(){try{const d=JSON.parse(localStorage.getItem(key));return Array.isArray(d)?d:[]}catch{return []}}
function esc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function safePhoto(x){return typeof x==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(x)&&x.length<450000?x:''}
function keep(){try{localStorage.setItem(key,JSON.stringify(state.records));return true}catch(e){toast('Недостаточно памяти браузера. Экспортируйте JSON.');return false}}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),3400)}
const n=(v)=>Number(v)||0;
function cleanItem(x){return {name:String(x?.name||'').slice(0,130),grams:Math.max(0,n(x?.grams))}}
function cleanRecord(x){
 const t=x?.type==='prep'?'prep':'dish',stat=['Черновик','На проверке','Утверждена'].includes(x?.status)?x.status:'Черновик';
 return {id:String(x?.id||uuid()).slice(0,65),type:t,name:String(x?.name||'').slice(0,140),category:String(x?.category||'').slice(0,90),yield:Math.max(0,n(x?.yield)),status:stat,version:String(x?.version||'1.0').slice(0,12),photo:safePhoto(x?.photo),ingredients:Array.isArray(x?.ingredients)?x.ingredients.slice(0,100).map(cleanItem):[],steps:String(x?.steps||'').slice(0,8000),notes:String(x?.notes||'').slice(0,4000),updatedAt:String(x?.updatedAt||new Date().toISOString()).slice(0,40)};
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
 return `<article class="record"><div class="record-image">${safePhoto(r.photo)?`<img loading="lazy" src="${safePhoto(r.photo)}" alt="Фото: ${esc(r.name)}">`:`<span aria-hidden="true">${icon}</span>`}<span class="type-badge">${r.type==='prep'?'ПФ':'ТТК'}</span></div><div class="record-content">${chip(r.status)}<h3>${esc(r.name)}</h3><p>${esc(r.category||'Категория не указана')}</p><div class="muted">Выход: ${r.yield||'—'} г · Ингредиенты: ${total} · Версия ${esc(r.version)}</div><div class="record-actions"><button data-edit="${esc(r.id)}">Редактировать ↗</button><button class="delete" aria-label="Удалить" data-delete="${esc(r.id)}">✕</button></div></div></article>`;
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
function row(item={}){const el=document.createElement('div');el.className='ingredient-row';el.innerHTML='<input aria-label="Ингредиент" placeholder="Название ингредиента" maxlength="130"><input type="number" aria-label="Нетто, г" placeholder="Нетто, г" min="0" max="1000000" step=".1"><button type="button" title="Удалить строку" class="remove-row">×</button>';el.children[0].value=item.name||'';el.children[1].value=item.grams??'';return el}
function addRow(item){$('#ingredient-rows').appendChild(row(item))}
function showEditor(idOrType='dish'){
 const existing=state.records.find(x=>x.id===idOrType);
 state.editing=existing?existing.id:null;state.photo=existing?safePhoto(existing.photo):null;
 const f=$('#record-form');f.reset();f.elements.name.value=existing?.name||'';f.elements.category.value=existing?.category||(idOrType==='prep'?'Соусы и заготовки':'Холодные роллы');f.elements.yield.value=existing?.yield||'';f.elements.status.value=existing?.status||'Черновик';f.elements.version.value=existing?.version||'1.0';f.elements.steps.value=existing?.steps||'';f.elements.notes.value=existing?.notes||'';
 $('#editor-title').textContent=existing?'Редактирование ТТК':(idOrType==='prep'?'Новый полуфабрикат':'Новая ТТК блюда');
 $('#editor-kicker').textContent=badgePage(existing?.type||idOrType);
 $('#ingredient-rows').replaceChildren();
 const ingredients=existing?.ingredients||[];if(ingredients.length)ingredients.forEach(addRow);else addRow();
 updatePhoto();
 $('#editor-backdrop').hidden=false;document.body.style.overflow='hidden';$('#close-editor').focus();
}
function updatePhoto(){const p=$('#image-preview');if(state.photo){p.src=state.photo;p.hidden=false}else{p.hidden=true;p.removeAttribute('src')}}
function closeEditor(){$('#editor-backdrop').hidden=true;document.body.style.overflow='';state.editing=null;state.photo=null}
async function filePhoto(file){if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Нужна фотография JPG, PNG или WEBP');if(file.size>8*1024*1024)throw Error('Файл слишком большой (максимум 8 МБ)');
 const img=await createImageBitmap(file);const scale=Math.min(1,720/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);img.close();
 let data=canvas.toDataURL('image/jpeg',.67);if(data.length>400000){canvas.width=Math.round(canvas.width*.7);canvas.height=Math.round(canvas.height*.7);const image=await createImageBitmap(file);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close();data=canvas.toDataURL('image/jpeg',.54)}
 if(data.length>400000)throw Error('Фотография не поместилась в локальное хранилище');return data;
}
function submit(e){e.preventDefault();const f=e.currentTarget;const list=$$('#ingredient-rows .ingredient-row').map(row=>({name:row.children[0].value.trim(),grams:Math.max(0,n(row.children[1].value))})).filter(x=>x.name);
 const was=state.records.find(x=>x.id===state.editing);
 const r=cleanRecord({id:was?.id||uuid(),type:was?.type||$('#editor-kicker').textContent.includes('ПОЛУФАБРИКАТ')?'prep':'dish',name:f.elements.name.value.trim(),category:f.elements.category.value.trim(),yield:f.elements.yield.value,status:f.elements.status.value,version:f.elements.version.value,steps:f.elements.steps.value,notes:f.elements.notes.value,photo:state.photo,ingredients:list,updatedAt:new Date().toISOString()});
 // Do not allow empty approved recipes in the prototype.
 if(!r.name||r.yield<=0){toast('Укажи название и выход');return}
 if(r.status==='Утверждена'&&(!r.ingredients.length||!r.steps.trim())){toast('Для статуса «Утверждена» нужны ингредиенты и технология');return}
 const prev=state.records.slice();if(was)state.records=state.records.map(x=>x.id===r.id?r:x);else state.records.unshift(r);
 if(!keep()){state.records=prev;return}
 closeEditor();state.search='';state.filter='Все';render();toast('ТТК сохранена локально. Не забудь экспорт JSON.');
}
function exportJson(){const out={format:'FARUKH_KITCHEN_OWNER_DRAFTS',version:1,exportedAt:new Date().toISOString(),records:state.records};const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='FARUKH_KITCHEN_BACKUP_'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('Резервная копия подготовлена')}
async function importJson(file){if(!file)return;if(file.size>5e6){toast('Файл больше 5 МБ — импорт отменён');return}try{const data=JSON.parse(await file.text());if(data.format!=='FARUKH_KITCHEN_OWNER_DRAFTS'||!Array.isArray(data.records)||data.records.length>500)throw Error('Неизвестный формат резервной копии');if(!confirm('Заменить все текущие локальные черновики содержимым файла?'))return;const items=data.records.map(cleanRecord);const prev=state.records;state.records=items;if(!keep()){state.records=prev;return}render();toast('Импортировано ТТК: '+items.length)}catch(e){toast('Ошибка импорта: '+e.message)}}
async function logout(){await fetch('/api/logout',{method:'POST',credentials:'same-origin'});location.replace('/')}
async function bind(){
 const check=await fetch('/api/session',{credentials:'same-origin'}).then(r=>r.json()).catch(()=>({authenticated:false}));if(!check.authenticated){location.replace('/');return}
 document.addEventListener('click',async(e)=>{
 const t=e.target.closest('button');if(!t)return;
 if(t.id==='logout'){await logout();return}
 if(t.id==='menu'){$('#sidebar').classList.add('open');$('#shade').hidden=false;$('#shade').classList.add('visible');return}
 if(t.dataset.page){nav(t.dataset.page);return}
 if(t.id==='quick-new'){showEditor('dish');return}
 if(t.dataset.new){showEditor(t.dataset.new);return}
 if(t.dataset.edit){showEditor(t.dataset.edit);return}
 if(t.dataset.delete){const r=state.records.find(x=>x.id===t.dataset.delete);if(!r||!confirm('Удалить «'+r.name+'» из локальной базы?'))return;const before=state.records;state.records=before.filter(x=>x.id!==r.id);if(!keep()){state.records=before;return}render();toast('ТТК удалена локально');return}
 if(t.dataset.filter){state.filter=t.dataset.filter;render();return}
 if(t.id==='close-editor'||t.id==='cancel-editor'){closeEditor();return}
 if(t.id==='add-ingredient'){if($$('#ingredient-rows .ingredient-row').length>=100)return toast('Достигнут лимит 100 ингредиентов');addRow();return}
 if(t.classList.contains('remove-row')){const rows=$$('#ingredient-rows .ingredient-row');if(rows.length>1)t.closest('.ingredient-row')?.remove();else rows[0].querySelectorAll('input').forEach(x=>x.value='');return}
 if(t.id==='clear-photo'){state.photo=null;$('#photo-input').value='';updatePhoto();return}
 if(t.id==='export'){exportJson();return}
 if(t.id==='import'){$('#import-json').click();return}
 });
 document.addEventListener('input',e=>{if(e.target.id==='search'){state.search=e.target.value;const pos=e.target.selectionStart;render();$('#search')?.focus();try{$('#search')?.setSelectionRange(pos,pos)}catch{}}});
 document.addEventListener('change',async e=>{if(e.target.id==='photo-input'){try{state.photo=await filePhoto(e.target.files?.[0]);updatePhoto();toast('Фотография добавлена в черновик')}catch(err){toast(err.message)}}if(e.target.id==='import-json'){await importJson(e.target.files?.[0]);e.target.value=''}});
 $('#record-form').addEventListener('submit',submit);
 $('#shade').addEventListener('click',closeSidebar);
 $('#editor-backdrop').addEventListener('click',e=>{if(e.target.id==='editor-backdrop')closeEditor()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#editor-backdrop').hidden?closeSidebar():closeEditor()}});
 render();
}
bind();
