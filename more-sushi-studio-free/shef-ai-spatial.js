/* ШЕФ AI / Spatial UI: progressive enhancement. Never affects TTK paper or printed documents. */
(() => {
 'use strict';
 const spatial = () => document.documentElement.dataset.studioTheme === 'spatial';
 const canTilt = () => spatial() &&
   window.matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)').matches &&
   (!navigator.deviceMemory || navigator.deviceMemory > 3);
 const targets = '.spatial-dock-item,.project-card,.stat,.quick-link,.catalog-item';
 const attached = new WeakSet();
 let active = null, frame = 0, px = 0, py = 0;
 function clear(el) {
   if(!el)return;
   el.style.removeProperty('--spatial-rx');el.style.removeProperty('--spatial-ry');
 }
 function flush() {
   frame=0;const el=active;
   if(!el || !el.isConnected || !canTilt())return;
   const rect=el.getBoundingClientRect();
   if(!rect.width || !rect.height)return;
   const x=Math.max(-1,Math.min(1,(px-rect.left)/rect.width*2-1));
   const y=Math.max(-1,Math.min(1,(py-rect.top)/rect.height*2-1));
   el.style.setProperty('--spatial-rx',(-y*4).toFixed(2)+'deg');
   el.style.setProperty('--spatial-ry',(x*5).toFixed(2)+'deg');
 }
 function bind(el) {
   if(attached.has(el)||el.closest('#paper,.paper-holder,.preview-pane'))return;
   attached.add(el);
   if(!el.classList.contains('spatial-dock-item'))el.classList.add('spatial-tilt');
   el.addEventListener('pointermove',event => {
     if(event.pointerType!=='mouse' || !canTilt())return;
     active=el;px=event.clientX;py=event.clientY;
     if(!frame)frame=requestAnimationFrame(flush);
   },{passive:true});
   el.addEventListener('pointerleave',()=> {
     if(active===el)active=null;
     clear(el);
   },{passive:true});
 }
 function scan(root=document){
   if(root.nodeType!==1 && root.nodeType!==9)return;
   if(root.matches?.(targets))bind(root);
   root.querySelectorAll?.(targets).forEach(bind);
 }
 function init(){
   scan();
   const root=document.querySelector('#shell');
   if(root){
     const observer=new MutationObserver(records=>{
       for(const record of records)for(const node of record.addedNodes)scan(node);
     });
     observer.observe(root,{childList:true,subtree:true});
   }
   window.addEventListener('blur',()=>{
     if(active){clear(active);active=null;}
   });
   const media=window.matchMedia('(prefers-reduced-motion:reduce)');
   media.addEventListener?.('change',()=>{
     if(active){clear(active);active=null;}
   });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
