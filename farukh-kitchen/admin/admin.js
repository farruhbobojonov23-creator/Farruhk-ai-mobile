import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.118.0';
const sb=createClient('https://rwvljbgsqnabvzmoaxgg.supabase.co','sb_publishable_VD-jbYP5drGWQneUwaGytA_u-OWJclT',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
let currentUser=null,recipes=[],selectedRecipe=null,photoMap=new Map(),requests=[],settings={};
const n=v=>v===''||v==null?null:Number(v);
const plain=v=>v==null?'':String(v);
const fmt=v=>new Intl.NumberFormat('ru-RU').format(Number(v||0));
const date=v=>new Date(v).toLocaleString('ru-RU',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
let toastTimer;
function toast(message,bad=false){const el=$('toast');el.textContent=message;el.classList.toggle('error',bad);el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),7000)}
function err(e,defaultMsg){toast((defaultMsg?defaultMsg+': ':'')+(e?.message||String(e||'неизвестная ошибка')),true)}
function show(id,on){$(id).classList.toggle('hidden',!on)}
function changeView(name){document.querySelectorAll('[data-view]').forEach(e=>e.classList.toggle('hidden',e.dataset.view!==name));document.querySelectorAll('[data-panel]').forEach(e=>e.classList.toggle('active',e.dataset.panel===name));window.scrollTo({top:0,behavior:'smooth'});if(name==='requests')loadRequests();}
document.querySelectorAll('[data-panel]').forEach(btn=>btn.addEventListener('click',()=>changeView(btn.dataset.panel)));
document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>changeView(btn.dataset.go)));
async function signout(){await sb.auth.signOut();currentUser=null;show('app',false);show('denyBox',false);show('loginBox',true);$('ownerIdentity').textContent='';show('logout',false);}
$('logout').addEventListener('click',signout);$('denyLogout').addEventListener('click',signout);
async function boot(){
 const {data:{user},error}=await sb.auth.getUser();
 if(error||!user){show('loginBox',true);show('app',false);show('denyBox',false);show('logout',false);return}
 const {data:owner,error:ownerErr}=await sb.from('fk_admins').select('user_id').eq('user_id',user.id).maybeSingle();
 if(ownerErr||!owner){show('loginBox',false);show('app',false);show('denyBox',true);show('logout',true);return}
 currentUser=user;
 $('ownerIdentity').textContent=user.email||'Владелец';
 show('loginBox',false);show('denyBox',false);show('app',true);show('logout',true);
 try{await Promise.all([loadRecipes(),loadSettings(),loadRequests(),loadStats()]);}
 catch(e){err(e,'Не удалось загрузить данные панели')}
}
$('loginForm').addEventListener('submit',async ev=>{
 ev.preventDefault();const btn=$('loginBtn');btn.disabled=true;
 const email=$('email').value.trim(),password=$('password').value;
 try{const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;$('password').value='';await boot();}
 catch(e){err(e,'Не удалось войти');}finally{btn.disabled=false;}
});
$('otpBtn').addEventListener('click',async()=>{
 const email=$('email').value.trim();if(!/^\S+@\S+\.\S+$/.test(email)){toast('Сначала укажи почту владельца.',true);return}
 $('otpBtn').disabled=true;
 try{const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+'/admin/'}});if(error)throw error;toast('Проверь почту. Если ссылка не открывается, используй переход по скопированной ссылке.')}
 catch(e){err(e,'Письмо не отправлено')}finally{$('otpBtn').disabled=false}
});
function recipeCode(r){return (plain(r.notes).match(/(?:FK-A4|ТТК-ПФ)-\d{3}/)||[])[0]||''}
async function loadRecipes(){
 const {data,error}=await sb.from('fk_recipes').select('id,kind,title,category,status,yield_g,storage_conditions,shelf_life_minutes,notes').order('title',{ascending:true}).limit(150);
 if(error)throw error;
 recipes=data||[];
 const opts=recipes.map(r=>({id:r.id,label:(recipeCode(r)||r.kind)+' · '+r.title}));
 const list=$('recipeSelect'),photo=$('photoRecipe');
 list.replaceChildren();photo.replaceChildren();
 for(const o of opts){const x=new Option(o.label,o.id);list.add(x);photo.add(new Option(o.label,o.id))}
 if(recipes.length){list.value=selectedRecipe&&recipes.some(r=>r.id===selectedRecipe.id)?selectedRecipe.id:recipes[0].id;await selectRecipe(list.value);await loadPhotoPreview()}
 $('metricRecipes').textContent=recipes.length;
 $('metricPreps').textContent=recipes.filter(r=>r.kind==='prep').length;
 $('metricReview').textContent=recipes.filter(r=>r.status==='review').length;
}
$('recipeSearch').addEventListener('input',()=>{
 const q=$('recipeSearch').value.toLocaleLowerCase('ru').trim();
 for(const o of $('recipeSelect').options){const v=o.textContent.toLocaleLowerCase('ru');o.hidden=!!q&&!v.includes(q)}
 const match=Array.from($('recipeSelect').options).find(o=>!o.hidden);
 if(match&&match.value!==$('recipeSelect').value){$('recipeSelect').value=match.value;selectRecipe(match.value)}
});
$('recipeSelect').addEventListener('change',ev=>selectRecipe(ev.target.value));
async function selectRecipe(id){
 const r=recipes.find(x=>x.id===id);selectedRecipe=r;if(!r)return;
 $('recipeTitle').value=r.title;$('recipeCategory').value=r.category;
 $('recipeYield').value=plain(r.yield_g);$('recipeLife').value=plain(r.shelf_life_minutes);
 $('recipeStorage').value=plain(r.storage_conditions);$('recipeNotes').value=plain(r.notes);
 show('recipeForm',true);show('linesBox',true);show('stepsBox',true);
 const [x,y]=await Promise.all([
  sb.from('fk_ingredients').select('id,position,ingredient_name,gross_g,net_g,gross_quantity_text,net_quantity_text').eq('recipe_id',id).order('position'),
  sb.from('fk_steps').select('id,position,instruction').eq('recipe_id',id).order('position')
 ]);
 if(x.error||y.error)throw x.error||y.error;
 renderIngredients(x.data||[]);renderSteps(y.data||[]);
}
$('recipeForm').addEventListener('submit',async ev=>{
 ev.preventDefault();if(!currentUser||!selectedRecipe)return;
 const title=$('recipeTitle').value.trim(),category=$('recipeCategory').value.trim();
 if(title.length<2||!category){toast('Укажи название и категорию.',true);return}
 const button=$('saveRecipe');button.disabled=true;
 const payload={title,category,yield_g:n($('recipeYield').value),shelf_life_minutes:n($('recipeLife').value),
  storage_conditions:$('recipeStorage').value.trim()||null,notes:$('recipeNotes').value.trim()};
 try{const {error}=await sb.from('fk_recipes').update(payload).eq('id',selectedRecipe.id);if(error)throw error;
 Object.assign(selectedRecipe,payload);
 const selected=$('recipeSelect').selectedOptions[0];if(selected)selected.textContent=(recipeCode(selectedRecipe)||selectedRecipe.kind)+' · '+title;
 toast('ТТК сохранена в базе. Для обновления PDF потребуется отдельно выпустить новый файл.');}
 catch(e){err(e,'Ошибка сохранения ТТК')}finally{button.disabled=false}
});
function renderIngredients(items){
 const root=$('ingredientsList');root.replaceChildren();
 if(!items.length){root.textContent='Нет строк рецептуры.';return}
 for(const i of items){
  const row=document.createElement('div');row.className='item-row';
  const name=document.createElement('label');name.textContent='Ингредиент';
  const a=document.createElement('input');a.value=plain(i.ingredient_name);a.maxLength=140;name.append(a);
  const gross=document.createElement('label');gross.textContent='Брутто, г';
  const g=document.createElement('input');g.type='number';g.step='0.001';g.min='0';g.value=plain(i.gross_g);gross.append(g);
  const net=document.createElement('label');net.textContent='Нетто, г';
  const nt=document.createElement('input');nt.type='number';nt.step='0.001';nt.min='0';nt.value=plain(i.net_g);net.append(nt);
  const btn=document.createElement('button');btn.type='button';btn.className='btn ghost';btn.textContent='Сохранить';
  const units=document.createElement('div');units.className='tiny muted';units.style.gridColumn='1/-1';
  units.textContent=[i.gross_quantity_text,i.net_quantity_text].filter(Boolean).join(' / ');
  btn.addEventListener('click',async()=>{
   btn.disabled=true;
   try{const payload={ingredient_name:a.value.trim(),gross_g:n(g.value),net_g:n(nt.value)};
    if(!payload.ingredient_name||([payload.gross_g,payload.net_g].some(v=>v!==null&&v<0)))throw Error('Проверь значения');
    const {error}=await sb.from('fk_ingredients').update(payload).eq('id',i.id).eq('recipe_id',selectedRecipe.id);if(error)throw error;toast('Ингредиент сохранён')}
   catch(e){err(e,'Не удалось сохранить ингредиент')}finally{btn.disabled=false}
  });
  row.append(name,gross,net,btn,units);root.append(row);
 }
}
function renderSteps(items){
 const root=$('stepsList');root.replaceChildren();
 if(!items.length){root.textContent='Этапы не заполнены.';return}
 for(const x of items){
  const row=document.createElement('div');row.className='step-row';
  const label=document.createElement('label');label.textContent='Этап '+x.position;
  const area=document.createElement('textarea');area.value=x.instruction;area.rows=3;area.maxLength=3500;label.append(area);
  const btn=document.createElement('button');btn.type='button';btn.className='btn ghost';btn.textContent='Сохранить этап';
  btn.addEventListener('click',async()=>{
   btn.disabled=true;
   try{const {error}=await sb.from('fk_steps').update({instruction:area.value.trim()}).eq('id',x.id).eq('recipe_id',selectedRecipe.id);if(error)throw error;toast('Технологический этап обновлён')}
   catch(e){err(e,'Ошибка изменения этапа')}finally{btn.disabled=false}
  });row.append(label,btn);root.append(row)
 }
}
async function loadSettings(){
 const {data,error}=await sb.from('fk_site_settings').select('key,value');
 if(error)throw error;
 settings=Object.fromEntries((data||[]).map(x=>[x.key,x.value]));
 $('heroTitle').value=settings.hero_title||'';
 $('heroSubtitle').value=settings.hero_subtitle||'';
 $('priceStart').value=settings.price_start||49900;
 $('pricePro').value=settings.price_pro||79900;
 $('pricePremium').value=settings.price_premium||199900;
 const {data:photos,error:photErr}=await sb.from('fk_site_photos').select('recipe_code,object_path');if(photErr)throw photErr;
 photoMap=new Map((photos||[]).map(x=>[x.recipe_code,x.object_path]));
}
async function saveSettings(payload){
 const rows=Object.entries(payload).map(([key,value])=>({key,value:String(value),updated_at:new Date().toISOString()}));
 const {error}=await sb.from('fk_site_settings').upsert(rows,{onConflict:'key'});if(error)throw error;
 Object.assign(settings,payload);
}
$('contentForm').addEventListener('submit',async ev=>{
 ev.preventDefault();const btn=$('saveContent');btn.disabled=true;
 try{await saveSettings({hero_title:$('heroTitle').value.trim(),hero_subtitle:$('heroSubtitle').value.trim()});toast('Главная страница обновлена. Открой сайт и обнови страницу.')}
 catch(e){err(e,'Не удалось сохранить тексты')}finally{btn.disabled=false}
});
$('pricingForm').addEventListener('submit',async ev=>{
 ev.preventDefault();const btn=$('savePrices');btn.disabled=true;
 const prices={price_start:Number($('priceStart').value),price_pro:Number($('pricePro').value),price_premium:Number($('pricePremium').value)};
 try{
  if(Object.values(prices).some(x=>!Number.isInteger(x)||x<0||x>10000000))throw Error('Проверь цены');
  await saveSettings(prices);
  toast('Цены сохранены для публичных страниц. Проверь отображение на сайте перед новой продажей.');
 }catch(e){err(e,'Не удалось сохранить тарифы')}finally{btn.disabled=false}
});
async function loadPhotoPreview(){
 const r=recipes.find(x=>x.id===$('photoRecipe').value);
 const wrap=$('photoPreview');wrap.replaceChildren();if(!r)return;
 const path=photoMap.get(recipeCode(r));if(!path)return;
 const img=document.createElement('img');img.src=sb.storage.from('fk-site-photos').getPublicUrl(path).data.publicUrl;img.alt='Текущая опубликованная фотография '+r.title;
 const label=document.createElement('p');label.className='tiny muted';label.textContent='Текущая фотография '+recipeCode(r);
 wrap.append(img,label);
}
$('photoRecipe').addEventListener('change',loadPhotoPreview);
$('photoForm').addEventListener('submit',async ev=>{
 ev.preventDefault();const r=recipes.find(x=>x.id===$('photoRecipe').value),file=$('photoFile').files[0];
 if(!r||!file){toast('Выбери позицию и фотографию.',true);return}
 const code=recipeCode(r),accept=['image/webp','image/png','image/jpeg'];
 if(!code){toast('Для позиции отсутствует код ТТК.',true);return}
 if(!accept.includes(file.type)||file.size>5*1024*1024||file.size<100){toast('Используй JPG, PNG или WebP размером до 5 МБ.',true);return}
 const btn=$('uploadPhoto');btn.disabled=true;
 const ext={'image/webp':'webp','image/png':'png','image/jpeg':'jpg'}[file.type];
 const path='products/'+code+'/'+crypto.randomUUID()+'.'+ext;
 const previous=photoMap.get(code);
 try{
  const {error:uploaded}=await sb.storage.from('fk-site-photos').upload(path,file,{upsert:false,contentType:file.type,cacheControl:'3600'});if(uploaded)throw uploaded;
  const {error:linked}=await sb.from('fk_site_photos').upsert({recipe_code:code,object_path:path,updated_at:new Date().toISOString()},{onConflict:'recipe_code'});
  if(linked)throw linked;
  photoMap.set(code,path);
  if(previous&&previous!==path)await sb.storage.from('fk-site-photos').remove([previous]);
  $('photoFile').value='';await loadPhotoPreview();
  toast('Фотография опубликована! Обнови открытый каталог для проверки.');
 }catch(e){err(e,'Не удалось опубликовать фото')}finally{btn.disabled=false}
});
async function loadRequests(){
 if(!currentUser)return;
 const {data,error}=await sb.from('fk_access_requests').select('id,customer_name,contact_type,contact_value,package_code,status,owner_note,created_at').order('created_at',{ascending:false}).limit(80);
 if(error){err(error,'Заявки недоступны');return}
 requests=data||[];
 $('metricRequests').textContent=requests.length;
 const newCount=requests.filter(x=>x.status==='new').length;
 $('requestsBadge').textContent=newCount?' · '+newCount:'';
 renderRequests();
}
$('reloadRequests').addEventListener('click',loadRequests);
function renderRequests(){
 const root=$('requestsList');root.replaceChildren();
 if(!requests.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='Заявок пока нет.';root.append(empty);return}
 for(const r of requests){
  const item=document.createElement('div');item.className='request';
  const head=document.createElement('div');head.className='request-head';
  const title=document.createElement('strong');title.textContent=r.customer_name+' · SHEF '+r.package_code.toUpperCase();
  const created=document.createElement('small');created.textContent=date(r.created_at);
  head.append(title,created);
  const contact=document.createElement('p');contact.textContent=(r.contact_type==='telegram'?'Telegram: ':'Телефон: ')+r.contact_value;
  const controls=document.createElement('div');controls.className='row';
  const statusL=document.createElement('label');statusL.textContent='Статус';const sel=document.createElement('select');
  for(const [key,label] of [['new','Новая'],['contacted','Связались'],['completed','Завершена'],['dismissed','Закрыта']])sel.add(new Option(label,key));
  sel.value=r.status;statusL.append(sel);
  const noteL=document.createElement('label');noteL.textContent='Заметка владельца';const note=document.createElement('input');note.value=r.owner_note||'';note.maxLength=500;noteL.append(note);controls.append(statusL,noteL);
  const btn=document.createElement('button');btn.type='button';btn.className='btn ghost';btn.textContent='Сохранить заявку';btn.addEventListener('click',async()=>{
   btn.disabled=true;try{
    const {error}=await sb.from('fk_access_requests').update({status:sel.value,owner_note:note.value.trim(),updated_at:new Date().toISOString()}).eq('id',r.id);
    if(error)throw error;Object.assign(r,{status:sel.value,owner_note:note.value.trim()});toast('Заявка обновлена');
    $('requestsBadge').textContent=(requests.filter(x=>x.status==='new').length||'')?' · '+requests.filter(x=>x.status==='new').length:'';
   }catch(e){err(e,'Не удалось изменить заявку')}finally{btn.disabled=false}
  });
  item.append(head,contact,controls,btn);root.append(item);
 }
}
async function loadStats(){const {count,error}=await sb.from('fk_recipes').select('id',{head:true,count:'exact'});if(error)throw error;$('metricRecipes').textContent=fmt(count)}
$('passwordForm').addEventListener('submit',async ev=>{
 ev.preventDefault();const p=$('newPassword').value,p2=$('newPasswordRepeat').value;
 if(p.length<12||p.length>72||p!==p2){toast('Пароль должен быть от 12 до 72 символов. Оба поля должны совпадать.',true);return}
 try{const {error}=await sb.auth.updateUser({password:p});if(error)throw error;
 $('passwordForm').reset();toast('Пароль Supabase изменён. Сохрани его в надёжном менеджере паролей.');}
 catch(e){err(e,'Пароль не изменён')}
});
boot().catch(e=>err(e,'Ошибка инициализации'));
