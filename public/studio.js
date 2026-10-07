/* FARRUKH AI Chef Studio. Existing storage keys remain compatible. */
(()=>{'use strict';
const $=s=>document.querySelector(s), main=$('#main'), id=()=>crypto.randomUUID();
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function read(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}}
function put(k,v){localStorage.setItem(k,JSON.stringify(v))}
const keys={tasks:'farrukh_mobile_tasks',chat:'farrukh_mobile_chat',recipes:'farrukh_studio_recipes',journals:'farrukh_studio_journals',notes:'farrukh_studio_notes',reports:'farrukh_frontpad_reports'};
let data=Object.fromEntries(Object.entries(keys).map(([k,v])=>[k,read(v,[])]));
for(const k of Object.keys(data))if(!Array.isArray(data[k]))data[k]=[];
try{if(!localStorage.getItem('farrukh_studio_backup_v5'))put('farrukh_studio_backup_v5',{at:new Date().toISOString(),values:Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('farrukh_')).map(k=>[k,localStorage.getItem(k)]))})}catch{console.warn('Local backup unavailable')}
let view='home',filter='today',journalType='temperature',aiConnected=false,statusKnown=false,busy=false,recognition=null,voiceTarget=null,conversation=false,speaking=false,pending=null,lastTask=null,awaitingDailyPlans=false,startupGreetingSpoken=false;
let tts=read('farrukh_mobile_tts',true);let draft=read('farrukh_studio_cost',{name:'',yield:0,portions:1,sale:0,pack:0,rows:[]});
const pages=[['home','⌂','Главная','Обзор дня'],['tasks','✓','Задачи','Мой день'],['recipes','▤','ТТК','Рецептуры и ТТК'],['cost','◷','Расчёт','Калькулятор блюда'],['journals','▥','Журналы','Журналы кухни'],['reports','▦','Отчёты','Frontpad · живые данные'],['chat','✦','Помощница','Разговор с помощницей'],['settings','⚙','Ещё','Настройки и данные']];
const fmt=n=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:2});
function day(offset=0){const d=new Date();const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const v=Object.fromEntries(p.map(x=>[x.type,x.value]));const t=new Date(`${v.year}-${v.month}-${v.day}T12:00:00Z`);t.setUTCDate(t.getUTCDate()+offset);return t.toISOString().slice(0,10)}
const taskDate=t=>t.dueDate||t.date||(t.dueAt?new Date(t.dueAt).toLocaleDateString('en-CA',{timeZone:'Europe/Moscow'}):'');
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),4000)}
function persist(k,next){put(keys[k],next);data[k]=next}
function safe(fn){try{return fn()}catch(e){toast('Не удалось сохранить. Проверь свободное место в браузере.');console.error(e)}}
function go(v){if(!pages.some(p=>p[0]===v))v='home';view=v;location.hash=v;render()}
function button(label,attrs='',cls='secondary'){return `<button class="${cls}" ${attrs}>${label}</button>`}
function empty(title,desc){return `<div class="empty"><strong>${title}</strong>${desc}</div>`}
function field(name,label,type='text',value='',required=false){return `<label>${label}<input class="field" name="${name}" type="${type}" value="${E(value)}" ${required?'required':''} ${type==='number'?'step="any" min="0"':''}></label>`}
function area(name,label,value='',required=false){return `<label>${label}<textarea class="field" name="${name}" ${required?'required':''}>${E(value)}</textarea></label>`}
function select(name,label,items,value=''){return `<label>${label}<select class="field" name="${name}">${items.map(([v,t])=>`<option value="${E(v)}" ${v===value?'selected':''}>${E(t)}</option>`).join('')}</select></label>`}
function modal(title,html,save){$('#editorTitle').textContent=title;$('#editorFields').innerHTML=html;$('#formError').textContent='';$('#editorForm').onsubmit=e=>{e.preventDefault();try{save(Object.fromEntries(new FormData(e.target)));$('#editor').close()}catch(err){$('#formError').textContent=err.message||'Не удалось сохранить запись'}};$('#editor').showModal()}
$('#closeEditor').onclick=()=>$('#editor').close();
function tasksList(tasks){return tasks.length?tasks.map(t=>{const i=data.tasks.indexOf(t);return `<div class="task-row ${t.done?'done':''}"><input aria-label="Выполнено: ${E(t.text)}" type="checkbox" data-toggle-task="${i}" ${t.done?'checked':''}><div><b>${E(t.text)}</b><small>${E(taskDate(t)||'Без даты')}${t.time?' · '+E(t.time):''}${t.priority==='high'?' · Важная':''}</small></div><div class="task-actions"><button data-edit-task="${i}" aria-label="Изменить задачу">✎</button></div></div>`}).join(''):empty('Здесь пока спокойно','Добавь задачу вручную или продиктуй помощнице.')}
function taskEditor(i){const t=data.tasks[i]||{text:'',priority:'normal',dueDate:day()};modal(i===undefined?'Новая задача':'Изменить задачу',field('text','Что нужно сделать','text',t.text,true)+`<div class="field-row">${field('dueDate','Дата','date',taskDate(t))}${field('time','Время, необязательно','time',t.time||'')}</div>`+select('priority','Приоритет',[['normal','Обычная'],['high','Важная']],t.priority),v=>{const list=[...data.tasks];const obj={...t,...v,text:v.text.trim(),id:t.id||id(),done:!!t.done,dueAt:v.dueDate&&v.time?new Date(v.dueDate+'T'+v.time+':00+03:00').toISOString():null};if(!obj.text)throw Error('Напиши название задачи');if(i===undefined)list.unshift(obj);else list[i]=obj;persist('tasks',list);render();toast('Задача сохранена')})}
const waves='<span class="waves"><i></i><i></i><i></i><i></i><i></i></span>';
function tools(){return `<div class="section-label"><h3>Инструменты шефа</h3><span>От идеи до готового блюда</span></div><div class="tools-grid">${[['recipes','▤','Рецептуры и ТТК','Состав, технология, единый стиль'],['cost','◷','Калькулятор блюда','Себестоимость, маржа и КБЖУ'],['journals','▥','Журналы кухни','Бракераж, дефростация, температура'],['tasks','✓','Мой день','Задачи, приоритеты и заметки']].map(([v,icon,title,sub])=>`<button class="tool" data-view="${v}"><span class="tool-icon">${icon}</span><span class="arrow">↗</span><b>${title}</b><small>${sub}</small></button>`).join('')}</div>`}
function home(){
 const todays=data.tasks.filter(t=>taskDate(t)===day()),done=todays.filter(t=>t.done).length;
 const overdue=data.tasks.filter(t=>!t.done&&taskDate(t)&&taskDate(t)<day());
 const urgent=todays.filter(t=>!t.done&&t.priority==='high');
 const attention=[...urgent,...overdue.filter(t=>!urgent.includes(t))].slice(0,3);
 const reportCount=(data.reports||[]).length;
 const journalToday=(data.journals||[]).filter(j=>(j.date||j.createdAt||'').slice(0,10)===day()).length;
 const taskRows=todays.slice(0,3).length?todays.slice(0,3).map(t=>{const i=data.tasks.indexOf(t);return `<div class="north-task ${t.done?'done':''}"><input aria-label="Выполнено: ${E(t.text)}" type="checkbox" data-toggle-task="${i}" ${t.done?'checked':''}><div><b>${E(t.text)}</b><small>${E(t.time||'Сегодня')}${t.priority==='high'?' · Важная':''}</small></div></div>`}).join(''):`<div class="north-empty">На сегодня задач пока нет</div>`;
 const attentionHtml=attention.length?attention.map(t=>`<button class="attention-item" data-view="tasks"><span class="attention-dot"></span><div><b>${E(t.text)}</b><small>${taskDate(t)<day()?'Просрочено':'Требует внимания сегодня'}</small></div><span>→</span></button>`).join(''):`<div class="attention-clear"><span>✓</span><div><b>Критичных задач нет</b><small>Можно работать по плану дня</small></div></div>`;
 return `<section class="north-home">
   <div class="aurora-layer aurora-a"></div><div class="aurora-layer aurora-b"></div><div class="weather-fx" id="weatherFx"></div><div class="north-model" aria-hidden="true"></div>
   <div class="north-top">
     <div class="north-time"><strong id="homeClock">--:--</strong><span id="homeDate">Сегодня</span><small>Мурманск</small></div>
     <div class="north-weather" id="homeWeather"><div class="weather-icon" id="weatherIcon">☁️</div><div><b id="weatherTemp">—°</b><span id="weatherLabel">Погода</span><small id="weatherFeels">Обновляю…</small></div></div>
   </div>
   <div class="north-assistant" id="northAssistant">
     <div class="assistant-mini" aria-hidden="true"><span class="assistant-face-glow"></span></div>
     <div class="assistant-orb"></div>
     <div class="assistant-copy"><div class="assistant-state"><i></i><span id="assistantStateLabel">Готова к работе</span></div><b id="northGreeting">Здравствуйте, шеф!</b><span id="northWish">Хорошего дня!</span><p>Сегодня у вас ${todays.length} ${todays.length===1?'задача':'задачи'}. Я могу открыть нужный раздел, записать задачу или разобрать рабочие данные голосом.</p></div>
     <div class="assistant-wave">${waves}</div>
   </div>
   <div class="command-center glass-panel">
     <div class="command-head"><div><span>КОМАНДНЫЙ ЦЕНТР</span><b>Что требует внимания</b></div><div class="command-kpis"><span><b>${urgent.length}</b> важных</span><span><b>${overdue.length}</b> просрочено</span><span><b>${journalToday}</b> записей журнала</span><span><b>${reportCount}</b> отчётов</span></div></div>
     <div class="attention-list">${attentionHtml}</div>
   </div>
   <div class="north-tasks glass-panel">
     <div class="north-section-head"><b>Задачи на сегодня</b><button data-view="tasks">Смотреть все →</button></div>
     <div class="north-progress"><span style="width:${todays.length?done/todays.length*100:0}%"></span></div>
     ${taskRows}
   </div>
   <div class="north-shortcuts">
     <button data-view="journals"><span>✎</span><b>Заметки</b></button>
     <button data-view="tasks"><span>✓</span><b>Задачи</b></button>
     <button data-view="cost"><span>▣</span><b>Расчёт</b></button>
     <button data-view="recipes"><span>▤</span><b>ТТК</b></button>
   </div>
   <button class="north-talk" data-start-chat><span>🎙</span><b>С чем помочь?</b><i>✦</i></button>
 </section>`;
}
function tasksPage(){const match=t=>filter==='all'||filter==='today'&&taskDate(t)===day()||filter==='tomorrow'&&taskDate(t)===day(1)||filter==='later'&&taskDate(t)>day(1)||filter==='overdue'&&!t.done&&taskDate(t)&&taskDate(t)<day();return `<div class="toolbar"><div class="tabs">${[['today','Сегодня'],['tomorrow','Завтра'],['later','Позже'],['overdue','Просрочены'],['all','Все']].map(([v,l])=>button(l,`data-filter="${v}"`,filter===v?'active':'')).join('')}</div>${button('+ Задача','data-new-task','primary')}</div><div class="grid2"><section class="card">${tasksList(data.tasks.filter(match))}</section><section class="card"><div class="card-head"><h3>Идеи и решения</h3>${button('+','data-new-note','icon-button')}</div>${data.notes.length?data.notes.slice().reverse().map(n=>`<div class="task-row"><div><b>${E(n.text)}</b><small>${E(n.date)}</small></div></div>`).join(''):empty('Не потеряй мысль','Скажи: «Сохрани идею: новый ролл с креветкой».')}<button class="subtle" data-view="chat">Продиктовать помощнице →</button></section></div>`}
function noteEditor(){modal('Идея или решение',area('text','Твоя заметка','',true),v=>{persist('notes',[...data.notes,{id:id(),text:v.text.trim(),date:day()}]);render();toast('Заметка сохранена')})}
function recipeEditor(i){const r=data.recipes[i]||{};modal('Рецептура · черновик',field('name','Название блюда','text',r.name||'',true)+area('ingredients','Ингредиенты и граммовки',r.ingredients||'',true)+field('yield','Выход готового блюда, г','number',r.yield||'')+area('technology','Технология приготовления',r.technology||'')+area('storage','Условия хранения и основание срока годности',r.storage||'')+'<p class="help">Оформление утверждённой ТТК добавим по твоему образцу. Пока сохраняется рабочая рецептура.</p>',v=>{const list=[...data.recipes];const item={...r,...v,id:r.id||id(),updatedAt:new Date().toISOString(),status:'draft'};if(i===undefined)list.push(item);else list[i]=item;persist('recipes',list);render();toast('Черновик рецептуры сохранён')})}
function recipesPage(){return `<div class="toolbar"><p class="muted">Твоя коллекция блюд и полуфабрикатов</p>${button('+ Новое блюдо','data-new-recipe','primary')}</div><div class="notice">Шаблон ТТК ожидает твой образец. Уже можно сохранять состав и технологию. Эти черновики не являются утверждёнными ТТК.</div>${data.recipes.length?`<div class="grid2">${data.recipes.map((r,i)=>`<article class="card recipe-card"><div class="card-head"><h3>${E(r.name)}</h3><span class="tag">Черновик</span></div><p style="white-space:pre-wrap">${E(r.ingredients)}</p><div class="metric"><span>Выход</span><b>${r.yield?E(r.yield)+' г':'Не указан'}</b></div><div style="display:flex;gap:12px;margin-top:18px">${button('Открыть',`data-edit-recipe="${i}"`)}${button('Скачать черновик',`data-export-recipe="${i}"`,'subtle')}</div></article>`).join('')}</div>`:empty('Первое блюдо — начало коллекции','Создай рецептуру вручную или скажи помощнице: «Создай ТТК».')}`}
const nutritionFoods=[
 {name:'Лосось сырой (атлантический)',aliases:['лосось','семга','лосось сырой','семга сырая'],kcal:208,p:20.42,f:13.42,c:0,source:'https://whatyoueat.io/foods/175167-farmed-atlantic-salmon'},
 {name:'Огурец свежий с кожурой',aliases:['огурец','огурцы','огурец свежий'],kcal:15,p:0.65,f:0.11,c:3.63,source:'https://whatyoueat.io/foods/168409-cucumber'},
 {name:'Рис белый варёный без заправки',aliases:['рис','рис готовый','рис вареный','рис отварной'],kcal:130,p:2.69,f:0.28,c:28.17,source:'https://fooddata.the50.store/ingredients/20045-rice-white-long-grain-regular-enriched-cooked'}
];
const foodKey='farrukh_studio_foods_v1';
let userFoods=read(foodKey,[]);if(!Array.isArray(userFoods))userFoods=[];
function foodName(n){return String(n||'').trim().toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ')}
function lookupFood(name){const n=foodName(name);return userFoods.find(f=>foodName(f.name)===n)||nutritionFoods.find(f=>foodName(f.name)===n||f.aliases.includes(n))}
function fillFood(r,renamed=false){const food=lookupFood(r.name);if(food){for(const k of ['kcal','p','f','c'])r[k]=food[k];r.nutritionLabel=food.name;r.nutritionSource=food.source||'';r.nutritionAuto=true}else if(renamed){for(const k of ['kcal','p','f','c'])r[k]='';r.nutritionLabel='';r.nutritionSource='';r.nutritionAuto=false}}
for(const r of draft.rows){if(r.explicitGross===undefined){const g=r.gross!==undefined&&r.gross!==''?Number(r.gross):Number(r.grams)/(1-Number(r.loss||0)/100);r.explicitGross=Number.isFinite(g)&&g!==Number(r.grams);if(r.explicitGross)r.gross=g}if(!['kcal','p','f','c'].every(k=>amount(r[k])))fillFood(r)}
function amount(v){return v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>=0}
function rowGross(r){return r.gross!==undefined&&r.gross!==''?Number(r.gross):Number(r.grams)}
function rowValid(r){return !!r.name.trim()&&amount(r.grams)&&Number(r.grams)>0&&Number.isFinite(rowGross(r))&&rowGross(r)>=Number(r.grams)}
function calc(d){
 let cost=0,kcal=0,p=0,f=0,c=0,weight=0,grossWeight=0,priced=true,nutrition=true;
 for(const r of d.rows){const w=Number(r.grams)||0,gross=rowGross(r);weight+=w;grossWeight+=Number.isFinite(gross)?gross:0;if(!amount(r.price))priced=false;cost+=gross/1000*(Number(r.price)||0);for(const key of ['kcal','p','f','c'])if(!amount(r[key]))nutrition=false;kcal+=w/100*(Number(r.kcal)||0);p+=w/100*(Number(r.p)||0);f+=w/100*(Number(r.f)||0);c+=w/100*(Number(r.c)||0)}
 cost+=Number(d.pack)||0;const portions=Number(d.portions),portionCost=portions>0?cost/portions:0,sale=Number(d.sale)||0,target=Number(d.targetFoodcost??30),output=weight;
 return {cost,portionCost,priced,nutrition,weight,grossWeight,output,kcal,p,f,c,foodcost:sale?portionCost/sale*100:null,margin:sale?(sale-portionCost)/sale*100:null,markup:portionCost?(sale-portionCost)/portionCost*100:null,difference:sale-portionCost,suggested:target>0&&target<=100?portionCost/(target/100):null}
}
function costInput(r,i,k,label){return `<input aria-label="${label} ${i+1}" class="field" data-row="${i}" data-key="${k}" value="${E(k==='gross'?(r.gross??(Number.isFinite(rowGross(r))?rowGross(r):'')):(r[k]??''))}" type="${k==='name'?'text':'number'}" ${k==='name'?'list="foodSuggestions" autocomplete="off"':'min="0" step="any"'}>`}
function costPage(){return `<div class="toolbar"><p class="muted">Брутто · нетто · себестоимость</p>${button('Сохранить рецептуру','data-cost-save','primary')}</div><datalist id="foodSuggestions">${[...userFoods,...nutritionFoods].map(f=>`<option value="${E(f.name)}"></option>`).join('')}</datalist><div class="grid2"><section class="card">${field('dish','Название блюда','text',draft.name)}<div class="table-wrap"><table><thead><tr><th>Ингредиент</th><th>Брутто, г</th><th>Нетто, г</th><th>Цена, ₽/кг</th><th>Потери</th><th>Стоимость, ₽</th><th></th></tr></thead><tbody>${draft.rows.map((r,i)=>`<tr>${[['name','Ингредиент'],['gross','Брутто'],['grams','Нетто'],['price','Цена за килограмм']].map(([k,l])=>`<td>${costInput(r,i,k,l)}${k==='name'?`<small data-row-error="${i}" role="status"></small>`:''}</td>`).join('')}<td data-loss-result="${i}"></td><td data-price-result="${i}"></td><td><button class="subtle" data-remove-row="${i}" aria-label="Удалить ингредиент ${i+1}">×</button></td></tr>`).join('')}</tbody></table></div><button class="subtle" data-add-row>+ Ингредиент</button><h3>Общий вес и выход</h3><div class="field-row"><label>Общее брутто, г<input class="field" id="grossTotal" readonly aria-label="Общее брутто, г"></label><label>Готовый выход (сумма нетто), г<input class="field" id="netTotal" readonly aria-label="Готовый выход (сумма нетто), г"></label></div><div id="weightResult"></div>${field('portions','Количество порций','number',draft.portions)}<div class="field-row">${field('pack','Упаковка на всю партию, ₽','number',draft.pack)}${field('sale','Наша цена за порцию, ₽','number',draft.sale)}</div>${field('targetFoodcost','Целевой фудкост, %','number',draft.targetFoodcost??30)}</section><section class="card"><span class="eyebrow">ИТОГ РАСЧЁТА</span><div id="costResult"></div><details style="margin-top:16px"><summary>Уточнить КБЖУ продуктов</summary><p class="help">Значения на 100 г продукта. Известные продукты заполняются автоматически; свои данные можно сохранить с этикетки.</p>${draft.rows.map((r,i)=>`<div style="padding:12px 0"><b data-nutrition-name="${i}">${E(r.name||'Ингредиент '+(i+1))}</b><p class="help" data-food-status="${i}"></p><div class="field-row">${[['kcal','Ккал'],['p','Белки'],['f','Жиры'],['c','Углеводы']].map(([k,l])=>`<label>${l}${costInput(r,i,k,l)}</label>`).join('')}</div>${button('Запомнить продукт',`data-save-food="${i}"`)}</div>`).join('')}</details><p class="help">КБЖУ — справочная оценка или данные твоих этикеток. Маржа не учитывает труд, аренду, налоги и доставку.</p></section></div>`}
function renderCost(){
 const x=calc(draft),valid=draft.rows.length>0&&draft.rows.every(rowValid)&&Number(draft.portions)>0,priced=valid&&x.priced&&amount(draft.pack),metric=(l,v,u='')=>`<div class="metric"><span>${l}</span><b>${v===null?'—':fmt(v)+u}</b></div>`;
 draft.rows.forEach((r,i)=>{const gross=rowGross(r),ok=rowValid(r),loss=$(`[data-loss-result="${i}"]`),price=$(`[data-price-result="${i}"]`),name=$(`[data-nutrition-name="${i}"]`);if(loss)loss.textContent=ok?fmt((gross-Number(r.grams))/gross*100)+'% ('+fmt(gross-Number(r.grams))+' г)':'—';if(price)price.textContent=ok&&amount(r.price)?fmt(gross/1000*Number(r.price))+' ₽':'—';const status=$(`[data-food-status="${i}"]`),error=$(`[data-row-error="${i}"]`);if(status)status.textContent=['kcal','p','f','c'].every(k=>amount(r[k]))?(r.nutritionAuto?'КБЖУ автоматически: '+r.nutritionLabel+' · справочные значения':'КБЖУ по введённым данным'):'КБЖУ: продукт не найден. Выбери из подсказок или открой «Уточнить КБЖУ продуктов» и запомни данные этикетки.';if(error)error.textContent=gross<Number(r.grams)?'Нетто больше брутто. Проверь веса этой строки.':'';if(name)name.textContent=r.name||'Ингредиент '+(i+1)});
 $('#grossTotal').value=fmt(x.grossWeight);$('#netTotal').value=fmt(x.weight);$('#weightResult').innerHTML=metric('Вес одной порции',valid?x.output/Number(draft.portions):null,' г');
 $('#costResult').innerHTML=`<div class="big-number">${priced?fmt(x.portionCost)+' ₽':'—'}</div><p class="help">Себестоимость одной порции</p>${!valid||!priced?'<div class="notice">Внеси ингредиенты, брутто не меньше нетто, положительное нетто, количество порций и закупочные цены. Пустая цена не считается нулевой.</div>':''}${metric('Себестоимость всего блюда / партии',priced?x.cost:null,' ₽')}${metric('Общий готовый вес',valid?x.output:null,' г')}${metric('Наша цена за порцию',priced&&draft.sale>0?Number(draft.sale):null,' ₽')}${metric('Предлагаемая цена за порцию',priced?x.suggested:null,' ₽')}<p class="help">Предлагаемая цена = себестоимость порции ÷ (целевой фудкост / 100). Цель должна быть больше 0 и не больше 100%.</p>${[['Фудкост',x.foodcost,'%'],['Маржа до прочих расходов',x.margin,'%'],['Наценка',x.markup,'%'],['Остаток с порции',x.difference,' ₽']].map(([l,v,u])=>metric(l,priced&&draft.sale>0?v:null,u)).join('')}<h3 style="margin-top:28px">Расчётное КБЖУ</h3>${!x.nutrition?'<p class="help">Не для всех продуктов найдены КБЖУ. Открой «Уточнить КБЖУ продуктов» ниже — после заполнения итог появится автоматически.</p>':''}<div class="table-wrap"><table><thead><tr><th>Показатель</th><th>На 100 г</th><th>На порцию</th></tr></thead><tbody>${[['Ккал','kcal'],['Белки, г','p'],['Жиры, г','f'],['Углеводы, г','c']].map(([l,k])=>`<tr><th>${l}</th>${[x[k]/x.output*100,x[k]/Number(draft.portions)].map(v=>`<td>${valid&&x.nutrition&&x.output>0?fmt(v):'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
}
const journalNames={temperature:'Температурный режим',defrost:'Дефростация',quality:'Бракераж'};
let journalMonth=day().slice(0,7),journalPoint='';
const journalFields={temperature:[['date','Дата','date',1],['time','Время замера','time',1],['equipment','Название / номер оборудования','text',1],['temperature','Измеренная температура, °C','signed',1],['min','Допустимый минимум, °C','signed'],['max','Допустимый максимум, °C','signed'],['basis','Основание диапазона / инструкция','text']],quality:[['produced','Дата и время изготовления','datetime-local',1],['date','Дата бракеража','date',1],['time','Время снятия бракеража','time',1],['product','Наименование блюда / партии','text',1],['assessment','Органолептическая оценка и степень готовности','area',1],['decision','Решение','decision',1],['released','Дата и время разрешения к реализации','datetime-local'],['position','Должность исполнителя','text',1],['inspector','ФИО лица, проводившего бракераж','text',1]],defrost:[['start','Дата и время начала дефростации','datetime-local',1],['product','Наименование сырья / полуфабриката','text',1],['weight','Масса, кг','number',1],['supplier','Поставщик','text',1],['batch','Номер партии / накладной','text',1],['startTemp','Температура сырья перед началом, °C','signed',1],['end','Дата и время окончания','datetime-local'],['endTemp','Температура сырья в конце, °C','signed'],['assessment','Органолептическая оценка','area'],['conditions','Способ и фактические условия дефростации','area']]};
function jInput(k,l,t,v,required){if(t==='area')return area(k,l,v,required);if(t==='decision')return select(k,l,[['','Выбери результат'],['Допущено','Допущено'],['Не допущено','Не допущено']],v);if(t==='signed')return `<label>${E(l)}<input class="field" name="${k}" type="number" step="0.1" value="${E(v)}" ${required?'required':''}></label>`;return field(k,l,t,v,required)}
function jDate(j){return j.type==='defrost'?(j.start||j.date||'').slice(0,10):j.date||''}
function journalRows(){return data.journals.filter(j=>j.type===journalType&&jDate(j).startsWith(journalMonth)&&(!journalPoint||j.point===journalPoint))}
function jDeviation(j){const t=Number(j.temperature);return j.type==='temperature'&&j.temperature!==''&&j.temperature!=null&&((j.min!==''&&j.min!=null&&t<Number(j.min))||(j.max!==''&&j.max!=null&&t>Number(j.max)))}
function journalEditor(type=journalType,initial={}){
 const existing=initial.id?data.journals.find(j=>j.id===initial.id):null;
 const common=field('organization','Организация','text',initial.organization||localStorage.getItem('farrukh_journal_organization')||'',true)+field('point','Точка / кухня','text',initial.point||journalPoint,true)+field('responsible','ФИО ответственного исполнителя','text',initial.responsible||'',true);
 const extra=journalFields[type].map(([k,l,t,r])=>jInput(k,l,t,initial[k]??(k==='date'?day():''),r)).join('');
 modal(journalNames[type]+(existing?' · изменение записи':' · новая запись'),'<p class="help">По предоставленному образцу. Проверь фактические данные перед сохранением. ФИО в приложении не заменяет подпись.</p><div class="journal-fields">'+common+extra+area('note','Примечание / корректирующие действия',initial.note||'')+(existing?area('changeReason','Причина изменения', '',true):'')+'</div>',v=>{
  for(const [k,l,t,r] of journalFields[type])if(r&&!String(v[k]||'').trim())throw Error('Заполни: '+l);
  for(const [k,l,t] of journalFields[type])if((t==='signed'||t==='number')&&v[k]!==''&&!Number.isFinite(Number(v[k])))throw Error('Некорректное число: '+l);
  if(type==='temperature'){if(v.min!==''&&v.max!==''&&Number(v.min)>Number(v.max))throw Error('Минимум не может превышать максимум');if(jDeviation({...v,type})&&!v.note.trim())throw Error('Температура вне заданного диапазона. Укажи корректирующие действия.');}
  if(type==='quality'){const checked=v.date+'T'+v.time;if(v.produced>checked)throw Error('Бракераж не может быть раньше изготовления');if(v.decision==='Допущено'&&!v.released)throw Error('Укажи время разрешения к реализации');if(v.released&&v.released<checked)throw Error('Разрешение не может быть раньше бракеража');if(v.decision==='Не допущено'&&v.released)throw Error('Для недопущенной продукции убери время разрешения');}
  if(type==='defrost'){if(!(Number(v.weight)>0))throw Error('Масса должна быть больше нуля');if(v.end&&v.end<v.start)throw Error('Окончание раньше начала');if(v.end&&(v.endTemp===''||!v.assessment.trim()))throw Error('Для завершения укажи конечную температуру и оценку');if(!v.end&&(v.endTemp!==''||v.assessment.trim()))throw Error('Укажи время окончания либо оставь результаты завершения пустыми');}
  const item={...initial,...v,type,id:initial.id||id(),createdAt:initial.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  if(existing)item.history=[...(existing.history||[]),{at:new Date().toISOString(),reason:v.changeReason,before:Object.fromEntries(Object.entries(existing).filter(([k])=>k!=='history'))}];
  const next=existing?data.journals.map(j=>j.id===item.id?item:j):[...data.journals,item];persist('journals',next);try{localStorage.setItem('farrukh_journal_organization',v.organization)}catch{}render();toast('Запись сохранена');
 });
 // Each dictation fills only the chosen field; no measurements or approvals are inferred.
 document.querySelectorAll('#editorFields input[type=text],#editorFields input[type=number],#editorFields textarea').forEach(input=>{const b=document.createElement('button');b.type='button';b.className='subtle';b.textContent='♩ Продиктовать';b.onclick=()=>{stop();mic(text=>{if(input.type==='number'){const n=text.toLowerCase().replace(/минус/g,'-').replace(/плюс/g,'').replace(/,/g,'.').replace(/\s+/g,'').match(/^-?\d+(?:\.\d+)?/);if(!n){toast('Число не распознано. Введи вручную.');return}input.value=n[0]}else input.value=text;toast('Распознано. Проверь поле и нажми «Сохранить».')})};input.after(b)});
}
function journalTable(rows,printing=false){
 const fields=[['point','Точка'],...journalFields[journalType].map(([k,l])=>[k,l]),['responsible','Ответственный'],['note','Примечание']];
 return `<div class="table-wrap"><table><thead><tr><th>№</th>${fields.map(([,l])=>'<th>'+E(l)+'</th>').join('')}${printing?'<th>Подпись</th>':'<th></th>'}</tr></thead><tbody>${rows.map((j,i)=>`<tr><td>${i+1}</td>${fields.map(([k])=>'<td>'+E(j[k]??'')+'</td>').join('')}<td>${printing?'________________':button(j.type==='defrost'&&!j.end?'Завершить':'Открыть',`data-j-edit="${E(j.id)}"`)+(jDeviation(j)?'<span class="tag">Отклонение</span>':'')+(j.history?.length?'<small>Исправлений: '+j.history.length+'</small>':'')}</td></tr>`).join('')}</tbody></table></div>`;
}
function temperatureMatrix(rows){const days=new Date(Number(journalMonth.slice(0,4)),Number(journalMonth.slice(5,7)),0).getDate();const groups=[...new Set(rows.map(j=>j.point+' / '+j.equipment))];return `<div class="table-wrap"><table><thead><tr><th>Оборудование / точка</th>${Array.from({length:days},(_,i)=>'<th>'+(i+1)+'</th>').join('')}</tr></thead><tbody>${groups.map(g=>'<tr><th>'+E(g)+'</th>'+Array.from({length:days},(_,i)=>'<td>'+rows.filter(j=>j.point+' / '+j.equipment===g&&Number(j.date.slice(-2))===i+1).map(j=>E(j.temperature)+'°<br><small>'+E(j.time)+' · '+E(j.responsible)+'</small>').join('<hr>')+'</td>').join('')+'</tr>').join('')}</tbody></table></div>`}
function journalsPage(){const rows=journalRows();return `<div class="toolbar"><div class="tabs">${Object.entries(journalNames).map(([v,l])=>button(l,`data-journal-type="${v}"`,journalType===v?'active':'')).join('')}</div>${button('+ Запись','data-new-journal','primary')}</div><div class="card"><div class="field-row">${field('jmonth','Месяц','month',journalMonth)}${select('jpoint','Точка',[['','Все точки'],...[...new Set(data.journals.map(j=>j.point).filter(Boolean))].map(p=>[p,p])],journalPoint)}</div><p class="help">Формы по твоим образцам. Данные хранятся в этом браузере — скачивай резервную копию в настройках. Подтверждение полного нормативного соответствия и электронная подпись не включены.</p></div><section class="card"><div class="card-head"><h3>${journalNames[journalType]} · ${rows.length} записей</h3><div>${button('CSV','data-export-journal','subtle')}${button('Печать / PDF','data-j-print','secondary')}</div></div>${rows.length?journalTable(rows):empty('Записей за этот месяц нет','Внеси фактическую проверку. Старые данные образца не перенесены.')}${journalType==='temperature'&&rows.length?'<h3>Календарь замеров</h3>'+temperatureMatrix(rows):''}</section>`}
function printJournal(){const rows=journalRows();if(!rows.length)return toast('Нет записей для печати');let p=document.getElementById('journal-print');if(!p){p=document.createElement('div');p.id='journal-print';document.body.append(p)}p.innerHTML='<h2>Журнал: '+E(journalNames[journalType])+'</h2><p>Месяц: '+E(journalMonth)+' · '+E(journalPoint||'Все точки')+'</p><p>Организация: '+E([...new Set(rows.map(j=>j.organization||'Не указана'))].join('; '))+'</p>'+journalTable(rows,true)+(journalType==='temperature'?'<h3>Температурный режим — календарь</h3>'+temperatureMatrix(rows):'')+'<p>Ответственный за ведение: ____________________ Подпись: ____________________</p>';window.print()}
const jStyle=document.createElement('style');jStyle.textContent='#journal-print{display:none}.journal-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.journal-fields label{min-width:0}@media(max-width:650px){.journal-fields{grid-template-columns:1fr}}@media print{@page{size:A4 landscape;margin:10mm}body>*{display:none!important}#journal-print{display:block!important;color:#000;background:white;font:9px Arial}#journal-print table{border-collapse:collapse;width:100%;font-size:8px}#journal-print th,#journal-print td{border:1px solid #555;padding:4px;overflow-wrap:anywhere}#journal-print thead{display:table-header-group}#journal-print tr{break-inside:avoid}#journal-print .table-wrap{overflow:visible}#journal-print h3{break-before:page}}';document.head.append(jStyle);
document.addEventListener('change',e=>{if(e.target.name==='jmonth'){journalMonth=e.target.value||day().slice(0,7);render()}if(e.target.name==='jpoint'){journalPoint=e.target.value;render()}});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.jEdit){const j=data.journals.find(j=>j.id===b.dataset.jEdit);if(j)journalEditor(j.type,j)}if(b.hasAttribute('data-j-print'))printJournal()});

function chatPage(){return `<div class="chat-layout"><div class="chat-portrait" aria-label="Образ помощницы"></div><section class="card chat-panel"><div class="card-head"><div><h3>Я рядом, Фаррух Ака</h3><span class="caption" id="voiceState">${aiConnected?'AI подключён':'Команды доступны · свободный диалог требует AI'}</span></div>${waves}</div><div class="messages" id="messages"></div><div id="pending"></div><form class="composer" id="chatForm"><textarea class="field" id="message" rows="1" aria-label="Сообщение помощнице" placeholder="Напиши или продиктуй…" required></textarea><button class="primary" type="submit" aria-label="Отправить" ${busy?'disabled':''}>↑</button></form><div class="chat-controls">${button('♩ Говорить','data-mic')}${button(conversation?'Остановить разговор':'Режим разговора','data-conversation')}${button('Остановить голос','data-stop','subtle')}</div><p class="help">Голос устройства. Нажми «Говорить» для одной команды; в режиме разговора микрофон включается после ответа и останавливается при тишине или ошибке.</p></section></div>`}
function renderMessages(){const box=$('#messages');if(!box)return;box.innerHTML=data.chat.length?data.chat.filter(m=>!m.temp).slice(-60).map(m=>`<div class="message ${m.role==='user'?'user':'assistant'}">${E(m.text)}</div>`).join(''):empty('О чём поговорим?','«Запиши задачу на завтра проверить рис»<br>«Сохрани идею: новый соус»<br>«Открой журнал температуры»');if(busy)box.innerHTML+='<div class="message assistant">Обдумываю…</div>';box.scrollTop=box.scrollHeight;const p=$('#pending');p.innerHTML=pending?`<div class="pending"><p>${E(pending.description)}</p>${button('Подтвердить','data-confirm','primary')}${button('Отмена','data-cancel-pending')}</div>`:''}
let frontpadUi={status:null,busy:false};
async function loadFrontpadStatus(){
 const box=$('#frontpadConnection'),auth=$('#frontpadAuthBox');if(!box||!auth)return;
 try{
  const r=await fetch('/api/frontpad/status',{cache:'no-store',signal:AbortSignal.timeout(15000)}),d=await r.json();
  frontpadUi.status=d;
  if(!d.configured){box.innerHTML='<div class="notice">Логин и пароль Frontpad ещё не настроены на сервере.</div>';auth.innerHTML='';return}
  if(d.authenticated){box.innerHTML='<div class="notice"><b>✓ Frontpad подключён</b><br>Сессия активна. Логин и пароль берутся с защищённых переменных Render.</div>';auth.innerHTML=button('Открыть отчёты','data-open-frontpad-reports','primary');auth.querySelector('[data-open-frontpad-reports]').onclick=()=>go('reports');return}
  box.innerHTML='<div class="notice"><b>Frontpad готов к подключению</b><br>Нужен только первый вход. Пароль в приложении не показывается и не вводится.</div>';
  auth.innerHTML=button('Начать подключение','data-frontpad-start','primary');
  const b=auth.querySelector('[data-frontpad-start]');if(b)b.onclick=startFrontpadAuth;
 }catch{box.innerHTML='<div class="notice">Не удалось проверить Frontpad. Повтори чуть позже.</div>';auth.innerHTML=''}
}
async function startFrontpadAuth(){
 if(frontpadUi.busy)return;frontpadUi.busy=true;
 const box=$('#frontpadConnection'),auth=$('#frontpadAuthBox');if(box)box.innerHTML='<div class="notice">Открываю защищённую форму Frontpad…</div>';if(auth)auth.innerHTML='';
 try{
  const r=await fetch('/api/frontpad/auth/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)}),d=await r.json();
  if(!r.ok)throw Error(d.error||'Не удалось начать вход');
  if(d.requiresCode){
   box.innerHTML='<div class="notice"><b>Остался один шаг</b><br>Введите код с картинки Frontpad. Логин и пароль сервер подставит сам.</div>';
   auth.innerHTML='<div style="display:grid;gap:12px;max-width:360px"><img id="frontpadCaptcha" src="'+E(d.captchaUrl)+'" alt="Код Frontpad" style="max-width:220px;background:#fff;border-radius:10px;padding:6px"><label>Код с картинки<input id="frontpadCode" class="field" inputmode="text" autocomplete="off"></label><div style="display:flex;gap:10px;flex-wrap:wrap">'+button('Подключить Frontpad','data-frontpad-complete','primary')+button('Обновить картинку','data-frontpad-refresh')+'</div><p class="help" id="frontpadError"></p></div>';
   auth.querySelector('[data-frontpad-complete]').onclick=completeFrontpadAuth;
   auth.querySelector('[data-frontpad-refresh]').onclick=startFrontpadAuth;
   $('#frontpadCode')?.focus();
  }else{
   await completeFrontpadAuth();
  }
 }catch(e){if(box)box.innerHTML='<div class="notice">'+E(e.message||'Ошибка подключения Frontpad')+'</div>';if(auth)auth.innerHTML=button('Попробовать снова','data-frontpad-start','primary');auth?.querySelector('[data-frontpad-start]')?.addEventListener('click',startFrontpadAuth)}
 finally{frontpadUi.busy=false}
}
async function completeFrontpadAuth(){
 if(frontpadUi.busy)return;frontpadUi.busy=true;
 const code=$('#frontpadCode')?.value.trim()||'',err=$('#frontpadError'),btn=document.querySelector('[data-frontpad-complete]');
 if(btn)btn.disabled=true;if(err)err.textContent='Проверяю код…';
 try{
  const r=await fetch('/api/frontpad/auth/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code}),signal:AbortSignal.timeout(25000)}),d=await r.json();
  if(!r.ok)throw Object.assign(new Error(d.error||'Frontpad не принял вход'),{data:d});
  toast('Frontpad подключён');await loadFrontpadStatus();
 }catch(e){
  if(err)err.textContent=e.message||'Не удалось войти';
  const img=$('#frontpadCaptcha');if(img&&e.data?.captchaUrl)img.src=e.data.captchaUrl+'&r='+Date.now();
  const input=$('#frontpadCode');if(input){input.value='';input.focus()}
 }finally{frontpadUi.busy=false;if(btn)btn.disabled=false}
}

let frontpadReports=null;
function reportsPage(){
 return '<div class="toolbar"><div><span class="eyebrow">FRONTPAD</span><h2 style="margin:.35rem 0 0">Центр аналитики</h2><p class="muted">Один файл = одна точка и один тип отчёта. FARRUKH AI распознаёт его автоматически.</p></div><label class="primary" style="display:inline-flex;align-items:center;cursor:pointer">+ Загрузить отчёт<input id="frontpadExportInput" type="file" accept=".xls,.xlsx,.csv" hidden></label></div><div class="fp-guide"><b>Как работает</b><span>Скачай любой отчёт Frontpad для одной точки: «Выручка», «Скидки и наценки», «Каналы продаж», «Товары», «Себестоимость» и другие. После загрузки откроется свой дашборд.</span></div><div id="frontpadHistory"></div><div id="frontpadReports" style="margin-top:16px"><div class="empty"><strong>Загрузи выгрузку Frontpad</strong>После выбора файла появится профессиональный отчёт по этой точке.</div></div>';
}
function reportTable(rows){
 if(!Array.isArray(rows)||!rows.length)return '';
 const width=Math.max(...rows.map(r=>r.length));
 const head=rows[0]||[];
 const body=rows.slice(1,31);
 return '<div class="table-wrap"><table><thead><tr>'+Array.from({length:width},(_,i)=>'<th>'+E(head[i]||'')+'</th>').join('')+'</tr></thead><tbody>'+body.map(r=>'<tr>'+Array.from({length:width},(_,i)=>'<td>'+E(r[i]||'')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
function fpNum(v){
 const s=String(v??'').replace(/\u00a0/g,' ').replace(/\s+/g,'').replace(',','.').replace(/[^\d.-]/g,'');
 const n=Number(s);return Number.isFinite(n)?n:null;
}
function fpHeader(headers,re){return (headers||[]).findIndex(h=>re.test(String(h||'')))}
function fpMoney(v){return Number(v||0).toLocaleString('ru-RU',{maximumFractionDigits:0})+' ₽'}
function fpPeriod(name=''){
 const dates=String(name).match(/\d{2}\.\d{2}\.\d{4}/g)||[];
 if(dates.length<2)return 'Загруженный период';
 const months=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
 const a=dates[0].split('.'),b=dates[1].split('.');
 return a[1]===b[1]&&a[2]===b[2]?months[Number(a[1])-1]+' '+a[2]:dates[0]+' — '+dates[1];
}
function fpReportType(d){
 const sheet=(d?.sheets||[])[0]||{};
 const sampleRows=(sheet.rows||[]).slice(0,25).flat();
 const hay=[d?.fileName,sheet.name,...(sheet.headers||[]),...(sheet.meta||[]).flat(),...sampleRows].join(' ').toLowerCase();
 const types=[
  ['revenue','Выручка',/выручк|оборот|сумма продаж/],['discounts','Скидки и наценки',/скидк|наценк/],['employees','Сотрудники',/сотрудник/],
  ['users','Пользователи',/пользоват/],['channels','Каналы продаж',/канал.*продаж|источник.*заказ/],['marks','Отметки заказов',/отметк.*заказ|статус.*заказ|отмен/],
  ['execution','Время исполнения',/время.*исполн|время.*заказ/],['hourly','Продажи по часам',/продаж.*час|по часам/],['pnl','Прибыль и убытки',/прибыл.*убыт|убыт.*прибыл|валов.*прибыл|маржинальн/],
  ['cohort','Когортный анализ',/когорт/],['cost','Себестоимость',/себестоим|стоимост.*сыр|фактич.*себест/],
  ['movement','Движение сырья',/движен.*сыр|движен.*товар|приход.*расход|начальн.*остат.*конечн.*остат/],
  ['purchases','История закупок',/истори.*закуп|закупк|поставщик.*приход|приход.*поставщик/],['abc','ABC-анализ',/abc|групп[аы]?\s*[abc]|класс\s*[abc]/],
  ['products','Товары',/товар|наименован.*блюд|наименован.*товар|продан.*колич|продажи.*товар/],['expenses','Прочие расходы',/проч.*расход/]
 ];
 return types.find(([, ,re])=>re.test(hay))||['generic','Отчёт Frontpad',/.*/];
}
function fpPointName(d){
 const sheet=(d?.sheets||[])[0]||{}, hay=[d?.fileName,...(sheet.meta||[]).flat()].join(' ');
 const known=['Полярные зори 43/1','Баумана 18','ГС 33а','Плазма'];
 const hit=known.find(x=>hay.toLowerCase().includes(x.toLowerCase()));if(hit)return hit;
 const meta=(sheet.meta||[]).flat().map(x=>String(x||'').trim()).filter(Boolean);
 const tagged=meta.find(x=>/(точк|филиал|подраздел|ресторан|объект)\s*[:—-]/i.test(x));
 return tagged?tagged.replace(/^.*?(?:точк\w*|филиал\w*|подраздел\w*|ресторан\w*|объект\w*)\s*[:—-]\s*/i,'').trim():'Точка не определена';
}
function fpCompactReport(d,m,type){
 return {id:id(),type:type[0],typeTitle:type[1],point:fpPointName(d),period:fpPeriod(d.fileName),fileName:d.fileName,uploadedAt:d.uploadedAt||new Date().toISOString(),revenue:m.revenue||0,orders:m.orders||0,avg:m.avg||0,cancel:m.cancel};
}
function fpSaveReport(item){
 const same=data.reports.findIndex(x=>x.type===item.type&&x.point===item.point&&x.period===item.period);
 const next=[...data.reports];if(same>=0)next[same]=item;else next.unshift(item);persist('reports',next.slice(0,80));
}
function fpHistoryHtml(){
 const rev=data.reports.filter(x=>x.type==='revenue');
 const usable=rev.filter(x=>x.point&&x.point!=='Точка не определена');
 let compare='';
 if(usable.length){
  const byPoint=[...new Map(usable.map(x=>[x.point,x])).values()].slice(0,8);
  const max=Math.max(1,...byPoint.map(x=>x.revenue||0));
  compare='<section class="card fp-compare"><div class="card-head"><div><span class="eyebrow">СЕТЬ</span><h3>Сравнение загруженных точек</h3></div><span class="tag">'+byPoint.length+' точек</span></div><div class="fp-bars">'+byPoint.map(x=>'<div class="fp-bar-row"><div class="fp-bar-head"><b>'+E(x.point)+'</b><span>'+fpMoney(x.revenue)+'</span></div><div class="fp-track"><i style="width:'+Math.max(4,Math.round((x.revenue||0)/max*100))+'%"></i></div><small>'+fmt(x.orders)+' заказов · '+fpMoney(x.avg)+' средний чек · '+E(x.period)+'</small></div>').join('')+'</div></section>';
 }
 const recent=data.reports.slice(0,8);
 return (compare||'')+(recent.length?'<section class="card fp-history"><div class="card-head"><div><span class="eyebrow">ИСТОРИЯ</span><h3>Последние загруженные отчёты</h3></div><span class="tag">'+data.reports.length+'</span></div><div class="fp-history-list">'+recent.map(x=>'<div><span><b>'+E(x.typeTitle)+'</b><small>'+E(x.point)+' · '+E(x.period)+'</small></span><time>'+new Date(x.uploadedAt).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'})+'</time></div>').join('')+'</div></section>':'');
}
function renderSavedFrontpadHistory(){const el=$('#frontpadHistory');if(el)el.innerHTML=fpHistoryHtml()}
function fpGenericDashboard(d,sheet,type){
 const h=sheet.headers||[],rows=sheet.rows||[];
 const cfg={
  cost:{category:/наимен|товар|блюд|сыр|ингредиент/i,metrics:/себестоим|стоимост|сумм|кол-?во|количество|цена|доля|процент/i,title:'Структура себестоимости'},
  movement:{category:/наимен|сыр|товар|ингредиент|склад/i,metrics:/приход|расход|остат|кол-?во|количество|сумм|стоимост/i,title:'Движение и остатки'},
  purchases:{category:/постав|наимен|товар|сыр|документ/i,metrics:/закуп|приход|сумм|стоимост|кол-?во|количество|цена/i,title:'Закупки и поставщики'},
  abc:{category:/наимен|товар|блюд|категор|групп|класс/i,metrics:/выруч|оборот|сумм|кол-?во|количество|доля|процент|марж|прибыл/i,title:'ABC-структура'},
  products:{category:/наимен|товар|блюд|категор/i,metrics:/выруч|оборот|сумм|кол-?во|количество|продаж|себестоим|марж|прибыл/i,title:'Продажи по товарам'}
 }[type[0]]||{category:/наимен|категор|канал|сотруд|пользоват|статус|отметк|час|постав|статья|сыр|товар|блюд/i,metrics:/сумм|выруч|оборот|кол-?во|количество|заказ|скидк|наценк|прибыл|убыт|себестоим|расход|приход|остат|минут|время|процент|доля|марж/i,title:type[1]};
 const categoryI=fpHeader(h,cfg.category);
 const numeric=h.map((x,i)=>({i,label:String(x||'')})).filter(x=>cfg.metrics.test(x.label));
 const sums=numeric.slice(0,4).map(x=>{const vals=rows.map(r=>fpNum(r[x.i])).filter(v=>v!==null);return {label:x.label,value:vals.reduce((a,b)=>a+b,0)}}).filter(x=>Number.isFinite(x.value));
 const moneyLike=/сумм|выруч|оборот|прибыл|убыт|себестоим|расход|приход|стоимост|цена|закуп/i;
 const kpis=(sums.length?sums:[{label:'Строк в отчёте',value:rows.length}]).slice(0,4).map(x=>fpKpi(x.label,moneyLike.test(x.label)?fpMoney(x.value):fmt(x.value),'по загруженному файлу')).join('');
 let bars='';
 if(categoryI>=0&&numeric.length){
  const ni=numeric[0].i,items=rows.map(r=>({name:String(r[categoryI]||'').trim(),value:fpNum(r[ni])})).filter(x=>x.name&&x.value!==null).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).slice(0,12),max=Math.max(1,...items.map(x=>Math.abs(x.value)));
  if(items.length)bars='<div class="fp-bars">'+items.map(x=>'<div class="fp-bar-row"><div class="fp-bar-head"><b>'+E(x.name)+'</b><span>'+(moneyLike.test(numeric[0].label)?fpMoney(x.value):fmt(x.value))+'</span></div><div class="fp-track"><i style="width:'+Math.max(4,Math.round(Math.abs(x.value)/max*100))+'%"></i></div><small>'+E(numeric[0].label)+'</small></div>').join('')+'</div>';
 }
 const badge=type[0]==='generic'?'Формат не определён':'Распознано автоматически';
 return '<div class="fp-report-head"><div><span class="eyebrow">'+E(type[1].toUpperCase())+'</span><h2>'+E(fpPointName(d))+'</h2><p>'+E(fpPeriod(d.fileName))+' · Frontpad · '+E(d.fileName)+'</p></div><span class="tag">'+badge+'</span></div><div class="fp-kpis">'+kpis+'</div><section class="card fp-chart-card"><div class="card-head"><div><span class="eyebrow">АНАЛИТИКА</span><h3>'+E(cfg.title)+'</h3></div></div>'+(bars||'<div class="fp-no-detail"><b>Данных для диаграммы недостаточно</b><span>Все строки файла доступны в подробной таблице ниже.</span></div>')+'</section><details class="card fp-raw" open><summary>Подробная таблица</summary><div style="margin-top:14px">'+uploadTable(sheet.headers,sheet.rows)+'</div></details>';
}
function fpSheetModel(s){
 const h=s.headers||[],rows=(s.rows||[]).filter(r=>Array.isArray(r)&&r.some(x=>String(x??'').trim()));
 const nameI=fpHeader(h,/наимен|точк|филиал|подраздел|ресторан|объект/i);
 const ordersI=fpHeader(h,/заказ/i),checkI=fpHeader(h,/чек/i),sumI=fpHeader(h,/сумм|выруч|оборот/i),cancelI=fpHeader(h,/отмен|возврат/i);
 const total=rows.find(r=>/^(всего|итого|total)$/i.test(String(r[nameI>=0?nameI:0]||'').trim()))||rows[rows.length-1]||[];
 const val=(i,row=total)=>i>=0?fpNum(row[i]):null;
 const points=rows.filter(r=>{
   const n=String(r[nameI>=0?nameI:0]||'').trim();
   return n&&!/^(всего|итого|total)$/i.test(n)&&(ordersI<0||val(ordersI,r)!==null||sumI<0||val(sumI,r)!==null);
 }).map(r=>({name:String(r[nameI>=0?nameI:0]||'Точка').trim(),orders:val(ordersI,r)||0,check:val(checkI,r)||0,revenue:val(sumI,r)||0,cancel:val(cancelI,r)||0}));
 let orders=val(ordersI),avg=val(checkI),revenue=val(sumI),cancel=val(cancelI);
 if(orders===null&&points.length)orders=points.reduce((a,x)=>a+x.orders,0);
 if(revenue===null&&points.length)revenue=points.reduce((a,x)=>a+x.revenue,0);
 if(cancel===null&&cancelI>=0&&points.length)cancel=points.reduce((a,x)=>a+x.cancel,0);
 if((avg===null||!avg)&&orders&&revenue)avg=revenue/orders;
 return {h,rows,total,nameI,ordersI,checkI,sumI,cancelI,points,orders:orders||0,avg:avg||0,revenue:revenue||0,cancel};
}
function fpKpi(label,value,sub=''){
 return '<div class="fp-kpi"><span>'+E(label)+'</span><b>'+E(value)+'</b>'+(sub?'<small>'+E(sub)+'</small>':'')+'</div>';
}
function fpBars(points,totalRevenue){
 if(!points.length)return '<div class="fp-no-detail"><b>В этой выгрузке нет разбивки по точкам</b><span>Сейчас файл содержит общий итог. Если выгрузить отчёт с филиалами/подразделениями, FARRUKH AI автоматически покажет сравнение каждой точки.</span></div>';
 const max=Math.max(...points.map(x=>x.revenue||x.orders||0),1);
 return '<div class="fp-bars">'+points.slice(0,12).map((p,i)=>{
   const base=p.revenue||p.orders||0,pct=Math.max(4,Math.round(base/max*100));
   const share=totalRevenue&&p.revenue?Math.round(p.revenue/totalRevenue*100):0;
   return '<div class="fp-bar-row"><div class="fp-bar-head"><b>'+E(p.name)+'</b><span>'+(p.revenue?fpMoney(p.revenue):fmt(p.orders)+' заказов')+'</span></div><div class="fp-track"><i style="width:'+pct+'%"></i></div><small>'+(p.orders?fmt(p.orders)+' заказов · ':'')+(p.check?fpMoney(p.check)+' средний чек':'')+(share?' · '+share+'% выручки':'')+'</small></div>';
 }).join('')+'</div>';
}
function fpPointsTable(points,hasCancel){
 if(!points.length)return '';
 return '<div class="table-wrap fp-table"><table><thead><tr><th>Точка</th><th>Заказы</th><th>Средний чек</th><th>Выручка</th>'+(hasCancel?'<th>Отмены</th><th>% отмен</th>':'')+'</tr></thead><tbody>'+
 points.map(p=>'<tr><td><b>'+E(p.name)+'</b></td><td>'+fmt(p.orders)+'</td><td>'+fpMoney(p.check)+'</td><td><b>'+fpMoney(p.revenue)+'</b></td>'+(hasCancel?'<td>'+fmt(p.cancel)+'</td><td>'+(p.orders?((p.cancel/p.orders)*100).toFixed(1):'0')+'%</td>':'')+'</tr>').join('')+
 '</tbody></table></div>';
}
function uploadTable(headers,rows){
 const width=Math.max(headers?.length||0,...(rows||[]).map(r=>r.length),1);
 const head=Array.from({length:width},(_,i)=>headers?.[i]||'');
 return '<div class="table-wrap"><table><thead><tr>'+head.map(h=>'<th>'+E(h)+'</th>').join('')+'</tr></thead><tbody>'+(rows||[]).slice(0,80).map(r=>'<tr>'+Array.from({length:width},(_,i)=>'<td>'+E(r[i]||'')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
function renderUploadedFrontpad(d){
 const box=$('#frontpadReports');if(!box)return;
 if(!d?.ok){box.innerHTML='<div class="notice">'+E(d?.error||'Не удалось прочитать файл.')+'</div>';return}
 const when=d.uploadedAt?new Date(d.uploadedAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}):'';
 const sheet=(d.sheets||[])[0];if(!sheet){box.innerHTML='<div class="notice">В файле нет данных.</div>';return}
 const type=fpReportType(d),m=fpSheetModel(sheet),period=fpPeriod(d.fileName),point=fpPointName(d);
 fpSaveReport(fpCompactReport(d,m,type));renderSavedFrontpadHistory();
 if(type[0]!=='revenue'){box.innerHTML=fpGenericDashboard(d,sheet,type);return}
 const completed=m.cancel===null?null:Math.max(0,m.orders-m.cancel),cancelRate=m.cancel===null||!m.orders?null:(m.cancel/m.orders*100);
 const kpis=fpKpi('Общая выручка',fpMoney(m.revenue),period)+fpKpi('Заказы',fmt(m.orders),'за период')+fpKpi('Средний чек',fpMoney(m.avg),'на один заказ')+fpKpi('Отмены',m.cancel===null?'Нет данных':fmt(m.cancel),cancelRate===null?'нет колонки в файле':cancelRate.toFixed(1)+'% от заказов');
 const quality=m.cancel===null?'<div class="fp-quality-empty"><b>Отмены не входят в файл «Выручка»</b><span>Для отмен загрузи отдельный отчёт Frontpad «Отметки заказов». FARRUKH AI покажет его своим дашбордом.</span></div>':'<div class="fp-quality"><div><span>Выполнено</span><b>'+fmt(completed)+'</b></div><div><span>Отменено</span><b>'+fmt(m.cancel)+'</b></div><div><span>Доля отмен</span><b>'+cancelRate.toFixed(1)+'%</b></div></div>';
 box.innerHTML='<div class="fp-report-head"><div><span class="eyebrow">ВЫРУЧКА · ОДНА ТОЧКА</span><h2>'+E(point)+'</h2><p>'+E(period)+' · Frontpad · '+E(d.fileName)+'</p></div><span class="tag">Обработан '+E(when||'только что')+'</span></div><div class="fp-kpis">'+kpis+'</div><div class="fp-dashboard-grid"><section class="card fp-chart-card"><div class="card-head"><div><span class="eyebrow">ДИНАМИКА</span><h3>Детализация периода</h3></div></div>'+fpBars(m.points,m.revenue)+'</section><section class="card"><div class="card-head"><div><span class="eyebrow">КАЧЕСТВО</span><h3>Заказы и отмены</h3></div></div>'+quality+'</section></div>'+(m.points.length?'<section class="card fp-points"><div class="card-head"><div><span class="eyebrow">ДЕТАЛИЗАЦИЯ</span><h3>Строки отчёта</h3></div></div>'+fpPointsTable(m.points,m.cancelI>=0)+'</section>':'')+'<details class="card fp-raw"><summary>Показать исходную таблицу Frontpad</summary><div style="margin-top:14px">'+uploadTable(sheet.headers,sheet.rows)+'</div></details>';
}
async function uploadFrontpadExport(file){
 const box=$('#frontpadReports');if(!file)return;
 if(box)box.innerHTML='<div class="notice">Разбираю выгрузку Frontpad…</div>';
 try{
   const fd=new FormData();fd.append('file',file);
   const r=await fetch('/api/frontpad/upload',{method:'POST',body:fd,signal:AbortSignal.timeout(45000)});
   const d=await r.json();
   if(!r.ok)throw Error(d.error||'Не удалось загрузить файл');
   renderUploadedFrontpad(d);toast('Выгрузка Frontpad загружена');
 }catch(e){
   if(box)box.innerHTML='<div class="notice">'+E(e.message||'Не удалось прочитать выгрузку.')+'</div>';
 }
}
function renderFrontpadReports(d){
 const box=$('#frontpadReports');if(!box)return;
 if(!d?.ok){box.innerHTML='<div class="notice">'+E(d?.error||'Не удалось загрузить отчёты Frontpad.')+'</div>';return}
 const updated=d.updatedAt?new Date(d.updatedAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}):'';
 const cards=(d.reports||[]).map(r=>{
   const tables=(r.tables||[]).map(reportTable).join('');
   let preview='';
   if(!tables){
     const lines=String(r.text||'').split('\n').map(x=>x.trim()).filter(Boolean).filter(x=>x.length<180).slice(0,14);
     preview=lines.length?'<div class="report-copy">'+lines.map(x=>'<div>'+E(x)+'</div>').join('')+'</div>':'<p class="help">Frontpad открыл раздел, но таблицу на этой странице не отдал. Нажми «Обновить» после выбора периода в самом Frontpad, если отчёт требует фильтр.</p>';
   }
   return '<section class="card"><div class="card-head"><div><span class="eyebrow">ОТЧЁТ</span><h3>'+E(r.title)+'</h3></div><span class="tag">Live</span></div>'+tables+preview+'</section>';
 }).join('');
 box.innerHTML='<div class="notice"><b>✓ Frontpad подключён</b><br>Последнее обновление: '+E(updated||'только что')+'. Показываю то, что доступно твоему пользователю Frontpad.</div>'+(cards?'<div class="grid2" style="margin-top:16px">'+cards+'</div>':'<div class="empty"><strong>Отчёты не найдены</strong>У этого пользователя Frontpad может не быть прав на отчёты, либо меню загружается другим способом.</div>');
}
async function loadFrontpadReports(){
 const box=$('#frontpadReports');if(box)box.innerHTML='<div class="notice">Получаю свежие данные из Frontpad…</div>';
 try{
  const r=await fetch('/api/frontpad/reports',{cache:'no-store',signal:AbortSignal.timeout(30000)}),d=await r.json();
  frontpadReports=d;renderFrontpadReports(d);
  if(d.needsAuth)toast('Нужно заново подключить Frontpad в настройках');
 }catch(e){
  if(box)box.innerHTML='<div class="notice">Не удалось получить отчёты. Проверь подключение Frontpad и повтори.</div>';
 }
}
function settingsPage(){return `<div class="grid2"><section class="card"><h2>Подключения и голос</h2><div class="metric"><span>AI-модель</span><b>${statusKnown?(aiConnected?'Подключена':'Не подключена'):'Проверяется'}</b></div><p class="help">Без модели доступны команды задач, заметок и навигации. Свободный разговор зависит от подключения AI.</p><label style="margin-top:20px"><input type="checkbox" id="tts" ${tts?'checked':''}> Озвучивать ответы голосом устройства</label><p class="help">Образ помощницы — анимированный портрет. Синхронизация губ и естественная голосовая модель пока не подключены.</p></section><section class="card"><h2>Frontpad</h2><div id="frontpadConnection" class="help">Проверяю подключение…</div><div id="frontpadAuthBox" style="margin-top:16px"></div><p class="help">Подключение Frontpad сохранено для совместимости. Для отчётов используй выгрузку Excel/CSV в разделе «Отчёты» — это стабильнее и не требует повторной капчи.</p></section><section class="card"><h2>Сохранность данных</h2><p class="help">Журналы, задачи, рецептуры и заметки автоматически сохраняются только в этом браузере на этом устройстве. Вход в Google или Яндекс не нужен. На другом устройстве будет отдельная база. При очистке данных браузера записи могут пропасть — скачивай резервную копию в файл.</p><div class="storage-actions">${button('Скачать копию','data-backup','primary')}${button('Восстановить','data-restore')}</div><input hidden id="restoreInput" type="file" accept="application/json"><p class="help">Перед первым запуском создана локальная копия прежних данных, если браузер разрешил запись.</p><a href="/classic.html" class="subtle">Открыть прежнее пространство: проекты и аналитика →</a></section></div>`}
function render(){const p=pages.find(p=>p[0]===view);$('#pageTitle').textContent=p[3];$('#navigation').innerHTML=pages.map(([v,icon,l])=>`<button class="nav-item ${view===v?'active':''}" data-view="${v}"><span class="icon">${icon}</span>${l}</button>`).join('');main.innerHTML=({home,tasks:tasksPage,recipes:recipesPage,cost:costPage,journals:journalsPage,reports:reportsPage,chat:chatPage,settings:settingsPage}[view])();if(view==='cost')renderCost();if(view==='chat'){renderMessages();$('#chatForm').onsubmit=e=>{e.preventDefault();const input=$('#message');const t=input.value.trim();if(!t||busy)return;input.value='';handle(t)};$('#message').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#chatForm').requestSubmit()}}}if(view==='reports'){renderSavedFrontpadHistory();const inp=$('#frontpadExportInput');if(inp)inp.onchange=e=>uploadFrontpadExport(e.target.files?.[0])}if(view==='settings'){$('#tts').onchange=e=>{tts=e.target.checked;put('farrukh_mobile_tts',tts);if(!tts)window.speechSynthesis?.cancel()};$('#restoreInput').onchange=restore;loadFrontpadStatus()}}
function saveChat(role,text){persist('chat',[...data.chat,{role,text}].slice(-200));renderMessages()}
function voiceStatus(t){const el=$('#voiceState');if(el)el.textContent=t;const a=$('#assistantStateLabel');if(a){a.textContent=t||'Готова к работе';const x=String(t||'').toLowerCase();document.body.classList.toggle('assistant-listening',/слуш/.test(x));document.body.classList.toggle('assistant-thinking',/дума|обрабаты|подключ/.test(x));document.body.classList.toggle('assistant-speaking',/отвеч|говор/.test(x))}}
function stop(){conversation=false;if(recognition){recognition.abort();recognition=null}window.speechSynthesis?.cancel();speaking=false;document.body.classList.remove('listening','speaking');voiceStatus('Голос остановлен')}
function say(text,onDone=null){if(!tts||!('speechSynthesis'in window)){if(onDone)onDone();else if(conversation)setTimeout(()=>mic(),400);else setTimeout(startWakeListener,500);return}stopWakeListener();window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text.replace(/[*#_`]/g,''));u.lang='ru-RU';u.rate=.97;const voices=speechSynthesis.getVoices().filter(v=>v.lang.startsWith('ru'));u.voice=voices.find(v=>/female|irina|milena|alena|maria|svetlana/i.test(v.name))||voices[0]||null;u.onstart=()=>{speaking=true;document.body.classList.add('speaking');voiceStatus('Отвечаю')};u.onend=()=>{speaking=false;document.body.classList.remove('speaking');voiceStatus('Готова слушать');if(onDone)onDone();else if(conversation)setTimeout(()=>mic(),350);else setTimeout(startWakeListener,500)};u.onerror=()=>{speaking=false;document.body.classList.remove('speaking');voiceStatus('Озвучка недоступна; ответ сохранён текстом');if(onDone)onDone();else setTimeout(startWakeListener,700)};speechSynthesis.speak(u)}
function reply(text){saveChat('ai',text);const homeAssistant=$('#northAssistant');if(homeAssistant)homeAssistant.dataset.lastReply=text.slice(0,180);say(text)}
function moscowHour(){return Number(new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',hour12:false}).format(new Date()).replace(/\D/g,''))||0}
function startupGreeting(){
 if(startupGreetingSpoken||!tts)return;
 startupGreetingSpoken=true;
 const h=moscowHour();
 const part=h<12?'Доброе утро':h<18?'Добрый день':'Добрый вечер';
 const wish=h<12?'Пусть день начнётся спокойно и продуктивно.':h<18?'Желаю тебе хорошего и продуктивного дня.':'Желаю тебе хорошего вечера и спокойно закрыть всё важное.';
 const todays=data.tasks.filter(t=>taskDate(t)===day()&&!t.done);
 let tasks='';
 if(todays.length===1)tasks='На сегодня у тебя одна активная задача: '+todays[0].text+'.';
 else if(todays.length>1)tasks='На сегодня у тебя '+todays.length+' активные задачи. В приоритете: '+todays.slice(0,3).map(t=>t.text).join('; ')+'.';
 else tasks='На сегодня пока нет незакрытых задач.';
 const text=part+', шеф. Рада тебя видеть. '+wish+' '+tasks+' Какие планы на сегодня? Есть что-то, что нужно взять под контроль? Расскажи, и я спрошу, что из этого внести в задачи.';
 awaitingDailyPlans=true;
 setTimeout(()=>say(text),450);
}
function queueDailyPlans(text){
 const clean=String(text||'').trim();
 if(!clean)return false;
 if(/^(нет|пока нет|ничего|не знаю)[.!]?$/i.test(clean)){awaitingDailyPlans=false;reply('Хорошо. Тогда начнём спокойно. С чего хочешь начать?');return true}
 awaitingDailyPlans=false;
 const t={text:clean,dueDate:day(),time:'',priority:/срочно|важно/i.test(clean)?'high':'normal',done:false};
 pending={description:'Я услышала: «'+clean+'». Внести это в задачи на сегодня?',run:()=>{const list=[...data.tasks],obj={...t,id:id(),dueAt:null};list.unshift(obj);persist('tasks',list);lastTask=obj.id;return 'Готово. Я внесла это в задачи на сегодня: '+clean+'.'}};
 reply(pending.description+' Скажи «да» или нажми «Подтвердить».');
 renderMessages();
 return true;
}
function parseTask(text){let date=day(),time='';if(/послезавтра/i.test(text))date=day(2);else if(/завтра/i.test(text))date=day(1);const specific=text.match(/\b(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\b/);if(specific){const s=`${specific[3]||day().slice(0,4)}-${specific[2].padStart(2,'0')}-${specific[1].padStart(2,'0')}`;if(new Date(s+'T12:00Z').toISOString().slice(0,10)!==s)throw Error('Уточни дату задачи');date=s}const weekdays=['воскресенье','понедельник','вторник','среду','четверг','пятницу','субботу'];const wi=weekdays.findIndex(w=>text.toLowerCase().includes(w));if(wi>=0){const today=new Date(day()+'T12:00Z').getUTCDay();date=day((wi-today+7)%7||7)}const tm=text.match(/(?:в|на)\s+(\d{1,2})(?::(\d{2}))?(?![\d.])/i);if(tm){if(+tm[1]>23||+(tm[2]||0)>59)throw Error('Уточни время задачи: например, в 15:30');time=tm[1].padStart(2,'0')+':'+(tm[2]||'00')}
let title=text.replace(/^(?:добавь|создай|сохрани|запиши)\s*(?:мне\s*)?(?:задачу|задача|напоминание)?\s*[:,-]?\s*/i,'').replace(/^напомни\s*(?:мне\s*)?/i,'').replace(/(?:на\s+)?(?:послезавтра|завтра|сегодня)/gi,'').replace(/(?:на|в)\s+(?:понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)/gi,'').replace(/(?:в|на)\s+\d{1,2}(?::\d{2})?(?![\d.])/gi,'').replace(/(?:на\s+)?\b\d{1,2}\.\d{1,2}(?:\.\d{4})?\b/g,'').replace(/\s+/g,' ').trim();return{text:title,dueDate:date,time,priority:/срочно|важно/i.test(text)?'high':'normal',done:false}}
function proposeTask(t,editIndex=null){if(!t.text){reply('Что записать в задачу? Назови действие.');return}pending={description:`${editIndex===null?'Сохранить':'Перенести'} задачу «${t.text}» на ${t.dueDate}${t.time?' в '+t.time:''}?`,run:()=>{const list=[...data.tasks],obj={...t,id:t.id||id(),dueAt:t.time?new Date(t.dueDate+'T'+t.time+':00+03:00').toISOString():null};if(editIndex===null)list.unshift(obj);else list[editIndex]=obj;persist('tasks',list);lastTask=obj.id;return 'Сохранила задачу на '+t.dueDate+(t.time?' в '+t.time:'')+': '+t.text+'.'}};reply(pending.description+' Скажи «да» или нажми «Подтвердить».');renderMessages()}
function confirmPending(){if(!pending)return;const p=pending;try{const message=p.run();pending=null;renderMessages();reply(message)}catch(e){reply('Запись не сохранена. Проверь свободное место и повтори.')}}
async function handle(text){try{saveChat('user',text);if(awaitingDailyPlans)return queueDailyPlans(text);if(pending&&/^(да|подтверждаю|сохрани|верно)[.!]?$/i.test(text))return confirmPending();if(/^(отмена|не сохраняй|нет)[.!]?$/i.test(text)&&pending){pending=null;renderMessages();return reply('Запись отменена.')}if(/^(сохрани|запиши|добавь|создай).*задач|^напомни/i.test(text)){proposeTask(parseTask(text));return}if(/^(перенеси|давай лучше)/i.test(text)&&lastTask){const i=data.tasks.findIndex(t=>t.id===lastTask);if(i>=0){const parsed=parseTask(text);proposeTask({...data.tasks[i],dueDate:parsed.dueDate,time:parsed.time||data.tasks[i].time},i);return}}if(/^(сохрани|запиши|добавь)\s+(идею|решение|заметку)/i.test(text)){const note=text.replace(/^(сохрани|запиши|добавь)\s+(идею|решение|заметку)\s*[:,-]?\s*/i,'').trim();if(!note)return reply('Какую мысль сохранить?');persist('notes',[...data.notes,{id:id(),text:note,date:day()}]);return reply('Сохранила заметку: '+note)}if(/(?:создай|открой|новая|новую).*ттк|(?:создай|новое).*блюдо/i.test(text)){reply('Открываю черновик рецептуры.');go('recipes');recipeEditor();return}if(/открой.*журнал|запиши.*температур/i.test(text)){journalType=/дефрост/i.test(text)?'defrost':/бракераж/i.test(text)?'quality':'temperature';reply('Открываю журнал. Укажи фактические данные проверки.');go('journals');journalEditor();return}if(/открой.*(?:расчёт|расчет|калькулятор)/i.test(text)){go('cost');return}if(/(?:какие|покажи|что).*задач|что.*сегодня/i.test(text)){const list=data.tasks.filter(t=>!t.done&&taskDate(t)===day());return reply(list.length?'На сегодня: '+list.map(t=>t.text).join('; '):'На сегодня нет незавершённых задач с указанной датой.')}if(!aiConnected){return reply('Сейчас могу сохранить задачу, заметку, открыть рецептуру или журнал. Для свободного разговора нужно подключить AI-модель в настройках сервера.')}busy=true;document.body.classList.add('thinking');voiceStatus('Думаю…');renderMessages();const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(60000),body:JSON.stringify({message:text,history:data.chat.slice(0,-1).slice(-12).map(m=>({role:m.role==='user'?'user':'assistant',content:m.text})),context:{tasks:data.tasks,projects:read('farrukh_mobile_projects',[]),knowledge:localStorage.getItem('farrukh_mobile_knowledge')||'',recipes:data.recipes,notes:data.notes,journals:data.journals.slice(-20)}})});const result=await response.json();if(!response.ok)throw Error('Не удалось получить ответ AI.');reply(result.reply||'Ответ не получен.')}catch(e){reply(e.message||'Не получилось выполнить команду. Попробуй ещё раз.')}finally{busy=false;document.body.classList.remove('thinking');voiceStatus('Готова к работе');renderMessages()}}
let wakeRecognition=null,wakeRestartTimer=null,wakeEnabled=false;
function stopWakeListener(){clearTimeout(wakeRestartTimer);if(wakeRecognition){const r=wakeRecognition;wakeRecognition=null;try{r.onend=null;r.abort()}catch(e){}}}
function startWakeListener(){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR||!wakeEnabled||wakeRecognition||recognition||speaking||document.hidden)return;
 const r=new SR();wakeRecognition=r;r.lang='ru-RU';r.continuous=true;r.interimResults=true;
 r.onstart=()=>voiceStatus('Скажи «Ведьма»');
 r.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){const heard=(e.results[i][0].transcript||'').toLowerCase().replace(/ё/g,'е');if(/(^|\s)ведьма([\s,.!?]|$)/i.test(heard)){stopWakeListener();voiceStatus('Ведьма услышала');say('Я слушаю.',()=>setTimeout(()=>mic(),180));return}}};
 r.onerror=e=>{if(wakeRecognition===r)wakeRecognition=null;if(e.error==='not-allowed'||e.error==='service-not-allowed'){wakeEnabled=false;voiceStatus('Разреши микрофон для команды «Ведьма»');return}wakeRestartTimer=setTimeout(startWakeListener,900)};
 r.onend=()=>{if(wakeRecognition===r)wakeRecognition=null;if(wakeEnabled&&!recognition&&!speaking&&!document.hidden)wakeRestartTimer=setTimeout(startWakeListener,600)};
 try{r.start()}catch(e){wakeRecognition=null;wakeRestartTimer=setTimeout(startWakeListener,1000)}
}
function mic(target=null){stopWakeListener();const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){toast('В этом браузере голосовой ввод недоступен. Используй клавиатуру.');conversation=false;return}if(recognition){recognition.abort();recognition=null}window.speechSynthesis?.cancel();const r=new SR();recognition=r;r.lang='ru-RU';r.interimResults=false;r.continuous=false;let heard=false;voiceTarget=target;r.onstart=()=>{document.body.classList.add('listening');voiceStatus('Слушаю…')};r.onresult=e=>{heard=true;const text=e.results[0][0].transcript;recognition=null;document.body.classList.remove('listening');if(voiceTarget){voiceTarget(text);voiceTarget=null}else{go('chat');handle(text)}};r.onerror=()=>{conversation=false;recognition=null;document.body.classList.remove('listening');voiceStatus('Микрофон остановлен. Проверь разрешение и попробуй снова.');toast('Не удалось распознать речь. Повтори или напиши текст.');setTimeout(startWakeListener,700)};r.onend=()=>{if(recognition===r)recognition=null;document.body.classList.remove('listening');if(!heard){conversation=false;voiceStatus('Речь не распознана. Скажи «Ведьма» ещё раз.');setTimeout(startWakeListener,600)}};try{r.start()}catch{recognition=null;conversation=false;toast('Микрофон занят. Попробуй ещё раз.')}}
function download(name,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function exportJournal(){const rows=journalRows();if(!rows.length)return toast('Нет записей для выгрузки');const cols=[...new Set(rows.flatMap(r=>Object.keys(r)))];const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';download('journal-'+journalType+'-'+day()+'.csv','\uFEFF'+[cols,...rows.map(r=>cols.map(c=>r[c]))].map(r=>r.map(cell).join(';')).join('\r\n'),'text/csv;charset=utf-8')}
async function restore(e){const file=e.target.files[0];if(!file)return;try{const backup=JSON.parse(await file.text());if(backup.version!==5||!backup.data||!Object.keys(keys).every(k=>Array.isArray(backup.data[k])))throw Error('Неверный формат копии');if(!confirm('Восстановление заменит текущие задачи, рецептуры, журналы и заметки. Продолжить?'))return;put('farrukh_before_restore',{at:new Date().toISOString(),data});for(const k of Object.keys(keys))persist(k,backup.data[k]);render();toast('Данные восстановлены')}catch(err){toast('Не удалось восстановить копию: '+err.message)}}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;safe(()=>{if(b.dataset.view)return go(b.dataset.view);if(b.hasAttribute('data-new-task'))return taskEditor();if(b.dataset.editTask!==undefined)return taskEditor(+b.dataset.editTask);if(b.dataset.filter){filter=b.dataset.filter;return render()}if(b.hasAttribute('data-new-note'))return noteEditor();if(b.hasAttribute('data-new-recipe'))return recipeEditor();if(b.dataset.editRecipe!==undefined)return recipeEditor(+b.dataset.editRecipe);if(b.dataset.exportRecipe!==undefined){const r=data.recipes[+b.dataset.exportRecipe];return download('recipe-draft-'+day()+'.txt','ЧЕРНОВИК РЕЦЕПТУРЫ — НЕ УТВЕРЖДЁННАЯ ТТК\n\n'+r.name+'\n\nСостав:\n'+r.ingredients+'\n\nВыход: '+r.yield+' г\n\nТехнология:\n'+r.technology+'\n\nХранение:\n'+r.storage,'text/plain;charset=utf-8')}if(b.dataset.saveFood!==undefined){const r=draft.rows[+b.dataset.saveFood];if(!r.name.trim()||!['kcal','p','f','c'].every(k=>amount(r[k])))return toast('Укажи название и все четыре значения КБЖУ с этикетки');const food={name:r.name.trim(),kcal:Number(r.kcal),p:Number(r.p),f:Number(r.f),c:Number(r.c)};const next=[...userFoods.filter(f=>foodName(f.name)!==foodName(food.name)),food];put(foodKey,next);userFoods=next;toast('Продукт запомнен на этом устройстве');return}if(b.hasAttribute('data-add-row')){draft.rows.push({name:'',explicitGross:false,gross:'',grams:'',price:'',kcal:'',p:'',f:'',c:''});put('farrukh_studio_cost',draft);return render()}if(b.dataset.removeRow!==undefined){draft.rows.splice(+b.dataset.removeRow,1);put('farrukh_studio_cost',draft);return render()}if(b.hasAttribute('data-cost-save')){if(!draft.name.trim()||!draft.rows.length||draft.rows.some(r=>!rowValid(r))||!(Number(draft.portions)>0))return toast('Укажи название, корректные брутто и нетто, количество порций');persist('recipes',[...data.recipes,{id:id(),name:draft.name,ingredients:draft.rows.map(r=>r.name+' — брутто '+rowGross(r)+' г, нетто '+r.grams+' г').join('\n'),yield:calc(draft).output,technology:'',storage:'',cost:structuredClone(draft),status:'draft'}]);toast('Расчёт сохранён в рецептурах');return}if(b.dataset.journalType){journalType=b.dataset.journalType;return render()}if(b.hasAttribute('data-new-journal'))return journalEditor();if(b.hasAttribute('data-export-journal'))return exportJournal();if(b.hasAttribute('data-start-chat')){mic(text=>handle(text));return}if(b.hasAttribute('data-mic'))return mic();if(b.hasAttribute('data-conversation')){if(conversation){stop();render()}else{conversation=true;render();mic()}return}if(b.hasAttribute('data-stop'))return stop();if(b.hasAttribute('data-confirm'))return confirmPending();if(b.hasAttribute('data-cancel-pending')){pending=null;renderMessages();return reply('Запись отменена.')}if(b.hasAttribute('data-backup'))return download('farrukh-studio-backup-'+day()+'.json',JSON.stringify({version:5,createdAt:new Date().toISOString(),data,legacy:{projects:read('farrukh_mobile_projects',[]),knowledge:localStorage.getItem('farrukh_mobile_knowledge')}},null,2));if(b.hasAttribute('data-restore'))return $('#restoreInput').click()})});
document.addEventListener('change',e=>{if(e.target.dataset.grossMode!==undefined)safe(()=>{const r=draft.rows[+e.target.dataset.grossMode];r.explicitGross=e.target.checked;if(r.explicitGross)r.gross=r.grams;put('farrukh_studio_cost',draft);render()});if(e.target.dataset.toggleTask!==undefined)safe(()=>{const list=data.tasks.map((t,i)=>i===+e.target.dataset.toggleTask?{...t,done:e.target.checked}:t);persist('tasks',list);render()})});
main.addEventListener('input',e=>{if(view!=='cost')return;const t=e.target;if(t.dataset.row!==undefined){const r=draft.rows[+t.dataset.row];r[t.dataset.key]=t.value;if(t.dataset.key==='name'){fillFood(r,true);for(const k of ['kcal','p','f','c']){const input=$(`input[data-row="${t.dataset.row}"][data-key="${k}"]`);if(input)input.value=r[k]??''}}else if(['kcal','p','f','c'].includes(t.dataset.key)){r.nutritionAuto=false;r.nutritionSource=''}}else if(t.name){const k=t.name==='dish'?'name':t.name;draft[k]=t.value}safe(()=>put('farrukh_studio_cost',draft));renderCost()});
window.addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(v!==view)go(v)});
window.addEventListener('storage',e=>{const k=Object.keys(keys).find(k=>keys[k]===e.key);if(k){data[k]=read(keys[k],[]);render()}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopWakeListener();stop()}});

$('#todayLabel').textContent=new Date().toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long',weekday:'short'});
go(location.hash.slice(1)||'home');
setTimeout(startupGreeting,700);
window.addEventListener('pointerdown',()=>{if(!startupGreetingSpoken)setTimeout(startupGreeting,80)},{once:true});
fetch('/api/status').then(r=>r.json()).then(s=>{aiConnected=!!s.aiConnected;statusKnown=true;if(['settings','home'].includes(view))render();else if(view==='chat')voiceStatus(aiConnected?'AI подключён':'Команды доступны · AI-модель не подключена')}).catch(()=>{statusKnown=true;toast('Сервер недоступен. Локальные записи работают.')});
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
window.ChefStudio={parseTask,calc,day};
})();

