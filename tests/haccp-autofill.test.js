import test from 'node:test';
import assert from 'node:assert/strict';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';
import express from 'express';
import {emptyHaccp,addEquipment,addJournalRecord,journalTypes} from '../public/haccp-model.js';
import {automaticJournalRows,automaticJournalSummary,plannedCell} from '../public/haccp-auto-journals.js';
import {autoJournalPackPdf,installJournalPdfApi} from '../haccp-journal-pdf.js';

const when='2026-10-21T08:01:00Z'; // 11:01 Moscow
const pdfBytes=doc=>new Promise((resolve,reject)=>{const chunks=[];doc.on('data',c=>chunks.push(c));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.end()});
test('Daily autoblanks appear at 11:00 Moscow without generating imaginary outcomes',()=>{
 const h=emptyHaccp();
 const rows=automaticJournalRows(h,{month:'2026-10',kind:'cleaning',pointId:'point-1',now:when});
 assert.equal(rows.length,31);
 assert.equal(rows.filter(x=>x.type==='confirmed').length,0);
 assert.equal(rows[19].day,'2026-10-20');
 assert.equal(rows[19].due,true);
 assert.equal(rows[20].day,'2026-10-21');
 assert.equal(rows[20].due,true);
 assert.equal(rows[21].due,false);
 assert.equal(plannedCell(rows[20],'result',h.points),'НЕ ПРОВЕРЕНО');
 assert.equal(plannedCell(rows[21],'result',h.points),'ЗАПЛАНИРОВАНО');
 assert.equal(plannedCell(rows[20],'owner',h.points),'');
 assert.equal(plannedCell(rows[20],'measured',h.points),'');
 assert.equal(plannedCell(rows[20],'at',h.points),'2026-10-21 · 11:00 МСК');
 const before=JSON.stringify(h);
 automaticJournalSummary(h,{month:'2026-10',pointId:'point-1',now:when});
 assert.equal(JSON.stringify(h),before,'auto-prepare must never write to HACCP records');
});
test('Existing observations replace a planned row for the exact day, equipment, and type',()=>{
 const s={haccp:emptyHaccp()};
 addEquipment(s,{pointId:'point-1',name:'Холодильник №1',min:0,max:4},'f1');
 addEquipment(s,{pointId:'point-1',name:'Холодильник №2',min:-22,max:-18},'f2');
 let rows=automaticJournalRows(s.haccp,{month:'2026-10',kind:'temperature',pointId:'point-1',now:when});
 assert.equal(rows.length,62);
 assert.equal(plannedCell(rows[40],'equipment',s.haccp.points).length>0,true);
 addJournalRecord(s,{kind:'temperature',pointId:'point-1',at:'2026-10-21T12:00:00+03:00',owner:'Повар',
  equipmentId:'f1',measured:'3'},'t21');
 rows=automaticJournalRows(s.haccp,{month:'2026-10',kind:'temperature',pointId:'point-1',now:when});
 assert.equal(rows.filter(r=>r.type==='confirmed').length,1);
 assert.equal(rows.filter(r=>r.day==='2026-10-21').length,1,'second freezer is still unmeasured');
 assert.equal(rows.length,62);
 assert.equal(rows.find(r=>r.type==='confirmed').record.details.measured,3);
});
test('Event journals remain event-driven and monthly general-clean targets never claim completion',()=>{
 const s={haccp:emptyHaccp()};
 for(const kind of ['receiving','frying','cooking','defrosting','quality','pests','audit'])
  assert.equal(automaticJournalRows(s.haccp,{month:'2026-10',kind,pointId:'point-1',now:when}).length,0,kind);
 const rows=automaticJournalRows(s.haccp,{month:'2026-10',kind:'cleaning',pointId:'point-1',now:when});
 const general=rows.filter(r=>r.type==='planned-general');
 assert.equal(general.length,2);
 for(const row of general){
  assert.equal(plannedCell(row,'cleaningType',s.haccp.points),'Генеральная');
  assert.equal(plannedCell(row,'result',s.haccp.points),'ПО ГРАФИКУ');
  assert.equal(plannedCell(row,'at',s.haccp.points),'Дата по графику');
 }
});
test('Full print pack contains 12 journals and marks missing checks clearly, with no fake numeric results',async()=>{
 const s={haccp:emptyHaccp()};
 addEquipment(s,{pointId:'point-1',name:'Холодильник А',min:0,max:4},'f1');
 addJournalRecord(s,{kind:'temperature',pointId:'point-1',at:'2026-10-21T11:30:00+03:00',
  equipmentId:'f1',owner:'Повар',measured:'3'},'t1');
 const pack=automaticJournalSummary(s.haccp,{month:'2026-10',pointId:'point-1',now:when});
 assert.equal(pack.kinds,Object.keys(journalTypes).length);
 assert.equal(pack.confirmed,1);
 assert.ok(pack.planned>40);
 const data=await pdfBytes(autoJournalPackPdf({haccp:s.haccp,month:'2026-10',pointId:'point-1',now:when}));
 const out=await parsePdf(data);
 assert.ok(out.numpages>=12);
 assert.match(out.text,/НЕ ПРОВЕРЕНО/);
 assert.match(out.text,/ЗАПЛАНИРОВАНО/);
 assert.match(out.text,/Холодильник А/);
 assert.match(out.text,/Уборка и дезинфекция/);
 assert.match(out.text,/Приёмка продуктов/);
 assert.match(out.text,/Гигиенический осмотр/);
 assert.match(out.text,/автоподготовка/i);
 assert.doesNotMatch(out.text,/Фиктивная/);
});
test('Monthly HACCP pack endpoint returns PDF; invalid month rejected',async()=>{
 const app=express();app.use(express.json());installJournalPdfApi(app);
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{
  const endpoint='http://127.0.0.1:'+server.address().port+'/api/haccp/auto-pack/pdf';
  const h=emptyHaccp();
  const good=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({haccp:h,month:'2026-02',pointId:'point-1'})});
  assert.equal(good.status,200);
  assert.match(good.headers.get('content-type'),/application\/pdf/);
  const buff=Buffer.from(await good.arrayBuffer());
  assert.ok(buff.length>5000);
  const bad=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({haccp:h,month:'2026-13'})});
  assert.equal(bad.status,400);
  assert.match((await bad.json()).error,/Выбери месяц/);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
