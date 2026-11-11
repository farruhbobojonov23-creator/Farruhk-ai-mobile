/* MORE SUSHI · protected product recipe drafts and menu catalog */
(function(){
'use strict';
const e=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const previous={render:window.renderRecipes,save:window.saveRecipe,open:window.openRecipe,create:window.newRecipe};
let search='',cat='',filterStatus='';
const panel=e('catalogPage').querySelector('.panel');
const control=document.createElement('section');control.id='msProductMenu';
control.innerHTML=
 '<div class="msCatalogHero"><div class="msCatalogIntro">'+
 '<small>МОРЕ СУШИ · МЕНЮ / КОНСТРУКТОР</small>'+
 '<h2>Коллекция роллов</h2>'+
 '<p>Управляйте готовыми блюдами, рецептурами и технологическими картами в одной рабочей области.</p></div>'+
 '<div class="msCatalogHeroActions"><button type="button" id="msCreateRoll">＋ Новый ролл</button>'+
 '<a href="./ttk.html" class="msCatalogHeroLink">▤ Конструктор ТТК</a></div></div>'+
 '<div class="msCatalogStatistics" id="msProductStats" aria-live="polite"></div>'+
 '<div class="msCatalogTools">'+
 '<label class="msCatalogSearch"><span aria-hidden="true">⌕</span><input type="search" id="msProductSearch" placeholder="Поиск по названию и коду" aria-label="Найти ролл"></label>'+
 '<select id="msProductStatus" aria-label="Статус документа"><option value="">Все статусы</option><option>Черновик</option><option>Тест</option><option>Утверждено</option><option>Архив</option></select>'+
 '<select id="msProductSort" aria-label="Сортировка"><option value="recent">Сначала новые</option><option value="name">По названию</option><option value="code">По коду</option><option value="weight">По массе</option></select></div>'+
 '<div class="msCatalogToolbar"><div class="msCatalogSegments" id="msCatalogSegments">'+
 '<button type="button" data-category="" class="selected" aria-pressed="true">Все <span id="msCategoryAll">0</span></button>'+
 '<button type="button" data-category="Холодные роллы" aria-pressed="false">Холодные <span id="msCategoryCold">0</span></button>'+
 '<button type="button" data-category="Запечённые роллы" aria-pressed="false">Запечённые <span id="msCategoryBaked">0</span></button>'+
 '</div><div class="msCatalogDisplay"><span id="msProductCount" aria-live="polite">—</span>'+
 '<div class="msCatalogView"><button type="button" id="msGridView" class="selected" aria-label="Показать карточки" aria-pressed="true">▦</button>'+
 '<button type="button" id="msTableView" aria-label="Показать таблицу" aria-pressed="false">☷</button></div></div></div>'+
 '<div id="msProductGrid" class="msProductGrid" aria-live="polite"></div>'+
 '<div class="msCatalogCaution"><span class="msCautionIcon">!</span><div><strong>Технологические черновики</strong>'+
 '<p>Рецептуры готовы к проработке. До подтверждения КБЖУ, аллергенов, безопасности и фактических выходов они не считаются утверждёнными.</p></div></div>';
panel.querySelector('.row.between').after(control);
let query='',group='',status='',sort='recent',view='grid';
get('msProductSearch').addEventListener('input',e=>{query=e.target.value.toLocaleLowerCase('ru').trim();filter()});
get('msProductStatus').addEventListener('change',e=>{status=e.target.value;filter()});
get('msProductSort').addEventListener('change',e=>{sort=e.target.value;filter()});
get('msCatalogSegments').addEventListener('click',e=>{
 const btn=e.target.closest('button[data-category]');if(!btn)return;
 group=btn.dataset.category;filter();
});
get('msCreateRoll').addEventListener('click',()=>window.newRecipe());
get('msGridView').addEventListener('click',()=>{view='grid';filter()});
get('msTableView').addEventListener('click',()=>{view='table';filter()});
get('msProductGrid').addEventListener('click',e=>{
 const button=e.target.closest('button[data-roll-open],button[data-clear-filter]');
 if(!button)return;
 if(button.dataset.clearFilter!==undefined){
  query='';group='';status='';sort='recent';
  get('msProductSearch').value='';get('msProductStatus').value='';get('msProductSort').value='recent';
  filter();return;
 }
 const id=Number(button.dataset.rollOpen);
 if(Number.isSafeInteger(id)&&id>0)window.openRecipe(id);
});
const editor=e('editorPage').querySelector('.panel');
const note=document.createElement('section');note.id='msProductEditorNote';
note.innerHTML='<strong>📄 Карточка ролла — ТТК А4</strong><p>Новые рецептуры остаются черновиками. Фактический выход и температурный режим должны быть подтверждены.</p><small id="msProductEditorMass">—</small>';
editor.firstElementChild.after(note);
function stateBadge(state){
 const cls=state==='Утверждено'?'ready':state==='Тест'?'test':state==='Архив'?'archived':'draft';
 return '<span class="msRecipeState '+cls+'"><i></i>'+esc(state||'Черновик')+'</span>';
}
function photoForCard(r,frame){
 if(typeof r.photo_path==='string'&&/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(r.photo_path)&&r.photo_path.length<16000000){
   const img=document.createElement('img');
   img.alt='Фото: '+r.name;img.loading='lazy';img.decoding='async';img.src=r.photo_path;
   frame.append(img);frame.classList.add('msHasPhoto');return;
 }
 const empty=document.createElement('div');empty.className='msPhotoEmpty';
 empty.innerHTML='<span class="msPhotoDisc"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.65" aria-hidden="true">'+
 '<circle cx="32" cy="32" r="25"/><circle cx="32" cy="32" r="15"/><circle cx="32" cy="32" r="5"/>'+
 '<path d="M7 32h10M47 32h10M32 7v10M32 47v10"/></svg></span>'+
 '<span class="msPhotoEmptyText">Добавить фото ролла</span>';
 frame.append(empty);
}
function cardFor(r){
 const card=document.createElement('article');card.className='msRollCard';
 const photo=document.createElement('div');photo.className='msRollPhoto';
 photoForCard(r,photo);
 const type=document.createElement('span');type.className='msRollType';
 type.textContent=r.category==='Холодные роллы'?'ХОЛОДНЫЙ':r.category==='Запечённые роллы'?'ЗАПЕЧЁННЫЙ':'ГОТОВОЕ БЛЮДО';photo.append(type);
 const main=document.createElement('div');main.className='msRollBody';
 main.innerHTML='<div class="msRollCode">'+esc(r.code||'Без кода')+'</div>'+
 '<h3>'+esc(r.name||'Без названия')+'</h3>'+
 '<div class="msRollMeta">'+stateBadge(r.status)+
 '<div class="msRollWeight"><b>'+Number(r.yield_g||0).toLocaleString('ru-RU',{maximumFractionDigits:1})+'</b> г <span>· расчётная масса</span></div></div>';
 const footer=document.createElement('div');footer.className='msRollFooter';
 const edit=document.createElement('button');edit.type='button';edit.className='msRollEdit';edit.dataset.rollOpen=String(r.id);
 edit.textContent='Редактировать';
 const ttk=document.createElement('a');ttk.className='msRollTtk';ttk.href='./ttk.html?id='+Number(r.id);ttk.target='_blank';ttk.rel='noopener';
 ttk.textContent='ТТК А4 ↗';
 footer.append(edit,ttk);card.append(photo,main,footer);
 return card;
}
function filter(){
 if(currentKind!=='product')return;
 const all=recipes.filter(r=>r.kind==='product');
 const cold=all.filter(r=>r.category==='Холодные роллы').length;
 const baked=all.filter(r=>r.category==='Запечённые роллы').length;
 get('msCategoryAll').textContent=all.length;
 get('msCategoryCold').textContent=cold;
 get('msCategoryBaked').textContent=baked;
 const approved=all.filter(r=>r.status==='Утверждено').length;
 const tested=all.filter(r=>r.status==='Тест').length;
 const draft=all.filter(r=>r.status==='Черновик').length;
 get('msProductStats').innerHTML=
 '<div class="msCatalogStat"><span>Всего товаров</span><strong>'+all.length+'</strong><small>Карточки блюд</small></div>'+
 '<div class="msCatalogStat"><span>В разработке</span><strong>'+draft+'</strong><small>Черновики</small></div>'+
 '<div class="msCatalogStat"><span>На испытании</span><strong>'+tested+'</strong><small>Тестовые рецептуры</small></div>'+
 '<div class="msCatalogStat"><span>Утверждено</span><strong>'+approved+'</strong><small>Готовые ТТК</small></div>';
 Array.from(get('msCatalogSegments').querySelectorAll('button')).forEach(b=>{
  const active=b.dataset.category===group;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));
 });
 const filtered=all.filter(r=>(!group||r.category===group)&&(!status||r.status===status)&&
    (!query||[r.code,r.name,r.category].some(v=>String(v||'').toLocaleLowerCase('ru').includes(query))));
 const sorted=[...filtered].sort((a,b)=>{
  if(sort==='code')return String(a.code||'').localeCompare(String(b.code||''),'ru');
  if(sort==='name')return String(a.name||'').localeCompare(String(b.name||''),'ru');
  if(sort==='weight')return Number(b.yield_g||0)-Number(a.yield_g||0);
  return new Date(b.updated_at||0)-new Date(a.updated_at||0);
 });
 const grid=get('msProductGrid');grid.replaceChildren();
 if(sorted.length){const frag=document.createDocumentFragment();sorted.forEach(r=>frag.append(cardFor(r)));grid.append(frag)}
 else{const empty=document.createElement('div');empty.className='msCatalogEmpty';
 empty.innerHTML='<div class="msEmptyIcon">⌕</div><strong>Ничего не найдено</strong>'+
 '<p>Попробуйте другой запрос или очистите фильтры.</p><button type="button" data-clear-filter>Сбросить фильтры</button>';
 grid.append(empty)}
 const count=get('msProductCount');count.textContent='Показано '+filtered.length+' из '+all.length;
 const showGrid=view==='grid';panel.classList.toggle('msCatalogGridMode',showGrid);
 panel.classList.toggle('msCatalogTableMode',!showGrid);
 get('msGridView').classList.toggle('selected',showGrid);
 get('msTableView').classList.toggle('selected',!showGrid);
 get('msGridView').setAttribute('aria-pressed',String(showGrid));
 get('msTableView').setAttribute('aria-pressed',String(!showGrid));
 const rowElements=[...get('recipeRows').children];
 const visibleIds=new Set(filtered.map(r=>Number(r.id)));
 const ordered=all;
 ordered.forEach((r,i)=>{if(rowElements[i])rowElements[i].hidden=!visibleIds.has(Number(r.id))});
}
function render(){
 previous.render();
 const active=currentKind==='product';
 control.hidden=!active;
 panel.classList.toggle('msCatalogPro',active);
 if(!active){
  panel.classList.remove('msCatalogGridMode','msCatalogTableMode');return;
 }
 filter();
}
function showNote(){
 note.hidden=currentKind!=='product';if(note.hidden)return;
 const sum=components.reduce((s,c)=>s+Number(c.net_g||0),0);
 e('msProductEditorMass').textContent='Компонентов: '+components.length+' · Сумма нетто: '+sum.toLocaleString('ru-RU',{maximumFractionDigits:2})+' г. Для запечённых роллов выход после запекания измеряется отдельно.';
}
function audit(){
 const issues=[],visited=new Set();
 if(!usageLoaded)issues.push('Нет полного списка связей сырья');
 function ing(id){
  const v=ingredients.find(x=>Number(x.id)===Number(id));
  if(!v){issues.push('Ингредиент не найден');return}
  if(v.allergen_status!=='verified')issues.push('Аллергены: '+v.name);
  const n=v.nutrition_100g||{};
  if(v.nutrition_review_status!=='verified'||!['protein','fat','carbs','kcal'].every(k=>n[k]!=null&&n[k]!==''&&Number.isFinite(Number(n[k]))))issues.push('КБЖУ: '+v.name);
 }
 function pf(id){
  const v=recipes.find(x=>x.kind==='prefab'&&Number(x.id)===Number(id));
  if(!v){issues.push('ПФ не найден');return}
  if(visited.has(Number(id)))return;visited.add(Number(id));
  if(v.status!=='Утверждено')issues.push('Не утверждён ПФ: '+v.name);
  const d=v.ttk_fields?.ultra?.pf_storage||{};
  if(!d.temperature||!(Number(d.hours)>0)||!d.source)issues.push('Хранение ПФ: '+v.name);
  const parts=recipeLines.filter(x=>Number(x.recipe_id)===Number(v.id));
  if(!parts.length)issues.push('ПФ без рецептуры: '+v.name);
  parts.forEach(l=>{if(l.ingredient_id!=null)ing(l.ingredient_id);else if(l.prefab_id!=null)pf(l.prefab_id)});
 }
 components.forEach(c=>c.source_type==='ingredient'?ing(c.source_id):pf(c.source_id));
 return [...new Set(issues)];
}
async function save(){
 if(currentKind!=='product')return previous.save();
 const btn=Array.from(editor.querySelectorAll('button')).find(x=>(x.getAttribute('onclick')||'').includes('saveRecipe()'));
 if(btn?.disabled)return;
 try{
  const val=id=>e(id)?.value.trim()||'';
  const code=val('rCode'),name=val('rName'),status=val('rStatus');
  if(!code||!name)throw Error('Введите код и название товара');
  if(recipes.some(r=>r.code===code&&Number(r.id)!==Number(editing?.id)))throw Error('Такой код ТТК уже существует');
  if(!components.length)throw Error('Добавьте хотя бы один компонент');
  const lines=components.map((c,i)=>{
   const gross=Number(c.gross_g),net=Number(c.net_g),id=Number(c.source_id);
   if(!id||!Number.isFinite(gross)||!Number.isFinite(net)||gross<=0||net<=0||net>gross)throw Error('Ошибка брутто/нетто в строке '+(i+1));
   const found=c.source_type==='ingredient'?ingredients.some(x=>Number(x.id)===id):
     recipes.some(x=>Number(x.id)===id&&x.kind==='prefab');
   if(!found)throw Error('Компонент не найден: строка '+(i+1));
   return {seq:i,ingredient_id:c.source_type==='ingredient'?id:null,prefab_id:c.source_type==='prefab'?id:null,gross_g:gross,net_g:net,line_yield_g:null};
  });
  const total=lines.reduce((sum,x)=>sum+x.net_g,0),output=Number(e('rYield').value);
  if(!Number.isFinite(output)||output<=0||output>total+.01)throw Error('Проверьте выход: сумма нетто '+total.toFixed(1)+' г');
  if(status==='Утверждено'){
   const required=['rScope','rRaw','rProcess','rServing','rQuality','rStorage','rNutrition','rDeveloped','rApproved','rApprovedDate'];
   if(required.some(k=>!val(k)))throw Error('Для утверждения нужны все разделы ТТК и подписи');
   if(/не утвержден|не подтвержден|черновик|теоретическ|требу.*провер|в разработке/i.test(required.map(val).join(' ')))throw Error('В ТТК остались непроверенные значения; утверждение запрещено');
   if(!photoData&&!e('photoFile').files.length)throw Error('Добавьте оригинальную фотографию готового ролла');
   const errors=audit();if(errors.length)throw Error('Не подтверждены исходные данные: '+errors.slice(0,4).join('; '));
   const loss=Number(editing?.ttk_fields?.loss_g||0);
   if(Math.abs(total-loss-output)>.11)throw Error('Уточните технологические потери и фактический выход');
  }
  if(editing?.status==='Утверждено'&&status==='Утверждено')
   throw Error('Перед изменением утверждённой ТТК переведите её в черновик для повторной проверки');
  await uploadPhoto();
  const data={kind:'product',code,name,category:val('rCategory'),status,yield_g:output,
   scope:val('rScope'),raw_requirements:val('rRaw'),process:val('rProcess'),
   serving:val('rServing'),quality:val('rQuality'),storage:val('rStorage'),
   allergens:val('rAllergens'),nutrition:{text:val('rNutrition')},
   developed_by:val('rDeveloped')||null,
   approved_by:status==='Утверждено'?val('rApproved'):null,
   approved_at:status==='Утверждено'?val('rApprovedDate'):null,
   photo_path:photoData,updated_at:new Date().toISOString(),
   ttk_fields:{...(editing?.ttk_fields||{}),menu_draft:status!=='Утверждено',
    safety_review_required:status!=='Утверждено',target_pieces:8,
    photo_status:photoData?'Оригинальное фото':'Нужно оригинальное фото'}};
  if(btn)btn.disabled=true;
  let id;
  if(editing){
   id=Number(editing.id);
   await http('/rest/v1/rpc/save_ttk_document',{method:'POST',body:JSON.stringify({
    p_recipe_id:id,p_expected_version:Number(editing.version),p_patch:data,p_lines:lines})});
  }else{
   const result=await http('/rest/v1/recipes?select=id',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({...data,version:1})});
   if(!result?.[0]?.id)throw Error('Не удалось сохранить карточку');
   id=Number(result[0].id);
   try{await http('/rest/v1/recipe_lines',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(lines.map(l=>({...l,recipe_id:id})))})}
   catch(error){try{await http('/rest/v1/recipes?id=eq.'+id,{method:'DELETE'})}catch{}throw error}
  }
  await reload();await window.openRecipe(id);
  e('saveInfo').textContent='✓ Сохранено. Версия и ТТК обновлены.';
  e('saveInfo').style.color='#237d5a';
 }catch(error){
  e('saveInfo').textContent='⚠ '+(error?.message||error);
  e('saveInfo').style.color='#b6394e';
 }finally{if(btn)btn.disabled=false}
}
window.renderRecipes=render;
window.saveRecipe=save;
window.openRecipe=async function(id){const result=await previous.open(id);showNote();return result};
window.newRecipe=function(){const result=previous.create();showNote();return result};
e('components').addEventListener('input',()=>{if(currentKind==='product')showNote()});
e('components').addEventListener('change',()=>{if(currentKind==='product')showNote()});
})();