// Photographic alpha clouds, with separate distant and near planes.
export function weatherClouds(onReady=()=>{}){
 const image=new Image();let ready=false,disposed=false;
 image.decoding='async';image.onload=()=>{if(!disposed){ready=true;onReady()}};
 image.src='/assets/weather-clouds.webp';
 function draw(ctx,s,w,h,time,plane){
  if(!ready||!s.fresh||s.cloud<=.03)return false;
  const cover=Math.min(1,Math.max(0,(s.cloud-.03)/.67)),night=s.period==='night';
  const mobile=w<700;
  const alpha=plane==='near'?.16+cover*.38:.35+cover*.6;
  const base=plane==='near'?(mobile?1.4:.72):(mobile?1.65:.92);
  const cw=w*base,ch=cw*image.naturalHeight/image.naturalWidth*(plane==='near'?.72:1);
  const speed=(2+s.wind*.16)*(plane==='near'?1.3:.5);
  const phase=(time*speed)%(w+cw),cx=plane==='near'?w*.57+phase:w*.28-phase;
  const y=h*(plane==='near'?.13:.27);
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=alpha*(night?.68:1);
  ctx.filter=night?'brightness(.68) saturate(.45) blur(.55px)':'saturate(.5) blur(.4px)';
  // Repeat only complete sprites, separated by transparent sky; never a tiled rectangle.
  for(const shift of [-w-cw,0,w+cw])ctx.drawImage(image,cx-cw/2+shift,y,cw,ch);
  ctx.restore();return true;
 }
 return {draw,dispose(){disposed=true;image.onload=null}};
}
