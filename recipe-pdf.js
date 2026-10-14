import PDFDocument from 'pdfkit';
const font=new URL('./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf',import.meta.url);
const bold=new URL('./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf',import.meta.url);
export function recipePdf(recipe){
 const doc=new PDFDocument({size:'A4',margin:0,bufferPages:true,info:{Title:'ТТК - '+recipe.name,Author:'Суши Бери'}});
 doc.registerFont('regular',font.pathname);doc.registerFont('bold',bold.pathname);
 const L=52,W=491,BOTTOM=784,GOLD='#B4A04B',PALE='#F4E5A9',INK='#25251D';let y=49;
 const value=v=>v===null||v===undefined||v===''?'-':String(v);
 const kg=v=>Number.isFinite(Number(v))&&v!==null&&v!==''?(Number(v)/1000).toFixed(4).replace(/0$/,''):'-';
 const fmt=v=>Number.isFinite(Number(v))&&v!==null&&v!==''?Number(v).toLocaleString('ru-RU',{maximumFractionDigits:1}):'-';
 function line(){doc.strokeColor('#808080').lineWidth(.5).moveTo(L,y).lineTo(L+W,y).stroke()}
 function head(){line();y+=8;doc.font('bold').fontSize(8).fillColor('#5C532E').text('ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ КАРТА (Суши Бери)',L,y,{width:W,align:'center'});y+=19;line();y+=8}
 function newPage(){doc.addPage();y=49;head()}
 function ensure(h){if(y+h>BOTTOM)newPage()}
 function wrap(text,width,size=7.3,strong=false){doc.font(strong?'bold':'regular').fontSize(size);const lines=[];for(const para of value(text).split('\n')){let line='';for(const word of para.split(/\s+/)){if(!word)continue;const candidate=line?line+' '+word:word;if(doc.widthOfString(candidate)<=width){line=candidate;continue}if(line){lines.push(line);line=''}if(doc.widthOfString(word)<=width){line=word;continue}for(const c of word){if(doc.widthOfString(line+c)>width&&line){lines.push(line);line=''}line+=c}}lines.push(line||' ')}return lines}
 function cells(values,widths,{fill=null,strong=false,aligns=[],fills=[]}={}){
  const lines=values.map((v,i)=>wrap(v,widths[i]-8,7.3,strong));let offset=0;
  while(offset<Math.max(...lines.map(x=>x.length))){
   ensure(21);const count=Math.max(1,Math.floor((BOTTOM-y-8)/10));const remaining=Math.max(...lines.map(x=>x.length))-offset;const take=Math.min(count,remaining),height=Math.max(18,take*10+8);let x=L;
   for(let i=0;i<widths.length;i++){if(fills[i]||fill)doc.rect(x,y,widths[i],height).fill(fills[i]||fill);doc.rect(x,y,widths[i],height).lineWidth(.55).strokeColor(GOLD).stroke();doc.font(strong?'bold':'regular').fontSize(7.3).fillColor(INK).text(lines[i].slice(offset,offset+take).join('\n')||' ',x+4,y+4,{width:widths[i]-8,height:height-6,align:aligns[i]||'left',lineGap:1});x+=widths[i]}
   y+=height;offset+=take;if(offset<Math.max(...lines.map(x=>x.length)))newPage();
  }
 }
 function section(title){ensure(45);y+=12;doc.font('bold').fontSize(8.1);const w=Math.min(W,doc.widthOfString(title)+10);doc.rect(L+(W-w)/2,y,w,13).fill(GOLD);doc.fillColor('#FFFFFF').text(title,L+(W-w)/2+3,y+2,{width:w-6,align:'center',lineBreak:false});y+=19}
 head();
 cells(['Блюдо:',value(recipe.name),'Дата:',value(recipe.cardDate)],[74,270,48,99],{aligns:['left','center','left','center'],fills:[PALE,null,PALE,null]});
 cells(['Категория:',value(recipe.category),'ТТК №:',value(recipe.cardNumber)],[74,270,48,99],{aligns:['left','center','left','center'],fills:[PALE,null,PALE,null]});
 section('1. Требования к сырью');cells([value(recipe.rawRequirements)],[W]);
 section('2. Рецептура (Матрица ингредиентов)');
 cells(['Наименование сырья / полуфабриката','Масса БРУТТО, кг','Масса НЕТТО, кг'],[246,122.5,122.5],{fill:PALE,aligns:['center','center','center']});
 for(const i of recipe.ingredients||[])cells([i.name,kg(i.grossGrams),kg(i.grams)],[246,122.5,122.5],{aligns:['center','center','center']});
 if(!recipe.ingredients?.length)cells(['-','-','-'],[246,122.5,122.5]);
 const allNet=(recipe.ingredients||[]).length&&(recipe.ingredients||[]).every(i=>i.grams!==null&&i.grams!==undefined&&i.grams!=='');
 const allGross=(recipe.ingredients||[]).length&&(recipe.ingredients||[]).every(i=>i.grossGrams!==null&&i.grossGrams!==undefined&&i.grossGrams!=='');
 cells(['МАССА ЗАКЛАДКИ ИНГРЕДИЕНТОВ:',allGross?kg(recipe.ingredients.reduce((n,i)=>n+Number(i.grossGrams),0)):'-',allNet?kg(recipe.ingredients.reduce((n,i)=>n+Number(i.grams||0),0)):'-'],[246,122.5,122.5],{strong:true,aligns:['left','center','center']});
 cells(['ВЫХОД ГОТОВОГО БЛЮДА'+(recipe.pieces?' ('+recipe.pieces+' шт.)':'')+':',kg(recipe.netYieldGrams)],[368.5,122.5],{strong:true,aligns:['left','center']});
 section('3. Технологический процесс приготовления');
 cells(['Этап','Описание действий'],[123,W-123],{fill:PALE});
 cells(['Подготовка',value(recipe.preparation)],[123,W-123]);cells(['Формовка',value(recipe.forming||recipe.technology)],[123,W-123]);cells(['Нарезка / подача',value(recipe.serving)],[123,W-123]);
 section('4. Требования к оформлению, подаче и хранению');cells([value(recipe.storage)],[W]);
 section('5. Органолептические показатели');cells(['Показатель','Характеристика'],[123,W-123],{fill:PALE});cells(['Внешний вид',value(recipe.appearance)],[123,W-123]);cells(['Вкус и текстура',value(recipe.taste)],[123,W-123]);
 section('6. Пищевая ценность (на 100 г / на порцию)');
 const n=recipe.nutrition||{},keys=['protein','fat','carbs','kcal'];
 cells(['Показатель','Белки, г','Жиры, г','Углеводы, г','Калорийность, ккал'],[123,78,78,96,116],{fill:PALE,aligns:['center','center','center','center','center']});
 cells(['На 100 г',...keys.map(k=>fmt(n[k]))],[123,78,78,96,116],{aligns:['center','center','center','center','center']});
 cells(['На порцию'+(recipe.netYieldGrams?' '+recipe.netYieldGrams+' г':''),...keys.map(k=>n[k]!==null&&n[k]!==undefined&&recipe.netYieldGrams?fmt(Number(n[k])*recipe.netYieldGrams/100):'-')],[123,78,78,96,116],{aligns:['center','center','center','center','center']});
 ensure(60);y+=28;cells(['Разработал (Шеф):',value(recipe.chef),'Утверждаю (Руководитель):',value(recipe.approver)],[123,122.5,123,122.5],{fills:[PALE,null,PALE,null]});
 const missing=['cardNumber','cardDate','rawRequirements','preparation','forming','serving','storage','appearance','taste','netYieldGrams'].some(k=>!recipe[k])||keys.some(k=>n[k]===null||n[k]===undefined);
 const pages=doc.bufferedPageRange();for(let i=0;i<pages.count;i++){doc.switchToPage(i);doc.font('regular').fontSize(6.5).fillColor('#817957').text((recipe.status!=='ready'||missing?'ПРОЕКТ ТТК - незаполненные данные требуют проверки.':'')+(pages.count>1?'   Страница '+(i+1)+' / '+pages.count:''),L,807,{width:W,align:'center'})}
 return doc;
}
export function installRecipePdfApi(app,{store}){
 app.get('/api/recipes/:id/pdf',async(req,res)=>{
  try{const state=await store.state(),recipe=(state.recipes||[]).find(r=>r.id===req.params.id);if(!recipe)return res.status(404).json({error:'Техкарта не найдена.'});const doc=recipePdf(recipe);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',"attachment; filename=recipe.pdf; filename*=UTF-8''"+encodeURIComponent('ТТК_'+recipe.name+'.pdf'));doc.on('error',()=>{if(!res.headersSent)res.status(500).json({error:'Не удалось подготовить PDF.'});else res.destroy()});doc.pipe(res);doc.end()}catch(e){res.status(500).json({error:'Не удалось подготовить PDF.'})}
 });
}
