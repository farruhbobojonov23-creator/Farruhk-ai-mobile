// FARUKH AI + FARUKH PRINT. 58×40 mm approved "variant 2 + icons variant 1".
// Shared black-only 203 dpi vector layout for SVG preview, PDF and Bluetooth.
// This module does not own products, dates or print permissions.
(()=>{
'use strict';
const SERIF="Georgia,'Times New Roman',serif";
const SANS="Arial,sans-serif";
const value=v=>String(v??'').trim();
const decimal=v=>value(v).replace('.',',');
const round=v=>Math.round(v*100)/100;
function text(g,text,x,y,{size=13,min=9,width=410,weight='700',family=SANS,align='left'}={}){
 const s=value(text);let sz=size;
 for(;sz>=min;sz-=.5){
  g.font=weight+' '+sz+'px '+family;
  if(g.measureText(s).width<=width)break;
 }
 g.font=weight+' '+Math.max(min,round(sz))+'px '+family;
 if(g.measureText(s).width>width)throw Error('Текст не помещается на этикетку: '+s.slice(0,32));
 g.textAlign=align;
 g.fillText(s,x,y);
}
function lines(g,content,maxWidth,maxLines,size,family=SANS,weight='500'){
 g.font=weight+' '+size+'px '+family;
 const words=value(content).split(/\s+/).filter(Boolean);
 const all=[];let row='';
 for(const word of words){
  const next=row?row+' '+word:word;
  if(g.measureText(next).width<=maxWidth){row=next;continue}
  if(row){all.push(row);row=''}
  if(g.measureText(word).width<=maxWidth){row=word;continue}
  for(const ch of word){
   if(row&&g.measureText(row+ch).width>maxWidth){all.push(row);row=ch}
   else row+=ch;
  }
 }
 if(row)all.push(row);
 if(all.length>maxLines)throw Error('Состав или название слишком длинные для этикетки 58×40 мм. Укороти текст в редакторе.');
 return all;
}
function line(g,x1,y1,x2,y2,width=1.3){
 g.lineWidth=width;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();
}
function box(g,x,y,w,h,r=0,width=1.2){
 g.lineWidth=width;
 if(r&&typeof g.roundRect==='function'){
  g.beginPath();g.roundRect(x,y,w,h,r);g.stroke();
 }else g.strokeRect(x,y,w,h);
}
function circle(g,x,y,r,w=1.4){
 g.lineWidth=w;
 if(typeof g.arc==='function'){
  g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.stroke();
 }else g.strokeRect(x-r,y-r,r*2,r*2);
}
function diamond(g,x,y,r=4){
 for(const [[a,b],[c,d]] of [
  [[x,y-r],[x+r,y]],[[x+r,y],[x,y+r]],[[x,y+r],[x-r,y]],[[x-r,y],[x,y-r]]
 ])line(g,a,b,c,d,1.3);
}
function leaf(g,x,y){
 // A fine central ornamental leaf and stem, like the approved visual.
 line(g,x,y+7,x,y-6,1.5);
 line(g,x,y+3,x-8,y-4,1.3);line(g,x-8,y-4,x-5,y+3,1.3);line(g,x-5,y+3,x,y+5,1.3);
 line(g,x,y+3,x+8,y-4,1.3);line(g,x+8,y-4,x+5,y+3,1.3);line(g,x+5,y+3,x,y+5,1.3);
 line(g,x,y-6,x-4,y,1.2);line(g,x,y-6,x+4,y,1.2);
}
function calendar(g,x,y){
 // 16×18 pixel crisp outline and two binding tabs.
 box(g,x,y+4,17,15,2.2,1.8);
 line(g,x,y+9,x+17,y+9,1.4);
 line(g,x+4,y+1,x+4,y+7,2.1);line(g,x+13,y+1,x+13,y+7,2.1);
}
function scale(g,x,y){
 // Classic small weight icon with handle and tapered body.
 circle(g,x+8,y+3,3,1.7);
 line(g,x+3,y+8,x+13,y+8,1.7);
 line(g,x+3,y+8,x,y+20,1.7);
 line(g,x,y+20,x+16,y+20,1.7);
 line(g,x+16,y+20,x+13,y+8,1.7);
}
function thermometer(g,x,y){
 // Universal thermo glyph: bulb with a marked stem, no tiny text.
 box(g,x+5,y,6,15,3,1.8);
 circle(g,x+8,y+18,5,1.8);
 line(g,x+8,y+8,x+8,y+21,2.4);
}
function clock(g,x,y){
 circle(g,x+10,y+10,10,2);
 line(g,x+10,y+4,x+10,y+10,2);
 line(g,x+10,y+10,x+15,y+13,2);
}
function draw(g,p,epoch,{formatDate}={}){
 if(!g||!p||!Number.isFinite(Number(epoch)))throw Error('Нет данных для этикетки.');
 if(!p.name||!value(p.composition)||!value(p.storage)||!(Number(p.hours)>0)){
  throw Error('Требуются название, состав, хранение и подтверждённый срок.');
 }
 if([p.p,p.f,p.c,p.kcal,p.weight,p.tolerance].some(v=>!Number.isFinite(Number(v))))throw Error('Проверь КБЖУ и массу изделия.');
 const formatted=typeof formatDate==='function'?formatDate:ms=>new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms)).replace(',','');
 g.fillStyle='#fff';g.fillRect(0,0,464,320);g.fillStyle='#000';g.strokeStyle='#000';g.textBaseline='middle';

 // 1. Fine double premium border, only printable monochrome paths.
 box(g,4.5,4.5,455,311,8.5,2.0);
 box(g,9,9,446,302,6.2,1.0);

 // 2. Brand header & signature double rule.
 text(g,'СУШИ БЕРИ',20,27,{size:23,min:20,width:238,weight:'900'});
 text(g,'ГОТОВАЯ ПРОДУКЦИЯ',442,26.5,{size:12.8,min:11.3,width:182,family:SERIF,weight:'700',align:'right'});
 for(const y of [45,48]){
  line(g,18,y,217,y,1.25);line(g,248,y,446,y,1.25);
 }
 leaf(g,233,45);

 // 3. Huge elegant serif name with a small rhombus rule.
 const heading=value(p.name).toUpperCase();
 const font=SERIF;
 g.font='900 31px '+font;
 if(g.measureText(heading).width<=407){
  text(g,heading,232,77,{size:31,min:18,width:410,weight:'900',family:font,align:'center'});
 }else{
  let parts;
  try{parts=lines(g,heading,408,2,21.5,font,'900')}
  catch{parts=lines(g,heading,408,2,18,font,'900')}
  parts.forEach((s,i)=>text(g,s,232,65+i*21.5,{size:21.5,min:15,width:408,weight:'900',family:font,align:'center'}));
 }
 for(const y of [103,106]){
  line(g,18,y,221,y,1.0);line(g,243,y,446,y,1.0);
 }
 diamond(g,232,104.5,4.3);

 // 4. Composition is a complete, readable ingredient list. Its actual height
 // sets the KBZhU frame, so short recipes do not leave a blank half-label.
 const composition='Состав: '+value(p.composition);
 let arr,fs=12.15,step=13.9;
 try{arr=lines(g,composition,420,4,fs,SERIF,'500')}
 catch{fs=10.7;step=11.55;arr=lines(g,composition,420,5,fs,SERIF,'500')}
 const compositionY=117.5;
 g.font='500 '+fs+'px '+SERIF;g.textAlign='left';
 arr.forEach((s,i)=>g.fillText(s,21,compositionY+i*step));
 // Emphasize only the "Состав:" label, retaining the exact measured line
 // widths and preventing ingredients from being shortened or hidden.
 g.font='900 '+fs+'px '+SERIF;
 g.fillText('Состав:',21,compositionY);

 // 5. Balanced KBZhU table. The frame always finishes at a fixed baseline,
 // keeping dates and the lower band perfectly aligned for every recipe.
 const tableTop=arr.length<=2?155:arr.length===3?163:arr.length===4?171:177;
 const tableBottom=234.5,tableHeight=tableBottom-tableTop;
 box(g,16,tableTop,432,tableHeight,5.5,1.35);
 box(g,18.5,tableTop+2.5,427,tableHeight-5,4.5,.65);
 const compactTable=tableTop>=171;
 const separator=tableTop+(compactTable?20:24);
 text(g,'КБЖУ НА 100 Г',232,tableTop+(compactTable?10.2:12.5),{family:SERIF,size:compactTable?13.1:14.1,min:12,weight:'900',width:415,align:'center'});
 line(g,18.5,separator,445.5,separator,1.05);
 const data=[['Б',decimal(p.p)],['Ж',decimal(p.f)],['У',decimal(p.c)],['ККАЛ',decimal(p.kcal)]];
 const cellHeight=tableBottom-separator;
 // Never let food-value captions touch the large numbers or the table frame.
 const keyY=compactTable?separator+8.5:separator+cellHeight*.30;
 const valueY=tableBottom-(compactTable?14:16);
 for(let i=0;i<4;i++){
  const cx=70+i*108;
  if(i)line(g,16+i*108,separator+1,16+i*108,tableBottom-2,1.05);
  text(g,data[i][0],cx,keyY,{family:SERIF,size:compactTable?11.2:12,min:10,weight:'700',width:96,align:'center'});
  text(g,data[i][1],cx,valueY,{family:SERIF,size:compactTable?18.2:19.7,min:12.8,weight:'900',width:100,align:'center'});
 }

 // 6. Raised data band with date icons on left and right.
 box(g,16,239,432,39,4.5,1.2);
 calendar(g,27,248.5);
 text(g,'ИЗГОТОВЛЕНО',50,251.0,{family:SERIF,size:10.2,min:9,width:161,weight:'700'});
 text(g,formatted(Number(epoch)),50,265.5,{family:SERIF,size:15.9,min:11,width:165,weight:'900'});
 line(g,232,244,232,274,1.05);diamond(g,232,259,2.6);
 calendar(g,244,248.5);
 text(g,'ГОДЕН ДО',268,251.0,{family:SERIF,size:10.2,min:9,width:159,weight:'700'});
 text(g,formatted(Number(epoch)+Number(p.hours)*3600000),268,265.5,{family:SERIF,size:15.9,min:11,width:170,weight:'900'});

 // 7. Short bottom info band with precise line pictograms.
 box(g,16,280.5,432,30.5,4.5,1.2);
 line(g,161,283,161,308.5,1.0);line(g,311,283,311,308.5,1.0);
 scale(g,24,285.5);
 text(g,'ВЕС НЕТТО',50,288.8,{size:9.4,min:8.3,family:SERIF,weight:'700',width:102});
 text(g,p.weight+' г ±'+p.tolerance+' г',50,300.5,{size:14.3,min:10,family:SERIF,weight:'900',width:106});
 thermometer(g,174,285.5);
 text(g,'ХРАНИТЬ',198,288.8,{size:9.4,min:8.3,family:SERIF,weight:'700',width:105});
 text(g,p.storage,198,300.5,{size:13.9,min:10,family:SERIF,weight:'900',width:108});
 clock(g,320,285.8);
 text(g,'СРОК',350,288.8,{size:9.4,min:8.3,family:SERIF,weight:'700',width:88});
 text(g,p.hours+' ч',350,300.5,{size:14.3,min:10,family:SERIF,weight:'900',width:92});
}
window.FarukhPremiumReady={draw};
})();
