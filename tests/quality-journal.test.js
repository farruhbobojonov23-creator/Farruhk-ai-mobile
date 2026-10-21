import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyHaccp,addJournalRecord,validateHaccp} from '../public/haccp-model.js';
import {QUALITY_CRITERIA,qualityPlan,qualityPlanNeedsSeed,seedQualityDailyPlan,updateQualityPlan} from '../public/quality-control.js';
import {dueAutoDrafts,generateAutoDrafts,saveAutoTemplate} from '../public/haccp-template-drafts.js';
import {automaticJournalRows} from '../public/haccp-auto-journals.js';
import {paperColumns,paperCell} from '../public/haccp-paper-layout.js';

const fixture=()=>({haccp:emptyHaccp()});
const now=()=>new Date('2026-10-22T13:00:00Z');
const base={kind:'quality',pointId:'point-1',at:'2026-10-22T12:00:00+03:00',owner:'Сушист Иванов',
 qualityType:'batch',product:'Филадельфия',batch:'П-10',quantity:'8 шт.',
 startedAt:'2026-10-22T11:00:00+03:00',recipeId:'recipe-1',category:'Холодные роллы',
 reviewer:'Старший смены Петров',
 appearance:'ok',color:'ok',smell:'ok',texture:'ok',taste:'na',decision:'accepted'};
const record=(state,fields={})=>addJournalRecord(state,{...base,...fields});
test('All four sushi points get a daily review draft and separate unlimited batch entries',()=>{
 const state=fixture();
 assert.equal(qualityPlanNeedsSeed(state.haccp),true);
 assert.equal(seedQualityDailyPlan(state,new Date('2026-10-21T13:00:00Z')),true);
 assert.equal(qualityPlanNeedsSeed(state.haccp),false);
 assert.equal(state.haccp.autoTemplates.filter(t=>t.kind==='quality').length,4);
 assert.equal(seedQualityDailyPlan(state,new Date('2026-10-21T13:00:00Z')),false);
 assert.ok(state.haccp.dailyControls.includes('quality'));
 const list=dueAutoDrafts(state.haccp,now()).filter(d=>d.kind==='quality');
 assert.equal(list.filter(d=>d.day==='2026-10-22').length,4);
 assert.ok(list.every(d=>!('decision' in d.form)&&!('reviewer' in d.form)&&!('product' in d.form)&&!('owner' in d.form)));
 assert.equal(state.haccp.records.length,0);
 assert.equal(qualityPlan(state.haccp,'point-1').reviewer,'Старший смены');
});
test('All meal categories may use actual TTK identity and shift lead signs release',()=>{
 const state=fixture(),r=record(state);
 assert.equal(r.status,'ok');
 assert.equal(r.details.recipeId,'recipe-1');
 assert.equal(r.details.category,'Холодные роллы');
 assert.equal(r.details.qualityType,'batch');
 assert.equal(r.details.reviewer,'Старший смены Петров');
 assert.equal(QUALITY_CRITERIA.length,5);
 assert.ok(paperColumns('quality').some(col=>col.key==='qualitySensory'));
 assert.match(paperCell(r,'qualityProduct',state.haccp.points),/Филадельфия/);
 assert.match(paperCell(r,'qualityReview',state.haccp.points),/Проверил: Старший смены/);
});
test('Release is blocked if safety-relevant sensory criteria fail or not inspected',()=>{
 const state=fixture();
 assert.throws(()=>record(state,{smell:'problem'}),/Не допускай/);
 assert.throws(()=>record(state,{appearance:'na'}),/Не допускай/);
 assert.throws(()=>record(state,{texture:'na'}),/Не допускай/);
 assert.throws(()=>record(state,{decision:''}),/решение/);
 assert.throws(()=>record(state,{reviewer:''}),/проверяющего/);
 assert.throws(()=>record(state,{startedAt:'2026-10-22T15:00:00+03:00'}),/время приготовления/);
 assert.equal(state.haccp.records.length,0);
});
test('Rejection requires reason and opens a corrective action',()=>{
 const state=fixture();
 assert.throws(()=>record(state,{decision:'rejected',appearance:'problem'}),/причину/);
 const r=record(state,{decision:'rejected',appearance:'problem',notes:'Не реализовывать, изолировать партию'});
 assert.equal(r.status,'deviation');
 assert.equal(state.haccp.actions.length,1);
 assert.equal(state.haccp.actions[0].sourceId,r.id);
});
test('Daily checks remain due when only new-batch record exists, and confirmation closes daily draft',()=>{
 const state=fixture();seedQualityDailyPlan(state,new Date('2026-10-22T13:00:00Z'));
 record(state);
 let rows=automaticJournalRows(state.haccp,{month:'2026-10',kind:'quality',pointId:'point-1',now:now()});
 assert.equal(rows.filter(r=>r.type==='planned'&&r.day==='2026-10-22').length,1);
 record(state,{qualityType:'daily',batch:''});
 rows=automaticJournalRows(state.haccp,{month:'2026-10',kind:'quality',pointId:'point-1',now:now()});
 assert.equal(rows.filter(r=>r.type==='planned'&&r.day==='2026-10-22').length,0);
 assert.equal(rows.filter(r=>r.type==='confirmed').length,2);
});
test('Quality settings are independent across branches; cannot save completed batch as a daily template',()=>{
 const state=fixture();seedQualityDailyPlan(state,new Date('2026-10-22T13:00:00Z'));
 updateQualityPlan(state,'point-1',{executor:'Сушист',reviewer:'Старший смены №1'});
 assert.equal(qualityPlan(validateHaccp(state.haccp),'point-1').reviewer,'Старший смены №1');
 assert.equal(qualityPlan(state.haccp,'point-2').reviewer,'Старший смены');
 assert.throws(()=>saveAutoTemplate(state,{kind:'quality',pointId:'point-1',form:{qualityType:'batch',decision:'accepted'}}),/только ежедневные/);
});
