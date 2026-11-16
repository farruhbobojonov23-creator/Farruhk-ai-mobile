import {setDeviceSyncStatus} from './device-sync-status.js?v=1';
import {validateDeviceState} from './device-store.js?v=72';
import {LIST_FIELDS,pickSyncSnapshot,reconcileSnapshots} from './device-sync-merge.js?v=2';

const BASE_KEY='device-cloud-sync-base-v1';
const ENABLED_KEY='farruh-device-cloud-sync-enabled-v1';
const PROJECT_KEY='farruh-ai-project-catalog-v1';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const isStale=error=>error?.code==='STALE';

function projectCatalog(){
 try{return JSON.parse(localStorage.getItem(PROJECT_KEY)||'null')||{}}
 catch{return {}}
}

function putProjectCatalog(snapshot){
 const previous=projectCatalog(),selected=previous.selected;
 const projects=snapshot?.projectCatalog?.projects||[];
 const next={projects,selected:projects.some(p=>p.id===selected)?selected:projects[0]?.id};
 if(!same(previous.projects||[],projects)) {
  localStorage.setItem(PROJECT_KEY,JSON.stringify(next));
  return true;
 }
 return false;
}

async function readBase(store){
 const db=await store.open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('records','readonly'),get=tx.objectStore('records').get(BASE_KEY);
  get.onsuccess=()=>resolve(get.result||null);
  get.onerror=tx.onerror=()=>reject(Error('Не удалось прочитать контрольную версию синхронизации.'));
 });
}

async function commitSync(store,expectedRevision,merged){
 const db=await store.open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('records','readwrite'),records=tx.objectStore('records');
  const get=records.get('state');let newState=null,error=null;
  get.onsuccess=()=>{
   try{
    const existing=validateDeviceState(get.result===undefined?{tasks:[],recipes:[],chat:[]}:get.result,{clone:false});
    if(existing.revision!==expectedRevision){
     error=Object.assign(Error('За время синхронизации данные изменились на устройстве.'),{code:'STALE'});
     tx.abort();return;
    }
    const patch={};
    // Local-only deletion must never erase another device's cloud copy.
    const hidden=new Set(Object.keys(existing.localOnlyDeletedIds||{}).filter(id=>existing.localOnlyDeletedIds[id]));
    for(const key of LIST_FIELDS){
     if(key==='categories'&&merged.categories===undefined)continue;
     patch[key]=(key==='recipes'||key==='releasedRecipes')&&Array.isArray(merged[key])
      ?merged[key].filter(recipe=>!hidden.has(recipe.id)):merged[key];
    }
    if(merged.siteSettings!==undefined)patch.siteSettings=merged.siteSettings;
    if(Array.isArray(merged.deletedRecipeIds))patch.deletedRecipeIds=merged.deletedRecipeIds;
    const changed=Object.keys(patch).some(key=>!same(existing[key],patch[key]));
    newState=changed?validateDeviceState({...existing,...patch,revision:existing.revision+1,updatedAt:new Date().toISOString()},{clone:false}):existing;
    if(changed)records.put(newState,'state');
    records.put(merged,BASE_KEY);
   }catch(e){error=e;tx.abort();}
  };
  tx.oncomplete=()=>resolve(newState);
  tx.onerror=tx.onabort=()=>reject(error||Error('Не удалось сохранить синхронизированную копию на устройстве.'));
 });
}

