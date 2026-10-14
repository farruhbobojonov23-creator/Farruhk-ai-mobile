import {calculateNutrition,regulatoryBasis,scopeForName,storageWithSanpin} from './public/recipe-math.js';
import PDFDocument from 'pdfkit';
import {cleanState} from './assistant-store.js';
const font=new URL('./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf',import.meta.url);
const bold=new URL('./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf',import.meta.url);
export function recipePdf(recipe){
 const doc=new PDFDocument({size:'A4',margin:0,bufferPages:true,info:{Title:'ТТК - '+recipe.name,Author:'Суши Бери'}});
 doc.registerFont('regular',font.pathname);doc.registerFont('bold',bold.pathname);
 const L=36,W=523,BOTTOM=788,GOLD='#194F82',PALE='#E3EEF7',INK='#17334D';
 const value=v=>v===null||v===undefined||v===''?'-':String(v);
 const kg=v=>Number.isFinite(Number(v))&&v!==null&&v!==''?(Number(v)/1000).toFixed(4).replace(/0$/,''):'-';
 const fmt=v=>Number.isFinite(Number(v))&&v!==null&&v!==''?Number(v).toLocaleString('ru-RU',{maximumFractionDigits:1}):'-';
 const blocks=[];
 const cells=(values,widths,options={})=>blocks.push({values,widths,options});
 const section=title=>blocks.push({title});
 cells(['Блюдо:',value(recipe.name),'Дата:',value(recipe.cardDate)],[74,270,48,99],{aligns:['left','center','left','center'],fills:[PALE,null,PALE,null]});
 cells(['Категория:',value(recipe.category),'ТТК №:',value(recipe.cardNumber)],[74,270,48,99],{aligns:['left','center','left','center'],fills:[PALE,null,PALE,null]});
 section('1. Область применения');cells([scopeForName(recipe.scope,recipe.name)],[W]);
 section('2. Требования к сырью');cells([value(recipe.rawRequirements)],[W]);
 section('3. Рецептура');cells(['Наименование сырья / полуфабриката','Масса БРУТТО, кг','Масса НЕТТО, кг'],[246,122.5,122.5],{fill:PALE,aligns:['center','center','center']});
 for(const i of recipe.ingredients||[])cells([i.name,kg(i.grossGrams),kg(i.grams)],[246,122.5,122.5],{aligns:['center','center','center']});
 if(!recipe.ingredients?.length)cells(['-','-','-'],[246,122.5,122.5]);
 const allNet=(recipe.ingredients||[]).length&&(recipe.ingredients||[]).every(i=>i.grams!==null&&i.grams!==undefined&&i.grams!=='');
 const allGross=(recipe.ingredients||[]).length&&(recipe.ingredients||[]).every(i=>i.grossGrams!==null&&i.grossGrams!==undefined&&i.grossGrams!=='');
 cells(['МАССА ЗАКЛАДКИ ИНГРЕДИЕНТОВ:',allGross?kg(recipe.ingredients.reduce((n,i)=>n+Number(i.grossGrams),0)):'-',allNet?kg(recipe.ingredients.reduce((n,i)=>n+Number(i.grams||0),0)):'-'],[246,122.5,122.5],{strong:true,aligns:['left','center','center']});
 cells(['ВЫХОД ГОТОВОГО БЛЮДА'+(recipe.pieces?' ('+recipe.pieces+' шт.)':'')+':',kg(recipe.netYieldGrams)],[368.5,122.5],{strong:true,aligns:['left','center']});
 section('4. Технологический процесс');cells(['Этап','Описание действий'],[123,W-123],{fill:PALE});
 cells(['Подготовка',value(recipe.preparation)],[123,W-123]);cells(['Формовка',value(recipe.forming||recipe.technology)],[123,W-123]);cells(['Нарезка / подача',value(recipe.serving)],[123,W-123]);
 section('5. Оформление, подача, реализация и хранение');cells([storageWithSanpin(recipe.storage)],[W]);
 section('6. Показатели качества и безопасности');cells(['Показатель','Характеристика'],[123,W-123],{fill:PALE});cells(['Внешний вид',value(recipe.appearance)],[123,W-123]);cells(['Вкус и текстура',value(recipe.taste)],[123,W-123]);cells([value(recipe.safety)],[W]);
 section('7. Пищевая ценность (на 100 г / на порцию)');
 const n=(recipe.nutritionMode==='ingredients'?calculateNutrition(recipe.ingredients||[],recipe.netYieldGrams):recipe.nutrition)||{},keys=['protein','fat','carbs','kcal'];
 cells(['Показатель','Белки, г','Жиры, г','Углеводы, г','Калорийность, ккал'],[123,78,78,96,116],{fill:PALE,aligns:['center','center','center','center','center']});
 cells(['На 100 г',...keys.map(k=>fmt(n[k]))],[123,78,78,96,116],{aligns:['center','center','center','center','center']});
 cells(['На порцию'+(recipe.netYieldGrams?' '+recipe.netYieldGrams+' г':''),...keys.map(k=>n[k]!==null&&n[k]!==undefined&&recipe.netYieldGrams?fmt(Number(n[k])*recipe.netYieldGrams/100):'-')],[123,78,78,96,116],{aligns:['center','center','center','center','center']});
 blocks.push({gap:10});cells(['Разработал (Шеф):',value(recipe.chef),'Утверждаю (Руководитель):',value(recipe.approver)],[123,122.5,123,122.5],{fills:[PALE,null,PALE,null]});
 blocks.push({note:regulatoryBasis});
 function wrap(text,width,size,strong=false){
  doc.font(strong?'bold':'regular').fontSize(size);const lines=[];
  for(const para of value(text).split('\n')){let line='';for(const word of para.split(/\s+/)){if(!word)continue;const candidate=line?line+' '+word:word;if(doc.widthOfString(candidate)<=width){line=candidate;continue}if(line){lines.push(line);line=''}if(doc.widthOfString(word)<=width){line=word;continue}for(const c of word){if(doc.widthOfString(line+c)>width&&line){lines.push(line);line=''}line+=c}}lines.push(line||' ')}return lines;
 }
 // Measure at the actual font sizes before drawing. All rows stay on one A4;
 // reduce typography and vertical spacing together when the content grows.
 function layout(scale,draw=false){
  let y=30;
  if(draw){doc.rect(L,y,W,26*scale).fill(GOLD);doc.font('bold').fontSize(9*scale).fillColor('#FFFFFF').text('ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ КАРТА · СУШИ БЕРИ',L+8,y+8*scale,{width:W-16,align:'center',lineBreak:false})}y+=33*scale;
  for(const block of blocks){
   if(block.gap){y+=block.gap*scale;continue}
   if(block.title){y+=5*scale;doc.font('bold').fontSize(8.1*scale);const w=Math.min(W,doc.widthOfString(block.title)+10*scale);if(draw){doc.rect(L+(W-w)/2,y,w,13*scale).fill(GOLD);doc.fillColor('#FFFFFF').text(block.title,L+(W-w)/2+3*scale,y+2*scale,{width:w-6*scale,align:'center',lineBreak:false})}y+=16*scale;continue}
   if(block.note){y+=6*scale;const lines=wrap(block.note,W,6*scale);const height=lines.length*7.5*scale;if(draw)doc.font('regular').fontSize(6*scale).fillColor(INK).text(lines.join('\n'),L,y,{width:W,height:height+scale});y+=height;continue}
   const {fill=null,strong=false,aligns=[],fills=[]}=block.options;
   const total=block.widths.reduce((a,b)=>a+b,0),widths=block.widths.map(w=>w*W/total);
   const lines=block.values.map((v,i)=>wrap(v,widths[i]-8,7*scale,strong));
   const height=Math.max(14*scale,Math.max(...lines.map(x=>x.length))*8.6*scale+5*scale);let x=L;
   if(draw)for(let i=0;i<widths.length;i++){if(fills[i]||fill)doc.rect(x,y,widths[i],height).fill(fills[i]||fill);doc.rect(x,y,widths[i],height).lineWidth(.55).strokeColor(GOLD).stroke();doc.font(strong?'bold':'regular').fontSize(7*scale).fillColor(INK).text(lines[i].join('\n'),x+4,y+2.5*scale,{width:widths[i]-8,height:height-4*scale,align:aligns[i]||'left',lineGap:0});x+=widths[i]}
   y+=height;
  }return y;
 }
 let scale=1;
 if(layout(1)>BOTTOM){let low=.001,high=1;for(let i=0;i<18;i++){const mid=(low+high)/2;if(layout(mid)<=BOTTOM)low=mid;else high=mid}scale=low}
 layout(scale,true);
 const missing=['scope','safety','chef','approver','cardNumber','cardDate','rawRequirements','preparation','forming','serving','storage','appearance','taste','netYieldGrams'].some(k=>!recipe[k])||keys.some(k=>n[k]===null||n[k]===undefined);
 doc.font('regular').fontSize(6.5).fillColor('#817957').text(recipe.status!=='ready'||missing?'ПРОЕКТ ТТК - незаполненные данные требуют проверки.':'',L,807,{width:W,lineBreak:false});
 return doc;
}
export function installRecipePdfApi(app,{store}){
 app.post('/api/recipes/pdf',(req,res)=>{
  try{const raw=req.body?.recipe;if(!raw||typeof raw.name!=='string'||!raw.name.trim()||!Array.isArray(raw.ingredients)||raw.ingredients.some(i=>!i||typeof i!=='object'))return res.status(400).json({error:'Неверная техкарта.'});const recipe=cleanState({recipes:[raw]}).recipes[0];const doc=recipePdf(recipe);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',"attachment; filename=recipe.pdf; filename*=UTF-8''"+encodeURIComponent('ТТК_'+recipe.name+'.pdf'));doc.on('error',()=>{if(!res.headersSent)res.status(500).json({error:'Не удалось подготовить PDF.'});else res.destroy()});doc.pipe(res);doc.end()}catch{res.status(400).json({error:'Не удалось подготовить PDF.'})}
 });
 app.get('/api/recipes/:id/pdf',async(req,res)=>{
  try{const state=await store.state(),recipe=(state.recipes||[]).find(r=>r.id===req.params.id);if(!recipe)return res.status(404).json({error:'Техкарта не найдена.'});const doc=recipePdf(recipe);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',"attachment; filename=recipe.pdf; filename*=UTF-8''"+encodeURIComponent('ТТК_'+recipe.name+'.pdf'));doc.on('error',()=>{if(!res.headersSent)res.status(500).json({error:'Не удалось подготовить PDF.'});else res.destroy()});doc.pipe(res);doc.end()}catch(e){res.status(500).json({error:'Не удалось подготовить PDF.'})}
 });
}
