import {DeviceStore,validateDeviceState,mergeDeviceState} from '/device-store.js';
import {categoriesFor} from '/category-model.js';
import {grossFromNet,netYield,templateFor,nextCardNumber,cardDateNow,storageWithSanpin,calculateNutrition,nutritionKeys} from '/recipe-math.js';
import {upsertRecipe,deleteRecipe} from '/recipe-actions.js';
import {mountHaccp} from '/haccp-ui.js';
import {mountGoogleSync} from '/recipe-google.js';
import {requireOwner} from '/owner-login.js';

const $=id=>document.getElementById(id);
const store=new DeviceStore();
const today=()=>cardDateNow();
let state=null,filter='all',editing=null,googleSync=null,busy=false,haccpUI=null;
const keyFields=['name','category','status','cardNumber','cardDate','pieces','scope','rawRequirements','preparation','forming','serving','storage','appearance','taste','safety','chef','approver'];
const $form=$('recipe-form');
const money=value=>Number(value||0).toLocaleString('ru-RU',{maximumFractionDigits:2});
const text=value=>String(value??'');
const escapeHtml=s=>text(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const escapeAttr=escapeHtml;
function flash(message,error=false){
 const n=$('notice');n.hidden=false;n.textContent=message;n.classList.toggle('error',error);
 clearTimeout(flash.timer);flash.timer=setTimeout(()=>n.hidden=true,8500);
}
async function save(change){
 if(busy)throw Error('Дождись предыдущего сохранения.');
 if(!state)throw Error('Хранилище ещё не загружено.');
 busy=true;
 try{
   state=await store.mutate(change);
   refresh();
   googleSync?.schedule();
   return state;
 }finally{busy=false}
}
function navigate(screen){
 if(!['home','recipes','lab'].includes(screen))return;
 document.querySelectorAll('.screen').forEach(s=>s.hidden=s.id!==screen);
 document.querySelectorAll('[data-to]').forEach(b=>b.classList.toggle('active',b.dataset.to===screen));
 $('page-name').textContent={home:'Главная',recipes:'ТТК',lab:'ХАССП'}[screen];
 history.replaceState(null,'','#'+screen);
 if(screen==='lab')haccpUI?.render(state);
 window.scrollTo({top:0,behavior:'instant'});
}
document.addEventListener('click',event=>{
 const nav=event.target.closest('[data-to]');if(nav){navigate(nav.dataset.to);return}
 const act=event.target.closest('[data-recipe-action]');if(!act)return;
 const id=act.dataset.id,type=act.dataset.recipeAction;
 if(type==='edit')openEditor(state.recipes.find(r=>r.id===id));
 if(type==='pdf'||type==='word')downloadRecipe(id,type).catch(e=>flash(e.message,true));
});
function refresh(){
 if(!state)return;
 const recipes=state.recipes||[];
 $('metric-total').textContent=recipes.length;
 $('metric-ready').textContent=recipes.filter(r=>r.status==='ready').length;
 const records=state.haccp?.records||[];
 const count=records.filter(r=>r.at&&new Date(r.at).toLocaleDateString('sv-SE',{timeZone:'Europe/Moscow'})===today()).length;
 $('metric-today').textContent=count;
 $('metric-actions').textContent=(state.haccp?.actions||[]).filter(a=>a.status!=='closed').length;
 renderRecipes();
 haccpUI?.render(state);
 googleSync?.render();
}
function renderRecipes(){
 if(!state)return;
 const search=$('recipe-search').value.toLocaleLowerCase('ru').trim();
 const recipes=state.recipes.filter(r=>(filter==='all'||(filter==='ready'?r.status==='ready':r.status!=='ready'))&&(!search||(r.name||'').toLocaleLowerCase('ru').includes(search)||(r.category||'').toLocaleLowerCase('ru').includes(search))).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
 const root=$('recipe-rows');root.replaceChildren();
 if(!recipes.length){root.innerHTML='<p class="no-results">Техкарты не найдены. Можно создать первую или изменить фильтр.</p>';return}
 for(const r of recipes){
   const status=r.status==='ready'?'Готова':'В разработке';
   const weight=Number(r.netYieldGrams)>0?money(r.netYieldGrams)+' г':'—';
   const line=document.createElement('div');line.className='recipe-line';
   line.innerHTML='<span><strong>'+escapeHtml(r.name)+'</strong><small class="sub">№ '+escapeHtml(r.cardNumber||'—')+'</small></span><span>'+escapeHtml(r.category||'Без категории')+'</span><span>'+weight+'</span><span><em class="pill '+(r.status==='ready'?'ready':'draft')+'">'+status+'</em></span><div class="actions"><button data-recipe-action="edit" data-id="'+escapeAttr(r.id)+'">Изменить</button><button data-recipe-action="pdf" data-id="'+escapeAttr(r.id)+'" title="Скачать PDF">PDF</button><button data-recipe-action="word" data-id="'+escapeAttr(r.id)+'" title="Скачать Word">Word</button></div>';
   root.append(line);
 }
}
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
 filter=button.dataset.filter;
 document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b===button));
 renderRecipes();
}));
$('recipe-search').addEventListener('input',renderRecipes);
function categories(){
 const list=categoriesFor(state||{}).filter(c=>c.visible!==false).map(c=>c.name);
 for(const r of state?.recipes||[])if(r.category&&!list.includes(r.category))list.push(r.category);
 return list.length?list:['Без категории'];
}
function currentFormValue(key){const input=$form.elements.namedItem(key);return input?input.value:''}
function setFormValue(key,value){const input=$form.elements.namedItem(key);if(input)input.value=value??''}
function addIngredient(ingredient={}){
 const row=document.createElement('div');row.className='ingredient-row';row.dataset.oldId=ingredient.id||'';
 row.original=ingredient;
 for(const [field,label,kind] of [['name','Ингредиент','text'],['grams','Нетто, г','number'],['lossPercent','Отходы, %','number'],['price','Цена за кг','number']]){
   const input=document.createElement('input');
   input.dataset.field=field;
   input.type=kind;
   input.placeholder=label;
   input.setAttribute('aria-label',label);
   input.required=true;
   if(kind==='number'){input.min=field==='grams'?'0.01':'0';input.step='any'}
   if(field==='lossPercent')input.max='99.99';
   input.value=ingredient[field]??(field==='lossPercent'?'0':'');
   row.append(input);
 }
 const del=document.createElement('button');del.type='button';del.setAttribute('aria-label','Удалить ингредиент');del.textContent='×';
 del.addEventListener('click',()=>{row.remove();recalculate()});row.append(del);
 row.addEventListener('input',recalculate);
 $('ingredients').append(row);
 recalculate();
 return row;
}
function ingredientsFromEditor(){
 return [...$('ingredients').children].map(row=>{
   const out={...row.original};
   row.querySelectorAll('[data-field]').forEach(input=>{out[input.dataset.field]=input.dataset.field==='name'?input.value.trim():Number(input.value)});
   out.grossGrams=grossFromNet(out.grams,out.lossPercent);
   out.nutrition=out.nutrition||Object.fromEntries(nutritionKeys.map(key=>[key,null]));
   return out;
 });
}
function recalculate(){
 const ingredients=ingredientsFromEditor();
 const output=netYield(ingredients);
 const cost=ingredients.reduce((sum,i)=>sum+Number(i.grams||0)*Number(i.price||0)/1000,0);
 setFormValue('netYieldGrams',output??'');
 $('preview-yield').textContent=output===null?'—':money(output)+' г';
 $('preview-cost').textContent=money(cost)+' ₽';
}
function openEditor(recipe=null){
 if(!state){flash('Данные ещё не загружены.',true);return}
 editing=recipe||null;
 $form.reset();
 const names=categories();
 const category=$('recipe-category');category.replaceChildren();
 names.forEach(n=>category.append(new Option(n,n)));
 const defaultCategory=recipe?.category||names[0];
 if(!names.includes(defaultCategory))category.append(new Option(defaultCategory,defaultCategory));
 const t=templateFor(defaultCategory,Number(recipe?.pieces)||8);
 $('editor-title').textContent=recipe?'Редактирование ТТК':'Новая техкарта';
 const initial={...t,...recipe,category:defaultCategory,name:recipe?.name||'',status:recipe?.status||'draft',cardDate:recipe?.cardDate||today(),cardNumber:recipe?.cardNumber||nextCardNumber(state.recipes),pieces:recipe?.pieces||8};
 for(const field of keyFields)setFormValue(field,initial[field]??'');
 $('ingredients').replaceChildren();
 (recipe?.ingredients?.length?recipe.ingredients:[{}]).forEach(addIngredient);
 $('delete-recipe').hidden=!recipe;
 $('recipe-dialog').showModal();
 recalculate();
}
function readRecipe(){
 if(!$form.reportValidity())throw Error('Проверь обязательные поля.');
 const ingredients=ingredientsFromEditor();
 if(!ingredients.length||ingredients.some(i=>!i.name||!Number.isFinite(i.grams)||i.grams<=0||!Number.isFinite(i.price)||i.price<0||!Number.isFinite(i.lossPercent)||i.lossPercent<0||i.lossPercent>=100||i.grossGrams==null))throw Error('Проверь ингредиенты, вес и потери.');
 const data={...editing,id:editing?.id||crypto.randomUUID(),ingredients};
 for(const key of keyFields){
   const val=currentFormValue(key);
   data[key]=key==='pieces'?Number(val):val.trim();
 }
 data.netYieldGrams=netYield(ingredients);
 data.forming=data.forming.trim();
 data.technology=data.forming;
 data.storage=storageWithSanpin(data.storage);
 if(editing?.nutritionMode==='ingredients')data.nutrition=calculateNutrition(ingredients,data.netYieldGrams)||editing.nutrition;
 return data;
}
async function persistRecipe(close=true){
 const recipe=readRecipe();
 const prevId=editing?.id||null;
 await save(s=>upsertRecipe(s,recipe,{editing:!!prevId}));
 editing=recipe;
 if(close)$('recipe-dialog').close();
 flash('ТТК сохранена на устройстве.');
 return recipe;
}
$form.addEventListener('submit',async event=>{event.preventDefault();try{await persistRecipe()}catch(e){flash(e.message,true)}});
$('close-recipe').onclick=()=>$('recipe-dialog').close();
$('new-recipe').onclick=()=>openEditor();
$('home-new').onclick=()=>{navigate('recipes');openEditor()};
$('add-ingredient').onclick=()=>addIngredient();
$('delete-recipe').onclick=async()=>{
 if(!editing||!confirm('Удалить ТТК «'+editing.name+'»? Отмена невозможна.'))return;
 try{const id=editing.id;await save(s=>deleteRecipe(s,id));$('recipe-dialog').close();editing=null;flash('ТТК удалена.')}catch(e){flash(e.message,true)}
};
async function downloadFile(blob,filename){
 const u=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=u;a.download=filename;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(u),60000);
}
async function exportRecipe(recipe,type){
 const endpoint=type==='word'?'/api/recipes/word':'/api/recipes/pdf';
 const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipe}),signal:AbortSignal.timeout(35000)});
 if(!r.ok)throw Error('Сервер не смог подготовить '+type.toUpperCase()+'.');
 await downloadFile(await r.blob(),'ТТК_'+recipe.name+'.'+(type==='word'?'docx':'pdf'));
}
async function downloadRecipe(id,type){
 const recipe=state?.recipes.find(r=>r.id===id);
 if(!recipe)throw Error('Техкарта не найдена.');
 await exportRecipe(recipe,type);
}
async function saveThenDownload(type){
 try{const r=await persistRecipe(false);await exportRecipe(r,type);flash('Файл '+type.toUpperCase()+' скачан.')}catch(e){flash(e.message,true)}
}
$('download-pdf').onclick=()=>saveThenDownload('pdf');
$('download-word').onclick=()=>saveThenDownload('word');
$('backup-btn').onclick=async()=>{
 if(!state){flash('Хранилище ещё не загружено.',true);return}
 await downloadFile(new Blob([JSON.stringify({version:1,createdAt:new Date().toISOString(),state},null,2)],{type:'application/json'}),'farukh-ai-backup-'+today()+'.json');
 flash('Резервная копия скачана.');
};
$('import-file').addEventListener('change',async event=>{
 const f=event.target.files?.[0];event.target.value='';if(!f)return;
 try{
   const imported=validateDeviceState(JSON.parse(await f.text()));
   if(!confirm('Объединить данные из резервной копии с текущими? Существующие записи не удалятся.'))return;
   await save(s=>Object.assign(s,mergeDeviceState(s,imported)));
   flash('Данные из резервной копии объединены.');
 }catch(e){flash('Не удалось импортировать: '+e.message,true)}
});
$('current-date').textContent=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Moscow'});
$('today-label').textContent='На '+new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'});
async function start(){
 try{
   await requireOwner();
   state=await store.load();
   $('storage-side').textContent='Хранилище устройства готово';
   haccpUI=mountHaccp($('haccp-root'),{getState:()=>state,save,notify:flash});
   googleSync=mountGoogleSync({getState:()=>state,store,onState:newState=>{state=newState;refresh()},notify:flash});
   refresh();
   navigate(['home','recipes','lab'].includes(location.hash.slice(1))?location.hash.slice(1):'home');
 }catch(e){
   $('storage-side').textContent='Ошибка хранилища';
   flash('Не удалось открыть рабочее пространство: '+e.message,true);
 }
}
start();
