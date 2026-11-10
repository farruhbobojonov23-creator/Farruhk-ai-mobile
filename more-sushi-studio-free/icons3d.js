/* Море Суши · фотобиблиотека продуктов без фоновых эмодзи */
(function(){
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const q=id=>document.getElementById(id);
const PHOTO_RE=/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/;
const localPhotoUrl=v=>/^\.\/photos\/[a-z0-9_-]+\.webp$/.test(String(v||''));
let photos=[],ready=false,ingredientPhoto=null,ingredientKey='',picker=null,whenSelected=null;
const norms=s=>String(s||'').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[«»"()\/–—-]/g,' ').replace(/\s+/g,' ').trim();
const synonyms=[
 [/кунжут/,'кунжут'],[/томат|черри/,'черри'],[/мидии/,'мидии'],
 [/сладк.*чили/,'сладкий чили'],[/кревет.*вар|кревет.*очищ/,'креветка вареная'],
 [/кревет/,'креветка'],[/лосос|форел/,'форель'],[/угор/,'угорь'],[/краб/,'краб'],
 [/огур/,'огурец'],[/рис/,'рис'],[/соус спайси|спайси.*база/,'спайси'],
 [/лук.*фри/,'лук фри'],[/пармез/,'пармезан'],[/сыр.*творож/,'крем чиз'],
 [/сыр/,'сыр'],[/лимон/,'лимон'],[/морков/,'морковь'],[/нори/,'нори'],
 [/панко/,'панко'],[/шичими/,'шичими'],[/масаг/,'масаго']
];
const photoForKey=k=>{
 if(!/^gallery:-?[0-9]+$/.test(String(k||'')))return null;
 return photos.find(x=>Number(x.id)===Number(k.split(':')[1]))||null;
};
function predicted(item){
 const label=norms(item?.name),mapped=synonyms.find(([pattern])=>pattern.test(label))?.[1]||label;
 const strict=photos.find(p=>norms(p.name)===label);if(strict)return strict;
 return photos.find(p=>(String(p.keywords||'').split(/[,;]+/).some(k=>norms(k)===mapped&&mapped.length>2)));
}
function source(item,type){
 const raw=type==='ingredient'?item?.photo_data:item?.photo_path;
 if(raw&&PHOTO_RE.test(raw))return raw;
 const key=type==='ingredient'?item?.icon_emoji:item?.ttk_fields?.ultra?.icon_emoji;
 const match=photoForKey(key)||(!key?predicted(item):null);
 return match?.image_data&&(PHOTO_RE.test(match.image_data)||localPhotoUrl(match.image_data))?match.image_data:null;
}
function render(item,type='ingredient',size='medium'){
 const img=source(item,type),alt=esc(item?.name||'Фото продукта');
 return '<span class="msVisual msVisual--'+esc(size)+'" title="'+alt+'">'+
 (img?'<img loading="lazy" decoding="async" src="'+img+'" alt="'+alt+'">':
 '<span class="msPhotoPlaceholder" aria-label="Фотография пока не выбрана">'+
 '<svg viewBox="0 0 32 32" aria-hidden="true" fill="none"><rect x="3.5" y="5" width="25" height="22" rx="4" stroke="currentColor" stroke-width="1.6"/><circle cx="11" cy="12" r="2.7" stroke="currentColor" stroke-width="1.5"/><path d="m6 23 7-7 5 5 4-4 4 5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></span>')+
 '</span>';
}
async function asPhoto(file){
 if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('Формат фото: PNG, JPG или WEBP.');
 if(file.size>10*1024*1024)throw Error('Слишком большой файл: максимум 10 МБ.');
 const original=await new Promise((resolve,reject)=>{
  const rd=new FileReader();rd.onload=()=>resolve(rd.result);rd.onerror=()=>reject(new Error('Не удалось прочитать фотографию'));rd.readAsDataURL(file);
 });
 const image=await new Promise((resolve,reject)=>{
  const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Не удалось открыть фото'));img.src=original;
 });
 const ratio=Math.min(1,640/Math.max(image.width,image.height)),canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Обработка фото недоступна');
 ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
 const uri=canvas.toDataURL('image/webp',.82);
 if(uri.length>950000)throw Error('Не удалось уменьшить фото. Выберите изображение с меньшей детализацией.');
 return uri;
}
async function refresh(){
 try{
  const [dynamic,staticList]=await Promise.all([
   http('/rest/v1/food_photo_library?select=id,name,category,keywords,image_data&order=name.asc&limit=500').catch(e=>{console.warn('Фотобиблиотека пользователя:',e.message);return []}),
   fetch('./photo-index.json?v=20261111a',{cache:'no-store'}).then(r=>r.ok?r.json():[]).catch(()=>[])
  ]);
  const local=Array.isArray(staticList)?staticList.filter(p=>Number(p.id)<0&&localPhotoUrl(p.image_data)):[];
  const user=Array.isArray(dynamic)?dynamic:[];
  photos=[...user,...local];ready=true;
  if(typeof renderIngredients==='function')renderIngredients();
  if(typeof renderRecipes==='function'&&typeof currentKind!=='undefined'&&currentKind==='prefab')renderRecipes();
  if(typeof syncIngredient==='function')syncIngredient();
 }catch(e){ready=false;console.warn('Не удалось открыть фотобиблиотеку:',e.message)}
 return photos;
}
function syncIngredient(){
 const dest=q('msIngredientPreview');if(!dest)return;
 const item={name:q('ingName')?.value||'Ингредиент',photo_data:ingredientPhoto,icon_emoji:ingredientKey};
 dest.innerHTML=render(item,'ingredient','large');
 const label=q('msPhotoStatus');
 if(label)label.textContent=ingredientPhoto?'Личная фотография':photoForKey(ingredientKey)?'Выбранное фото из библиотеки':predicted(item)?'Фото подобрано по названию':'Фото пока не выбрано';
}
function setIngredient(item){
 ingredientPhoto=item?.photo_data||null;ingredientKey=item?.icon_emoji||'';
 syncIngredient();
}
function setupIngredient(){
 const panel=q('ingredientFormPanel');if(!panel)return;
 const section=document.createElement('div');section.className='msIngredientVisualEditor';
 section.innerHTML='<div id="msIngredientPreview" class="msIngredientPreview"></div>'+
 '<div class="msIngredientVisualActions"><b>📷 Реалистичная фотография продукта</b><span id="msPhotoStatus"></span>'+
 '<div class="msVisualButtons"><button type="button" class="secondary" id="msIngredientUpload">Загрузить фото</button>'+
 '<button type="button" class="secondary" id="msIngredientIcon">Выбрать из фотобиблиотеки</button>'+
 '<button type="button" class="msPhotoRemove" id="msIngredientRemove">Убрать фото</button></div>'+
 '<input id="msIngredientFile" type="file" hidden accept="image/jpeg,image/png,image/webp"></div>';
 panel.firstElementChild.after(section);
 const input=q('msIngredientFile');
 q('msIngredientUpload').addEventListener('click',()=>input.click());
 input.addEventListener('change',async()=>{
  try{if(input.files?.[0]){ingredientPhoto=await asPhoto(input.files[0]);ingredientKey='';syncIngredient()}}
  catch(e){alert(e.message)}finally{input.value=''}
 });
 q('msIngredientIcon').addEventListener('click',()=>showIconPicker(key=>{
  ingredientKey=key;ingredientPhoto=null;syncIngredient();
 },ingredientKey,q('ingName').value));
 q('msIngredientRemove').addEventListener('click',()=>{ingredientPhoto=null;ingredientKey='none';syncIngredient()});
 q('ingName').addEventListener('input',syncIngredient);
 const oldEdit=window.editIngredient,oldReset=window.resetIngredientForm;
 window.editIngredient=function(id){oldEdit(id);setIngredient(ingredients.find(i=>Number(i.id)===Number(id)))};
 window.resetIngredientForm=function(){oldReset();setIngredient(null)};
 setIngredient(null);
}
function setupPicker(){
 if(picker)return;
 picker=document.createElement('dialog');picker.id='msIconDialog';
 picker.innerHTML=
 '<div class="msIconDialogHeading"><div><small>МОРЕ СУШИ · ФОТОБИБЛИОТЕКА</small><h3>Реалистичные фото без фона</h3></div><button type="button" class="secondary" id="msIconClose">Закрыть ✕</button></div>'+
 '<p>Выбери подходящее фото или загрузи своё. Можно добавлять сразу несколько изображений, а затем использовать их в любых рецептах.</p>'+
 '<div class="msBankTools"><input id="msBankSearch" type="search" placeholder="🔎 Найти фото продукта"><select id="msBankCat"><option value="">Все категории</option></select></div>'+
 '<div class="msBankActions"><button type="button" id="msBankAdd">＋ Добавить фотографии</button><button type="button" class="secondary" id="msBankPack">Импортировать набор .json</button>'+
 '<button type="button" class="secondary" id="msBankReset">Автоподбор по названию</button></div>'+
 '<input hidden type="file" id="msBankFiles" accept="image/png,image/webp,image/jpeg" multiple>'+
 '<input hidden type="file" id="msBankJson" accept=".json,application/json">'+
 '<div id="msBankMessage" aria-live="polite"></div><div class="msBankGrid" id="msIconGrid"></div>';
 document.body.append(picker);
 picker.querySelector('#msIconClose').onclick=()=>picker.close();
 picker.addEventListener('click',e=>{if(e.target===picker)picker.close()});
 q('msBankSearch').addEventListener('input',paintPicker);
 q('msBankCat').addEventListener('change',paintPicker);
 q('msBankAdd').onclick=()=>q('msBankFiles').click();
 q('msBankPack').onclick=()=>q('msBankJson').click();
 q('msBankReset').onclick=()=>{whenSelected?.('');picker.close()};
 q('msBankFiles').addEventListener('change',async()=>{
  const files=[...q('msBankFiles').files];q('msBankFiles').value='';
  if(!files.length)return;
  if(files.length>100){notify('В одной загрузке не более 100 фотографий.');return}
  await addUploads(files);
 });
 q('msBankJson').addEventListener('change',async()=>{
  const file=q('msBankJson').files?.[0];q('msBankJson').value='';if(!file)return;
  try{
   if(file.size>25*1024*1024)throw Error('Набор больше 25 МБ');
   const doc=JSON.parse(await file.text());
   if(doc.format!=='more-sushi-photo-pack-v1'||!Array.isArray(doc.assets)||doc.assets.length>100)throw Error('Неправильный формат набора');
   await batchAdd(doc.assets);
  }catch(e){notify('Ошибка импорта: '+e.message)}
 });
 q('msIconGrid').addEventListener('click',async e=>{
  const button=e.target.closest('[data-pick],[data-delete]');if(!button)return;
  const id=Number(button.dataset.pick||button.dataset.delete);
  if(button.dataset.pick){
   whenSelected?.('gallery:'+id);picker.close();
  }else{
   const p=photos.find(x=>Number(x.id)===id);if(!p)return;
   if(!confirm('Удалить фотографию «'+p.name+'» из библиотеки? Если она используется в продуктах, изображение может исчезнуть.'))return;
   try{await http('/rest/v1/food_photo_library?id=eq.'+id,{method:'DELETE'});
     photos=photos.filter(x=>Number(x.id)!==id);paintPicker();redraw();
   }catch(err){notify('Ошибка удаления: '+err.message)}
  }
 });
}
function notify(message){const box=q('msBankMessage');if(box)box.textContent=message;}
function redraw(){
 if(typeof renderIngredients==='function')renderIngredients();
 if(typeof renderRecipes==='function'&&typeof currentKind!=='undefined'&&currentKind==='prefab')renderRecipes();
 syncIngredient();
 if(typeof window.MSPhotosUpdated==='function')window.MSPhotosUpdated();
}
function paintPicker(){
 const search=norms(q('msBankSearch').value),cat=q('msBankCat').value;
 const categories=[...new Set(photos.map(p=>p.category||'Прочее'))].sort((a,b)=>a.localeCompare(b,'ru'));
 q('msBankCat').innerHTML='<option value="">Все категории</option>'+categories.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
 q('msBankCat').value=categories.includes(cat)?cat:'';
 const filtered=photos.filter(p=>(!cat||p.category===cat)&&(!search||norms(p.name+' '+p.keywords).includes(search)));
 const grid=q('msIconGrid');
 grid.innerHTML=filtered.length?filtered.map(p=>
  '<article class="msBankItem"><div class="msBankImage"><img src="'+p.image_data+'" alt="'+esc(p.name)+'"></div>'+
  '<b title="'+esc(p.name)+'">'+esc(p.name)+'</b><small>'+esc(p.category)+'</small>'+
  '<div class="msBankButtons"><button type="button" data-pick="'+Number(p.id)+'">Выбрать</button>'+(p.local?'':'<button type="button" class="msPhotoRemove" data-delete="'+Number(p.id)+'" title="Удалить">✕</button>')+'</div></article>'
 ).join(''):'<div class="msBankEmpty">'+(ready?'Фотографий пока нет. Добавь изображения по одному, несколько сразу или импортируй готовый набор.':'Загрузка фотобиблиотеки…')+'</div>';
}
async function batchAdd(items){
 let success=0,skipped=0,errors=[];
 const existing=new Set(photos.map(p=>norms(p.name)));
 for(const it of items){
  notify('Добавляю фото: '+(success+skipped+errors.length+1)+' из '+items.length+'…');
  const name=String(it.name||'').trim().slice(0,160),data=it.image_data;
  if(!name||!PHOTO_RE.test(data||'')||data.length>950000){errors.push(name||'Неверное фото');continue}
  if(existing.has(norms(name))){skipped++;continue}
  try{
   const rows=await http('/rest/v1/food_photo_library?select=id,name,category,keywords,image_data',{
    method:'POST',headers:{Prefer:'return=representation'},
    body:JSON.stringify({name,category:String(it.category||'Прочее').slice(0,100),keywords:String(it.keywords||name).slice(0,450),image_data:data})
   });
   if(!rows?.[0]?.id)throw Error('Фотография не записалась');
   photos.push(rows[0]);existing.add(norms(name));success++;
  }catch(e){errors.push(name+': '+e.message)}
 }
 notify('Добавлено: '+success+'. Уже были: '+skipped+'. Ошибки: '+errors.length+(errors.length?' ('+errors.slice(0,2).join('; ')+')':''));
 paintPicker();redraw();
}
async function addUploads(files){
 const items=[];
 for(const f of files){
  try{
   const name=f.name.replace(/\.(png|jpeg|jpg|webp)$/i,'').replace(/[_-]/g,' ').trim();
   items.push({name,category:'Прочее',keywords:name,image_data:await asPhoto(f)});
  }catch(e){notify('Не удалось обработать '+f.name+': '+e.message)}
 }
 await batchAdd(items);
}
function showIconPicker(onSelect,selected='',searchDefault=''){
 whenSelected=onSelect;setupPicker();
 q('msBankSearch').value=searchDefault&&photos.some(p=>norms(p.name+' '+p.keywords).includes(norms(searchDefault)))?searchDefault:'';
 q('msBankCat').value='';
 paintPicker();
 picker.showModal();
 if(!ready)refresh().then(paintPicker);
}
setupIngredient();
window.MSIcons={render,asPhoto,showIconPicker,refresh,setupIngredient,setIngredient,getIngredientPhoto:()=>ingredientPhoto,getIngredientIcon:()=>ingredientKey,auto:predicted,clear:()=>{photos=[];ready=false;ingredientPhoto=null;ingredientKey='';if(picker?.open)picker.close()}};
})();
