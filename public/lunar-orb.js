export function mountLunarOrb(host,panel){
 host.classList.add('lunar-orb');host.replaceChildren();
 const img=document.createElement('img');img.src='/assets/lunar-orb-hq.webp';img.alt='';img.draggable=false;img.decoding='async';host.append(img);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let frame,last=0;
 const tick=now=>{frame=requestAnimationFrame(tick);if(document.hidden||now-last<50)return;last=now;const level=reduced.matches?0:Number(panel.style.getPropertyValue('--voice-level'))||0;host.style.setProperty('--orb-level',String(level));host.dataset.phase=panel.dataset.phase||'idle'};
 frame=requestAnimationFrame(tick);window.addEventListener('pagehide',()=>cancelAnimationFrame(frame),{once:true});
}
