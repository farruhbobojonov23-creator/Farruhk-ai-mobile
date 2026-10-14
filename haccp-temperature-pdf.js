import PDFDocument from 'pdfkit';
import {temperatureGrid,temperatureLimits,monthLabel,measurementTime} from './public/temperature-journal.js';

const font=new URL('./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf',import.meta.url).pathname;
const bold=new URL('./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf',import.meta.url).pathname;
export function temperatureJournalPdf({haccp,month,period='all',pointId=''}){
 const grid=temperatureGrid(haccp,{month,period,pointId});
 if(grid.rows.length>500||grid.readings.length>20000)throw Error('Слишком большой журнал. Выбери одну точку и половину месяца.');
 const doc=new PDFDocument({autoFirstPage:false,bufferPages:true,info:{Title:'Журнал контроля температур',Author:'Суши Бери'}});
 doc.registerFont('regular',font).registerFont('bold',bold);
 const X=24,W=793.89,LABEL=203,BOTTOM=537,ink='#172c3e',blue='#1d4e78';let y;
 const owners=[...new Set(grid.readings.map(r=>r.owner))],ownerCodes=new Map(owners.map((name,i)=>[name,i+1]));
 const periods=period==='all'?[grid.days.slice(0,15),grid.days.slice(15)]:[grid.days];
 function text(value,x,y,w,size=8,{strong=false,color=ink,align='left'}={}){doc.font(strong?'bold':'regular').fontSize(size).fillColor(color).text(String(value),x,y,{width:w,lineGap:1,align})}
 function cell(value,x,y,w,height,{strong=false,fill='#ffffff',color=ink,size=7,align='center'}={}){doc.rect(x,y,w,height).fillAndStroke(fill,'#a2b4c4');text(value,x+4,y+5,w-8,size,{strong,color,align})}
 function nextPage(days){
  doc.addPage({size:'A4',layout:'landscape',margin:24});
  text('ЖУРНАЛ КОНТРОЛЯ ТЕМПЕРАТУРНОГО РЕЖИМА',X,23,W,15,{strong:true,color:blue});
  text('холодильного и морозильного оборудования',X,46,W,12,{strong:true});
  const point=pointId?grid.points.find(p=>p.id===pointId)?.name:'Все точки';
  text(monthLabel(month)+'  |  '+days[0]+'-'+days.at(-1)+' число  |  '+point,X,68,W,9);
  text('Температура, °C. Пустая ячейка - замер не внесён. Время: Москва / Мурманск. [№] - сотрудник, ! - отклонение.',X,84,W,8);
  const cw=(W-LABEL)/days.length;cell('Оборудование / точка\nЗаданные границы',X,105,LABEL,32,{strong:true,fill:'#e6eef5',align:'left'});
  for(let i=0;i<days.length;i++)cell(days[i],X+LABEL+i*cw,105,cw,32,{strong:true,fill:'#e6eef5',size:9});
  y=137;return cw;
 }
 function footer(){
  text('Ответственный за проверку: _____________________     Подпись: _____________________',X,546,W,8);
  text('Границы в строках - текущие настройки; отклонения оценены по границам на момент замера.',X,561,W-60,6.5);
 }
 for(const days of periods){if(!days.length)continue;let cw=nextPage(days);
  if(!grid.rows.length){text('Оборудование ещё не добавлено.',X+8,y+15,W-16,10);footer();continue}
  for(const row of grid.rows){
   const cells=days.map(day=>row.cells.find(c=>c.day===day)?.records||[]);
   const title=row.name+'\n'+row.point+'\n'+temperatureLimits(row);
   doc.font('regular').fontSize(7);const labelHeight=doc.heightOfString(title,{width:LABEL-8,lineGap:1})+10;
   // Split very busy equipment rows by observation index; every reading remains in the PDF.
   const maxCount=Math.max(1,...cells.map(c=>c.length)),perRow=8;
   for(let start=0;start<maxCount;start+=perRow){
    const values=cells.map(records=>records.slice(start,start+perRow).map(r=>measurementTime(r.at)+'\n'+r.details.measured+'° ['+ownerCodes.get(r.owner)+']'+(r.status==='deviation'?' !':'')).join('\n'));
    const rowTitle=(start?row.name+' (продолжение)\n'+row.point:title);
    doc.font('regular').fontSize(7);const titleH=start?doc.heightOfString(rowTitle,{width:LABEL-8,lineGap:1})+10:labelHeight;
    const height=Math.max(48,titleH,...values.map(v=>doc.heightOfString(v||'-',{width:cw-8,lineGap:1})+10));
    if(y+height>BOTTOM){footer();cw=nextPage(days)}
    cell(rowTitle,X,y,LABEL,height,{size:7,align:'left',fill:'#f3f6f9'});
    for(let i=0;i<days.length;i++){const deviation=cells[i].slice(start,start+perRow).some(r=>r.status==='deviation');cell(values[i]||'-',X+LABEL+i*cw,y,cw,height,{size:7,color:deviation?'#9b2626':ink,fill:deviation?'#fff0ec':'#ffffff'})}
    y+=height;
   }
  }footer();
 }
 if(owners.length){
  function legendPage(){doc.addPage({size:'A4',layout:'landscape',margin:24});text('Ответственные за замеры · '+monthLabel(month),X,24,W,13,{strong:true,color:blue});y=60}
  if(y+55>BOTTOM)legendPage();else {y+=14;text('Ответственные за замеры',X,y,W,10,{strong:true});y+=20}
  for(const [i,name] of owners.entries()){const label='['+(i+1)+'] '+name;doc.font('regular').fontSize(8);const height=doc.heightOfString(label,{width:W,lineGap:1})+6;if(y+height>BOTTOM){footer();legendPage()}text(label,X,y,W,8);y+=height}footer();
 }
 const pages=doc.bufferedPageRange();for(let i=0;i<pages.count;i++){doc.switchToPage(i);text((i+1)+' / '+pages.count,X+W-55,561,55,7,{align:'right'})}
 return doc;
}
export function installTemperatureJournalPdfApi(app,{requireSameOrigin=(req,res,next)=>next()}={}){
 app.post('/api/haccp/temperature/pdf',requireSameOrigin,(req,res)=>{
  let doc;try{doc=temperatureJournalPdf(req.body||{})}catch(e){return res.status(400).json({error:e.message||'Не удалось подготовить журнал.'})}
  res.type('pdf');res.setHeader('Content-Disposition',"attachment; filename=temperature-journal.pdf; filename*=UTF-8''"+encodeURIComponent('Журнал_температур_'+req.body.month+'.pdf'));
  doc.on('error',()=>{if(!res.headersSent)res.status(500).json({error:'Не удалось подготовить PDF.'});else res.destroy()});doc.pipe(res);doc.end();
 });
}
