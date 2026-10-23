// FARUKH PRINT — paired Android / browser clients.
// Read-only cloud catalog: only FARUKH AI owner's panel can publish updates.
(()=>{'use strict';
const BASE='/api/farukh-print', TOKEN_KEY='farukh-print:device:v1';
const root=document.getElementById('home');
if(!root||!window.FARUKH_PRINT_SYNC_API)return;
const box=document.createElement('section');box.className='print-sync';
const top=document.createElement('div');top.className='print-sync-head';
const headline=document.createElement('strong');headline.textContent='Связь с управляющим центром';
const badge=document.createElement('span');badge.className='print-sync-badge';badge.textContent='Проверка…';
top.append(headline,badge);
const hint=document.createElement('p');hint.textContent='Получай каталог из основного FARUKH AI через интернет. Bluetooth-печать продолжит работать локально.';
const form=document.createElement('form');form.className='print-sync-form';
const code=document.createElement('input');code.type='text';code.autocomplete='one-time-code';code.placeholder='12-значный код из FARUKH AI';code.maxLength=16;code.setAttribute('aria-label','Код подключения устройства');
const name=document.createElement('input');name.type='text';name.placeholder='Название устройства (например, Планшет Плазма)';name.maxLength=60;name.value='FARUKH PRINT · '+(navigator.userAgent.includes('Android')?'Android':'Браузер');name.setAttribute('aria-label','Название устройства');
const link=document.createElement('button');link.type='submit';link.textContent='Подключить к центру';
form.append(code,name,link);
const controls=document.createElement('div');controls.className='print-sync-buttons';
const update=document.createElement('button');update.type='button';update.textContent='↻ Обновить базу';
const forget=document.createElement('button');forget.type='button';forget.textContent='Отключить это устройство';forget.className='print-sync-danger';
controls.append(update,forget);
const message=document.createElement('p');message.className='print-sync-message';message.setAttribute('role','status');
box.append(top,hint,form,controls,message);
const homeFoot=root.querySelector('.app-foot');if(homeFoot)homeFoot.before(box);else root.append(box);
let stored=null,connected=false,cloudRev=-1,busy=false,poll=null,consentDeferred=false;
try{const raw=localStorage.getItem(TOKEN_KEY);if(raw)stored=JSON.parse(raw)}catch{}
function note(str,error=false){message.textContent=str;message.dataset.error=error?'yes':'no'}
function paint(){
 controls.hidden=!connected;form.hidden=connected;
 link.disabled=busy;update.disabled=busy;
 badge.textContent=connected?'● Подключено':'○ Не подключено';
 badge.dataset.connected=connected?'yes':'no';
 window.FARUKH_PRINT_SYNC_API.setPaired(connected);
}
async function call(path,opts={}){
 const headers={'Content-Type':'application/json',...opts.headers};
 if(stored?.token)headers['X-Farukh-Print-Device']=stored.token;
 const res=await fetch(BASE+path,{...opts,headers,cache:'no-store'});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Object.assign(Error(data.error||'Сервер временно недоступен.'),{status:res.status});
 return data;
}
async function sync(first=false){
 if(!stored?.token||busy||(consentDeferred&&!first))return;
 busy=true;paint();
 try{
   const state=await call('/device/catalog');
   const current=window.FARUKH_PRINT_SYNC_API.get();
   const requiresConsent=!Number.isInteger(stored.syncedRevision);
   if((first||requiresConsent)&&current.length&&requiresConsent){
     const should=confirm('Подключиться к облачной базе из '+state.products.length+' товаров? Это заменит локальные '+current.length+' позиций на устройстве. Перед подключением рекомендуем сохранить локальную JSON-копию в «Управлении этикетками».');
     if(!should){connected=true;consentDeferred=true;note('Код принят, но загрузка ещё не подтверждена. Сохрани JSON-копию через «Управление этикетками», затем нажми «Обновить базу».',true);return}
   }
   if(first||state.revision!==cloudRev){
     window.FARUKH_PRINT_SYNC_API.replace(state.products);
     cloudRev=state.revision;
   }
   consentDeferred=false;
   stored.syncedRevision=state.revision;localStorage.setItem(TOKEN_KEY,JSON.stringify(stored));
   connected=true;
   note('База синхронизирована: '+state.products.length+' этикеток · версия '+state.revision+'. Обновления поступают автоматически.');
 }catch(e){
   if(e.status===401||e.status===403){connected=false;clearInterval(poll);poll=null;stored=null;localStorage.removeItem(TOKEN_KEY);note('Доступ к облаку отозван владельцем или срок подключения истёк. Локальные копии остаются на устройстве.',true)}
   else note('Нет соединения: '+e.message+'. Сохранённые этикетки доступны без интернета.',true);
 }finally{busy=false;paint()}
}
async function connect(event){
 event.preventDefault();
 if(busy)return;
 const key=code.value.replace(/[\s-]/g,'').toUpperCase();
 if(!/^[A-HJ-NP-Z2-9]{12}$/.test(key)){note('Введи 12 символов кода из управляющего центра FARUKH AI.',true);return}
 busy=true;paint();
 try{
   const data=await call('/device/pair',{method:'POST',body:JSON.stringify({code:key,name:name.value.trim()})});
   stored={token:data.token,name:data.device.name};localStorage.setItem(TOKEN_KEY,JSON.stringify(stored));
   code.value='';connected=true;note('Устройство подключено. Загружаю каталог…');
 }catch(e){note('Подключение не выполнено: '+e.message,true);busy=false;paint();return}
 busy=false;await sync(true);if(stored?.token&&!poll)poll=setInterval(()=>{if(document.visibilityState!=='hidden')void sync()},60_000);
}
function disconnect(){
 if(!confirm('Отключить синхронизацию на этом устройстве? Сохранённые здесь этикетки останутся.'))return;
 stored=null;cloudRev=-1;connected=false;localStorage.removeItem(TOKEN_KEY);
 if(poll){clearInterval(poll);poll=null}
 note('Устройство отключено локально. Для полного отзыва доступа удали устройство в управляющем центре FARUKH AI.');
 paint();
}
form.addEventListener('submit',connect);
update.onclick=()=>sync(cloudRev<0);
forget.onclick=disconnect;
void (async()=>{
 try{
   const info=await call('/sync/status');
   if(!info.enabled){
     form.hidden=true;controls.hidden=true;badge.textContent='Не настроено';
     note('Онлайн-связь пока не включена владельцем. Этикетки и Bluetooth-печать работают отдельно.');
     return;
   }
   connected=!!stored?.token;
   paint();
   if(connected)await sync(!Number.isInteger(stored.syncedRevision));
   if(stored?.token)poll=setInterval(()=>{if(document.visibilityState!=='hidden')void sync()},60_000);
 }catch(e){note('Проверка облака недоступна. Локальная печать продолжает работать.',true)}
})();
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&stored?.token)void sync()});
})();