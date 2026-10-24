// FARUKH PRINT: one vector drawing surface for preview, PDF and Bluetooth rasterization.
// Layout uses the same Canvas-style drawing commands as the existing label templates.
(()=>{
'use strict';
const escapeXML=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
const n=value=>{const v=Number(value);return Number.isFinite(v)?String(Number(v.toFixed(3))):'0'};
function surface(width,height){
 if(!((width===464&&height===320)||(width===240&&height===160)))throw Error('Неподдерживаемый размер SVG-этикетки.');
 const mm=width===464?[58,40]:[30,20],shapes=[];
 // Browser font measurement is used solely for the original wrapping/fit logic.
 const measure=document.createElement('canvas').getContext('2d');
 let path=[];
 const g={
  font:'10px Arial,sans-serif',fillStyle:'#000',strokeStyle:'#000',
  lineWidth:1,textBaseline:'middle',textAlign:'left',
  measureText(value){
   if(!measure)throw Error('Измерение шрифта недоступно.');
   measure.font=this.font;
   return measure.measureText(String(value??''));
  },
  fillRect(x,y,w,h){shapes.push('<rect x="'+n(x)+'" y="'+n(y)+'" width="'+n(w)+'" height="'+n(h)+'" shape-rendering="crispEdges" fill="'+escapeXML(this.fillStyle)+'"/>');},
  strokeRect(x,y,w,h){shapes.push('<rect x="'+n(x)+'" y="'+n(y)+'" width="'+n(w)+'" height="'+n(h)+'" shape-rendering="crispEdges" fill="none" stroke="'+escapeXML(this.strokeStyle)+'" stroke-width="'+n(this.lineWidth)+'"/>');},
  beginPath(){path=[];},
  moveTo(x,y){path.push('M'+n(x)+' '+n(y));},
  lineTo(x,y){path.push('L'+n(x)+' '+n(y));},
  roundRect(x,y,w,h,r=0){
   const v=Math.max(0,Math.min(Number(r)||0,Math.abs(w)/2,Math.abs(h)/2));
   path.push('M'+n(x+v)+' '+n(y)+' H'+n(x+w-v)+' Q'+n(x+w)+' '+n(y)+' '+n(x+w)+' '+n(y+v)+
    ' V'+n(y+h-v)+' Q'+n(x+w)+' '+n(y+h)+' '+n(x+w-v)+' '+n(y+h)+
    ' H'+n(x+v)+' Q'+n(x)+' '+n(y+h)+' '+n(x)+' '+n(y+h-v)+
    ' V'+n(y+v)+' Q'+n(x)+' '+n(y)+' '+n(x+v)+' '+n(y)+' Z');
  },
  arc(x,y,r,start,end){
   // Full-circle glyphs are needed for calendar weight, thermometer and clock;
   // approximate partial arcs are not used by the approved label.
   if(Math.abs(end-start)<Math.PI*1.999)throw Error('Неподдерживаемая дуга SVG');
   path.push('M'+n(x+r)+' '+n(y)+' A'+n(r)+' '+n(r)+' 0 1 0 '+n(x-r)+' '+n(y)+
    ' A'+n(r)+' '+n(r)+' 0 1 0 '+n(x+r)+' '+n(y));
  },
  stroke(){
   if(path.length)shapes.push('<path d="'+path.join(' ')+'" shape-rendering="geometricPrecision" stroke-linejoin="round" fill="none" stroke="'+escapeXML(this.strokeStyle)+'" stroke-width="'+n(this.lineWidth)+'"/>');
   path=[];
  },
  fillText(value,x,y){
   const parts=/^\s*(\d+)\s+([\d.]+)px\s+(.+)$/.exec(this.font);
   const weight=parts?parts[1]:'400',size=parts?parts[2]:'12',family=parts?parts[3]:'Arial,sans-serif';
   const anchor=this.textAlign==='center'?'middle':this.textAlign==='right'?'end':'start';
   shapes.push('<text x="'+n(x)+'" y="'+n(y)+'" text-anchor="'+anchor+'" dominant-baseline="central" font-family="'+escapeXML(family)+'" font-size="'+escapeXML(size)+'" font-weight="'+escapeXML(weight)+'" fill="'+escapeXML(this.fillStyle)+'">'+escapeXML(value)+'</text>');
  }
 };
 const c={width,height,toSVG(){
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+mm[0]+'mm" height="'+mm[1]+'mm" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Этикетка '+mm[0]+' на '+mm[1]+' миллиметров" text-rendering="optimizeLegibility" shape-rendering="geometricPrecision">'+shapes.join('')+'</svg>';
 }};
 return {c,g};
}
function element(svg){
 const doc=new DOMParser().parseFromString(svg,'image/svg+xml');
 if(doc.querySelector('parsererror')||doc.documentElement.nodeName.toLowerCase()!=='svg')throw Error('Не удалось прочитать SVG-этикетку.');
 return document.importNode(doc.documentElement,true);
}
function rasterize(svg,width,height){
 if(!((width===464&&height===320)||(width===240&&height===160)))return Promise.reject(Error('Неверный размер для Bluetooth-печати.'));
 return new Promise((resolve,reject)=>{
  const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
  const url=URL.createObjectURL(blob),img=new Image();
  let finished=false;
  const finish=(error,result)=>{
   if(finished)return;finished=true;
   img.onload=null;img.onerror=null;URL.revokeObjectURL(url);
   error?reject(error):resolve(result);
  };
  img.onerror=()=>finish(Error('SVG не удалось подготовить для принтера.'));
  img.onload=()=>{
   try{
    const canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    const g=canvas.getContext('2d',{willReadFrequently:true});
    if(!g)throw Error('Нет доступа к печатному полотну.');
    g.fillStyle='#fff';g.fillRect(0,0,width,height);
    g.drawImage(img,0,0,width,height);
    finish(null,canvas);
   }catch(error){finish(error)}
  };
  img.src=url;
 });
}
window.FarukhLabelSVG={surface,element,rasterize};
})();