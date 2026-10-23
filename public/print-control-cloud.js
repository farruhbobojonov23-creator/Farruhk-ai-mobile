// FARUKH AI's owner-only remote catalog publishing and device administration.
// Protected /api/farukh-print/admin/* requires the existing owner login cookie.
// Publishing to cloud is opt-in, guarded by optimistic revision comparison.
const KEY='farukh-print:catalog:v1';
const remote='/api/farukh-print';
const el=(tag,cl,text)=>{const e=document.createElement(tag);if(cl)e.className=cl;if(text!==undefined)e.textContent=text;return e};
const btn=(label,handler,cls='pcloud-btn')=>{const b=el('button',cls,label);b.type='button';b.onclick=handler;return b};
const read=()=>{try{const data=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(data)?data:[]}catch{throw Error('Локальная база повреждена. Восстанови резервную копию.')}}
async function api(path,options={}){
 const r=await fetch(remote+path,{credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...options.headers},...options});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(Error(data.error||'Не удалось связаться с облаком.'),{status:r.status});
 return data;
}
export function mountPrintCloudControl({root,renderLocal}){
 const box=el('section','pcloud');
 const title=el('h2','','Облачное управление FARUKH PRINT');
 const explanation=el('p','','Здесь публикуется единая база для подключённых телефонов и планшетов. Без специального кода и разрешения владельца устройства не подключатся.');
 const status=el('p','pcloud-status','Проверяю доступность…');
 const actions=el('div','pcloud-actions');
 const syncUp=btn('↑ Опубликовать локальную базу',publish);
 const syncDown=btn('↓ Загрузить базу из облака',download);
 const refresh=btn('↻ Проверить облако',refreshRemote);
 const pairing=btn('＋ Подключить телефон / планшет',pair);
 actions.append(syncUp,syncDown,refresh,pairing);
 const codeBox=el('div','pcloud-pairing');codeBox.hidden=true;
 const codeLabel=el('small','','Код для ввода на устройстве (действует 10 минут):');
 const codeValue=el('strong','pcloud-code','');const codeUntil=el('small','','');
 codeBox.append(codeLabel,codeValue,codeUntil);
 const devicesTitle=el('h3','','Разрешённые устройства');
 const devices=el('div','pcloud-devices');
 const hint=el('p','pcloud-foot','Первую загрузку делай осознанно: она заменяет локальную базу приложения. До переноса рекомендуется сохранить JSON-копию. Устройства автоматически получают обновления при соединении с интернетом.');
 box.append(title,explanation,status,actions,codeBox,devicesTitle,devices,hint);
 root.append(box);
 let enabled=false,rev=null,remoteProducts=[],auto=false,busy=false,queue=Promise.resolve(),fetched=false;
 const tell=(message,err=false)=>{status.textContent=message;status.dataset.error=err?'yes':'no'};
 const lock=on=>{busy=on;for(const item of actions.querySelectorAll('button'))item.disabled=on};
 const time=s=>{const d=new Date(s);return Number.isFinite(d.valueOf())?new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(d):'—'};
 function updateState(){
   const can=enabled&&fetched&&!busy;
   syncUp.disabled=!can;syncDown.disabled=!can||!rev;
   pairing.disabled=!enabled||busy;refresh.disabled=!enabled||busy;
 }
 async function start(){
  try{
   const info=await api('/sync/status');
   enabled=!!info.enabled;
   if(!enabled){
    tell(info.permanent?'Нужно настроить защищённый вход владельца FARUKH AI.':'Облачная синхронизация пока недоступна: требуется постоянное хранилище Яндекс Диска.',true);
    updateState();return;
   }
   await refreshRemote();
  }catch(e){tell('Не удалось проверить облако: '+e.message,true)}
 }
 async function refreshRemote(){
  if(!enabled)return;
  lock(true);
  try{
    const data=await api('/admin/catalog');
    fetched=true;rev=data.revision;remoteProducts=data.products;
    const local=read();
    auto=JSON.stringify(local)===JSON.stringify(remoteProducts)&&local.length===remoteProducts.length;
    tell('Облако: '+remoteProducts.length+' позиций · версия '+rev+'. Локально: '+local.length+'. '+(auto?'Каталоги совпадают, последующие изменения будут публиковаться автоматически.':'Каталоги отличаются. Выбери «Опубликовать» или «Загрузить».'),false);
    await loadDevices();
  }catch(e){fetched=false;auto=false;tell('Облачный каталог не загружен: '+e.message,true)}
  finally{lock(false);updateState()}
 }
 async function publish(autoMode=false){
  if(!enabled||rev===null)return;
  // Interactive manual publication is confirmed. Automatic publication only
  // happens after the owner has linked identical or explicitly chosen data.
  if(!autoMode&&!confirm('Опубликовать текущую локальную базу на все подключённые устройства? Перед публикацией проверь сроки хранения.'))return;
  const local=read(),originalRev=rev;
  lock(true);
  try{
    const out=await api('/admin/catalog',{method:'PUT',body:JSON.stringify({revision:originalRev,products:local})});
    rev=out.revision;remoteProducts=out.products;auto=true;
    tell('Опубликована версия '+rev+' · '+out.products.length+' этикеток. Телефоны и планшеты получат обновление.');
  }catch(e){
    auto=false;tell('База не опубликована: '+e.message+(e.status===409?' Нельзя перезаписывать изменения с другого устройства.':'') ,true);
  }finally{lock(false);updateState()}
 }
 async function download(){
  if(!enabled||!fetched)return;
  if(!confirm('Заменить локальные этикетки ('+read().length+' шт.) облачной базой ('+remoteProducts.length+' шт.)? Сначала скачай резервную копию, если есть свои изменения.'))return;
  try{
    localStorage.setItem(KEY,JSON.stringify(remoteProducts));
    window.dispatchEvent(new StorageEvent('storage',{key:KEY,newValue:JSON.stringify(remoteProducts)}));
    renderLocal?.();
    auto=true;tell('База загружена из облака. Теперь изменения через управляющий центр будут публиковаться автоматически.');
  }catch(e){tell('Ошибка записи локальной базы: '+e.message,true)}
  updateState();
 }
 async function pair(){
  if(!enabled)return;
  lock(true);
  try{
    const data=await api('/admin/pair',{method:'POST',body:'{}'});
    codeValue.textContent=data.code.replace(/(.{4})/g,'$1 ').trim();
    codeUntil.textContent='Действует до '+time(data.expiresAt)+' (по Москве).';
    codeBox.hidden=false;
    tell('Открой FARUKH PRINT на планшете или телефоне → «Подключить к центру» и введи этот код.');
  }catch(e){tell('Не получилось создать код: '+e.message,true)}
  finally{lock(false);updateState()}
 }
 async function loadDevices(){
  const result=await api('/admin/devices');devices.replaceChildren();
  const active=result.devices.filter(x=>!x.revoked);
  if(!active.length){devices.append(el('p','pcloud-empty','Пока нет подключённых устройств. Создай код подключения.'));return}
  for(const d of active){
    const row=el('div','pcloud-device');const info=el('div');
    info.append(el('strong','',d.name),el('small','','Подключено: '+time(d.createdAt)+' · Последняя синхронизация: '+time(d.lastSeenAt)));
    const revoke=btn('Отключить',async()=>{
      if(!confirm('Отключить синхронизацию для «'+d.name+'»? Уже сохранённые на устройстве этикетки не удалятся.'))return;
      try{await api('/admin/devices/'+encodeURIComponent(d.id),{method:'DELETE',body:'{}'});await loadDevices();tell('Доступ к облачной синхронизации отключён: '+d.name)}
      catch(e){tell('Не удалось отключить устройство: '+e.message,true)}
    },'pcloud-revoke');
    row.append(info,revoke);devices.append(row);
  }
 }
 window.addEventListener('farukh-print-catalog-local-updated',()=>{
   if(!enabled||!auto)return;
   // Queue uses latest local state, ensures revision ordering.
   queue=queue.then(()=>publish(true)).catch(e=>tell(e.message,true));
 });
 // Re-fetch devices when the owner returns to the center.
 window.addEventListener('focus',()=>{if(enabled&&fetched&&!busy)void loadDevices().catch(()=>{})});
 void start();
 return {refresh:refreshRemote};
}
