import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyHaccp,addJournalRecord,validateHaccp,mergeHaccp} from '../public/haccp-model.js';
import {moscowCheckpoint,dueRecords,deepCleaningProgress} from '../public/haccp-schedule.js';
const state=()=>({haccp:emptyHaccp()});
const input=(at,cleaningType='daily',pointId='point-1')=>({
 kind:'cleaning',pointId,at,owner:'Старший смены',cleaningType,
 zone:'Горячий цех',method:'По утверждённой инструкции',agent:'Средство из карты обработки',result:'done'
});
test('11:00 Moscow controls when daily checks become due, regardless of browser timezone',()=>{
 assert.deepEqual(moscowCheckpoint('2026-10-21T07:59:00Z'),{day:'2026-10-21',month:'2026-10',clock:'10:59',due:false});
 assert.deepEqual(moscowCheckpoint('2026-10-21T08:00:00Z'),{day:'2026-10-21',month:'2026-10',clock:'11:00',due:true});
 assert.equal(moscowCheckpoint('2026-10-21T21:01:00Z').day,'2026-10-22');
});
test('Daily plan defaults to real routine journals; event-based journals are not falsely marked overdue',()=>{
 const s=state(),plan=dueRecords(s.haccp,{day:'2026-10-21',pointId:'point-1'});
 assert.deepEqual(s.haccp.dailyControls,['temperature','cleaning','storage','hygiene']);
 assert.equal(plan.total,4);
 assert.equal(plan.waiting,4);
 assert.ok(plan.checks.every(x=>!x.complete));
 const single=dueRecords(s.haccp,{day:'2026-10-21',pointId:'point-1',kinds:['receiving']});
 assert.equal(single.waiting,1);
});
test('Daily cleaning and deep cleaning are separate, and monthly 2/point counts distinct confirmed days',()=>{
 const s=state();addJournalRecord(s,input('2026-10-21T11:00:00+03:00','general'),'g1');
 assert.equal(dueRecords(s.haccp,{day:'2026-10-21',pointId:'point-1',kinds:['cleaning']}).waiting,1);
 addJournalRecord(s,input('2026-10-21T11:30:00+03:00','general'),'g2');
 assert.equal(deepCleaningProgress(s.haccp,{month:'2026-10',pointId:'point-1'}).done,1);
 addJournalRecord(s,input('2026-10-22T11:00:00+03:00','general'),'g3');
 assert.equal(deepCleaningProgress(s.haccp,{month:'2026-10',pointId:'point-1'}).remaining,0);
 addJournalRecord(s,input('2026-10-22T12:00:00+03:00','daily'),'d1');
 const plan=dueRecords(s.haccp,{day:'2026-10-22',pointId:'point-1',kinds:['cleaning']});
 assert.equal(plan.confirmed,1);
 assert.equal(deepCleaningProgress(s.haccp,{month:'2026-11',pointId:'point-1'}).done,0);
 const restored=validateHaccp(JSON.parse(JSON.stringify(s.haccp)));
 assert.equal(restored.records.length,4);
 assert.equal(restored.generalCleaningTarget,2);
});
test('Existing HACCP records without cleaningType remain valid and count as daily, never general',()=>{
 const s=state();addJournalRecord(s,input('2026-10-21T11:00:00+03:00','daily'),'d');
 delete s.haccp.records[0].details.cleaningType;
 assert.equal(dueRecords(s.haccp,{day:'2026-10-21',pointId:'point-1',kinds:['cleaning']}).confirmed,1);
 assert.equal(deepCleaningProgress(s.haccp,{month:'2026-10',pointId:'point-1'}).done,0);
});
test('Changing the daily plan is validated, preserved and never alters actual records',()=>{
 const s=state();addJournalRecord(s,input('2026-10-21T11:00:00+03:00'),'c1');
 s.haccp.dailyControls=['hygiene','pests'];s.haccp.generalCleaningTarget=3;
 const restored=validateHaccp(JSON.parse(JSON.stringify(s.haccp)));
 assert.deepEqual(restored.dailyControls,['hygiene','pests']);assert.equal(restored.generalCleaningTarget,3);
 assert.equal(restored.records.length,1);
 assert.throws(()=>validateHaccp({...restored,dailyControls:['cleaning','cleaning']}),/план/);
 assert.throws(()=>validateHaccp({...restored,dailyControls:['any']}),/план/);
 assert.throws(()=>validateHaccp({...restored,generalCleaningTarget:12}),/генеральной/);
 assert.throws(()=>addJournalRecord(state(),input('2026-10-21T11:00:00+03:00','false'),'bad'),/тип уборки/);
});

test('Backup restoration copies HACCP plan to a clean device, but does not overwrite established plan',()=>{
 const source=state();source.haccp.dailyControls=['pests'];source.haccp.generalCleaningTarget=3;
 const blank=emptyHaccp(),merged=mergeHaccp(blank,source.haccp);
 assert.deepEqual(merged.dailyControls,['pests']);assert.equal(merged.generalCleaningTarget,3);
 const ongoing=state();ongoing.haccp.dailyControls=['cleaning'];ongoing.haccp.generalCleaningTarget=1;
 const preserved=mergeHaccp(ongoing.haccp,source.haccp);
 assert.deepEqual(preserved.dailyControls,['cleaning']);assert.equal(preserved.generalCleaningTarget,1);
});
