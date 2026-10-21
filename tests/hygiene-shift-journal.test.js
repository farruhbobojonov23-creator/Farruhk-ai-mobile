import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyHaccp,addJournalRecord,validateHaccp} from '../public/haccp-model.js';
import {HYGIENE_CHECKS,hygieneSettings,updateHygieneSettings} from '../public/hygiene-config.js';
import {automaticJournalRows} from '../public/haccp-auto-journals.js';
import {saveAutoTemplate,dueAutoDrafts} from '../public/haccp-template-drafts.js';
import {paperColumns,paperCell} from '../public/haccp-paper-layout.js';

const fixture=()=>({haccp:emptyHaccp()});
const entry={
 kind:'hygiene',pointId:'point-1',at:'2026-10-22T09:20:00+03:00',
 owner:'Старший смены Петров',employee:'Сушист Иванов',role:'Сушист',
 shift:'Дневная',shiftStart:'2026-10-22T10:00:00+03:00',
 reviewer:'Старший смены Петров',hygieneDecision:'admit',
 uniform:'ok',hands:'ok',headwear:'ok',personalItems:'ok',workplaceRules:'na'
};
const record=(state,fields={})=>addJournalRecord(state,{...entry,...fields});
test('Roster and staff responsibilities are editable separately for each of the four points',()=>{
 const state=fixture();
 assert.equal(state.haccp.points.length,4);
 assert.deepEqual(hygieneSettings(state.haccp,'point-1').employees,[]);
 assert.equal(hygieneSettings(state.haccp,'point-1').reviewer,'Старший смены');
 updateHygieneSettings(state,'point-1',{
  employees:['Иванов','Петров'],roles:['Сушист','Старший смены'],reviewer:'Старший смены'
 });
 updateHygieneSettings(state,'point-2',{
  employees:['Сидоров'],roles:['Сушист'],reviewer:'Менеджер'
 });
 assert.deepEqual(hygieneSettings(validateHaccp(state.haccp),'point-1').employees,['Иванов','Петров']);
 assert.deepEqual(hygieneSettings(state.haccp,'point-2').employees,['Сидоров']);
 assert.equal(hygieneSettings(state.haccp,'point-3').employees.length,0);
 assert.throws(()=>updateHygieneSettings(state,'point-1',{
  employees:['Иванов','иванов'],roles:['Сушист'],reviewer:'Старший смены'
 }),/Проверь названия/);
});
test('Actual inspection saves hygienic checklist and supervisor before shift, with clean A4',()=>{
 const state=fixture();
 const saved=record(state);
 assert.equal(saved.status,'ok');
 assert.equal(saved.details.hygieneDecision,'admit');
 assert.equal(HYGIENE_CHECKS.length,5);
 assert.equal(saved.details.shiftStart,'2026-10-22T07:00:00.000Z');
 assert.match(saved.details.checks,/Чистота рук и ногтей/);
 const columns=paperColumns('hygiene').map(x=>x.key);
 for(const key of ['at','employee','shiftStart','decisionText','reviewer'])assert.ok(columns.includes(key));
 assert.match(paperCell(saved,'decisionText',state.haccp.points),/Допущен к работе/);
 assert.match(paperCell(saved,'reviewer',state.haccp.points),/Старший смены Петров/);
});
test('Cannot grant admission for uninspected or failed hygiene, or after shift starts',()=>{
 const state=fixture();
 assert.throws(()=>record(state,{hands:'problem'}),/Нельзя допустить/);
 assert.throws(()=>record(state,{uniform:'na'}),/Нельзя допустить/);
 assert.throws(()=>record(state,{headwear:''}),/Укажи/);
 assert.throws(()=>record(state,{shiftStart:'2026-10-22T08:00:00+03:00'}),/до начала смены/);
 assert.throws(()=>record(state,{reviewer:''}),/проверившего/);
 assert.equal(state.haccp.records.length,0);
});
test('Non-admission records an actionable deviation without medical diagnosis details',()=>{
 const state=fixture();
 assert.throws(()=>record(state,{hands:'problem',hygieneDecision:'deny',notes:''}),/служебное действие/);
 const saved=record(state,{hands:'problem',hygieneDecision:'deny',
  notes:'Отстранён от работы; решение передано ответственному'});
 assert.equal(saved.status,'deviation');
 assert.equal(saved.details.decisionText,'Не допущен к работе');
 assert.equal(state.haccp.actions.length,1);
 assert.equal(saved.details.diagnosis,undefined);
});
test('No fictional per-employee shift outcomes from 11am checklists, templates or A4 pack',()=>{
 const state=fixture();
 assert.throws(()=>saveAutoTemplate(state,{
  kind:'hygiene',pointId:'point-1',form:{employee:'Иванов',result:'done'}
 }),/по факту/);
 assert.deepEqual(dueAutoDrafts(state.haccp,new Date('2026-10-22T12:00:00Z')),[]);
 const rows=automaticJournalRows(state.haccp,{
  month:'2026-10',kind:'hygiene',pointId:'point-1',now:new Date('2026-10-22T12:00:00Z')
 });
 assert.deepEqual(rows,[]);
 record(state);
 const factual=automaticJournalRows(state.haccp,{
  month:'2026-10',kind:'hygiene',pointId:'point-1',now:new Date('2026-10-22T12:00:00Z')
 });
 assert.equal(factual.length,1);
 assert.equal(factual[0].type,'confirmed');
});
