import test from 'node:test';
import assert from 'node:assert/strict';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';
import {emptyHaccp,addJournalRecord,validateHaccp} from '../public/haccp-model.js';
import {extraJournals} from '../public/haccp-extra.js';
import {selectTasks,updateTask,taskDay} from '../public/task-board.js';
import {journalPdf} from '../haccp-journal-pdf.js';
const bytes=doc=>new Promise((resolve,reject)=>{const chunks=[];doc.on('data',c=>chunks.push(c));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.end()});
test('task day uses Moscow and edits preserve identity; completion and filters use actual deadlines',()=>{
 assert.equal(taskDay('2026-10-18T22:00Z'),'2026-10-19');const now=new Date('2026-10-19T12:00Z'),s={tasks:[{id:'a',text:'Рис',due:'2026-10-19T10:00Z',done:false},{id:'b',text:'Рыба',due:null,done:false,priority:'high'}]};assert.deepEqual(selectTasks(s.tasks,{now}).map(t=>t.id),['b','a']);assert.equal(selectTasks(s.tasks,{filter:'overdue',now}).length,1);assert.equal(selectTasks(s.tasks,{filter:'day',day:'2026-10-19'}).length,1);updateTask(s,'a',{done:true,priority:'low'},now);assert.equal(s.tasks[0].completedAt,now.toISOString());assert.equal(selectTasks(s.tasks,{filter:'done'}).length,1);assert.throws(()=>updateTask(s,'b',{text:' '}));assert.equal(s.tasks[1].text,'Рыба');updateTask(s,'a',{done:false});assert.equal(s.tasks[0].completedAt,null);
});
test('all additional journals persist real fields and deviations create a corrective action',()=>{
 for(const [kind,spec]of Object.entries(extraJournals)){const s={haccp:emptyHaccp()},input={kind,pointId:'point-1',owner:'Повар',at:'2026-10-19T09:00+03:00',result:'problem'};for(const f of spec.fields)input[f.name]=f.type==='number'?'50':f.type==='datetime-local'?'2026-10-19T08:00+03:00':'Фактическая запись';addJournalRecord(s,input,kind);assert.equal(s.haccp.actions.length,1);assert.deepEqual(validateHaccp(JSON.parse(JSON.stringify(s.haccp))),s.haccp);const snapshot=JSON.stringify(s);delete input[spec.fields[0].name];assert.throws(()=>addJournalRecord(s,input,'bad'));assert.equal(JSON.stringify(s),snapshot)}
});
test('humidity and stage dates reject impossible values atomically',()=>{const s={haccp:emptyHaccp()};assert.throws(()=>addJournalRecord(s,{kind:'humidity',pointId:'point-1',owner:'Повар',at:'2026-10-19',zone:'Склад',measured:20,humidity:101,limits:'по инструкции',result:'done'}),/влажность/);assert.equal(s.haccp.records.length,0)});
test('A4 journal PDF paginates long records without dropping end values and filters month and point',async()=>{
 const s={haccp:emptyHaccp()};for(let i=0;i<8;i++)addJournalRecord(s,{kind:'cleaning',pointId:'point-1',owner:'Фаррух Ака',at:'2026-10-19T09:00+03:00',zone:'Зона '+i,method:'Мойка. '.repeat(60),agent:'Средство',concentration:'По инструкции',exposure:'15 минут',result:'done',notes:'Комментарий '.repeat(150)+' КОНЕЦ'+i},'record-'+i);addJournalRecord(s,{kind:'cleaning',pointId:'point-2',owner:'Повар',at:'2026-09-19',zone:'Не входит',method:'Мойка',agent:'Средство',result:'done'},'old');const b=await bytes(journalPdf({haccp:s.haccp,kind:'cleaning',month:'2026-10',pointId:'point-1'}));const pdf=await parsePdf(b);assert.ok(pdf.numpages>1);assert.match(pdf.text,/КОНЕЦ7/);assert.doesNotMatch(pdf.text,/Не входит/);assert.match(pdf.text,/Фаррух Ака/);await (await import('node:fs/promises')).writeFile('/tmp/haccp-qa.pdf',b);
});
