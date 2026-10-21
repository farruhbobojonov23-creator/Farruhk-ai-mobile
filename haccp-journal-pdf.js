import PDFDocument from 'pdfkit';
import {validateHaccp,journalTypes} from './public/haccp-model.js';
import {extraFieldNames} from './public/haccp-extra.js';
import {measurementDate,monthLabel} from './public/temperature-journal.js';
const labels={cleaningType:'Тип уборки',...extraFieldNames,equipment:'Оборудование',measured:'Температура, °C',min:'Минимум, °C',max:'Максимум, °C',zone:'Зона',method:'Способ',agent:'Средство',concentration:'Концентрация',exposure:'Выдержка',result:'Результат',supplier:'Поставщик',product:'Продукт / партия',quantity:'Количество',expiry:'Годен до',checks:'Проверка',decision:'Решение',batch:'Партия',startedAt:'Начало / изготовлено',finishedAt:'Окончание',useBy:'Использовать до',conditions:'Условия хранения'};
const values={daily:'Ежедневная / текущая',general:'Генеральная',done:'Соответствует / выполнено',problem:'Отклонение',accepted:'Принято',rejected:'Отказ',yes:'Да',no:'Нет',na:'Не оценено / не применимо'};
const status={ok:'Без замечаний',deviation:'Отклонение',unconfigured:'Не оценено'};
export function journalPdf({haccp,kind,month,pointId=''}){
 const h=validateHaccp(haccp),period=monthLabel(month);if(!journalTypes[kind])throw Error('Выбери журнал.');if(pointId&&!h.points.some(p=>p.id===pointId))throw Error('Точка не найдена.');
 const records=h.records.filter(r=>r.kind===kind&&measurementDate(r.at).slice(0,7)===month&&(!pointId||r.pointId===pointId)).sort((a,b)=>a.at.localeCompare(b.at));if(records.length>5000)throw Error('Выбери одну точку для выгрузки.');
 const doc=new PDFDocument({autoFirstPage:false,bufferPages:true});doc.registerFont('regular',new URL('./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf',import.meta.url).pathname);doc.registerFont('bold',new URL('./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf',import.meta.url).pathname);
 const widths=[125,105,90,310,160],X=26,limit=530,line=11;let y;
 function text(t,x,y,width,bold=false){doc.font(bold?'bold':'regular').fontSize(8).fillColor('#17392f').text(t,x,y,{width,height:line,lineBreak:false})}
 function page(){doc.addPage({size:'A4',layout:'landscape',margin:20});doc.font('bold').fontSize(16).fillColor('#135840').text(journalTypes[kind],X,22,{width:790});doc.font('regular').fontSize(9).text(period+' | '+(pointId?h.points.find(p=>p.id===pointId).name:'Все точки'),X,49,{width:790});doc.fontSize(8).text('Фактические записи с устройства. Пустые поля не подтверждают выполнение контроля. Время: Москва / Мурманск.',X,67,{width:790});y=88;let x=X;['Дата / точка','Ответственный','Результат','Данные контроля','Комментарий'].forEach((t,i)=>{doc.rect(x,y,widths[i],26).fillAndStroke('#dcebe3','#9fb6aa');text(t,x+5,y+8,widths[i]-10,true);x+=widths[i]});y+=26}
 function wrap(value,width){doc.font('regular').fontSize(8);const result=[];for(const paragraph of String(value??'').split('\n')){let current='';for(const word of paragraph.split(/\s+/)){if(doc.widthOfString(current+(current?' ':'')+word)<=width){current+=(current?' ':'')+word;continue}if(current)result.push(current);current='';for(const c of word){if(doc.widthOfString(current+c)>width&&current){result.push(current);current=''}current+=c}}result.push(current)}return result}

 function details(r){return Object.entries(r.details).filter(([k])=>k!=='equipmentId').map(([k,v])=>{if(Array.isArray(v))return v.map(c=>c.label+': '+values[c.result]).join('\n');if(['expiry','startedAt','finishedAt','useBy'].includes(k)&&v)v=new Date(v).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'});return (labels[k]||k)+': '+(values[v]??v??'Не задано')}).join('\n')}
 page();
 if(!records.length){
  doc.font('regular').fontSize(9).fillColor('#385d76')
   .text('Подтверждённых записей пока нет. Ниже — чистый бланк для заполнения; строки не означают выполнение проверок.',X,y+6,{width:790});
  y+=32;
  for(let row=0;row<14;row++){
   if(y+24>limit)page();
   let x=X;
   for(const width of widths){doc.rect(x,y,width,24).fillAndStroke(row%2?'#f4faff':'#ffffff','#b6c9d8');x+=width}
   y+=24;
  }
 }
 for(const [index,r]of records.entries()){const columns=[new Date(r.at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})+'\n'+h.points.find(p=>p.id===r.pointId).name,r.owner,status[r.status],details(r),r.notes||''];const lines=columns.map((v,i)=>wrap(v,widths[i]-10));let offset=0,total=Math.max(...lines.map(v=>v.length));while(offset<total){if(limit-y<32)page();const count=Math.min(total-offset,Math.floor((limit-y-12)/line)),height=count*line+12;let x=X;for(let i=0;i<5;i++){doc.rect(x,y,widths[i],height).fillAndStroke(r.status==='deviation'?'#fff0e9':index%2?'#f0f6f2':'#ffffff','#b2c3b9');lines[i].slice(offset,offset+count).forEach((t,j)=>text(t,x+5,y+6+j*line,widths[i]-10));x+=widths[i]}offset+=count;y+=height;if(offset<total)page()}}
 const range=doc.bufferedPageRange();for(let i=0;i<range.count;i++){doc.switchToPage(i);text('Проверил: _____________________    Подпись: _____________________',X,548,670);text((i+1)+' / '+range.count,760,564,50)}return doc;
}
export function installJournalPdfApi(app,{requireSameOrigin=(req,res,next)=>next()}={}){app.post('/api/haccp/journal/pdf',requireSameOrigin,(req,res)=>{let doc;try{doc=journalPdf(req.body||{})}catch(e){return res.status(400).json({error:e.message})}res.type('pdf');res.setHeader('Content-Disposition','attachment; filename=haccp-journal.pdf');doc.on('error',()=>res.destroy());doc.pipe(res);doc.end()})}
