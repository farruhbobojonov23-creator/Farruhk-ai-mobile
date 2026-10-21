import {validateDeviceState} from './device-store.js';

// The owner authorizes a standalone Apps Script once on their own Google account.
// Only explicit opt-in backups are sent. Google/Yandex/TTK sync credentials are
// never included in a backup, and import always MERGES rather than replaces data.
export function makeGoogleBackupSnapshot(state){
 if(!state||typeof state!=='object')throw Error('Сначала загрузите данные устройства.');
 const clean=structuredClone(state);
 delete clean.googleBackup;
 delete clean.googleSync;
 delete clean.googleDelivery;
 return {version:1,createdAt:new Date().toISOString(),state:clean};
}
export function explainBackupEndpoint(value){
 const text=String(value||'').trim();
 if(!text)return 'Нужен URL опубликованного веб-приложения Google Apps Script.';
 let url;
 try{url=new URL(text)}catch{return 'Некорректная ссылка. Нужен URL вида https://script.google.com/macros/s/…/exec.'}
 if(url.hostname==='drive.google.com')
  return 'Это ссылка на папку Google Диска, а не адрес подключения. Открой Google Apps Script → Развертывание → Управление развертываниями → Веб-приложение → скопируй URL, который заканчивается на /exec.';
 if(url.protocol!=='https:'||url.hostname!=='script.google.com'||
    url.username||url.password||url.port||url.search||url.hash||
    !/^\/macros\/s\/[A-Za-z0-9_-]{15,}\/exec$/.test(url.pathname))
  return 'Здесь нужен URL веб-приложения Google Apps Script вида https://script.google.com/macros/s/…/exec. Ссылка на проект или папку не подходит.';
 return '';
}
export function mountGoogleDriveBackup({getState,store,onState,notify,settingsDialog,importData,downloadFile}){
 const dialog=document.createElement('dialog');
 dialog.className='category-dialog google-backup-dialog';
 dialog.setAttribute('aria-label','Резервные копии Google Диск');
 dialog.innerHTML=`<div class="bar"><h2>Google Диск · резервные копии</h2><button type="button" data-close aria-label="Закрыть">✕</button></div>
 <p class="small">Бесплатный Google Диск. Копируются техкарты, ХАССП, задачи и история — без удаления или замены записей. Старые файлы Яндекс Диска не затрагиваются.</p>
 <p class="small"><a href="/google-backup-setup.html" target="_blank" rel="noopener">Как один раз подключить свой Google Диск ↗</a></p>
 <form data-connect>
  <label>Адрес опубликованного веб-приложения (оканчивается на /exec)<input name="endpoint" type="url" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="url" required></label>
  <p class="small google-backup-hint">Ссылка <strong>drive.google.com/drive/folders/…</strong> не подходит. Нужен адрес из <a href="https://script.google.com/home/start" target="_blank" rel="noopener">Google Apps Script → Развертывание → Управление развертываниями ↗</a>.</p>
  <label>Личный ключ подключения<input name="key" type="password" minlength="24" maxlength="200" autocomplete="off" required></label>
  <label class="voice-check"><input name="enabled" type="checkbox" checked style="width:auto"> Создавать резервную копию примерно раз в сутки, пока приложение открыто и есть интернет</label>
  <div class="bar"><button type="submit" class="primary">Проверить и подключить</button><button type="button" data-disable>Отключить автокопии</button></div>
 </form>
 <div class="bar"><button type="button" data-save>Создать копию сейчас</button><button type="button" data-list>Показать копии из Google</button></div>
 <p data-status class="small" role="status" aria-live="polite">Google Диск не подключён.</p><div data-files class="panel"></div>
 <p class="small">Копии доступны только после подключения. Перед восстановлением приложение предложит сохранить локальную копию. Автокопирование работает при открытом приложении.</p>`;
 settingsDialog.after(dialog);
 const form=dialog.querySelector('[data-connect]');
 const close=dialog.querySelector('[data-close]'),disable=dialog.querySelector('[data-disable]');
 const buttonSave=dialog.querySelector('[data-save]'),buttonList=dialog.querySelector('[data-list]');
 const status=dialog.querySelector('[data-status]'),files=dialog.querySelector('[data-files]');
 const buttonOpen=document.createElement('button');
 buttonOpen.type='button';buttonOpen.textContent='Google Диск · резервные копии';buttonOpen.className='google-backup-open';
 const toolsArea=document.getElementById('device-export')?.parentElement||settingsDialog;
 toolsArea.append(buttonOpen);
 const config=()=>getState()?.googleBackup;
 let running=false,timer=null;
 const respond=(message,error=false)=>{status.textContent=message;status.dataset.error=String(error);if(error)notify(message,true)};
 const request=async(action,config,payload={})=>{
  const response=await fetch('/api/backups/google-drive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:config.endpoint,key:config.key,action,...payload}),signal:AbortSignal.timeout(60000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok!==true)throw Error(data.error||'Google Диск не подтвердил операцию.');
  return data;
 };
 const persist=async(update)=>{
  const next=await store.mutate(update);
  onState(next);
 };
 function refresh(){
  const c=config();
  form.elements.endpoint.value=c?.endpoint||'';
  form.elements.key.value=c?.key||'';
  form.elements.enabled.checked=c?.enabled!==false;
  const last=c?.lastBackupAt?new Date(c.lastBackupAt).toLocaleString('ru-RU'):'ещё не создавалась';
  status.textContent=c?.endpoint?(c.enabled?'Автоматические копии включены':'Автоматические копии выключены')+'. Последняя подтверждённая: '+last:'Google Диск пока не подключён.';
  buttonSave.disabled=!c?.endpoint;
  buttonList.disabled=!c?.endpoint;
 }
 buttonOpen.onclick=()=>{refresh();settingsDialog.close();dialog.showModal()};
 close.onclick=()=>dialog.close();
 form.onsubmit=async event=>{
  event.preventDefault();const submit=form.querySelector('button[type=submit]');submit.disabled=true;
  try{
   respond('Проверяю связь с Google Диском…');
   const next={endpoint:form.elements.endpoint.value.trim(),key:form.elements.key.value.trim(),enabled:form.elements.enabled.checked};
   const endpointError=explainBackupEndpoint(next.endpoint);
   if(endpointError)throw Error(endpointError);
   const check=await request('check',next);
   await persist(state=>{
    const old=state.googleBackup;
    state.googleBackup={...next,
      lastBackupAt:old?.endpoint===next.endpoint&&old?.key===next.key?old.lastBackupAt:null,
      lastBackupId:old?.endpoint===next.endpoint&&old?.key===next.key?old.lastBackupId:null
    };
   });
   respond('Google Диск подключён: '+check.folderName+'. Ключ хранится только на этом устройстве.');
   schedule();
  }catch(error){respond('Не удалось подключить Google: '+error.message,true)}
  finally{submit.disabled=false;buttonSave.disabled=!config()?.endpoint;buttonList.disabled=!config()?.endpoint}
 };
 disable.onclick=async()=>{
  try{await persist(s=>{if(s.googleBackup)s.googleBackup.enabled=false});refresh();respond('Автоматические копии выключены. Ранее сохранённые файлы Google не удалены.')}
  catch(e){respond(e.message,true)}
 };
 async function backup({manual=false}={}){
  const c=config();
  if(!getState()||!c?.endpoint||running||!navigator.onLine)return false;
  if(!manual&&!c.enabled)return false;
  const last=Date.parse(c.lastBackupAt||'');
  if(!manual&&Number.isFinite(last)&&Date.now()-last<24*3600*1000)return false;
  running=true;buttonSave.disabled=true;
  try{
   respond('Сохраняю резервную копию в Google Диск…');
   const snapshot=makeGoogleBackupSnapshot(getState());
   const result=await request('backup',c,{snapshot});
   await persist(s=>{
    if(s.googleBackup?.endpoint!==c.endpoint||s.googleBackup?.key!==c.key)return;
    s.googleBackup.lastBackupAt=result.createdAt||new Date().toISOString();
    s.googleBackup.lastBackupId=result.id;
   });
   respond('✅ Google подтвердил сохранение: '+result.name);
   return true;
  }catch(err){respond('Копия не подтверждена: '+err.message,true);return false}
  finally{running=false;buttonSave.disabled=!config()?.endpoint}
 }
 buttonSave.onclick=()=>backup({manual:true});
 buttonList.onclick=async()=>{
  const c=config();if(!c?.endpoint)return;
  buttonList.disabled=true;files.replaceChildren();respond('Загружаю список копий…');
  try{
   const result=await request('list',c);
   respond('Найдено копий: '+result.items.length+'. Google хранит предыдущие файлы — они не удаляются автоматически.');
   if(!result.items.length)files.textContent='Резервных копий пока нет.';
   for(const item of result.items){
    if(!/^[\w-]{15,130}$/.test(item.id))continue;
    const row=document.createElement('div');row.className='row';
    const label=document.createElement('span');
    const date=Date.parse(item.createdAt);
    label.textContent=(Number.isFinite(date)?new Date(date).toLocaleString('ru-RU')+' · ':'')+item.name;
    const dl=document.createElement('button');dl.type='button';dl.textContent='Скачать';
    dl.onclick=async()=>{
     dl.disabled=true;
     try{
      const d=await request('fetch',c,{backupId:item.id});
      const content=JSON.stringify(d.snapshot,null,2);
      const blob=new Blob([content],{type:'application/json'});
      downloadFile(blob,'FARRUH_AI_Google_'+(item.createdAt||new Date().toISOString()).slice(0,10)+'.json');
      respond('Копия подготовлена для скачивания. Её можно импортировать через «Данные устройства».');
     }catch(e){respond('Не удалось скачать копию: '+e.message,true)}
     finally{dl.disabled=false}
    };
    const restore=document.createElement('button');restore.type='button';restore.textContent='Объединить';
    restore.onclick=async()=>{
     if(!confirm('Объединить эту копию Google с данными устройства? Существующие записи останутся. Перед продолжением сохраните локальную копию.'))return;
     restore.disabled=true;
     try{
      const data=await request('fetch',c,{backupId:item.id});
      const checked=validateDeviceState(data.snapshot);
      // Create a local download BEFORE modifying IndexedDB. Never clear state.
      downloadFile(new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),state:getState()},null,2)],{type:'application/json'}),'FARRUH_AI_before_restore_'+new Date().toISOString().slice(0,10)+'.json');
      await importData({version:1,state:checked});
      respond('✅ Данные Google объединены с устройством. Существующие записи не удалялись.');
     }catch(e){respond('Восстановление не выполнено: '+e.message,true)}
     finally{restore.disabled=false}
    };
    row.append(label,dl,restore);files.append(row);
   }
  }catch(e){respond('Не удалось получить список: '+e.message,true)}
  finally{buttonList.disabled=!config()?.endpoint}
 };
 function schedule(){
  clearTimeout(timer);
  timer=setTimeout(()=>backup().catch(e=>respond(e.message,true)),5000);
 }
 window.addEventListener('online',schedule);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
 setInterval(()=>{if(!document.hidden)schedule()},30*60*1000);
 return {schedule,render:refresh,backup};
}
