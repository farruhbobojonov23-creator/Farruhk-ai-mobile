// FARUKH PRINT — approved premium semifinished-product label.
// Black vector paths at native 240×160 dots = 30×20 mm / 203 dpi.
// Composition and KBZhU are intentionally NOT printed on this small label.
// The drawing is shared by the native V3 BT raster and printable SVG preview.
(()=>{
'use strict';
const SERIF="Georgia,'Times New Roman',serif";
const SANS="Arial,sans-serif";
const val=v=>String(v??'').trim();
const measure=(g,s,px,weight,family)=>{g.font=weight+' '+px+'px '+family;return g.measureText(s).width};
function write(g,s,x,y,{size=12,min=7,maxWidth=180,weight='700',font=SANS,align='left'}={}){
 s=val(s);let z=size;
 while(z>min&&measure(g,s,z,weight,font)>maxWidth)z-=.25;
 if(measure(g,s,z,weight,font)>maxWidth)throw Error('Длинная надпись для этикетки 30×20: '+s.slice(0,35));
 g.font=weight+' '+z+'px '+font;g.textAlign=align;g.fillText(s,x,y);
}
function line(g,x,y,xx,yy,w=1){g.lineWidth=w;g.beginPath();g.moveTo(x,y);g.lineTo(xx,yy);g.stroke()}
function border(g,x,y,w,h,r,l=1.3){g.lineWidth=l;if(typeof g.roundRect==='function'){g.beginPath();g.roundRect(x,y,w,h,r);g.stroke()}else g.strokeRect(x,y,w,h)}
function diamond(g,x,y,sz=2){line(g,x,y-sz,x+sz,y);line(g,x+sz,y,x,y+sz);line(g,x,y+sz,x-sz,y);line(g,x-sz,y,x,y-sz)}
function leaf(g,x,y){
 line(g,x,y+4.6,x,y-4.6,1);
 line(g,x,y+2,x-5,y-3,.85);line(g,x-5,y-3,x-3,y+2,.85);line(g,x-3,y+2,x,y+3,.85);
 line(g,x,y+2,x+5,y-3,.85);line(g,x+5,y-3,x+3,y+2,.85);line(g,x+3,y+2,x,y+3,.85);
}
function calendar(g,x,y){
 border(g,x,y+2,11,12,1.4,1.15);
 line(g,x,y+5,x+11,y+5,1);
 line(g,x+3,y,x+3,y+4,1.4);line(g,x+8,y,x+8,y+4,1.4);
}
function thermo(g,x,y){
 border(g,x+3.4,y,4.6,11,2.3,1.25);
 line(g,x+5.7,y+5,x+5.7,y+14,1.3);
 // Bulb rendered as a tiny diamond to retain recognizability on 203dpi printer.
 diamond(g,x+5.7,y+14,3.6);
}
function sand(g,x,y){
 line(g,x+1,y,x+12,y,1.7);line(g,x+1,y+16,x+12,y+16,1.7);
 line(g,x+3,y+2,x+3,y+5,1.05);line(g,x+10,y+2,x+10,y+5,1.05);
 line(g,x+3,y+5,x+6.5,y+8,1.05);line(g,x+10,y+5,x+6.5,y+8,1.05);
 line(g,x+6.5,y+8,x+3,y+12.5,1.05);line(g,x+6.5,y+8,x+10,y+12.5,1.05);
 line(g,x+3,y+12.5,x+3,y+14.5,1.05);line(g,x+10,y+12.5,x+10,y+14.5,1.05);
 line(g,x+6.5,y+12,x+6.5,y+14,1.5);
}
function splitName(g,s){
 // No ellipses: allow 1 or 2 lines; reject impossible text before printing.
 const single=measure(g,s,25,'900',SERIF);
 if(single<=206)return {lines:[s],size:25};
 const words=s.split(/\s+/).filter(Boolean);
 for(let size=18;size>=11;size-=.5){
  if(measure(g,s,size,'900',SERIF)<=205)return {lines:[s],size};
  let best=null;
  for(let i=1;i<words.length;i++){
   const a=words.slice(0,i).join(' '),b=words.slice(i).join(' ');
   const w=Math.max(measure(g,a,size,'900',SERIF),measure(g,b,size,'900',SERIF));
   if(w<=205&&(!best||w<best.width))best={lines:[a,b],size,width:w};
  }
  if(best)return best;
 }
 throw Error('Название слишком длинное для премиальной этикетки 30×20 мм. Укороти название.');
}
function draw(g,p,epoch,{formatDate}={}){
 if(!g||!p||!Number.isFinite(Number(epoch)))throw Error('Укажи дату и товар.');
 if(!val(p.name)||!val(p.storage)||!Number.isInteger(Number(p.hours))||Number(p.hours)<=0){
  throw Error('Для этикетки нужны название, проверенный срок и температура.');
 }
 const dt=typeof formatDate==='function'?formatDate:ms=>new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms)).replace(',','');
 const produced=dt(Number(epoch)),expires=dt(Number(epoch)+Number(p.hours)*3600000);
 const productName=val(p.name).toLocaleUpperCase('ru');
 const title=splitName(g,productName);
 const event=p.prepEvent==='thawed'?'РАЗМОРОЖЕНО':p.prepEvent==='opened'?'ВСКРЫТО':'ИЗГОТОВЛЕНО';
 g.fillStyle='#fff';g.fillRect(0,0,240,160);g.fillStyle='#000';g.strokeStyle='#000';g.textBaseline='middle';
 border(g,3,3,234,154,8,1.8);
 border(g,7,7,226,146,6,1);
 write(g,'СУШИ БЕРИ',13.5,18,{size:14,min:11.5,maxWidth:112,weight:'900'});
 write(g,'ПОЛУФАБРИКАТ',227,18,{size:9.5,min:8,maxWidth:101,weight:'700',font:SERIF,align:'right'});
 for(const y of [29,31]){line(g,14,y,113,y,.75);line(g,127,y,226,y,.75)}
 leaf(g,120,29);
 if(title.lines.length===1){
  write(g,title.lines[0],120,56,{size:title.size,min:11,maxWidth:207,weight:'900',font:SERIF,align:'center'});
 }else{
  write(g,title.lines[0],120,50.5,{size:title.size,min:10.5,maxWidth:205,weight:'900',font:SERIF,align:'center'});
  write(g,title.lines[1],120,70.2,{size:title.size,min:10.5,maxWidth:205,weight:'900',font:SERIF,align:'center'});
 }
 for(const y of [82,84]){line(g,14,y,114,y,.8);line(g,126,y,226,y,.8)}
 diamond(g,120,83,2.3);

 // Two equal date blocks, icons inside the same panel at the same baseline.
 border(g,12,88,216,38,3.5,1.1);
 line(g,120,91,120,123,1.0);diamond(g,120,107,1.75);
 calendar(g,16,95);
 write(g,event,31,99,{font:SERIF,size:8.4,min:7.2,maxWidth:82,weight:'700'});
 write(g,produced,31,115,{font:SERIF,size:11.7,min:9.5,maxWidth:85,weight:'900'});
 calendar(g,125,95);
 write(g,'ГОДЕН ДО',140,99,{font:SERIF,size:9,min:7.3,maxWidth:81,weight:'700'});
 write(g,expires,140,115,{font:SERIF,size:11.7,min:9.5,maxWidth:85,weight:'900'});

 // Temperature and expiry are framed at a fixed baseline.
 border(g,12,128.5,216,23.5,3.1,1.1);
 line(g,119,131,119,149,.9);
 thermo(g,16,132);
 write(g,'ХРАНИТЬ',33,135.5,{font:SERIF,size:8.4,min:7.2,maxWidth:76});
 write(g,p.storage,33,144.5,{font:SERIF,size:12.3,min:9.3,maxWidth:78,weight:'900'});
 sand(g,128,132);
 write(g,'СРОК',146,135.5,{font:SERIF,size:8.4,min:7.3,maxWidth:75});
 write(g,p.hours+' ч',146,144.5,{font:SERIF,size:13,min:10,maxWidth:72,weight:'900'});
}
window.FarukhPremiumPrep={draw};
})();