import test from 'node:test';
import assert from 'node:assert/strict';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';
import {journalPdf} from '../haccp-journal-pdf.js';
import {emptyHaccp,addJournalRecord} from '../public/haccp-model.js';

const buffer=doc=>new Promise((resolve,reject)=>{const chunks=[];doc.on('data',x=>chunks.push(x));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.end()});
test('HACCP blank A4 journal is a printable grid, explicitly not filled out',async()=>{
 const result=await parsePdf(await buffer(journalPdf({haccp:emptyHaccp(),kind:'cleaning',month:'2026-10',pointId:'point-1'})));
 assert.match(result.text,/Уборка и дезинфекция/);
 assert.match(result.text,/Подтверждённых записей пока нет/);
 assert.match(result.text,/не означают выполнение проверок/);
 assert.match(result.text,/Дата \/ точка/);
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
