import test from 'node:test';
import assert from 'node:assert/strict';
import {paperColumns,paperCell} from '../public/haccp-paper-layout.js';
import {plannedCell,automaticJournalRows} from '../public/haccp-auto-journals.js';
import {emptyHaccp,addJournalRecord} from '../public/haccp-model.js';

const points=[{id:'point-1',name:'Плазма'}];
test('A4 never prints unsaved outcomes, approval or internal workflow labels',()=>{
 const unsaved={pointId:'point-1',at:'2026-10-22T11:00:00+03:00',
  owner:'Иванов',status:'unconfigured',details:{
   product:'Филадельфия',checks:'Списанное проверено',qualityType:'daily',
   decisionText:'Принято',reviewer:'Старший смены'}};
 for(const kind of ['quality','cleaning','temperature','storage','receiving','defrosting']){
  for(const col of paperColumns(kind)){
   assert.equal(paperCell(unsaved,col.key,points,{draft:true}),'',
    kind+' / '+col.key+' must be blank until saved');
  }
 }
});
test('Unfilled planned/daily rows show only safe print metadata, no statuses or fabricated inspection',()=>{
 const day='2026-10-22';
 const rows=[
  {kind:'quality',type:'draft',pointId:'point-1',day,
   form:{at:'2026-10-22T11:00',qualityType:'daily',appearance:'ok',
    decisionText:'Допущено',reviewer:'Петров'}},
  {kind:'quality',type:'planned',pointId:'point-1',day,due:true},
  {kind:'storage',type:'planned',pointId:'point-1',day,due:false}
 ];
 for(const row of rows){
  assert.equal(plannedCell(row,'at',points),'22.10.2026');
  assert.equal(plannedCell(row,'point',points),'Плазма');
  for(const key of ['status','result','checks','decision','decisionText','qualityReview','qualitySensory',
   'storageReview','owner','measured','notes','reviewer']){
   assert.equal(plannedCell(row,key,points),'',
    row.type+' / '+key+' should not be auto-filled on a formal journal');
  }
 }
 assert.equal(plannedCell(rows[0],'qualityType',points),'Ежедневная');
});
test('Actual saved shift quality results remain visible on the A4 record and no extra paper rows are faked',()=>{
 const state={haccp:emptyHaccp()};
 const actual=addJournalRecord(state,{
  kind:'quality',pointId:'point-1',at:'2026-10-22T12:00:00+03:00',
  owner:'Сушист Иванов',qualityType:'batch',product:'Филадельфия',
  batch:'Б-21',quantity:'8 шт.',startedAt:'2026-10-22T11:00:00+03:00',
  reviewer:'Старший смены Петров',appearance:'ok',color:'ok',smell:'ok',
  texture:'ok',taste:'na',decision:'accepted'
 });
 assert.match(paperCell(actual,'qualityReview',state.haccp.points),/Допущено к реализации/);
 assert.match(paperCell(actual,'qualitySensory',state.haccp.points),/Внешний вид/);
 const rows=automaticJournalRows(state.haccp,{
  month:'2026-10',kind:'quality',pointId:'point-1',
  now:new Date('2026-10-22T12:00:00Z')
 });
 assert.equal(rows.filter(r=>r.type==='confirmed').length,1);
});
