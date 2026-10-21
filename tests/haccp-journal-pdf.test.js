import test from 'node:test';
import assert from 'node:assert/strict';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';
import {journalPdf} from '../haccp-journal-pdf.js';
import {emptyHaccp,addJournalRecord,journalTypes} from '../public/haccp-model.js';
import {paperColumns,paperCell} from '../public/haccp-paper-layout.js';

const buffer=doc=>new Promise((resolve,reject)=>{const chunks=[];doc.on('data',x=>chunks.push(x));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.end()});
test('HACCP blank A4 journal is a printable grid, explicitly not filled out',async()=>{
 const result=await parsePdf(await buffer(journalPdf({haccp:emptyHaccp(),kind:'cleaning',month:'2026-10',pointId:'point-1'})));
 assert.match(result.text,/Уборка и дезинфекция/);
 assert.match(result.text,/Подтверждённых записей пока нет/);
 assert.match(result.text,/не означают выполнение проверок/);
 assert.match(result.text,/Дата и время/);
 assert.match(result.text,/Вид уборки/);
 assert.match(result.text,/Участок \/ инвентарь/);
 assert.ok(result.numpages>=1);
});
test('Saved deep clean PDF retains kind and real responsible without creating empty fake rows',async()=>{
 const s={haccp:emptyHaccp()};
 addJournalRecord(s,{kind:'cleaning',pointId:'point-1',owner:'Ответственный',
 at:'2026-10-21T14:00:00+03:00',cleaningType:'general',zone:'Рабочая зона',
 method:'По плану уборки',agent:'По инструкции',result:'done'},'clean-general');
 const result=await parsePdf(await buffer(journalPdf({haccp:s.haccp,kind:'cleaning',month:'2026-10',pointId:'point-1'})));
 assert.match(result.text,/Генеральная/);assert.match(result.text,/Ответственный/);
 assert.match(result.text,/Рабочая зона/);
 assert.doesNotMatch(result.text,/Подтверждённых записей пока нет/);
});

test('All 12 HACCP journal templates have distinct actionable headers in A4 PDF',async()=>{
 const schemas=new Map();
 for(const kind of Object.keys(journalTypes)){
  const columns=paperColumns(kind);
  assert.ok(columns.length>=6&&columns.length<=8,kind+' readable A4 column count');
  assert.equal(new Set(columns.map(c=>c.key)).size,columns.length,kind+' unique field keys');
  assert.ok(columns.some(c=>c.key==='at')&&columns.some(c=>c.key==='owner'),kind+' chronology and responsibility');
  const signature=columns.map(c=>c.key).join('|');
  assert.equal(schemas.has(signature),false,kind+' needs its own format, unlike '+schemas.get(signature));
  schemas.set(signature,kind);
  const pdf=await parsePdf(await buffer(journalPdf({haccp:emptyHaccp(),kind,month:'2026-10',pointId:'point-1'})));
  assert.ok(pdf.numpages>=1&&pdf.numpages<=2,kind+' blank A4 pages');
  assert.match(pdf.text,new RegExp(journalTypes[kind]));
  for(const c of columns)assert.ok(pdf.text.includes(c.label),kind+' missing header: '+c.label);
 }
});
test('Journal cells display factual statuses, notes, temperatures and safe empty values',()=>{
 const record={pointId:'point-1',at:'2026-10-21T11:00:00+03:00',owner:'Старший смены',notes:'Нужно проверить',
  status:'deviation',details:{equipment:'Холодильник 1',measured:6,min:0,max:4,cleaningType:'general',method:'Обработка',agent:'Дезсредство',
  checks:[{label:'Сроки',result:'yes'},{label:'Чистота',result:'no'}]}};
 const points=[{id:'point-1',name:'Склад'}];
 assert.equal(paperCell(record,'equipment',points),'Холодильник 1');
 assert.equal(paperCell(record,'temperatureLimits',points),'0 … 4');
 assert.equal(paperCell(record,'point',points),'Склад');
 assert.equal(paperCell(record,'status',points),'Отклонение');
 assert.equal(paperCell(record,'cleaningType',points),'Генеральная');
 assert.match(paperCell(record,'cleaningMethod',points),/Дезсредство/);
 assert.match(paperCell(record,'checks',points),/Сроки: Да/);
 assert.equal(paperCell(record,'status',points,{draft:true}),'Черновик');
 assert.equal(paperCell(record,'useBy',points),'—');
});
