/* MORE SUSHI & FARUKH REVISION — premium entry + slow typing effects.
 * PRESENTATION ONLY: does not read or change cloud, tables, balances, drafts,
 * authentication, update/install, or navigation data.
 * All original text nodes are restored; buttons remain clickable.
 */
(()=>{
 'use strict';
 const root=document.documentElement,body=document.body;
 if(!body)return;
 const revision=body.classList.contains('revision-crimson');
 const mobile=!revision&&Boolean(document.getElementById('mssCategoryApp'));
 const studio=!revision&&!mobile&&root.classList.contains('ocean-app');
 if(!revision&&!mobile&&!studio)return;
 // Reduced-motion normally wins. A user's explicit «Повторить заставку»
 // click may opt in for this browser session without changing Android settings.
 let optedIn=false;
 try{optedIn=sessionStorage.getItem('mss-explicit-motion-optin')==='1'}catch{}
 if(optedIn)root.classList.add('premium-motion-optin');
 const reduced=!optedIn&&window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
 const jobs=new Set(),queued=new Set();
 let generation=0,lastView='',homeTypedOnce=false;
 const graphemes=value=>{
   try{return Array.from(new Intl.Segmenter('ru',{granularity:'grapheme'}).segment(value),s=>s.segment)}
   catch{return Array.from(value)}
 };
 function release(job){
   if(job.done)return;
   job.done=true;
   clearTimeout(job.timer);
   const {el,node,full,priorHeight,hadLabel,oldLabel}=job;
   // If the real application changed this node (mode switch, cloud refresh),
   // NEVER restore our old decorative copy over the updated business text.
   if(node&&node.isConnected&&node.nodeValue===job.lastWritten)node.nodeValue=full;
   if(el&&el.isConnected){
     el.classList.remove('premium-typing');
     if(priorHeight)el.style.minHeight=priorHeight;else el.style.removeProperty('min-height');
     if(hadLabel)el.setAttribute('aria-label',oldLabel);else el.removeAttribute('aria-label');
   }
   jobs.delete(job);
 }
 function cancel(){
   generation++;
   queued.forEach(clearTimeout);queued.clear();
   for(const job of [...jobs])release(job);
 }
 function schedule(fn,delay){
   const id=setTimeout(()=>{queued.delete(id);fn()},delay);
   queued.add(id);
   return id;
 }
 function animateNode(el,gen,speed){
   if(gen!==generation||!el?.isConnected||el.closest('[hidden],.hide'))return;
   if(el.matches('input,button,select,textarea,[contenteditable], [aria-live]'))return;
   const node=Array.from(el.childNodes).find(n=>n.nodeType===3&&n.nodeValue.trim().length>=3);
   if(!node)return;
   const full=node.nodeValue;
   const match=full.match(/^(\s*)([\s\S]*?)(\s*)$/);
   if(!match)return;
   const [,leading,text,trailing]=match,chars=graphemes(text);
   if(chars.length<3||chars.length>75)return;
   const hadLabel=el.hasAttribute('aria-label'),oldLabel=el.getAttribute('aria-label');
   const priorHeight=el.style.minHeight;
   const measured=Math.ceil(el.getBoundingClientRect().height);
   if(measured>0)el.style.minHeight=measured+'px';
   if(!hadLabel)el.setAttribute('aria-label',text);
   const job={el,node,full,priorHeight,hadLabel,oldLabel,lastWritten:leading,timer:null,done:false};
   jobs.add(job);
   node.nodeValue=leading;
   el.classList.add('premium-typing');
   let idx=0;
   const step=()=>{
     if(job.done)return;
     if(node.nodeValue!==job.lastWritten){release(job);return;}
     if(gen!==generation||!el.isConnected||el.closest('[hidden],.hide')||document.hidden){
       release(job);return;
     }
     idx=Math.min(chars.length,idx+1);
     node.nodeValue=leading+chars.slice(0,idx).join('')+trailing;
     job.lastWritten=node.nodeValue;
     if(idx===chars.length){release(job);return;}
     job.timer=setTimeout(step,speed);
   };
   step();
 }
 function typeBatch(targets,{speed=63,stagger=95,cap=19}={}){
   cancel();
   if(reduced)return;
   const gen=generation;
   const elements=[...new Set(targets)].filter(el=>el&&el.isConnected&&!el.closest('[hidden],.hide')).slice(0,cap);
   elements.forEach((el,i)=>schedule(()=>animateNode(el,gen,i<2?Math.max(speed,75):speed),Math.min(i*stagger,1050)));
 }
 const select=(query,scope=document)=>Array.from(scope.querySelectorAll(query));
 // Presentation-only stagger: never changes text, data, click handlers or DOM hierarchy.
 function fadeBatch(targets,{start=0,stagger=90,cap=20}={}){
   if(reduced)return;
   const elements=[...new Set(targets)].filter(el=>el?.isConnected&&!el.closest('[hidden],.hide')).slice(0,cap);
   for(const [i,el] of elements.entries()){
     el.classList.remove('mss-cinema-visible');
     el.classList.add('mss-cinema-reveal');
     el.style.setProperty('--mss-cinema-delay',Math.min(start+i*stagger,1250)+'ms');
     // Restart the entrance if a user returns to a tab; no layout dimensions change.
     void el.offsetWidth;
     el.classList.add('mss-cinema-visible');
   }
 }
 function runView(view){
   if(reduced)return;
   lastView=view;
   if(mobile){
     // Film-like typewriter is reserved for the FIRST part of the home screen.
     // Revisiting Home, and every other tab, never types labels or card text.
     if(view==='home'){
       if(!homeTypedOnce){
         homeTypedOnce=true;
         typeBatch(select('.brand-top,.brand-mid,.brandtext>small,.hero-kicker,.hero-copy h1,.hero-copy h1 em,.hero-copy h1 .hero-ttk,.hero-copy p,.hero-copy p .hero-pdf-line'),{speed:69,stagger:150,cap:9});
       }else cancel();
       fadeBatch(select('.ruby-header .logo,.ruby-header .settings-shortcut,.hero .hero-photo,.hero .hero-stamp'),{start:50,stagger:135,cap:4});
       fadeBatch([...select('.cloudbar'),...select('#mss-home .metrics .metric'),...select('#mss-home .home-heading'),...select('#mss-home .mss-feature'),...select('#mss-home .continue-work')],{start:420,stagger:90,cap:18});
     }else{
       cancel();
       const panel=document.getElementById('mss-'+view);
       if(panel)fadeBatch([...select('.mss-title',panel),...select('.mss-card',panel)],{start:30,stagger:105,cap:18});
     }
     return;
   }
   if(revision){
     // Inventory reports must be readable instantly. The slow typewriter made product
     // names, dates and currency totals temporarily appear truncated on Android.
     // Preserve the approved cinematic launch screen, but never type live work data.
     cancel();
     return;
   }
   if(studio){
     typeBatch(select('.topbar h1,.page-head h2,.page-head p,.card h2,.card h3,.empty-state strong').filter(el=>!el.closest('[hidden],.hide')),{speed:86,stagger:140,cap:12});
   }
 }
 function bootText(el,text,delay,speed){
   if(!el)return;
   const chars=graphemes(text);
   el.textContent='';
   let i=0;
   const step=()=>{
     if(!el.isConnected||!document.getElementById('premiumBoot'))return;
     el.textContent=chars.slice(0,++i).join('');
     if(i<chars.length)schedule(step,speed);
   };
   schedule(step,delay);
 }
 function start(){
   if(mobile&&!reduced)root.classList.add('mss-cinematic-mode');
   // Replay from More > Effects; this also creates a fresh URL in Android WebView.
   document.addEventListener('click',event=>{
     const replay=event.target.closest?.('[data-premium-replay]');
     if(!replay)return;
     event.preventDefault();
     try{sessionStorage.setItem('mss-explicit-motion-optin','1')}catch{}
     const url=new URL(location.href);
     url.searchParams.set('_replay',Date.now().toString());
     if(mobile)url.hash='';
     location.assign(url.href);
   });
   if(revision){
     const oldGo=window.go;
     if(typeof oldGo==='function'&&!oldGo.__premiumWrapped){
       const wrapped=function(view,button){
         const result=oldGo.apply(this,arguments);
         // Data has already been rendered by the original app. Effects are non-blocking.
         schedule(()=>runView(view),90);
         return result;
       };
       wrapped.__premiumWrapped=true;window.go=wrapped;
     }
   }else if(mobile){
     document.addEventListener('click',event=>{
       const tab=event.target.closest?.('[data-mss-tab]')?.dataset?.mssTab;
       if(tab)runView(tab);
     });
     window.addEventListener('hashchange',()=>runView(root.dataset.mssTab||'home'));
     window.addEventListener('popstate',()=>runView(root.dataset.mssTab||'home'));
   }else if(studio){
     document.addEventListener('click',event=>{
       if(event.target.closest?.('[data-nav]'))schedule(()=>runView('studio'),115);
     });
   }
   const initial=revision?'summary':mobile?(root.dataset.mssTab||'home'):'studio';
   const overlay=document.getElementById('premiumBoot');
   // Preserve the approved cinematic welcome on the FIRST entry only.
   // An app switching back from another section should not block work for 4 sec.
   let alreadySeen=false;
   if(revision){
     try{alreadySeen=sessionStorage.getItem('farukh-revision-boot-seen-v068')==='1'}catch{}
   }
   const replay=revision&&new URL(location.href).searchParams.has('_replay');
   if(!overlay||reduced||(revision&&alreadySeen&&!replay)){
     overlay?.remove();
     schedule(()=>runView(initial),170);
     return;
   }
   // The splash is cosmetic, skippable, and not a fake cloud verification.
   let finished=false;
   const close=()=>{
     if(finished)return;
     finished=true;
     if(revision)try{sessionStorage.setItem('farukh-revision-boot-seen-v068','1')}catch{}
     overlay.classList.add('is-leaving');
     const finish=()=>{overlay.remove();runView(revision?'summary':mobile?(root.dataset.mssTab||'home'):'studio')};
     // Splash cleanup must not be cancelled by a background visibility event.
     setTimeout(finish,560);
   };
   const closeTimer=setTimeout(close,3650);
   overlay.querySelector('[data-boot-skip]')?.addEventListener('click',()=>{
     clearTimeout(closeTimer);
     close();
   },{once:true});
   bootText(overlay.querySelector('[data-boot-title]'),revision?'FARUKH REVISION PRO':'MORE SUSHI STUDIO PRO',180,75);
   bootText(overlay.querySelector('[data-boot-sub]'),revision?'КОНТРОЛЬ ОСТАТКОВ НА СКЛАДЕ':'ПРОФЕССИОНАЛЬНАЯ СТУДИЯ ШЕФ-ПОВАРА',430,51);
   bootText(overlay.querySelector('[data-boot-message]'),'Подготавливаем рабочий экран...',1600,48);
   document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(closeTimer);close();cancel()}},{passive:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
})();
