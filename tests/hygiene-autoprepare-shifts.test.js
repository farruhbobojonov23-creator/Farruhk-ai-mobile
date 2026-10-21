import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyHaccp,addJournalRecord,validateHaccp} from '../public/haccp-model.js';
import {hygieneSettings,updateHygieneSettings,parseHygieneRoster,preparedHygieneRows} from '../public/hygiene-config.js';
import {automaticJournalRows} from '../public/haccp-auto-journals.js';
import {paperCell,paperColumns} from '../public/haccp-paper-layout.js';

const fresh=()=>({haccp:emptyHaccp()});
const team=[
 'Иванов Иван | Сушист | 10:00 | Утренняя',
 'Петров Петр | Старший смены | 18:00 | Вечерняя'
].join('\n');
function configure(state,pointId='point-1'){
 updateHygieneSettings(state,pointId,{
  employees:['Иванов Иван','Петров Петр'],
  roles:['Сушист','Старший смены'],
  reviewer:'Старший смены',
  roster:team
 });
}
test('Roster parses times and roles exactly and detects duplicate shifts',()=>{
 assert.deepEqual(parseHygieneRoster(team),[
  {name:'Иванов Иван',role:'Сушист',startTime:'10:00',shift:'Утренняя'},
  {name:'Петров Петр',role:'Старший смены',startTime:'18:00',shift:'Вечерняя'}
 ]);
 assert.throws(()=>parseHygieneRoster('Иванов Иван | Сушист | 10:60 | Утренняя'),/HH:MM/);
 assert.throws(()=>parseHygieneRoster('Иванов Иван | Сушист | 10:00 | A\nИванов Иван | Сушист | 10:00 | B'),/повторяется/);
});
test('Today automatically prepares only assigned point/employee/role/shift/date, not inspection outcomes',()=>{
 const state=fresh();configure(state);
 assert.equal(state.haccp.records.length,0);
 const today=preparedHygieneRows(state.haccp,'point-1','2026-10-22');
 assert.equal(today.length,2);
 assert.equal(today[0].shiftStart,'2026-10-22T10:00:00+03:00');
 assert.equal(today[1].shiftStart,'2026-10-22T18:00:00+03:00');
 assert.equal(today[0].role,'Сушист');
 assert.equal(today[0].complete,false);
 for(const item of today){
  for(const field of ['hygieneDecision','uniform','hands','headwear','personalItems','workplaceRules','reviewer','owner']){
   assert.equal(Object.hasOwn(item,field),false,'must not invent '+field);
  }
 }
 assert.equal(preparedHygieneRows(state.haccp,'point-2','2026-10-22').length,0);
 assert.equal(state.haccp.records.length,0);
});
test('Scheduled row stops being pending only for same employee, point and shift date',()=>{
 const state=fresh();configure(state);
 const input={kind:'hygiene',pointId:'point-1',at:'2026-10-22T09:30:00+03:00',
  owner:'Старший смены Смирнов',employee:'Иванов Иван',role:'Сушист',
  shift:'Утренняя',shiftStart:'2026-10-22T10:00:00+03:00',
  reviewer:'Старший смены Смирнов',hygieneDecision:'admit',
  uniform:'ok',hands:'ok',headwear:'ok',personalItems:'ok',workplaceRules:'na'};
 const record=addJournalRecord(state,input);
 const today=preparedHygieneRows(state.haccp,'point-1','2026-10-22');
 assert.equal(today[0].complete,true);
 assert.equal(today[1].complete,false);
 assert.match(today[0].recordedDecision,/Допущен/);
 assert.equal(preparedHygieneRows(state.haccp,'point-1','2026-10-23')[0].complete,false);
 const pack=automaticJournalRows(state.haccp,{
  month:'2026-10',pointId:'point-1',kind:'hygiene',now:new Date('2026-10-22T12:00:00Z')
 });
 assert.equal(pack.length,1);
 assert.equal(pack[0].type,'confirmed');
 assert.match(paperCell(record,'decisionText',state.haccp.points),/Допущен/);
 assert.ok(paperColumns('hygiene').some(col=>col.key==='shiftStart'));
});
test('Legacy employee lists remain intact; editable branch rosters stay independent',()=>{
 const state=fresh();
 updateHygieneSettings(state,'point-1',{employees:['Старый сотрудник'],roles:['Сушист'],reviewer:'Старший смены'});
 assert.deepEqual(hygieneSettings(state.haccp,'point-1').roster,[]);
 configure(state,'point-2');
 const validated=validateHaccp(state.haccp);
 assert.equal(hygieneSettings(validated,'point-2').roster.length,2);
 assert.equal(hygieneSettings(validated,'point-1').roster.length,0);
 assert.deepEqual(hygieneSettings(validated,'point-1').employees,['Старый сотрудник']);
});
