// Moon surface: NASA SVS CGI Moon Kit / LRO LROC, https://svs.gsfc.nasa.gov/4720/.
// Sample the near hemisphere; the illumination remains tied to the live lunar phase.
export function moonPixels(size,fraction,angle,texture){
 const data=new Uint8ClampedArray(size*size*4),r=size/2,cosLight=2*fraction-1,sinLight=Math.sqrt(Math.max(0,1-cosLight*cosLight));
 const lx=sinLight*Math.sin(angle),ly=-sinLight*Math.cos(angle),lz=cosLight;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const nx=(x+.5-r)/r,ny=(y+.5-r)/r,d=nx*nx+ny*ny;if(d>=1)continue;
  const nz=Math.sqrt(1-d),light=Math.max(0,nx*lx+ny*ly+nz*lz),shade=Math.pow(light,.42);
  let albedo=[180,181,182];
  if(texture){const tx=Math.min(texture.width-1,Math.max(0,Math.floor((.5+Math.atan2(nx,nz)/(2*Math.PI))*texture.width))),ty=Math.min(texture.height-1,Math.max(0,Math.floor((.5+Math.asin(ny)/Math.PI)*texture.height))),j=(ty*texture.width+tx)*4;albedo=[texture.data[j],texture.data[j+1],texture.data[j+2]]}
  const i=(y*size+x)*4;
  for(let k=0;k<3;k++)data[i+k]=Math.min(255,[32,42,66][k]*(1-shade)+albedo[k]*shade*1.23);
  data[i+3]=Math.round(255*Math.min(1,(1-Math.sqrt(d))*r));
 }
 return data;
}
export function celestialLight(){
 const moonCanvas=document.createElement('canvas'),mc=moonCanvas.getContext('2d');
 let texture=null,version=0,key='',disposed=false;
 const image=new Image();image.decoding='async';image.onload=()=>{if(disposed)return;try{const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const tc=c.getContext('2d',{willReadFrequently:true});tc.drawImage(image,0,0);texture=tc.getImageData(0,0,c.width,c.height);version++}catch{/* A shaded sphere remains available if the texture cannot be decoded. */}};image.src='/assets/moon-lroc.webp';
 function glow(ctx,x,y,r,color){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}
 function reflection(ctx,x,w,h,color,strength,time){
  ctx.save();ctx.globalCompositeOperation='screen';ctx.beginPath();ctx.rect(0,h*.84,w,h*.16);ctx.clip();
  for(let i=0;i<19;i++){const y=h*(.845+i*.0082),span=(8+i*3)*(w<700?.8:1.25),offset=Math.sin(i*2.7+time*.13)*span*.16;ctx.globalAlpha=strength*(1-i/25);const g=ctx.createLinearGradient(x-span,y,x+span,y);g.addColorStop(0,'transparent');g.addColorStop(.5,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-span+offset,y,span*2,1+i*.1)}ctx.restore();
 }
 function wisps(ctx,cloud,x,y,r,cover,time){if(cover<.08)return;ctx.save();ctx.globalAlpha=Math.min(.68,cover*.75);const shift=Math.sin(time*.018)*r*2;ctx.drawImage(cloud,x-r*5+shift,y-r*1.3,r*10,r*2.3);ctx.restore()}
 return {
  sun(ctx,s,w,h,time,cloud){
   const x=w*(w<700?.78+Math.sin(s.sun.azimuth)*.06:.52+Math.sin(s.sun.azimuth)*.08),y=s.skyBand?Math.max(24,s.skyBand*(.85-Math.min(75,Math.max(0,s.altitude))/100)):h*(w<700?Math.max(.34,.44-s.altitude/180):Math.max(.12,.62-s.altitude/100)),r=w<700?13:17,clear=1-s.cloud*.6;
   ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=clear;
   glow(ctx,x,y,Math.min(w*.33,300),'rgba(255,213,145,.34)');glow(ctx,x,y,r*4,'rgba(255,223,160,.35)');
   // Broad blurred shafts taper gently downward, rather than hard star-shaped spikes.
   ctx.save();ctx.filter='blur(5px)';
   for(let i=0;i<9;i++){const angle=.4+i*.31+Math.sin(time*.025+i)*.015,len=Math.min(h*.35,230)*(i%2?.8:1),spread=.012+(i%3)*.006;
    const g=ctx.createLinearGradient(x,y,x+Math.cos(angle)*len,y+Math.sin(angle)*len);g.addColorStop(0,'rgba(255,240,199,.12)');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(angle-spread)*len,y+Math.sin(angle-spread)*len);ctx.lineTo(x+Math.cos(angle+spread)*len,y+Math.sin(angle+spread)*len);ctx.closePath();ctx.fill()}
   ctx.restore();const disk=ctx.createRadialGradient(x,y,0,x,y,r);disk.addColorStop(0,'#fffef1');disk.addColorStop(.8,'#fff9dd');disk.addColorStop(1,'#ffdf9b');ctx.fillStyle=disk;ctx.shadowColor='#fff0bd';ctx.shadowBlur=r*.65;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore();
   if(!s.skyBand)wisps(ctx,cloud,x,y,r,s.cloud,time);if(!s.skyBand)reflection(ctx,x,w,h,'#ffdfa2',clear*.16,time);
  },
  moon(ctx,s,w,h,time,cloud){
   const r=w<700?20:27,x=w*(w<700?.78+Math.sin(s.moon.azimuth)*.06:.52+Math.sin(s.moon.azimuth)*.08),y=s.skyBand?Math.max(28,s.skyBand*(.85-Math.min(1.4,Math.max(0,s.moon.altitude))*.48)):h*(w<700?Math.max(.33,.43-s.moon.altitude*.16):Math.max(.12,.58-s.moon.altitude*.5)),angle=s.phase.angle-s.moon.parallacticAngle,stamp=[s.phase.fraction.toFixed(4),angle.toFixed(3),version,r].join(':');
   if(key!==stamp){const size=160;moonCanvas.width=size;moonCanvas.height=size;const pixels=mc.createImageData(size,size);pixels.data.set(moonPixels(size,s.phase.fraction,angle,texture));mc.putImageData(pixels,0,0);key=stamp}
   ctx.save();glow(ctx,x,y,r*4,'rgba(189,211,242,.075)');glow(ctx,x,y,r*1.7,'rgba(212,228,248,.12)');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(moonCanvas,x-r,y-r,r*2,r*2);ctx.restore();
   if(!s.skyBand)wisps(ctx,cloud,x,y,r,s.cloud,time);if(!s.skyBand)reflection(ctx,x,w,h,'#d6e3f6',s.phase.fraction*.11,time);
  },
  dispose(){disposed=true;image.onload=null}
 };
}
