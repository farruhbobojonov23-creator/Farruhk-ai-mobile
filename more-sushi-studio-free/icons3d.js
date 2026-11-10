/* More Sushi: editable 3D product icon gallery, per-item photo overrides */
(function(){
'use strict';
const ROOT='https://cdn.jsdelivr.net/gh/shuding/fluentui-emoji-unicode/assets/';
const available=[
 ['🍚','Рис'],['🍣','Роллы'],['🥣','Соус'],['🍤','Креветка'],['🐟','Рыба'],['🦀','Краб'],
 ['🦑','Кальмар'],['🦪','Мидии'],['🍥','Нори / обсыпка'],['🥒','Огурец'],['🥑','Авокадо'],
 ['🥕','Морковь'],['🫑','Перец'],['🥬','Овощи'],['🍋','Лимон'],['🍅','Томаты'],
 ['🧀','Сыр'],['🥛','Сливки'],['🥚','Яйцо'],['🍳','Омлет'],['🥖','Панировка'],
 ['🌾','Крупы'],['🧂','Соль'],['🫙','Соусы'],['🍜','Лапша'],['🍗','Курица'],
 ['🧄','Чеснок'],['🧅','Лук'],['🍯','Сироп'],['💧','Вода']
];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const emojiUrl=e=>ROOT+[...e].map(c=>c.codePointAt(0).toString(16)).join('-')+'_3d.png';
function auto(item,type){
 const t=(String(item?.name||'')+' '+String(item?.category||'')).toLowerCase();
 const rules=[
 [/кревет|лангуст|темпур.*кревет/,'🍤'],[/мид/,'🦪'],[/кальмар|осьминог/,'🦑'],
 [/краб|сурими/,'🦀'],[/икра|масаго|тобико/,'🍥'],[/рыб|лосос|форел|тунц|угор|филе.*мор/,'🐟'],
 [/огур/,'🥒'],[/авокад/,'🥑'],[/морков/,'🥕'],[/перец болгар/,'🫑'],[/капуст|айсберг|салат|дайкон|такуан/,'🥬'],
 [/лимон|лайм/,'🍋'],[/томат|черри/,'🍅'],[/зел[её]н.*лук|лук/,'🧅'],[/чеснок/,'🧄'],
 [/сливк|молоко/,'🥛'],[/сыр|пармезан|моцарелл|чеддер/,'🧀'],[/яйц|меланж/,'🥚'],
 [/омлет|тамаго/,'🍳'],[/сухар|панк|кляр|темпур.*смесь/,'🥖'],[/рис/,'🍚'],
 [/нори|кунжут|обсыпк|стружк/,'🍥'],[/лапш|удон/,'🍜'],[/куриц|грудк|мясо/,'🍗'],
 [/соль|спец|шичими|сахар/,'🧂'],[/вода|напиток/,'💧'],
 [/соус|спайси|майонез|терияки|унаги|кимчи|шрирача|сушидз|мирин|уксус|масл|заправ/,'🥣']
 ];
 for(const [pattern,icon] of rules)if(pattern.test(t))return icon;
 if(type==='recipe')return '🍣';
 if(/овощ|фрукт/i.test(t))return '🥬';
 if(/морепродукт/i.test(t))return '🐟';
 if(/сыр|молоч/i.test(t))return '🧀';
 if(/соус/i.test(t))return '🥣';
 return '🍱';
}
function selected(item,type){
 return type==='ingredient'?item?.icon_emoji||auto(item,type):
   item?.ttk_fields?.ultra?.icon_emoji||auto(item,type);
}
function render(item,type='ingredient',size='medium'){
 const chosen=selected(item,type);
 const photo=type==='ingredient'?item?.photo_data:item?.photo_path;
 const cls='msVisual msVisual--'+size;
 const img=photo&&/^data:image\/(?:webp|png|jpeg);base64,/i.test(photo)?photo:emojiUrl(chosen);
 const alt=esc(item?.name||'3D-значок');
 return '<span class="'+cls+'" aria-label="'+alt+'" title="'+alt+'">'+
  '<span class="msVisualFallback" aria-hidden="true">'+esc(chosen)+'</span>'+
  '<img loading="lazy" decoding="async" src="'+esc(img)+'" alt="" onerror="this.style.display=\'none\'" onload="this.style.display=\'block\'"></span>';
}
async function asPhoto(file){
 if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('Выберите JPG, PNG или WEBP.');
 if(file.size>8*1024*1024)throw Error('Максимальный размер исходного фото — 8 МБ.');
 const src=await new Promise((resolve,reject)=>{
  const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Не удалось прочитать фото'));r.readAsDataURL(file);
 });
 const img=await new Promise((resolve,reject)=>{
  const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Не удалось открыть изображение'));i.src=src;
 });
 const dim=Math.max(img.naturalWidth,img.naturalHeight);
 const factor=Math.min(1,640/dim),canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(img.naturalWidth*factor));canvas.height=Math.max(1,Math.round(img.naturalHeight*factor));
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Не удалось обработать изображение');
 ctx.drawImage(img,0,0,canvas.width,canvas.height);
 const result=canvas.toDataURL('image/webp',.82);
 if(result.length>900000)throw Error('Фото слишком объёмное. Используйте изображение с меньшей детализацией.');
 return result;
}
let ingredientPhoto=null,ingredientIcon='';
let iconDialog=null;
function paletteMarkup(selectedIcon){
 return available.map(([emoji,title])=>'<button type="button" class="msIconChoice '+(selectedIcon===emoji?'msIconChoice--active':'')+'" data-icon="'+esc(emoji)+'" title="'+esc(title)+'" aria-label="'+esc(title)+'">'+render({name:title,icon_emoji:emoji},'ingredient','small')+'</button>').join('');
}
function syncIngredient(){
 const preview=document.getElementById('msIngredientPreview');if(!preview)return;
 const name=document.getElementById('ingName')?.value||'Ингредиент';
 preview.innerHTML=render({name,photo_data:ingredientPhoto,icon_emoji:ingredientIcon||auto({name},'ingredient')},'ingredient','large');
 const label=document.getElementById('msPhotoStatus');if(label)label.textContent=ingredientPhoto?'Своя фотография':'3D-значок · можно заменить';
}
function setIngredient(item){
 ingredientPhoto=item?.photo_data||null;ingredientIcon=item?.icon_emoji||'';
 syncIngredient();
}
function setupIngredient(){
 const container=document.getElementById('ingredientFormPanel');if(!container)return;
 const header=container.firstElementChild;
 const section=document.createElement('div');section.className='msIngredientVisualEditor';
 section.innerHTML='<div id="msIngredientPreview" class="msIngredientPreview"></div>'+
 '<div class="msIngredientVisualActions"><b>📸 Фото и 3D-значок ингредиента</b><span id="msPhotoStatus">3D-значок</span>'+
 '<div class="msVisualButtons"><button type="button" class="secondary" id="msIngredientUpload">Загрузить фото</button>'+
 '<button type="button" class="secondary" id="msIngredientIcon">Выбрать 3D-значок</button>'+
 '<button type="button" class="msPhotoRemove" id="msIngredientRemove">Удалить фото</button></div>'+
 '<input type="file" hidden accept="image/png,image/jpeg,image/webp" id="msIngredientFile"></div>';
 header.after(section);
 const picker=document.getElementById('msIngredientFile');
 document.getElementById('msIngredientUpload').addEventListener('click',()=>picker.click());
 picker.addEventListener('change',async e=>{
  try{if(e.target.files?.[0]){ingredientPhoto=await asPhoto(e.target.files[0]);syncIngredient()}}
  catch(err){alert(err.message)}finally{picker.value=''}
 });
 document.getElementById('msIngredientRemove').addEventListener('click',()=>{ingredientPhoto=null;syncIngredient()});
 document.getElementById('msIngredientIcon').addEventListener('click',()=>showIconPicker(icon=>{
  ingredientIcon=icon;syncIngredient();
 },ingredientIcon));
 document.getElementById('ingName').addEventListener('input',()=>{if(!ingredientIcon)syncIngredient()});
 const originalEdit=window.editIngredient,originalReset=window.resetIngredientForm;
 window.editIngredient=function(id){originalEdit(id);setIngredient(ingredients.find(i=>Number(i.id)===Number(id)))};
 window.resetIngredientForm=function(){originalReset();setIngredient(null)};
 setIngredient(null);
}
function showIconPicker(onSelect,selectedIcon=''){
 if(!iconDialog){
  iconDialog=document.createElement('dialog');iconDialog.id='msIconDialog';
  iconDialog.innerHTML='<div class="msIconDialogHeading"><h3>Выбери объёмный 3D-значок</h3><button type="button" id="msIconClose" class="secondary">Закрыть ✕</button></div><p>Для каждого продукта можно выбрать свой значок. Собственная фотография имеет приоритет.</p><div class="msIconGrid" id="msIconGrid"></div><small>3D-значки Fluent Emoji © Microsoft, MIT License</small>';
  document.body.append(iconDialog);
  iconDialog.querySelector('#msIconClose').addEventListener('click',()=>iconDialog.close());
  iconDialog.addEventListener('click',e=>{if(e.target===iconDialog)iconDialog.close()});
 }
 const grid=iconDialog.querySelector('#msIconGrid');
 grid.innerHTML=paletteMarkup(selectedIcon);
 grid.onclick=e=>{
  const b=e.target.closest('[data-icon]');if(!b)return;
  onSelect(b.dataset.icon);iconDialog.close();
 };
 iconDialog.showModal();
}
window.MSIcons={render,auto,selected,asPhoto,showIconPicker,setupIngredient,getIngredientPhoto:()=>ingredientPhoto,getIngredientIcon:()=>ingredientIcon,
 setIngredient,iconUrl:emojiUrl};
})();
