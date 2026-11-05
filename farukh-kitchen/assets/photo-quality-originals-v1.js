/* CHEF AKA / FARUKH KITCHEN — fidelity-first optical enhancement.
   Keeps the original dish/photo; never substitutes generated artwork.
   Only enhances tiny original cutouts (<480 px), reusing one result per URL.
   Does not change layout, displayed size, paid PDF assets, or mobile CSS. */
(()=>{'use strict';
const selector='.fk-catalog-grid .fk-product-photo, .fk-showcase-stage img, #recipesPanel .fk-recipe-media img';
const cache=new Map(),objectURLs=new Set();
let pending=false;
function enhance(img){
 if(!img || img.dataset.fkPhotoQualityProcessed)return;
 if(!img.complete||!img.naturalWidth){
   if(img.dataset.fkPhotoQualityListener)return;
   img.dataset.fkPhotoQualityListener='yes';
   img.addEventListener('load',()=>{delete img.dataset.fkPhotoQualityListener;enhance(img)},{once:true});
   return;
 }
 const w=img.naturalWidth,h=img.naturalHeight;
 if(w<80||h<80||Math.max(w,h)>=480){img.dataset.fkPhotoQualityProcessed='skip';return}
 const origin=img.currentSrc||img.src;
 if(!origin){return}
 img.dataset.fkPhotoQualityProcessed='pending';
 if(!cache.has(origin))cache.set(origin,enhanceBitmap(img,w,h));
 cache.get(origin).then(url=>{
   if(!url||!img.isConnected)return;
   if((img.currentSrc||img.src)!==origin)return;
   img.dataset.fkPhotoQualityProcessed='done';
   img.src=url;
 }).catch(()=>{img.dataset.fkPhotoQualityProcessed='failed'});
}
async function enhanceBitmap(img,w,h){
 try{
  const factor=Math.min(3.2,1024/Math.max(w,h));
  const width=Math.round(w*factor),height=Math.round(h*factor);
  const base=document.createElement('canvas');base.width=width;base.height=height;
  const ctx=base.getContext('2d',{willReadFrequently:true});
  if(!ctx)return null;
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(img,0,0,width,height);
  const blur=document.createElement('canvas');blur.width=width;blur.height=height;
  const bctx=blur.getContext('2d',{willReadFrequently:true});
  if(!bctx)return null;
  bctx.filter='blur(0.8px)';
  bctx.drawImage(base,0,0);
  const original=ctx.getImageData(0,0,width,height);
  const softened=bctx.getImageData(0,0,width,height);
  const a=original.data,b=softened.data;
  // Very gentle unsharp mask on color channels, with exact original alpha.
  // Suppress edge halos by skipping near-transparent pixels.
  for(let i=0;i<a.length;i+=4){
   if(a[i+3]<25)continue;
   for(let j=0;j<3;j++){
    const v=Math.round(a[i+j]+(a[i+j]-b[i+j])*.25);
    a[i+j]=v<0?0:v>255?255:v;
   }
  }
  ctx.putImageData(original,0,0);
  const blob=await new Promise((resolve,reject)=>base.toBlob(
   v=>v?resolve(v):reject(new Error('Photo processing failed')),'image/webp',.96
  ));
  const url=URL.createObjectURL(blob);
  objectURLs.add(url);return url;
 }catch(e){
   // If canvas is unsupported or a cross-origin photo is blocked, retain original.
   return null;
 }
}
function scan(){
 pending=false;
 document.querySelectorAll(selector).forEach(enhance);
}
const observer=new MutationObserver(()=>{
 if(pending)return;
 pending=true;
 requestAnimationFrame(scan);
});
observer.observe(document.body,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',scan,{once:true});
scan();
window.addEventListener('pagehide',()=>{
 for(const url of objectURLs)URL.revokeObjectURL(url);
 objectURLs.clear();cache.clear();
},{once:true});
})();
