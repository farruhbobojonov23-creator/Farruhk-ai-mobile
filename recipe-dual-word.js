/* Editable .docx matching premium dual-column PDF layout.
 * No rasterized document: all recipe tables and text remain editable in Word. */
import {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,AlignmentType,ImageRun,BorderStyle} from 'docx';
import {premiumTtkTheme,ALLERGEN_OPTIONS} from './public/ttk-premium-themes.js';
import {scopeForName,regulatoryBasis} from './public/recipe-math.js';
const f=x=>x==null||x===''?'—':String(x);
const num=x=>x==null||x===''?'—':Number(x).toLocaleString('ru-RU',{maximumFractionDigits:2});
const hex=color=>color.replace('#','').toUpperCase();
const textLen=v=>String(v??'').length;
export async function premiumDualRecipeWord(r,nutrition){
 const C=premiumTtkTheme(r.layoutTemplate),ink=hex(C.ink),band=hex(C.band),line=hex(C.line),head=hex(C.head),cell=hex(C.cell);
 const estimatedLines=(r.ingredients||[]).length*1.1+
  (textLen(r.scope)+textLen(r.rawRequirements)+textLen(r.preparation)+textLen(r.forming||r.technology)+
   textLen(r.serving)+textLen(r.storage)+textLen(r.appearance)+textLen(r.taste)+textLen(r.safety))/48;
 // Word paginates differently depending on installed fonts and version.
 // Refuse exceptionally dense inputs rather than silently claim A4 single-page parity.
 if(estimatedLines>115)throw Object.assign(new Error('Для редактируемого Word слишком много текста для одного читаемого листа А4. Сократите описание без удаления обязательных сведений.'),{status:422,code:'TTK_A4_TOO_DENSE'});
 const para=(value,{bold=false,size=14,color=ink,after=0,align=AlignmentType.LEFT}={})=>new Paragraph({
  alignment:align,spacing:{before:0,after,line:188},children:[new TextRun({text:f(value),font:'Arial',size,bold,color})]
 });
 const border={color:line,style:BorderStyle.SINGLE,size:4};
 const borders={top:border,bottom:border,left:border,right:border};
 const blank=()=>new Paragraph({spacing:{before:0,after:0},children:[new TextRun({text:'',size:2})]});
 const table=(rows,weights,headerRow=false)=>{
  const total=weights.reduce((a,b)=>a+b,0);
  return new Table({width:{size:100,type:WidthType.PERCENTAGE},layout:'fixed',
   rows:rows.map((row,i)=>new TableRow({cantSplit:true,children:row.map((v,j)=>new TableCell({
    width:{size:100*weights[j]/total,type:WidthType.PERCENTAGE},
    shading:{fill:headerRow&&i===0?head:cell},
    margins:{top:50,bottom:50,left:70,right:70},borders,
    children:[para(v,{size:12.5,bold:headerRow&&i===0}),blank()]
   }))}))});
 };
 const block=(title,rows,weights,header=false)=>{
  const titleP=new Paragraph({shading:{fill:band},keepNext:true,spacing:{before:0,after:0},
   children:[new TextRun({text:'  '+title,font:'Arial',bold:true,color:'FFFFFF',size:15})]});
  return [titleP,table(rows,weights,header),blank()];
 };
 const scope=block('1. ОБЛАСТЬ ПРИМЕНЕНИЯ',[[scopeForName(r.scope,r.name)]],[1]);
 const raw=block('2. ТРЕБОВАНИЯ К СЫРЬЮ',[[f(r.rawRequirements)]],[1]);
 const ingredients=[['№','Ингредиент','Брутто, г','Нетто, г'],...(r.ingredients||[]).map((it,i)=>[String(i+1),f(it.name),num(it.grossGrams),num(it.grams)]),
  ['','ВЫХОД ('+(r.pieces?f(r.pieces)+' шт.':'1 порц.')+')','',num(r.netYieldGrams)+' г']];
 const recipe=block('3. РЕЦЕПТУРА',ingredients,[.08,.48,.22,.22],true);
 const proc=block('4. ТЕХНОЛОГИЧЕСКИЙ ПРОЦЕСС',[['Этап','Описание'],['Подготовка',f(r.preparation)],['Приготовление',f(r.forming||r.technology)],['Нарезка/подача',f(r.serving)]],[.29,.71],true);
 const storage=block('5. ОФОРМЛЕНИЕ, ПОДАЧА, РЕАЛИЗАЦИЯ И ХРАНЕНИЕ',[['Условия',f(r.storage)]],[.26,.74]);
 const quality=block('6. ПОКАЗАТЕЛИ КАЧЕСТВА И БЕЗОПАСНОСТИ',[['Внешний вид',f(r.appearance)],['Вкус/запах/консистенция',f(r.taste)],['Безопасность',f(r.safety)]],[.29,.71]);
 const nutritionRows=[['Показатель','На 100 г','На порцию'],...[
   ['Белки, г','protein'],['Жиры, г','fat'],['Углеводы, г','carbs'],['Ккал','kcal']
  ].map(([label,key])=>[label,num(nutrition[key]),nutrition[key]!=null&&Number(r.netYieldGrams)>0?num(Number(nutrition[key])*Number(r.netYieldGrams)/100):'—'])];
 const nutr=block('7. ПИЩЕВАЯ И ЭНЕРГЕТИЧЕСКАЯ ЦЕННОСТЬ',nutritionRows,[.42,.29,.29],true);
 const selected=new Set(r.allergens||[]);
 const allergyRows=[];
 for(let i=0;i<ALLERGEN_OPTIONS.length;i+=2){
  allergyRows.push([ALLERGEN_OPTIONS[i],ALLERGEN_OPTIONS[i+1]].map(pair=>pair?
    (selected.has(pair[0])?'☑ ':'☐ ')+(pair[0]==='other'&&r.allergenOther?'Другое: '+r.allergenOther:pair[1]):''));
 }
 const allergy=block('АЛЛЕРГЕНЫ · ОТМЕТЬТЕ ПРИСУТСТВУЮЩИЕ',allergyRows,[.5,.5]);
 const pairRow=(left,right)=>{
  const tableCell=children=>new TableCell({width:{size:50,type:WidthType.PERCENTAGE},borders:{top:{style:BorderStyle.NIL},bottom:{style:BorderStyle.NIL},left:{style:BorderStyle.NIL},right:{style:BorderStyle.NIL}},
   margins:{top:40,bottom:40,left:65,right:65},children:[...children,blank()]});
  return new Table({width:{size:100,type:WidthType.PERCENTAGE},layout:'fixed',
   rows:[new TableRow({cantSplit:true,children:[tableCell(left),tableCell(right)]})]});
 };
 let logoChildren=[para('FARRUH AI',{size:17,bold:true,color:'FFFFFF'})];
 if(typeof r.brandLogo==='string'&&/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/i.test(r.brandLogo)){
  const m=/^data:image\/(png|jpeg);base64,(.+)$/i.exec(r.brandLogo);
  try{const bytes=Buffer.from(m[2],'base64');if(bytes.length<1450000)logoChildren=[new Paragraph({children:[new ImageRun({data:bytes,type:m[1].toLowerCase()==='jpeg'?'jpg':'png',transformation:{width:130,height:33}})]})]}catch{}
 }
 const mast=new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[new TableRow({cantSplit:true,children:[
  new TableCell({width:{size:27,type:WidthType.PERCENTAGE},shading:{fill:band},borders,margins:{top:90,bottom:90,left:100,right:70},children:logoChildren}),
  new TableCell({width:{size:55,type:WidthType.PERCENTAGE},shading:{fill:band},borders,margins:{top:90,bottom:90,left:90,right:70},children:[para('ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ КАРТА',{size:17,bold:true,color:'FFFFFF'})]}),
  new TableCell({width:{size:18,type:WidthType.PERCENTAGE},shading:{fill:band},borders,margins:{top:90,bottom:90,left:80,right:60},children:[para('№ '+f(r.cardNumber),{size:15,bold:true,color:'FFFFFF'})]})
 ]})]});
 const name=new Paragraph({spacing:{before:45,after:50},children:[new TextRun({text:f(r.name),font:'Arial',size:24,bold:true,color:band})]});
 const metadata=table([
  ['Категория',f(r.category),'Дата',f(r.cardDate)],
  ['Выход',num(r.netYieldGrams)+' г','Количество',r.pieces?f(r.pieces)+' шт.':'—'],
  ['Предприятие',f(r.projectName||'_________________'),'Статус',r.status==='ready'?'Рецептура готова':'В разработке']
 ],[.20,.30,.17,.33]);
 const sign=pairRow(
  [para('РАЗРАБОТАЛ: '+(r.chef||'_________________'),{size:14,bold:true,color:band}),para('Должность __________  Подпись __________  Дата __________',{size:11})],
  [para('УТВЕРЖДАЮ: '+(r.approver||'_________________'),{size:14,bold:true,color:band}),para('Должность __________  Подпись __________  Дата __________',{size:11})]
 );
 const foot=para(regulatoryBasis,{size:10,color:ink,after:0});
 const children=[mast,name,metadata,blank(),pairRow(scope,raw),pairRow(recipe,proc),pairRow(storage,quality),pairRow(nutr,allergy),sign,foot];
 return Packer.toBuffer(new Document({creator:'FARRUH AI',title:'ТТК '+f(r.name),
  styles:{default:{document:{run:{font:'Arial',size:13,color:ink},paragraph:{spacing:{after:0,line:180}}}}},
  sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:345,bottom:345,left:360,right:360}}},children}]
 }));
}
