/* MORE SUSHI — one lightweight Ruby White UI helper.
   Full navigation, cloud auth and updates remain in their stable modules. */
(()=>{
 'use strict';
 document.getElementById('appInfo')?.addEventListener('click',()=>{
  document.querySelector('.bottomnav [data-mss-tab="more"]')?.click();
 });
 const home=document.getElementById('mss-home');
 const grid=home?.querySelector('.mss-feature-grid');
 const nav=document.querySelector('.bottomnav');
 if(!home||!grid||!nav)return;
 let pending=false;
 function sync(){
  pending=false;
  document.documentElement.classList.remove('ruby-home-fixed');
  if(home.hidden)return;
  // Never clip the bottom row on small screens, large fonts or landscape.
  const gap=nav.getBoundingClientRect().top-grid.getBoundingClientRect().bottom;
  if(gap>=9&&innerHeight>=690){
   document.documentElement.classList.add('ruby-home-fixed');
  }
 }
 function schedule(){if(pending)return;pending=true;requestAnimationFrame(sync)}
 new MutationObserver(schedule).observe(home,{attributes:true,attributeFilter:['hidden']});
 addEventListener('resize',schedule,{passive:true});
 addEventListener('orientationchange',schedule,{passive:true});
 if(document.fonts?.ready)document.fonts.ready.then(schedule).catch(()=>{});
 schedule();
})();
