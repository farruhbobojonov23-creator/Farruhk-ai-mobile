import PDFDocument from 'pdfkit';
import {calculateNutrition,regulatoryBasis,scopeForName,storageWithSanpin,resolveCategoryFields,lossFromWeights} from './public/recipe-math.js';
const regular=new URL('./node_modules/dejavu-fonts-ttf/ttf/DejaVuSerif.ttf',import.meta.url).pathname;
const bold=new URL('./node_modules/dejavu-fonts-ttf/ttf/DejaVuSerif-Bold.ttf',import.meta.url).pathname;
const art=new URL('./public/assets/ttk-blue-premium.png',import.meta.url).pathname;
const headerArt=new URL('./public/assets/ttk-sapphire-header.png',import.meta.url).pathname;
export function premiumRecipePdf(input){
 const r=resolveCategoryFields(input),doc=new PDFDocument({size:'A4',margin:0,bufferPages:true,info:{Title:'ТТК - '+r.name,Author:'Суши Бери'}});
 doc.registerFont('regular',regular);doc.registerFont('bold',bold);
 const X=16,W=563,GAP=7,HALF=(W-GAP)/2,BLUE='#064578',DEEP='#032F59',LINE='#B7D7F1',PALE='#EAF4FD',INK='#101D32';
 const val=x=>x===null||x===undefined||x===''?'-':String(x);
 const fmt=(x,digits=3)=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x).toLocaleString('ru-RU',{maximumFractionDigits:digits}):'-';
 const date=r.cardDate&&/^\d{4}-\d{2}-\d{2}$/.test(r.cardDate)?r.cardDate.split('-').reverse().join('.'):val(r.cardDate);
 const n=(r.nutritionMode==='ingredients'?calculateNutrition(r.ingredients||[],r.netYieldGrams):r.nutrition)||{};
 function wrap(text,width,size,strong=false){doc.font(strong?'bold':'regular').fontSize(size);const out=[];for(const paragraph of val(text).split('\n')){let line='';for(const word of paragraph.split(/\s+/)){if(!word)continue;if(doc.widthOfString(line?(line+' '+word):word)<=width){line=line?line+' '+word:word;continue}if(line){out.push(line);line=''}for(const letter of word){if(line&&doc.widthOfString(line+letter)>width){out.push(line);line=''}line+=letter}}out.push(line||' ')}return out}
 function textLines(lines,x,y,width,size,strong=false,color=INK,align='left'){doc.font(strong?'bold':'regular').fontSize(size).fillColor(color);for(let i=0;i<lines.length;i++)doc.text(lines[i],x,y+i*size*1.3,{width,align,lineBreak:false})}
 function waves(x,y,w,h){const k=Math.max(w/1033,h/32);doc.save().rect(x,y,w,h).clip();doc.image(art,x-11*k,y-1445*k,{width:1055*k});doc.restore()}
 function band(number,title,x,y,w,scale,draw){const h=23*scale;if(draw){const g=doc.linearGradient(x,y,x+w,y);g.stop(0,DEEP).stop(1,'#12629D');doc.roundedRect(x,y,w,h,4*scale).fill(g);waves(x+w-92,y,92,h);doc.circle(x+14*scale,y+h/2,9.2*scale).fill('#F3F7FA');textLines([number],x+6*scale,y+3.1*scale,16*scale,12*scale,true,DEEP,'center');let size=12*scale;while(doc.font('bold').fontSize(size).widthOfString(title)>w-36*scale)size*=.95;textLines([title],x+34*scale,y+4*scale,w-38*scale,size,true,'#FFFFFF') }return h}
 function icon(kind,x,y,scale){const z=scale;doc.save().translate(x,y).scale(z);doc.circle(20,20,20).fill('#D6EAFB');doc.strokeColor('#064578').lineWidth(1.7);if(kind==='chef'){doc.roundedRect(9,17,22,15,2).stroke();doc.circle(11,14,6).fillAndStroke('#FFFFFF','#064578');doc.circle(20,10,7).fillAndStroke('#FFFFFF','#064578');doc.circle(29,14,6).fillAndStroke('#FFFFFF','#064578');doc.moveTo(9,26).lineTo(31,26).stroke()}else if(kind==='leaf'){doc.moveTo(11,29).bezierCurveTo(30,30,32,5,32,5).bezierCurveTo(13,8,9,15,16,23).stroke();doc.moveTo(12,32).lineTo(25,14).stroke()}else if(kind==='shield'){doc.moveTo(20,6).lineTo(32,11).lineTo(31,25).lineTo(20,34).lineTo(9,25).lineTo(8,11).closePath().stroke();doc.moveTo(14,19).lineTo(19,24).lineTo(27,15).stroke()}else if(kind==='dish'){doc.moveTo(6,29).lineTo(34,29).lineTo(34,33).lineTo(6,33).closePath().stroke();doc.moveTo(9,26).bezierCurveTo(9,7,31,7,31,26).stroke();doc.circle(20,9,2).stroke()}else{doc.circle(20,20,12).stroke();doc.circle(20,20,5).stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;doc.moveTo(20+12*Math.cos(a),20+12*Math.sin(a)).lineTo(20+17*Math.cos(a),20+17*Math.sin(a)).stroke()}}doc.restore()}
 function pairContent(title,number,body,kind,x,y,w,scale,draw,minimum=0){const bh=band(number,title,x,y,w,scale,draw),size=8.2*scale,pad=7*scale,iconW=46*scale,tw=w-iconW-pad*3,lines=wrap(body,tw,size),height=Math.max(49*scale,lines.length*size*1.3+pad*2,minimum-bh-2*scale);if(draw){doc.roundedRect(x,y+bh+2*scale,w,height,4*scale).fillAndStroke('#F8FBFE',LINE);icon(kind,x+pad,y+bh+10*scale,.93*scale);textLines(lines,x+iconW+pad*2,y+bh+pad+2*scale,tw,size)}return bh+height+2*scale}
 function row(values,widths,x,y,scale,draw,{fill=null,strong=false}={}){const size=8*scale,lines=values.map((v,i)=>wrap(v,widths[i]-12*scale,size,strong)),height=Math.max(18*scale,Math.max(...lines.map(a=>a.length))*size*1.3+7*scale);if(draw){let xx=x;for(let i=0;i<values.length;i++){doc.rect(xx,y,widths[i],height).fillAndStroke(fill||'#F8FBFE',LINE);textLines(lines[i],xx+6*scale,y+3.5*scale,widths[i]-12*scale,size,strong,INK,i===1?'left':'center');xx+=widths[i]}}return height}
 function layout(scale,draw=false){
  let y=16,headerH=111*scale;
  if(draw){
   // Decorative background only: preserve the original header height and all body coordinates.
   doc.image(headerArt,X,y,{width:W,height:headerH});
   const hx=X+99*scale,hw=W-205*scale;textLines(['ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ КАРТА'],hx,y+10*scale,hw,9*scale,false,'#FFFFFF','center');doc.moveTo(hx+12*scale,y+24*scale).lineTo(hx+hw-12*scale,y+24*scale).strokeColor('#B8DBF2').lineWidth(.5).stroke();
   let nameSize=34*scale;while(doc.font('bold').fontSize(nameSize).widthOfString(val(r.name))>hw&&nameSize>7*scale)nameSize*=.94;const names=wrap(r.name,hw,nameSize,true);textLines(names,hx,y+30*scale,hw,nameSize,true,'#FFFFFF','center');
   const meta='ТТК № '+val(r.cardNumber)+'  •  '+date+'  •  '+val(r.category);let ms=8.1*scale;while(doc.font('bold').fontSize(ms).widthOfString(meta)>hw)ms*=.95;textLines([meta],hx,y+73*scale,hw,ms,true,'#FFFFFF','center');
   const badge='Выход: '+fmt(r.netYieldGrams)+' г'+(r.pieces?'  •  '+r.pieces+' шт.':'');doc.roundedRect(hx+hw*.15,y+87*scale,hw*.7,18*scale,9*scale).fill('#EDF3F6');textLines([badge],hx+hw*.15,y+90*scale,hw*.7,10*scale,true,DEEP,'center');
  }y+=headerH+6*scale;
  const a=pairContent('Область применения','1',scopeForName(r.scope,r.name),'chef',X,y,HALF,scale,false),b=pairContent('Требования к сырью','2',r.rawRequirements,'leaf',X+HALF+GAP,y,HALF,scale,false);if(draw){pairContent('Область применения','1',scopeForName(r.scope,r.name),'chef',X,y,HALF,scale,true,Math.max(a,b));pairContent('Требования к сырью','2',r.rawRequirements,'leaf',X+HALF+GAP,y,HALF,scale,true,Math.max(a,b))}y+=Math.max(a,b)+6*scale;
  y+=band('3','Рецептура',X,y,W,scale,draw)+5*scale;
  const widths=[W*.065,W*.385,W*.18,W*.18,W*.19];y+=row(['№','Ингредиент','Брутто, г','Нетто, г','Отходы, %'],widths,X,y,scale,draw,{fill:'#CFE5F8',strong:true});
  const ingredients=r.ingredients?.length?r.ingredients:[{}];for(let i=0;i<ingredients.length;i++){const item=ingredients[i];const loss=item.lossPercent??lossFromWeights(item.grossGrams,item.grams);y+=row([i+1,val(item.name),fmt(item.grossGrams),fmt(item.grams),fmt(loss)],widths,X,y,scale,draw,{fill:i%2?PALE:'#FFFFFF'})}
  y+=row(['Выход готового блюда'+(r.pieces?' ('+r.pieces+' шт.)':'')+':',fmt(r.netYieldGrams)+' г'],[W*.8,W*.2],X,y,scale,draw,{fill:'#DDEDFC',strong:true});y+=6*scale;
  y+=band('4','Технологический процесс',X,y,W,scale,draw)+5*scale;
  const processTop=y,bodyX=X+79*scale,bodyW=W-235*scale;
  if(draw)icon('gear',X+11*scale,y+12*scale,1.05*scale);
  for(const [i,label,body] of [[1,'Подготовка',r.preparation],[2,'Приготовление',r.forming||r.technology],[3,'Нарезка / подача',r.serving]]){const size=8.2*scale,lines=wrap(label+'. '+val(body),bodyW,size);if(draw){doc.circle(bodyX-13*scale,y+7*scale,7*scale).fill(BLUE);textLines([String(i)],bodyX-19*scale,y+1*scale,12*scale,8*scale,true,'#FFFFFF','center');textLines(lines,bodyX,y,bodyW,size)}y+=Math.max(20*scale,lines.length*size*1.3+6*scale)}
  const sideX=X+W-139*scale,sideW=139*scale,sideText='Категория: '+val(r.category)+'\nКоличество: '+val(r.pieces)+' шт.\nВыход: '+fmt(r.netYieldGrams)+' г\nТТК № '+val(r.cardNumber),sideLines=wrap(sideText,sideW-16*scale,8*scale);const sideH=sideLines.length*10.4*scale+30*scale;if(draw){doc.roundedRect(sideX,processTop,sideW,sideH,5*scale).fill('#DCEEFD');textLines(['Ключевые данные'],sideX+8*scale,processTop+7*scale,sideW-16*scale,9*scale,true,DEEP);textLines(sideLines,sideX+8*scale,processTop+25*scale,sideW-16*scale,8*scale)}y=Math.max(y,processTop+sideH)+6*scale;
  const quality='Внешний вид: '+val(r.appearance)+'\nВкус и текстура: '+val(r.taste)+'\nБезопасность: '+val(r.safety);
  const c=pairContent('Оформление, подача и хранение','5',storageWithSanpin(r.storage),'dish',X,y,HALF,scale,false),d=pairContent('Показатели качества и безопасности','6',quality,'shield',X+HALF+GAP,y,HALF,scale,false);if(draw){pairContent('Оформление, подача и хранение','5',storageWithSanpin(r.storage),'dish',X,y,HALF,scale,true,Math.max(c,d));pairContent('Показатели качества и безопасности','6',quality,'shield',X+HALF+GAP,y,HALF,scale,true,Math.max(c,d))}y+=Math.max(c,d)+6*scale;
  y+=band('7','Пищевая ценность',X,y,W,scale,draw)+5*scale;
  const nw=[W*.46,W*.27,W*.27];y+=row(['Наименование показателя','На 100 г','На порцию '+fmt(r.netYieldGrams)+' г'],nw,X,y,scale,draw,{fill:'#CFE5F8',strong:true});
  for(const [key,label] of [['protein','Белки, г'],['fat','Жиры, г'],['carbs','Углеводы, г'],['kcal','Энергетическая ценность, ккал']])y+=row([label,fmt(n[key],1),n[key]!==null&&n[key]!==undefined&&r.netYieldGrams?fmt(Number(n[key])*r.netYieldGrams/100,1):'-'],nw,X,y,scale,draw,{fill:PALE});
  y+=8*scale;const signatures=wrap('Разработал (Шеф): '+val(r.chef)+'    Утверждаю (Руководитель): '+val(r.approver),W,8*scale);if(draw)textLines(signatures,X,y,W,8*scale,true);y+=signatures.length*10.4*scale+5*scale;
  const basis=wrap(regulatoryBasis,W,5.5*scale);if(draw)textLines(basis,X,y,W,5.5*scale,false,'#49687F');y+=basis.length*7.15*scale;
  return y;
 }
 let scale=1;if(layout(1)>797){let lo=.001,hi=1;for(let i=0;i<18;i++){const mid=(lo+hi)/2;if(layout(mid)<=797)lo=mid;else hi=mid}scale=lo}layout(scale,true);
 const missing=['scope','safety','chef','approver','cardNumber','cardDate','rawRequirements','preparation','forming','serving','storage','appearance','taste','netYieldGrams'].some(k=>!r[k])||['protein','fat','carbs','kcal'].some(k=>n[k]===null||n[k]===undefined);
 if(r.status!=='ready'||missing)textLines(['ПРОЕКТ ТТК - незаполненные данные требуют проверки.'],X,803,W,5.5,false,'#49687F');
 doc.rect(X,816,W,17).fill(DEEP);waves(X,816,W,17);return doc;
}
