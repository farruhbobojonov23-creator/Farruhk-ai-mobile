import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyHaccp,addJournalRecord,journalTypes} from '../public/haccp-model.js';
import {paperColumns,paperCell} from '../public/haccp-paper-layout.js';
import {automaticJournalRows} from '../public/haccp-auto-journals.js';

const state=()=>({haccp:emptyHaccp()});
const input={
  kind:'packaging',pointId:'point-1',at:'2026-10-22T11:30:00+03:00',
  owner:'Сушист',stage:'Упаковка заказа',product:'Ролл Филадельфия',
  packagingType:'Контейнер пищевой',batch:'Заказ 1024',
  checks:'Целая, чистая, закрыта, комплектность проверена',
  labeling:'Дата и время 22.10.2026 11:30',
  decisionText:'Можно передать заказ',reviewer:'Старший смены',
  result:'done'
};
test('Packaging is available at each point and only saved observations enter A4',()=>{
  const s=state();
  assert.equal(s.haccp.points.length,4);
  assert.equal(journalTypes.packaging,'Контроль упаковки и маркировки');
  assert.deepEqual(automaticJournalRows(s.haccp,{kind:'packaging',month:'2026-10',pointId:'point-1',now:new Date('2026-10-22T12:00:00+03:00')}),[]);
  const record=addJournalRecord(s,input,'pack-1');
  assert.equal(record.status,'ok');
  const cols=paperColumns('packaging').map(x=>x.key);
  for(const key of ['at','point','stage','packagingItem','checks','labeling','decisionText','reviewer','owner'])
    assert.ok(cols.includes(key),key);
  assert.match(paperCell(record,'packagingItem',s.haccp.points),/Филадельфия/);
  assert.match(paperCell(record,'packagingItem',s.haccp.points),/Контейнер пищевой/);
  assert.equal(paperCell(record,'result',s.haccp.points,{draft:true}),'');
  assert.equal(automaticJournalRows(s.haccp,{kind:'packaging',month:'2026-10',pointId:'point-1'}).filter(r=>r.type==='confirmed').length,1);
  assert.equal(automaticJournalRows(s.haccp,{kind:'packaging',month:'2026-10',pointId:'point-2'}).length,0);
});
test('Packaging deviations require corrective comments and create actions',()=>{
  const s=state();
  assert.throws(()=>addJournalRecord(s,{...input,checks:'Повреждена крышка',result:'problem',decisionText:'Изолировать и переупаковать',notes:''}),/замечание и корректирующее действие/);
  assert.equal(s.haccp.records.length,0);
  const record=addJournalRecord(s,{...input,checks:'Повреждена крышка',result:'problem',decisionText:'Изолировать и переупаковать',notes:'Повреждённый контейнер утилизирован'},'pack-bad');
  assert.equal(record.status,'deviation');
  assert.equal(s.haccp.actions.length,1);
  assert.match(paperCell(record,'decisionText',s.haccp.points),/переупаковать/);
});
test('Packaging records reject fabricated empty check fields',()=>{
  const s=state();
  assert.throws(()=>addJournalRecord(s,{...input,checks:''}),/Фактический контроль/);
  assert.throws(()=>addJournalRecord(s,{...input,reviewer:''}),/Проверил/);
  assert.throws(()=>addJournalRecord(s,{...input,result:''}),/Выбери результат/);
});
