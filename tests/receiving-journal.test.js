import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyHaccp,addJournalRecord,validateHaccp} from '../public/haccp-model.js';
import {RECEIVING_CHECKS,receivingSettings,updateReceivingSettings} from '../public/receiving-config.js';
import {saveAutoTemplate,dueAutoDrafts} from '../public/haccp-template-drafts.js';
import {automaticJournalRows} from '../public/haccp-auto-journals.js';
import {paperCell,paperColumns} from '../public/haccp-paper-layout.js';

const state=()=>({haccp:emptyHaccp()});
const checks=Object.fromEntries(RECEIVING_CHECKS.map(([key])=>[key,'ok']));
const base={
 kind:'receiving',pointId:'point-1',at:'2026-10-21T12:00:00+03:00',
 owner:'Старший смены',supplier:'Тестовый поставщик',product:'Тестовый лосось',
 quantity:'3 кг',category:'chilled',batch:'Б-01',invoice:'Н-09',
 measured:'3',min:'0',max:'4',expiry:'2026-10-21',decision:'accepted',...checks
};
const insert=(s,fields={})=>addJournalRecord(s,{...base,...fields});

test('Editable supplier and product guides belong to each point and do not imply deliveries',()=>{
 const s=state();
 assert.equal(s.haccp.records.length,0);
 assert.deepEqual(receivingSettings(s.haccp,'point-2').suppliers,[]);
 updateReceivingSettings(s,'point-1',{suppliers:['Тестовый поставщик'],products:['Лосось','Рис']});
 updateReceivingSettings(s,'point-2',{suppliers:['Другой тестовый поставщик'],products:['Нори']});
 assert.deepEqual(receivingSettings(validateHaccp(s.haccp),'point-1').suppliers,['Тестовый поставщик']);
 assert.deepEqual(receivingSettings(s.haccp,'point-2').products,['Нори']);
 assert.equal(s.haccp.records.length,0);
 assert.throws(()=>updateReceivingSettings(s,'point-1',{suppliers:['А','а'],products:[]}),/повторяются/);
});
test('Checks, cold readings, batch and date-only expiry persist in a factual receipt and paper cells',()=>{
 const s=state();
 const r=insert(s);
 assert.equal(r.status,'ok');
 assert.equal(r.details.batch,'Б-01');
 assert.equal(r.details.invoice,'Н-09');
 assert.match(r.details.checks,/Сопроводительные документы: Соответствует/);
 assert.equal(new Date(r.details.expiry).toISOString(),'2026-10-21T20:59:59.000Z');
 assert.match(paperCell(r,'productBatch',s.haccp.points),/Партия: Б-01/);
 assert.match(paperCell(r,'receivedTemperature',s.haccp.points),/3 °C; 0 … 4/);
 assert.match(paperCell(r,'expiryDay',s.haccp.points),/21\.10\.2026/);
 const columns=paperColumns('receiving').map(x=>x.key);
 for(const key of ['receivedTemperature','expiryDay','decision','checks'])assert.ok(columns.includes(key));
});
test('Accept requires actual cold temperature; limits cannot be invented or violated',()=>{
 const s=state();
 assert.throws(()=>insert(s,{measured:''}),/фактическую температуру/);
 assert.throws(()=>insert(s,{measured:8}),/Температура за/);
 assert.throws(()=>insert(s,{measured:'',category:'ambient',min:0}),/фактический замер/);
 assert.throws(()=>insert(s,{expiry:'2026-10-20'}),/Срок продукта истёк/);
 assert.throws(()=>insert(s,{inspectPackage:'problem'}),/Есть нарушения/);
 assert.equal(s.haccp.records.length,0);
 const unknown=insert(s,{min:'',max:''});
 assert.equal(unknown.status,'unconfigured','cold temperature not automatically verified without approved limits');
});
test('Documented rejection records an issue and allows rejection even without measured temperature',()=>{
 const s=state();
 const rejected=insert(s,{measured:'',min:'',max:'',decision:'rejected',notes:'Повреждена упаковка',
  inspectPackage:'problem'});
 assert.equal(rejected.status,'deviation');
 assert.equal(s.haccp.actions.length,1);
 assert.throws(()=>insert(s,{decision:'rejected',notes:''}),/причину отказа/);
});
test('Delivery is event-driven; no receipts invented at 11:00 or monthly A4 auto-pack',()=>{
 const s=state();
 s.haccp.dailyControls.push('receiving'); // even if an old profile selected daily checks
 assert.throws(()=>saveAutoTemplate(s,{kind:'receiving',pointId:'point-1',form:{product:'Лосось'}}),/по факту поставки/);
 assert.equal(dueAutoDrafts(s.haccp,new Date('2026-10-22T13:00:00Z')).length,0);
 const rows=automaticJournalRows(s.haccp,{month:'2026-10',kind:'receiving',now:new Date('2026-10-22T13:00:00Z')});
 assert.deepEqual(rows,[]);
 insert(s);
 const recorded=automaticJournalRows(s.haccp,{month:'2026-10',kind:'receiving',now:new Date('2026-10-22T13:00:00Z')});
 assert.equal(recorded.filter(r=>r.type==='confirmed').length,1);
 assert.equal(recorded.filter(r=>r.type!=='confirmed').length,0);
});
