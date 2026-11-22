/* PEARL ROSE ULTRA 8.0: performance-safe UI, no data mutations. */
(()=>{ 'use strict';
const more=document.getElementById('appInfo');
more?.addEventListener('click',()=>document.querySelector('.bottomnav [data-mss-tab="more"]')?.click());
const home=document.getElementById('mss-home'),last=home?.querySelector('.continue-work'),dock=document.querySelector('.bottomnav');
if(!home||!last||!dock)return;
let scheduled=false;
const fit=()=>{scheduled=false;document.documentElement.classList.remove('pearl-home-fixed');if(home.hidden)return;
  const gap=dock.getBoundingClientRect().top-last.getBoundingClientRect().bottom;
  if(gap>=8&&window.innerHeight>=685&&window.innerWidth>=345)document.documentElement.classList.add('pearl-home-fixed');
};
const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(fit)}};
new MutationObserver(schedule).observe(home,{attributes:true,attributeFilter:['hidden']});
addEventListener('resize',schedule,{passive:true});addEventListener('orientationchange',schedule,{passive:true});
if(document.fonts?.ready)document.fonts.ready.then(schedule).catch(()=>{});schedule();
})();