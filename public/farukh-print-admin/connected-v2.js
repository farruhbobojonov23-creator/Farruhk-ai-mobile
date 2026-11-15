/* Connected FARUKH PRINT Premium V2. Main catalog comes from private Neon,
   authorized by the existing first-party owner PIN cookie on this host.
   No employee login migration, password reset, or production BT changes. */
const $=id=>document.getElementById(id);
let products=[],chosen=null,dirty=false,saving=false,saveTask=null,editVersion=0,loading=false;
let premium=null;
function note(id,message,type=''){
 const e=$(id);if(!e)return;e.textContent=message;e.dataset.type=type;
}
async function api(path,payload){
 const init={method:payload===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store'};
 if(payload!==undefined){init.headers={'Content-Type':'application/json'};init.body=JSON.stringify(payload)}
 const res=await fetch('/api/owner/'+path,init);
 let data;try{data=await res.json()}catch{throw Error('Некорректный ответ облака.')}
 if(!res.ok||data?.ok===false)throw Error(data?.error||'Ошибка '+res.status);
 return data;
}
function hideAll(){
 for(const name of ['catalog','staff','cloud','backup'])$('page-'+name).hidden=true;
}
function showPanel(name){
 hideAll();
 const p=$('page-'+name);if(p)p.hidden=false;
 if(name==='staff')void loadStaff();
 if(name==='cloud')void loadCloud();
 if(name==='backup')void loadArchives();
}
function initTheme(){
 const KEY='farukh-print-admin:theme:v1';
 const labels={neon:'Neon Premium',emerald:'White Emerald',beige:'Luxury Beige',gold:'Black Gold'};
 const nodes=Array.from(document.querySelectorAll('.premium-option'));
 const update=key=>{
  const k=Object.hasOwn(labels,key)?key:'neon';
  document.body.dataset.adminTheme=k;
  const title=$('premium-current-theme');if(title)title.textContent=labels[k];
  for(const n of nodes)n.setAttribute('aria-checked',String(n.dataset.theme===k));
  try{localStorage.setItem(KEY,k)}catch{}
 };
 let value='neon';try{value=localStorage.getItem(KEY)||'neon'}catch{}
 update(value);
 for(const n of nodes)n.addEventListener('click',()=>update(n.dataset.theme));
}
function listProducts(){
 const q=$('find-product').value.trim().toLocaleLowerCase('ru'),filter=$('kind-filter').value;
 return products.filter(p=>(filter==='all'||p.kind===filter)&&
  String(p.name).toLocaleLowerCase('ru').includes(q));
}
function drawList(){
 const box=$('catalog-list');box.replaceChildren();
 const shown=listProducts();
 if(!shown.length){const x=document.createElement('p');x.textContent='Товары не найдены.';box.append(x);return}
 const fragment=document.createDocumentFragment();
 for(const p of shown){
  const button=document.createElement('button');button.type='button';button.className=p.id===chosen?.id?'active':'';
  const thumbnail=document.createElement('img');
  thumbnail.alt='';thumbnail.loading='lazy';thumbnail.decoding='async';
  if(p.hasPhoto)thumbnail.src='/api/owner/db/photo/'+encodeURIComponent(p.id);
  else thumbnail.hidden=true;
  const container=document.createElement('span');
  const title=document.createElement('b');title.textContent=p.name;
  const small=document.createElement('small');small.textContent=(p.kind==='prep'?'ПФ':'Готовый')+' · '+(p.category||'Без категории');
  container.append(title,small);button.append(thumbnail,container);
  button.addEventListener('click',()=>pick(p));
  fragment.append(button);
 }
 box.append(fragment);
}
function pick(product){
 if(saving||dirty){note('save-note','Сначала дождись сохранения текущих изменений или нажми «Сохранить сейчас».','error');return}
 chosen=product;$('edit-form').hidden=false;
 for(const [key,value] of [
  ['product-name',product.name],['product-kind',product.kind],
  ['product-category',product.category||''],['product-composition',product.composition||''],
  ['product-storage',product.storage||''],['product-hours',product.hours??''],
  ['product-weight',product.weight??''],['product-tolerance',product.tolerance??''],
  ['product-unit',product.weightUnit||'г'],
  ['product-kcal',product.nutrition?.kcal??''],['product-p',product.nutrition?.p??''],
  ['product-f',product.nutrition?.f??''],['product-c',product.nutrition?.c??'']
 ])$(key).value=value;
 const photo=$('product-photo');photo.hidden=!product.hasPhoto;
 if(product.hasPhoto)photo.src='/api/owner/db/photo/'+encodeURIComponent(product.id);
 else photo.removeAttribute('src');
 note('save-note','✓ Карточка загружена из Neon','good');
 $('editor-state').textContent='✓ Облачная версия';
 drawList();void loadLabel();
}
// Read the complete product only for preview; never infer missing nutrition
// or mass from another product. Print approval and BT remain unchanged.
async function loadLabel(){
 if(!chosen)return;
 const id=chosen.id,root=$('label-live-sheet');
 root.replaceChildren();
 const caption=$('label-live-note');
 caption.textContent='Проверяю этикетку по данным Neon…';
 try{
  const response=await api('ops/labels/product/'+encodeURIComponent(id));
  if(chosen?.id!==id)return;
  const p=response.product,prep=p.kind==='prep';
  const fmt=prep?'30×20':'58×40';
  $('label-live-size').textContent=fmt+' мм';
  const render=prep?window.FarukhPremiumPrep:window.FarukhPremiumReady;
  if(!render||typeof render.draw!=='function')throw Error('Исходный шаблон не загрузился.');
  if(!p.name||!p.storage||!Number(p.hours))throw Error('Для макета нужны название, температура и срок хранения.');
  const n=p.nutrition||{};
  if(!prep&&(!p.composition||p.weight==null||p.tolerance==null))
    throw Error('Для оригинального 58×40 нужны состав, масса нетто и допустимое отклонение. Значения не подставляются автоматически.');
  const canvas=document.createElement('canvas');canvas.width=prep?240:464;canvas.height=prep?160:320;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Твой браузер не поддерживает холст печати.');
  render.draw(ctx,{
   name:p.name,kind:p.kind,category:p.category,composition:p.composition,
   storage:p.storage,hours:Number(p.hours),weight:p.weight,weightUnit:p.weightUnit,
   tolerance:p.tolerance,p:n.p,f:n.f,c:n.c,kcal:n.kcal
  },Date.now());
  root.append(canvas);
  const hasNutrition=['kcal','p','f','c'].every(k=>n[k]!==undefined&&n[k]!==null&&n[k]!=='');
  caption.textContent='✓ Оригинальный макет '+fmt+' мм'+(prep?'':hasNutrition?' · с КБЖУ':' · КБЖУ скрыто (нет данных)')+'. Предпросмотр не подтверждает печать на Bluetooth V3 BT.';
 }catch(error){
  if(chosen?.id!==id)return;
  const msg=document.createElement('div');msg.className='connected-state';msg.dataset.type='error';
  msg.textContent='⚠ '+(error.message||'Не удалось проверить данные этикетки.');
  root.replaceChildren(msg);
  caption.textContent='Макет не заменён упрощённой этикеткой: сперва нужны проверенные сведения.';
 }
}
function card(){
 return {id:chosen.id,updatedAt:chosen.updatedAt,
  name:$('product-name').value.trim(),kind:$('product-kind').value,
  category:$('product-category').value.trim(),
  composition:$('product-composition').value.trim(),
  storage:$('product-storage').value.trim(),
  hours:$('product-hours').value===''?null:Number($('product-hours').value),
  weight:$('product-weight').value===''?null:Number($('product-weight').value),
  tolerance:$('product-tolerance').value===''?null:Number($('product-tolerance').value),
  weightUnit:$('product-unit').value,
  nutrition:Object.fromEntries(['kcal','p','f','c'].map(k=>[k,
    $('product-'+k).value===''?null:Number($('product-'+k).value)]))};
}
function validate(p){
 if(!p.name||p.name.length>90)return 'Укажи название до 90 символов.';
 if(p.hours!==null&&(!Number.isInteger(p.hours)||p.hours<1||p.hours>8760))
  return 'Срок хранения — от 1 до 8760 часов.';
 if(p.weight!==null&&(!Number.isFinite(p.weight)||p.weight<=0||p.weight>100000))
  return 'Масса нетто должна быть положительным числом.';
 if(p.tolerance!==null&&(!Number.isFinite(p.tolerance)||p.tolerance<0||p.tolerance>10000))
  return 'Допуск массы должен быть неотрицательным.';
 if(Object.values(p.nutrition).some(v=>v!==null&&(!Number.isFinite(v)||v<0||v>1000)))
  return 'КБЖУ: допустимы только числа от 0 до 1000.';
 return '';
}
function edited(){
 if(!chosen)return;
 dirty=true;editVersion++;
 $('editor-state').textContent='● Изменено';
 note('save-note','Сохраняю автоматически через 1,5 секунды…');
 $('label-live-note').textContent='Макет относится к последней сохранённой версии; текущие правки ещё не сохранены.';
 clearTimeout(saveTask);
 if(!saving)saveTask=setTimeout(()=>void save(),1500);
}
async function save(){
 clearTimeout(saveTask);
 if(!chosen||saving||!dirty)return;
 const data=card(),error=validate(data);
 if(error){note('save-note',error,'error');return}
 const version=editVersion,chosenId=chosen.id;
 saving=true;$('save-product').disabled=true;note('save-note','Сохраняю в Neon…');
 try{
  const result=await api('db/save',data);
  // A newer field input may arrive while the request is running.
  Object.assign(chosen,data,{updatedAt:result.updatedAt});
  if(version===editVersion){
   dirty=false;
   $('editor-state').textContent='✓ Сохранено';
   note('save-note','✓ Сохранено в Neon. Товар требует повторного допуска к печати.','good');
  }else{
   $('editor-state').textContent='● Новое изменение';
   note('save-note','Первая версия сохранена, ожидает следующее изменение…');
  }
  drawList();void loadLabel();
 }catch(e){
  note('save-note','Не сохранено: '+e.message+' Нажми «Сохранить сейчас».','error');
 }finally{
  saving=false;$('save-product').disabled=false;
  if(dirty&&version!==editVersion&&chosen?.id===chosenId)saveTask=setTimeout(()=>void save(),1200);
 }
}
async function loadCatalog(){
 if(loading)return;
 if(saving){note('save-note','Дождись завершения сохранения.');return}
 if(dirty&&!window.confirm('Есть несохранённые изменения. Отменить их и обновить каталог?'))return;
 clearTimeout(saveTask);dirty=false;loading=true;
 note('connected-state','Загружаю каталог Neon…');
 try{
  const data=await api('db/catalog');
  products=data.products||[];
  $('catalog-count').textContent=products.length+' товаров';
  const previous=chosen?.id;chosen=null;$('edit-form').hidden=true;
  drawList();
  if(products.length)pick(products.find(x=>x.id===previous)||products[0]);
  note('connected-state','✓ Каталог Neon доступен: '+products.length+' товаров','good');
  window.FARUKH_PRINT_NEON_COUNT=products.length;
  premium?.refresh();
  const count=$('v2-product-count');
  if(count)count.textContent=String(products.length);

 }catch(e){note('connected-state','Каталог недоступен: '+e.message,'error')}
 finally{loading=false}
}
async function loadCloud(){
 try{
  const s=await api('db/status');
  for(const [id,key] of [['cloud-products','products'],['cloud-photos','photos'],['cloud-locations','locations'],['cloud-backups','backups']])
   $(id).textContent=String(s[key]??'—');
  note('cloud-note','✓ Neon подключён · версия базы '+s.target+' · ревизия '+s.revision,'good');
  note('connected-state','✓ Neon: '+s.products+' товаров · '+s.photos+' фотографий','good');
 }catch(e){note('cloud-note','Облако недоступно: '+e.message,'error')}
}
async function loadStaff(){
 try{
  const [summary,loc]=await Promise.all([api('ops/summary'),api('ops/locations')]);
  for(const [id,key] of [['staff-new','staff'],['devices-new','devices'],['staff-pending','pending'],['staff-events','events']])
   $(id).textContent=String(summary[key]??'—');
  const area=$('staff-locations');area.replaceChildren();
  for(const x of loc.locations||[]){
   const div=document.createElement('div'),title=document.createElement('span'),stat=document.createElement('strong');
   title.textContent=x.name;stat.textContent=x.active?'✓ Настроена':'Отключена';
   div.append(title,stat);area.append(div);
  }
  note('legacy-staff-note','✓ Данные Neon загружены. Старые учётные записи обслуживает прежний шлюз сотрудников.','good');
 }catch(e){note('legacy-staff-note','Не удалось проверить новый контур сотрудников: '+e.message,'error')}
}

async function createItem(){
 if(dirty||saving){note('save-note','Сначала сохрани изменения в открытой карточке.','error');return}
 const name=window.prompt('Название нового товара в тестовой копии:', '');
 if(name===null||!name.trim())return;
 const prep=window.confirm('Это полуфабрикат (ПФ)?\nОК — ПФ, Отмена — готовый товар.');
 const button=$('create-item');button.disabled=true;
 try{
  const q=await api('db/create',{name:name.trim(),kind:prep?'prep':'ready'});
  chosen={id:q.id};await loadCatalog();await loadCloud();
  note('save-note','✓ Товар создан только в тестовой базе. Заполни состав, срок, условия и массу.','good');
  $('edit-form').scrollIntoView({behavior:'smooth',block:'nearest'});
 }catch(e){note('connected-state','Не удалось создать товар: '+e.message,'error')}
 finally{button.disabled=false}
}
async function archiveItem(){
 if(!chosen)return;
 if(dirty||saving)return note('save-note','Сначала сохрани изменения в текущей карточке.','error');
 if(!window.confirm('Перенести «'+chosen.name+'» в архив тестовой копии?\nРабочие товары сотрудников не изменятся.'))return;
 const button=$('archive-item');button.disabled=true;
 try{
  await api('db/archive',{id:chosen.id});
  chosen=null;await loadCatalog();await loadCloud();await loadArchives();
  note('connected-state','✓ Товар перенесён в архив тестовой базы. Его можно восстановить в «Настройках».','good');
 }catch(e){note('save-note',e.message,'error')}
 finally{button.disabled=false}
}
async function loadArchives(){
 const host=$('archive-list');host.replaceChildren();
 try{
  const result=await api('db/archive');
  if(!result.products?.length){
   const row=document.createElement('div');row.textContent='Архив пуст.';host.append(row);return;
  }
  for(const p of result.products){
   const row=document.createElement('div'),left=document.createElement('span'),right=document.createElement('button');
   left.textContent=p.name+' · '+(p.kind==='prep'?'ПФ':'Готовый');
   right.type='button';right.textContent='Восстановить';
   right.className='connected-restore';
   right.addEventListener('click',async()=>{
    if(!window.confirm('Восстановить «'+p.name+'» в тестовой каталог?'))return;
    right.disabled=true;
    try{await api('db/restore',{id:p.id});chosen={id:p.id};await loadCatalog();await loadCloud();await loadArchives();}
    catch(e){note('connected-state','Ошибка восстановления: '+e.message,'error')}
    finally{right.disabled=false}
   });
   row.append(left,right);host.append(row);
  }
 }catch(e){const row=document.createElement('div');row.textContent='Архив недоступен: '+e.message;host.append(row)}
}
async function optimizePhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Нужен PNG, JPG или WebP.');
 if(file.size<=1000000)return file;
 const url=URL.createObjectURL(file),img=new Image();
 try{
  img.src=url;
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Изображение не открылось.'))});
  const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Не удалось обработать изображение.');
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.88));
  if(blob&&blob.size>1040000)blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.72));
  if(!blob||blob.size>1040000)throw Error('Фото слишком большое. Попробуй изображение меньше 1 МБ.');
  return blob;
 }finally{URL.revokeObjectURL(url)}
}
async function uploadPhoto(){
 if(!chosen)return;
 if(dirty||saving)return note('save-note','Дождись сохранения карточки перед загрузкой фото.','error');
 const file=$('photo-file').files?.[0];if(!file)return note('save-note','Сначала выбери фотографию.','error');
 const button=$('photo-upload');button.disabled=true;note('save-note','Подготавливаю фотографию…');
 try{
  const blob=await optimizePhoto(file);
  if(blob.size>1040000)throw Error('Фото превышает лимит 1 МБ.');
  const data=await new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');
   reader.onerror=()=>reject(Error('Не получилось прочитать файл.'));
   reader.readAsDataURL(blob);
  });
  note('save-note','Сохраняю фотографию в тестовый Neon…');
  const result=await api('db/photo-upload',{id:chosen.id,mime:blob.type,base64:data});
  const id=chosen.id;chosen={id};$('photo-file').value='';
  await loadCatalog();await loadCloud();
  note('save-note','✓ Фото сохранено в тестовой базе: '+Math.ceil(result.bytes/1024)+' КБ.','good');
 }catch(e){note('save-note','Не удалось загрузить фото: '+e.message,'error')}
 finally{button.disabled=false}
}

