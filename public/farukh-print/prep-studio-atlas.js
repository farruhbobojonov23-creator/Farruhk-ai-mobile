// Source: user-approved FARUKH PRINT studio catalog mock-up. 17 aligned
// ingredient previews extracted as a single ultra-compact WebP atlas.
// Never persisted to product data: food expiry/TTK approvals stay untouched.
(()=>{'use strict';
const chunks=[
/*CHUNKS_END*/
];
const names=['Авокадо (нарезка)','Лук зелёный (нарезка)','Дайкон (нарезка)','Лайм (дольки)','Лосось (размороженный)','Мидии (мясо)','Кальмар (подготовленный)','Спайси-майо','Сырная начинка','Шапка сырная','Соус Том Ям (база)','Сливочный сыр (открытый)','Икра масаго (открытая)','Имбирь маринованный (открытый)','Чука (открытая)','Томаты черри (нарезка)','Грибы (нарезка)'];
const prior=window.FarukhStudioPrep;
const cache=new Map(),norm=s=>String(typeof s==='string'?s:s?.name||'').trim().toLocaleLowerCase('ru').replace(/ё/g,'е');
window.FarukhStudioPrep={find(p){return cache.get(norm(p))||prior?.find(p)||''},count:17};
const img=new Image();
img.onload=()=>{
 try{
  const canvas=document.createElement('canvas');canvas.width=150;canvas.height=96;
  const ctx=canvas.getContext('2d',{willReadFrequently:false});
  if(!ctx)return;
  for(let i=0;i<names.length;i++){
   ctx.clearRect(0,0,150,96);
   ctx.drawImage(img,(i%5)*150,Math.floor(i/5)*96,150,96,0,0,150,96);
   cache.set(norm(names[i]),canvas.toDataURL('image/webp',.82));
  }
  window.dispatchEvent(new Event('farukh-studio-ready'));
 }catch(error){console.warn('Studio atlas unavailable',error)}
};
img.onerror=()=>console.warn('Studio atlas failed to decode');
img.src='data:image/webp;base64,'+chunks.join('');
})();