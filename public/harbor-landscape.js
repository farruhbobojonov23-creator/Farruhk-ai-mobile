// The photograph is the weather scene. Only pixels above the ridge drift;
// buildings, mountains and water remain anchored to the same camera.
export const HARBOR_ASSETS=Object.freeze({sun:'/assets/weather/4k-web/bay-day.webp',overcast:'/assets/weather/4k-web/bay-overcast.webp',snow:'/assets/weather/4k-web/bay-overcast.webp',night:'/assets/weather/4k-web/bay-night.webp'});
export const MOBILE_ASSETS=Object.freeze({sun:'/assets/weather/4k-web/bay-day-mobile.webp',overcast:'/assets/weather/4k-web/bay-overcast-mobile.webp',snow:'/assets/weather/4k-web/bay-overcast-mobile.webp',night:'/assets/weather/4k-web/bay-night-mobile.webp'});
export function assetsForViewport(w,h){return w/h<.85?MOBILE_ASSETS:HARBOR_ASSETS}
// A conservative clear-sky boundary above the highest ridge of the approved bay.
export const SKY_FRACTION=.55;
export function landscapeState(s){
 const dark=s.period==='night',snow=['snow','sleet'].includes(s.kind),covered=['cloud','rain','fog','snow','sleet'].includes(s.kind)||s.cloud>=.68;
 const daylight=snow?'snow':covered?'overcast':'sun';
 return {base:dark?'night':daylight,sky:dark&&covered?'overcast':dark?'night':daylight,darkSky:dark&&covered,twilight:s.period==='twilight'};
}
export function photoCrop(iw,ih,w,h){const scale=Math.max(w/iw,h/ih);return {x:(iw-w/scale)/2,y:(ih-h/scale)/2,width:w/scale,height:h/scale,scale}}
export function skyEndForCrop(iw,ih,w,h){const crop=photoCrop(iw,ih,w,h);return Math.max(0,Math.min(h,(ih*(iw/ih<.85?.52:SKY_FRACTION)-crop.y)*crop.scale))}
export function cloudOffset(y,skyEnd,time,wind=0){if(y>=skyEnd||skyEnd<=0)return 0;const taper=1-Math.pow(Math.max(0,y/skyEnd),3);return taper*(Math.sin(time*(.012+Math.min(70,wind)*.00012))*.014+Math.sin(time*.027+y*.006)*.003)}
export function harborLandscape(onLoad=()=>{}){
 const cache=new Map();let disposed=false,current=null,previous=null,signature='',changedAt=0,lastSkyEnd=0;
 function load(key,assets){const src=assets[key];if(cache.has(src))return cache.get(src);const record={image:new Image(),ready:false,failed:false};cache.set(src,record);record.image.decoding='async';record.image.onload=()=>{record.ready=true;if(!disposed)onLoad()};record.image.onerror=()=>{record.failed=true};record.image.src=src;return record}
 function render(ctx,w,h,s,time,motion){
  const assets=assetsForViewport(w,h),mode=landscapeState(s),base=load(mode.base,assets),sky=load(mode.sky,assets);if(!base.ready||!sky.ready){if(current){paint(current,1);return true}return false;}
  const key=[assets[mode.base],assets[mode.sky],mode.darkSky,mode.twilight].join(':');if(key!==signature){previous=current;current={mode,base,sky};signature=key;changedAt=time}
  const progress=motion?1:Math.min(1,(time-changedAt)/1.6);if(previous&&progress<1)paint(previous,1);paint(current,previous?progress:1);if(progress>=1)previous=null;return true;
  function paint(frame,alpha){if(alpha<=0)return;ctx.save();ctx.globalAlpha=alpha;const b=frame.base.image,c=photoCrop(b.naturalWidth,b.naturalHeight,w,h);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.filter=frame.mode.twilight?'brightness(.58) saturate(.8)':'none';ctx.drawImage(b,c.x,c.y,c.width,c.height,0,0,w,h);
   const image=frame.sky.image,sc=photoCrop(image.naturalWidth,image.naturalHeight,w,h);
   // Overscan only the cloud texture horizontally; the actual landscape keeps its full framing.
   const margin=sc.width*.02;sc.x+=margin;sc.width-=margin*2;
   const end=skyEndForCrop(image.naturalWidth,image.naturalHeight,w,h);
   // Sampling adjacent strips from the SAME sky moves existing photographic clouds.
   // The displacement fades to zero before the mountain silhouette.
   ctx.filter=frame.mode.darkSky?'brightness(.19) saturate(.72)':frame.mode.twilight?'brightness(.68) saturate(.8)':'none';
   lastSkyEnd=end;const step=w<700?4:5;
   for(let y=0;y<end;y+=step){ctx.globalAlpha=alpha*Math.min(1,(end-y)/Math.max(1,end*.25));const height=Math.min(step,end-y),offset=motion?0:cloudOffset(y,end,time,s.wind)*image.naturalWidth;const sx=Math.max(0,Math.min(image.naturalWidth-sc.width,sc.x+offset));ctx.drawImage(image,sx,sc.y+y/sc.scale,sc.width,height/sc.scale,0,y,w,height+.3)}
   ctx.filter='none';if(frame.mode.twilight){ctx.fillStyle='rgba(32,42,82,.18)';ctx.fillRect(0,0,w,h)}ctx.restore();
  }
 }
 return {draw:render,get skyEnd(){return lastSkyEnd},dispose(){disposed=true;for(const r of cache.values()){r.image.onload=null;r.image.onerror=null}cache.clear()}};
}
