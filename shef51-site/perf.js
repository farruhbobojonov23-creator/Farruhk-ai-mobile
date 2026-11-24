(()=>{
'use strict';
const seen=new Set();
const warm=a=>{if(!a||!a.href)return;const u=new URL(a.href,location.href);if(u.origin!==location.origin||!u.pathname.endsWith('.html')||seen.has(u.href))return;seen.add(u.href);const l=document.createElement('link');l.rel='prefetch';l.href=u.href;document.head.appendChild(l)};
document.addEventListener('pointerover',e=>warm(e.target.closest('a[href]')),{passive:true});
document.addEventListener('touchstart',e=>warm(e.target.closest('a[href]')),{passive:true});
})();

// Pin the project's existing section controls in the Android Workspace.
if (navigator.userAgent.includes('FarruhWorkspaceNative/')) {
  const style = document.createElement('style');
  style.textContent = `@media screen and (max-width: 960px) {
    html, body { overflow-x: clip; }
    body:has(.mobileQuickTabs) { padding-bottom: calc(68px + env(safe-area-inset-bottom)); }
    header:has(.mobileQuickTabs) {
      position: sticky; top: 0; contain: none; backdrop-filter: none; -webkit-backdrop-filter: none; background: #090909;
    }
    header .mobileQuickTabs {
      position: fixed; inset: auto 0 0; box-sizing: border-box;
      display: flex; flex-wrap: nowrap; overflow-x: auto; background: #090909;
      padding-bottom: max(9px, env(safe-area-inset-bottom)); z-index: 51;
    }
 
  }`;
  document.head.append(style);
}
