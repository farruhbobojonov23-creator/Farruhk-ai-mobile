// FARUKH PRINT — paired Android / browser clients.
// Read-only cloud catalog: only FARUKH AI owner's panel can publish updates.
(()=>{'use strict';
const BASE='/api/farukh-print', TOKEN_KEY='farukh-print:device:v1', STAFF_MANAGED='farukh-print:staff-managed:v1';
const root=document.getElementById('home');
if(!root||!window.FARUKH_PRINT_SYNC_API)return;
const box=document.createElement('section');box.className='print-sync';
const top=document.createElement('div');top.className='print-sync-head';
const headline=document.createElement('strong');headline.textContent='Связь с управляющим центром';
const badge=document.createElement('span');badge.className='print-sync-badge';badge.textContent='Проверка…';
top.append(headline,badge);
const hint=document.createElement('p');hint.textContent='Товары и фотографии обновляются из FARUKH AI. Подключённые сотрудники печатают только после онлайн-проверки прав и актуальности каталога.';
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
let stored=null,connected=false,cloudRev=-1,busy=false,poll=null,consentDeferred=false,connectionHealthy=false;
try{const raw=localStorage.getItem(TOKEN_KEY);if(raw)stored=JSON.parse(raw)}catch{}
function note(str,error=false){
 connectionHealthy=!error;message.textContent=str;message.dataset.error=error?'yes':'no';
 window.dispatchEvent(new CustomEvent('farukh-print-sync-status',{detail:{
  state:error?'error':'ready',message:str,revision:cloudRev,connected,
  count:window.FARUKH_PRINT_SYNC_API.get().length
 }}));
}
function paint(){
 controls.hidden=!connected;form.hidden=connected; // re-pairing does not unlock employee print gate
 link.disabled=busy;update.disabled=busy;
 badge.textContent=connected?(connectionHealthy?'● Подключено':'○ Связь не подтверждена'):localStorage.getItem(STAFF_MANAGED)==='1'?'● Нужна повторная привязка':'○ Не подключено';
 badge.dataset.connected=connected&&connectionHealthy?'yes':'no';
 const protectedDevice=connected||localStorage.getItem(STAFF_MANAGED)==='1';
 window.FARUKH_PRINT_SYNC_API.setPaired(protectedDevice);
 window.FARUKH_PRINT_STAFF_API?.setPaired(protectedDevice);
}
async function call(path,opts={}){
 const headers={'Content-Type':'application/json',...opts.headers};
 if(stored?.token)headers['X-Farukh-Print-Device']=stored.token;
 const res=await fetch(BASE+path,{...opts,headers,cache:'no-store'});
 if(res.status===304)return {notModified:true};
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Object.assign(Error(data.error||'Сервер временно недоступен.'),{status:res.status});
 return data;
}
// Detect local drift before trusting the server's authenticated 304.
// This is a local integrity marker, NOT an authorization credential.
function catalogFingerprint(items){
 const source=JSON.stringify(items);
 let hash=2166136261;
 for(let i=0;i<source.length;i++){hash^=source.charCodeAt(i);hash=Math.imul(hash,16777619)}
 return source.length+':'+(hash>>>0).toString(16);
}
async function sync(first=false){
 if(!stored?.token||busy||(consentDeferred&&!first))return;
 busy=true;paint();
 try{
   const current=window.FARUKH_PRINT_SYNC_API.get();
   const localFingerprint=catalogFingerprint(current);
   const currentRevision=cloudRev>=0&&!first&&Number.isSafeInteger(stored.syncedRevision)&&stored.syncedRevision===cloudRev
    &&typeof stored.catalogFingerprint==='string'&&stored.catalogFingerprint===localFingerprint;
   const state=await call('/device/catalog',currentRevision?{headers:{'If-None-Match':'"farukh-print-r'+cloudRev+'"'}}:{});
   // Published design previews are separate from approved production labels.
   // Failure to load this optional gallery must never block existing kitchen printing.
   try{
     const designs=await call('/device/designs');
     window.dispatchEvent(new CustomEvent('farukh-print-device-designs',{detail:{revision:designs.revision,entries:designs.entries}}));
   }catch(error){
     window.dispatchEvent(new CustomEvent('farukh-print-device-designs',{detail:{unavailable:true,entries:[]}}));
     console.warn('[print-design-gallery]',error.message);
   }
   if(state.notModified){
     connected=true;
     note('✓ Синхронизировано · версия '+cloudRev+' · проверено '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+'.');
     return;
   }
   const requiresConsent=!Number.isInteger(stored.syncedRevision);
   if((first||requiresConsent)&&current.length&&requiresConsent){
     const should=confirm('Подключиться к облачной базе из '+state.products.length+' товаров? Это заменит локальные '+current.length+' позиций на устройстве. Перед подключением рекомендуем сохранить локальную JSON-копию в «Управлении этикетками».');
     if(!should){connected=true;consentDeferred=true;note('Код принят, но загрузка ещё не подтверждена. Сохрани JSON-копию через «Управление этикетками», затем нажми «Обновить базу».',true);return}
   }
   // A connected device can lose localStorage (or another tab can change
   // it) while keeping the same revision in RAM. Repair against the current
   // authenticated catalog instead of silently using stale food labels.
   const localMatches=JSON.stringify(current)===JSON.stringify(state.products);
   if(first||state.revision!==cloudRev||!localMatches){
     window.FARUKH_PRINT_SYNC_API.replace(state.products);
     cloudRev=state.revision;
   }
   consentDeferred=false;
   stored.syncedRevision=state.revision;
   stored.catalogFingerprint=catalogFingerprint(window.FARUKH_PRINT_SYNC_API.get());
   localStorage.setItem(TOKEN_KEY,JSON.stringify(stored));
   connected=true;
   note('✓ Синхронизировано: '+state.products.length+' этикеток · версия '+state.revision+'. Обновления поступают автоматически.');
 }catch(e){
   if(e.status===401||e.status===403){
     connected=false;clearInterval(poll);poll=null;stored=null;localStorage.removeItem(TOKEN_KEY);
     note('Владелец отключил доступ устройства. Локальные этикетки сохранены, но печать сотрудникам заблокирована.',true);
     window.FARUKH_PRINT_STAFF_API?.setPaired(true);
   }
   else note('Нет соединения: '+e.message+'. Каталог доступен для просмотра, но печать сотрудников требует связи.',true);
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
   stored={token:data.token,name:data.device.name};
   localStorage.setItem(TOKEN_KEY,JSON.stringify(stored));
   localStorage.setItem(STAFF_MANAGED,'1'); // paired kitchen is always staff-protected
   window.FARUKH_PRINT_STAFF_API?.setPaired(true);
   code.value='';connected=true;note('Устройство подключено. Загружаю каталог…');
 }catch(e){note('Подключение не выполнено: '+e.message,true);busy=false;paint();return}
 busy=false;await sync(true);if(stored?.token&&!poll)poll=setInterval(()=>{if(document.visibilityState!=='hidden')void sync()},60_000);
}
function disconnect(){
 if(!confirm('Отключить синхронизацию на этом устройстве? Сохранённые здесь этикетки останутся.'))return;
 stored=null;cloudRev=-1;connected=false;localStorage.removeItem(TOKEN_KEY);
 // Never unlock a centrally-managed kitchen device by clicking Disconnect.
 // Re-enrollment or owner-controlled data reset is needed to change roles.
 window.FARUKH_PRINT_STAFF_API?.setPaired(true);
 if(poll){clearInterval(poll);poll=null}
 note('Синхронизация отключена. Режим сотрудников и ограничение печати остаются включены; для работы обратись к владельцу FARUKH AI.');
 paint();
}
window.FARUKH_PRINT_DEVICE_SYNC={
 refresh:()=>sync(cloudRev<0),
 state:()=>({connected,revision:cloudRev,managed:localStorage.getItem(STAFF_MANAGED)==='1'})
};
form.addEventListener('submit',connect);
update.onclick=()=>sync(cloudRev<0);
forget.onclick=disconnect;
void (async()=>{
 try{
   const info=await call('/sync/status');
   if(!info.enabled){
     form.hidden=true;controls.hidden=true;badge.textContent='Не настроено';
     note('Онлайн-связь пока не включена владельцем. Каталог доступен для просмотра. Печать требует привязки устройства и входа сотрудника.');
     return;
   }
   connected=!!stored?.token;
   if(connected)localStorage.setItem(STAFF_MANAGED,'1');
   paint();
   if(connected)await sync(!Number.isInteger(stored.syncedRevision));
   if(stored?.token)poll=setInterval(()=>{if(document.visibilityState!=='hidden')void sync()},60_000);
 }catch(e){note('Проверка облака недоступна. Для печати сотрудника необходимо подключение.',true)}
})();
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&stored?.token)void sync()});
})();