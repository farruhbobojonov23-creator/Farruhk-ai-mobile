import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyHaccp,addJournalRecord,validateHaccp} from '../public/haccp-model.js';
import {OIL_CHECKS,oilSettings,updateOilSettings,oilCycleState,oilPointsMissingSetup,seedOilPointSettings} from '../public/frying-oil-config.js';
import {automaticJournalRows} from '../public/haccp-auto-journals.js';
import {saveAutoTemplate,dueAutoDrafts} from '../public/haccp-template-drafts.js';
import {paperColumns,paperCell} from '../public/haccp-paper-layout.js';

const fresh=()=>({haccp:emptyHaccp()});
const input={
 kind:'frying',pointId:'point-1',at:'2026-10-22T12:00:00+03:00',
 owner:'Сушист Иванов',equipment:'Фритюрница',product:'Масло для фритюра Печагин',
 startedAt:'2026-10-20T12:00:00+03:00',
 color:'ok',odor:'ok',foam:'ok',smoke:'ok',
 measured:169,oilDecision:'continue',reviewer:'Старший смены Петров'
};
const save=(state,patch={})=>addJournalRecord(state,{...input,...patch});
test('All 4 points receive an editable fryer-oil brand and 3 day OWNER policy without invented filling dates',()=>{
 const s=fresh();
 assert.equal(s.haccp.points.length,4);
 const cfg=oilSettings(s.haccp,'point-1');
 assert.equal(cfg.oil,'Масло для фритюра Печагин');
 assert.equal(cfg.intervalDays,3);
 assert.deepEqual(cfg.fryerNames,['Фритюрница']);
 assert.equal(cfg.executor,'Сушист');
 assert.equal(cfg.reviewer,'Старший смены');
 assert.equal(oilCycleState(s.haccp,'point-1','Фритюрница').dueAt,null);
 const config=updateOilSettings(s,'point-1',{
  oil:'Масло для фритюра Печагин',fryerNames:['Фритюрница № 1','Фритюрница № 2'],
  intervalDays:3,executor:'Сушист',reviewer:'Старший смены'
 });
 assert.equal(config.fryerNames.length,2);
 assert.equal(oilSettings(validateHaccp(s.haccp),'point-1').fryerNames.length,2);
 assert.equal(oilSettings(s.haccp,'point-2').fryerNames.length,1);
});
test('Daily oil inspection records real evidence, 72-hour deadline and formal A4',()=>{
 const s=fresh(),r=save(s);
 assert.equal(OIL_CHECKS.length,4);
 assert.equal(r.status,'ok');
 assert.equal(r.details.ageHours,48);
 assert.equal(r.details.oilDecision,'continue');
 assert.equal(r.details.tpm,null);
 assert.equal(oilCycleState(s.haccp,'point-1','Фритюрница').isDue,false);
 assert.equal(oilCycleState(s.haccp,'point-1','Фритюрница',new Date('2026-10-23T12:01:00+03:00')).isDue,true);
 const cols=paperColumns('frying').map(x=>x.key);
 for(const key of ['equipment','oilProductBatch','startedAt','oilAge','oilChecks','oilDecision','reviewer'])
  assert.ok(cols.includes(key),key);
 assert.match(paperCell(r,'oilAge',s.haccp.points),/2 дн/);
 assert.match(paperCell(r,'oilChecks',s.haccp.points),/Темп.: 169/);
 assert.match(paperCell(r,'oilProductBatch',s.haccp.points),/Печагин/);
 assert.match(paperCell(r,'oilDecision',s.haccp.points),/Разрешено продолжить/);
});
test('A 3-day oil change is required even with normal visual checks, but can occur earlier',()=>{
 const s=fresh();
 assert.throws(()=>save(s,{at:'2026-10-23T12:00:00+03:00'}),/Нельзя продолжить/);
 const replaced=save(s,{oilDecision:'replace',changedAt:'2026-10-22T12:00:00+03:00'});
 assert.equal(replaced.status,'ok');
 assert.match(paperCell(replaced,'oilDecision',s.haccp.points),/Полная замена/);
 const next=oilCycleState(s.haccp,'point-1','Фритюрница',new Date('2026-10-22T13:00:00+03:00'));
 assert.equal(next.filledAt,'2026-10-22T09:00:00.000Z');
 assert.throws(()=>save(s,{startedAt:'2026-10-23T11:00:00+03:00',at:'2026-10-23T12:00:00+03:00'}),/Дата заливки позже/);
});
test('Abnormal oil, unknown inspections or exceeded approved TPM cannot be approved for frying',()=>{
 const s=fresh();
 assert.throws(()=>save(s,{odor:'problem'}),/Нельзя продолжить/);
 assert.throws(()=>save(s,{color:'na'}),/Нельзя продолжить/);
 assert.throws(()=>save(s,{tpm:26,approvedTpm:25}),/Нельзя продолжить/);
 assert.throws(()=>save(s,{approvedTpm:25,tpm:''}),/измерение отсутствует/);
 assert.throws(()=>save(s,{oilDecision:'replace',changedAt:''}),/фактические дату/);
 assert.throws(()=>save(s,{oilDecision:'stop',notes:''}),/Укажи замечание/);
 const stopped=save(s,{odor:'problem',oilDecision:'stop',notes:'Остановили фритюрницу'});
 assert.equal(stopped.status,'deviation');
 assert.equal(s.haccp.actions.length,1);
});
test('Real oil replacement resets date and only confirmed records go into monthly A4 packs',()=>{
 const s=fresh();
 assert.throws(()=>saveAutoTemplate(s,{
  kind:'frying',pointId:'point-1',form:{oilDecision:'continue'}
 }),/по факту/);
 assert.deepEqual(dueAutoDrafts(s.haccp,new Date('2026-10-22T14:00:00Z')),[]);
 assert.deepEqual(automaticJournalRows(s.haccp,{
  month:'2026-10',kind:'frying',pointId:'point-1',
  now:new Date('2026-10-22T14:00:00Z')
 }),[]);
 const r=save(s,{oilDecision:'replace',changedAt:'2026-10-22T12:00:00+03:00'});
 const pack=automaticJournalRows(s.haccp,{
  month:'2026-10',kind:'frying',pointId:'point-1',
  now:new Date('2026-10-22T14:00:00Z')
 });
 assert.equal(pack.length,1);
 assert.equal(pack[0].type,'confirmed');
 assert.equal(pack[0].record.id,r.id);
});

