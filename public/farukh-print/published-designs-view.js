// Paired employees may see owner-published designs. This gallery does NOT alter printing.
(function(){
 'use strict';
 const home=document.getElementById('home');
 if(!home)return;
 const section=document.createElement('section');section.className='print-design-gallery';section.hidden=true;
 section.style.cssText='margin:18px 0;padding:18px;border:1px solid #d6e2eb;border-radius:16px;background:#fff;color:#283948;box-shadow:0 5px 15px #1b253012';
 const h=document.createElement('h3');h.textContent='Мои шаблоны · опубликовано владельцем';h.style.cssText='font-size:18px;margin:0 0 8px';
 const note=document.createElement('p');note.textContent='Просмотр утверждённых владельцем дизайнов. Печать пока выполняется по прежним рабочим этикеткам.';note.style.cssText='font-size:12px;line-height:1.5;color:#64788b;margin:0 0 13px';
 const cards=document.createElement('div');cards.style.cssText='display:grid;gap:14px';
 section.append(h,note,cards);
 const footer=home.querySelector('.app-foot');if(footer)footer.before(section);else home.append(section);
 let generation=0;
 const text=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;return el};
 window.addEventListener('farukh-print-device-designs',async event=>{
   const token=++generation;const entries=event.detail?.entries;
   cards.replaceChildren();
   if(event.detail?.unavailable){section.hidden=false;cards.append(text('p','Не удалось получить опубликованные макеты. Проверь соединение.'));return}
   if(!Array.isArray(entries)||!entries.length){section.hidden=true;return}
   section.hidden=false;
   try{
     const {renderPublishedDesignPreview}=await import('/print-design-studio.js?v=5');
     if(token!==generation)return;
     const products=window.FARUKH_PRINT_SYNC_API?.get?.()||[];
     for(const entry of entries){
       if(!entry?.design||!entry.productIds?.length)continue;
       const item=document.createElement('article');item.style.cssText='border:1px solid #e0e6ee;border-radius:13px;padding:12px;overflow:hidden';
       const title=text('strong',entry.name||'Дизайн 58×40');title.style.cssText='display:block;margin-bottom:5px;font-size:14px';
       const assigned=(entry.productIds||[]).map(id=>products.find(p=>p.id===id)?.name||'Товар на другом устройстве');
       const subtitle=text('small','Назначено: '+assigned.join(', '));subtitle.style.cssText='display:block;color:#6a7785;line-height:1.4;margin-bottom:10px';
       const preview=document.createElement('div');preview.style.cssText='background:#f1f5f7;border-radius:10px;padding:8px;max-width:520px';
       preview.innerHTML=renderPublishedDesignPreview(entry.design);
       const svg=preview.querySelector('svg');if(svg)svg.style.cssText='display:block;width:100%;height:auto;max-width:464px;background:#fff;margin:auto';
       item.append(title,subtitle,preview);cards.append(item);
     }
     if(!cards.children.length)section.hidden=true;
   }catch(err){
     if(token!==generation)return;
     cards.replaceChildren(text('p','Предпросмотр макетов недоступен: '+err.message));
   }
 });
 window.addEventListener('farukh-print-sync-status',event=>{
  if(event.detail?.connected===false){generation++;section.hidden=true}
 });
})();
