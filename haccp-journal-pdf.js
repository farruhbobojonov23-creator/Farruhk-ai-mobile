import PDFDocument from 'pdfkit';
import {validateHaccp,journalTypes} from './public/haccp-model.js';
import {measurementDate,monthLabel} from './public/temperature-journal.js';
import {paperColumns,paperCell} from './public/haccp-paper-layout.js';

const REGULAR=new URL('./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf',import.meta.url).pathname;
const BOLD=new URL('./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf',import.meta.url).pathname;
const X=24,W=794,BOTTOM=530,LINE=10;
const safeLines=(doc,text,width)=>{
 doc.font('regular').fontSize(7);
 const output=[];
 for(const paragraph of String(text??'').replace(/\r/g,'').split('\n')){
  if(paragraph===''){output.push('');continue}
  let line='';
  for(const word of paragraph.split(/\s+/)){
   const candidate=line?line+' '+word:word;
   if(doc.widthOfString(candidate)<=width){line=candidate;continue}
   if(line)output.push(line);
   line='';
   for(const char of word){
    if(doc.widthOfString(line+char)>width&&line){output.push(line);line=''}
    line+=char;
   }
  }
  output.push(line);
 }
 return output.length?output:[''];
};
export function journalPdf({haccp,kind,month,pointId=''}){
 const h=validateHaccp(haccp),period=monthLabel(month);
 if(!journalTypes[kind])throw Error('Выбери журнал.');
 if(pointId&&!h.points.some(p=>p.id===pointId))throw Error('Точка не найдена.');
 const records=h.records.filter(r=>r.kind===kind&&measurementDate(r.at).slice(0,7)===month&&(!pointId||r.pointId===pointId))
  .sort((a,b)=>a.at.localeCompare(b.at));
 if(records.length>5000)throw Error('Выбери одну точку для выгрузки.');
 const columns=paperColumns(kind),sum=columns.reduce((v,c)=>v+c.weight,0);
 const widths=columns.map(c=>W*c.weight/sum);
 const doc=new PDFDocument({autoFirstPage:false,bufferPages:true,info:{Title:'ХАССП — '+journalTypes[kind],Author:'FARRUH AI'}});
 doc.registerFont('regular',REGULAR).registerFont('bold',BOLD);
 const edge='#a9c2d5',ink='#23445e',head='#e2f2ff';
 let y=0;
 function text(value,x,pos,w,{bold=false,size=7,color=ink,align='left'}={}){
  doc.font(bold?'bold':'regular').fontSize(size).fillColor(color)
   .text(String(value),x,pos,{width:w,lineBreak:false,align,height:size*1.7});
 }
 function rect(x,pos,w,h,fill){doc.rect(x,pos,w,h).fillAndStroke(fill,edge)}
 function createPage(){
  doc.addPage({size:'A4',layout:'landscape',margin:0});
  doc.rect(X,19,4,44).fill('#2c89bf');
  text('ХАССП / ЖУРНАЛ КОНТРОЛЯ',X+12,18,W-20,{bold:true,size:9,color:'#387ba8'});
  doc.font('bold').fontSize(14).fillColor('#19476c').text(journalTypes[kind],X+12,35,{width:W-22});
  text(period+'  ·  '+(pointId?h.points.find(p=>p.id===pointId).name:'Все точки'),X+12,63,W-24,{size:9});
  text('Фактические записи. Пустая строка не означает выполненную проверку. Время: МСК.',X,86,W,{size:8,color:'#57758c'});
  let x=X;const headerTop=102,headerHeight=38;
  for(let i=0;i<columns.length;i++){
   const col=columns[i];rect(x,headerTop,widths[i],headerHeight,head);
   const lines=safeLines(doc,col.label,widths[i]-8).slice(0,3);
   lines.forEach((line,j)=>text(line,x+4,headerTop+7+j*10,widths[i]-8,{bold:true,size:7,color:'#244b6c'}));
   x+=widths[i];
  }
  y=headerTop+headerHeight;
 }
 function drawRows(lines,kindFill){
  let offset=0,total=Math.max(1,...lines.map(row=>row.length));
  while(offset<total){
   if(BOTTOM-y<LINE+10)createPage();
   const count=Math.min(total-offset,Math.max(1,Math.floor((BOTTOM-y-10)/LINE)));
   const height=count*LINE+10;
   let x=X;
   for(let i=0;i<columns.length;i++){
    rect(x,y,widths[i],height,kindFill);
    for(let n=0;n<count;n++)text(lines[i][offset+n]??'',x+4,y+5+n*LINE,widths[i]-8);
    x+=widths[i];
   }
   y+=height;offset+=count;
  }
 }
 function note(value){
  const lines=safeLines(doc,'Примечание: '+value,W-14);
  let offset=0;
  while(offset<lines.length){
   if(BOTTOM-y<20)createPage();
   const count=Math.min(lines.length-offset,Math.max(1,Math.floor((BOTTOM-y-8)/LINE)));
   const height=count*LINE+7;
   rect(X,y,W,height,'#f0f7fc');
   for(let j=0;j<count;j++)text(lines[offset+j],X+7,y+4+j*LINE,W-14,{size:7});
   offset+=count;y+=height;
  }
 }
 createPage();
 if(!records.length){
  doc.font('regular').fontSize(8).fillColor('#466c89')
   .text('Подтверждённых записей пока нет. Ниже — чистый бланк для заполнения; строки не означают выполнение проверок.',
    X,y+6,{width:W});
  y+=34;
  for(let n=0;n<10;n++){
   if(BOTTOM-y<32)createPage();
   let x=X;
   for(const width of widths){rect(x,y,width,32,n%2===0?'#ffffff':'#f7fbff');x+=width}
   y+=32;
  }
 }
 for(let i=0;i<records.length;i++){
  const r=records[i],lines=columns.map(c=>safeLines(doc,paperCell(r,c.key,h.points),widths[columns.indexOf(c)]-9));
  drawRows(lines,r.status==='deviation'?'#fff1ee':i%2?'#f5faff':'#ffffff');
  if(r.notes&&!columns.some(c=>c.key==='notes'))note(r.notes);
 }
 const range=doc.bufferedPageRange();
 for(let i=0;i<range.count;i++){
  doc.switchToPage(i);
  doc.moveTo(X,546).lineTo(X+W,546).lineWidth(.6).stroke('#a9c2d5');
  text('Проверил: ________________________   Подпись: ________________________   Дата: ______________',X,552,W-68,{size:7.5});
  text((i+1)+' / '+range.count,X+W-54,552,54,{size:7.5,align:'right'});
 }
 return doc;
}
export function installJournalPdfApi(app,{requireSameOrigin=(req,res,next)=>next()}={}){
 app.post('/api/haccp/journal/pdf',requireSameOrigin,(req,res)=>{
  let doc;
  try{doc=journalPdf(req.body||{})}catch(error){return res.status(400).json({error:error.message})}
  res.type('pdf');
  res.setHeader('Content-Disposition',"attachment; filename=haccp-journal.pdf; filename*=UTF-8''"+encodeURIComponent('ХАССП_'+req.body.kind+'_'+req.body.month+'.pdf'));
  doc.on('error',()=>res.destroy());doc.pipe(res);doc.end();
 });
}
