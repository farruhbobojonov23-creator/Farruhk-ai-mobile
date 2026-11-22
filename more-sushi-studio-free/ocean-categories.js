/* MORE SUSHI STUDIO PRO · five-section navigation.
   Mobile Android Back now returns to the previous section instead of exiting.
   This code modifies visibility only: no database or TTK records are touched. */
(function(){
 'use strict';
 const keys=new Set(['home','ttk','catalog','pdf','more']);
 if(!document.getElementById('mssCategoryApp'))return;
 function selectedHash(){
   const tab=decodeURIComponent(location.hash.slice(1)||'home');
   return keys.has(tab)?tab:'home';
 }
 function show(tab,recordHistory=false){
   if(!keys.has(tab))tab='home';
 document.documentElement.dataset.mssTab=tab;
   document.querySelectorAll('[data-mss-panel]').forEach(panel=>{
     panel.hidden=panel.dataset.mssPanel!==tab;
   });
   document.querySelectorAll('.bottomnav [data-mss-tab]').forEach(button=>{
     const active=button.dataset.mssTab===tab;
     button.classList.toggle('active',active);
     button.setAttribute('aria-current',active?'page':'false');
     button.setAttribute('aria-pressed',String(active));
   });
   document.querySelectorAll('.mss-feature[data-mss-tab]').forEach(button=>{
     button.setAttribute('aria-pressed',String(button.dataset.mssTab===tab));
   });
   const hero=document.querySelector('.wrap > .hero');
   const metrics=document.querySelector('.wrap > .metrics');
   const tray=document.querySelector('.wrap > .tray');
   if(hero)hero.hidden=tab!=='home';
   if(metrics)metrics.hidden=tab!=='home';
   if(tray)tray.hidden=tab!=='home';
   const note=document.getElementById('mssFutureMessage');
   if(note)note.hidden=true;
   if(recordHistory){
     const target=new URL(location.href);
     target.hash=tab==='home'?'':tab;
     if(target.href!==location.href)history.pushState({mssTab:tab},'',target);
   }
   window.scrollTo({top:0,behavior:'instant'});
 }
 document.addEventListener('click',event=>{
   const target=event.target.closest('[data-mss-tab],[data-mss-future]');
   if(!target)return;
   if(target.dataset.mssTab){show(target.dataset.mssTab,true);return}
   const note=document.getElementById('mssFutureMessage');
   const name=document.getElementById('mssFutureName');
   if(note&&name){
     const panel=target.closest('[data-mss-panel]');
     if(panel)panel.appendChild(note);
     name.textContent=target.dataset.mssFuture;
     note.hidden=false;
     note.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});
   }
 });
 const close=document.getElementById('mssFutureClose');
 if(close)close.addEventListener('click',()=>{
   const note=document.getElementById('mssFutureMessage');
   if(note)note.hidden=true;
 });
 window.addEventListener('hashchange',()=>show(selectedHash()));
 window.addEventListener('popstate',()=>show(selectedHash()));
 show(selectedHash());
})();
