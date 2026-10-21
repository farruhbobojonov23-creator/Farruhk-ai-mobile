import PDFDocument from 'pdfkit';
import {validateHaccp,journalTypes} from './public/haccp-model.js';
import {measurementDate,monthLabel} from './public/temperature-journal.js';
import {paperColumns,paperCell} from './public/haccp-paper-layout.js';
import {automaticJournalSummary,plannedCell} from './public/haccp-auto-journals.js';

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
  text('Дата и время: МСК',X,86,W,{size:8,color:'#57758c'});
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
  // An official empty form contains only ruled spaces, never system notes
  // about whether a check has been performed or a record is confirmed.
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
// Read-only monthly print pack: all 12 journals, prefilled dates/points/equipment,
// verbatim saved measurements, and unmistakably UNVERIFIED missing checks.
export function autoJournalPackPdf({haccp,month,pointId='',now=new Date()}={}){
 const h=validateHaccp(haccp);
 if(pointId&&!h.points.some(p=>p.id===pointId))throw Error('Точка не найдена.');
 const label=monthLabel(month);
 const pack=automaticJournalSummary(h,{month,pointId,now});
 if(pack.confirmed+pack.planned>2400)
  throw Error('Слишком много строк. Выбери одну точку для автосборки журналов.');
 const doc=new PDFDocument({autoFirstPage:false,bufferPages:true,
  info:{Title:'ХАССП — 12 журналов · '+label,Author:'FARRUH AI'}});
 doc.registerFont('regular',REGULAR).registerFont('bold',BOLD);
 const edge='#adc5d8',textInk='#22445e',heading='#1e5d86';
 let y=0,cols=[],widths=[],kind='',section=0;
 function labelText(str,x,top,w,size=7,bold=false,color=textInk){
  doc.font(bold?'bold':'regular').fontSize(size).fillColor(color)
   .text(String(str||''),x,top,{width:w,lineBreak:false,height:size*1.6});
 }
 function cellBox(x,top,w,h,fill){
  doc.rect(x,top,w,h).fillAndStroke(fill,edge);
 }
 function wrap(value,w){
  doc.font('regular').fontSize(7);
  const text=String(value??'');
  const lines=[];
  for(const paragraph of text.replace(/\r/g,'').split('\n')){
   let current='';
   for(const word of paragraph.split(/\s+/)){
    const candidate=current?current+' '+word:word;
    if(doc.widthOfString(candidate)<=w){current=candidate;continue}
    if(current)lines.push(current);
    current='';
    for(const character of word){
     if(doc.widthOfString(current+character)>w&&current){lines.push(current);current=''}
     current+=character;
    }
   }
   lines.push(current);
  }
  return lines.length?lines:[''];
 }
 function page(){
  doc.addPage({size:'A4',layout:'landscape',margin:0});
  doc.rect(X,16,4,49).fill('#2e94c7');
  labelText('FARRUH AI  /  ХАССП  /  '+String(section).padStart(2,'0')+' / 12',X+13,17,W-20,9,true,'#3e88b7');
  labelText(journalTypes[kind],X+13,34,W-23,14,true,'#194e73');
  labelText(label+'   ·   '+(pointId?h.points.find(p=>p.id===pointId).name:'Все точки'),X+13,65,W-23,9,false);
  labelText('Дата и время: МСК',X,85,W,7.4,false,'#607e96');
  const first=103,headerHeight=38;let x=X;
  for(let i=0;i<cols.length;i++){
   cellBox(x,first,widths[i],headerHeight,'#deeffb');
   wrap(cols[i].label,widths[i]-8).slice(0,3).forEach((part,k)=>
    labelText(part,x+4,first+6+k*10,widths[i]-8,6.7,true,'#245477'));
   x+=widths[i];
  }
  y=first+headerHeight;
 }
 function draw(values,fill){
  const lines=values.map((v,i)=>wrap(v,widths[i]-8));
  const total=Math.max(1,...lines.map(item=>item.length));
  let start=0;
  while(start<total){
   if(y>530-20)page();
   const rows=Math.min(total-start,Math.max(1,Math.floor((530-y-9)/10)));
   const height=rows*10+9;let x=X;
   for(let i=0;i<cols.length;i++){
    cellBox(x,y,widths[i],height,fill);
    for(let k=0;k<rows;k++)labelText(lines[i][start+k]||'',x+4,y+4+k*10,widths[i]-8,7);
    x+=widths[i];
   }
   y+=height;start+=rows;
  }
 }
 for(const group of pack.sections){
  kind=group.kind;section++;
  cols=paperColumns(kind);
  const total=cols.reduce((a,c)=>a+c.weight,0);
  widths=cols.map(c=>W*c.weight/total);
  page();
  if(!group.rows.length){
   for(let n=0;n<10;n++)draw(cols.map(() => ''),n%2?'#f5faff':'#ffffff');
  }
  for(const row of group.rows){
   const values=cols.map(c=>row.type==='confirmed'?
    paperCell(row.record,c.key,h.points):plannedCell(row,c.key,h.points));
   // Pending checks are blank document rows; never use warning fills
   // that could be mistaken for an actual inspection result.
   draw(values,row.type==='confirmed'&&row.record.status==='deviation'?
    '#ffecea':'#ffffff');
   if(row.type==='confirmed'&&row.record.notes&&!cols.some(c=>c.key==='notes')){
    // The fixed-width A4 layout has no remarks column for some journal kinds.
    const note=wrap('Примечание: '+row.record.notes,W-14);
    for(const paragraph of note){
     if(y+18>530)page();
     cellBox(X,y,W,18,'#eaf4fb');
     labelText(paragraph,X+5,y+4,W-10,7);
     y+=18;
    }
   }
  }
 }
 const pages=doc.bufferedPageRange();
 for(let i=0;i<pages.count;i++){
  doc.switchToPage(i);
  doc.moveTo(X,546).lineTo(X+W,546).lineWidth(.5).stroke('#aec5d7');
  labelText('Проверил: ________________________   Подпись: ________________________   Дата: ____________',X,552,W-65,7.3);
  labelText((i+1)+' / '+pages.count,X+W-60,552,60,7.3,false,'#527b9a');
 }
 return doc;
}

export function installJournalPdfApi(app,{requireSameOrigin=(req,res,next)=>next()}={}){
 app.post('/api/haccp/auto-pack/pdf',requireSameOrigin,(req,res)=>{
  let doc;
  try{doc=autoJournalPackPdf(req.body||{})}
  catch(error){return res.status(400).json({error:error.message||'Не удалось подготовить автоматические журналы.'})}
  res.type('pdf');
  res.setHeader('Content-Disposition',"attachment; filename=haccp-auto-pack.pdf; filename*=UTF-8''"+
   encodeURIComponent('ХАССП_автобланки_12_журналов_'+req.body.month+'.pdf'));
  doc.on('error',()=>res.destroy());doc.pipe(res);doc.end();
 });
 app.post('/api/haccp/journal/pdf',requireSameOrigin,(req,res)=>{
  let doc;
  try{doc=journalPdf(req.body||{})}catch(error){return res.status(400).json({error:error.message})}
  res.type('pdf');
  res.setHeader('Content-Disposition',"attachment; filename=haccp-journal.pdf; filename*=UTF-8''"+encodeURIComponent('ХАССП_'+req.body.kind+'_'+req.body.month+'.pdf'));
  doc.on('error',()=>res.destroy());doc.pipe(res);doc.end();
 });
}
