/* CHEF SIGNATURE ULTRA — only lightweight interface behavior.
   Navigation, cloud, update checks and TTK/PDF routes remain in existing modules. */
(()=>{'use strict';
 const info=document.getElementById('appInfo');
 info?.addEventListener('click',()=>document.querySelector('.bottomnav [data-mss-tab="more"]')?.click());
 const home=document.getElementById('mss-home');
 const grid=home?.querySelector('.mss-feature-grid');
 const nav=document.querySelector('.bottomnav');
 if(!home||!grid||!nav)return;
 let pending=false;
 function fit(){
   pending=false;
   document.documentElement.classList.remove('chef-home-fixed');
   if(home.hidden||window.innerHeight<680||window.innerWidth>650)return;
   const gridBottom=grid.getBoundingClientRect().bottom;
   const navTop=nav.getBoundingClientRect().top;
   if(gridBottom<=(navTop-12) && gridBottom>0) {
     document.documentElement.classList.add('chef-home-fixed');
   }
 }
 const schedule=()=>{if(pending)return;pending=true;requestAnimationFrame(fit)};
 new MutationObserver(schedule).observe(home,{attributes:true,attributeFilter:['hidden']});
 window.addEventListener('resize',schedule,{passive:true});
 window.addEventListener('orientationchange',schedule,{passive:true});
 window.visualViewport?.addEventListener('resize',schedule,{passive:true});
 document.fonts?.ready.then(schedule).catch(()=>{});
 window.addEventListener('pageshow',schedule);
 schedule();
})();