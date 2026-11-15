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
  ['product-storage',product.storage||''],['product-hours',product.hours??'']
 ])$(key).value=value;
 const photo=$('product-photo');photo.hidden=!product.hasPhoto;
 if(product.hasPhoto)photo.src='/api/owner/db/photo/'+encodeURIComponent(product.id);
 else photo.removeAttribute('src');
 note('save-note','✓ Карточка загружена из Neon','good');
 $('editor-state').textContent='✓ Облачная версия';
 drawList();
}
function card(){
 return {id:chosen.id,updatedAt:chosen.updatedAt,
  name:$('product-name').value.trim(),kind:$('product-kind').value,
  category:$('product-category').value.trim(),
  composition:$('product-composition').value.trim(),
  storage:$('product-storage').value.trim(),
  hours:$('product-hours').value===''?null:Number($('product-hours').value)};
}
function validate(p){
 if(!p.name||p.name.length>90)return 'Укажи название до 90 символов.';
 if(p.hours!==null&&(!Number.isInteger(p.hours)||p.hours<1||p.hours>8760))
  return 'Срок хранения — от 1 до 8760 часов.';
 return '';
}
function edited(){
 if(!chosen)return;
 dirty=true;editVersion++;
 $('editor-state').textContent='● Изменено';
 note('save-note','Сохраняю автоматически через 1,5 секунды…');
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
  drawList();
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
  premium?.refresh();
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
 $('find-product').addEventListener('input',drawList);
 $('kind-filter').addEventListener('change',drawList);
 $('edit-form').addEventListener('submit',e=>{e.preventDefault();void save()});
 for(const key of ['product-name','product-category','product-composition','product-storage','product-hours'])
  $(key).addEventListener('input',edited);
 $('product-kind').addEventListener('change',edited);
 for(const tab of document.querySelectorAll('.pc-workspace-tab'))
  tab.addEventListener('click',()=>showPanel(tab.dataset.workspace));
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
 // Existing label cards navigate to the real catalog, not a non-existent mock editor.
 document.addEventListener('click',e=>{
  const card=e.target.closest?.('[data-v2-action="ready"],[data-v2-action="prep"]');
  if(!card)return;
  e.stopImmediatePropagation();
  premium?.navigate('catalog');
  note('save-note','Шаблоны 58×40 и 30×20 требуют проверки состава, массы и печати на V3 BT.');
 },true);
}
async function enter(){
 $('auth-box').hidden=true;$('connected-app').hidden=false;
 if(!premium){
  const mod=await import('/farukh-print-admin/premium-v2.js?v=2');
  premium=mod.mountPremiumV2({root:$('print-control-root'),main:$('print-control')});
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
