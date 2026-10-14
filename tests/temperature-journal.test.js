import test from 'node:test';
import assert from 'node:assert/strict';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';
import express from 'express';
import {emptyHaccp,addEquipment,addJournalRecord} from '../public/haccp-model.js';
import {validateDeviceState} from '../public/device-store.js';
import {temperatureGrid,saveDailyTemperatures,journalDays} from '../public/temperature-journal.js';
import {temperatureJournalPdf,installTemperatureJournalPdfApi} from '../haccp-temperature-pdf.js';

function setup(){const s={recipes:[],haccp:emptyHaccp()};addEquipment(s,{pointId:'point-1',name:'Холодильник чёрный',min:2,max:4},'fridge');addEquipment(s,{pointId:'point-2',name:'Морозильный шкаф POLAIR',min:null,max:-18},'freezer');return s}
const payload={date:'2026-10-15',time:'09:00',owner:'Фаррух Ака',entries:[{equipmentId:'fridge',measured:3},{equipmentId:'freezer',measured:-19}]};
const bytes=doc=>new Promise((resolve,reject)=>{const chunks=[];doc.on('data',c=>chunks.push(c));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.end()});
test('Daily batches save atomically, leave blanks empty and retain real repeated readings',()=>{
 const s=setup();saveDailyTemperatures(s,{...payload,entries:[...payload.entries,{equipmentId:'missing',measured:''}]});assert.equal(s.haccp.records.length,2);
 const old=JSON.stringify(s);assert.throws(()=>saveDailyTemperatures(s,{...payload,time:'10:00',entries:[{equipmentId:'fridge',measured:9},{equipmentId:'missing',measured:0}]}),/не найдено/);assert.equal(JSON.stringify(s),old);
 assert.throws(()=>saveDailyTemperatures(s,payload),/уже сохранён/);assert.equal(s.haccp.records.length,2);
 saveDailyTemperatures(s,{...payload,time:'18:00',entries:[{equipmentId:'fridge',measured:6}]});assert.equal(s.haccp.actions.length,1);
 const restored=validateDeviceState(JSON.parse(JSON.stringify(s))),grid=temperatureGrid(restored.haccp,{month:'2026-10',pointId:'point-1'});assert.equal(grid.rows.length,1);assert.equal(grid.rows[0].cells[14].records.length,2);assert.equal(grid.rows[0].cells[15].records.length,0);assert.equal(restored.haccp.records[2].owner,payload.owner);
});
test('Months, leap years, Moscow date boundaries and negative limits are handled without generated values',()=>{
 const s=setup();assert.equal(journalDays('2028-02').length,29);assert.equal(journalDays('2026-02','second').length,13);assert.throws(()=>journalDays('2026-13'));
 for(const date of ['2026-02-31','2026-02-00','2026-11-31'])assert.throws(()=>saveDailyTemperatures(s,{...payload,date}),/корректную дату/);
 addJournalRecord(s,{kind:'temperature',pointId:'point-2',equipmentId:'freezer',measured:-20,owner:'Повар',at:'2026-10-31T22:30:00Z'},'boundary');
 assert.equal(temperatureGrid(s.haccp,{month:'2026-10'}).readings.length,0);const nov=temperatureGrid(s.haccp,{month:'2026-11',pointId:'point-2'});assert.equal(nov.rows[0].cells[0].records[0].details.measured,-20);assert.equal(nov.readings[0].status,'ok');
});
test('PDF includes Cyrillic, all equipment and observations across horizontal and vertical pages',async()=>{
 const s=setup();saveDailyTemperatures(s,payload);
 for(let i=0;i<20;i++)addEquipment(s,{pointId:'point-1',name:'Холодильный стол номер '+i,min:2,max:4},'extra-'+i);
 for(let i=0;i<10;i++)saveDailyTemperatures(s,{...payload,time:String(i+10).padStart(2,'0')+':00',entries:[{equipmentId:'freezer',measured:-18-i/10}]});
 const output=await bytes(temperatureJournalPdf({haccp:s.haccp,month:'2026-10'})),pdf=await parsePdf(output);assert.ok(pdf.numpages>=6);assert.match(pdf.text,/Холодильный стол номер 19/);assert.match(pdf.text,/Фаррух Ака/);assert.match(pdf.text,/-18\.9/);assert.match(pdf.text,/19:00/);assert.match(pdf.text,/16-31/);
 const empty=await parsePdf(await bytes(temperatureJournalPdf({haccp:emptyHaccp(),month:'2026-02',period:'second'})));assert.equal(empty.numpages,1);assert.match(empty.text,/16-28/);assert.match(empty.text,/Оборудование ещё не добавлено/);
});
test('PDF endpoint returns a real download and rejects malformed selections',async()=>{
 const app=express();app.use(express.json());installTemperatureJournalPdfApi(app);const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{const url='http://127.0.0.1:'+server.address().port+'/api/haccp/temperature/pdf',s=setup();saveDailyTemperatures(s,payload);
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({haccp:s.haccp,month:'2026-10',period:'first'})});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/pdf/);const pdf=await parsePdf(Buffer.from(await response.arrayBuffer()));assert.equal(pdf.numpages,1);assert.match(pdf.text,/Холодильник чёрный/);
  const bad=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({haccp:s.haccp,month:'bad'})});assert.equal(bad.status,400);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
