/* MORE SUSHI STUDIO PRO · manual, version-verified WEB interface updates.
   Never treats a plain reload as an update; never clears local data or credentials.
   Native APK updates require a separate Android signed release. */
(function(){
 'use strict';
 const STORAGE_KEY='more-sushi-refresh-result-v2';
 const TIMEOUT=12000;
 const BUILD=document.querySelector('meta[name="mss-ui-build"]')?.content||'unknown';
 const VERSION_URL=new URL('./ocean-ui-version.json',document.baseURI);
 const workspace=Boolean(document.getElementById('mssCategoryApp'));
 const version=workspace ? BUILD.match(/workspace-([\d.]+)-/)?.[1] : null;
 let busy=false;
 let note=null;

 function toast(message,isError=false){
   if(!note){
     note=document.createElement('div');
     note.className='ocean-refresh-toast';
     note.setAttribute('role','status');
     note.setAttribute('aria-live','polite');
     document.body.appendChild(note);
   }
   note.textContent=message;
   note.classList.toggle('error',!!isError);
   note.classList.add('visible');
   clearTimeout(note._tid);
   note._tid=setTimeout(()=>note.classList.remove('visible'),4000);
 }

 function controls(working){
   document.querySelectorAll('[data-ocean-refresh]').forEach(btn=>{
     btn.disabled=working;
     btn.classList.toggle('refreshing',working);
     btn.setAttribute('aria-busy',String(working));
   });
 }
 async function latestBuild(signal){
   const url=new URL(VERSION_URL.href);
   url.searchParams.set('_check',String(Date.now()));
   const response=await fetch(url,{cache:'no-store',signal,headers:{'Cache-Control':'no-cache'}});
   if(!response.ok)throw new Error('HTTP '+response.status);
   const data=await response.json();
   if(!data||typeof data.build!=='string'||!/^[a-z0-9][a-z0-9._-]{5,99}$/i.test(data.build))
     throw new Error('Некорректная версия');
   return data;
 }
 async function checkAndRefresh(){
   if(busy)return;
   busy=true;
   controls(true);
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),TIMEOUT);
   toast('Проверяем новую версию студии…');
   try{
     const latest=await latestBuild(controller.signal);
     if(latest.build===BUILD){
       document.querySelectorAll('[data-ocean-refresh]').forEach(btn=>{
         btn.classList.remove('update-available');
         const label=btn.querySelector('.ocean-refresh-label')||btn.querySelector('.refresh-symbol + span');
         if(label)label.textContent='Обновить';
       });
       toast(version ? 'Workspace '+version+' · актуальная версия ✓' : 'Установлена актуальная версия интерфейса ✓');
       return;
     }
     // This is a web UI update, not a native Android APK installation.
     toast('Новая версия найдена! Загружаем интерфейс…');
     const next=new URL(location.href);
     next.searchParams.set('_fresh',String(Date.now()));
     try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify({target:latest.build,time:Date.now()}))}catch{}
     window.location.replace(next.href); // browser confirms if the editor has unsaved work
   }catch(error){
     toast('Не удалось проверить обновления. Проверь интернет.',true);
   }finally{
     clearTimeout(timer);
     // If the user cancels a navigation confirmation, the button remains usable.
     setTimeout(()=>{busy=false;controls(false)},850);
   }
 }
 function showConfirmedRefresh(){
   try{
     const raw=sessionStorage.getItem(STORAGE_KEY);
     if(!raw)return;
     sessionStorage.removeItem(STORAGE_KEY);
     const result=JSON.parse(raw);
     if(result.target===BUILD&&Date.now()-result.time<120000)
       toast(version ? 'Workspace обновлён до '+version+' ✓' : 'Интерфейс MORE SUSHI STUDIO обновлён ✓');
     else if(result.target!==BUILD && Date.now()-result.time<120000)
       toast('Новая версия ещё загружается на сервер. Попробуй обновить чуть позже.',true);
   }catch{}
 }
 document.addEventListener('click',event=>{
   const button=event.target.closest('[data-ocean-refresh]');
   if(!button)return;
   event.preventDefault();
   if(workspace && /FarruhWorkspaceUpdate\//.test(navigator.userAgent)){
     window.location.assign("farruhworkspace://update");
     return;
   }
   checkAndRefresh();
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showConfirmedRefresh,{once:true});
 else showConfirmedRefresh();
 // The original Android toolbar reloads its WebView. Honour that gesture too.
 if(workspace && /FarruhWorkspaceNative\//.test(navigator.userAgent) && performance.getEntriesByType('navigation')[0]?.type==='reload')
   checkAndRefresh();
 window.MoreSushiWebRefresh=checkAndRefresh;
})();
