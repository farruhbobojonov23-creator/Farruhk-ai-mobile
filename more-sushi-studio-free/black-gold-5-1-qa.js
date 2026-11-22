/* BLACK GOLD 5.1 · screenshot QA: one meaningful visual per card.
   Keeps all original hrefs, buttons, status badges and cloud data untouched. */
(function(){
 'use strict';
 const minimized={
   'Все ТТК':'book',
   'Черновики':'ttk',
   'Шаблоны ТТК':'printer',
   'Печать ТТК':'printer',
   'История PDF':'chart'
 };
 function render(){
   document.querySelectorAll('#mssCategoryApp .mss-grid > .mss-card').forEach(card=>{
     const title=card.querySelector('strong')?.textContent?.trim();
     const symbol=minimized[title];
     if(!symbol||card.dataset.blackGold51==='done')return;
     // Duplicate photo removed only for these cards; no navigation is changed.
     card.querySelectorAll('.bg-gold-inner-photo').forEach(photo=>photo.remove());
     const svg=card.querySelector('svg.mss-ico');
     const use=svg?.querySelector('use');
     if(svg){
       svg.style.removeProperty('display');
       svg.setAttribute('aria-hidden','true');
       if(use){
         use.setAttribute('href','#'+symbol);
         use.setAttributeNS('http://www.w3.org/1999/xlink','href','#'+symbol);
       }
     }
     card.classList.add('bg-gold-minimal');
     card.dataset.blackGold51='done';
   });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});
 else render();
})();
