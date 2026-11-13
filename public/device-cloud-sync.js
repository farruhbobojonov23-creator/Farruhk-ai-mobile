import {validateDeviceState} from './device-store.js?v=72';
import {LIST_FIELDS,pickSyncSnapshot,reconcileSnapshots} from './device-sync-merge.js?v=1';

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
    const existing=validateDeviceState(get.result,{clone:false});
    if(existing.revision!==expectedRevision){
     error=Object.assign(Error('За время синхронизации данные изменились на устройстве.'),{code:'STALE'});
     tx.abort();return;
    }
    const patch={};
    for(const key of LIST_FIELDS)patch[key]=merged[key];
    if(merged.siteSettings!==undefined)patch.siteSettings=merged.siteSettings;
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

export function mountDeviceCloudSync({store,getState,onState,settingsDialog,notify,downloadFile}){
 const node=document.createElement('details');node.className='panel';
 node.innerHTML='<summary>☁️ Единая база на телефоне и планшете</summary>'+
  '<p class="small">Техкарты, полуфабрикаты, проекты, категории, шаблоны и настройки. Данные двух устройств объединяются без замены всей базы; при конфликте сохранение блокируется. Личные ключи Google не отправляются.</p>'+
  '<div class="bar"><button type="button" data-toggle-sync></button><button type="button" data-sync-now>Синхронизировать сейчас</button></div>'+
  '<p class="small" data-sync-status role="status">Синхронизация выключена.</p>';
 settingsDialog.append(node);
 const toggle=node.querySelector('[data-toggle-sync]');
 const manual=node.querySelector('[data-sync-now]');
 const status=node.querySelector('[data-sync-status]');
 let running=false,queued=false,timer=null,lastError='';
 const enabled=()=>localStorage.getItem(ENABLED_KEY)==='true';
 function paint(message){
  toggle.textContent=enabled()?'Выключить синхронизацию':'Включить синхронизацию';
  manual.disabled=running||!enabled();
  status.textContent=message||(enabled()?'Синхронизация включена.':'Синхронизация выключена.');
 }
 async function once(){
  if(!enabled()||!getState()||running)return;
  running=true;manual.disabled=true;paint('Проверяю устройства и облачную базу…');
  try{
   const local=await store.load();
   const originalRevision=local.revision;
   const base=await readBase(store);
   const ours=pickSyncSnapshot(local,projectCatalog());
   const cloud=await request('/api/device-sync');
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
   paint('✅ Синхронизировано: '+new Date().toLocaleTimeString('ru-RU')+'. ТТК: '+(merged.recipes?.length||0)+'.');
   if(projectChanged){setTimeout(()=>location.reload(),200);return;}
  }catch(error){
   lastError=error.message||String(error);
   paint('⚠️ '+lastError);
   if(isStale(error)||error.status===409)queued=true;
  }finally{
   running=false;manual.disabled=!enabled();
   if(queued){queued=false;schedule(900);}
  }
 }
 function schedule(delay=1500){
  if(!enabled()||!getState())return;
  if(running){queued=true;return;}
  clearTimeout(timer);timer=setTimeout(once,delay);
 }
 toggle.onclick=async()=>{
  if(enabled()){localStorage.removeItem(ENABLED_KEY);clearTimeout(timer);paint();return;}
  // Download a non-destructive safety copy before the first merge.
  const snapshot=await store.load();
  downloadFile(new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),state:snapshot},null,2)],{type:'application/json'}),
   'FARRUH_AI_before_cloud_sync_'+new Date().toISOString().slice(0,10)+'.json');
  localStorage.setItem(ENABLED_KEY,'true');paint('Сохранили копию устройства. Подключаю синхронизацию…');schedule(100);
 };
 manual.onclick=()=>{schedule(0)};
 window.addEventListener('online',()=>schedule(400));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(300)});
 setInterval(()=>{if(!document.hidden)schedule(0)},60000);
 paint();
 return {schedule,start:()=>schedule(600),status:()=>lastError};
}
