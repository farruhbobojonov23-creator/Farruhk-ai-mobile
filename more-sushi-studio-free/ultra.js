
/* MORE SUSHI · ULTRA PRO | Prefab studio */
(function(){
'use strict';
const el=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>Number(x||0), round=x=>Math.round((x+Number.EPSILON)*100)/100;
const nice=x=>n(x).toLocaleString('ru-RU',{maximumFractionDigits:2});
const old={nav:window.switchPage,list:window.renderRecipes,make:window.newRecipe,open:window.openRecipe,rows:window.renderComponents,save:window.saveRecipe};
const U={search:'',cat:'',status:'',loss:0,scale:1,saving:false,history:[]};
function node(tag,html,cls){
 const d=document.createElement(tag);if(cls)d.className=cls;d.innerHTML=html;return d;
}
function setup(){
 const catalog=el('catalogPage').querySelector('.panel');
 const wrap=node('div',
 '<div class="ultraHero"><div><small class="ultraEyebrow">🌊 МОРЕ СУШИ · STUDIO ULTRA PRO</small><h2>Полуфабрикаты</h2><p>Ингредиенты → ПФ → роллы → цветная ТТК</p></div><button type="button" data-action="create">＋ Создать полуфабрикат</button></div>'+
 '<div class="ultraSummary"><div class="ultraKpi"><b id="ultraTotal">0</b><small>Всего ПФ</small></div><div class="ultraKpi"><b id="ultraApproved">0</b><small>Утверждено</small></div><div class="ultraKpi"><b id="ultraDrafts">0</b><small>В разработке</small></div></div>'+
 '<div class="ultraControls"><input type="search" id="ultraSearch" placeholder="🔎 Поиск по названию или коду"><select id="ultraStatusFilter"><option value="">Все статусы</option><option>Черновик</option><option>Тест</option><option>Утверждено</option><option>Архив</option></select><select id="ultraCategoryFilter"><option value="">Все категории</option></select></div>'+
 '<div id="ultraCategories" class="ultraFilters"></div><div id="ultraCards" class="ultraGrid"></div>','ultraCatalog');
 wrap.id='ultraCatalog';catalog.insertBefore(wrap,catalog.firstChild);
 el('ultraSearch').addEventListener('input',e=>{U.search=e.target.value;catalogRender()});
 el('ultraStatusFilter').addEventListener('change',e=>{U.status=e.target.value;catalogRender()});
 el('ultraCategoryFilter').addEventListener('change',e=>{U.cat=e.target.value;catalogRender()});
 wrap.addEventListener('click',e=>{
 const b=e.target.closest('[data-action],[data-id],[data-category]');if(!b)return;
 if(b.dataset.action==='create')newRecipe();
 else if(b.dataset.id){if(b.dataset.action==='ttk')location.href='./ttk.html?id='+Number(b.dataset.id);else openRecipe(Number(b.dataset.id))}
 else if(b.hasAttribute('data-category')){U.cat=b.dataset.category;catalogRender()}
 });
 const editor=el('editorPage').querySelector('.panel'),heading=editor.firstElementChild;
 const header=node('div',
 '<div><small>ТЕХНОЛОГИЧЕСКИЙ КОНСТРУКТОР</small><h3 id="ultraItemLabel">Новый полуфабрикат</h3></div>'+
 '<div class="ultraEditorActions"><button type="button" class="secondary" data-action="clone">⧉ Копировать</button><button type="button" class="secondary" data-action="export">⇩ JSON</button><button type="button" class="secondary" data-action="ttk">▤ ТТК А4</button><button type="button" class="danger" data-action="delete">🗑</button></div>',
 'ultraEditorBar');
 heading.after(header);
 const metrics=node('section',
 '<div class="ultraMetric"><small>Выход готового ПФ</small><strong id="ultraMetricYield">—</strong><span>Сумма нетто − потери</span></div>'+
 '<div class="ultraMetric"><small>Себестоимость партии</small><strong id="ultraMetricCost">—</strong><span id="ultraCostNote">Не выводится в ТТК</span></div>'+
 '<div class="ultraMetric"><small>Аллергены</small><strong id="ultraMetricAllergens">—</strong><span id="ultraAllergenNote">Из выбранных компонентов</span></div>'+
 '<div class="ultraMetric"><small>КБЖУ на 100 г</small><strong id="ultraMetricNutrition">—</strong><span id="ultraNutritionNote">При наличии данных сырья</span></div>',
 'ultraMetrics');header.after(metrics);
 metrics.after(node('section','<div id="ultraPhotoBox" class="ultraPhotoBox"></div><div class="ultraPhotoSide"><b>📸 Фотография полуфабриката</b><p>PNG без фона или обычная фотография. Изображение появится в каталоге и цветной ТТК.</p><button type="button" id="ultraPhotoChoose" class="secondary">＋ Загрузить фото</button></div>','ultraPhotoPanel'));
 const comp=el('components');
 const h3=[...editor.children].find(x=>x.tagName==='H3'&&x.textContent.includes('Сырьё'));
 if(h3)h3.before(node('div','<h3>🥣 Рецептура и компоненты</h3><small>Брутто, нетто и вложенные ПФ</small>','ultraComposerHeader'));
 const add=[...editor.querySelectorAll('button')].find(x=>(x.getAttribute('onclick')||'').includes('addComponent()'));
 if(add){
  add.after(node('div',
   '<label>Технологические потери, г <input type="number" id="ultraLoss" value="0" min="0" step=".01"></label>'+
   '<span id="ultraMassNote" class="ultraCalcResult">—</span><span id="ultraMassWarning" class="ultraWarning"></span>','ultraLossBar'));
  el('ultraLoss').after();
  const mass=el('ultraLoss').closest('.ultraLossBar');
  mass.after(node('section',
   '<div class="ultraDemoScaleHeader"><strong>⚖️ Производственная партия</strong><div class="ultraScaleControls">'+
   '<button type="button" data-scale="1" class="selected">×1</button><button type="button" data-scale="2">×2</button><button type="button" data-scale="5">×5</button>'+
   '<button type="button" id="ultraCopyBatch">Скопировать план</button></div></div><div class="ultraScaleRows" id="ultraScaleRows"></div>','ultraDemoScale'));
  mass.nextElementSibling.after(node('div',
   '<section class="ultraInfo"><h4>🧬 Аллергены и КБЖУ</h4><label style="font-size:12px"><input type="checkbox" id="ultraAutoAllergens" checked> Автоматически собирать аллергены</label>'+
   '<p id="ultraAllergenDetail"></p><p id="ultraNutritionDetail"></p></section>'+
   '<section class="ultraInfo"><h4>🔗 Где используется</h4><div id="ultraRelated">Нет связей</div></section>','ultraFootPanels'));
  mass.nextElementSibling.nextElementSibling.after(node('div','', 'ultraWarnBox'));
  editor.querySelector('.ultraWarnBox').id='ultraReviewWarning';el('ultraReviewWarning').hidden=true;
 }
 const title=[...editor.children].find(x=>x.tagName==='H3'&&x.textContent.includes('ТТК'));
 if(title){
  const form=title.nextElementSibling,detail=node('details','<summary>📄 Технологическая документация ТТК · открыть редактирование</summary>','ultraTtkDetails');
  detail.id='ultraTtkDetails';title.before(detail);detail.append(title);if(form&&form.classList.contains('row'))detail.append(form);
 }
 const bottom=[...editor.children].find(x=>x.classList.contains('row')&&x.querySelector('#saveInfo'));
 if(bottom)bottom.before(node('details','<summary>🗂 История версий и восстановление</summary><div class="ultraHistoryBody" id="ultraHistoryBody">Для новой карты версий нет.</div>','ultraHistory'));
 const history=editor.querySelector('.ultraHistory');if(history)history.id='ultraHistory';
 editor.addEventListener('click',e=>{
  const b=e.target.closest('[data-action],[data-scale]');if(!b)return;
  if(b.hasAttribute('data-scale')){U.scale=Number(b.dataset.scale);scaleView();return}
  if(b.dataset.action==='clone')clone();
  if(b.dataset.action==='delete')remove();
  if(b.dataset.action==='export')exportJson();
  if(b.dataset.action==='ttk'){if(editing)location.href='./ttk.html?id='+Number(editing.id);else alert('Сначала сохраните ПФ')}
 });
 editor.addEventListener('input',e=>{
  if(e.target.id==='ultraLoss'){U.loss=Number(e.target.value);calc()}
  else if(e.target.id==='rName')calc();
 });
 el('ultraAutoAllergens').addEventListener('change',calc);
 el('ultraCopyBatch').addEventListener('click',copyBatch);
 el('ultraPhotoChoose').addEventListener('click',()=>el('photoFile').click());
 el('photoFile').addEventListener('change',e=>{
  const file=e.target.files?.[0];
  if(!file||file.size>2*1024*1024||!/^image\/(jpeg|png|webp)$/.test(file.type))return;
  const reader=new FileReader();reader.onload=()=>{const img=el('ultraPhotoBox');if(img)img.innerHTML='<img alt="Предпросмотр полуфабриката" src="'+esc(reader.result)+'">';};reader.readAsDataURL(file);
 });
 comp.addEventListener('input',e=>{
  const input=e.target.closest('[data-u-index][data-u-field]');if(!input)return;
  const i=Number(input.dataset.uIndex),field=input.dataset.uField;
  if(field!=='gross_g'&&field!=='net_g')return;
  components[i][field]=input.value===''?0:Number(input.value);
  calc();
 });
 comp.addEventListener('change',e=>{
  const input=e.target.closest('[data-u-index][data-u-field]');if(!input)return;
  const i=Number(input.dataset.uIndex),field=input.dataset.uField;
  if(field==='source_type'){components[i].source_type=input.value;components[i].source_id=null;renderComponents()}
  else if(field==='source_id'){components[i].source_id=Number(input.value)||null;renderComponents()}
 });
 comp.addEventListener('click',e=>{
  const b=e.target.closest('[data-remove]');if(!b)return;
  components.splice(Number(b.dataset.remove),1);renderComponents();
 });
}
function mode(page){
 const pf=currentKind==='prefab';
 el('catalogPage').classList.toggle('ultraCatalogMode',pf);
 el('editorPage').classList.toggle('ultraEditorMode',pf);
 if(page==='editor'){el('rYield').readOnly=pf;el('ultraTtkDetails').open=!pf;if(pf)calc()}
}
function pfList(){return recipes.filter(r=>r.kind==='prefab')}
function icon(c){const s=String(c||'').toLowerCase();return /соус|заправ/.test(s)?'🥣':/кревет|рыб|мор/.test(s)?'🦐':/овощ/.test(s)?'🥒':/рис|лапш/.test(s)?'🍚':'🍣'}
function renderList(){
 if(currentKind!=='prefab'){old.list();return}
 const all=pfList(),cats=[...new Set(all.map(r=>r.category||'Без категории'))].sort((a,b)=>a.localeCompare(b,'ru'));
 el('ultraTotal').textContent=all.length;el('ultraApproved').textContent=all.filter(r=>r.status==='Утверждено').length;
 el('ultraDrafts').textContent=all.filter(r=>r.status!=='Утверждено'&&r.status!=='Архив').length;
 el('ultraCategoryFilter').innerHTML='<option value="">Все категории</option>'+cats.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
 if(!cats.includes(U.cat))U.cat='';el('ultraCategoryFilter').value=U.cat;
 el('ultraCategories').innerHTML='<button type="button" data-category="" class="'+(!U.cat?'isSelected':'')+'">🌊 Все · '+all.length+'</button>'+
  cats.map(c=>'<button type="button" data-category="'+esc(c)+'" class="'+(c===U.cat?'isSelected':'')+'">'+icon(c)+' '+esc(c)+' · '+all.filter(r=>(r.category||'Без категории')===c).length+'</button>').join('');
 const q=U.search.toLowerCase().trim();
 const list=all.filter(r=>(!U.status||r.status===U.status)&&(!U.cat||(r.category||'Без категории')===U.cat)&&(!q||[r.name,r.code,r.category].some(v=>String(v||'').toLowerCase().includes(q))));
 el('ultraCards').innerHTML=list.length?list.map(r=>{
  const img=r.photo_path&&/^data:image\/(png|jpeg|webp);base64,/.test(r.photo_path)?
   '<img loading="lazy" src="'+esc(r.photo_path)+'" alt="'+esc(r.name)+'">':'<span class="ultraCardNoPhoto">'+icon(r.category)+'</span>';
  const state=r.status==='Утверждено'?'approved':r.status==='Тест'?'test':'';
  return '<article class="ultraCard"><div class="ultraCardPhoto">'+img+'<span class="ultraCardTag">'+esc(r.code)+'</span></div>'+
  '<div class="ultraCardMain"><div class="ultraCardCat">'+esc(r.category||'Полуфабрикат')+'</div>'+
  '<h3 class="ultraCardTitle">'+esc(r.name)+'</h3><div class="ultraCardMetrics"><span class="ultraCardYield">'+nice(r.yield_g)+' г</span>'+
  '<span class="ultraStatus '+state+'">'+esc(r.status)+'</span></div>'+
  '<div class="ultraCardActions"><button type="button" data-id="'+Number(r.id)+'">✎ Редактор</button>'+
  '<button type="button" class="secondary" data-action="ttk" data-id="'+Number(r.id)+'">ТТК А4</button></div></div></article>';
 }).join(''):'<div class="ultraEmpty">Нет результатов. Измените фильтры или создайте ПФ.</div>';
}
function photoPreview(){
 const host=el('ultraPhotoBox');if(!host)return;
 host.innerHTML=photoData&&/^data:image\/(jpeg|png|webp);base64,/.test(photoData)?
  '<img alt="Фото полуфабриката" src="'+esc(photoData)+'">':
  '<span class="ultraPhotoPlaceholder">🍣</span>';
}
function nextCode(){
 const exists=new Set(pfList().map(r=>r.code));let k=1;while(exists.has('МС-ПФ-'+String(k).padStart(3,'0')))k++;
 return 'МС-ПФ-'+String(k).padStart(3,'0');
}
function fresh(){
 old.make();el('photoFile').value='';if(currentKind!=='prefab')return;
 el('rCode').value=nextCode();el('rCategory').value='Соусы';U.loss=0;U.scale=1;el('ultraLoss').value='0';
 el('ultraAutoAllergens').checked=true;el('ultraItemLabel').textContent='Новый полуфабрикат';
 renderComponents();photoPreview();el('ultraRelated').textContent='После сохранения будут показаны связанные товары.';
 el('ultraHistoryBody').textContent='История появится после изменения карточки.';
}
async function open(id){
 await old.open(id);if(currentKind!=='prefab'||!editing||Number(editing.id)!==Number(id))return;
 el('photoFile').value='';photoPreview();
 const rows=await http('/rest/v1/recipe_lines?select=*&recipe_id=eq.'+Number(id)+'&order=seq.asc');
 components=rows.map(r=>({source_type:r.ingredient_id?'ingredient':'prefab',source_id:Number(r.ingredient_id||r.prefab_id),gross_g:n(r.gross_g),net_g:n(r.net_g),line_yield_g:r.line_yield_g==null?null:n(r.line_yield_g)}));
 U.loss=n(editing.ttk_fields?.loss_g);U.scale=1;el('ultraLoss').value=U.loss;
 el('ultraAutoAllergens').checked=editing.ttk_fields?.ultra?.auto_allergens!==false;
 renderComponents();el('ultraItemLabel').textContent=editing.name;
 related();history(id);
}
function wouldCycle(p){
 if(!editing||!p)return false;
 const target=Number(editing.id),seen=new Set();
 function walk(id){
  if(id===target)return true;if(seen.has(id))return false;seen.add(id);
  return recipeLines.some(l=>Number(l.recipe_id)===id&&l.prefab_id!=null&&walk(Number(l.prefab_id)));
 }
 return walk(Number(p.id));
}
function componentsHtml(){
 if(currentKind!=='prefab'){old.rows();return}
 const options=(sources,id)=>'<option value="">Выберите…</option>'+sources.map(a=>'<option value="'+Number(a.id)+'" '+(Number(a.id)===Number(id)?'selected':'')+'>'+esc(a.name)+'</option>').join('');
 el('components').innerHTML=components.map((c,i)=>{
  const pf=c.source_type==='prefab',sources=pf?pfList().filter(p=>!wouldCycle(p)):ingredients;
  return '<div class="ultraComponentRow"><select data-u-index="'+i+'" data-u-field="source_type">'+
   '<option value="ingredient" '+(!pf?'selected':'')+'>Ингредиент</option><option value="prefab" '+(pf?'selected':'')+'>Полуфабрикат</option></select>'+
   '<select class="ultraComponentName" data-u-index="'+i+'" data-u-field="source_id">'+options(sources,c.source_id)+'</select>'+
   '<label>Брутто, г<input type="number" min="0" step=".01" data-u-index="'+i+'" data-u-field="gross_g" value="'+esc(c.gross_g??0)+'"></label>'+
   '<label>Нетто, г<input type="number" min="0" step=".01" data-u-index="'+i+'" data-u-field="net_g" value="'+esc(c.net_g??0)+'"></label>'+
   '<button type="button" class="ultraComponentDelete" data-remove="'+i+'" title="Убрать компонент">✕</button></div>';
 }).join('')||'<p class="muted">Добавьте сырьё или вложенный ПФ.</p>';
 calc();
}
function add(){components.push({source_type:'ingredient',source_id:null,gross_g:0,net_g:0});renderComponents()}
function mass(){const net=components.reduce((a,c)=>a+n(c.net_g),0);return {net:round(net),yield:round(Math.max(0,net-U.loss))}}
function analyze(entries,visited=new Set()){
 const out={cost:0,costComplete:true,food:{protein:0,fat:0,carbs:0,kcal:0},foodComplete:true,missingFood:[],allergens:new Set(),unverified:[],error:[]};
 for(const c of entries){
  const qty=n(c.net_g);
  if(!Number.isFinite(qty)||qty<0){out.error.push('Неверная масса');out.costComplete=false;out.foodComplete=false;continue}
  if(c.source_type==='ingredient'){
   const ing=ingredients.find(i=>Number(i.id)===Number(c.source_id));
   if(!ing){out.error.push('Ингредиент не выбран');out.costComplete=false;out.foodComplete=false;continue}
   if(ing.purchase_price_rub_per_kg==null)out.costComplete=false;else out.cost+=Number(ing.purchase_price_rub_per_kg)*qty/1000;
   const nutr=ing.nutrition_100g||{};
   if(['protein','fat','carbs','kcal'].every(k=>nutr[k]!=null&&nutr[k]!==''&&Number.isFinite(Number(nutr[k])))){
    for(const k of ['protein','fat','carbs','kcal'])out.food[k]+=Number(nutr[k])*qty/100;
   }else{out.foodComplete=false;out.missingFood.push(ing.name)}
   String(ing.allergens||'').split(/[,;]+/).map(t=>t.trim()).filter(Boolean).forEach(t=>out.allergens.add(t));
   if(ing.allergen_status!=='verified')out.unverified.push(ing.name);
  }else{
   const recipe=recipes.find(r=>Number(r.id)===Number(c.source_id));
   if(!recipe||recipe.kind!=='prefab'||n(recipe.yield_g)<=0||visited.has(Number(recipe.id))){
    out.error.push('Неверный или циклический ПФ');out.costComplete=false;out.foodComplete=false;continue;
   }
   const trail=new Set(visited);trail.add(Number(recipe.id));
   const inner=analyze(recipeLines.filter(l=>Number(l.recipe_id)===Number(recipe.id)).map(l=>({
    source_type:l.ingredient_id?'ingredient':'prefab',source_id:Number(l.ingredient_id||l.prefab_id),net_g:n(l.net_g)})),trail);
   if(!inner.costComplete)out.costComplete=false;else out.cost+=inner.cost*qty/n(recipe.yield_g);
   if(!inner.foodComplete)out.foodComplete=false;else for(const k of ['protein','fat','carbs','kcal'])out.food[k]+=inner.food[k]*qty/n(recipe.yield_g);
   out.missingFood.push(...inner.missingFood);out.unverified.push(...inner.unverified);out.error.push(...inner.error);
   inner.allergens.forEach(t=>out.allergens.add(t));
  }
 }
 out.cost=round(out.cost);for(const k of ['protein','fat','carbs','kcal'])out.food[k]=round(out.food[k]);
 out.unverified=[...new Set(out.unverified)];out.missingFood=[...new Set(out.missingFood)];return out;
}
function calc(){
 if(currentKind!=='prefab'||el('editorPage').classList.contains('hidden'))return;
 const m=mass(),a=analyze(components);
 el('rYield').value=m.yield.toFixed(2);
 el('ultraMetricYield').textContent=nice(m.yield)+' г';
 el('ultraMassNote').textContent='Нетто '+nice(m.net)+' г − потери '+nice(U.loss)+' г = '+nice(m.yield)+' г';
 el('ultraMassWarning').textContent=U.loss>m.net?'Потери больше нетто':'';
 el('ultraMetricCost').textContent=!components.length?'—':a.costComplete?nice(a.cost)+' ₽':'Нет всех цен';
 el('ultraCostNote').textContent=a.costComplete?'Себестоимость всей партии':'Заполните закупочные цены';
 const tags=[...a.allergens].sort((x,y)=>x.localeCompare(y,'ru'));
 el('ultraMetricAllergens').textContent=tags.length?tags.slice(0,2).join(', ')+(tags.length>2?'…':''):'—';
 el('ultraAllergenNote').textContent=a.unverified.length?'Часть источников не проверена':'Из справочника сырья';
 if(el('ultraAutoAllergens').checked)el('rAllergens').value=tags.join(', ');
 el('ultraAllergenDetail').textContent=(tags.length?'Группы: '+tags.join(', ')+'. ':'Группы не установлены. ')+(a.unverified.length?'Не подтверждены: '+a.unverified.slice(0,5).join(', ')+'.':'');
 const ready=a.foodComplete&&components.length&&m.yield>0;
 el('ultraMetricNutrition').textContent=ready?nice(a.food.kcal*100/m.yield)+' ккал':'Нет данных';
 el('ultraNutritionNote').textContent=ready?'На 100 г готового ПФ':'Не все ингредиенты имеют КБЖУ';
 el('ultraNutritionDetail').textContent=ready?'На 100 г: Б '+nice(a.food.protein*100/m.yield)+' · Ж '+nice(a.food.fat*100/m.yield)+' · У '+nice(a.food.carbs*100/m.yield)+' · '+nice(a.food.kcal*100/m.yield)+' ккал':
 'Не хватает данных по: '+(a.missingFood.slice(0,6).join(', ')||'составу')+'.';
 el('ultraItemLabel').textContent=el('rName').value||'Новый полуфабрикат';
 const warnings=[];
 if(a.unverified.length)warnings.push('Аллергены требуют сверки с этикетками.');
 if(!ready)warnings.push('Авто-КБЖУ неполное: необходимы исходные показатели сырья.');
 if(a.error.length)warnings.push('Некорректны некоторые компоненты.');
 if(U.loss>m.net)warnings.push('Потери больше массы нетто.');
 el('ultraReviewWarning').hidden=!warnings.length;el('ultraReviewWarning').textContent=warnings.join(' ');
 scaleView();
}
function scaleView(){
 if(!el('ultraScaleRows'))return;
 document.querySelectorAll('#ultraDemoScale [data-scale]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.scale)===U.scale));
 el('ultraScaleRows').innerHTML=components.map(c=>{
  const obj=(c.source_type==='ingredient'?ingredients:recipes).find(x=>Number(x.id)===Number(c.source_id));
  return '<div class="ultraScaleLine"><span>'+esc(obj?.name||'Компонент не выбран')+'</span><b>'+nice(n(c.net_g)*U.scale)+' г</b></div>';
 }).join('')+'<div class="ultraScaleLine"><strong>Итого</strong><b>'+nice(mass().yield*U.scale)+' г</b></div>';
}
async function copyBatch(){
 const text=[el('rName').value,'Партия ×'+U.scale,...components.map(c=>{
  const r=(c.source_type==='ingredient'?ingredients:recipes).find(x=>Number(x.id)===Number(c.source_id));
  return (r?.name||'Без названия')+' — '+nice(n(c.net_g)*U.scale)+' г';
 }),'Выход — '+nice(mass().yield*U.scale)+' г'].join('\n');
 try{await navigator.clipboard.writeText(text);el('ultraCopyBatch').textContent='✓ Скопировано'}
 catch{alert('Браузер не разрешил копирование в буфер обмена.')}
}
function uses(id){
 const out=[],seen=new Set(),todo=[Number(id)];
 while(todo.length){
  const child=todo.shift();
  for(const l of recipeLines.filter(x=>Number(x.prefab_id)===child)){
   const r=recipes.find(x=>Number(x.id)===Number(l.recipe_id));
   if(!r||seen.has(r.id))continue;
   seen.add(r.id);out.push(r);todo.push(r.id);
  }
 }
 return out;
}
function related(){
 if(!editing){el('ultraRelated').textContent='Связи появятся после сохранения.';return}
 if(!usageLoaded){el('ultraRelated').textContent='Данные о связях временно недоступны.';return}
 const rows=uses(editing.id);
 el('ultraRelated').innerHTML=rows.length?rows.map(r=>{
  const stale=new Date(r.updated_at)<new Date(editing.updated_at);
  return '<div class="ultraRelatedItem"><span><b>'+esc(r.code)+'</b> '+esc(r.name)+'<br>'+
   '<small>'+esc(r.kind==='prefab'?'ПФ':'Товар')+(stale?' · требуется проверить':'')+'</small></span>'+
   '<button class="secondary" data-related="'+Number(r.id)+'">Открыть</button></div>';
 }).join(''):'<p>Пока не используется в других ПФ и роллах.</p>';
 el('ultraRelated').querySelectorAll('[data-related]').forEach(b=>b.addEventListener('click',()=>openRecipe(Number(b.dataset.related))));
}
async function history(id){
 if(!id){el('ultraHistoryBody').textContent='Версий пока нет.';return}
 try{
  U.history=await http('/rest/v1/recipe_versions?select=id,version,created_at,snapshot&recipe_id=eq.'+Number(id)+'&order=version.desc&limit=30');
  el('ultraHistoryBody').innerHTML=U.history.length?U.history.map(v=>
   '<div class="ultraHistoryLine"><span>Версия '+Number(v.version)+'</span><button type="button" class="secondary" data-restore="'+Number(v.id)+'">Восстановить как черновик</button></div>'
  ).join(''):'Истории изменений пока нет.';
  el('ultraHistoryBody').querySelectorAll('[data-restore]').forEach(b=>b.addEventListener('click',()=>restore(Number(b.dataset.restore))));
 }catch(e){el('ultraHistoryBody').textContent='Не удалось загрузить историю: '+e.message}
}
function restore(id){
 const v=U.history.find(x=>Number(x.id)===Number(id)),snapshot=v?.snapshot;
 if(!snapshot?.recipe||!Array.isArray(snapshot.lines)){alert('Старая версия не содержит полного состава.');return}
 if(!confirm('Загрузить прежнюю версию в редактор? Сохранять придётся отдельно.'))return;
 for(const field in fmap)el(field).value=field==='rNutrition'?(snapshot.recipe.nutrition?.text||''):(snapshot.recipe[fmap[field]]??'');
 el('rStatus').value='Черновик';el('rApproved').value='';el('rApprovedDate').value='';
 photoData=snapshot.recipe.photo_path||null;
 if(photoData){el('photoPreview').src=photoData;el('photoPreview').classList.remove('hidden')}
 components=snapshot.lines.map(l=>({source_type:l.ingredient_id?'ingredient':'prefab',source_id:Number(l.ingredient_id||l.prefab_id),gross_g:n(l.gross_g),net_g:n(l.net_g)}));
 U.loss=n(snapshot.recipe.ttk_fields?.loss_g);el('ultraLoss').value=U.loss;renderComponents();photoPreview();
 msg('saveInfo','Версия загружена в редактор. Нажмите «Сохранить карточку» для записи.',false);
}
function clone(){
 if(!editing||currentKind!=='prefab')return;
 if(!confirm('Создать копию этого ПФ отдельной карточкой?'))return;
 const fields=Object.fromEntries(Object.keys(fmap).map(k=>[k,el(k).value]));
 const parts=components.map(x=>({...x})),picture=photoData,loss=U.loss;
 fresh();for(const [k,v] of Object.entries(fields))el(k).value=v;
 el('rCode').value=nextCode();el('rName').value=fields.rName+' — копия';
 el('rStatus').value='Черновик';el('rApproved').value='';el('rApprovedDate').value='';
 photoData=picture;if(picture){el('photoPreview').src=picture;el('photoPreview').classList.remove('hidden')}
 components=parts;U.loss=loss;el('ultraLoss').value=loss;renderComponents();photoPreview();
 msg('saveInfo','Копия подготовлена — нажмите «Сохранить карточку».',false);
}
async function remove(){
 if(!editing||currentKind!=='prefab')return;
 if(!usageLoaded){alert('Невозможно проверить связи. Повторите после перезагрузки.');return}
 if(uses(editing.id).length){alert('Этот ПФ уже используется в других рецептах. Сначала замените его либо отправьте в архив.');return}
 if(!confirm('Удалить этот ПФ вместе с его историей версий? Отменить удаление нельзя.'))return;
 try{
  const deleted=await http('/rest/v1/recipes?id=eq.'+Number(editing.id),{method:'DELETE',headers:{Prefer:'return=representation'}});
  if(!Array.isArray(deleted)||deleted.length!==1)throw Error('Сервер не подтвердил удаление');
  editing=null;components=[];await reload();switchPage('prefab');
 }catch(e){alert('Не удалось удалить: '+e.message)}
}
function exportJson(){
 if(!editing){alert('Сначала сохраните полуфабрикат.');return}
 const data={schema:'more-sushi-v1',code:el('rCode').value,name:el('rName').value,category:el('rCategory').value,
 yield_g:mass().yield,loss_g:U.loss,components:components.map(c=>({type:c.source_type,
 name:(c.source_type==='ingredient'?ingredients:recipes).find(i=>Number(i.id)===Number(c.source_id))?.name,
 gross_g:n(c.gross_g),net_g:n(c.net_g)}))};
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=(data.code||'recipe')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function save(){
 if(currentKind!=='prefab')return old.save();
 if(U.saving)return;
 if(!el('rName').value.trim()||!el('rCode').value.trim()){msg('saveInfo','Укажите код и название');return}
 if(!components.length){msg('saveInfo','Добавьте хотя бы один компонент');return}
 if(!usageLoaded){msg('saveInfo','Связи не загружены. Обновите страницу для проверки вложенных ПФ.');return}
 if(components.some(c=>!c.source_id||!Number.isFinite(Number(c.net_g))||!Number.isFinite(Number(c.gross_g))||n(c.net_g)<0||n(c.gross_g)<0)){
  msg('saveInfo','Выберите каждый компонент и проверьте граммовки');return;
 }
 if(components.some(c=>c.source_type==='prefab'&&wouldCycle(recipes.find(r=>Number(r.id)===Number(c.source_id))))){
  msg('saveInfo','Запрещена циклическая вложенность ПФ');return;
 }
 const m=mass();if(U.loss<0||m.yield<=0||U.loss>=m.net){msg('saveInfo','Потери должны быть меньше массы нетто; выход — больше нуля');return}
 const status=el('rStatus').value,analysis=analyze(components);
 if(status==='Утверждено'){
  if(['rScope','rRaw','rProcess','rServing','rQuality','rApproved'].some(k=>!el(k).value.trim())){msg('saveInfo','Для утверждения заполните обязательные разделы и утверждающего');return}
  if(analysis.error.length||analysis.unverified.length){msg('saveInfo','Проверьте аллергенные источники, прежде чем утверждать документ');return}
 }
 U.saving=true;
 try{
  await uploadPhoto();
  const food=analysis.foodComplete&&components.length?{...analysis.food,text:el('rNutrition').value,basis:'batch',source:'ingredients'}:
   {...(editing?.nutrition||{}),text:el('rNutrition').value};
  const data={kind:'prefab',code:el('rCode').value.trim(),name:el('rName').value.trim(),category:el('rCategory').value,
   yield_g:m.yield,status,scope:el('rScope').value,raw_requirements:el('rRaw').value,
   process:el('rProcess').value,serving:el('rServing').value,quality:el('rQuality').value,
   storage:el('rStorage').value,allergens:el('ultraAutoAllergens').checked?[...analysis.allergens].sort().join(', '):el('rAllergens').value,
   nutrition:food,developed_by:el('rDeveloped').value||null,approved_by:el('rApproved').value||null,
   approved_at:el('rApprovedDate').value||null,photo_path:photoData,
   ttk_fields:{...(editing?.ttk_fields||{}),loss_g:U.loss,ultra:{auto_allergens:el('ultraAutoAllergens').checked}}};
  const lines=components.map((c,i)=>({seq:i,ingredient_id:c.source_type==='ingredient'?Number(c.source_id):null,
   prefab_id:c.source_type==='prefab'?Number(c.source_id):null,gross_g:n(c.gross_g),net_g:n(c.net_g),line_yield_g:c.line_yield_g??null}));
  let id;
  if(editing){
   await http('/rest/v1/rpc/save_ttk_document',{method:'POST',body:JSON.stringify({
    p_recipe_id:editing.id,p_expected_version:editing.version,p_patch:data,p_lines:lines})});
   id=editing.id;
  }else{
   const created=await http('/rest/v1/recipes?select=id',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({...data,version:1})});
   if(!created?.[0]?.id)throw Error('Сервер не подтвердил создание');
   id=created[0].id;
   try{await http('/rest/v1/recipe_lines',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(lines.map(l=>({...l,recipe_id:id})))})}
   catch(e){try{await http('/rest/v1/recipes?id=eq.'+id,{method:'DELETE'})}catch{}throw e}
  }
  await reload();await open(id);msg('saveInfo','✓ Рецептура сохранена. Выход и история обновлены.',false);
 }catch(e){msg('saveInfo','Ошибка: '+e.message)}
 finally{U.saving=false}
}
window.switchPage=function(page){old.nav(page);mode(page)};
window.renderRecipes=renderList;window.newRecipe=fresh;window.openRecipe=open;
window.renderComponents=componentsHtml;window.addComponent=add;window.saveRecipe=save;
setup();el('rName').addEventListener('input',calc);
})();
