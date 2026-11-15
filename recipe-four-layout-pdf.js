/* The four real, content-driven one-page A4 Premium variants.
 * No static screenshot backgrounds, no removed recipe information.
 * Allergen ticks are screening indicators, not supplier certification. */
import PDFDocument from 'pdfkit';
import {recipeSections} from './recipe-word.js';
import {regulatoryBasis} from './public/recipe-math.js';
import {recipeAllergenMatrix} from './public/ttk-allergens.js';
const regular=new URL('./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf',import.meta.url).pathname;
const bold=new URL('./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf',import.meta.url).pathname;
export const FOUR_TTK_LAYOUTS=Object.freeze(['teal-matrix','process-matrix','gold-allergen','premium-blue']);
const COLORS={
 'teal-matrix':{navy:'#003F44',band:'#006C65',accent:'#D7AB4C',pale:'#E4F4F0',light:'#F7FCFB',line:'#9BC9C1',text:'#183F42'},
 'process-matrix':{navy:'#003F42',band:'#008078',accent:'#CFA246',pale:'#E4F6EE',light:'#F9FDFB',line:'#90CAC2',text:'#133F43'},
 'gold-allergen':{navy:'#003D42',band:'#00665F',accent:'#D5A13F',pale:'#E9F6F1',light:'#FFFFF8',line:'#A4CFC8',text:'#173C40'},
 'premium-blue':{navy:'#0B2B55',band:'#14507D',accent:'#D7AD54',pale:'#DCECF8',light:'#F9FBFE',line:'#B6CCD9',text:'#17365A'}
};
const fmt=x=>x==null||x===''?'—':Number.isFinite(Number(x))?Number(x).toLocaleString('ru-RU',{maximumFractionDigits:2}):String(x);
const safe=x=>x==null||x===''?'—':String(x);
export function fourTtkPdf(input){
 const original=recipeSections(input),r=original.recipe,sections=original.sections;
 const layout=FOUR_TTK_LAYOUTS.includes(r.layoutTemplate)?r.layoutTemplate:'teal-matrix';
 const C=COLORS[layout],doc=new PDFDocument({size:'A4',margin:0,bufferPages:true,
  info:{Title:'ТТК — '+r.name,Author:'FARRUH AI Premium'}});
 doc.registerFont('r',regular);doc.registerFont('b',bold);
 const X=22,W=551,gap=9,group=recipeAllergenMatrix(r);
 const dense=(r.ingredients||[]).length>18;
 const nutrition=original.nutrition||{};
 const stats=Object.fromEntries(['protein','fat','carbs','kcal'].map(k=>[k,nutrition[k]]));
 function wrap(v,width,font,heavy=false){
  doc.font(heavy?'b':'r').fontSize(font);
  const lines=[];
  for(const paragraph of safe(v).split('\n')){
   let line='';
   for(const word of paragraph.split(/\s+/)){
    if(!word)continue;
    const candidate=line?line+' '+word:word;
    if(doc.widthOfString(candidate)<=width){line=candidate;continue}
    if(line){lines.push(line);line=''}
    for(const char of word){
     if(line&&doc.widthOfString(line+char)>width){lines.push(line);line=''}
     line+=char;
    }
   }
   lines.push(line||' ');
  }
  return lines;
 }
 function txt(value,x,y,width,font=7,heavy=false,color=C.text,draw=true){
  const lines=Array.isArray(value)?value:wrap(value,width,font,heavy);
  if(draw){
   doc.font(heavy?'b':'r').fontSize(font).fillColor(color);
   lines.forEach((line,i)=>doc.text(line,x,y+i*font*1.3,{width,lineBreak:false}));
  }
  return lines.length*font*1.3;
 }
 function cardTitle(label,x,y,w,s,draw){
  const number=/^\s*(\d+)\./.exec(label)?.[1];
  const heading=label.replace(/^\s*\d+\.\s*/,'');
  const px=6*s,f=8.3*s,offset=number?23*s:0;
  const lines=wrap(heading,w-2*px-offset,f,true);
  const height=Math.max(19*s,lines.length*f*1.3+10*s);
  if(draw){
   doc.roundedRect(x,y,w,height+2*s,6*s).fill(C.band);
   if(number){
    doc.roundedRect(x+4*s,y+3*s,18*s,height-4*s,4*s).fill(C.accent);
    txt(number,x+9*s,y+6*s,9*s,8*s,true,C.navy,true);
   }
   txt(lines,x+px+offset,y+5*s,w-2*px-offset,f,true,'#FFFFFF',true);
  }
  return height;
 }
 function drawTable(rows,x,y,w,s,draw,{header=true,ratios}={}){
  if(!rows.length)return 0;
  const count=rows[0].length;
  const shares=ratios||({1:[1],2:[.29,.71],3:[.58,.21,.21],5:[.31,.17,.17,.17,.18]})[count]||Array(count).fill(1/count);
  let yy=y;
  for(let i=0;i<rows.length;i++){
   const row=rows[i],f=(count===5?6.45:7.05)*s,pad=3.5*s;
   const cellLines=row.map((v,j)=>wrap(v,w*shares[j]-pad*2,f,header&&i===0));
   const height=Math.max(14*s,Math.max(...cellLines.map(a=>a.length))*f*1.29+pad*2);
   if(draw){
    let xx=x;
    for(let j=0;j<row.length;j++){
     const cw=w*shares[j];
     doc.rect(xx,yy,cw,height).lineWidth(.36*s).fillAndStroke(
      header&&i===0?C.pale:(i%2===0?'#F8FCFE':'#FFFFFF'),C.line);
     txt(cellLines[j],xx+pad,yy+pad,cw-2*pad,f,header&&i===0,C.text,true);
     xx+=cw;
    }
   }
   yy+=height;
  }
  return yy-y;
 }
 function box(label,rows,x,y,w,s,draw,{header=true,ratios}={}){
  const bh=cardTitle(label,x,y,w,s,false);
  const tableH=drawTable(rows,x,y+bh+2*s,w,s,false,{header,ratios});
  const height=bh+tableH+3*s;
  if(draw){
   doc.roundedRect(x,y,w,height,6*s).lineWidth(.7*s).stroke(C.line);
   cardTitle(label,x,y,w,s,true);
   drawTable(rows,x,y+bh+2*s,w,s,true,{header,ratios});
  }
  return height;
 }
 function textBox(label,body,x,y,w,s,draw){
  return box(label,[[body]],x,y,w,s,draw,{header:false});
 }
 function ingredientRows(){
  const items=Array.isArray(r.ingredients)?r.ingredients:[];
  const rows=[['№','Ингредиент','Брутто','Отходы %','Нетто']];
  for(let i=0;i<items.length;i++){
   const item=items[i]||{},gross=Number(item.grossGrams),net=Number(item.grams);
   const wast=Number.isFinite(gross)&&gross>0&&Number.isFinite(net)?Math.max(0,(gross-net)/gross*100):
    Number(item.lossPercent);
   rows.push([i+1,safe(item.name),fmt(item.grossGrams),fmt(Number.isFinite(wast)?wast:null),fmt(item.grams)]);
  }
  rows.push(['','Выход ('+(fmt(r.pieces)||'—')+' шт.)','','',fmt(r.netYieldGrams)+' г']);
  return rows;
 }
 function compactIngredients(x,y,w,s,draw){
  const items=Array.isArray(r.ingredients)?r.ingredients:[];
  const columns=items.length>46?4:items.length>24?3:items.length>18?2:1;
  doc.ttkIngredientColumns=columns;
  if(columns===1)return box('3. Рецептура (норма закладки)',ingredientRows(),x,y,w,s,draw,
   {header:true,ratios:[.07,.43,.18,.17,.15]});
  const bh=cardTitle('3. Рецептура (норма закладки)',x,y,w,s,false);
  const cg=5*s,cw=(w-cg*(columns-1))/columns,per=Math.ceil(items.length/columns);
  // Fit long, realistic prep catalogues without discarding any ingredient:
  // compact physical rows only in multi-column tables; all numeric data remains.
  function compactRows(rows,px,py,pw,drawRows){
   let yy=py;const shares=[.55,.225,.225],size=6.25*s,pad=2*s;
   for(let n=0;n<rows.length;n++){
    const cells=rows[n],lines=cells.map((v,j)=>wrap(v,pw*shares[j]-pad*2,size,n===0));
    const hh=Math.max(11*s,Math.max(...lines.map(a=>a.length))*size*1.2+pad*2);
    if(drawRows){
     let xx=px;
     for(let j=0;j<3;j++){
      const ww=pw*shares[j];
      doc.rect(xx,yy,ww,hh).lineWidth(.3*s)
       .fillAndStroke(n===0?C.pale:n%2?'#FFFFFF':C.light,C.line);
      txt(lines[j],xx+pad,yy+pad,ww-pad*2,size,n===0,C.text,true);
      xx+=ww;
     }
    }
    yy+=hh;
   }
   return yy-py;
  }
  const heightCol=[];
  for(let col=0;col<columns;col++){
   const part=items.slice(col*per,(col+1)*per);
   const rows=[['Сырьё','Брутто','Нетто'],...part.map(i=>[safe(i.name),fmt(i.grossGrams),fmt(i.grams)])];
   heightCol.push(compactRows(rows,x+col*(cw+cg),y+bh+2*s,cw,draw));
  }
  const maxH=Math.max(...heightCol),foot=15*s,total=bh+2*s+maxH+3*s+foot+3*s;
  if(draw){
   doc.roundedRect(x,y,w,total,6*s).lineWidth(.7*s).stroke(C.line);
   cardTitle('3. Рецептура (норма закладки)',x,y,w,s,true);
   doc.roundedRect(x,y+bh+maxH+4*s,w,foot,4*s).fill('#F9E6AF');
   txt('Выход готового блюда: '+fmt(r.netYieldGrams)+' г ('+fmt(r.pieces)+' шт.)',
    x+8*s,y+bh+maxH+7*s,w-16*s,8*s,true,C.navy,true);
  }
  return total;
 }
 function allergenBox(x,y,w,s,draw){
  const full=w>=350,cols=full?(dense?4:2):1,cellH=(full?(dense?11.5:13.0):12.0)*s;
  const titleHeight=21*s,rows=Math.ceil(group.groups.length/cols);
  const noteHeight=full?(dense?17*s:24*s):33*s,bodyH=rows*cellH;
  const height=titleHeight+bodyH+noteHeight+4*s;
  if(draw){
   doc.roundedRect(x,y,w,height,7*s).lineWidth(layout==='gold-allergen'?1.4*s:.7*s)
     .fillAndStroke('#FFFFFF',layout==='gold-allergen'?C.accent:C.line);
   doc.roundedRect(x,y,w,titleHeight,5*s).fill(
    layout==='gold-allergen'?'#E3BB66':layout==='premium-blue'?'#E0B15E':C.band);
   txt(layout==='gold-allergen'?'АЛЛЕРГЕНЫ В БЛЮДЕ':'МАТРИЦА АЛЛЕРГЕНОВ',
    x+8*s,y+5*s,w-16*s,8*s,true,
    layout==='gold-allergen'||layout==='premium-blue'?C.navy:'#FFFFFF',true);
   for(let i=0;i<group.groups.length;i++){
    const row=Math.floor(i/cols),col=i%cols,g=group.groups[i];
    const cx=x+col*w/cols,cy=y+titleHeight+row*cellH;
    doc.rect(cx,cy,w/cols,cellH).lineWidth(.32*s)
      .fillAndStroke(row%2?'#FFFFFF':C.light,C.line);
    const bx=cx+w/cols-16*s,by=cy+2*s;
    const tick=g.checked?'✓':g.possible?'?':'';
    doc.roundedRect(bx,by,10*s,9*s,2*s).lineWidth(.65*s)
      .fillAndStroke(g.checked?C.accent:g.possible?'#FFF1D4':'#FFFFFF',
       g.checked?C.accent:C.line);
    if(tick)txt(tick,bx+2*s,by+.5*s,8*s,7*s,true,g.checked?'#FFFFFF':'#80551C',true);
    txt(g.name,cx+4*s,cy+2*s,w/cols-24*s,6.9*s,false,C.text,true);
   }
   const note='Галочки — по составу. Сверь этикетки! Пустая клетка не подтверждает отсутствие аллергена.';
   const noteLines=wrap(note,w-12*s,5.75*s);
   txt(noteLines,x+6*s,y+titleHeight+bodyH+3*s,w-12*s,5.75*s,false,'#875C2D',true);
  }
  return height;
 }
 function processCards(x,y,w,s,draw){
  const titleH=cardTitle('4. Технология приготовления',x,y,w,s,false);
  const steps=sections[3][1].slice(1);
  const gap=5*s,cw=(w-gap*(steps.length-1))/steps.length;
  const data=steps.map(([head,content])=>({
   head:wrap(head,cw-10*s,6.7*s,true),
   body:wrap(content,cw-12*s,6.2*s)
  }));
  const eachH=Math.max(...data.map(a=>a.head.length*9*s+a.body.length*7.9*s+19*s),46*s);
  const height=titleH+4*s+eachH+3*s;
  if(draw){
   doc.roundedRect(x,y,w,height,6*s).lineWidth(.7*s).stroke(C.line);
   cardTitle('4. Технология приготовления',x,y,w,s,true);
   for(let i=0;i<steps.length;i++){
    const cx=x+i*(cw+gap),cy=y+titleH+4*s;
    doc.roundedRect(cx,cy,cw,eachH,5*s).lineWidth(.5*s).fillAndStroke('#FFFFFF',C.line);
    doc.circle(cx+12*s,cy+11*s,8*s).fill(C.accent);
    txt(String(i+1),cx+9*s,cy+6*s,8*s,8*s,true,C.navy,true);
    txt(data[i].head,cx+24*s,cy+5*s,cw-29*s,6.7*s,true,C.text,true);
    txt(data[i].body,cx+6*s,cy+24*s,cw-12*s,6.2*s,false,C.text,true);
   }
  }
  return height;
 }
 function nutritionBox(x,y,w,s,draw){
  const per=Number(r.netYieldGrams)>0?Number(r.netYieldGrams)/100:null;
  const body=[['Показатель','На 100 г','На порцию'],
   ['Белки, г',fmt(stats.protein),stats.protein!=null&&per?fmt(Number(stats.protein)*per):'—'],
   ['Жиры, г',fmt(stats.fat),stats.fat!=null&&per?fmt(Number(stats.fat)*per):'—'],
   ['Углеводы, г',fmt(stats.carbs),stats.carbs!=null&&per?fmt(Number(stats.carbs)*per):'—'],
   ['Ккал',fmt(stats.kcal),stats.kcal!=null&&per?fmt(Number(stats.kcal)*per):'—']];
  return box('7. Пищевая ценность (КБЖУ)',body,x,y,w,s,draw,{ratios:[.46,.27,.27]});
 }
 // Owner-approved FARRUH AI Premium masthead. All graphics are vector PDF
 // operations (not a screenshot or raster); the badges are document symbols.
 function drawMastIcon(type,cx,y,scale){
  const k=scale;
  doc.save();doc.strokeColor('#B98A35').lineWidth(1*k);
  if(type==='chef'){
   doc.circle(cx-4*k,y+5*k,2.1*k).stroke();
   doc.circle(cx,y+3.5*k,2.7*k).stroke();
   doc.circle(cx+4*k,y+5*k,2.1*k).stroke();
   doc.moveTo(cx-6*k,y+7*k).lineTo(cx-6*k,y+12*k).lineTo(cx+6*k,y+12*k).lineTo(cx+6*k,y+7*k).stroke();
  }else if(type==='shield'){
   doc.moveTo(cx,y).lineTo(cx+6*k,y+2.5*k).lineTo(cx+5*k,y+8*k)
    .lineTo(cx,y+13*k).lineTo(cx-5*k,y+8*k).lineTo(cx-6*k,y+2.5*k).closePath().stroke();
   doc.moveTo(cx-3*k,y+6.7*k).lineTo(cx-0.7*k,y+9*k).lineTo(cx+3.4*k,y+4.6*k).stroke();
  }else if(type==='box'){
   doc.moveTo(cx,y).lineTo(cx+6*k,y+3*k).lineTo(cx,y+6*k).lineTo(cx-6*k,y+3*k).closePath().stroke();
   doc.moveTo(cx-6*k,y+3*k).lineTo(cx-6*k,y+10*k).lineTo(cx,y+13*k)
    .lineTo(cx+6*k,y+10*k).lineTo(cx+6*k,y+3*k).stroke();
   doc.moveTo(cx,y+6*k).lineTo(cx,y+13*k).stroke();
  }else{
   doc.rect(cx-5.5*k,y+5*k,11*k,6*k).stroke();
   doc.rect(cx-4*k,y,8*k,5*k).stroke();
   doc.rect(cx-4*k,y+9*k,8*k,5*k).stroke();
   doc.circle(cx+3.1*k,y+7*k,.6*k).fill('#B98A35');
  }
  doc.restore();
 }
 function masthead(y,s,draw){
  // Very dense preparation catalogues (19–100+ ingredients) retain the same
  // mandatory labels in a slim vector strip, instead of shrinking all recipe
  // information below the minimum legible A4 scale.
  const h=(dense?9:27)*s;
  if(draw&&dense){
   // Single-line branded treatment for exceptionally long ingredient tables:
   // preserves every ingredient and the minimum export font scale.
   txt('♛ FARRUH AI Premium',X+2*s,y+.7*s,152*s,7*s,true,C.navy,true);
   txt('ТЕХКАРТЫ HORECA',X+155*s,y+1.8*s,153*s,5.6*s,true,C.navy,true);
   const badgeStart=X+329*s,badgeW=49*s,badgeGap=5*s;
   for(const [i,type,label] of [['chef','ТТК'],['shield','ХАССП'],['box','ПФ'],['print','Печать']].map((a,index)=>[index,...a])){
    const bx=badgeStart+i*(badgeW+badgeGap);
    doc.roundedRect(bx,y,badgeW,8.4*s,2*s).lineWidth(.5*s).strokeColor('#CEAB65').stroke();
    drawMastIcon(type,bx+8*s,y+.7*s,s*.38);
    txt(label,bx+15*s,y+1.2*s,badgeW-16*s,5*s,true,'#66491D',true);
   }
   doc.moveTo(X,y+h).lineTo(X+W,y+h).lineWidth(.6*s).strokeColor(C.accent).stroke();
  }else if(draw){
   // Brand left: restrained gold crown with stacked FARRUH AI / Premium.
   txt('♛',X+3*s,y+1.5*s,24*s,20*s,true,C.accent,true);
   txt('FARRUH AI',X+29*s,y+3*s,133*s,11*s,true,C.navy,true);
   txt('Premium',X+29*s,y+16*s,122*s,7.5*s,false,'#A87926',true);
   doc.moveTo(X+154*s,y+2*s).lineTo(X+154*s,y+23*s)
    .lineWidth(1*s).strokeColor(C.accent).stroke();
   txt(['ПРОФЕССИОНАЛЬНАЯ СИСТЕМА','ТЕХНОЛОГИЧЕСКИХ КАРТ','ДЛЯ HORECA'],
    X+162*s,y+3*s,165*s,6.0*s,true,C.navy,true);
   const badgeStart=X+333*s, badgeW=49*s, badgeGap=5*s;
   for(const [i,type,label] of [['chef','ТТК'],['shield','ХАССП'],['box','ПФ'],['print','Печать']].map((a,index)=>[index,...a])){
    const bx=badgeStart+i*(badgeW+badgeGap);
    doc.roundedRect(bx,y+1*s,badgeW,24*s,4*s).lineWidth(.7*s)
      .fillAndStroke('#FFFFFF','#CEAB65');
    drawMastIcon(type,bx+badgeW/2,y+3*s,s*.86);
    txt(label,bx+4*s,y+17*s,badgeW-8*s,5.7*s,true,'#66491D',true);
   }
   doc.moveTo(X,y+h).lineTo(X+W,y+h).lineWidth(.8*s).strokeColor(C.accent).stroke();
  }
  return h;
 }
 // Title bar follows the masthead; it remains the first content section.
 function headerHeight(s){
  const nameLines=wrap(r.name,W-24*s,12*s,true);
  return Math.max(79*s,(59+16*nameLines.length)*s);
 }
 function header(y,s,draw){
  const h=headerHeight(s);
  if(draw){
   const blue=layout==='premium-blue',dark=blue?C.navy:C.band;
   doc.roundedRect(X,y,W,h,7*s).lineWidth(.65*s).fillAndStroke('#FFFFFF',C.line);
   doc.roundedRect(X,y,W,29*s,6*s).fill(dark);
   txt('ТЕХНОЛОГИЧЕСКАЯ КАРТА (ТТК)',
    X+10*s,y+6*s,W-105*s,11.3*s,true,'#FFFFFF',true);
   doc.roundedRect(X+W-84*s,y+4*s,74*s,21*s,5*s)
    .lineWidth(.7*s).fillAndStroke(blue?'#123B6C':'#09584F',C.accent);
   txt('№ '+safe(r.cardNumber),X+W-79*s,y+8*s,65*s,9*s,true,'#F9E0A1',true);
   txt(wrap(r.name,W-24*s,12*s,true),
    X+12*s,y+34*s,W-24*s,12*s,true,C.navy,true);
   const data=[
    'Категория: '+safe(r.category),
    'Выход: '+fmt(r.netYieldGrams)+' г ('+fmt(r.pieces)+' шт.)',
    'Дата: '+safe(r.cardDate),
    'Статус: '+(r.status==='ready'?'Готова':'В разработке')
   ];
   const fractions=[.29,.31,.20,.20],usable=W-24*s;
   let xx=X+12*s;
   for(let i=0;i<data.length;i++){
    const ww=usable*fractions[i];
    doc.roundedRect(xx,y+h-24*s,ww-5*s,19*s,4*s)
     .lineWidth(.4*s).fillAndStroke(C.pale,C.line);
    txt(wrap(data[i],ww-13*s,6.5*s),xx+4*s,y+h-20*s,
     ww-13*s,6.5*s,i===1,C.text,true);
    xx+=ww;
   }
  }
  return h;
 }
 function layoutPage(s,draw=false){
  let y=18;
  if(draw){
   doc.rect(0,0,595.28,841.89).fill('#FFFFFF');
   doc.rect(0,0,595.28,8*s).fill(layout==='premium-blue'?C.navy:C.band);
   if(!dense)doc.moveTo(X,12*s).lineTo(X+W,12*s).lineWidth(1.1*s).strokeColor(C.accent).stroke();
  }
  // Dense ingredient catalogues use otherwise-empty 8–18pt top margin;
  // this avoids sacrificing the existing minimum .74 A4 type scale.
  if(dense)masthead(9*s,s,draw);
  else y+=masthead(y,s,draw)+4*s;
  y+=header(y,s,draw)+(dense?3:8)*s;
  const half=(W-gap)/2;
  const a=textBox('1. Область применения',sections[0][1][0][0],X,y,half,s,false),
   b=textBox('2. Требования к сырью',sections[1][1][0][0],X+half+gap,y,half,s,false),
   first=Math.max(a,b);
  if(draw){
   textBox('1. Область применения',sections[0][1][0][0],X,y,half,s,true);
   textBox('2. Требования к сырью',sections[1][1][0][0],X+half+gap,y,half,s,true);
  }
  y+=first+(dense?3:8)*s;
  if((r.ingredients||[]).length<=14&&layout!=='premium-blue'){
   const recipeW=W*.60,allergenW=W-recipeW-gap;
   const rs=compactIngredients(X,y,recipeW,s,false),
    as=allergenBox(X+recipeW+gap,y,allergenW,s,false);
   if(draw){compactIngredients(X,y,recipeW,s,true);allergenBox(X+recipeW+gap,y,allergenW,s,true)}
   y+=Math.max(rs,as)+(dense?3:8)*s;
  }else{
   y+=compactIngredients(X,y,W,s,draw)+6*s;
   y+=allergenBox(X,y,W,s,draw)+7*s;
  }
  if(layout==='process-matrix')y+=processCards(X,y,W,s,draw)+(dense?3:8)*s;
  else y+=box('4. Технология приготовления',sections[3][1],X,y,W,s,draw,{ratios:[.26,.74]})+(dense?3:8)*s;
  const lowerA=textBox('5. Условия хранения и реализации',sections[4][1][0][0],X,y,half,s,false),
   lowerB=box('6. Контроль качества',sections[5][1].filter(row=>row[0]!=='Безопасность'),X+half+gap,y,half,s,false,{ratios:[.34,.66]});
  if(draw){
   textBox('5. Условия хранения и реализации',sections[4][1][0][0],X,y,half,s,true);
   box('6. Контроль качества',sections[5][1].filter(row=>row[0]!=='Безопасность'),X+half+gap,y,half,s,true,{ratios:[.34,.66]});
  }
  y+=Math.max(lowerA,lowerB)+(dense?3:8)*s;
  y+=textBox('8. Безопасность (ХАССП)',safe(r.safety),X,y,W,s,draw)+7*s;
  y+=nutritionBox(X,y,W,s,draw)+(dense?3:8)*s;
  const signH=34*s,signGap=10*s,signW=(W-signGap)/2;
  if(draw)for(const [i,who,name] of [[0,'Разработал (Шеф)',r.chef],[1,'Утверждаю',r.approver]]){
   const x=X+i*(signW+signGap);
   doc.roundedRect(x,y,signW,signH,6*s).lineWidth(.9*s).fillAndStroke('#FFFFFF',C.accent);
   txt(who,x+8*s,y+4*s,signW-16*s,6.9*s,true,C.navy,true);
   txt(safe(name),x+8*s,y+14*s,signW-16*s,8*s,true,C.text,true);
   txt('Подпись __________   Дата __________',x+8*s,y+26*s,signW-16*s,5.5*s,false,C.text,true);
  }
  y+=signH+7*s;
  const basis=wrap(regulatoryBasis,W,5.3*s),notes=wrap(group.note,W,5.3*s);
  if(draw){
   txt(basis,X,y,W,5.3*s,false,C.text,true);
   txt(notes,X,y+basis.length*7*s,W,5.3*s,false,'#956A2D',true);
  }
  y+=(basis.length+notes.length)*7*s;
  return y;
 }
 let scale=1;
 if(layoutPage(1)>791){
  let lo=.001,hi=1;
  for(let i=0;i<23;i++){const mid=(lo+hi)/2;if(layoutPage(mid)<=791)lo=mid;else hi=mid;}
  scale=lo;
 }
 if(scale<.74)throw Object.assign(new Error('Невозможно разместить все сведения и матрицу аллергенов на одном читаемом листе А4 (масштаб '+scale.toFixed(2)+'). Уменьшите длинные описания или количество ингредиентов.'),{status:422,code:'TTK_A4_TOO_DENSE'});
 doc.ttkLayoutScale=scale;
 doc.ttkLayoutHeight=layoutPage(scale);
 doc.ttkAllergenMatrix=group;
 layoutPage(scale,true);
 const warnings=[];
 if(group.hasUnverified)warnings.push('АЛЛЕРГЕНЫ ПРЕДВАРИТЕЛЬНЫЕ — проверь этикетки и следы перекрёстного контакта.');
 if(r.status!=='ready')warnings.push('ТТК В РАЗРАБОТКЕ — сведения требуют утверждения.');
 const sum=(r.ingredients||[]).reduce((v,i)=>v+(Number(i.grams)||0),0);
 if(Number(r.netYieldGrams)>0&&sum>0&&Math.abs(sum-Number(r.netYieldGrams))>Math.max(5,Number(r.netYieldGrams)*.02))
  warnings.push('ВЫХОД НЕ СОВПАДАЕТ: нетто '+fmt(sum)+' г / заявлено '+fmt(r.netYieldGrams)+' г.');
 doc.ttkWarnings=warnings;
 // Include warnings inside the printable margins only if space is available.
 let bottom=Math.max(doc.ttkLayoutHeight+4,799);
 for(const warning of warnings.slice(0,2)){
  if(bottom+9>824)break;
  txt(warning,X,bottom,W,5.4,true,'#805A29',true);bottom+=9;
 }
 doc.moveTo(X,828).lineTo(X+W,828).lineWidth(1).strokeColor(C.accent).stroke();
 return doc;
}
