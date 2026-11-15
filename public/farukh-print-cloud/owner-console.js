/* FARUKH PRINT owner console — cloud catalog + PIN-only entry.
   No PIN, database connection string or other credential in the browser. */
const $=id=>document.getElementById(id);
let products=[],selected=null,dirty=false,saving=false,saveTimer=null,editVersion=0,loading=false;
async function api(path,payload){
 const req={method:payload===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store'};
 if(payload!==undefined){req.headers={'Content-Type':'application/json'};req.body=JSON.stringify(payload);}
 const r=await fetch('/api/owner/'+path,req);
 let data={};try{data=await r.json()}catch{throw Error('Неверный ответ облака.')}
 if(!r.ok||data.ok===false)throw Error(data.error||'Ошибка соединения: '+r.status);
 return data;
}
function show(which){for(const x of ['loading','entry','dashboard'])$(x).hidden=x!==which;}
function note(text,type=''){$('login-note').textContent=text;$('login-note').dataset.type=type;}
function ownerNote(text,type=''){$('owner-note').textContent=text;$('owner-note').dataset.type=type;}
function saveNote(text,type=''){$('cloud-save-note').textContent=text;$('cloud-save-note').dataset.type=type;}
function filterProducts(){
 const q=$('product-search').value.trim().toLocaleLowerCase('ru');
 const kind=$('product-kind').value;
 return products.filter(p=>(kind==='all'||p.kind===kind)&&
  (p.name||'').toLocaleLowerCase('ru').includes(q));
}
function renderList(){
 const el=$('product-list');el.replaceChildren();
 const rows=filterProducts();
 if(!rows.length){const p=document.createElement('p');p.textContent='Товары не найдены.';el.append(p);return}
 const frag=document.createDocumentFragment();
 for(const p of rows){
  const btn=document.createElement('button');btn.type='button';btn.className='product-line'+(selected?.id===p.id?' active':'');
  const icon=document.createElement('div');icon.className='thumb';icon.style.display='grid';icon.style.placeItems='center';
  icon.textContent=p.hasPhoto?'🖼️':'📦';
  const body=document.createElement('span');
  const title=document.createElement('strong');title.textContent=p.name;
  const small=document.createElement('small');small.textContent=(p.kind==='prep'?'ПФ':'Готовый')+' · '+(p.category||'Без категории');
  body.append(title,small);btn.append(icon,body);
  btn.addEventListener('click',()=>selectProduct(p));
  frag.append(btn);
 }
 el.append(frag);
}
function selectProduct(p){
 if(saving){saveNote('Завершается сохранение. Подожди зелёную отметку.');return}
 if(dirty){saveNote('Сначала сохрани изменения в текущей карточке.','error');return}
 selected=p;
 $('edit-form').hidden=false;
 $('field-name').value=p.name||'';
 $('field-kind').value=p.kind||'ready';
 $('field-category').value=p.category||'';
 $('field-composition').value=p.composition||'';
 $('field-storage').value=p.storage||'';
 $('field-hours').value=p.hours==null?'':p.hours;
 $('product-photo').hidden=!p.hasPhoto;
 if(p.hasPhoto)$('product-photo').src='/api/owner/db/photo/'+encodeURIComponent(p.id);
 else $('product-photo').removeAttribute('src');
 saveNote('✓ Товар загружен из облака','good');
 renderList();
}
async function loadCloud(){
 if(loading)return;
 if(saving){saveNote('Дождись завершения сохранения.');return}
 if(dirty&&!window.confirm('Есть несохранённые изменения. Отменить их и обновить каталог?'))return;
 loading=true;clearTimeout(saveTimer);dirty=false;
 $('reload').disabled=true;
 ownerNote('Соединяюсь с Neon и загружаю данные…');
 try{
  const [status,catalog]=await Promise.all([api('db/status'),api('db/catalog')]);
  products=catalog.products||[];
  for(const [key,n] of [['stat-products',status.products],['stat-photos',status.photos],['stat-locations',status.locations]])$(key).textContent=String(n??'—');
  $('db-state').textContent='✓ Подключено';
  $('db-state').classList.remove('off');
  ownerNote('✓ Облако Neon подключено. Каталог читается напрямую из базы.','good');
  const id=selected?.id;selected=null;dirty=false;
  $('edit-form').hidden=true;
  renderList();
  if(id){const p=products.find(x=>x.id===id);if(p)selectProduct(p);}
  else if(products.length)selectProduct(products[0]);
 }catch(e){
  ownerNote('Не удалось открыть облачный каталог: '+e.message,'error');
  $('db-state').textContent='Ошибка соединения';
  $('db-state').classList.add('off');
 }finally{loading=false;$('reload').disabled=false}
}
function formPayload(){
 return {
  id:selected.id,updatedAt:selected.updatedAt,
  name:$('field-name').value.trim(),kind:$('field-kind').value,
  category:$('field-category').value.trim(),
  composition:$('field-composition').value.trim(),
  storage:$('field-storage').value.trim(),
  hours:$('field-hours').value===''?null:Number($('field-hours').value)
 };
}
function fieldChanged(){
 if(!selected)return;
 dirty=true;editVersion++;
 saveNote('Изменения в карточке. Автосохранение через 1,5 секунды…');
 clearTimeout(saveTimer);
 if(!saving)saveTimer=setTimeout(()=>void saveProduct(),1500);
}
async function saveProduct(){
 clearTimeout(saveTimer);
 if(!selected||saving||!dirty)return;
 const payload=formPayload();
 if(!payload.name){saveNote('Название не может быть пустым.','error');return}
 if(payload.hours!==null&&(!Number.isInteger(payload.hours)||payload.hours<1||payload.hours>8760)){
  saveNote('Срок хранения должен быть от 1 до 8760 часов.','error');return
 }
 saving=true;const version=editVersion;const id=selected.id;
 $('save-now').disabled=true;saveNote('Сохраняю в Neon…');
 try{
  const result=await api('db/save',payload);
  Object.assign(selected,payload,{updatedAt:result.updatedAt});
  if(version===editVersion){dirty=false;saveNote('✓ Сохранено в облаке Neon','good');}
  else saveNote('Первое изменение сохранено. Записываю следующее…');
  renderList();
 }catch(e){
  saveNote('Не сохранено: '+e.message+' Нажми «Сохранить сейчас» для повтора.','error');
 }finally{
  saving=false;$('save-now').disabled=false;
  if(dirty&&version!==editVersion&&selected?.id===id)saveTimer=setTimeout(()=>void saveProduct(),1200);
 }
}
async function init(){
 $('pin-form').addEventListener('submit',async(event)=>{
  event.preventDefault();
  const pin=$('pin').value;
  if(!/^\d{5,12}$/.test(pin))return note('Код должен содержать от 5 до 12 цифр.','error');
  $('enter').disabled=true;note('Проверяю код…');
  try{
   const response=await api('pin',{pin});
   $('pin').value='';if(!response.authorized)throw Error('Код не подтверждён.');
   show('dashboard');void loadCloud();
  }catch(e){$('pin').value='';note(e.message,'error');}
  finally{$('enter').disabled=false}
 });
 $('logout').addEventListener('click',async()=>{
  if(dirty&&!window.confirm('Изменения не сохранены. Выйти?'))return;
  try{await api('logout',{})}catch{}
  clearTimeout(saveTimer);dirty=false;selected=null;show('entry');note('Сеанс завершён.');
 });
 $('reload').addEventListener('click',()=>void loadCloud());
 $('product-search').addEventListener('input',renderList);
 $('product-kind').addEventListener('change',renderList);
 $('edit-form').addEventListener('submit',event=>{event.preventDefault();void saveProduct()});
 for(const id of ['field-name','field-kind','field-category','field-composition','field-storage','field-hours'])
  $(id).addEventListener(id==='field-kind'?'change':'input',fieldChanged);
 try{
  const session=await api('session');
  show(session.authorized?'dashboard':'entry');
  if(session.authorized)void loadCloud();
 }catch(e){show('entry');note(e.message,'error')}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
