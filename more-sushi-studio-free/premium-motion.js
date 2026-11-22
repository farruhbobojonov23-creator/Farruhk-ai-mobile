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
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
 const jobs=new Set(),queued=new Set();
 let generation=0,lastView='';
 const graphemes=value=>{
   try{return Array.from(new Intl.Segmenter('ru',{granularity:'grapheme'}).segment(value),s=>s.segment)}
   catch{return Array.from(value)}
 };
 function release(job){
   if(job.done)return;
   job.done=true;
   clearTimeout(job.timer);
   const {el,node,full,priorHeight,hadLabel,oldLabel}=job;
   if(node&&node.isConnected)node.nodeValue=full;
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
   const job={el,node,full,priorHeight,hadLabel,oldLabel,timer:null,done:false};
   jobs.add(job);
   node.nodeValue=leading;
   el.classList.add('premium-typing');
   let idx=0;
   const step=()=>{
     if(job.done)return;
     if(gen!==generation||!el.isConnected||el.closest('[hidden],.hide')||document.hidden){
       release(job);return;
     }
     idx=Math.min(chars.length,idx+1);
     node.nodeValue=leading+chars.slice(0,idx).join('')+trailing;
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
 function runView(view){
   if(reduced)return;
   lastView=view;
   if(mobile){
     if(view==='home'){
       typeBatch(select('.hero-kicker,.hero-copy h1,#mss-home .home-heading h2,#mss-home .mss-feature strong,#mss-home .mss-feature small,#mss-home .continue-work b'),{speed:59,stagger:115,cap:14});
     } else {
       const panel=document.getElementById('mss-'+view);
       if(panel)typeBatch(select('.mss-title h2,.mss-title p,.mss-card strong,.mss-card small',panel),{speed:60,stagger:110,cap:20});
     }
     return;
   }
   if(revision){
     const heading=select('.top h1');
     let list=[];
     if(view==='summary')list=select('#view-summary .sectionheading h2,#view-summary .sectionheading .desc,#view-summary .summarytile strong,#view-summary .summarytile .hint');
     if(view==='revision')list=select('#view-revision #formtitle,#view-revision #formdesc,#view-revision #rows .itemname');
     if(view==='history')list=select('#view-history h2,#view-history .desc,#view-history .historyitem strong');
     if(view==='products')list=select('#view-products h2,#view-products .desc,#view-products #productsrows .itemname');
     typeBatch([...heading,...list],{speed:69,stagger:120,cap:18});
     return;
   }
   if(studio){
     typeBatch(select('.topbar h1,.page-head h2,.page-head p,.card h2,.card h3,.empty-state strong').filter(el=>!el.closest('[hidden],.hide')),{speed:62,stagger:110,cap:12});
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
       if(tab)schedule(()=>runView(tab),75);
     });
     window.addEventListener('hashchange',()=>schedule(()=>runView(root.dataset.mssTab||'home'),85));
     window.addEventListener('popstate',()=>schedule(()=>runView(root.dataset.mssTab||'home'),85));
   }else if(studio){
     document.addEventListener('click',event=>{
       if(event.target.closest?.('[data-nav]'))schedule(()=>runView('studio'),115);
     });
   }
   const initial=revision?'summary':mobile?(root.dataset.mssTab||'home'):'studio';
   const overlay=document.getElementById('premiumBoot');
   if(!overlay||reduced){
     overlay?.remove();
     schedule(()=>runView(initial),170);
     return;
   }
   // The splash is cosmetic, skippable, and not a fake cloud verification.
   let finished=false;
   const close=()=>{
     if(finished)return;
     finished=true;
     overlay.classList.add('is-leaving');
     const finish=()=>{overlay.remove();runView(revision?'summary':mobile?(root.dataset.mssTab||'home'):'studio')};
     schedule(finish,560);
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