test('Stopped or failed oil must not be used again until actual full replacement is recorded',()=>{
 const s=fresh();
 const stopped=save(s,{at:'2026-10-22T10:00:00+03:00',oilDecision:'stop',notes:'Запах масла изменился'});
 assert.equal(stopped.status,'deviation');
 assert.throws(()=>save(s,{at:'2026-10-22T12:00:00+03:00'}),/Для возобновления/);
 const changed=save(s,{at:'2026-10-22T13:00:00+03:00',oilDecision:'replace',
  changedAt:'2026-10-22T13:00:00+03:00'});
 assert.equal(changed.details.oilDecision,'replace');
 const usable=save(s,{at:'2026-10-22T14:00:00+03:00',
  startedAt:'2026-10-22T13:00:00+03:00'});
 assert.equal(usable.status,'ok');
});

test('Confirmed one fryer per each of four points is persisted once; later custom edits remain intact',()=>{
 const state=fresh();
 assert.equal(oilPointsMissingSetup(state.haccp).length,4);
 assert.equal(seedOilPointSettings(state),4);
 assert.equal(seedOilPointSettings(state),0);
 assert.equal(Object.keys(state.haccp.oilSettings).length,4);
 for(const point of state.haccp.points){
  const config=oilSettings(state.haccp,point.id);
  assert.deepEqual(config.fryerNames,['Фритюрница']);
  assert.equal(config.oil,'Масло для фритюра Печагин');
  assert.equal(config.intervalDays,3);
 }
 updateOilSettings(state,'point-1',{
  oil:'Масло для фритюра Печагин',
  fryerNames:['Фритюрница особая'],intervalDays:3,
  executor:'Сушист',reviewer:'Старший смены'
 });
 assert.equal(seedOilPointSettings(state),0);
 assert.deepEqual(oilSettings(validateHaccp(state.haccp),'point-1').fryerNames,['Фритюрница особая']);
 assert.deepEqual(oilSettings(state.haccp,'point-2').fryerNames,['Фритюрница']);
 const record=save({...fresh(),haccp:state.haccp},{
  pointId:'point-2',equipment:'Фритюрница'
 });
 assert.equal(record.details.equipment,'Фритюрница');
});
