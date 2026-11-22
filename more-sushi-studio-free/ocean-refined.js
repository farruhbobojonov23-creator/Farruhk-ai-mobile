/* MORE SUSHI STUDIO PRO · OCEAN 3D REFINED: motion layer.
   Only decorates existing working controls. No local data, auth or network calls. */
(function(){
 "use strict";
 const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)");
 function setIdle(){
  document.documentElement.classList.toggle("ocean-idle",document.visibilityState==="hidden");
 }
 document.addEventListener("visibilitychange",setIdle,{passive:true});
 setIdle();
 if(reduced?.matches)return;
 const target=".mss-feature,.mss-card,.ocean-refresh-btn,.hero-stamp,.mss-quick-link,.bottomnav .navitem";
 let lastPress=0;
 document.addEventListener("pointerdown",function(event){
  if(event.button>0||Date.now()-lastPress<90)return;
  const control=event.target.closest(target);
  if(!control)return;
  lastPress=Date.now();
  const rect=control.getBoundingClientRect();
  if(rect.width<=0||rect.height<=0)return;
  const point=document.createElement("span");
  point.className="ocean-touch-wave";
  point.setAttribute("aria-hidden","true");
  point.style.setProperty("--tap-x",Math.min(100,Math.max(0,(event.clientX-rect.left)/rect.width*100))+"%");
  point.style.setProperty("--tap-y",Math.min(100,Math.max(0,(event.clientY-rect.top)/rect.height*100))+"%");
  control.appendChild(point);
  point.addEventListener("animationend",()=>point.remove(),{once:true});
  window.setTimeout(()=>point.remove(),850);
 },{passive:true});

 // Entry labels remain in the DOM for search/reader/copy. Motion never blanks text.
 const labels=document.querySelectorAll(".mss-feature strong");
 labels.forEach((el,i)=>{
  el.style.setProperty("--ocean-heading-delay",(i*160)+"ms");
 });
})();