async function request(url,options={}){
 const response=await fetch(url,{...options,cache:'no-store',credentials:'same-origin',
  signal:AbortSignal.timeout(60000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.ok!==true){
  const e=Error(data.error||'Облачная синхронизация недоступна.');
  e.status=response.status;throw e;
 }
 return data;
}

export function mountDeviceCloudSync({store,getState,onState,settingsDialog,notify,downloadFile,panelRoot=null}){
 const node=document.createElement('details');node.className='panel';node.id='device-cloud-sync-settings';
 node.innerHTML='<summary>☁️ Единая база на телефоне и планшете</summary>'+
  '<p class="small">Техкарты, полуфабрикаты, проекты, категории, шаблоны и настройки. Данные двух устройств объединяются без замены всей базы; при конфликте сохранение блокируется. Личные ключи Google не отправляются.</p>'+
  '<div class="bar"><button type="button" data-toggle-sync></button><button type="button" data-sync-now>Синхронизировать сейчас</button></div>'+
  '<p class="small" data-sync-status role="status">Синхронизация выключена.</p>';
 (panelRoot||settingsDialog).append(node);
 const googleStatus=document.createElement('p');googleStatus.className='small';googleStatus.setAttribute('role','status');node.append(googleStatus);
 const toggle=node.querySelector('[data-toggle-sync]');
 const manual=node.querySelector('[data-sync-now]');
 const status=node.querySelector('[data-sync-status]');
 let running=false,queued=false,timer=null,lastError='',pendingRevision=null,errorNotified=false;
 // Cloud sync is the default for the signed-in owner. An explicit switch-off is respected.
 const enabled=()=>localStorage.getItem(ENABLED_KEY)!=='false';
 function paint(message){
  toggle.textContent=enabled()?'Выключить синхронизацию':'Включить синхронизацию';
  manual.disabled=running||!enabled();
  status.textContent=message||(enabled()?'Синхронизация включена.':'Синхронизация выключена.');
  const state=getState(),google=state?.googleSync;
  const readyCount=(state?.recipes||[]).filter(r=>r.status==='ready').length;
  const draftCount=(state?.recipes||[]).filter(r=>r.status!=='ready'&&!r.archived).length;
  googleStatus.textContent=(!google?.enabled||!google?.endpoint||!google?.key)
   ?'Google Документы: не подключены. Эта кнопка синхронизирует телефон и планшет, но не создаёт файлы Google. Для подключения откройте «Подключение Google Документов» в настройках.'
   :'Google Документы: отдельная отправка. Готовых ТТК: '+readyCount+'; в разработке: '+draftCount+'. Черновики остаются в Farukh AI. Статус отправки — в разделе «Техкарты → Облачные копии и готовые версии ТТК».';

 }
 async function once(){
  if(!enabled()||!getState()||running)return;
  running=true;setDeviceSyncStatus('checking');manual.disabled=true;paint('Проверяю устройства и облачную базу…');
  try{
   const local=await store.load();
   const originalRevision=local.revision;
   const base=await readBase(store);
   const ours=pickSyncSnapshot(local,projectCatalog());
   const cloud=await request('/api/device-sync');
   // Mirror remotely stored records during reconciliation for recipes deleted
   // on this phone ONLY, so no unintended cloud deletion is submitted.
   const hidden=new Set(Object.keys(local.localOnlyDeletedIds||{}).filter(id=>local.localOnlyDeletedIds[id]));
   for(const field of ['recipes','releasedRecipes']){
    for(const row of cloud.snapshot?.[field]||[]){
     if(hidden.has(row.id)&&!ours[field]?.some(item=>item.id===row.id)){
      ours[field]??=[];ours[field].push(structuredClone(row));
     }
    }
   }
   const merged=reconcileSnapshots(base,ours,cloud.snapshot);
   // Optimistic revision check on the server prevents lost writes if another
   // phone saves between the GET and PUT.
   if(!same(merged,cloud.snapshot)){
    await request('/api/device-sync',{method:'PUT',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({revision:cloud.revision,snapshot:merged})});
   }
   const localChanged=!same(ours,merged);
   const next=await commitSync(store,originalRevision,merged);
   const projectChanged=putProjectCatalog(merged);
   if(localChanged)onState(next);
   lastError='';
   setDeviceSyncStatus('ok');
   // Confirm cloud storage only after the remote GET/PUT and the local
   // revision-safe commit have both succeeded. Never show a false green tick.
   if(pendingRevision!==null && next.revision>=pendingRevision && getState()?.revision<=next.revision){
    pendingRevision=null;errorNotified=false;
    notify('✅ Сохранено в облаке и на устройстве.');
   }
   const connection=document.getElementById('connection');if(connection)connection.textContent='☁️ Облачная синхронизация';
   paint('✅ База Farukh AI синхронизирована: '+new Date().toLocaleTimeString('ru-RU')+'. ТТК: '+(merged.recipes?.length||0)+'. Google Документы проверяются отдельно.');
   document.dispatchEvent(new Event('farruh:device-cloud-synced'));
   if(projectChanged){
    const editor=document.getElementById('editor');
    if(editor&&!editor.hidden){paint('✅ Проекты объединены. Обновите страницу после сохранения открытой ТТК.');return;}
    setTimeout(()=>location.reload(),200);return;
   }
  }catch(error){
   lastError=error.message||String(error);
   setDeviceSyncStatus('error');
   if(pendingRevision!==null&&!errorNotified){
    notify('⚠️ На устройстве сохранено, но облако не подтвердило: '+lastError,true);
    errorNotified=true;
   }
   const connection=document.getElementById('connection');if(connection)connection.textContent='На устройстве · облако недоступно';
   paint('⚠️ '+lastError);
   if(isStale(error)||error.status===409)queued=true;
  }finally{
   running=false;manual.disabled=!enabled();
   if(queued){queued=false;schedule(900);}
  }
 }
 function confirmSaved(){
  pendingRevision=getState()?.revision??null;
  errorNotified=false;
  if(!enabled()){notify('⚠️ Сохранено только на устройстве: облачная синхронизация выключена.',true);return;}
  schedule(0);
 }
 function schedule(delay=1500){
  if(!enabled()||!getState())return;
  if(running){queued=true;return;}
  clearTimeout(timer);timer=setTimeout(once,delay);
 }
 toggle.onclick=async()=>{
  if(enabled()){localStorage.setItem(ENABLED_KEY,'false');clearTimeout(timer);setDeviceSyncStatus('unknown');paint();return;}
  // Download a non-destructive safety copy before the first merge.
  const snapshot=await store.load();
  downloadFile(new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),state:snapshot},null,2)],{type:'application/json'}),
   'FARRUH_AI_before_cloud_sync_'+new Date().toISOString().slice(0,10)+'.json');
  localStorage.setItem(ENABLED_KEY,'true');setDeviceSyncStatus('unknown');paint('Сохранили копию устройства. Подключаю синхронизацию…');schedule(100);
 };
 manual.onclick=()=>{schedule(0)};
 document.addEventListener('farruh:projects-changed',()=>schedule(400));
 window.addEventListener('online',()=>schedule(400));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(300)});
 setInterval(()=>{if(!document.hidden)schedule(0)},60000);
 paint();
 const open=()=>{
  if(!settingsDialog.open)settingsDialog.showModal();
  node.open=true;
  node.scrollIntoView({block:'start',behavior:'auto'});
  node.querySelector('summary')?.focus?.({preventScroll:true});
 };
 return {schedule,start:()=>schedule(600),status:()=>lastError,isEnabled:enabled,confirmSaved,open};
}
