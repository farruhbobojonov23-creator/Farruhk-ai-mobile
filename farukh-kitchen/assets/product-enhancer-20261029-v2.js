/* FARUKH KITCHEN: original product-photo cutouts with graceful fallback. */
(function(){
"use strict";
var photos=window.FK_PRODUCT_PHOTOS||{};
var cache=new Map(),running=new Set(),seen=new WeakSet();
function imgLoad(src,cross,timeout){
 return new Promise(function(resolve,reject){
  var i=new Image(),done=false,timer=0;
  if(cross)i.crossOrigin="anonymous";
  function finish(err){if(done)return;done=true;clearTimeout(timer);i.onload=i.onerror=null;err?reject(err):resolve(i)}
  i.onload=function(){finish(null)};
  i.onerror=function(){finish(new Error("image load failed"))};
  if(timeout)timer=setTimeout(function(){finish(new Error("image timeout"))},timeout);
  i.src=src;
  if(i.complete&&i.naturalWidth)finish(null);
 });
}
function clamp(x){return Math.max(0,Math.min(1,x))}
function cutout(img){
 var width=img.naturalWidth||img.width,height=img.naturalHeight||img.height;
 var scale=Math.min(1,960/Math.max(width,height));
 var canvas=document.createElement("canvas");
 canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
 var ctx=canvas.getContext("2d",{willReadFrequently:true});
 ctx.drawImage(img,0,0,canvas.width,canvas.height);
 var w=canvas.width,h=canvas.height,pixels=ctx.getImageData(0,0,w,h),p=pixels.data;
 var samples=[],corners=[[.04,.06],[.96,.06],[.04,.52],[.96,.52]];
 corners.forEach(function(xy){var k=(Math.floor(h*xy[1])*w+Math.floor(w*xy[0]))*4;samples.push([p[k],p[k+1],p[k+2]])});
 var purplish=samples.filter(function(c){return c[0]-c[1]>8&&c[2]-c[1]>8}).length>=2;
 for(var y=0;y<h;y++){
  var bottomFade=y<h*.86?1:clamp((h*.96-y)/(h*.10));
  for(var x=0;x<w;x++){
   var k=(y*w+x)*4,r=p[k],g=p[k+1],b=p[k+2],a=p[k+3];
   if(!a)continue;
   var mask=1;
   if(purplish){
    // Purple/pink studio background is distinct from salmon, rice and nori.
    var purpleDiff=Math.min(r-g,b-g);
    var bg=clamp((purpleDiff-5)/10);
    var white=Math.min(r,g,b)>235&&Math.max(r,g,b)-Math.min(r,g,b)<9;
    if(!white&&r>85&&b>85)mask*=1-bg;
    // Fade only the bottom reflection; the old .73-.83 fade cut off the food itself.
    mask*=bottomFade;
   }
   p[k+3]=Math.round(a*mask);
  }
 }
 ctx.putImageData(pixels,0,0);
 // Tighten framing based on the opaque product in the upper 90% of the frame.
 // This makes each photo bigger without stretching pixels or chopping the base.
 var minX=w,minY=h,maxX=-1,maxY=-1;
 for(var yy=0;yy<Math.floor(h*.90);yy+=2){
  for(var xx=0;xx<w;xx+=2){
   var at=(yy*w+xx)*4;
   if(p[at+3]>155){
    minX=Math.min(minX,xx);minY=Math.min(minY,yy);
    maxX=Math.max(maxX,xx);maxY=Math.max(maxY,yy);
   }
  }
 }
 var dest=canvas;
 if(maxX>minX+16&&maxY>minY+16){
  var padX=Math.ceil((maxX-minX)*.08),padY=Math.ceil((maxY-minY)*.08);
  var left=Math.max(0,minX-padX),top=Math.max(0,minY-padY);
  var right=Math.min(w,maxX+padX),bottom=Math.min(h,Math.max(maxY+padY,h*.89));
  dest=document.createElement("canvas");
  dest.width=Math.max(1,right-left);dest.height=Math.max(1,bottom-top);
  dest.getContext("2d").drawImage(canvas,left,top,right-left,bottom-top,0,0,dest.width,dest.height);
 }
 return new Promise(function(resolve,reject){
  dest.toBlob(function(blob){blob?resolve(URL.createObjectURL(blob)):reject(new Error("Unable to render photo"))},"image/webp",.96);
 });
}
function apply(id,uri,quality){
 var old=cache.get(id);
 if(old&&old.quality>quality)return;
 cache.set(id,{uri:uri,quality:quality});
 document.querySelectorAll('img[data-product-photo="'+id+'"]').forEach(function(el){
  el.src=uri;el.classList.add("product-photo-ready");
  el.alt="Фотография «"+(el.getAttribute("data-photo-name")||"блюдо")+"» — Суши Бери";
 });
}
async function start(id){
 if(running.has(id)||!photos[id])return;
 running.add(id);
 var p=photos[id];
 try{
  var preview=await imgLoad(p.preview,false,6000),uri=await cutout(preview);
  apply(id,uri,1);
  // Request the full-resolution original only for visible products.
  try{
   var full=await imgLoad(p.url,true,6500),original=await cutout(full);
   apply(id,original,2);
  }catch(e){/* Some source CDNs block canvas CORS; the local cutout remains. */}
 }catch(e){/* Keep the existing high-quality category image if an asset fails. */}
 finally{running.delete(id)}
}
var observer=typeof IntersectionObserver!=="undefined"?new IntersectionObserver(function(entries){
 entries.forEach(function(e){if(e.isIntersecting){observer.unobserve(e.target);start(e.target.dataset.productPhoto)}});
},{rootMargin:"240px 0px",threshold:.01}):null;
function enhance(root){
 if(!root)return;
 root.querySelectorAll("img[data-product-photo]").forEach(function(el){
  var id=el.dataset.productPhoto,c=cache.get(id);
  if(c){el.src=c.uri;el.classList.add("product-photo-ready");return}
  if(seen.has(el))return;
  seen.add(el);
  if(observer)observer.observe(el);else start(id);
 });
}
window.FKProductPhotos={enhance:enhance,availableCount:Object.keys(photos).length};
})();