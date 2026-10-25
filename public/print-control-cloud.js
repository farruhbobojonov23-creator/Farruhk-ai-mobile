// FARUKH AI's owner-only remote catalog publishing and device administration.
// Protected /api/farukh-print/admin/* requires the existing owner login cookie.
// Publishing to cloud is opt-in, guarded by optimistic revision comparison.
const KEY='farukh-print:catalog:v1', AGREED='farukh-print:owner-cloud-agreed:v1';
const remote='/api/farukh-print';
const el=(tag,cl,text)=>{const e=document.createElement(tag);if(cl)e.className=cl;if(text!==undefined)e.textContent=text;return e};
const btn=(label,handler,cls='pcloud-btn')=>{const b=el('button',cls,label);b.type='button';b.onclick=handler;return b};
const read=()=>{try{const data=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(data)?data:[]}catch{throw Error('Локальная база повреждена. Восстанови резервную копию.')}}
// Store compact agreement only after owner-approved publication/download.
// Without this, server-side validation normalizes optional fields and a page
// reload incorrectly disables automatic publishing even for an agreed catalog.
const digest=list=>{const str=JSON.stringify(list);let hash=2166136261;for(let i=0;i<str.length;i++)hash=Math.imul(hash^str.charCodeAt(i),16777619);return (hash>>>0).toString(16)+':'+str.length};
const agreed=()=>{try{return JSON.parse(localStorage.getItem(AGREED)||'null')}catch{return null}};
const remember=(revision,local,remote)=>{try{localStorage.setItem(AGREED,JSON.stringify({revision,local:digest(local),remote:digest(remote)}))}catch{/* no privileges are stored here */}};
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
 const publishBadge=el('div','pcloud-connection-summary');
 const publishState=el('span','pcloud-state','Облако: проверка');
 const deviceState=el('span','pcloud-devices-count','Устройства: —');
 const transferHelp=el('p','pcloud-foot','1. Добавь товары или собственные фото выше. 2. Опубликуй локальную базу один раз. 3. После согласования базы новые изменения будут отправляться автоматически. Подключённые планшеты проверяют изменения примерно раз в минуту.');
 publishBadge.append(publishState,deviceState);
 // The rest of FARUKH AI may be in passwordless mode. Device management must
 // still require a verified owner session: never weaken the server guard.
 const loginForm=el('form','pcloud-owner-login');
 loginForm.hidden=true;loginForm.autocomplete='on';
 const loginText=el('p','','Для облачного управления этикетками подтвердите вход владельца.');
 const loginLabel=el('label','pcloud-owner-label','Пароль владельца FARUKH AI');
 const password=el('input','pcloud-owner-password');
 password.type='password';password.name='password';password.autocomplete='current-password';password.required=true;password.maxLength=150;
 const loginButton=el('button','pcloud-btn pcloud-login-button','Войти как владелец');
 loginButton.type='submit';loginLabel.append(password);loginForm.append(loginText,loginLabel,loginButton);
 const actions=el('div','pcloud-actions');
 const syncUp=btn('↑ Опубликовать локальную базу',publish);
 const syncDown=btn('↓ Загрузить базу из облака',download);
 const refresh=btn('↻ Проверить облако',refreshRemote);
 const pairing=btn('＋ Подключить телефон / планшет',pair);
 actions.append(syncUp,syncDown,refresh,pairing);
 const staffUrl='/farukh-print/staff/';
 const staffLink=el('a','pcloud-btn pcloud-staff-link','↗ Открыть страницу сотрудников');
 staffLink.href=staffUrl;staffLink.target='_blank';staffLink.rel='noopener noreferrer';
 const copyStaff=btn('⧉ Скопировать ссылку для сотрудников',async()=>{
  const url=new URL(staffUrl,location.origin).href;
  try{await navigator.clipboard.writeText(url);tell('Ссылка для сотрудников скопирована. Отправь её на iPhone или Android. Для доступа к каталогу нужен код подключения устройства и личный логин.')}
  catch{window.prompt('Скопируй и отправь сотруднику эту ссылку:',url)}
 });
 actions.append(staffLink,copyStaff);
 const codeBox=el('div','pcloud-pairing');codeBox.hidden=true;
 const codeLabel=el('small','','Код для ввода на устройстве (действует 10 минут):');
 const codeValue=el('strong','pcloud-code','');const codeUntil=el('small','','');
 codeBox.append(codeLabel,codeValue,codeUntil);
 const devicesTitle=el('h3','','Разрешённые устройства');
 const devices=el('div','pcloud-devices');
 const hint=el('p','pcloud-foot','Первую загрузку делай осознанно: она заменяет локальную базу приложения. До переноса рекомендуется сохранить JSON-копию. Устройства автоматически получают обновления при соединении с интернетом.');
 box.append(title,explanation,status,publishBadge,transferHelp,loginForm,actions,codeBox,devicesTitle,devices,hint);
 root.insertBefore(box,root.children[3]||null); // cloud controls after catalog counters, before editor
 let enabled=false,rev=null,remoteProducts=[],auto=false,busy=false,queue=Promise.resolve(),fetched=false,loginRequired=false;
 const tell=(message,err=false)=>{status.textContent=message;status.dataset.error=err?'yes':'no'};
 const mark=(label,pending=false)=>{
  publishState.textContent=label;
  publishState.dataset.pending=pending?'yes':'no';
 };
 const lock=on=>{busy=on;for(const item of actions.querySelectorAll('button'))item.disabled=on};
 const askForLogin=()=>{
   loginRequired=true;fetched=false;auto=false;loginForm.hidden=false;codeBox.hidden=true;
   tell('Требуется вход владельца для выдачи кодов и управления базой. FARUKH AI может открываться без пароля, но здесь нужна отдельная авторизация.',true);
   updateState();
 };
 const time=s=>{const d=new Date(s);return Number.isFinite(d.valueOf())?new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(d):'—'};
 function updateState(){
   const can=enabled&&fetched&&!busy&&!loginRequired;
   syncUp.disabled=!can;syncDown.disabled=!can||!rev;
   pairing.disabled=!can;refresh.disabled=!enabled||busy||loginRequired;
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
  lock(true);mark('Облако: проверяю…');
  try{
    const data=await api('/admin/catalog');
    fetched=true;rev=data.revision;remoteProducts=data.products;loginRequired=false;loginForm.hidden=true;
    if(typeof window.dispatchEvent==='function')window.dispatchEvent(new CustomEvent('farukh-print-cloud-catalog',{detail:{products:remoteProducts}}));
    const local=read();
    const accepted=agreed();
    // Restore the owner's previously confirmed automatic mode ONLY when
    // neither the remote revision nor either database has drifted.
    const same=JSON.stringify(local)===JSON.stringify(remoteProducts);
    // A saved local edit makes accepted.local differ after a reload. The
    // revision + remote digest still prove the cloud baseline was approved.
    // Recover automatic publication without overwriting concurrent edits.
    const continued=accepted?.revision===rev&&accepted.remote===digest(remoteProducts);
    auto=same||continued;
    if(same)remember(rev,local,remoteProducts);
    mark(auto?'Каталог синхронизирован · версия '+rev:'Есть неопубликованные отличия · версия '+rev,!auto);
    tell('Облако: '+remoteProducts.length+' позиций · версия '+rev+'. Локально: '+local.length+'. '+(auto?'Каталоги совпадают, последующие изменения будут публиковаться автоматически.':'Каталоги отличаются. Выбери «Опубликовать» или «Загрузить».'),false);
    await loadDevices();
    // Resume changes saved offline or just before a page reload, but ONLY
    // when the owner-approved remote revision is still unchanged.
    if(auto&&!same){
      tell('Есть локальные изменения. Отправляю их в FARUKH PRINT…');
      setTimeout(()=>{queue=queue.then(()=>publish(true)).catch(e=>tell('Автосинхронизация: '+e.message,true))},0);
    }
    if(typeof window.dispatchEvent==='function')window.dispatchEvent(new Event('farukh-print-owner-authenticated'));
  }catch(e){fetched=false;auto=false;mark('Облако: недоступно',true);if(e.status===401)askForLogin();else tell('Облачный каталог не загружен: '+e.message,true)}
  finally{lock(false);updateState()}
 }
 async function publish(autoMode=false){
  if(!enabled||rev===null)return;
  // Interactive manual publication is confirmed. Automatic publication only
  // happens after the owner has linked identical or explicitly chosen data.
  if(!autoMode&&!confirm('Опубликовать текущую локальную базу на все подключённые устройства? Перед публикацией проверь сроки хранения.'))return;
  const local=read(),originalRev=rev;
  lock(true);mark('Публикую изменения…',true);
  try{
    const out=await api('/admin/catalog',{method:'PUT',body:JSON.stringify({revision:originalRev,products:local})});
    rev=out.revision;remoteProducts=out.products;auto=true;
    remember(rev,local,remoteProducts);
    if(typeof window.dispatchEvent==='function')window.dispatchEvent(new CustomEvent('farukh-print-cloud-catalog',{detail:{products:remoteProducts}}));
    mark('Опубликовано · версия '+rev);
    tell('Опубликована версия '+rev+' · '+out.products.length+' этикеток. Телефоны и планшеты получат обновление.');
  }catch(e){
    auto=false;mark('Изменения не опубликованы',true);if(e.status===401)askForLogin();else tell('База не опубликована: '+e.message+(e.status===409?' Нельзя перезаписывать изменения с другого устройства.':'') ,true);
  }finally{lock(false);updateState()}
 }
 async function download(){
  if(!enabled||!fetched)return;
  if(!confirm('Заменить локальные этикетки ('+read().length+' шт.) облачной базой ('+remoteProducts.length+' шт.)? Сначала скачай резервную копию, если есть свои изменения.'))return;
  try{
    localStorage.setItem(KEY,JSON.stringify(remoteProducts));
    window.dispatchEvent(new StorageEvent('storage',{key:KEY,newValue:JSON.stringify(remoteProducts)}));
    renderLocal?.();
    auto=true;remember(rev,remoteProducts,remoteProducts);
    mark('Каталог синхронизирован · версия '+rev);tell('База загружена из облака. Теперь изменения через управляющий центр будут публиковаться автоматически.');
  }catch(e){tell('Ошибка записи локальной базы: '+e.message,true)}
  updateState();
 }
 async function pair(){
  if(!enabled||loginRequired||!fetched)return;
  if(!remoteProducts.length&&read().length){
    tell('Сначала нажми «Опубликовать локальную базу», чтобы на устройства отправились твои '+read().length+' этикеток, а не пустой каталог.',true);
    return;
  }
  lock(true);
  try{
    const data=await api('/admin/pair',{method:'POST',body:'{}'});
    codeValue.textContent=data.code.replace(/(.{4})/g,'$1 ').trim();
    codeUntil.textContent='Действует до '+time(data.expiresAt)+' (по Москве).';
    codeBox.hidden=false;
    tell('Открой FARUKH PRINT на планшете или телефоне → «Подключить к центру» и введи этот код.');
  }catch(e){if(e.status===401)askForLogin();else tell('Не получилось создать код: '+e.message,true)}
  finally{lock(false);updateState()}
 }
 async function loadDevices(){
  const result=await api('/admin/devices');devices.replaceChildren();
  const active=result.devices.filter(x=>!x.revoked);
  deviceState.textContent='Устройства: '+active.length+' подключено';
  if(!active.length){devices.append(el('p','pcloud-empty','Пока нет подключённых устройств. Создай код подключения.'));return}
  for(const d of active){
    const row=el('div','pcloud-device');const info=el('div');
    info.append(el('strong','',d.name),el('small','','Подключено: '+time(d.createdAt)+' · Последняя синхронизация: '+time(d.lastSeenAt)));
    const revoke=btn('Отключить',async()=>{
      if(!confirm('Отключить синхронизацию для «'+d.name+'»? Уже сохранённые на устройстве этикетки не удалятся.'))return;
      try{await api('/admin/devices/'+encodeURIComponent(d.id),{method:'DELETE',body:'{}'});await loadDevices();tell('Доступ к облачной синхронизации отключён: '+d.name)}
      catch(e){if(e.status===401)askForLogin();else tell('Не удалось отключить устройство: '+e.message,true)}
    },'pcloud-revoke');
    row.append(info,revoke);devices.append(row);
  }
 }
 loginForm.addEventListener('submit',async event=>{
   event.preventDefault();
   if(busy)return;
   const entered=password.value;
   if(!entered){tell('Введи пароль владельца FARUKH AI.',true);return}
   loginButton.disabled=true;
   try{
     const response=await fetch('/api/auth/login',{
       method:'POST',credentials:'same-origin',cache:'no-store',
       headers:{'Content-Type':'application/json'},body:JSON.stringify({password:entered})
     });
     const result=await response.json().catch(()=>({}));
     if(!response.ok)throw Error(result.error||'Не удалось войти как владелец.');
     password.value='';loginRequired=false;loginForm.hidden=true;
     await refreshRemote();
   }catch(e){tell('Вход не выполнен: '+e.message,true);loginRequired=true;loginForm.hidden=false;password.value='';updateState()}
   finally{loginButton.disabled=false}
 });
 window.addEventListener('farukh-print-catalog-local-updated',()=>{
   if(!enabled||!fetched){
     mark('Локальные изменения ожидают подключения',true);
     return;
   }
   mark('Не опубликованы последние изменения',true);
   if(!auto){
     tell('Товары сохранены локально. Нажми «Опубликовать локальную базу», чтобы передать фото и товары подключённым точкам.');
     return;
   }
   // Queue uses latest local state, ensures revision ordering.
   queue=queue.then(()=>publish(true)).catch(e=>tell(e.message,true));
 });
 // Re-fetch devices when the owner returns to the center.
 window.addEventListener('focus',()=>{if(enabled&&fetched&&!busy)void loadDevices().catch(()=>{})});
 let started=false;
 const begin=()=>{if(started)return;if(document.body.dataset.view!=='print-control')return;started=true;void start()};
 // Loading large FARUKH AI data and voice assistant must not wait for cloud.
 begin();
 window.addEventListener('hashchange',begin);
 return {refresh:refreshRemote};
}
