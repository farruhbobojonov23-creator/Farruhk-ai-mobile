/* FARRUH WORKSPACE PRO 1.1 · Supabase cloud sync for user-owned launcher cards.
 * Uses the existing MORE SUSHI authenticated session from the SAME origin.
 * No passwords or secrets in the launcher; project links/logos only.
 * Sync never writes to the TTK or Revision tables.
 * A private table with owner-bound RLS is required.
 */
(function(){
'use strict';
const api='https://mhsmmssipligbmvfzkce.supabase.co';
const key='sb_publishable_JKA5HzoGDIkLxBnctT27hw_TBIqnoc0';
const table='workspace_hub_settings';
const ownerKey='farruh-workspace-local-cloud-owner-v1';
const changedKey='farruh-workspace-local-changed-at-v1';
const cachePrefix='farruh-workspace-cache-';
const $=s=>document.querySelector(s);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let busy=false,ready=false,userId='',token='',dirty=false,localGeneration=0;
let job=null,needsRetry=false;
function status(state,message){
 const card=$('#hubCloudState');const name=$('#hubCloudTitle');const subtitle=$('#hubCloudDetail');
 const settings=$('#hubCloudSyncSummary');
 if(card)card.dataset.state=state;
 if(name)name.textContent=message?.title||'Облако проектов';
 if(subtitle)subtitle.textContent=message?.detail||'';
 if(settings)settings.textContent=message?.detail||'';
 const act=$('#hubCloudSyncNow');
 if(act){act.disabled=busy;act.textContent=busy?'Проверяем…':state==='ok'?'Синхронизировать ↻':state==='login'?'Войти и подключить':'Повторить ↻'}
 const tip=$('#hubCloudLogin');
 if(tip)tip.hidden=state!=='login'&&state!=='error';
}
function message(title,detail){return {title,detail}}
function readSession(){try{return JSON.parse(localStorage.getItem('ms_session')||'null')}catch{return null}}
async function raw(path,options={}){
 const controller=new AbortController();
 const stop=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(api+path,{
   method:options.method||'GET',
   cache:'no-store',
   headers:{apikey:key,...(options.headers||{}),...(options.body!==undefined?{'Content-Type':'application/json'}:{})},
   body:options.body!==undefined?JSON.stringify(options.body):undefined,
   signal:controller.signal
  });
  let payload=null;
  const text=await response.text();
  try{payload=text?JSON.parse(text):null}catch{payload=text}
  if(!response.ok)throw new Error('HTTP '+response.status+(typeof payload?.message==='string'?': '+payload.message:''));
  return payload;
 }finally{clearTimeout(stop)}
}
async function authSession(){
 let session=readSession();
 if(!session?.access_token||!session?.refresh_token)return null;
 if(!session.expires_at||Number(session.expires_at)<Math.floor(Date.now()/1000)+90){
  const next=await raw('/auth/v1/token?grant_type=refresh_token',{
   method:'POST',body:{refresh_token:session.refresh_token}
  });
  if(!next?.access_token)throw new Error('Не удалось обновить авторизацию');
  next.expires_at=next.expires_at||Math.floor(Date.now()/1000)+Number(next.expires_in||3600);
  session={...session,...next};
  // The existing TTK studio uses the same Supabase session and must see
  // the refreshed token; the refresh token is never sent to the cloud table.
  localStorage.setItem('ms_session',JSON.stringify(session));
 }
 const user=await raw('/auth/v1/user',{headers:{Authorization:'Bearer '+session.access_token}});
 if(!user?.id||!uuid.test(user.id))throw new Error('Не удалось подтвердить пользователя');
 return {id:user.id,token:session.access_token};
}
function snapshot(){
 const hub=window.FarruhWorkspace;
 if(!hub?.snapshot)return {projects:[],favorites:[]};
 return hub.snapshot();
}
function setLocal(next){
 window.FarruhWorkspace?.applyCloud?.(next);
}
function safeSettings(rawSettings){
 return {
  projects:Array.isArray(rawSettings?.projects)?rawSettings.projects.slice(0,80):[],
  favorites:Array.isArray(rawSettings?.favorites)?rawSettings.favorites.filter(x=>typeof x==='string').slice(0,150):[]
 };
}
function cleanArray(payload){
 return safeSettings(payload);
}
function getLocalChange(){try{return Number(localStorage.getItem(changedKey)||0)||0}catch{return 0}}
function scopedTo(id){
 try{
  const old=localStorage.getItem(ownerKey);
  if(old&&old!==id){
   localStorage.setItem(cachePrefix+old,JSON.stringify(snapshot()));
   const mine=localStorage.getItem(cachePrefix+id);
   const restore=mine?safeSettings(JSON.parse(mine)):{projects:[],favorites:[]};
   setLocal(restore);
   localStorage.setItem(changedKey,'0');
  }
  localStorage.setItem(ownerKey,id);
 }catch{}
}
function mergeCloud(remote,local,remoteUpdatedAt,localTime){
 const time=new Date(remoteUpdatedAt||0).getTime()||0;
 const localsNewer=localTime>time+500;
 const byId=new Map();
 for(const item of remote.projects)if(item?.id&&typeof item.id==='string')byId.set(item.id,item);
 for(const item of local.projects)if(item?.id&&typeof item.id==='string'){
  if(!byId.has(item.id)||localsNewer)byId.set(item.id,item);
 }
 const favorites=remote.favorites.length
  ?(localsNewer?local.favorites:[...new Set([...remote.favorites,...local.favorites])])
  :local.favorites;
 return cleanArray({projects:[...byId.values()].slice(0,80),favorites});
}
function equal(a,b){return JSON.stringify(a)===JSON.stringify(b)}
async function getRemote(){
 const response=await raw('/rest/v1/'+table+'?select=owner_id,projects,favorites,updated_at&owner_id=eq.'+encodeURIComponent(userId)+'&limit=1',{
  headers:{Authorization:'Bearer '+token}
 });
 if(!Array.isArray(response))throw new Error('Некорректный ответ облака');
 if(response[0]&&response[0].owner_id!==userId)throw new Error('Неверный владелец данных');
 return response[0]||null;
}
async function putRemote(payload){
 const clean=cleanArray(payload);
 if(JSON.stringify(clean).length>170000)throw new Error('Размер данных превышает ограничение облака');
 await raw('/rest/v1/'+table+'?on_conflict=owner_id',{
  method:'POST',
  headers:{Authorization:'Bearer '+token,Prefer:'resolution=merge-duplicates,return=minimal'},
  body:{owner_id:userId,projects:clean.projects,favorites:clean.favorites,updated_at:new Date().toISOString()}
 });
}
function schedulePush(){
 clearTimeout(job);
 if(!ready){needsRetry=true;return}
 job=setTimeout(()=>push(),850);
}
async function push(){
 if(busy){needsRetry=true;return}
 if(!ready||!token||!userId)return;
 busy=true;status('sync',message('Сохраняем проекты…','Отправляем изменения в личное облако'));
 const generation=localGeneration;
 try{
  await putRemote(snapshot());
  try{localStorage.setItem(cachePrefix+userId,JSON.stringify(snapshot()));localStorage.setItem(changedKey,'0')}catch{}
  dirty=localGeneration!==generation;
  status('ok',message('Проекты синхронизированы ✓','Сохранено в личном облаке MORE SUSHI'));
 }catch(e){
  dirty=true;needsRetry=true;
  status('error',message('Сохранено локально','Облако недоступно · повтори синхронизацию'));
 }finally{
  busy=false;
  if(dirty&&needsRetry&&navigator.onLine){needsRetry=false;schedulePush()}
 }
}
async function syncNow(force=false){
 if(busy)return;
 if(!navigator.onLine){
  status('error',message('Сохранено локально','Нет интернета, изменения останутся на устройстве'));
  return;
 }
 busy=true;status('sync',message('Проверяем облако…','Подключаем аккаунт MORE SUSHI'));
 try{
  const session=await authSession();
  if(!session){
   ready=false;token='';userId='';
   status('login',message('Локальный режим','Войди в MORE SUSHI, чтобы сохранить проекты в облаке'));
   return;
  }
  const oldUser=userId;
  userId=session.id;token=session.token;
  if(oldUser!==userId){ready=false;scopedTo(userId)}
  const generationAtStart=localGeneration;
  const row=await getRemote();
  const local=safeSettings(snapshot());
  const remote=safeSettings(row);
  const remoteTime=row?.updated_at||null;
  const merged=row?mergeCloud(remote,local,remoteTime,getLocalChange()):local;
  if(!equal(merged,local))setLocal(merged);
  ready=true;dirty=localGeneration!==generationAtStart;
  const needUpload=!row||!equal(merged,remote)||dirty;
  if(needUpload){
   await putRemote(snapshot());
   try{localStorage.setItem(cachePrefix+userId,JSON.stringify(snapshot()));localStorage.setItem(changedKey,'0')}catch{}
  }
  status('ok',message('Проекты синхронизированы ✓','Сохранено в личном облаке MORE SUSHI'));
  dirty=localGeneration!==generationAtStart;
  if(dirty)needsRetry=true;
 }catch(err){
  ready=false;
  status('error',message('Сохранено локально','Не удалось проверить облако · данные не потеряны'));
 }finally{
  busy=false;
  if(needsRetry&&ready){needsRetry=false;schedulePush()}
 }
}
window.addEventListener('hub:local-saved',()=>{
 localGeneration++;dirty=true;
 try{localStorage.setItem(changedKey,String(Date.now()))}catch{}
 if(ready)schedulePush();
 else if(readSession()?.access_token)syncNow();
});
function scheduleInit(){if(!busy)syncNow()}
$('#hubCloudSyncNow')?.addEventListener('click',()=>{
 if(!readSession()?.access_token){
  const link=$('#hubCloudLogin');
  if(link)link.click();
  else status('login',message('Нужен вход','Открой MORE SUSHI и войди в свой аккаунт'));
 }else syncNow(true)
});
window.addEventListener('storage',event=>{
 if(event.key==='ms_session')setTimeout(scheduleInit,250);
});
window.addEventListener('online',()=>{if(ready&&dirty)schedulePush();else scheduleInit()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&dirty&&ready)schedulePush()});
window.WorkspaceCloud={syncNow,status:()=>({ready,userId,busy,dirty}),table};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleInit,{once:true});
else scheduleInit();
})();