function attach(){
 $('pin-form').addEventListener('submit',async e=>{
  e.preventDefault();$('enter').disabled=true;
  note('auth-note','Проверяю код владельца…');
  try{
   await api('pin',{pin:$('pin-code').value});
   $('pin-code').value='';await enter();
  }catch(err){note('auth-note',err.message,'error')}
  finally{$('enter').disabled=false}
 });
 $('logout').addEventListener('click',async()=>{
  if(dirty&&!window.confirm('Есть несохранённые изменения. Выйти?'))return;
  clearTimeout(saveTask);dirty=false;
  try{await api('logout',{})}catch{}
  $('connected-app').hidden=true;$('auth-box').hidden=false;hideAll();
  note('auth-note','Сеанс завершён.','good');
 });
 $('reload-all').addEventListener('click',()=>{void loadCloud();void loadCatalog()});
 $('refresh-cloud').addEventListener('click',()=>void loadCloud());
 $('create-item').addEventListener('click',()=>void createItem());
 $('archive-item').addEventListener('click',()=>void archiveItem());
 $('archive-refresh').addEventListener('click',()=>void loadArchives());
 $('photo-upload').addEventListener('click',()=>void uploadPhoto());
 $('find-product').addEventListener('input',drawList);
 $('kind-filter').addEventListener('change',drawList);
 $('edit-form').addEventListener('submit',e=>{e.preventDefault();void save()});
 for(const key of ['product-name','product-category','product-composition','product-storage','product-hours','product-weight','product-tolerance','product-kcal','product-p','product-f','product-c'])
  $(key).addEventListener('input',edited);
 $('product-kind').addEventListener('change',edited);
 $('product-unit').addEventListener('change',edited);
 for(const tab of document.querySelectorAll('.pc-workspace-tab'))
  tab.addEventListener('click',()=>showPanel(tab.dataset.workspace));
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
 // Existing label cards navigate to the real catalog, not a non-existent mock editor.
 document.addEventListener('click',e=>{
  const card=e.target.closest?.('[data-v2-action="ready"],[data-v2-action="prep"]');
  if(!card)return;
  e.stopImmediatePropagation();
  premium?.navigate('catalog');
  note('save-note','Предпросмотр оригинального макета находится под карточкой товара. Физическую печать на V3 BT ещё нужно проверить.');
  setTimeout(()=>$('label-live')?.scrollIntoView({behavior:'smooth',block:'nearest'}),150);
 },true);
}
async function enter(){
 $('auth-box').hidden=true;$('connected-app').hidden=false;
 if(!premium){
  const mod=await import('/farukh-print-admin/premium-v2.js?v=2');
  premium=mod.mountPremiumV2({root:$('print-control-root'),main:$('print-control')});
  const tag=document.querySelector('.v2-hero-tag');
  if(tag)tag.textContent='🧪 Тестовая копия Neon · сотрудники и Bluetooth-печать не изменены';
  const notice=document.querySelector('.v2-section-title .v2-micro-tag');
  if(notice)notice.textContent='Данные проверяются в Neon';

  const cards=Array.from(document.querySelectorAll('.v2-kpi'));
  if(cards[3]){
   const k=cards[3].querySelector('small'),em=cards[3].querySelector('em');
   if(k)k.textContent='Товаров доступно';
   if(em)em.textContent='Прямое редактирование в Neon';
  }

 }
 hideAll();
 await Promise.all([loadCatalog(),loadCloud()]);
}
async function start(){
 initTheme();attach();
 try{
  const session=await api('session');
  if(session.authorized)await enter();
  else note('auth-note','Введи код владельца для доступа к Neon.','good');
 }catch(e){note('auth-note','Сервис временно недоступен: '+e.message,'error')}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
