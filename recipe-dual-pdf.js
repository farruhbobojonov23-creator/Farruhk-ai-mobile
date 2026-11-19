/* Strict one-sheet, two-column premium TTK PDF.
   1 | 2, 3 | 4, 5 | 6, 7 | allergen checklist.
   Fit is measured before drawing; dense cards return 422 instead of losing content. */
import PDFDocument from 'pdfkit';
import {premiumTtkTheme,ALLERGEN_OPTIONS} from './public/ttk-premium-themes.js';
import {recipeSections} from './recipe-word.js';
import {regulatoryBasis,scopeForName} from './public/recipe-math.js';
const regular=new URL('./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf',import.meta.url).pathname;
const bold=new URL('./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf',import.meta.url).pathname;
const f=v=>v===undefined||v===null||v===''?'—':String(v);
const number=v=>v===undefined||v===null||v===''?'—':Number(v).toLocaleString('ru-RU',{maximumFractionDigits:2});
const rgb=s=>s||'#333333';
export function premiumDualRecipePdf(input){
 const {recipe:r,nutrition}=recipeSections(input),t=premiumTtkTheme(r.layoutTemplate);
 const doc=new PDFDocument({size:'A4',margin:0,bufferPages:true,info:{Title:'ТТК '+r.name,Author:'FARRUH AI'}});
 doc.registerFont('regular',regular);doc.registerFont('bold',bold);
 const x=20,W=555,gap=10,half=(W-gap)/2;
 const value=(v)=>f(v);
 function wrap(v,width,size,isBold=false){
  doc.font(isBold?'bold':'regular').fontSize(size);
  const result=[];
  for(const para of value(v).split(/\r?\n/)){
   let line='';
   for(const word of para.split(/\s+/)){
    if(!word)continue;
    const trial=line?line+' '+word:word;
    if(doc.widthOfString(trial)<=width){line=trial;continue}
    if(line){result.push(line);line=''}
    for(const ch of word){if(line&&doc.widthOfString(line+ch)>width){result.push(line);line=''}line+=ch}
   }
   result.push(line||' ');
  }
  return result;
 }
 const drawText=(arr,tx,ty,width,size,boldText=false,color=t.ink)=>{
  doc.fillColor(rgb(color)).font(boldText?'bold':'regular').fontSize(size);
  arr.forEach((line,i)=>doc.text(line,tx,ty+i*size*1.3,{width,lineBreak:false}));
 };
 const sectionData=[
  {title:'1. ОБЛАСТЬ ПРИМЕНЕНИЯ',rows:[[scopeForName(r.scope,r.name)]],weights:[1],header:false},
  {title:'2. ТРЕБОВАНИЯ К СЫРЬЮ',rows:[[f(r.rawRequirements)]],weights:[1],header:false},
  {title:'3. РЕЦЕПТУРА',rows:[['№','Ингредиент','Брутто, г','Нетто, г'],...(r.ingredients||[]).map((it,i)=>[String(i+1),f(it.name),number(it.grossGrams),number(it.grams)]),['','ВЫХОД '+(r.pieces?f(r.pieces)+' шт.':''),'',number(r.netYieldGrams)+' г']],weights:[.08,.48,.22,.22],header:true},
  {title:'4. ТЕХНОЛОГИЧЕСКИЙ ПРОЦЕСС',rows:[['Этап','Описание'],['Подготовка',f(r.preparation)],['Приготовление',f(r.forming||r.technology)],['Нарезка / подача',f(r.serving)]],weights:[.30,.70],header:true},
  {title:'5. ОФОРМЛЕНИЕ, ПОДАЧА, РЕАЛИЗАЦИЯ И ХРАНЕНИЕ',rows:[['Условия',f(r.storage)]],weights:[.26,.74],header:false},
  {title:'6. ПОКАЗАТЕЛИ КАЧЕСТВА И БЕЗОПАСНОСТИ',rows:[['Внешний вид',f(r.appearance)],['Вкус, запах и консистенция',f(r.taste)],['Безопасность',f(r.safety)]],weights:[.30,.70],header:false},
  {title:'7. ПИЩЕВАЯ И ЭНЕРГЕТИЧЕСКАЯ ЦЕННОСТЬ',rows:[['Показатель','На 100 г','На порцию'],...[
   ['Белки, г','protein'],['Жиры, г','fat'],['Углеводы, г','carbs'],['Ккал','kcal']
  ].map(([label,key])=>[label,number(nutrition[key]),nutrition[key]!=null&&Number(r.netYieldGrams)>0?number(Number(nutrition[key])*Number(r.netYieldGrams)/100):'—'])],weights:[.42,.29,.29],header:true},
  {title:'АЛЛЕРГЕНЫ · ОТМЕТЬТЕ ПРИСУТСТВУЮЩИЕ',allergens:true}
 ];
 function titleMetrics(block,width,s){
  const label=block.title.replace(/^([1-7])\.\s*/,''),badge=/^[1-7]\.\s/.exec(block.title)?.[0]?.charAt(0)||null;
  const free=width-(badge?39*s:22*s);
  let font=8.6*s,lines=wrap(label,free,font,true);
  while(font>6.1*s&&lines.length>1){font-=.18*s;lines=wrap(label,free,font,true)}
  return {label,badge,font,lines,width:free};
 }
 function measure(block,width,s){
  const metrics=titleMetrics(block,width,s),barPad=5*s;
  const titleFont=metrics.font,titleLines=metrics.lines;
  const barH=titleLines.length*titleFont*1.30+barPad*2;
  if(block.allergens){
   const heights=Array.from({length:Math.ceil(ALLERGEN_OPTIONS.length/2)},(_,row)=>{
    const items=[ALLERGEN_OPTIONS[row*2],ALLERGEN_OPTIONS[row*2+1]].filter(Boolean);
    const lines=items.map(([key,label])=>wrap(key==='other'&&r.allergenOther?'Другое: '+r.allergenOther:label,width/2-22*s,6.7*s));
    return Math.max(20*s,Math.max(...lines.map(x=>x.length))*6.7*s*1.3+8*s);
   });
   return {barH,heights,total:barH+heights.reduce((a,b)=>a+b,0)};
  }
  const font=7*s,pad=3.5*s;
  const heights=block.rows.map((row,idx)=>{
   const pieces=row.map((v,j)=>wrap(v,width*block.weights[j]-pad*2,font,block.header&&idx===0));
   return Math.max(17*s,Math.max(...pieces.map(a=>a.length))*font*1.3+2*pad);
  });
  return {barH,heights,total:barH+heights.reduce((a,b)=>a+b,0)};
 }
 function drawBlock(block,bx,by,width,height,s){
  const info=measure(block,width,s),metric=titleMetrics(block,width,s),titlePad=5*s,font=7*s,pad=3.5*s;
  doc.roundedRect(bx,by,width,height,5*s).fill(t.cell);
  const gradient=doc.linearGradient(bx,by,bx+width,by);
  gradient.stop(0,t.band).stop(.6,t.band).stop(1,t.id==='emerald-gold-a4'?'#006144':t.band);
  doc.roundedRect(bx,by,width,info.barH,4*s).fill(gradient);
  doc.rect(bx,by+info.barH-1.8*s,width,1.8*s).fill(t.accent);
  if(metric.badge){
   doc.roundedRect(bx+4*s,by+3*s,26*s,Math.max(14*s,info.barH-6*s),4*s)
    .lineWidth(.55).fillAndStroke(t.head,t.accent);
   drawText([metric.badge],bx+12*s,by+6*s,15*s,12*s,true,t.band);
  }
  drawText(metric.lines,bx+(metric.badge?34:6)*s,by+titlePad,metric.width,metric.font,true,'#FFFFFF');
  let yy=by+info.barH;
  if(block.allergens){
   const selected=new Set(r.allergens||[]);
   ALLERGEN_OPTIONS.forEach(([key,label],index)=>{
    const column=index%2, row=Math.floor(index/2),cellWidth=width/2;
    const cellX=bx+column*cellWidth,cellY=yy+info.heights.slice(0,row).reduce((a,b)=>a+b,0),cellH=info.heights[row];
    doc.rect(cellX,cellY,cellWidth,cellH).lineWidth(.35).fillAndStroke(t.cell,t.line);
    const squareX=cellX+5*s,squareY=cellY+5*s;
    doc.roundedRect(squareX,squareY,11*s,11*s,1.5*s).lineWidth(1.25*s).strokeColor(t.band).stroke();
    if(selected.has(key)){
     doc.moveTo(squareX+1.3*s,squareY+4.2*s).lineTo(squareX+3.6*s,squareY+7.2*s).lineTo(squareX+8*s,squareY+1.2*s).lineWidth(1.4*s).strokeColor(t.band).stroke();
    }
    const caption=key==='other'&&r.allergenOther?'Другое: '+r.allergenOther:label;
    drawText(wrap(caption,cellWidth-24*s,6.9*s),cellX+19*s,cellY+4*s,cellWidth-24*s,6.9*s,false,t.ink);
   });
  }else{
   block.rows.forEach((row,i)=>{
    let xx=bx;const rh=info.heights[i];
    row.forEach((v,j)=>{
     const cellW=width*block.weights[j];
     doc.rect(xx,yy,cellW,rh).lineWidth(.35).fillAndStroke(block.header&&i===0?t.head:(i%2===0?t.cell:'#FFF3DD'),t.line);
     const lines=wrap(v,cellW-2*pad,font,block.header&&i===0);
     drawText(lines,xx+pad,yy+pad,cellW-2*pad,font,block.header&&i===0,t.ink);
     xx+=cellW;
    });yy+=rh;
   });
  }
  doc.roundedRect(bx,by,width,height,4*s).lineWidth(.55).strokeColor(t.line).stroke();
 }
 function layout(s,paint=false){
  let y=18;
  const headerH=100*s;
  if(paint){
   doc.rect(0,0,595.28,841.89).fill(t.paper);
   doc.roundedRect(x,y,W,headerH,7*s).lineWidth(.75).fillAndStroke(t.cell,t.accent);
   const top=doc.linearGradient(x,y,x+W,y);top.stop(0,t.band).stop(.57,t.band).stop(1,t.id==='emerald-gold-a4'?'#006146':t.band);
   doc.rect(x,y,W,34*s).fill(top);
   doc.rect(x,y+33*s,W,2*s).fill(t.accent);
   if(t.id==='emerald-gold-a4'){
    // Vector fan ornament: editable, resolution-independent and kept behind header text.
    doc.save().lineWidth(.45*s).strokeColor(t.accent);
    for(let k=0;k<5;k++){
     doc.moveTo(x+W-86*s,y+30*s).bezierCurveTo(x+W-55*s,y+(2+k*3)*s,x+W-35*s,y+(22+k*2)*s,x+W-6*s,y+(4+k*4)*s).stroke();
    }doc.restore();
   }
   let logo=null;
   if(typeof r.brandLogo==='string'){
    const match=/^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=]+)$/i.exec(r.brandLogo);
    if(match&&match[1].length<1800000)logo=Buffer.from(match[1],'base64');
   }
   if(logo){try{doc.image(logo,x+6*s,y+4*s,{fit:[115*s,26*s],align:'left',valign:'center'})}catch{logo=null}}
   if(!logo)drawText(['FARRUH AI'],x+8*s,y+9*s,123*s,11*s,true,'#FFFFFF');
   drawText(['ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ КАРТА'],x+150*s,y+8*s,W-255*s,8.6*s,true,'#FFF3C9');
   doc.roundedRect(x+W-82*s,y+5*s,74*s,24*s,7*s).lineWidth(.9*s).strokeColor(t.accent).stroke();
   drawText(['ТТК № '+f(r.cardNumber)],x+W-77*s,y+10*s,65*s,8.5*s,true,'#FFF1C7');
   drawText(wrap(r.name,W-20*s,14*s,true).slice(0,2),x+8*s,y+39*s,W-16*s,14*s,true,t.band);
   drawText(['Категория: '+f(r.category)+'   •   Дата: '+f(r.cardDate)+'   •   Статус: '+(r.status==='ready'?'Рецептура готова':'Проект')],x+8*s,y+70*s,W-18*s,7*s,false,t.ink);
   drawText(['Предприятие: '+f(r.projectName||'—')+'   •   Выход: '+(Number(r.netYieldGrams)>0?number(r.netYieldGrams)+' г':'—')+'   •   Количество: '+(r.pieces?f(r.pieces)+' шт.':'—')],x+8*s,y+83*s,W-18*s,7*s,false,t.ink);
  }
  y+=headerH+9*s;
  for(const [leftIndex,rightIndex] of [[0,1],[2,3],[4,5],[6,7]]){
   const a=sectionData[leftIndex],b=sectionData[rightIndex];
   const h=Math.max(measure(a,half,s).total,measure(b,half,s).total);
   if(paint){drawBlock(a,x,y,half,h,s);drawBlock(b,x+half+gap,y,half,h,s)}
   y+=h+8*s;
  }
  const signH=45*s,signW=(W-gap)/2;
  if(paint){
   [['Разработал',r.chef],['Утверждаю',r.approver]].forEach(([title,name],i)=>{
    const xx=x+i*(signW+gap);
    doc.roundedRect(xx,y,signW,signH,4*s).lineWidth(.5).fillAndStroke(t.cell,t.line);
    drawText([title+': '+(name||'____________________')],xx+7*s,y+6*s,signW-14*s,7.5*s,true,t.band);
    drawText(['Должность ___________  Подпись ___________'],xx+7*s,y+21*s,signW-14*s,6.3*s,false,t.ink);
    drawText(['Дата утверждения/составления: ______________'],xx+7*s,y+32*s,signW-14*s,6.1*s,false,t.ink);
   });
  }
  y+=signH+6*s;
  const foot=wrap(regulatoryBasis,W-8*s,5.8*s);
  if(paint)drawText(foot,x+2*s,y,W-4*s,5.8*s,false,t.ink);
  y+=foot.length*7.55*s;
  if(paint&&t.id==='emerald-gold-a4'){
   // Signature / footer cannot overflow; reserve visual trim at the fixed bottom.
   doc.save();
   doc.moveTo(0,826).bezierCurveTo(115,805,195,839,295,825).bezierCurveTo(385,810,465,807,595.28,826)
     .lineTo(595.28,841.89).lineTo(0,841.89).closePath().fill('#003B2E');
   doc.moveTo(0,822).bezierCurveTo(115,801,195,835,295,821).bezierCurveTo(385,806,465,803,595.28,822)
     .lineWidth(4).strokeColor(t.accent).stroke();
   doc.moveTo(0,825).bezierCurveTo(115,804,195,838,295,824).bezierCurveTo(385,809,465,806,595.28,825)
     .lineWidth(.8).strokeColor('#FFF0B9').stroke();
   doc.restore();
  }
  return y;
 }
 let s=1;
 if(layout(s)>804){
  let low=.5,high=1;
  for(let i=0;i<24;i++){const mid=(low+high)/2;if(layout(mid)>804)high=mid;else low=mid}
  s=low;
 }
 if(s<.78)throw Object.assign(new Error('ТТК не помещается на один читаемый лист А4: сократите длинные описания или проверьте количество строк. Обязательные сведения не удалены.'),{status:422,code:'TTK_A4_TOO_DENSE'});
 doc.ttkLayoutScale=s;
 doc.ttkLayoutHeight=layout(s);
 const missing=['scope','rawRequirements','preparation','forming','serving','storage','appearance','taste','safety','chef','approver','cardNumber','cardDate','netYieldGrams'].some(key=>!r[key])||['protein','fat','carbs','kcal'].some(key=>nutrition[key]==null);
 const sum=(r.ingredients||[]).reduce((total,it)=>total+(Number(it.grams)||0),0);
 doc.ttkWarnings=[];
 if(r.status!=='ready'||missing)doc.ttkWarnings.push('Проект: имеются незаполненные или неподтверждённые сведения.');
 if(r.netYieldGrams&&Math.abs(sum-Number(r.netYieldGrams))>Math.max(5,Number(r.netYieldGrams)*.02))doc.ttkWarnings.push('Проверь выход: сумма нетто '+number(sum)+' г.');
 if((r.ingredients||[]).some(i=>i.nutritionOrigin==='reference'))doc.ttkWarnings.push('КБЖУ справочные: требуется сверка с этикетками.');
 layout(s,true);
 // Hard stop: drawing below footer would silently create another page.
 if(doc.ttkLayoutHeight>812)throw Object.assign(new Error('Переполнение А4'),{status:422});
 return doc;
}
