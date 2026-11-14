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
 'arctic-a4':{ink:'#153B5E',band:'#167FB9',line:'#AECFE5',paper:'#FAFCFF',cell:'#FFFFFF',head:'#DCEFFA'},
 'royal-a4':{ink:'#142E54',band:'#134D87',line:'#B9CEDF',paper:'#FFFFFF',cell:'#FFFFFF',head:'#E5F1FC'}};
 const C=themes[layoutId],X=20,W=555,G=9;
 // Owner requirement: A4 TTK is text-only. Saved catalog photos remain untouched.
 const photo=null;
 const value=v=>v==null||v===''?'—':String(v);
 function wrap(v,w,size,strong=false){doc.font(strong?'bold':'regular').fontSize(size);const lines=[];for(const p of value(v).split('\n')){let line='';for(const word of p.split(/\s+/)){if(!word)continue;if(doc.widthOfString(line?line+' '+word:word)<=w){line=line?line+' '+word:word;continue}if(line){lines.push(line);line=''}for(const c of word){if(line&&doc.widthOfString(line+c)>w){lines.push(line);line=''}line+=c}}lines.push(line||' ')}return lines}
 function text(lines,x,y,w,size,strong=false,color=C.ink){doc.font(strong?'bold':'regular').fontSize(size).fillColor(color);lines.forEach((s,i)=>doc.text(s,x,y+i*size*1.25,{width:w,lineBreak:false}));}
 function table(rows,x,y,w,s,draw,header=true){const cols=rows[0].length,ratios=cols===3?[.60,.20,.20]:cols===5?[.30,.175,.175,.175,.175]:cols===2?[.28,.72]:[1];let yy=y;rows.forEach((row,i)=>{const fs=7.6*s,pad=4*s,lines=row.map((v,j)=>wrap(v,w*ratios[j]-pad*2,fs,header&&i===0)),h=Math.max(15*s,Math.max(...lines.map(a=>a.length))*fs*1.25+pad*2);if(draw){let xx=x;row.forEach((v,j)=>{doc.rect(xx,yy,w*ratios[j],h).lineWidth(.4).fillAndStroke(header&&i===0?C.head:premium&&i%2===0?'#F8FBFE':C.cell,C.line);text(lines[j],xx+pad,yy+pad,w*ratios[j]-pad*2,fs,header&&i===0);xx+=w*ratios[j]})}yy+=h});return yy-y;}
 // For long ingredient lists use parallel table columns on the same A4.
 // This preserves every ingredient and numeric cell without shrinking all the
 // safety, technology and signature text to microscopic size.
 const ingredientCount=(r.ingredients||[]).length;
 const ingredientColumns=ingredientCount>65?4:ingredientCount>46?3:ingredientCount>18?2:1;
 doc.ttkIngredientColumns=ingredientColumns;
 function ingredientTable(rows,x,y,w,s,draw){
  const header=rows[0],items=rows.slice(1,-1),yieldRow=rows.at(-1);
  const gap=6*s,columnW=(w-gap*(ingredientColumns-1))/ingredientColumns;
  const each=Math.ceil(items.length/ingredientColumns);
  function compact(rows,px,py,pw,render){
   const shares=[.57,.215,.215],font=7.2*s,pad=2.6*s;let yy=py;
   for(let i=0;i<rows.length;i++){
    const cells=rows[i],wrapped=cells.map((v,j)=>wrap(v,pw*shares[j]-pad*2,font,i===0));
    const height=Math.max(12.7*s,Math.max(...wrapped.map(x=>x.length))*font*1.24+pad*2);
    if(render){
     let xx=px;for(let j=0;j<cells.length;j++){
      const cw=pw*shares[j];doc.rect(xx,yy,cw,height).lineWidth(.35).fillAndStroke(i===0?C.head:C.cell,C.line);
      text(wrapped[j],xx+pad,yy+pad,cw-2*pad,font,i===0);
      xx+=cw;
     }
    }
    yy+=height;
   }
   return yy-py;
  }
  let max=0;
  for(let col=0;col<ingredientColumns;col++){
   const part=items.slice(col*each,(col+1)*each);
   if(!part.length)continue;
   const rowsHere=[header,...part];
   max=Math.max(max,compact(rowsHere,x+col*(columnW+gap),y,columnW,draw));
  }
  const footH=table([yieldRow],x,y+max+4*s,w,s,draw,false);
  return max+4*s+footH;
 }
 function section(index,x,y,w,s,draw,min=0){
  const [title,rows]=sections[index],size=8.4*s,pad=6*s,
   hasBadge=premium&&/^\d+\./.test(title),label=hasBadge?title.replace(/^\d+\.\s*/, ''):title,
   lines=wrap(label,w-pad*2-(hasBadge?24*s:0),size,true),
   bh=lines.length*size*1.25+pad*2;
  const useColumns=index===2&&ingredientColumns>1;
  const th=useColumns?ingredientTable(rows,x,y+bh,w,s,false):table(rows,x,y+bh,w,s,false,rows[0].length>1);
  const h=Math.max(min,bh+th);
  if(draw){
   doc.roundedRect(x,y,w,h,7*s).lineWidth(.55*s).fillAndStroke(C.cell,C.line);
   doc.roundedRect(x,y,w,bh+2*s,6*s).fill(C.band);
   if(premium){
    // Golden numbered section badge, vector-only and variable length safe.
    const number=/^(\d+)\./.exec(title)?.[1];
    if(number){
     doc.roundedRect(x+4*s,y+2.6*s,19*s,Math.max(12*s,bh-5*s),4*s)
      .lineWidth(.5).fillAndStroke('#E6BD70','#D3A658');
     text([number],x+9*s,y+pad,w>200?15*s:14*s,8*s,true,'#173755');
    }
    const shown=title.replace(/^\d+\.\s*/, '');
    text(wrap(shown,w-pad*2-(number?24*s:0),size,true),
     x+pad+(number?24*s:0),y+pad,w-pad*2-(number?24*s:0),size,true,'#FFFFFF');
   }else text(lines,x+pad,y+pad,w-pad*2,size,true,'#FFF8F1');
   if(useColumns)ingredientTable(rows,x,y+bh,w,s,true);
   else table(rows,x,y+bh,w,s,true,rows[0].length>1);
  }
  return h;
 }
 function layout(s,draw=false){let y=20;const headerH=(premium?106:57)*s;
 if(draw){
  doc.rect(0,0,595.28,841.89).fill(C.paper);
  if(premium){
   // FARRUH AI Premium A4 — clean light-blue document with fine gold accents,
   // exact dynamic values; no photos or forced screenshot backgrounds.
   doc.rect(0,0,595.28,9*s).fill('#CBE7F7');
   doc.moveTo(X,12*s).lineTo(X+W,12*s).lineWidth(.85*s).strokeColor('#D5A75B').stroke();
   doc.roundedRect(X,y,W,headerH,8*s).lineWidth(.6*s).fillAndStroke('#FFFFFF',C.line);
   doc.roundedRect(X+3*s,y+3*s,W-6*s,52*s,7*s).fill('#F3F9FE');
   text(['◆  FARRUH AI'],X+12*s,y+6*s,W*.6,9*s,true,'#152F4E');
   doc.roundedRect(X+W-95*s,y+5*s,83*s,17*s,8*s)
      .lineWidth(.65*s).fillAndStroke('#FFF8EA','#DAAE60');
   text(['✦  PREMIUM'],X+W-86*s,y+8*s,72*s,7*s,true,'#8B5C22');
   text(['ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ КАРТА'],X+13*s,y+24*s,W-26*s,13*s,true,'#153657');
   text(wrap(r.name,W-24*s,11.2*s,true),X+13*s,y+44*s,W-24*s,11.2*s,true,'#174672');
   doc.moveTo(X+13*s,y+62*s).lineTo(X+W-13*s,y+62*s)
      .lineWidth(.8*s).strokeColor('#D8AF63').stroke();
   doc.roundedRect(X+6*s,y+66*s,W-12*s,35*s,6*s)
      .fill('#EAF4FB');
   const m1=[
    'ТТК № '+value(r.cardNumber),
    'Дата: '+value(r.cardDate),
    'Категория: '+value(r.category)
   ];
   const m2=[
    'Количество: '+(r.pieces?value(r.pieces)+' шт.':'—'),
    'Выход: '+(r.netYieldGrams?value(r.netYieldGrams)+' г':'—'),
    'Статус: '+(r.status==='ready'?'Готова':'В разработке')
   ];
   for(let i=0;i<3;i++){
    const xx=X+13*s+i*W/3.1;
    text([m1[i]],xx,y+70*s,W/3.3,6.9*s,i===0,'#254764');
    text([m2[i]],xx,y+84*s,W/3.3,6.9*s,i===2,'#254764');
   }
   // restrained gold corner flourish, no photographic asset
   doc.moveTo(X+W-80*s,y+55*s).lineTo(X+W-13*s,y+55*s)
      .lineWidth(1.1*s).strokeColor('#D6A85F').stroke();
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
  // Full-width sign-off row with separate areas for names, signatures and dates.
  // Do not invent a signer: missing values remain visible as blanks.
  const signH=31*s,signGap=10*s,signW=(W-signGap)/2;
  if(draw){
   for(const [i,label,name] of [
    [0,'Разработал (Шеф)',r.chef],[1,'Утверждаю (Руководитель)',r.approver]
   ]){
    const bx=X+i*(signW+signGap);
    doc.roundedRect(bx,y,signW,signH,5*s)
       .lineWidth(.8).fillAndStroke(C.cell,premium?'#D7AD66':C.line);
    text([label],bx+7*s,y+4*s,signW-14*s,7*s,true,C.band);
    text([name?String(name):'____________________________'],bx+7*s,y+14*s,signW-14*s,7.8*s,false,C.ink);
    text(['Подпись __________   Дата __________'],bx+7*s,y+23*s,signW-14*s,5.7*s,false,C.ink);
   }
  }
  y+=signH+7*s;
  const basis=wrap(regulatoryBasis,W,5.7*s);
  if(draw)text(basis,X,y,W,5.7*s,false,layoutId==='royal-a4'?'#6C6C78':'#57758A');
  y+=basis.length*7.125*s;
  return y;
 }
 let s=1;if(layout(s)>795){let lo=.001,hi=1;for(let i=0;i<20;i++){const m=(lo+hi)/2;if(layout(m)<=795)lo=m;else hi=m}s=lo}
 // Premium A4 must not reduce important table text to unreadable microscopic sizes.
 // Older "classic" prints keep their legacy 1-page behavior for compatibility.
 if(premium&&s<0.74)throw Object.assign(new Error('Весь текст не помещается на один читаемый лист А4. Сократи длинные описания или количество строк.'),{status:422,code:'TTK_A4_TOO_DENSE'});
 doc.ttkLayoutScale=s;doc.ttkLayoutHeight=layout(s);layout(s,true);
 const missing=['scope','safety','chef','approver','cardNumber','cardDate','rawRequirements','preparation','forming','serving','storage','appearance','taste','netYieldGrams'].some(k=>!r[k])||['protein','fat','carbs','kcal'].some(k=>nutrition[k]==null);
 const estimated=(r.ingredients||[]).some(i=>i.nutritionOrigin==='reference');
 const rawSum=(r.ingredients||[]).reduce((total,item)=>total+
   (Number.isFinite(Number(item.grams))?Number(item.grams):0),0);
 const reportedYield=Number(r.netYieldGrams);
 const yieldWarning=Number.isFinite(reportedYield)&&reportedYield>0&&rawSum>0&&
  Math.abs(reportedYield-rawSum)>Math.max(5,reportedYield*.02);
 const foot=[];
 if(estimated)foot.push('КБЖУ СПРАВОЧНЫЕ — нужна проверка по этикеткам.');
 if(r.status!=='ready'||missing)foot.push('ПРОЕКТ ТТК — есть незаполненные сведения.');
 if(yieldWarning)foot.push('ПРОВЕРЬ ВЫХОД: сумма нетто '+fmt(rawSum)+' г / указано '+fmt(reportedYield)+' г.');
 // Footnotes are intentionally warnings, never silent corrections of the recipe.
 doc.ttkWarnings=foot;
 foot.slice(0,2).forEach((line,i)=>text([line],X,803+i*9,W,6.25,true,
  layoutId==='royal-a4'?'#9B6D21':'#735335'));
 doc.moveTo(X,827).lineTo(X+W,827).lineWidth(premium?1.2:1).strokeColor(premium?'#CBA35D':C.band).stroke();return doc;
}
