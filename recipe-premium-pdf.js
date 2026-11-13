import PDFDocument from 'pdfkit';
import {recipeSections} from './recipe-word.js';
import {regulatoryBasis} from './public/recipe-math.js';
const regular=new URL('./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf',import.meta.url).pathname;
const bold=new URL('./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf',import.meta.url).pathname;
const valueForYield=v=>v==null?'—':String(v);
export function premiumRecipePdf(input){
 const {recipe:r,sections,nutrition}=recipeSections(input);
 const safetyRows=sections[5][1].filter(row=>row[0]==='Безопасность');sections[5][1]=sections[5][1].filter(row=>row[0]!=='Безопасность');sections[5][0]='6. Показатели качества';sections.push(['Безопасность',[[safetyRows.map(row=>row[1]).join('\n')||'—']]]);
 const fmt=v=>v==null?'—':Number(v).toLocaleString('ru-RU',{maximumFractionDigits:1});
 sections[6][1][1]=['На 100 г',...['protein','fat','carbs','kcal'].map(k=>fmt(nutrition[k]))];
 sections[6][1][2]=['На порцию '+valueForYield(r.netYieldGrams)+' г',...['protein','fat','carbs','kcal'].map(k=>nutrition[k]!=null&&r.netYieldGrams?fmt(Number(nutrition[k])*r.netYieldGrams/100):'—')];
 const layoutId=['arctic-a4','royal-a4'].includes(r.layoutTemplate)?r.layoutTemplate:'classic';
 const premium=layoutId!=='classic';
 const doc=new PDFDocument({size:'A4',margin:0,bufferPages:true,info:{Title:'ТТК — '+r.name,Author:'FARRUH AI'}});
 doc.registerFont('regular',regular);doc.registerFont('bold',bold);
 const themes={
 classic:{ink:'#4A1723',band:'#651D2C',line:'#D9B7A3',paper:'#FFF1E5',cell:'#FFF8F1',head:'#F5DCC9'},
 'arctic-a4':{ink:'#153B5E',band:'#127EC7',line:'#B4D9EF',paper:'#F4FAFF',cell:'#FFFFFF',head:'#DFEFFB'},
 'royal-a4':{ink:'#142E54',band:'#083668',line:'#B9C8DB',paper:'#FFFFFF',cell:'#FFFFFF',head:'#EAF1F8'}};
 const C=themes[layoutId],X=20,W=555,G=9;
 let photo=null;
 if(premium&&typeof r.photo==='string'&&r.photo.length<=3000000){
  const match=/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/i.exec(r.photo);
  if(match){const bytes=Buffer.from(match[2],'base64');if(bytes.length<=2200000)photo=bytes}
 }
 const value=v=>v==null||v===''?'—':String(v);
 function wrap(v,w,size,strong=false){doc.font(strong?'bold':'regular').fontSize(size);const lines=[];for(const p of value(v).split('\n')){let line='';for(const word of p.split(/\s+/)){if(!word)continue;if(doc.widthOfString(line?line+' '+word:word)<=w){line=line?line+' '+word:word;continue}if(line){lines.push(line);line=''}for(const c of word){if(line&&doc.widthOfString(line+c)>w){lines.push(line);line=''}line+=c}}lines.push(line||' ')}return lines}
 function text(lines,x,y,w,size,strong=false,color=C.ink){doc.font(strong?'bold':'regular').fontSize(size).fillColor(color);lines.forEach((s,i)=>doc.text(s,x,y+i*size*1.25,{width:w,lineBreak:false}));}
 function table(rows,x,y,w,s,draw,header=true){const cols=rows[0].length,ratios=cols===3?[.60,.20,.20]:cols===5?[.30,.175,.175,.175,.175]:cols===2?[.28,.72]:[1];let yy=y;rows.forEach((row,i)=>{const fs=7.6*s,pad=4*s,lines=row.map((v,j)=>wrap(v,w*ratios[j]-pad*2,fs,header&&i===0)),h=Math.max(15*s,Math.max(...lines.map(a=>a.length))*fs*1.25+pad*2);if(draw){let xx=x;row.forEach((v,j)=>{doc.rect(xx,yy,w*ratios[j],h).lineWidth(.4).fillAndStroke(header&&i===0?C.head:C.cell,C.line);text(lines[j],xx+pad,yy+pad,w*ratios[j]-pad*2,fs,header&&i===0);xx+=w*ratios[j]})}yy+=h});return yy-y;}
 function section(index,x,y,w,s,draw,min=0){const [title,rows]=sections[index],size=8.4*s,pad=6*s,lines=wrap(title,w-pad*2,size,true),bh=lines.length*size*1.25+pad*2;const th=table(rows,x,y+bh,w,s,false,rows[0].length>1),h=Math.max(min,bh+th);if(draw){doc.roundedRect(x,y,w,h,5*s).fill(C.cell);doc.rect(x,y,w,bh).fill(C.band);text(lines,x+pad,y+pad,w-pad*2,size,true,'#FFF8F1');table(rows,x,y+bh,w,s,true,rows[0].length>1)}return h;}
 function layout(s,draw=false){let y=20;const headerH=(premium?(photo?143:92):57)*s;
 if(draw){
  doc.rect(0,0,595.28,841.89).fill(C.paper);
  if(premium){
   if(layoutId==='arctic-a4'){
    doc.rect(0,0,595.28,14*s).fill('#CEE9F9');
    doc.roundedRect(X,y,W,headerH,6*s).fill('#E8F5FE');
    doc.moveTo(X,y+headerH).lineTo(X+W,y+headerH).lineWidth(.8).strokeColor('#91CBE8').stroke();
   }else{
    doc.rect(0,0,595.28,23*s).fill('#083668');
    doc.moveTo(X,y+headerH).lineTo(X+W,y+headerH).lineWidth(1.2).strokeColor('#C7A156').stroke();
   }
   text(['A  FARRUH AI    /    ТЕХНОЛОГИЧЕСКАЯ КАРТА'],X+5*s,y+5*s,W-10*s,11*s,true,C.band);
   text(wrap(r.name,photo?W*.52:W*.9,14*s,true),X+6*s,y+27*s,photo?W*.52:W*.9,14*s,true,C.ink);
   const fields=['ТТК №: '+value(r.cardNumber)+'   ·   Дата: '+value(r.cardDate),
     'Категория: '+value(r.category),
     'Количество: '+(r.pieces?value(r.pieces)+' шт.':'—')+'   ·   Выход: '+(r.netYieldGrams?value(r.netYieldGrams)+' г':'—'),
     'Статус: '+(r.status==='ready'?'Рецептура готова':'Черновик')];
   text(fields,X+6*s,y+52*s,photo?W*.51:W*.95,7.4*s,false,C.ink);
   if(photo){
    const bx=X+W*.565,by=y+27*s,bw=W*.415,bh=104*s;
    doc.roundedRect(bx,by,bw,bh,6*s).fill('#FFFFFF');
    doc.roundedRect(bx,by,bw,bh,6*s).lineWidth(.8).strokeColor(layoutId==='royal-a4'?'#C7A156':'#9CD3F0').stroke();
    try{doc.image(photo,bx+4*s,by+4*s,{fit:[bw-8*s,bh-8*s],align:'center',valign:'center'})}catch{}
   }
  }else{
   text(['СУШИ БЕРИ  /  ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ КАРТА'],X,y,W,8*s,true);
   text(wrap(r.name,W*.67,19*s,true),X,y+14*s,W*.67,19*s,true);
   text(['ТТК № '+value(r.cardNumber),'Дата: '+value(r.cardDate),'Категория: '+value(r.category)],X+W*.69,y+13*s,W*.31,7.5*s);
   doc.moveTo(X,y+headerH).lineTo(X+W,y+headerH).lineWidth(.6).strokeColor(C.line).stroke();
  }
 }
 y+=headerH+8*s;
  const half=(W-G)/2,top=Math.max(section(0,X,y,half,s,false),section(1,X+half+G,y,half,s,false));if(draw){section(0,X,y,half,s,true,top);section(1,X+half+G,y,half,s,true,top)}y+=top+8*s;
  y+=section(2,X,y,W,s,draw)+8*s;
  y+=section(3,X,y,W,s,draw)+8*s;
  const lower=Math.max(section(4,X,y,half,s,false),section(5,X+half+G,y,half,s,false));
  if(draw){section(4,X,y,half,s,true,lower);section(5,X+half+G,y,half,s,true,lower)}y+=lower+8*s;
  y+=section(7,X,y,W,s,draw)+8*s;
  y+=section(6,X,y,W,s,draw)+8*s;
  const signature=wrap('Разработал (Шеф): '+value(r.chef)+'     Утверждаю (Руководитель): '+value(r.approver),W,7*s,true);if(draw)text(signature,X,y,W,7*s,true);y+=signature.length*8.75*s+6*s;
  const basis=wrap(regulatoryBasis,W,5.7*s);if(draw)text(basis,X,y,W,5.7*s,false,'#765647');y+=basis.length*7.125*s;
  return y;
 }
 let s=1;if(layout(s)>795){let lo=.001,hi=1;for(let i=0;i<20;i++){const m=(lo+hi)/2;if(layout(m)<=795)lo=m;else hi=m}s=lo}layout(s,true);
 const missing=['scope','safety','chef','approver','cardNumber','cardDate','rawRequirements','preparation','forming','serving','storage','appearance','taste','netYieldGrams'].some(k=>!r[k])||['protein','fat','carbs','kcal'].some(k=>nutrition[k]==null);
 const estimated=(r.ingredients||[]).some(i=>i.nutritionOrigin==='reference');
 if(estimated)text(['ПРОЕКТ ТТК — КБЖУ справочные, необходимо сверить с этикетками сырья.'],X,807,W,6,false,'#765647');
 else if(r.status!=='ready'||missing)text(['ПРОЕКТ ТТК — незаполненные данные требуют проверки.'],X,807,W,6,false,'#765647');
 doc.moveTo(X,827).lineTo(X+W,827).lineWidth(layoutId==='royal-a4'?1.2:1).strokeColor(layoutId==='royal-a4'?'#C7A156':C.band).stroke();return doc;
}
