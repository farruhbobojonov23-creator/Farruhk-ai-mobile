(()=>{
'use strict';
const seen=new Set();
const warm=a=>{if(!a||!a.href)return;const u=new URL(a.href,location.href);if(u.origin!==location.origin||!u.pathname.endsWith('.html')||seen.has(u.href))return;seen.add(u.href);const l=document.createElement('link');l.rel='prefetch';l.href=u.href;document.head.appendChild(l)};
document.addEventListener('pointerover',e=>warm(e.target.closest('a[href]')),{passive:true});
document.addEventListener('touchstart',e=>warm(e.target.closest('a[href]')),{passive:true});
})();
