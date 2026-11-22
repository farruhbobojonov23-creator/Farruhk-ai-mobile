/* MORE SUSHI — one lightweight UI helper for the Ruby White theme.
   Tab navigation, cloud and updates remain in their established modules. */
(()=>{
 'use strict';
 const openMore=document.getElementById('appInfo');
 openMore?.addEventListener('click',()=>{
  document.querySelector('.bottomnav [data-mss-tab="more"]')?.click();
 });
 // Keeps active tab accessibility labels in sync with ocean-categories.js.
 const nav=document.querySelector('.bottomnav');
 if(nav){nav.addEventListener('click',event=>{
   const target=event.target.closest('[data-mss-tab]');
   if(!target)return;
   nav.querySelectorAll('[data-mss-tab]').forEach(el=>{
     el.setAttribute('aria-pressed',String(el===target));
   });
 });}
})();
