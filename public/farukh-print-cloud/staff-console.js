const $=id=>document.getElementById(id);
let staff=null,device=null,items=[],current=null,pendingEvent=null;
async function call(path,payload){
 const cfg={method:payload===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store'};
 if(payload!==undefined){cfg.headers={'Content-Type':'application/json'};cfg.body=JSON.stringify(payload)}
 const r=await fetch('/api/staff/'+path,cfg);
 let d;try{d=await r.json()}catch{throw Error('Сервер вернул неверный ответ.')}
 if(!r.ok||d.ok===false)throw Error(d.error||'Ошибка '+r.status);
 return d;
}
function note(id,msg,bad=false){const n=$(id);n.textContent=msg;n.className='note '+(bad?'bad':'good')}
function el(tag,text,cls=''){const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e}
function line(root,text,cls){if(text===undefined||text===null||text==='')return;root.append(el('div',text,cls))}
function dateText(d){return d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function label(p,fmt){
 // Original FARUKH PRINT monochrome print layout shared by preview and print.
 const ready=fmt!=='30x20';
 const root=el('div',undefined,'print-sample '+(ready?'f58':'f30'));
 const fail=msg=>{root.dataset.error=msg;root.append(el('div','Эталон недоступен: '+msg,'label-preview-error'));return root};
 const painter=ready?window.FarukhPremiumReady:window.FarukhPremiumPrep;
 if(!painter||typeof painter.draw!=='function')return fail('не загружен оригинальный шаблон');
 const n=p.nutrition||{};
 if(ready){
   if(!p.composition)return fail('нет состава');
   if(p.weight===null||p.weight===undefined||p.weight==='')return fail('нет массы нетто');
   if(p.tolerance===null||p.tolerance===undefined||p.tolerance==='')return fail('нет допуска массы');
   if(['p','f','c','kcal'].some(k=>n[k]===undefined||n[k]===null||n[k]===''))
     return fail('нет КБЖУ для утверждённого шаблона');
 }
 const canvas=document.createElement('canvas');
 canvas.width=ready?464:240;canvas.height=ready?320:160;
 const data={name:p.name,kind:p.kind,category:p.category,composition:p.composition,
   storage:p.storage,hours:p.hours,weight:p.weight,weightUnit:p.weightUnit,
   tolerance:p.tolerance,p:n.p,f:n.f,c:n.c,kcal:n.kcal,prepEvent:p.prepEvent};
 try{
   const context=canvas.getContext('2d');
   if(!context)return fail('браузер не поддерживает печатный холст');
   painter.draw(context,data,Date.now());
   const img=document.createElement('img');
   img.alt='Печатная этикетка FARUKH PRINT '+(ready?'58 × 40':'30 × 20')+' мм';
   img.src=canvas.toDataURL('image/png');
   root.append(img);
 }catch(err){return fail(err.message||'ошибка формирования этикетки')}
 return root;
}

function renderItem(){
 const p=items.find(i=>i.id===$('product').value);current=p||null;
 const fmt=$('format').value;
 $('sheet').replaceChildren();
 if(!p){note('print-note','Каталог пока пуст.',true);$('print').disabled=true;return}
 const x=label(p,fmt);
 $('sheet').className=x.className;
 $('sheet').replaceChildren(...Array.from(x.childNodes));
 const issues=[];
 if(x.dataset.error)issues.push(x.dataset.error);
 if(!p.hours)issues.push('срок хранения');
 if(!p.storage)issues.push('условия хранения');
 if(fmt==='30x20'&&p.kind!=='prep')issues.push('30×20 только для ПФ');
 if(fmt==='58x40'&&(!p.weight||!p.composition))issues.push('масса/состав');
 if(!p.approved)issues.push('нет допуска владельца к печати');
 if(!device||device.status!=='approved'||device.location_id!==staff?.locationId)issues.push('устройство не подтверждено');
 $('print').disabled=issues.length>0||pendingEvent!=null;
 note('print-note',issues.length?'Недоступно: '+issues.join(', '):'✓ Товар и устройство допущены. Можно открыть диалог печати.',issues.length>0);
}
function renderSelection(){
 const q=$('search').value.trim().toLocaleLowerCase('ru'),prev=$('product').value;
 const filtered=items.filter(p=>p.name.toLocaleLowerCase('ru').includes(q));
 $('product').replaceChildren();
 for(const p of filtered){const opt=el('option',p.name+' · '+(p.kind==='prep'?'ПФ':'готовый')+(p.approved?' ✓':''));opt.value=p.id;$('product').append(opt)}
 if(filtered.some(p=>p.id===prev))$('product').value=prev;
 else if(filtered.length)$('product').value=filtered[0].id;
 if($('product').value){const p=filtered.find(p=>p.id===$('product').value);$('format').value=p?.kind==='prep'?'30x20':'58x40'}
 renderItem();
}
function deviceStatus(){
 const desc=$('device-note');
 if(!device){
  note('device-note','Устройство ещё не зарегистрировано. Введи название и отправь запрос владельцу.');
  $('pair-form').hidden=false;
 }else if(device.status==='pending'){
  note('device-note','⏳ Запрос отправлен. Владелец должен разрешить устройство для твоей точки. Обнови страницу после подтверждения.');
  $('pair-form').hidden=true;
 }else if(device.status==='approved'&&device.location_id===staff.locationId){
  note('device-note','✓ Устройство привязано к точке №'+staff.locationId+'.');
  $('pair-form').hidden=true;
 }else{
  note('device-note','⛔ Устройство заблокировано либо назначено другой точке. Обратись к владельцу.',true);
  $('pair-form').hidden=true;
 }
}
async function openWorkspace(){
 const data=await call('me');
 staff={...data.staff,locationId:data.staff.locationId};device=data.device;
 $('welcome').textContent=staff.name+' · Точка №'+staff.locationId;
 $('login').hidden=true;$('workspace').hidden=false;
 deviceStatus();
 const catalog=await call('catalog');items=catalog.products||[];
 renderSelection();
}
async function init(){
 $('login-form').addEventListener('submit',async event=>{
  event.preventDefault();const btn=event.target.querySelector('button');btn.disabled=true;
  try{
   const r=await call('login',{login:$('login-name').value.trim().toLowerCase(),password:$('login-pass').value});
   $('login-pass').value='';staff=r.staff;await openWorkspace();
  }catch(e){note('login-note',e.message,true)}
  finally{btn.disabled=false}
 });
 $('logout').addEventListener('click',async()=>{
  try{await call('logout',{})}catch{}
  staff=null;device=null;pendingEvent=null;
  $('workspace').hidden=true;$('login').hidden=false;
  note('login-note','Сеанс завершён.');
 });
 $('pair-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=e.target.querySelector('button');btn.disabled=true;
  try{const r=await call('devices/request',{name:$('device-name').value.trim()});
   note('device-note','Запрос '+r.status+'. Ожидай подтверждения владельца.');await openWorkspace();
  }catch(e){note('device-note',e.message,true)}finally{btn.disabled=false}
 });
 $('search').addEventListener('input',renderSelection);
 $('product').addEventListener('change',()=>{
  const p=items.find(p=>p.id===$('product').value);$('format').value=p?.kind==='prep'?'30x20':'58x40';
  renderItem();
 });
 $('format').addEventListener('change',renderItem);
 $('print').addEventListener('click',async()=>{
  if(!current||pendingEvent!=null)return;
  const quantity=Number($('qty').value),format=$('format').value;
  if(!Number.isInteger(quantity)||quantity<1||quantity>50)return note('print-note','Количество должно быть 1–50.',true);
  $('print').disabled=true;
  try{
   const r=await call('print/request',{productId:current.id,format,quantity});
   pendingEvent=r.eventId;
   $('print-pages').replaceChildren();
   for(let i=0;i<quantity;i++)$('print-pages').append(label(current,format));
   $('page-size').textContent='@media print{@page{size:'+(format==='58x40'?'58mm 40mm':'30mm 20mm')+';margin:0}}';
   $('confirm-zone').hidden=false;
   note('print-note','Запрос в журнале №'+pendingEvent+'. Открой диалог печати и затем подтверди фактический результат.');
   window.print();
  }catch(e){pendingEvent=null;note('print-note',e.message,true)}
  finally{renderItem()}
 });
 async function confirm(result){
  if(!pendingEvent)return;
  const id=pendingEvent;
  $('done').disabled=$('failed').disabled=true;
  try{
   await call('print/confirm',{eventId:id,result,reason:result==='failed'?'Сотрудник сообщил об ошибке печати':null});
   pendingEvent=null;$('confirm-zone').hidden=true;
   note('print-note',result==='completed'?'✓ Сотрудник подтвердил печать, запись сохранена.':'⚠️ Ошибка/отмена записана в журнал.',result!=='completed');
   renderItem();
  }catch(e){note('print-note',e.message,true)}
  finally{$('done').disabled=$('failed').disabled=false}
 }
 $('done').addEventListener('click',()=>void confirm('completed'));
 $('failed').addEventListener('click',()=>void confirm('failed'));
 try{await openWorkspace()}catch{ $('login').hidden=false;$('workspace').hidden=true}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
