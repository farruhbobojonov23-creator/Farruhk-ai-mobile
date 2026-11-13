/* SHEF AI PREMIUM — authenticated existing ingredient & recipe catalog. Read-only in phase 1. */
(function(){
'use strict';
const SB='https://mhsmmssipligbmvfzkce.supabase.co';
const KEY='sb_publishable_JKA5HzoGDIkLxBnctT27hw_TBIqnoc0';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=v=>v==null||v===''?'—':Number(v).toLocaleString('ru-RU',{maximumFractionDigits:2});
const tabs={
 ingredients:{view:'viewIngredients',search:'ingredientsSearch',category:'ingredientsCategory',list:'ingredientsCatalog',count:'ingredientsTotal'},
 prefabs:{view:'viewPrefabs',search:'prefabsSearch',category:'prefabsCategory',list:'prefabsCatalog',count:'prefabsTotal'},
 products:{view:'viewProducts',search:'productsSearch',category:'productsCategory',list:'productsCatalog',count:'productsTotal'}
};
let ingredients=null, recipes=null, pending=null;
function token(){
 try {const saved=JSON.parse(localStorage.getItem('ms_session')||'null');return saved?.access_token||null;}
 catch{return null;}
}
async function get(path){
 const access=token();if(!access)throw Error('Авторизуйтесь в ШЕФ AI.');
 const response=await fetch(SB+'/rest/v1/'+path,{
  headers:{apikey:KEY,Authorization:'Bearer '+access,Accept:'application/json'}
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error(data?.message||data?.error||'Ошибка '+response.status);
 return data;
}
async function ensure(){
 if(ingredients&&recipes)return;
 if(pending)return pending;
 pending=Promise.all([
  get('ingredients?select=id,name,category,unit,manufacturer,allergens,allergen_status,storage_conditions,shelf_life_hours,nutrition_100g&order=name.asc&limit=2000'),
  get('recipes?select=id,name,code,kind,category,yield_g,status,process,storage,allergens,nutrition&order=name.asc&limit=2000')
 ]).then(([a,b])=>{ingredients=Array.isArray(a)?a:[];recipes=Array.isArray(b)?b:[]})
 .finally(()=>{pending=null});
 return pending;
}
function dataFor(type){
 if(type==='ingredients')return ingredients||[];
 if(type==='prefabs')return (recipes||[]).filter(r=>r.kind==='prefab');
 return (recipes||[]).filter(r=>r.kind==='product');
}
function categoryOptions(type){
 const conf=tabs[type],select=$(conf.category),value=select.value;
 const categories=[...new Set(dataFor(type).map(x=>x.category||'Прочее'))].sort((a,b)=>a.localeCompare(b,'ru'));
 select.innerHTML='<option value="">Все категории</option>'+categories.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
 if(categories.includes(value))select.value=value;
}
function glyph(category,type){
 const s=String(category||'').toLowerCase();
 if(type==='prefabs')return '🥣';
 if(type==='products')return '🍣';
 if(/рыб|лосос|форел|морепродукт|угор|кревет/.test(s))return '🐟';
 if(/соус|масл|заправ/.test(s))return '🫙';
 if(/сыр|молоч/.test(s))return '🧀';
 if(/овощ|зел|фрукт/.test(s))return '🥬';
 return '◈';
}
function card(x,type){
 const unit=type==='ingredients'?(x.unit||'г'):'г';
 const meta=type==='ingredients'?(x.manufacturer||x.allergens||'Данные ингредиента'):(x.code||x.status||'Рецептура');
 const amount=type==='ingredients'?'Сырьё':('Выход: '+fmt(x.yield_g)+' '+unit);
 const status=type==='ingredients'?'Ингредиент':(x.status||'Рецептура');
 return '<button type="button" class="catalog-item" data-catalog-kind="'+type+'" data-catalog-id="'+Number(x.id)+'">'+
  '<span class="catalog-glyph" aria-hidden="true">'+glyph(x.category,type)+'</span>'+
  '<span class="catalog-text"><strong>'+esc(x.name)+'</strong><small>'+esc(x.category||'Прочее')+' · '+esc(meta)+'</small>'+
  '<span class="catalog-meta">'+esc(amount)+'</span></span>'+
  '<span class="catalog-tail"><span class="pill">'+esc(status)+'</span><span aria-hidden="true">↗</span></span></button>';
}
function render(type){
 const conf=tabs[type];if(!$(conf.list))return;
 const all=dataFor(type);
 const q=$(conf.search).value.trim().toLocaleLowerCase('ru'),category=$(conf.category).value;
 const rows=all.filter(x=>(!category||(x.category||'Прочее')===category)&&
  (!q||[x.name,x.category,x.manufacturer,x.code,x.allergens].some(v=>String(v||'').toLocaleLowerCase('ru').includes(q))));
 $(conf.count).textContent=all.length+' записей';
 $(conf.list).innerHTML=rows.length?rows.map(x=>card(x,type)).join(''):
 '<div class="catalog-empty">По вашему запросу ничего не найдено. Измените поиск или категорию.</div>';
}
async function activate(type){
 const conf=tabs[type],root=$(conf.view);if(!root||root.hidden||$('shell')?.hidden)return;
 $(conf.list).innerHTML='<div class="catalog-empty">Загружаем защищённый каталог…</div>';
 try{await ensure();categoryOptions(type);render(type)}
 catch(e){$(conf.list).innerHTML='<div class="catalog-empty catalog-error">Не удалось получить данные: '+esc(e.message||e)+'. Повторите вход или откройте раздел ещё раз.</div>'}
}
function info(label,value){
 if(value==null||value==='')return '';
 return '<div class="catalog-info"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>';
}
function nutritionValue(data,key){
 if(data==null||typeof data!=='object')return null;
 return data[key]??data[{protein:'proteins',fat:'fats',carbs:'carbohydrates',kcal:'calories'}[key]]??null;
}
function nutritionBlock(data){
 if(!data||typeof data!=='object'||!Object.keys(data).length)return '';
 const items=[['Белки',nutritionValue(data,'protein'),'г'],['Жиры',nutritionValue(data,'fat'),'г'],['Углеводы',nutritionValue(data,'carbs'),'г'],['Калорийность',nutritionValue(data,'kcal'),'ккал']]
  .filter(([,v])=>v!==null&&v!==''&&Number.isFinite(Number(v)));
 if(!items.length)return '';
 return '<div class="catalog-nutrition">'+items.map(([label,n,unit])=>'<div><small>'+label+'</small><strong>'+fmt(n)+'</strong><small>'+unit+'</small></div>').join('')+'</div>';
}
async function details(type,id){
 const record=dataFor(type).find(x=>Number(x.id)===Number(id));if(!record)return;
 const dialog=$('chefCatalogDialog');$('chefCatalogTitle').textContent=record.name;
 $('chefCatalogSubtitle').textContent=record.category||'Прочее';
 const panel=$('chefCatalogDetails');
 panel.innerHTML='<div class="catalog-empty">Загрузка информации…</div>';
 dialog.showModal();
 let html='<div class="catalog-detail-group">';
 if(type==='ingredients'){
  html+=info('Производитель',record.manufacturer)+info('Единица',record.unit)+
  info('Аллергены (указанные в базе)',record.allergens)+info('Статус данных аллергенов',record.allergen_status)+
  info('Условия хранения',record.storage_conditions)+
  info('Срок хранения',record.shelf_life_hours==null?'':fmt(record.shelf_life_hours)+' ч');
  html+='</div>'+nutritionBlock(record.nutrition_100g);
  html+='<p class="catalog-disclaimer">КБЖУ и аллергены требуют проверки по информации производителя. Карточка отображает сохранённые данные, не подтверждает их правильность.</p>';
 } else {
  html+=info('Код',record.code)+info('Категория',record.category)+info('Выход',record.yield_g==null?'':fmt(record.yield_g)+' г')+
  info('Статус',record.status)+info('Аллергены (указанные в базе)',record.allergens)+
  info('Условия хранения',record.storage);
  html+='</div>'+nutritionBlock(record.nutrition);
  if(record.process)html+='<div class="catalog-process"><strong>Технологический процесс</strong><p>'+esc(record.process)+'</p></div>';
  panel.innerHTML=html+'<div class="catalog-empty">Загружаем состав рецептуры…</div>';
  try{
   const lines=await get('recipe_lines?select=seq,gross_g,net_g,ingredient_id,prefab_id&recipe_id=eq.'+encodeURIComponent(id)+'&order=seq.asc&limit=500');
   if(!dialog.open)return;
   const ingredientsById=new Map((ingredients||[]).map(i=>[Number(i.id),i.name]));
   const prefabsById=new Map((recipes||[]).map(i=>[Number(i.id),i.name]));
   const rows=(lines||[]).map((line,idx)=>{
    const name=line.ingredient_id!=null?ingredientsById.get(Number(line.ingredient_id)):prefabsById.get(Number(line.prefab_id));
    return '<tr><td>'+String(idx+1)+'</td><td>'+esc(name||'Ингредиент не найден')+'</td><td>'+fmt(line.gross_g)+'</td><td>'+fmt(line.net_g)+'</td></tr>';
   }).join('');
   html+='<div class="catalog-process"><strong>Рецептурный состав</strong>'+
    (rows?'<div class="catalog-table-wrap"><table class="catalog-table"><thead><tr><th>№</th><th>Наименование</th><th>Брутто, г</th><th>Нетто, г</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p>Строки рецептуры не заполнены.</p>')+'</div>';
  }catch(e){html+='<p class="catalog-disclaimer">Не удалось загрузить состав: '+esc(e.message||e)+'</p>'}
  html+='<p class="catalog-disclaimer">Состав и технология приведены из существующей базы. Для утверждения ТТК требуется проверка шеф-поваром.</p>';
 }
 if(dialog.open)panel.innerHTML=html;
}
function init(){
 for(const [type,conf] of Object.entries(tabs)){
  const view=$(conf.view);
  if(!view)continue;
  const observer=new MutationObserver(()=>{if(!view.hidden)activate(type)});
  observer.observe(view,{attributes:true,attributeFilter:['hidden']});
  $(conf.search).addEventListener('input',()=>{if(ingredients&&recipes)render(type)});
  $(conf.category).addEventListener('change',()=>{if(ingredients&&recipes)render(type)});
 }
 document.addEventListener('click',e=>{
  const card=e.target.closest('[data-catalog-kind][data-catalog-id]');
  if(card)details(card.dataset.catalogKind,card.dataset.catalogId).catch(err=>{
   $('chefCatalogDetails').innerHTML='<div class="catalog-empty catalog-error">'+esc(err.message||err)+'</div>';
  });
  if(e.target.closest('#logout,#logoutMobile')){ingredients=null;recipes=null;pending=null}
 });
 const dialog=$('chefCatalogDialog');
 for(const id of ['chefCatalogClose','chefCatalogDone'])$(id).addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{
  if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();
  if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();