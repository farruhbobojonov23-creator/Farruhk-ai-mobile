
/* MORE SUSHI · ULTRA PRO | Prefab studio */
(function(){
'use strict';
const el=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>Number(x||0), round=x=>Math.round((x+Number.EPSILON)*100)/100;
const nice=x=>n(x).toLocaleString('ru-RU',{maximumFractionDigits:2});
const old={nav:window.switchPage,list:window.renderRecipes,make:window.newRecipe,open:window.openRecipe,rows:window.renderComponents,save:window.saveRecipe};
const U={search:'',cat:'',status:'',loss:0,scale:1,saving:false,history:[],icon:'',studioMounted:false,editorParent:null,editorNext:null,lastSyncedStorage:null,lastAutoNutrition:null};
function node(tag,html,cls){
 const d=document.createElement(tag);if(cls)d.className=cls;d.innerHTML=html;return d;
}
function setup(){
 const catalog=el('catalogPage').querySelector('.panel');
 const wrap=node('div',
 '<div class="ultraHero"><div><small class="ultraEyebrow">🌊 МОРЕ СУШИ · STUDIO ULTRA PRO</small><h2>Полуфабрикаты</h2><p>Ингредиенты → ПФ → роллы → цветная ТТК</p></div><button type="button" data-action="create">＋ Создать полуфабрикат</button></div>'+
 '<div class="ultraSummary"><div class="ultraKpi"><b id="ultraTotal">0</b><small>Всего ПФ</small></div><div class="ultraKpi"><b id="ultraApproved">0</b><small>Утверждено</small></div><div class="ultraKpi"><b id="ultraDrafts">0</b><small>В разработке</small></div></div>'+
 '<div class="ultraControls"><input type="search" id="ultraSearch" placeholder="🔎 Поиск по названию или коду"><select id="ultraStatusFilter"><option value="">Все статусы</option><option>Черновик</option><option>Тест</option><option>Утверждено</option><option>Архив</option></select><select id="ultraCategoryFilter"><option value="">Все категории</option></select></div>'+
 '<div class="ultraStarter"><button type="button" data-action="starter-spicy">🥣 Спайси · создать черновик</button><small>Рецептура заполнится из существующего сырья. Сохранение — только после проверки.</small></div><div id="ultraCategories" class="ultraFilters"></div><div id="ultraCards" class="ultraGrid"></div>','ultraCatalog');
 wrap.id='ultraCatalog';catalog.insertBefore(wrap,catalog.firstChild);
 el('ultraSearch').addEventListener('input',e=>{U.search=e.target.value;renderList()});
 el('ultraStatusFilter').addEventListener('change',e=>{U.status=e.target.value;renderList()});
 el('ultraCategoryFilter').addEventListener('change',e=>{U.cat=e.target.value;renderList()});
 wrap.addEventListener('click',e=>{
 const b=e.target.closest('[data-action],[data-id],[data-category]');if(!b)return;
 if(b.dataset.action==='create')newRecipe();
  else if(b.dataset.action==='starter-spicy')starterSpicy();
 else if(b.dataset.id){if(b.dataset.action==='ttk')location.href='./ttk.html?id='+Number(b.dataset.id);else openRecipe(Number(b.dataset.id))}
 else if(b.hasAttribute('data-category')){U.cat=b.dataset.category;renderList()}
 });
 const editor=el('editorPage').querySelector('.panel'),heading=editor.firstElementChild;
 const header=node('div',
 '<div><small>ТЕХНОЛОГИЧЕСКИЙ КОНСТРУКТОР</small><h3 id="ultraItemLabel">Новый полуфабрикат</h3></div>'+
 '<div class="ultraEditorActions"><button type="button" class="secondary" data-action="clone">⧉ Копировать</button><button type="button" class="secondary" data-action="import">⇧ Импорт</button><input type="file" accept="application/json,.json" id="ultraImportFile" hidden><button type="button" class="secondary" data-action="export">⇩ JSON</button><button type="button" class="secondary" data-action="ttk">▤ ТТК А4</button><button type="button" class="danger" data-action="delete">🗑</button></div>',
 'ultraEditorBar');
 heading.after(header);
 const metrics=node('section',
 '<div class="ultraMetric"><small>Выход готового ПФ</small><strong id="ultraMetricYield">—</strong><span>Сумма нетто − потери</span></div>'+
 '<div class="ultraMetric"><small>Себестоимость партии</small><strong id="ultraMetricCost">—</strong><span id="ultraCostNote">Не выводится в ТТК</span></div>'+
 '<div class="ultraMetric"><small>Аллергены</small><strong id="ultraMetricAllergens">—</strong><span id="ultraAllergenNote">Из выбранных компонентов</span></div>'+
 '<div class="ultraMetric"><small>КБЖУ на 100 г</small><strong id="ultraMetricNutrition">—</strong><span id="ultraNutritionNote">При наличии данных сырья</span></div>',
 'ultraMetrics');header.after(metrics);
 metrics.after(node('section','<div id="ultraPhotoBox" class="ultraPhotoBox"></div><div class="ultraPhotoSide"><b>📸 Реалистичное фото полуфабриката</b><p>Фотография без фона появится в каталоге и ТТК. Её можно выбрать из общей библиотеки.</p><div class="msVisualButtons"><button type="button" id="ultraPhotoChoose" class="secondary">＋ Загрузить фото</button><button type="button" id="ultraIconChoose" class="secondary">Выбрать из библиотеки</button><button type="button" id="ultraPhotoRemove" class="msPhotoRemove">Удалить фото</button></div></div>','ultraPhotoPanel'));
 const comp=el('components');
 const h3=[...editor.children].find(x=>x.tagName==='H3'&&x.textContent.includes('Сырьё'));
 if(h3)h3.before(node('div','<h3>🥣 Рецептура и компоненты</h3><small>Брутто, нетто и вложенные ПФ</small>','ultraComposerHeader'));
 const add=[...editor.querySelectorAll('button')].find(x=>(x.getAttribute('onclick')||'').includes('addComponent()'));
 if(add){
  add.after(node('div',
   '<label>Технологические потери, г <input type="number" id="ultraLoss" value="0" min="0" step=".01"></label>'+
   '<span id="ultraMassNote" class="ultraCalcResult">—</span><span id="ultraMassWarning" class="ultraWarning"></span>','ultraLossBar'));
  const mass=el('ultraLoss').closest('.ultraLossBar');
  mass.after(node('section',
   '<div class="ultraDemoScaleHeader"><strong>⚖️ Производственная партия</strong><div class="ultraScaleControls">'+
   '<button type="button" data-scale="1" class="selected">×1</button><button type="button" data-scale="2">×2</button><button type="button" data-scale="5">×5</button>'+
   '<button type="button" id="ultraCopyBatch">Скопировать план</button></div></div><div class="ultraScaleRows" id="ultraScaleRows"></div>','ultraDemoScale'));
  mass.nextElementSibling.id='ultraDemoScale';
  mass.nextElementSibling.after(node('div',
   '<section class="ultraInfo"><h4>🧬 Аллергены и КБЖУ</h4><label style="font-size:12px"><input type="checkbox" id="ultraAutoAllergens" checked> Автоматически собирать аллергены</label><label class="ultraReviewCheck"><input type="checkbox" id="ultraReviewed"> Сведения об аллергенах сверены с документами поставщиков перед утверждением</label>'+
   '<p id="ultraAllergenDetail"></p><p id="ultraNutritionDetail"></p></section>'+
   '<section class="ultraInfo"><h4>🔗 Где используется</h4><div id="ultraRelated">Нет связей</div></section>','ultraFootPanels'));
  mass.nextElementSibling.nextElementSibling.after(node('div','', 'ultraWarnBox'));
  editor.querySelector('.ultraWarnBox').id='ultraReviewWarning';el('ultraReviewWarning').hidden=true;
  const pfQuality=node('section',
   '<div class="ultraPfHeading"><div><small>КОНТРОЛЬ ПОЛУФАБРИКАТА</small><h3>🧊 Хранение и безопасность</h3></div><span>Отдельно от сырья</span></div>'+
   '<div class="ultraPfFields"><label>Температура готового ПФ<input id="pfTemp" placeholder="Например, +2…+6 °C"></label>'+
   '<label>Срок готового ПФ, часов<input id="pfHours" type="number" min="0.1" step=".1" inputmode="decimal" placeholder="Укажите срок"></label>'+
   '<label>Основание для срока и режима<input id="pfSource" placeholder="Документ / утверждённая технология"></label>'+
   '<label>Особые условия хранения<input id="pfStorageNote" placeholder="При необходимости"></label></div>'+
   '<p class="ultraPfHint">⚠️ Срок и температуру готового полуфабриката необходимо подтвердить: они не копируются из сырья.</p>'+
   '<div id="pfStoragePreview" class="ultraPfStorage">Параметры хранения пока не указаны.</div>'+
   '<div class="ultraPfCheckTitle"><h4>Готовность карточки ПФ</h4><span id="pfReadyCount">0 / 7</span></div>'+
   '<div class="ultraPfChecklist" id="pfReadiness"></div>'+
   '<div class="ultraPfQuick"><button type="button" id="pfOpenProcess" class="secondary">✎ Технология и утверждение</button><button type="button" id="pfFillNutrition" class="secondary">↳ Перенести КБЖУ в ТТК</button></div>','ultraPfSafety');
  pfQuality.id='ultraPfSafety';
  el('ultraDemoScale').after(pfQuality);
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
  if(b.dataset.action==='import')el('ultraImportFile').click();
  if(b.dataset.action==='export')exportJson();
  if(b.dataset.action==='ttk'){if(editing)location.href='./ttk.html?id='+Number(editing.id);else alert('Сначала сохраните ПФ')}
 });
 editor.addEventListener('input',e=>{
  if(e.target.id==='ultraLoss'){invalidateReview();U.loss=Number(e.target.value);calc()}
  else if(e.target.id==='rName')calc();
 });
 el('ultraAutoAllergens').addEventListener('change',calc);
 el('ultraReviewed').addEventListener('change',readiness);
 for(const id of ['pfTemp','pfHours','pfSource','pfStorageNote'])el(id).addEventListener('input',updateStorage);
 el('pfOpenProcess').addEventListener('click',()=>{
  el('ultraTtkDetails').open=true;el('rProcess').scrollIntoView({behavior:'smooth',block:'center'});el('rProcess').focus();
 });
 el('pfFillNutrition').addEventListener('click',copyCalculatedNutrition);
 for(const id of ['rCode','rCategory','rName','rScope','rRaw','rProcess','rServing','rQuality','rStorage','rNutrition','rDeveloped','rApproved','rApprovedDate','rStatus'])
   el(id).addEventListener('input',()=>readiness());
 setupStudioLayout();
 el('ultraCopyBatch').addEventListener('click',copyBatch);
 el('ultraPhotoChoose').addEventListener('click',()=>el('photoFile').click());
 el('ultraIconChoose').addEventListener('click',()=>{
  if(!window.MSIcons)return alert('Фотобиблиотека не загружена.');
  MSIcons.showIconPicker(key=>{U.icon=key;photoData=null;el('photoFile').value='';el('photoPreview').classList.add('hidden');photoPreview();},U.icon,el('rName').value);
 });
 el('ultraPhotoRemove').addEventListener('click',()=>{
  photoData=null;U.icon='none';el('photoFile').value='';el('photoPreview').src='';el('photoPreview').classList.add('hidden');photoPreview();
 });
 el('ultraImportFile').addEventListener('change',importJson);
 el('photoFile').addEventListener('change',e=>{
  const file=e.target.files?.[0];
  if(!file||file.size>10*1024*1024||!/^image\/(jpeg|png|webp)$/.test(file.type))return;
  U.icon='none';const reader=new FileReader();reader.onload=()=>{const img=el('ultraPhotoBox');if(img)img.innerHTML='<img alt="Предпросмотр полуфабриката" src="'+esc(reader.result)+'">';};reader.readAsDataURL(file);
 });
 comp.addEventListener('input',e=>{
  const input=e.target.closest('[data-u-index][data-u-field]');if(!input)return;
  const i=Number(input.dataset.uIndex),field=input.dataset.uField;
  if(field!=='gross_g'&&field!=='net_g')return;
  invalidateReview();components[i][field]=input.value===''?0:Number(input.value);
  calc();
 });
 comp.addEventListener('change',e=>{
  const input=e.target.closest('[data-u-index][data-u-field]');if(!input)return;
  const i=Number(input.dataset.uIndex),field=input.dataset.uField;
  if(field==='source_type'){invalidateReview();components[i].source_type=input.value;components[i].source_id=null;renderComponents()}
  else if(field==='source_id'){invalidateReview();components[i].source_id=Number(input.value)||null;renderComponents()}
 });
 comp.addEventListener('click',e=>{
  const b=e.target.closest('[data-remove]');if(!b)return;
  invalidateReview();components.splice(Number(b.dataset.remove),1);renderComponents();
 });
}

function setupStudioLayout(){
 if(U.studioMounted)return;
 const catalogPage=el('catalogPage'),panel=catalogPage.querySelector('.panel');
 const editorPage=el('editorPage');
 U.editorParent=editorPage.parentNode;U.editorNext=editorPage.nextSibling;
 const studioTop=node('div',
  '<div><small>🌊 MORE SUSHI · STUDIO ULTRA PRO</small><h2>Разработка полуфабрикатов</h2><p>Создание рецептур, вложенные ПФ, автоматические расчёты и технологические карты</p></div>'+
  '<span class="ultraLiveLabel">● РАБОЧЕЕ ПРОСТРАНСТВО</span>', 'ultraStudioTop');
 const layout=node('div','<section class="ultraStudioLeft" id="ultraStudioLeft"></section>'+
 '<section class="ultraStudioCenter" id="ultraStudioCenter"></section>'+
 '<aside class="ultraStudioAside" id="ultraStudioAside"></aside>','ultraStudioLayout');
 panel.prepend(layout);panel.prepend(studioTop);
 el('ultraStudioLeft').append(el('ultraCatalog'));
 el('ultraStudioCenter').append(editorPage);
 const rail=el('ultraStudioAside');
 rail.append(node('div','<span class="ultraRailEyebrow">КОНТРОЛЬ РЕЦЕПТУРЫ</span><h3>Расчёты и безопасность</h3><p>Данные обновляются при изменении состава.</p>','ultraRailHeader'));
 rail.append(el('ultraMetrics'));
 rail.append(el('ultraFootPanels'));
 U.studioMounted=true;
}
function restoreProductEditor(){
 if(!U.studioMounted)return;
 const editor=el('editorPage');
 if(editor.parentNode!==U.editorParent){
  if(U.editorNext&&U.editorNext.parentNode===U.editorParent)U.editorParent.insertBefore(editor,U.editorNext);
  else U.editorParent.append(editor);
 }
 el('app').querySelector('.main').classList.remove('ultraWorkspaceActive');
}
function showStudio(){
 if(!U.studioMounted)setupStudioLayout();
 const editor=el('editorPage');
 if(editor.parentNode!==el('ultraStudioCenter'))el('ultraStudioCenter').append(editor);
 el('catalogPage').classList.remove('hidden');
 editor.classList.remove('hidden');
 el('catalogPage').classList.add('ultraCatalogMode');
 editor.classList.add('ultraEditorMode');
 el('app').querySelector('.main').classList.add('ultraWorkspaceActive');
 el('pageTitle').textContent='Полуфабрикаты · ULTRA PRO';
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
  const img=window.MSIcons?MSIcons.render(r,'recipe','large'):
  (r.photo_path&&/^data:image\/(png|jpeg|webp);base64,/.test(r.photo_path)?
   '<img loading="lazy" src="'+esc(r.photo_path)+'" alt="'+esc(r.name)+'">':'<span class="ultraCardNoPhoto">'+icon(r.category)+'</span>');
  const state=r.status==='Утверждено'?'approved':r.status==='Тест'?'test':'';
  return '<article class="ultraCard '+(editing&&Number(editing.id)===Number(r.id)?'is-current':'')+'"><div class="ultraCardPhoto">'+img+'<span class="ultraCardTag">'+esc(r.code)+'</span></div>'+
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
  (window.MSIcons?MSIcons.render({name:el('rName').value||editing?.name||'Полуфабрикат',category:el('rCategory').value,
     ttk_fields:{ultra:{icon_emoji:U.icon}}},'recipe','large'):'<span class="ultraPhotoPlaceholder">🍣</span>');
}
function invalidateReview(){
 if(el('ultraReviewed'))el('ultraReviewed').checked=false;
 if(el('rStatus')?.value==='Утверждено')el('rStatus').value='Черновик';
 if(U.lastAutoNutrition&&el('rNutrition').value===U.lastAutoNutrition)el('rNutrition').value='';
 U.lastAutoNutrition=null;
}
function getPfSafety(){
 return {temperature:el('pfTemp')?.value.trim()||'',hours:el('pfHours')?.value.trim()||'',
  source:el('pfSource')?.value.trim()||'',note:el('pfStorageNote')?.value.trim()||''};
}
function setPfSafety(v){
 for(const [key,id] of Object.entries({temperature:'pfTemp',hours:'pfHours',source:'pfSource',note:'pfStorageNote'}))
  el(id).value=v?.[key]??'';
 U.lastSyncedStorage=v?.temperature&&Number(v?.hours)>0?el('rStorage').value:null;
 el('pfStoragePreview').textContent=el('rStorage').value||'Параметры хранения пока не указаны.';
 readiness();
}
function updateStorage(){
 invalidateReview();
 const d=getPfSafety(),parts=[];
 if(d.temperature)parts.push('Температура хранения готового ПФ: '+d.temperature);
 if(d.hours!==''&&Number(d.hours)>0)parts.push('Срок хранения готового ПФ: '+d.hours+' ч');
 if(d.note)parts.push('Особые условия: '+d.note);
 if(d.temperature&&Number(d.hours)>0&&Number.isFinite(Number(d.hours))){
  el('rStorage').value=parts.join('. ')+'.';U.lastSyncedStorage=el('rStorage').value;
 }else if(U.lastSyncedStorage&&el('rStorage').value===U.lastSyncedStorage){
  el('rStorage').value='';U.lastSyncedStorage=null;
 }
 el('pfStoragePreview').textContent=d.temperature&&Number(d.hours)>0?
  el('rStorage').value:(d.temperature||d.hours||d.note?'⚠ Укажите температуру и срок, чтобы обновить условия в ТТК.':'Параметры хранения пока не указаны.');
 readiness();
}
function readiness(result){
 if(currentKind!=='prefab'||!el('pfReadiness'))return [];
 const a=result||analyze(components),m=mass(),d=getPfSafety();
 const masses=components.length>0&&components.every(c=>c.source_id&&Number(c.gross_g)>0&&Number(c.net_g)>0&&Number(c.net_g)<=Number(c.gross_g));
 const checks=[
  {label:'Код, название и категория',ok:!!(el('rCode').value.trim()&&el('rName').value.trim()&&el('rCategory').value.trim())},
  {label:'Компоненты, брутто, нетто и выход',ok:!!(masses&&m.yield>0&&!a.error.length&&Number.isFinite(U.loss)&&U.loss>=0&&U.loss<m.net)},
  {label:'Технология, сырьё и контроль качества',ok:!!(['rScope','rRaw','rProcess','rServing','rQuality'].every(id=>el(id).value.trim()))},
  {label:'Срок, температура и основание хранения',ok:!!(d.temperature&&Number(d.hours)>0&&Number.isFinite(Number(d.hours))&&d.source&&el('rStorage').value.trim())},
  {label:'Аллергены ингредиентов проверены',ok:!!(components.length&&!a.unverified.length&&el('ultraReviewed').checked)},
  {label:'КБЖУ всех ингредиентов подтверждено',ok:!!(components.length&&a.foodComplete&&!a.unverifiedNutrition.length&&m.yield>0&&el('rNutrition').value.trim())},
  {label:'Разработал, утвердил и дата',ok:!!(el('rDeveloped').value.trim()&&el('rApproved').value.trim()&&el('rApprovedDate').value)}
 ];
 el('pfReadyCount').textContent=checks.filter(x=>x.ok).length+' / '+checks.length;
 el('pfReadiness').innerHTML=checks.map(c=>'<div class="ultraPfCheck '+(c.ok?'ok':'pending')+'"><span>'+(c.ok?'✓':'!')+'</span>'+esc(c.label)+'</div>').join('');
 el('pfFillNutrition').disabled=!(components.length&&a.foodComplete&&m.yield>0);
 return checks;
}
function copyCalculatedNutrition(){
 const a=analyze(components),m=mass();
 if(!components.length||!a.foodComplete||m.yield<=0){alert('Нет данных КБЖУ по всем ингредиентам.');return}
 const f=x=>nice(round(x));
 el('rNutrition').value='На 100 г: белки '+f(a.food.protein*100/m.yield)+' г; жиры '+f(a.food.fat*100/m.yield)+' г; углеводы '+f(a.food.carbs*100/m.yield)+' г; '+f(a.food.kcal*100/m.yield)+' ккал. На партию ('+f(m.yield)+' г): белки '+f(a.food.protein)+' г; жиры '+f(a.food.fat)+' г; углеводы '+f(a.food.carbs)+' г; '+f(a.food.kcal)+' ккал.';
 U.lastAutoNutrition=el('rNutrition').value;
 el('ultraTtkDetails').open=true;readiness(a);
 msg('saveInfo',a.unverifiedNutrition.length?'КБЖУ перенесено как расчётное — требуется сверка данных сырья: '+a.unverifiedNutrition.join(', '):'КБЖУ перенесено из карточек сырья. Проверьте перед утверждением.',false);
}
function starterSpicy(){
 const formula=[
  ['Майонез Pechagin Professional 78%',6000],
  ['Соус кимчи',150],
  ['Соус шрирача',150],
  ['Шичими',20],
  ['Масло кунжутное',20]
 ];
 const found=formula.map(([name,grams])=>{
  const item=ingredients.find(i=>String(i.name).toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru'));
  return item?{source_type:'ingredient',source_id:Number(item.id),gross_g:grams,net_g:grams}:null;
 });
 if(found.some(x=>!x)){alert('В базе отсутствует часть ингредиентов для соуса спайси. Сначала добавьте сырьё.');return}
 if(editing&&el('rName').value.trim()&&!confirm('Открыть новый черновик соуса спайси? Несохранённые изменения текущей карточки будут потеряны.'))return;
 currentKind='prefab';fresh();
 el('rName').value='Соус спайси — основной';el('rCategory').value='Соусы';components=found;
 U.loss=0;el('ultraLoss').value='0';
 el('rProcess').value='Проверить сырьё и отвесить ингредиенты по рецептуре. Соединить майонез, соус кимчи, соус шрирача, шичими и кунжутное масло. Перемешать до однородности. Переложить в чистую промаркированную ёмкость. Условия и сроки хранения установить по утверждённой технологии.';
 el('rStatus').value='Черновик';renderComponents();photoPreview();
 msg('saveInfo','Черновик спайси на 6 340 г подготовлен. Заполните режим хранения, проверьте поставщиков, при необходимости измените рецепт и сохраните.',false);
}
function nextCode(){
 const exists=new Set(pfList().map(r=>r.code));let k=1;while(exists.has('МС-ПФ-'+String(k).padStart(3,'0')))k++;
 return 'МС-ПФ-'+String(k).padStart(3,'0');
}
function fresh(){
 old.make();el('photoFile').value='';if(currentKind!=='prefab')return;
 el('rCode').value=nextCode();el('rCategory').value='Соусы';U.icon='';U.loss=0;U.scale=1;el('ultraLoss').value='0';
 el('ultraAutoAllergens').checked=true;el('ultraReviewed').checked=false;U.lastAutoNutrition=null;el('ultraItemLabel').textContent='Новый полуфабрикат';
 setPfSafety({});
 renderComponents();photoPreview();renderList();el('ultraRelated').textContent='После сохранения будут показаны связанные товары.';
 el('ultraHistoryBody').textContent='История появится после изменения карточки.';
}
async function open(id){
 await old.open(id);if(currentKind!=='prefab'||!editing||Number(editing.id)!==Number(id))return;
 el('photoFile').value='';photoPreview();
 const rows=await http('/rest/v1/recipe_lines?select=*&recipe_id=eq.'+Number(id)+'&order=seq.asc');
 components=rows.map(r=>({source_type:r.ingredient_id?'ingredient':'prefab',source_id:Number(r.ingredient_id||r.prefab_id),gross_g:n(r.gross_g),net_g:n(r.net_g),line_yield_g:r.line_yield_g==null?null:n(r.line_yield_g)}));
 U.loss=n(editing.ttk_fields?.loss_g);U.icon=editing.ttk_fields?.ultra?.icon_emoji||'';U.scale=1;el('ultraLoss').value=U.loss;
 el('ultraAutoAllergens').checked=editing.ttk_fields?.ultra?.auto_allergens!==false;
 el('ultraReviewed').checked=!!editing.ttk_fields?.ultra?.allergens_reviewed_by_chef;U.lastAutoNutrition=null;
 setPfSafety(editing.ttk_fields?.ultra?.pf_storage||{});
 renderComponents();el('ultraItemLabel').textContent=editing.name;
 renderList();related();history(id);
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
function add(){invalidateReview();components.push({source_type:'ingredient',source_id:null,gross_g:0,net_g:0});renderComponents()}
function mass(){const net=components.reduce((a,c)=>a+n(c.net_g),0);return {net:round(net),yield:round(Math.max(0,net-U.loss))}}
function analyze(entries,visited=new Set()){
 const out={cost:0,costComplete:true,food:{protein:0,fat:0,carbs:0,kcal:0},foodComplete:true,missingFood:[],unverifiedNutrition:[],allergens:new Set(),unverified:[],error:[]};
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
    if(ing.nutrition_review_status!=='verified')out.unverifiedNutrition.push(ing.name);
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
   out.missingFood.push(...inner.missingFood);out.unverifiedNutrition.push(...inner.unverifiedNutrition);out.unverified.push(...inner.unverified);out.error.push(...inner.error);
   inner.allergens.forEach(t=>out.allergens.add(t));
  }
 }
 out.cost=round(out.cost);for(const k of ['protein','fat','carbs','kcal'])out.food[k]=round(out.food[k]);
 out.unverified=[...new Set(out.unverified)];out.missingFood=[...new Set(out.missingFood)];out.unverifiedNutrition=[...new Set(out.unverifiedNutrition)];return out;
}
function calc(){
 if(currentKind!=='prefab'||el('editorPage').classList.contains('hidden'))return;
 const m=mass(),a=analyze(components);
 el('rYield').value=m.yield.toFixed(2);
 el('ultraMetricYield').textContent=nice(m.yield)+' г';
 el('ultraMassNote').textContent='Нетто '+nice(m.net)+' г − потери '+nice(U.loss)+' г = '+nice(m.yield)+' г';
 el('ultraMassWarning').textContent=U.loss>m.net?'Потери больше нетто':'';
 el('ultraMetricCost').textContent=!components.length?'—':a.costComplete?nice(a.cost)+' ₽':'—';
 el('ultraCostNote').textContent=a.costComplete?'Себестоимость всей партии':'Заполните закупочные цены';
 const tags=[...a.allergens].sort((x,y)=>x.localeCompare(y,'ru'));
 el('ultraMetricAllergens').textContent=tags.length?tags.slice(0,2).join(', ')+(tags.length>2?'…':''):'—';
 el('ultraAllergenNote').textContent=a.unverified.length?'Часть источников не проверена':'Из справочника сырья';
 if(el('ultraAutoAllergens').checked)el('rAllergens').value=tags.join(', ');
 el('ultraAllergenDetail').textContent=(tags.length?'Группы: '+tags.join(', ')+'. ':'Группы не установлены. ')+(a.unverified.length?'Не подтверждены: '+a.unverified.slice(0,5).join(', ')+'.':'');
 const ready=a.foodComplete&&components.length&&m.yield>0;
 el('ultraMetricNutrition').textContent=ready?nice(a.food.kcal*100/m.yield)+' ккал':'—';
 el('ultraNutritionNote').textContent=ready?(a.unverifiedNutrition.length?'Расчётное КБЖУ · требует сверки':'На 100 г готового ПФ · проверено'):'Не все ингредиенты имеют КБЖУ';
 el('ultraNutritionDetail').textContent=ready?'На 100 г: Б '+nice(a.food.protein*100/m.yield)+' · Ж '+nice(a.food.fat*100/m.yield)+' · У '+nice(a.food.carbs*100/m.yield)+' · '+nice(a.food.kcal*100/m.yield)+' ккал':
 'Не хватает данных по: '+(a.missingFood.slice(0,6).join(', ')||'составу')+'.';
 el('ultraItemLabel').textContent=el('rName').value||'Новый полуфабрикат';
 const warnings=[];
 if(a.unverified.length)warnings.push('Аллергены требуют сверки с этикетками.');
 if(a.unverifiedNutrition.length)warnings.push('КБЖУ требует сверки: '+a.unverifiedNutrition.slice(0,3).join(', ')+'.');
 if(!ready)warnings.push('Авто-КБЖУ неполное: необходимы исходные показатели сырья.');
 if(a.error.length)warnings.push('Некорректны некоторые компоненты.');
 if(U.loss>m.net)warnings.push('Потери больше массы нетто.');
 el('ultraReviewWarning').hidden=!warnings.length;el('ultraReviewWarning').textContent=warnings.join(' ');
 readiness(a);
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
  U.history=await http('/rest/v1/recipe_versions?select=id,version,saved_at,snapshot&recipe_id=eq.'+Number(id)+'&order=version.desc&limit=30');
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
 el('rStatus').value='Черновик';el('rApproved').value='';el('rApprovedDate').value='';el('ultraReviewed').checked=false;
 setPfSafety(snapshot.recipe.ttk_fields?.ultra?.pf_storage||{});
 photoData=snapshot.recipe.photo_path||null;
 if(photoData){el('photoPreview').src=photoData;el('photoPreview').classList.remove('hidden')}
 components=snapshot.lines.map(l=>({source_type:l.ingredient_id?'ingredient':'prefab',source_id:Number(l.ingredient_id||l.prefab_id),gross_g:n(l.gross_g),net_g:n(l.net_g)}));
 U.loss=n(snapshot.recipe.ttk_fields?.loss_g);U.icon=snapshot.recipe.ttk_fields?.ultra?.icon_emoji||'';el('ultraLoss').value=U.loss;renderComponents();photoPreview();
 msg('saveInfo','Версия загружена в редактор. Нажмите «Сохранить карточку» для записи.',false);
}
function clone(){
 if(!editing||currentKind!=='prefab')return;
 if(!confirm('Создать копию этого ПФ отдельной карточкой?'))return;
 const fields=Object.fromEntries(Object.keys(fmap).map(k=>[k,el(k).value]));
 const parts=components.map(x=>({...x})),picture=photoData,loss=U.loss,oldIcon=U.icon,oldSafety=getPfSafety();
 fresh();for(const [k,v] of Object.entries(fields))el(k).value=v;
 el('rCode').value=nextCode();el('rName').value=fields.rName+' — копия';
 el('rStatus').value='Черновик';el('rApproved').value='';el('rApprovedDate').value='';el('ultraReviewed').checked=false;
 setPfSafety(oldSafety);photoData=picture;if(picture){el('photoPreview').src=picture;el('photoPreview').classList.remove('hidden')}
 components=parts;U.icon=oldIcon;U.loss=loss;el('ultraLoss').value=loss;renderComponents();photoPreview();
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
async function importJson(e){
 const file=e.target.files?.[0];e.target.value='';if(!file)return;
 if(file.size>2*1024*1024){alert('JSON-файл слишком большой (не более 2 МБ).');return}
 try{
  const data=JSON.parse(await file.text());
  if(data.schema!=='more-sushi-v1'||!Array.isArray(data.components)||data.components.length>70)throw Error('Неизвестный формат рецептуры');
  if(!data.components.length)throw Error('В файле нет ингредиентов или ПФ');
  const mapped=data.components.map(c=>{
   const source=c.type==='ingredient'?ingredients:c.type==='prefab'?pfList():[];
   const found=source.filter(r=>r.name===c.name);
   if(found.length!==1||!Number.isFinite(Number(c.gross_g))||!Number.isFinite(Number(c.net_g))||Number(c.gross_g)<0||Number(c.net_g)<0)throw Error('Не найден компонент или некорректный вес: '+String(c.name||''));
   return {source_type:c.type,source_id:found[0].id,gross_g:Number(c.gross_g),net_g:Number(c.net_g)};
  });
  if(!confirm('Загрузить рецепт «'+String(data.name||'Без имени')+'» как новую черновую карточку?'))return;
  currentKind='prefab';fresh();
  el('rName').value=String(data.name||'Импортированный ПФ').slice(0,180);
  el('rCategory').value=String(data.category||'Прочее').slice(0,100);
  for(const [key,id] of Object.entries({scope:'rScope',raw_requirements:'rRaw',process:'rProcess',serving:'rServing',quality:'rQuality',storage:'rStorage'}))
   if(typeof data[key]==='string')el(id).value=data[key];
  components=mapped;U.loss=n(data.loss_g);el('ultraLoss').value=U.loss;setPfSafety(data.pf_storage||{});renderComponents();
  msg('saveInfo','Файл загружен как новый черновик. Нажмите «Сохранить карточку».',false);
 }catch(err){alert('Не удалось импортировать: '+(err.message||err))}
}
function exportJson(){
 if(!editing){alert('Сначала сохраните полуфабрикат.');return}
 const data={schema:'more-sushi-v1',code:el('rCode').value,name:el('rName').value,category:el('rCategory').value,
 yield_g:mass().yield,loss_g:U.loss,pf_storage:getPfSafety(),scope:el('rScope').value,raw_requirements:el('rRaw').value,
 process:el('rProcess').value,serving:el('rServing').value,quality:el('rQuality').value,storage:el('rStorage').value,
 components:components.map(c=>({type:c.source_type,
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
 const checks=readiness(analysis);
 if(components.some(c=>Number(c.gross_g)<=0||Number(c.net_g)<=0||Number(c.net_g)>Number(c.gross_g))){
  msg('saveInfo','Масса брутто/нетто должна быть больше нуля, нетто не может превышать брутто.');return;
 }
 if(status==='Утверждено'){
  if(!checks.every(c=>c.ok)){msg('saveInfo','Для утверждения заполните: '+checks.filter(c=>!c.ok).map(c=>c.label).join('; '));return}
  if(['rScope','rRaw','rProcess','rServing','rQuality','rApproved'].some(k=>!el(k).value.trim())){msg('saveInfo','Для утверждения заполните обязательные разделы и утверждающего');return}
  if(analysis.error.length||analysis.unverified.length&&!el('ultraReviewed').checked){msg('saveInfo','Для утверждения проверьте источники и подтвердите проверку аллергенов галочкой в блоке «Аллергены и КБЖУ».');return}
  if(!el('rApprovedDate').value){msg('saveInfo','Укажите дату утверждения ТТК.');return}
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
   ttk_fields:{...(editing?.ttk_fields||{}),loss_g:U.loss,ultra:{...(editing?.ttk_fields?.ultra||{}),pf_storage:getPfSafety(),icon_emoji:U.icon||null,auto_allergens:el('ultraAutoAllergens').checked,allergens_reviewed_by_chef:el('ultraReviewed').checked&&status==='Утверждено',reviewed_at:el('ultraReviewed').checked&&status==='Утверждено'?new Date().toISOString():null}}};
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
window.switchPage=function(page){
 if(page==='product'||page==='editor'&&currentKind!=='prefab')restoreProductEditor();
 if(page==='prefab'){
   old.nav(page);showStudio();mode(page);
   const selected=editing&&editing.kind==='prefab'?editing:null;
   const first=selected||pfList()[0];
   if(first&&(!editing||Number(editing.id)!==Number(first.id)||editing.kind!=='prefab'||el('ultraItemLabel').textContent==='Новый полуфабрикат')){
     openRecipe(Number(first.id));
   }else if(!first)newRecipe();
   else{renderList();calc()}
   return;
 }
 old.nav(page);
 if(page==='editor'&&currentKind==='prefab'){showStudio();renderList()}
 else if(page!=='editor')el('app').querySelector('.main').classList.remove('ultraWorkspaceActive');
 mode(page);
};
window.renderRecipes=renderList;window.newRecipe=fresh;window.openRecipe=open;
window.renderComponents=componentsHtml;window.addComponent=add;window.saveRecipe=save;
setup();el('rName').addEventListener('input',()=>{calc();photoPreview()});
 window.MSPhotosUpdated=()=>{renderList();photoPreview()};
})();
