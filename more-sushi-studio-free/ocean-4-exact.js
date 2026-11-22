/* OCEAN ULTRA 4.0 — upgrade approved art only after the asset is really loaded.
   Keeps functional TTK/editor/PDF links, live Supabase counters, 5-tabs and Android back.
   Fallback avoids replacing the working hero with blank pixels if the asset fails. */
(function(){
 'use strict';
 const root=document.documentElement;
 const hero=document.querySelector('.wrap>.hero');
 const art=hero?.querySelector('.approved-hero-whale');
 if(!hero||!art)return;
 const LOADED='ocean40-art-ready';
 const FALLBACK='ocean40-art-fallback';
 let done=false;
 function success(){
  if(done)return;
  done=true;
  root.classList.add(LOADED);
  root.classList.remove(FALLBACK);
  hero.dataset.artStatus='loaded';
 }
 function failure(){
  if(done)return;
  done=true;
  root.classList.remove(LOADED);
  root.classList.add(FALLBACK);
  hero.dataset.artStatus='fallback';
  art.onerror=null;
  art.src='./ocean_hero_whale.webp?v=3.3';
 }
 if(art.complete){
  if(art.naturalWidth>0)success();
  else failure();
 }else{
  art.addEventListener('load',success,{once:true});
  art.addEventListener('error',failure,{once:true});
 }

 /* The three large cards are real links/buttons. Show baked high-detail art
    only when each WebP has decoded; preserve readable live text on failure. */
 const cardAssets=[
  ['.mss-feature-red','./o40_ttk.webp?v=4'],
  ['.mss-feature-blue','./o40_catalog.webp?v=4'],
  ['.mss-feature-pearl','./o40_pdf.webp?v=4']
 ];
 cardAssets.forEach(([selector,url])=>{
  const card=document.querySelector(selector);
  if(!card)return;
  const image=new Image();
  image.decoding='async';
  image.onload=()=>{
   card.classList.add('ocean40-card-ready');
   card.classList.remove('ocean40-card-failed');
  };
  image.onerror=()=>{
   card.classList.remove('ocean40-card-ready');
   card.classList.add('ocean40-card-failed');
  };
  image.src=url;
  if(image.complete&&image.naturalWidth>0)image.onload();
 });
})();
