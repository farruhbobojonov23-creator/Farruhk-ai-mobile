// Continuous light field: no stacked polygon strips or screen-aligned tiles.
// Keep the texture bounded; the browser interpolates it to the display size.
export function auroraFrame(width,height,time){
 const pixels=new Uint8ClampedArray(width*height*4);
 const t=time*.07;
 const curves=Array.from({length:2},(_,band)=>Array.from({length:width},(_,x)=>{
  const u=x/(width-1),a=u*5.2+t+band*2.1;
  const fold=Math.sin(u*13.3-t*.6+band)*.018+Math.sin(u*27.1+t*.4+band)*.005;
  return {edge:height*(.32+band*.14+Math.sin(a)*.09+fold),reach:height*(.15+.07*(1+Math.sin(u*6.7+t*.5+band))),
   strength:(.7+.3*Math.sin(u*8.3-t*.3+band))*(band===0?1:.65),
   rays:.86+.045*Math.sin(u*159+t*.8+band)+.025*Math.sin(u*311-t*.3+band),
   lean:.025*Math.sin(a*1.7)};
 }));
 for(let x=0;x<width;x++){
  const u=x/(width-1),edgeFade=Math.min(1,u/.14,(1-u)/.14);
  const fade=Math.max(0,edgeFade);const side=fade*fade*(3-2*fade);
  for(let y=0;y<Math.min(height,Math.ceil(height*.66));y++){
   let green=0,violet=0;
   for(const curve of curves){
    const p=curve[x],v=(p.edge-y)/p.reach;
    if(v<-.08||v>1.1)continue;
    const feather=Math.exp(-Math.max(0,v)*3.8)/(1+Math.exp(-(v+.015)*65));
    const tip=Math.max(0,Math.min(1,(1.05-v)/.25));
    const silk=.88+.12*Math.sin(u*62+v*1.7+t*.5);
    green+=feather*tip*p.strength*p.rays*silk*.48;
    if(v>.38&&v<1)violet+=Math.sin((v-.38)/.62*Math.PI)*p.strength*.035;
   }
   const alpha=Math.min(.58,(green+violet)*side);
   if(alpha<.001)continue;
   const index=(y*width+x)*4,mix=violet/(green+violet||1);
   pixels[index]=102+mix*44;pixels[index+1]=224-mix*103;pixels[index+2]=157+mix*64;pixels[index+3]=Math.round(alpha*255);
  }
 }
 return pixels;
}
