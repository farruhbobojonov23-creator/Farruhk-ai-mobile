/* MORE SUSHI STUDIO PRO — selected concept 1.
   Installs new scalable 3D SVG illustrations in existing card controls.
   It never replaces, hides, or disables a real link or button. */
(function(){
 'use strict';
 const icons={
  'Ингредиенты':'ingredients','Полуфабрикаты':'prep',
  'Готовые блюда':'roll','Соусы':'sauces',
  'Напитки':'drinks','Упаковка':'pack',
  'Настройки студии':'gear','Бренды и проекты':'books',
  'Все ТТК':'books','Готовые ТТК':'books',
  'Шаблоны ТТК':'books','Шаблоны А4':'books',
  'Новая ТТК':null,'Черновики':null,
  'Облако':null,'Обновить':'gear',
  'История PDF':null,'Печать ТТК':null
 };
 const base='./ocean-4-1-luxury-icons.svg?v=4.1#';
 function apply(){
  document.querySelectorAll('[data-mss-panel] .mss-card').forEach(card=>{
   const label=card.querySelector('strong')?.textContent?.trim();
   const icon=icons[label];
   if(!icon||card.dataset.luxuryIcon===icon)return;
   const svg=card.querySelector('svg.mss-ico');
   const use=svg?.querySelector('use');
   if(!svg||!use)return;
   svg.setAttribute('viewBox','0 0 180 180');
   svg.setAttribute('aria-hidden','true');
   use.setAttribute('href',base+icon);
   use.setAttributeNS('http://www.w3.org/1999/xlink','href',base+icon);
   card.dataset.luxuryIcon=icon;
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
