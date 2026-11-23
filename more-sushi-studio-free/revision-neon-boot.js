/* FARUKH REVISION splash presentation. Purely cosmetic. Never touches stock or cloud state. */
(()=>{
 'use strict';
 const start=()=>{
   const boot=document.querySelector('#premiumBoot[data-variant="revision"]');
   if(!boot)return;
   const explicit=document.documentElement.classList.contains('premium-motion-optin');
   if(!explicit&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
   const ring=boot.querySelector('.rev-boot-dial');
   const percent=boot.querySelector('[data-rev-boot-percent]');
   const stages=[...boot.querySelectorAll('.rev-boot-stage')];
   const labels=['Подготовка интерфейса…','Загрузка разделов…','Открытие рабочего экрана…'];
   const timers=[];
   let alive=true;
   const queue=(fn,delay)=>{const t=setTimeout(()=>{if(alive&&boot.isConnected)fn()},delay);timers.push(t)};
   const write=(el,msg,speed=60)=>{
     if(!el)return;
     const chars=Array.from(msg);
     let i=0;el.textContent='';
     const step=()=>{if(!alive||!boot.isConnected)return;el.textContent=chars.slice(0,++i).join('');if(i<chars.length)queue(step,speed)};
     step();
   };
   const startAt=performance.now(),duration=3250;
   const tick=(now)=>{
     if(!alive||!boot.isConnected)return;
     const t=Math.min(1,(now-startAt)/duration);
     // This is entrance-animation progress; it is not cloud/print connectivity.
     const eased=t<.82?(.82*(1-Math.pow(1-t/.82,2))):(.82+.18*((t-.82)/.18));
     const v=Math.min(100,Math.round(eased*100));
     if(ring)ring.style.setProperty('--rev-progress',v+'%');
     if(percent)percent.textContent=v+'%';
     if(t<1)requestAnimationFrame(tick);
   };
   requestAnimationFrame(tick);
   stages.forEach((row,i)=>{
     const delay=i===0?270:i===1?1150:2150;
     queue(()=>{row.dataset.state='active';write(row.querySelector('.rev-boot-stage-text'),labels[i],47)},delay);
     queue(()=>{row.dataset.state='done';const mark=row.querySelector('.rev-boot-stage-state');if(mark)mark.textContent='✓'},delay+920);
   });
   const cleanup=new MutationObserver(()=>{
     if(!boot.isConnected){alive=false;timers.forEach(clearTimeout);cleanup.disconnect()}
   });
   cleanup.observe(document.body,{childList:true});
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
