import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyHaccp,addJournalRecord} from '../public/haccp-model.js';
import {DEFAULT_CLEANING_PLAN,cleaningPlan,cleaningPlanNeedsSeed,seedCleaningPlan,updateCleaningPlan} from '../public/cleaning-plan.js';
import {dueAutoDrafts,generateAutoDrafts} from '../public/haccp-template-drafts.js';
import {automaticJournalRows} from '../public/haccp-auto-journals.js';

const day=(iso)=>new Date(iso+'T13:00:00Z'); // 16:00 Moscow, after 11:00 checkpoint.
const fixture=()=>({haccp:emptyHaccp()});

test('Standard sushi kitchen plan uses 4 separate branches, real chemical names, 1st/15th and accountable roles',()=>{
 const state=fixture();
 assert.equal(cleaningPlanNeedsSeed(state.haccp),true);
 assert.equal(seedCleaningPlan(state,day('2026-10-21')),true);
 assert.equal(cleaningPlanNeedsSeed(state.haccp),false);
 assert.equal(state.haccp.autoTemplates.length,8);
 assert.deepEqual(cleaningPlan(state.haccp,'point-1').agents,['Deco S9','Ника-2']);
 assert.deepEqual(cleaningPlan(state.haccp,'point-1').generalDays,[1,15]);
 assert.equal(DEFAULT_CLEANING_PLAN.dailyExecutor,'Сушист');
 assert.equal(DEFAULT_CLEANING_PLAN.reviewer,'Старший смены');
 assert.equal(DEFAULT_CLEANING_PLAN.generalExecutor,'Вся смена');
 assert.equal(seedCleaningPlan(state,day('2026-10-21')),false);
 for(const t of state.haccp.autoTemplates){
  assert.ok(!t.form.owner&&!t.form.result&&!t.form.agent,'no synthetic result, supervisor or chemical use');
  assert.ok(!t.form.concentration&&!t.form.exposure,'do not invent product dilution/contact times');
 }
});
test('Daily cleaning is prepared each day, general only on the 1st and 15th after its start date',()=>{
 const state=fixture();seedCleaningPlan(state,day('2026-10-21'));
 const drafts=dueAutoDrafts(state.haccp,day('2026-11-15'));
 assert.equal(drafts.filter(d=>d.day==='2026-11-01'&&d.form.cleaningType==='general').length,4);
 assert.equal(drafts.filter(d=>d.day==='2026-11-15'&&d.form.cleaningType==='general').length,4);
 assert.equal(drafts.filter(d=>d.day==='2026-11-02'&&d.form.cleaningType==='general').length,0);
 assert.equal(drafts.filter(d=>d.day==='2026-11-02'&&d.form.cleaningType==='daily').length,4);
 const n=generateAutoDrafts(state,day('2026-11-15'));
 assert.equal(n,drafts.length);
 assert.equal(generateAutoDrafts(state,day('2026-11-15')),0);
 assert.equal(state.haccp.records.length,0,'drafts must not become actual inspections');
});
test('Editing one branch moves only its scheduled cleaning days, while preserving the other locations',()=>{
 const state=fixture();seedCleaningPlan(state,day('2026-10-21'));
 const plan=cleaningPlan(state.haccp,'point-1');
 updateCleaningPlan(state,'point-1',{...plan,agents:['Ника-2'],dailyExecutor:'Сушист',reviewer:'Старший смены',
  generalExecutor:'Вся смена',generalDays:[5,20]},day('2026-10-21'));
 assert.deepEqual(cleaningPlan(state.haccp,'point-1').generalDays,[5,20]);
 assert.deepEqual(cleaningPlan(state.haccp,'point-2').generalDays,[1,15]);
 const drafts=dueAutoDrafts(state.haccp,day('2026-11-20'));
 assert.deepEqual(drafts.filter(d=>d.pointId==='point-1'&&d.form.cleaningType==='general').map(d=>d.day),['2026-11-05','2026-11-20']);
 assert.deepEqual(drafts.filter(d=>d.pointId==='point-2'&&d.form.cleaningType==='general').map(d=>d.day),['2026-11-01','2026-11-15']);
});
test('Monthly A4 planning lists exact general dates but no invented completion',()=>{
 const state=fixture();seedCleaningPlan(state,day('2026-10-21'));
 const rows=automaticJournalRows(state.haccp,{month:'2026-11',kind:'cleaning',pointId:'point-1',now:day('2026-11-02')});
 const general=rows.filter(r=>r.type==='planned-general');
 assert.deepEqual(general.map(r=>r.day),['2026-11-01','2026-11-15']);
 assert.equal(general[0].due,true);assert.equal(general[1].due,false);
 assert.equal(rows.filter(r=>r.type==='confirmed').length,0);
});
