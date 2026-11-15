
/* Owner operations — all mutations occur through PIN-checked same-origin routes. */
const $=id=>document.getElementById(id);
let locations=[],staff=[],devices=[],selectedLabel=null,opsBusy=false;
async function api(path,data){
 const cfg={method:data===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store'};
 if(data!==undefined){cfg.headers={'Content-Type':'application/json'};cfg.body=JSON.stringify(data)}
 const r=await fetch('/api/owner/'+path,cfg);
 let json;try{json=await r.json()}catch{throw Error('Некорректный ответ сервера.')}
 if(!r.ok||json.ok===false)throw Error(json.error||'Ошибка '+r.status);
 return json;
}
function status(t,type=''){$('ops-status').textContent=t;$('ops-status').dataset.type=type;}
function el(tag,text='',className=''){const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;}
function inputOptions(select,opts,value){select.replaceChildren();for(const o of opts){const node=el('option',o.name);node.value=String(o.id);select.append(node)}if(value!=null)select.value=String(value)}
function locOptions(select,value){inputOptions(select,locations.filter(l=>l.active),value)}
async function all(){
 if(opsBusy)return;
 opsBusy=true;$('ops-refresh').disabled=true;
 try{
  const [sum,loc,emps,dev,log,checks,catalog]=await Promise.all([
   api('ops/summary'),api('ops/locations'),api('ops/staff'),api('ops/devices'),api('ops/events'),api('ops/labels/check'),api('db/catalog')]);
  locations=loc.locations;staff=emps.staff;devices=dev.devices;
  for(const [id,value] of [['ops-staff-count',sum.staff],['ops-device-count',sum.devices],['ops-pending-count',sum.pending],['ops-event-count',sum.events]])$(id).textContent=String(value);
  locOptions($('employee-location'),locations[0]?.id);
  renderStaff();renderDevices();renderEvents(log.events);renderChecks(checks);
  const list=$('label-item'),existing=list.value;
  inputOptions(list,(catalog.products||[]).map(p=>({id:p.id,name:p.name})),existing||catalog.products?.[0]?.id);
  if(!list.value&&list.options.length)list.selectedIndex=0;
  await loadLabel();
  status('✓ Данные обновлены из основной базы Neon','good');
 }catch(e){status('Не удалось загрузить раздел: '+e.message,'error');}
 finally{opsBusy=false;$('ops-refresh').disabled=false}
}
function renderStaff(){
 const host=$('employee-list');host.replaceChildren();
 if(!staff.length){host.append(el('p','Сотрудников ещё нет. Создай первого сотрудника.'));return}
 for(const s of staff){
  const row=el('div','','opsrow');
  const info=el('div');info.append(el('strong',s.name));
  info.append(el('small',s.login+' · '+(s.role==='manager'?'Администратор':'Повар')+' · '+s.status));
  row.append(info);
  const controls=el('div','','opsbuttons'),loc=el('select');
  loc.setAttribute('aria-label','Точка для '+s.name);locOptions(loc,s.locationId);
  const toggle=el('button',s.status==='active'?'Заблокировать':'Активировать');
  toggle.addEventListener('click',async()=>{
   toggle.disabled=true;
   try{await api('ops/staff/update',{id:s.id,status:s.status==='active'?'blocked':'active',locationId:Number(loc.value)});await all()}
   catch(e){status(e.message,'error')}finally{toggle.disabled=false}
  });
  const save=el('button','Сменить точку');
  save.addEventListener('click',async()=>{save.disabled=true;try{await api('ops/staff/update',{id:s.id,status:s.status,locationId:Number(loc.value)});await all()}catch(e){status(e.message,'error')}finally{save.disabled=false}});
  const reset=el('button','Новый пароль');
  reset.addEventListener('click',async()=>{
   if(!window.confirm('Старый пароль сотрудника перестанет работать. Продолжить?'))return;
   reset.disabled=true;
   try{const r=await api('ops/staff/reset',{id:s.id});showSecret(r.login,r.temporaryPassword)}catch(e){status(e.message,'error')}finally{reset.disabled=false}
  });
  controls.append(loc,save,toggle,reset);row.append(controls);host.append(row);
 }
}
function showSecret(login,pass){
 const n=$('employee-credentials');n.hidden=false;
 n.textContent='Сотрудник создан / пароль обновлён.\nЛогин: '+login+'\nНовый пароль (показывается один раз): '+pass+
 '\nПередай сотруднику лично. Для безопасности не публикуй этот пароль.';
 n.dataset.type='good';n.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function renderDevices(){
 const host=$('device-list');host.replaceChildren();
 if(!devices.length){host.append(el('p','Устройств пока нет. Открой страницу сотрудника на нужном телефоне, войди и нажми «Запросить привязку».'));return}
 for(const d of devices){
  const row=el('div','','opsrow');
  const left=el('div');left.append(el('strong',d.name||'Без названия'));
  left.append(el('small',(d.staffName||'Без сотрудника')+' · '+d.status+' · '+(d.locationName||'Точка не назначена')));
  row.append(left);
  const act=el('div','','opsbuttons'),select=el('select');
  select.setAttribute('aria-label','Точка для '+(d.name||'устройства'));locOptions(select,d.locationId);
  const approve=el('button','Разрешить');const block=el('button','Блокировать');
  approve.className='primary';
  const update=async(state,btn)=>{
   btn.disabled=true;
   try{await api('ops/devices/update',{id:d.id,status:state,locationId:Number(select.value)});await all()}
   catch(e){status(e.message,'error')}finally{btn.disabled=false}
  };
  approve.addEventListener('click',()=>void update('approved',approve));
  block.addEventListener('click',()=>void update('blocked',block));
  act.append(select,approve,block);row.append(act);host.append(row);
 }
}
function renderEvents(events){
 const host=$('events-list');host.replaceChildren();
 if(!events.length){host.append(el('p','Событий ещё нет: действующее приложение печати не подключено к журналу.'));return}
 for(const item of events){
  const row=el('div','','opsrow'),left=el('div');
  left.append(el('strong',item.product+' · '+item.quantity+' шт. · '+item.format));
  const when=new Date(item.eventAt).toLocaleString('ru-RU');
  left.append(el('small',when+' · '+(item.employee||'—')+' · '+(item.location||'—')+' · '+item.result));
  row.append(left);host.append(row);
 }
}
function renderChecks(data){
 const c=data.checks;
 $('label-checks').textContent='Каталог: '+c.total+' товаров, из них ПФ '+c.prep+
  '. Нет срока или условий хранения: '+c.missingStorageOrHours+
  '. Нет массы: '+c.missingWeight+'. У готовых товаров не заполнен состав: '+
  c.readyMissingComposition+'. Допущено к печати: '+c.approved+
  '. Проверка физического принтера: не проводилась.';
 $('label-checks').dataset.type=(c.missingStorageOrHours||c.missingWeight)?'':'good';
}
function appendLine(root,value,cls){
 if(value===undefined||value===null||value==='')return;
 root.append(el('div',String(value),cls));
}
function dateRu(date){return date.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function renderLabel(p,format){
 // Use the original 203 dpi FARUKH PRINT renderers, not an HTML mock-up.
 const root=$('label-preview');root.replaceChildren();
 const ready=format!=='30x20';
 root.className='label-sample '+(ready?'f58':'f30');
 const painter=ready?window.FarukhPremiumReady:window.FarukhPremiumPrep;
 const fail=message=>{
   root.append(el('div','Эталон не построен: '+message,'label-preview-error'));
   return message;
 };
 if(!painter||typeof painter.draw!=='function')return fail('оригинальный шаблон не загружен');
 const n=p.nutrition||{};
 if(ready){
   if(!p.composition)return fail('отсутствует состав');
   if(p.weight===null||p.weight===undefined||p.weight==='')return fail('не указана масса нетто');
   if(p.tolerance===null||p.tolerance===undefined||p.tolerance==='')return fail('не указан допуск массы');
   if(['p','f','c','kcal'].some(k=>n[k]===undefined||n[k]===null||n[k]===''))
     return fail('нет полного КБЖУ для утверждённого шаблона');
 }
 const canvas=document.createElement('canvas');
 canvas.width=ready?464:240;canvas.height=ready?320:160;
 const values={
   name:p.name,kind:p.kind,category:p.category,composition:p.composition,
   storage:p.storage,hours:p.hours,weight:p.weight,weightUnit:p.weightUnit,
   tolerance:p.tolerance,p:n.p,f:n.f,c:n.c,kcal:n.kcal,prepEvent:p.prepEvent
 };
 try{
   const g=canvas.getContext('2d');
   if(!g)return fail('холст браузера недоступен');
   painter.draw(g,values,Date.now());
 }catch(err){return fail(err.message||'не удалось нарисовать макет')}
 canvas.setAttribute('aria-label','Оригинальный макет FARUKH PRINT '+(ready?'58 × 40':'30 × 20')+' мм');
 root.append(canvas);
 return '';
}

async function loadLabel(){
 if(!$('label-item').value)return;
 try{
  const r=await api('ops/labels/product/'+encodeURIComponent($('label-item').value));
  selectedLabel=r.product;
  if(selectedLabel.kind==='prep')$('label-format').value='30x20';
  else $('label-format').value='58x40';
  showLabel();
 }catch(e){$('label-warning').textContent=e.message;$('label-warning').dataset.type='error'}
}
function showLabel(){
 const p=selectedLabel;if(!p)return;
 const fmt=$('label-format').value;
 const rendererError=renderLabel(p,fmt);
 const missing=[];
 if(rendererError)missing.push(rendererError);
 if(!p.storage)missing.push('условия хранения');
 if(!p.hours)missing.push('срок хранения');
 if(fmt==='58x40'){
  if(!p.composition)missing.push('состав');
  if(!p.weight)missing.push('масса нетто');
 }
 if(fmt==='30x20'&&p.kind!=='prep')missing.push('30×20 доступен только для ПФ');
 $('label-warning').textContent=(missing.length?'⚠️ Не заполнено: '+missing.join(', '):'✓ Обязательные поля для этого формата есть')+
  '. Статус: '+(p.approved?'разрешён к печати':'на проверке');
 $('label-warning').dataset.type=missing.length?'error':'good';
 $('label-approve').textContent=p.approved?'Отозвать допуск к печати':'Допустить товар к печати';
}
async function init(){
 $('ops-refresh').addEventListener('click',()=>void all());
 $('new-employee').addEventListener('submit',async e=>{
  e.preventDefault();const btn=e.target.querySelector('button[type=submit]');btn.disabled=true;
  try{
   const r=await api('ops/staff',{name:$('employee-name').value.trim(),login:$('employee-login').value.trim(),
     locationId:Number($('employee-location').value),role:$('employee-role').value});
   e.target.reset();showSecret(r.staff.login,r.temporaryPassword);await all();
  }catch(e){status(e.message,'error')}finally{btn.disabled=false}
 });
 $('label-item').addEventListener('change',()=>void loadLabel());
 $('label-format').addEventListener('change',showLabel);
 $('label-check-refresh').addEventListener('click',()=>void all());
 $('label-approve').addEventListener('click',async()=>{
  if(!selectedLabel)return;
  const approve=!selectedLabel.approved;
  if(approve&&!window.confirm('Подтверждаешь, что состав, масса, срок и условия хранения проверены?'))return;
  $('label-approve').disabled=true;
  try{
   const r=await api('ops/labels/approval',{id:selectedLabel.id,approved:approve});
   selectedLabel.approved=r.approved;showLabel();await all();
  }catch(e){$('label-warning').textContent=e.message;$('label-warning').dataset.type='error'}
  finally{$('label-approve').disabled=false}
 });
 window.addEventListener('owner-ready',()=>void all());
 try{
  const session=await api('session');
  if(session.authorized)void all();
 }catch(e){/* do not expose owner-only operations to unauthenticated visitors */}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
