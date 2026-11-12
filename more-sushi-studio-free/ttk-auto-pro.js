/* FARUKH TTK PRO · category-aware automation.
 * Templates are editable and saved per signed-in owner in RLS-protected ttk_preferences.auto_presets.
 * Ingredient values are only calculated when every source is verified; approval stays manual. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const clean=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/[«»"“”'’]+/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
const fmt=n=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:2});
const PENDING=/требует (?:проверки|подтверждения|расчета|расчёта)|не установлено|уточнить|не подтвержден[аоы]?|по данным сырья/i;
const config=[
 ['cold','🍣','Холодные роллы',[
  'Подготовить рис для суши по утверждённой ТТК полуфабриката; подготовить нори и охлаждённые компоненты начинки.',
  'Равномерно распределить рис по нори, разместить начинку согласно рецептуре блюда.',
  'Сформовать ролл, обеспечить плотность и целостность формы; выполнить предусмотренную рецептурой обвалку.',
  'Нарезать порционно, проверить выход и внешний вид; оформить и передать на выдачу.'
 ],'Нарезка ровная, ролл целый, начинка равномерная.','Нежная, упругая, рис не сухой.','Соответствует рису и начинке, без посторонних привкусов.','Естественный цвет сырья и декора.'],
 ['baked','🔥','Запечённые роллы',[
  'Подготовить рис, нори, начинку и запекаемую шапочку по утверждённым картам полуфабрикатов.',
  'Сформовать ролл по рецептуре, нанести шапочку в установленном количестве.',
  'Провести запекание по утверждённому для данного блюда температурно-временному режиму; проверить готовность.',
  'Оформить предусмотренными соусами и декором, проконтролировать массу порции и передать на выдачу.'
 ],'Сформованный ролл, шапочка равномерно запечена, без подгорания.','Рис мягкий; запечённая поверхность однородная.','Характерный вкус компонентов и запечённого соуса.','Естественная окраска, поверхность без обугливания.'],
 ['tempura','🍤','Темпура',[
  'Подготовить рис, нори и начинку; обеспечить готовность компонентов, требующих предварительной термообработки.',
  'Сформовать изделие; подготовить кляр и панировку по утверждённым технологическим картам.',
  'Провести обжаривание во фритюре по утверждённому режиму; проверить готовность и качество масла.',
  'Удалить избыток масла, нарезать или порционировать, оформить и передать на выдачу.'
 ],'Панировка равномерная, без подгоревших участков.','Корочка хрустящая, начинка сохранена.','Характерный для компонентов и кляра, без вкуса старого масла.','Равномерный золотистый тон.'],
 ['maki','🍙','Маки',[
  'Подготовить рис и начинку согласно утверждённым картам полуфабрикатов.',
  'Разместить нори на циновке; равномерно распределить рис тонким слоем.',
  'Уложить предусмотренную начинку, свернуть компактный маки без пустот.',
  'Порционно нарезать, проверить форму, массу и внешний вид; оформить.'
 ],'Компактные одинаковые срезы, нори без разрывов.','Плотная форма, рис мягкий.','Характерный свежий вкус начинки и риса.','Соответствует ингредиентам.'],
 ['nigiri','🍣','Суши / нигири',[
  'Подготовить рис для суши и начинку согласно утверждённой рецептуре.',
  'Проверить подготовку и безопасность рыбы, морепродуктов или иной начинки.',
  'Сформовать рисовую основу заданной массы, уложить начинку с соблюдением рецептуры.',
  'Оценить целостность, выход, оформление и передать на выдачу.'
 ],'Рисовая основа ровная, начинка аккуратно уложена.','Форма держится, рис не спрессован чрезмерно.','Характерный для начинки без постороннего запаха.','Естественный цвет сырья.'],
 ['gunkan','🌶️','Гунканы',[
  'Подготовить рис, нори и начинку по утверждённым ТТК полуфабрикатов.',
  'Сформовать рисовую основу требуемой массы.',
  'Обернуть нори, сформировать бортик, заполнить начинкой по рецептуре.',
  'Оформить; для запечённого варианта выполнить утверждённый режим запекания и проверить готовность.'
 ],'Ровный бортик нори, начинка внутри без подтёков.','Основа сохраняет форму, начинка однородная.','Соответствует заявленному наполнителю и соусам.','Соответствует сырью и декору.'],
 ['onigiri','🍙','Онигири',[
  'Приготовить и подготовить рис по утверждённой карте; подготовить начинку.',
  'Отвесить компоненты согласно рецептуре.',
  'Сформовать онигири установленной формы, равномерно разместив начинку внутри.',
  'Добавить нори или декор по рецептуре; проверить массу, целостность и упаковку.'
 ],'Целая ровная форма, начинка не выступает наружу.','Рис удерживает форму, без пересушивания.','Соответствует рису и начинке.','Естественный цвет компонентов.'],
 ['wok','🍜','Воки',[
  'Подготовить лапшу или рис, овощи, белковый компонент и соус по утверждённым картам.',
  'Провести предварительную подготовку сырья и обязательную термообработку компонентов по рецептуре.',
  'Последовательно обжарить компоненты в воке по утверждённому режиму; добавить соус и равномерно распределить.',
  'Проверить готовность, выход и однородность блюда; порционировать и оформить.'
 ],'Компоненты равномерно распределены, без подгорания.','Лапша/рис и овощи имеют свойственную блюду консистенцию.','Выраженный вкус соуса и ингредиентов, без горечи.','Характерный цвет соуса и ингредиентов.'],
 ['beridog','🌭','Бери-доги',[
  'Подготовить рисовую или иную основу и начинку в соответствии с рецептурой.',
  'Подготовить соусы и компоненты отделки по картам полуфабрикатов.',
  'Сформовать изделие установленной формы; провести термообработку, если она предусмотрена ТТК.',
  'Оформить, проверить выход, качество поверхности и упаковку.'
 ],'Изделие ровной формы, соус и декор распределены аккуратно.','Основа сохраняет форму, начинка не вытекает.','Соответствует рецептуре без посторонних оттенков.','Характерный цвет ингредиентов.'],
 ['sauce','🥣','Соусы',[
  'Проверить компоненты и подготовить тару, инвентарь и мерное оборудование.',
  'Взвесить ингредиенты по рецептуре, соблюдая установленную последовательность внесения.',
  'Смешать или обработать по утверждённому процессу до заданной консистенции.',
  'Проверить однородность, выход, маркировку и условия хранения готового соуса.'
 ],'Однородная масса, без посторонних включений.','Соответствует рецептуре: густая, кремовая или текучая.','Характерный вкус без посторонних оттенков.','Равномерный характерный цвет.'],
 ['snack','🍤','Закуски',[
  'Подготовить компоненты закуски и инвентарь, проверить сырьё.',
  'Выполнить нарезку, панировку, формование или смешивание согласно рецептуре.',
  'Провести предусмотренную тепловую обработку с контролем готовности и утверждённых параметров.',
  'Порционировать, оформить и проверить выход блюда.'
 ],'Аккуратное оформление, без признаков порчи и подгорания.','Соответствует способу приготовления.','Характерный для блюда, без посторонних оттенков.','Соответствует ингредиентам и способу обработки.'],
 ['salad','🥗','Салаты',[
  'Подготовить сырьё в соответствии с утверждёнными картами полуфабрикатов.',
  'Нарезать или порционировать компоненты согласно рецептуре.',
  'Соединить компоненты и заправку в установленной последовательности.',
  'Порционировать, оформить, проверить массу и внешний вид.'
 ],'Ингредиенты аккуратно нарезаны и распределены.','Соответствует овощам и компонентам салата.','Свежий, характерный для состава и заправки.','Естественный цвет ингредиентов.'],
 ['dessert','🍰','Десерты',[
  'Подготовить сырьё и инвентарь с учётом требований к кондитерской продукции.',
  'Взвесить ингредиенты и выполнить смешивание или формование согласно рецептуре.',
  'Провести необходимую тепловую обработку, охлаждение или стабилизацию по утверждённым режимам.',
  'Порционировать, оформить, проверить внешний вид, выход и маркировку.'
 ],'Аккуратная форма, декор соответствует изделию.','Соответствует рецептуре, без расслоения при необходимости.','Свойственный десерту, без посторонних оттенков.','Характерный для компонентов.'],
 ['drinks','🥤','Морсы и напитки',[
  'Подготовить питьевую воду, сиропы, соки и другие компоненты по утверждённым спецификациям.',
  'Отмерить компоненты согласно рецептуре.',
  'Смешать до однородности; при необходимости провести предусмотренную фильтрацию или охлаждение.',
  'Проверить объём, вкус, прозрачность или однородность и разлить в маркированную тару.'
 ],'Однородный напиток, без посторонних включений.','Жидкая, характерная для напитка.','Сбалансированный вкус согласно рецептуре.','Характерный цвет напитка.'],
 ['prefab','📦','Полуфабрикаты',[
  'Проверить качество сырья, подготовить оборудование и маркированную тару.',
  'Взвесить компоненты по утверждённой рецептуре.',
  'Выполнить установленную технологическую обработку с контролем критических параметров.',
  'Проверить выход, условия охлаждения при необходимости, маркировку и передачу на хранение.'
 ],'Соответствует конкретному виду полуфабриката.','Соответствует технологическим требованиям рецептуры.','Без посторонних запахов и привкусов.','Характерный для исходного сырья и обработки.'],
 ['sets','🍱','Сеты и наборы',[
  'Подготовить все изделия набора по соответствующим утверждённым ТТК.',
  'Проверить состав, количество и внешний вид каждого изделия.',
  'Комплектовать набор в соответствии с утверждённой спецификацией, раздельно разместить соусы.',
  'Проверить общую массу, маркировку, упаковку и комплектность заказа.'
 ],'Изделия уложены аккуратно, комплектность соответствует меню.','Соответствует каждому изделию.','Соответствует входящим в набор изделиям.','Соответствует ассортименту набора.'],
 ['other','🍽️','Другие блюда',[
  'Проверить качество сырья и подготовить ингредиенты согласно рецептуре.',
  'Взвесить и обработать компоненты в установленной последовательности.',
  'Выполнить необходимое формование и/или тепловую обработку по утверждённому режиму.',
  'Проконтролировать готовность, выход, оформление и передачу на реализацию.'
 ],'Соответствует утверждённому образцу блюда.','Свойственная данному блюду.','Характерный для рецептуры, без посторонних оттенков.','Соответствует ингредиентам.']
];
const categories=Object.fromEntries(config.map(x=>[x[0],{key:x[0],emoji:x[1],name:x[2],steps:x[3],appearance:x[4],consistency:x[5],taste:x[6],color:x[7]}]));
const FIELDS=['scope','raw','process','serving','storage','quality'];
const IDS={scope:'fScope',raw:'fRaw',process:'fProcess',serving:'fServing',storage:'fStorage',quality:'fQuality',allergens:'fAllergens',nutrition:'fNutrition'};
const META=[['scope','Область применения'],['raw','Требования к сырью'],['process','Технологический процесс'],['serving','Подача и реализация'],['storage','Хранение'],['quality','Качество']];
let bridge=null,initialised=false,opened=false,active='cold',catalog=null,fetching=false,calculating=false;
let lastReport={matched:0,total:0,missing:[],nutrition:false,allergens:false};
function d(){return bridge?.getDraft?.()||null}
function currentPreferences(){return bridge?.getPreferences?.()||{}}
function personal(){return currentPreferences().auto_presets||{}}
function base(cat){
 const x=categories[cat]||categories.other;
 const dish='{название}';
 return {
  scope:'Настоящая ТТК устанавливает требования к приготовлению и реализации блюда «'+dish+'» (категория «'+x.name+'») в предприятии, указанном в документе.',
  raw:'Использовать сырьё с подтверждённым качеством, прослеживаемостью, действующими документами и соблюдением условий хранения. Подготовку ингредиентов и ПФ проводить по утверждённым технологическим картам. Не допускать перекрёстного загрязнения.',
  process:x.steps.join('\n'),
  serving:'Оформление: '+(cat==='drinks'?'Разлить в соответствующую чистую тару.':cat==='sets'?'Укомплектовать набор по спецификации.':'Оформить блюдо по утверждённому фото и составу.')+'\nРеализация: Проверить комплектность, массу и внешний вид при передаче гостю.\nТранспортирование: Использовать соответствующую упаковку и соблюдать подтверждённые условия транспортирования.',
  storage:'ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ: установить условия и срок хранения категории «'+x.name+'» после технологической проработки и проверки требований.',
  quality:'Внешний вид: '+x.appearance+'\nКонсистенция: '+x.consistency+'\nВкус и запах: '+x.taste+'\nЦвет: '+x.color+'\nБезопасность: отсутствие признаков порчи и посторонних включений, соблюдение утверждённых параметров обработки.'
 };
}
function preset(key){return {...base(key),...(personal()[key]||{})}}
function getCategoryId(raw){
 const s=clean(raw);
 const exact=Object.values(categories).find(c=>clean(c.name)===s);
 if(exact)return exact.key;
 if(/запеч|запек|горяч.*ролл/.test(s))return 'baked';
 if(/темпур|фритюр/.test(s))return 'tempura';
 if(/холод|ролл/.test(s))return 'cold';
 if(/маки|хосомак/.test(s))return 'maki';
 if(/гункан/.test(s))return 'gunkan';
 if(/суши|нигири/.test(s))return 'nigiri';
 if(/онигир/.test(s))return 'onigiri';
 if(/вок|wok|лапша/.test(s))return 'wok';
 if(/бери дог|беридог/.test(s))return 'beridog';
 if(/соус|заправк/.test(s))return 'sauce';
 if(/закуск/.test(s))return 'snack';
 if(/салат/.test(s))return 'salad';
 if(/десерт|торт|пирожн/.test(s))return 'dessert';
 if(/морс|напит|лимонад/.test(s))return 'drinks';
 if(/полуфаб|пф/.test(s))return 'prefab';
 if(/сет|набор|ассорти/.test(s))return 'sets';
 return 'other';
}
function substitute(text,doc,cat){
 return String(text||'').replace(/\{название\}/gi,doc.title?.trim()||'Блюдо').replace(/\{категория\}/gi,categories[cat]?.name||'Блюда').replace(/\{проект\}/gi,bridge?.projectName?.(doc.project_id)||'предприятие');
}
function linesText(v,max){
 const arr=String(v||'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
 if(arr.length>max){arr[max-1]=arr.slice(max-1).join(' ');arr.length=max}
 return arr;
}
function writeParts(fields,key,value){
 const parts=fields.archive_parts||(fields.archive_parts={});
 const map={process:['step1','step2','step3','step4'],serving:['serving_design','serving_sale','serving_transport'],quality:['quality_appearance','quality_consistency','quality_taste','quality_color','quality_safety']};
 const keys=map[key];if(!keys)return;
 const arr=linesText(value,keys.length);
 keys.forEach((item,i)=>parts[item]=String(arr[i]||'').replace(/^(?:Оформление|Реализация|Транспортирование|Внешний вид|Консистенция|Вкус и запах|Цвет|Безопасность):\s*/i,''));
}
function fillFields(target,key,{replace=false}={}){
 const fields=target.fields||(target.fields={}),tmpl=preset(key);
 const changed=[];
 for(const prop of FIELDS){
  if(!replace&&String(fields[prop]||'').trim()&&!PENDING.test(fields[prop]))continue;
  const text=substitute(tmpl[prop],target,key).slice(0,2200);
  if(String(fields[prop]||'')===text)continue;
  fields[prop]=text;writeParts(fields,prop,text);changed.push(prop);
 }
 for(const prop of ['allergens','nutrition']){
  if(replace||!String(fields[prop]||'').trim()){
   fields[prop]=prop==='allergens'?'ТРЕБУЕТ ПРОВЕРКИ: заполните по подтверждённым карточкам сырья.':'ТРЕБУЕТ РАСЧЁТА: нет полного набора подтверждённых данных КБЖУ по сырью.';
   if(prop==='nutrition'&&fields.archive_parts){['protein','fat','carbs','kcal'].forEach(k=>delete fields.archive_parts[k])}
   changed.push(prop);
  }
 }
 if(!fields.developed&&currentPreferences().chef_name)fields.developed=currentPreferences().chef_name;
 if(changed.length){fields.verified='no';target.status=target.status==='Утверждено'?'На проверке':target.status}
 target.category=categories[key].name;
 fields.auto_meta={...(fields.auto_meta||{}),category:key,last_applied:new Date().toISOString(),source:'category_preset',needs_review:true};
 return changed;
}
function setNotice(message,warning=false){
 const el=$('autoNotice');if(!el)return;
 el.textContent=message;el.classList.toggle('auto-warning',!!warning);
}
function refreshCategory(){
 const selector=$('autoCategory');if(!selector)return;
 const key=active;
 selector.value=key;
 $('autoCategoryName').textContent=categories[key].emoji+' '+categories[key].name;
 const stored=!!personal()[key];
 $('autoPresetBadge').textContent=stored?'✓ Ваш облачный шаблон':'Базовый технологический шаблон';
 for(const prop of FIELDS){const el=$('autoField'+prop[0].toUpperCase()+prop.slice(1));if(el)el.value=preset(key)[prop]||''}
 const project=$('autoBatchProject');
 if(project){
  const prior=project.value;
  const items=bridge?.getProjects?.()||[];
  project.innerHTML=items.filter(x=>!x.is_archived).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');
  project.value=items.some(x=>x.id===prior&&!x.is_archived)?prior:(d()?.project_id||'');
 }
}
function openedPanel(open){
 if(!d()&&open){alert('Сначала откройте или создайте ТТК.');return}
 opened=!!open;
 $('ttkAutoOverlay').hidden=!opened;$('ttkAutoDrawer').hidden=!opened;
 $('ttkAutoOpen').setAttribute('aria-expanded',String(opened));
 document.body.classList.toggle('ttk-auto-open',opened);
 if(opened){
  active=getCategoryId(d()?.category);
  refreshCategory();setNotice('Выберите категорию и нажмите «Заполнить ТТК». Существующий текст по умолчанию сохраняется.');
  $('autoClose').focus({preventScroll:true});loadCatalog();
 }
}
function sync(){
 if(bridge?.sync)bridge.sync();
}
function refresh(){
 if(bridge?.hydrate)bridge.hydrate();
}
function applyNow(){
 if(!d())return;
 sync();
 const key=active,doc=d();
 const replace=$('autoOverwrite').checked;
 if(replace&&!confirm('Заменить ранее заполненные технологические разделы на шаблон категории «'+categories[key].name+'»? Рецептура и фото останутся без изменений.'))return;
 const changed=fillFields(doc,key,{replace});
 $('eCategory').value=doc.category;
 $('eStatus').value=doc.status||'Черновик';
 bridge?.markDirty?.();refresh();
 setNotice(changed.length?'✓ Заполнены разделы: '+changed.map(k=>(META.find(x=>x[0]===k)||[k,k])[1]).join(', ')+'. Срок хранения, аллергены, КБЖУ и режимы необходимо подтвердить.':'✓ Существующие данные сохранены, пустых разделов не обнаружено.');
}
async function savePreset(){
 const preferences=currentPreferences();
 const data={};
 for(const prop of FIELDS){
  const field=$('autoField'+prop[0].toUpperCase()+prop.slice(1));
  if(field)data[prop]=String(field.value||'').trim().slice(0,2200);
 }
 if(!data.process.trim()||!data.raw.trim()||!data.scope.trim()){setNotice('Заполните область применения, требования к сырью и технологический процесс.',true);return}
 const user=bridge?.getSession?.()?.user?.id;
 if(!user){setNotice('Необходимо войти в аккаунт.',true);return}
 $('autoSavePreset').disabled=true;
 try{
  const vals={...(preferences.auto_presets||{}),[active]:data};
  const body={owner_id:user,studio_name:preferences.studio_name||'FARUKH TTK PRO',title:preferences.title||'Студия ТТК',chef_name:preferences.chef_name||'',auto_presets:vals,updated_at:new Date().toISOString()};
  const rows=await bridge.api('/rest/v1/ttk_preferences?on_conflict=owner_id&select=*',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body});
  if(!rows?.[0])throw Error('Сервер не подтвердил сохранение');
  bridge.setPreferences(rows[0]);
  refreshCategory();
  setNotice('✓ Ваш шаблон категории «'+categories[active].name+'» сохранён в облаке. Будет доступен на другом устройстве.');
 }catch(e){setNotice('Ошибка сохранения: '+(e.message||e),true)}
 finally{$('autoSavePreset').disabled=false}
}
async function resetPreset(){
 if(!personal()[active]){setNotice('Используется исходный шаблон — сбрасывать нечего.');return}
 if(!confirm('Удалить ваши изменения шаблона «'+categories[active].name+'»? Базовый шаблон останется.'))return;
 const prefs=currentPreferences(),uid=bridge?.getSession?.()?.user?.id,copy={...personal()};
 delete copy[active];
 try{
  const rows=await bridge.api('/rest/v1/ttk_preferences?on_conflict=owner_id&select=*',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:{owner_id:uid,studio_name:prefs.studio_name||'FARUKH TTK PRO',title:prefs.title||'Студия ТТК',chef_name:prefs.chef_name||'',auto_presets:copy,updated_at:new Date().toISOString()}});
  if(!rows?.[0])throw Error('Сервер не подтвердил изменение');
  bridge.setPreferences(rows[0]);refreshCategory();setNotice('✓ Восстановлен базовый шаблон.');
 }catch(e){setNotice('Ошибка: '+(e.message||e),true)}
}
async function loadCatalog(force=false){
 if(fetching||(!force&&catalog))return;
 fetching=true;$('autoCatalogBadge').textContent='⏳ Загрузка базы сырья…';
 try{
  const [ingredients,recipes,recipe_lines]=await Promise.all([
   bridge.api('/rest/v1/ingredients?select=id,name,allergens,allergen_status,nutrition_100g,nutrition_review_status,nutrition_reference&order=name.asc&limit=2000'),
   bridge.api('/rest/v1/recipes?select=id,name,kind,yield_g&limit=2000'),
   bridge.api('/rest/v1/recipe_lines?select=recipe_id,ingredient_id,prefab_id,net_g,line_yield_g&limit=4000')
  ]);
  catalog={ingredients:ingredients||[],recipes:recipes||[],recipe_lines:recipe_lines||[]};
  const verified=(ingredients||[]).filter(i=>i.nutrition_review_status==='verified').length;
  $('autoCatalogBadge').textContent='📚 Сырьё: '+catalog.ingredients.length+' · подтверждённое КБЖУ: '+verified;
 }catch(e){catalog=null;$('autoCatalogBadge').textContent='⚠ База сырья недоступна';setNotice('Не удалось загрузить базу ингредиентов: '+(e.message||e),true)}
 finally{fetching=false}
}
function matcher(){
 const iByName=new Map(),rByName=new Map();
 for(const i of catalog.ingredients){const k=clean(i.name);if(!k)continue;if(iByName.has(k))iByName.set(k,null);else iByName.set(k,i)}
 for(const r of catalog.recipes.filter(r=>r.kind==='prefab')){const k=clean(r.name);if(!k)continue;if(rByName.has(k))rByName.set(k,null);else rByName.set(k,r)}
 const iById=new Map(catalog.ingredients.map(i=>[Number(i.id),i]));
 const rById=new Map(catalog.recipes.map(i=>[Number(i.id),i]));
 const linesByRecipe=new Map();
 for(const l of catalog.recipe_lines){const k=Number(l.recipe_id);if(!linesByRecipe.has(k))linesByRecipe.set(k,[]);linesByRecipe.get(k).push(l)}
 return {iByName,rByName,iById,rById,linesByRecipe};
}
function normalizedMacros(info){
 if(info.nutrition_review_status!=='verified'||!info.nutrition_reference?.trim())return null;
 const data=info.nutrition_100g||{},out={};
 for(const k of ['protein','fat','carbs','kcal']){
  const val=Number(data[k]);
  if(data[k]==null||data[k]===''||!Number.isFinite(val)||val<0||val>950)return null;
  out[k]=val;
 }
 return out;
}
function calc(doc){
 const m=matcher(),summary={matched:0,total:0,missing:[],nutrition:true,allergens:true,values:{protein:0,fat:0,carbs:0,kcal:0},found:new Set()};
 function addIngredient(info,grams){
  if(!info||!Number.isFinite(Number(grams))||Number(grams)<0){
   summary.missing.push(info?.name||'Неизвестный ингредиент');summary.nutrition=false;summary.allergens=false;return;
  }
  const nutrition=normalizedMacros(info);
  if(!nutrition){summary.nutrition=false;summary.missing.push(info.name+' — КБЖУ не подтверждено')}
  else for(const k of Object.keys(summary.values))summary.values[k]+=nutrition[k]*Number(grams)/100;
  if(info.allergen_status!=='verified'){
   summary.allergens=false;summary.missing.push(info.name+' — аллергены не подтверждены');
  }else if(String(info.allergens||'').trim()){
   String(info.allergens).split(/[,;\n]/).map(x=>x.trim()).filter(Boolean).forEach(x=>summary.found.add(x));
  }
 }
 function walk(item,grams,seen=new Set()){
  const key=clean(item.name||'');
  const ingredient=m.iByName.get(key);
  if(ingredient){summary.matched++;addIngredient(ingredient,grams);return}
  const prefab=m.rByName.get(key);
  if(!prefab){summary.missing.push(item.name+' — нет точного совпадения с сырьём/ПФ');summary.nutrition=false;summary.allergens=false;return}
  const id=Number(prefab.id),yieldG=Number(prefab.yield_g);
  if(seen.has(id)||!(yieldG>0)){
   summary.missing.push(prefab.name+' — нет выхода ПФ или циклическая рецептура');summary.nutrition=false;summary.allergens=false;return;
  }
  const components=m.linesByRecipe.get(id)||[];
  if(!components.length){summary.missing.push(prefab.name+' — отсутствует состав ПФ');summary.nutrition=false;summary.allergens=false;return}
  summary.matched++;const next=new Set(seen);next.add(id);
  for(const l of components){
   const gramsPart=Number(l.net_g);
   if(!Number.isFinite(gramsPart)||gramsPart<0){
    summary.missing.push(prefab.name+' — не задана масса компонента');summary.nutrition=false;summary.allergens=false;continue;
   }
   const scaled=Number(grams)*gramsPart/yieldG;
   if(l.ingredient_id){
    const ing=m.iById.get(Number(l.ingredient_id));addIngredient(ing,scaled);
   }else if(l.prefab_id){
    const sub=m.rById.get(Number(l.prefab_id));
    if(sub)walk(sub,scaled,next);
    else {summary.missing.push(prefab.name+' — вложенный ПФ не найден');summary.nutrition=false;summary.allergens=false}
   }else {summary.missing.push(prefab.name+' — компонент без связи с сырьём');summary.nutrition=false;summary.allergens=false}
  }
 }
 const lines=(doc.lines||[]).filter(l=>String(l.name||'').trim());
 summary.total=lines.length;
 if(!summary.total){summary.nutrition=false;summary.allergens=false;summary.missing.push('Добавьте ингредиенты с граммовками')}
 for(const l of lines){
  const grams=Number(l.net_g);
  if(l.net_g==null||!Number.isFinite(grams)||grams<0){
   summary.nutrition=false;summary.allergens=false;summary.missing.push(l.name+' — нетто не указано');continue;
  }
  walk(l,grams);
 }
 if(!(Number(doc.yield_g)>0)){summary.nutrition=false;summary.missing.push('Выход готового блюда не установлен')}
 return summary;
}
function nutritionText(r,yieldG){
 return 'Белки: '+fmt(r.values.protein*100/yieldG)+' г; Жиры: '+fmt(r.values.fat*100/yieldG)+' г; Углеводы: '+fmt(r.values.carbs*100/yieldG)+' г; Энергия: '+fmt(r.values.kcal*100/yieldG)+' ккал на 100 г (расчёт по нетто сырья, без учёта изменений при обработке).';
}
async function recalculate(){
 if(!d()||calculating)return;
 sync();if(!catalog)await loadCatalog();
 if(!catalog){setNotice('База сырья недоступна. Для КБЖУ и аллергенов нужен каталог ингредиентов.',true);return}
 calculating=true;
 try{
  const doc=d(),r=calc(doc);lastReport=r;
  const fields=doc.fields||(doc.fields={});
  const previous={nutrition:fields.nutrition,allergens:fields.allergens};
  // Never overwrite manually confirmed fields; explicit reassessment requires confirmation.
  if(fields.verified==='yes'&&(!PENDING.test(fields.nutrition||'')||!PENDING.test(fields.allergens||''))){
   if(!confirm('Поля были подтверждены ответственным. Заменить их новым расчётом и снова отправить на ручную проверку?'))return;
  }
  if(r.nutrition){
   fields.nutrition=nutritionText(r,doc.yield_g);
   const parts=fields.archive_parts||(fields.archive_parts={});
   const y=Number(doc.yield_g);
   for(const k of ['protein','fat','carbs','kcal'])parts[k]=fmt(r.values[k]*100/y);
  }else{
   fields.nutrition='ТРЕБУЕТ РАСЧЁТА: нет полного комплекта проверенных КБЖУ и подтверждённого выхода.';
   const parts=fields.archive_parts||(fields.archive_parts={});
   ['protein','fat','carbs','kcal'].forEach(k=>delete parts[k]);
  }
  fields.allergens=r.allergens?(r.found.size?[...r.found].join(', '):'Аллергены не заявлены в проверенных карточках сырья'):
   'ТРЕБУЕТ ПРОВЕРКИ: '+(r.found.size?'по проверенным позициям — '+[...r.found].join(', ')+'; ':'')+'есть неподтверждённые компоненты.';
  fields.verified='no';doc.status=doc.status==='Утверждено'?'На проверке':doc.status;
  fields.auto_meta={...(fields.auto_meta||{}),nutrition_calculated:r.nutrition,allergens_verified:r.allergens,calculated_at:new Date().toISOString(),needs_review:true};
  bridge?.markDirty?.();refresh();
  const unique=[...new Set(r.missing)];
  $('autoCalcResult').innerHTML='<strong>'+((r.nutrition&&r.allergens)?'✅ Расчёт готов к проверке':'⚠ Требуются данные')+'</strong><br>'+
   esc('Точных совпадений: '+r.matched+' / '+r.total+'. КБЖУ: '+(r.nutrition?'рассчитано':'неполно')+'. Аллергены: '+(r.allergens?'проверены по базе':'неполно'))+
   (unique.length?'<ul>'+unique.slice(0,15).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'');
  setNotice('Пересчёт завершён. Данные внесены в ТТК, автоматического утверждения нет.'+(previous.nutrition||previous.allergens?' Ранее заполненные поля заменены.':''));
 }finally{calculating=false}
}
async function batchFill(){
 const projectId=$('autoBatchProject')?.value;
 if(!projectId)return setNotice('Выберите проект.',true);
 const selected=(bridge?.getDocs?.()||[]).filter(x=>x.project_id===projectId&&x.status!=='Утверждено'&&x.status!=='Архив'&&getCategoryId(x.category)===active);
 if(!selected.length){setNotice('В выбранном проекте нет подходящих черновиков категории «'+categories[active].name+'».');return}
 const replace=$('autoBatchOverwrite').checked;
 if(!confirm('Применить шаблон «'+categories[active].name+'» к '+selected.length+' документам проекта?\n'+(replace?'Будут заменены имеющиеся стандартные поля.':'Будут заполнены только пустые/неподтверждённые поля.')+'\nУтверждённые ТТК не изменяются.'))return;
 if(d()?.project_id===projectId&&selected.some(x=>x.id===d().id)&&bridge?.isDirty?.()){
  setNotice('Сначала сохраните открытую ТТК. Массовое обновление не должно перезаписать несохранённые изменения.',true);return;
 }
 $('autoBatchApply').disabled=true;
 let done=0,skipped=0,errors=[];
 for(const original of selected){
  const item=JSON.parse(JSON.stringify(original));
  const changed=fillFields(item,active,{replace});
  if(!changed.length){skipped++;continue}
  const version=Number(original.version)||1;
  try{
   const rows=await bridge.api('/rest/v1/ttk_documents?id=eq.'+encodeURIComponent(item.id)+'&version=eq.'+version+'&select=id,version',{
    method:'PATCH',headers:{Prefer:'return=representation'},
    body:{fields:item.fields,category:item.category,status:item.status,version:version+1,updated_at:new Date().toISOString()}
   });
   if(rows?.[0])done++;else errors.push(item.title+': документ изменился в другом окне');
  }catch(e){errors.push(item.title+': '+(e.message||e))}
 }
 await bridge?.reload?.();
 setNotice('✓ Обновлено: '+done+'; без изменений: '+skipped+'; ошибок: '+errors.length+'. '+errors.slice(0,3).join(' | '),errors.length>0);
 $('autoBatchApply').disabled=false;
}
function setup(){
 if(initialised)return;
 const head=document.querySelector('#viewEditor .editor-head .row');
 if(!head)return;
 initialised=true;
 const open=document.createElement('button');open.type='button';open.id='ttkAutoOpen';open.className='btn btn-primary ttk-auto-open';open.textContent='✨ AUTO ТТК';open.setAttribute('aria-expanded','false');head.prepend(open);
 const overlay=document.createElement('div');overlay.id='ttkAutoOverlay';overlay.className='ttk-auto-overlay';overlay.hidden=true;
 const drawer=document.createElement('aside');drawer.id='ttkAutoDrawer';drawer.className='ttk-auto-drawer';drawer.hidden=true;
 drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-labelledby','autoHead');
 const rows=META.map(([key,name])=>'<label>'+esc(name)+'<textarea id="autoField'+key[0].toUpperCase()+key.slice(1)+'" data-ttk-template-field="'+key+'" rows="'+(key==='process'||key==='quality'?6:3)+'"></textarea></label>').join('');
 drawer.innerHTML=[
  '<header class="ttk-auto-head"><div><small>FARUKH TTK PRO · INTELLIGENT WORKFLOW</small><h2 id="autoHead">✨ Автоматическое заполнение ТТК</h2><p>Категория → технология → контроль данных → один лист А4</p></div><button id="autoClose" aria-label="Закрыть" type="button">×</button></header>',
  '<div class="ttk-auto-scroll">',
  '<div class="ttk-auto-banner"><b id="autoCategoryName"></b><span id="autoPresetBadge"></span></div>',
  '<label class="ttk-auto-label">Выберите категорию<select id="autoCategory" class="ttk-auto-select">'+config.map(x=>'<option value="'+x[0]+'">'+x[1]+' '+esc(x[2])+'</option>').join('')+'</select></label>',
  '<label class="ttk-auto-check"><input type="checkbox" id="autoOverwrite"> Заменять уже заполненные технологические разделы</label>',
  '<button id="autoFill" type="button" class="ttk-auto-primary">✨ Заполнить ТТК по категории</button>',
  '<p class="ttk-auto-small">Заполняются область применения, требования к сырью, технологические шаги, оформление, хранение и контроль качества. Поля, требующие фактического подтверждения, отмечаются.</p>',
  '<div class="ttk-auto-divider"></div>',
  '<h3>📚 Ингредиенты → КБЖУ и аллергены</h3><p id="autoCatalogBadge" class="ttk-auto-small">База ингредиентов загружается при открытии.</p>',
  '<button id="autoCalc" type="button" class="ttk-auto-secondary">↻ Рассчитать по проверенным данным сырья</button>',
  '<button id="autoReloadCatalog" type="button" class="ttk-auto-textbtn">Обновить базу ингредиентов</button>',
  '<div id="autoCalcResult" class="ttk-auto-calc-result">Аллергены и КБЖУ не заполняются выдуманными значениями. Нужны подтверждённые карточки сырья и точные граммовки.</div>',
  '<div class="ttk-auto-divider"></div>',
  '<details id="autoPresetDetails" class="ttk-auto-details"><summary>✎ Редактировать эталонные тексты категории</summary><p>Сохраните шаблон один раз — он будет применяться к будущим картам этого типа на всех ваших устройствах. Можно использовать {название}, {категория} и {проект}.</p>',
  '<div class="ttk-auto-fields">'+rows+'</div><div class="ttk-auto-actions"><button id="autoSavePreset" type="button">☁ Сохранить шаблон категории</button><button id="autoResetPreset" type="button">Вернуть стандарт</button></div></details>',
  '<details id="autoBatchDetails" class="ttk-auto-details"><summary>▦ Заполнить несколько ТТК проекта</summary><p>Обновляются только черновики и документы на проверке выбранной категории. Утверждённые и архивные не затрагиваются.</p>',
  '<label class="ttk-auto-label">Проект<select class="ttk-auto-select" id="autoBatchProject"></select></label>',
  '<label class="ttk-auto-check"><input type="checkbox" id="autoBatchOverwrite"> Заменить существующий текст в выбранных документах</label>',
  '<button id="autoBatchApply" type="button" class="ttk-auto-secondary">Применить ко всем подходящим черновикам</button></details>',
  '<div id="autoNotice" class="ttk-auto-notice" role="status">Выберите категорию и заполните ТТК.</div>',
  '<p class="ttk-auto-footnote">Автоматические шаблоны не устанавливают срок годности, технологический режим и факт безопасности за шеф-повара. Статус «Утверждено» требует независимой проверки ответственным.</p>',
  '</div>'
 ].join('');
 document.body.append(overlay,drawer);
 const css=document.createElement('link');css.rel='stylesheet';css.href='./ttk-auto-pro.css?v=20261112-1';document.head.append(css);
 open.addEventListener('click',()=>openedPanel(!opened));
 $('autoClose').addEventListener('click',()=>openedPanel(false));
 overlay.addEventListener('click',()=>openedPanel(false));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened){e.preventDefault();openedPanel(false)}});
 $('autoCategory').addEventListener('change',e=>{active=e.target.value;refreshCategory()});
 $('autoFill').addEventListener('click',applyNow);
 $('autoCalc').addEventListener('click',recalculate);
 $('autoReloadCatalog').addEventListener('click',()=>loadCatalog(true));
 $('autoSavePreset').addEventListener('click',savePreset);
 $('autoResetPreset').addEventListener('click',resetPreset);
 $('autoBatchApply').addEventListener('click',batchFill);
}
window.FARUKH_TTK_AUTO={
 init(x){bridge=x;setup()},
 onReady(){if(initialised&&opened)refreshCategory()},
 onDraft(){if(initialised&&opened){active=getCategoryId(d()?.category);refreshCategory()}},
 getCategoryId,
 isPending(v){return PENDING.test(String(v||''))},
 isUnverified(d){
  const f=d?.fields||{};
  return ['storage','allergens','nutrition'].some(k=>!f[k]||PENDING.test(f[k]));
 },
 fillFields,
 getCategories:()=>categories
};
})();