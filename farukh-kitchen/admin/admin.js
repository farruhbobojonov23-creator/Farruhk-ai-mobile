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
function changeView(name){document.querySelectorAll('[data-view]').forEach(e=>e.classList.toggle('hidden',e.dataset.view!==name));document.querySelectorAll('[data-panel]').forEach(e=>e.classList.toggle('active',e.dataset.panel===name));window.scrollTo({top:0,behavior:'smooth'});if(name==='requests')loadRequests();if(name==='documents')loadRecipes();if(name!=='requests')clearCredentials();if(name==='buyers')loadBuyers();}
document.querySelectorAll('[data-panel]').forEach(btn=>btn.addEventListener('click',()=>changeView(btn.dataset.panel)));
document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>changeView(btn.dataset.go)));
async function signout(){clearCredentials();await sb.auth.signOut();currentUser=null;show('app',false);show('denyBox',false);show('loginBox',true);$('ownerIdentity').textContent='';show('logout',false);}
$('logout').addEventListener('click',signout);$('denyLogout').addEventListener('click',signout);
async function boot(){
 const {data:{user},error}=await sb.auth.getUser();
 if(error||!user){show('loginBox',true);show('app',false);show('denyBox',false);show('logout',false);return}
 const {data:owner,error:ownerErr}=await sb.from('fk_admins').select('user_id').eq('user_id',user.id).maybeSingle();
 if(ownerErr||!owner){show('loginBox',false);show('app',false);show('denyBox',true);show('logout',true);return}
 currentUser=user;
 $('ownerIdentity').textContent=user.email||'Владелец';
 show('loginBox',false);show('denyBox',false);show('app',true);show('logout',true);
 try{await Promise.all([loadRecipes(),loadSettings(),loadRequests(),loadBuyers(),loadStats()]);}
 catch(e){err(e,'Не удалось загрузить данные панели')}
 applyRoute();
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
 try{const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+'/admin/',shouldCreateUser:false}});if(error)throw error;toast('Проверь почту. Если ссылка не открывается, используй переход по скопированной ссылке.')}
 catch(e){err(e,'Письмо не отправлено')}finally{$('otpBtn').disabled=false}
});
function recipeCode(r){return (plain(r.notes).match(/(?:FK-A4|ТТК-ПФ)-\d{3}/)||[])[0]||''}
async function loadRecipes(){
 const {data,error}=await sb.from('fk_recipes').select('id,kind,title,category,status,yield_g,storage_conditions,shelf_life_minutes,notes,pdf_pending_since,pdf_published_at').order('title',{ascending:true}).limit(150);
 if(error)throw error;
 recipes=data||[];
 const opts=recipes.map(r=>({id:r.id,label:(recipeCode(r)||r.kind)+' · '+r.title}));
 const list=$('recipeSelect'),photo=$('photoRecipe');
 list.replaceChildren();photo.replaceChildren();
 for(const o of opts){const x=new Option(o.label,o.id);list.add(x);photo.add(new Option(o.label,o.id))}
 if(recipes.length){list.value=selectedRecipe&&recipes.some(r=>r.id===selectedRecipe.id)?selectedRecipe.id:recipes[0].id;await selectRecipe(list.value);await loadPhotoPreview()}
 $('metricRecipes').textContent=recipes.length;
 $('metricPreps').textContent=recipes.filter(r=>r.kind==='prep').length;
 $('metricReview').textContent=recipes.filter(r=>r.status==='review').length;renderPending();
}
$('recipeSearch').addEventListener('input',()=>{
 const q=$('recipeSearch').value.toLocaleLowerCase('ru').trim();
 for(const o of $('recipeSelect').options){const v=o.textContent.toLocaleLowerCase('ru');o.hidden=!!q&&!v.includes(q)}
 const match=Array.from($('recipeSelect').options).find(o=>!o.hidden);
 if(match&&match.value!==$('recipeSelect').value){$('recipeSelect').value=match.value;selectRecipe(match.value)}
});
$('recipeSelect').addEventListener('change',ev=>selectRecipe(ev.target.value));
async function selectRecipe(id){
 const r=recipes.find(x=>x.id===id);selectedRecipe=r;if(!r)return;showPdfStatus(r);
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
 await refreshPdfState(selectedRecipe.id);Object.assign(selectedRecipe,payload);
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
    const {error}=await sb.from('fk_ingredients').update(payload).eq('id',i.id).eq('recipe_id',selectedRecipe.id);if(error)throw error;await refreshPdfState(selectedRecipe.id);toast('Ингредиент сохранён')}
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
   try{const {error}=await sb.from('fk_steps').update({instruction:area.value.trim()}).eq('id',x.id).eq('recipe_id',selectedRecipe.id);if(error)throw error;await refreshPdfState(selectedRecipe.id);toast('Технологический этап обновлён')}
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
 $('premiumMaterials').value=settings.premium_materials||'59 ТТК готовых блюд, 34 ТТК полуфабрикатов и 59 инструкций по приготовлению. Цифровой доступ к приобретённой редакции после подтверждения оплаты.';
 $('premiumServices').value=settings.premium_services||'До пяти поваров, три рабочих дня до восьми часов каждый. Практика по заранее согласованному меню и последовательности обучения.';
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
  const [start,pro]=await Promise.all([
   sb.from('fk_packages').update({price_rub:prices.price_start}).eq('title','SHEF START'),
   sb.from('fk_packages').update({price_rub:prices.price_pro}).eq('title','SHEF PRO')
  ]);
  if(start.error||pro.error)throw start.error||pro.error;
  await saveSettings(prices);
  toast('Цены обновлены на сайте и в пакетах START/PRO. Проверь публичные страницы перед продажей.');
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
 const [rows,paid,accounts]=await Promise.all([
  sb.from('fk_access_requests').select('id,buyer_user_id,customer_name,contact_type,contact_value,package_code,service_type,business_city,business_name,business_problem,service_format,project_city,project_business,project_goal,status,owner_note,created_at').order('created_at',{ascending:false}),
  sb.from('fk_confirmed_sales').select('request_id'),
  sb.from('fk_owner_customer_overview').select('user_id,request_id')
 ]);
 if(rows.error||paid.error||accounts.error){err(rows.error||paid.error||accounts.error,'Заявки недоступны');return}
 const ids=new Set(paid.data.map(x=>x.request_id));
 const linked=new Map(accounts.data.map(a=>[a.request_id,a.user_id]));
 requests=rows.data.map(r=>({...r,buyer_user_id:r.buyer_user_id||linked.get(r.id),paid:ids.has(r.id)}));
 $('newCount').textContent=requests.filter(r=>r.status==='new').length;
 $('paidCount').textContent=requests.filter(pendingSale).length;
 $('metricRequests').textContent=requests.length;
 const newCount=requests.filter(x=>x.status==='new').length;
 $('requestsBadge').textContent=newCount?' · '+newCount:'';
 renderRequests();
}
$('reloadRequests').addEventListener('click',loadRequests);
function renderRequests(){
 const root=$('requestsList');root.replaceChildren();
 if(!requests.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='Заявок пока нет.';root.append(empty);return}
 const scope=$('requestScope').value;
 const visible=requests.filter(r=>scope==='paid'?pendingSale(r):scope==='new'?r.status==='new':true);
 if(!visible.length)root.append(crmText('p','muted','По этому фильтру заявок нет.'));
 for(const r of visible){
  const item=document.createElement('div');item.className='request';item.id='request-'+r.id;
  const head=document.createElement('div');head.className='request-head';
  const title=document.createElement('strong');title.textContent=r.customer_name+' · '+(r.package_code==='consulting'?'CHEF AKA / ШЕФ НА ВЫЕЗД':'SHEF '+r.package_code.toUpperCase());
  const created=document.createElement('small');created.textContent=date(r.created_at);
  head.append(title,created);
  const contact=document.createElement('p');contact.textContent=(r.contact_type==='telegram'?'Telegram: ':'Телефон: ')+r.contact_value;
  if(r.package_code==='consulting'){
   const serviceNames={online:'Онлайн-разбор',audit:'Аудит кухни',mentoring:'Обучение и сопровождение',launch:'Запуск доставки с нуля',training:'Обучение персонала',ttk:'Улучшение ТТК',optimization:'Оптимизация кухни'};
   const details=document.createElement('p');details.style.whiteSpace='pre-wrap';details.style.overflowWrap='anywhere';
   const format=r.service_format||r.service_type;
   const city=r.project_city||r.business_city||'—';
   const business=r.project_business||r.business_name||'';
   const goal=r.project_goal||r.business_problem||'—';
   details.textContent='Услуга: '+(serviceNames[format]||'Консультация')+' · Город: '+city+(business?' · Заведение: '+business:'')+'\nЗадача: '+goal;
   item.append(details);
  }
  const controls=document.createElement('div');controls.className='row';
  const statusL=document.createElement('label');statusL.textContent='Статус';const sel=document.createElement('select');
  for(const [key,label] of [['new','Новая'],['contacted','Связались'],['completed','Завершена'],['dismissed','Закрыта']])sel.add(new Option(label,key));
  if(r.package_code!=='consulting'){
   const completed=Array.from(sel.options).find(o=>o.value==='completed');
   if(r.status==='completed')completed.textContent=r.buyer_user_id?'Доступ выдан':'Завершена';else completed.remove();
  }
  if(r.buyer_user_id&&r.status!=='completed')sel.add(new Option('Доступ выдан','issued'));
  sel.value=r.buyer_user_id&&r.status!=='completed'?'issued':r.status;sel.disabled=Boolean(r.buyer_user_id)||r.paid;statusL.append(sel);
  const noteL=document.createElement('label');noteL.textContent='Заметка владельца';const note=document.createElement('input');note.value=r.owner_note||'';note.maxLength=500;noteL.append(note);controls.append(statusL,noteL);
  const btn=document.createElement('button');btn.type='button';btn.className='btn ghost';btn.textContent='Сохранить заявку';btn.addEventListener('click',async()=>{
   btn.disabled=true;try{
    const {error}=await sb.from('fk_access_requests').update({status:sel.disabled?r.status:sel.value,owner_note:note.value.trim(),updated_at:new Date().toISOString()}).eq('id',r.id).eq('status',r.status).select('id').single();
    if(error)throw error;toast('Заявка обновлена');await loadRequests();
    $('requestsBadge').textContent=(requests.filter(x=>x.status==='new').length||'')?' · '+requests.filter(x=>x.status==='new').length:'';
   }catch(e){err(e,'Не удалось изменить заявку')}finally{btn.disabled=false}
  });
  item.append(head,contact,controls,btn);appendSaleActions(item,r);root.append(item);
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


let crmBuyers=[],crmProfiles=new Map();
function crmDate(v){if(!v)return 'Не указана';const d=new Date(v);return Number.isNaN(d.getTime())?'Не указана':d.toLocaleDateString('ru-RU')}
function crmText(tag,cls,value){const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=String(value??'');return el}
function crmState(r){if(['revoked','blocked'].includes(r.access_status))return 'revoked';if(r.expires_at&&new Date(r.expires_at)<new Date())return 'expired';return r.access_status==='active'?'active':'missing'}
function renderBuyers(){
 const root=$('buyerList');root.replaceChildren();let shown=0;
 const query=$('buyerSearch').value.trim().toLocaleLowerCase('ru-RU'),filter=$('buyerFilter').value;
 for(const r of crmBuyers){
  const p=crmProfiles.get(r.user_id)||{},state=crmState(r),name=p.customer_name||r.buyer_name||r.login,company=p.company_name||r.company_name||'Не указана';
  if(filter==='expiring'?!expiring(r):filter!=='all'&&filter!==state)continue;
  if(![name,company,p.contact,r.contact_value,r.login,r.package_code].join(' ').toLocaleLowerCase('ru-RU').includes(query))continue;
  shown++;
  const card=crmText('article','crm-card','');card.id='buyer-'+r.user_id;
  const head=crmText('div','crm-head','');head.append(crmText('h3','',name),crmText('span','crm-status '+state,{active:'Активен',expired:'Истёк',revoked:'Заблокирован',missing:'Нет доступа'}[state]));card.append(head);
  const grid=crmText('div','crm-grid','');
  for(const [label,value] of [['Компания',company],['Логин',r.login],['Пакет','SHEF '+String(r.package_code||'—').toUpperCase()],['Контакт',p.contact||r.contact_value||'Не указан'],['Дата покупки',crmDate(p.purchase_date||r.purchased_at)],['Доступ до',r.expires_at?crmDate(r.expires_at):(state==='active'?'Бессрочно':'Не указан')],['Создан',crmDate(r.account_created_at)],['Сумма',p.sale_amount_rub==null?'Не указана':Number(p.sale_amount_rub).toLocaleString('ru-RU')+' ₽']]){
   const cell=crmText('div','crm-field','');cell.append(crmText('small','',label),crmText('strong','',value));grid.append(cell);
  }
  card.append(grid);
  const actions=crmText('div','actions','');
  const edit=crmText('button','btn ghost','Изменить данные');edit.type='button';
  const form=document.createElement('form');form.className='crm-form hidden';
  const fields=[['customer_name','Имя покупателя',p.customer_name||r.buyer_name||''],['company_name','Компания',p.company_name||r.company_name||''],['contact','Контакт',p.contact||r.contact_value||''],['purchase_date','Дата покупки',p.purchase_date||''],['sale_amount_rub','Сумма покупки, ₽',p.sale_amount_rub??''],['owner_note','Заметка',p.owner_note||'']];
  for(const [key,label,value] of fields){const l=document.createElement('label');l.textContent=label;const input=document.createElement('input');input.name=key;input.type=key==='purchase_date'?'date':key==='sale_amount_rub'?'number':'text';input.value=String(value);if(key==='sale_amount_rub'){input.min='0';input.max='100000000';input.step='0.01'}l.append(input);form.append(l)}
  const save=crmText('button','btn primary','Сохранить');save.type='submit';form.append(save);
  form.addEventListener('submit',async e=>{
   e.preventDefault();save.disabled=true;
   const get=k=>form.elements.namedItem(k).value.trim();
   const data={user_id:r.user_id,customer_name:get('customer_name')||null,company_name:get('company_name')||null,contact:get('contact')||null,purchase_date:get('purchase_date')||null,sale_amount_rub:get('sale_amount_rub')===''?null:Number(get('sale_amount_rub')),owner_note:get('owner_note')||null,updated_at:new Date().toISOString()};
   try{const {error}=await sb.from('fk_buyer_profiles').upsert(data,{onConflict:'user_id'});if(error)throw error;toast('Карточка сохранена');await loadBuyers()}
   catch(e){err(e,'Не удалось сохранить покупателя')}finally{save.disabled=false}
  });
  edit.addEventListener('click',()=>form.classList.toggle('hidden'));actions.append(edit);
  const access=document.createElement('a');access.className='btn ghost';access.href='../owner-library.html#buyers';access.target='_blank';access.rel='noopener noreferrer';access.textContent='Управление доступом ↗';actions.append(access);
  card.append(actions,form);root.append(card);
 }
 $('buyerSummary').textContent='Показано: '+shown+' из '+crmBuyers.length;
 if(!shown)root.append(crmText('p','muted',crmBuyers.length?'По фильтру ничего не найдено.':'Покупателей пока нет.'));
}
async function loadBuyers(){
 if(!currentUser)return;
 $('buyerSummary').textContent='Загружаю покупателей…';
 const [a,b]=await Promise.all([sb.from('fk_owner_customer_overview').select('login,user_id,package_code,account_created_at,buyer_name,company_name,contact_value,access_status,purchased_at,expires_at').order('account_created_at',{ascending:false}).limit(300),sb.from('fk_buyer_profiles').select('user_id,customer_name,company_name,contact,purchase_date,sale_amount_rub,owner_note').limit(300)]);
 if(a.error||b.error){err(a.error||b.error,'Покупатели недоступны');$('buyerSummary').textContent='Ошибка загрузки';return}
 crmBuyers=a.data||[];$('expiryCount').textContent=crmBuyers.filter(expiring).length;crmProfiles=new Map((b.data||[]).map(p=>[p.user_id,p]));renderBuyers();
}
$('buyerSearch').addEventListener('input',renderBuyers);
$('buyerFilter').addEventListener('change',renderBuyers);
$('buyerRefresh').addEventListener('click',loadBuyers);

function showPdfStatus(recipe){
 const state=$('recipePdfState');
 state.textContent=recipe.pdf_pending_since?'PDF требует обновления':recipe.pdf_published_at?'PDF подтверждён '+date(recipe.pdf_published_at):'';
 state.hidden=!state.textContent;
}
async function refreshPdfState(id){
 const {data,error}=await sb.from('fk_recipes').select('pdf_pending_since,pdf_published_at').eq('id',id).single();
 if(error)throw error;
 const recipe=recipes.find(r=>r.id===id);
 if(recipe){Object.assign(recipe,data);if(selectedRecipe?.id===id)showPdfStatus(recipe)}
 renderPending();
}
function renderPending(){
 const list=$('pendingList');list.replaceChildren();
 const pending=recipes.filter(r=>r.pdf_pending_since);
 if(!pending.length)list.append(crmText('p','muted','Все изменения учтены.'));
 for(const r of pending){
  const row=crmText('div','request','');
  row.append(crmText('strong','',r.title),crmText('p','muted','PDF требует обновления · '+date(r.pdf_pending_since)));
  const revision=r.pdf_pending_since;
  row.append(action('Подтвердить обновление PDF',async()=>{
   if(!confirm('Вы заменили PDF текущего выпуска и сверили карту «'+r.title+'» в опубликованном файле?'))return;
   const {error}=await sb.from('fk_recipes').update({pdf_pending_since:null,pdf_published_at:new Date().toISOString()})
    .eq('id',r.id).eq('pdf_pending_since',revision).select('id').single();
   if(error)throw Error('Карта изменилась или недоступна. Обновите список и проверьте выпуск ещё раз.');
   await refreshPdfState(r.id);
  }));list.append(row);
 }
 const latest=recipes.filter(r=>r.pdf_published_at).map(r=>r.pdf_published_at).sort().at(-1);
 if(latest)list.prepend(crmText('p','muted','Последнее подтверждение выпуска: '+date(latest)));
}
$('premiumForm').addEventListener('submit',async e=>{
 e.preventDefault();const btn=e.submitter;btn.disabled=true;
 try{await saveSettings({premium_materials:$('premiumMaterials').value.trim(),premium_services:$('premiumServices').value.trim()});toast('Состав PREMIUM опубликован.')}
 catch(e){err(e,'Не удалось сохранить PREMIUM')}finally{btn.disabled=false}
});
function action(label,run){
 const btn=crmText('button','btn ghost',label);btn.type='button';
 btn.addEventListener('click',async()=>{btn.disabled=true;try{await run()}catch(e){err(e,label)}finally{btn.disabled=false}});
 return btn;
}
function pendingSale(r){return r.paid&&!r.buyer_user_id&&['new','contacted'].includes(r.status)}
function expiring(r){
 const left=Date.parse(r.expires_at)-Date.now();
 return r.access_status==='active'&&left>=0&&left<=7*86400000;
}
function clearCredentials(){$('issueCredentials').value='';show('issueResult',false)}
$('hideCredentials').addEventListener('click',clearCredentials);
$('requestScope').addEventListener('change',renderRequests);
function appendSaleActions(item,r){
 const box=crmText('div','actions','');
 const sale=['start','pro','premium'].includes(r.package_code);
 if(r.buyer_user_id){
  box.append(action('Открыть покупателя',()=>openBuyer(r.buyer_user_id)));
 }else if(sale&&['new','contacted'].includes(r.status)){
  if(!r.paid){
   box.append(action('Подтвердить оплату',async()=>{
    if(!confirm('Полная оплата от '+r.customer_name+' за SHEF '+r.package_code.toUpperCase()+' получена и проверена?'))return;
    const {error}=await sb.from('fk_confirmed_sales').insert({request_id:r.id});
    if(error&&error.code!=='23505')throw error;
    await loadRequests();
   }));
  }else{
   box.append(crmText('strong','','Оплата подтверждена'));
   const expiry=document.createElement('input');expiry.type='date';
   const label=crmText('label','','Доступ до (необязательно)');label.append(expiry);box.append(label);
   box.append(action('Выдать доступ',async()=>{
    if(expiry.value&&expiry.value<new Date().toLocaleDateString('sv-SE'))throw Error('Срок доступа уже истёк');
    const {data,error}=await sb.functions.invoke('fk-owner-create-buyer',{body:{action:'create',request_id:r.id,confirmed_paid:true,expires_on:expiry.value||null}});
    if(error||!data?.ok){await loadRequests();throw Error(data?.error||error?.message||'Не удалось выдать доступ')}
    $('issueCredentials').value=['Сайт: '+location.origin+'/cabinet.html','Логин: '+data.login,'Пароль: '+data.password].join('\n');
    show('issueResult',true);$('issueResult').scrollIntoView({block:'center'});
    await loadRequests();await loadBuyers();
   }));
  }
 }else if(r.package_code==='consulting')box.append(crmText('p','muted','Консультация · доступ к ТТК не требуется'));
 if(!r.paid&&!r.buyer_user_id&&(r.status!=='completed'||r.package_code==='consulting')){
  const menu=document.createElement('details');menu.append(crmText('summary','','Действия'));
  menu.append(action('Удалить тестовую заявку',async()=>{
   if(!confirm('Удалить тестовую заявку «'+r.customer_name+'» без восстановления?'))return;
   const {error}=await sb.from('fk_access_requests').delete().eq('id',r.id).eq('status',r.status).is('buyer_user_id',null).select('id').single();
   if(error)throw Error('Заявка изменилась, оплачена или недоступна. Обновите список.');
   await loadRequests();toast('Тестовая заявка удалена');
  }));box.append(menu);
 }
 item.append(box);
}
async function openBuyer(id){
 changeView('buyers');$('buyerFilter').value='all';$('buyerSearch').value='';
 await loadBuyers();const card=$('buyer-'+id);
 if(card){card.scrollIntoView({block:'center'});card.tabIndex=-1;card.focus({preventScroll:true})}
 else toast('Карточка покупателя недоступна. Обновите список.',true);
}
async function applyRoute(){
 const route=location.hash.slice(1);
 if(['paid','new'].includes(route)){changeView('requests');$('requestScope').value=route;renderRequests()}
 else if(route==='expiring'){changeView('buyers');$('buyerFilter').value='expiring';renderBuyers()}
 else if(route==='documents'){changeView('documents')}
 else if(route.startsWith('buyer/'))await openBuyer(route.slice(6));
 else if(route.startsWith('request/')){
  changeView('requests');$('requestScope').value='all';await loadRequests();
  const row=$('request-'+route.slice(8));if(row)row.scrollIntoView({block:'center'});
 }
}
document.querySelectorAll('[data-queue]').forEach(btn=>btn.addEventListener('click',()=>{
 const key=btn.dataset.queue;if(location.hash==='#'+key)applyRoute();else location.hash=key;
}));
window.addEventListener('hashchange',()=>{if(currentUser)applyRoute()});
boot().catch(e=>err(e,'Ошибка инициализации'));
