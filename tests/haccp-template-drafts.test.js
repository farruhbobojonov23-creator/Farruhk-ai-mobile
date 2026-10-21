import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyHaccp,validateHaccp,mergeHaccp,addEquipment} from '../public/haccp-model.js';
import {saveAutoTemplate,dueAutoDrafts,generateAutoDrafts,updateAutoDraft,confirmAutoDraft} from '../public/haccp-template-drafts.js';
import {automaticJournalRows,plannedCell} from '../public/haccp-auto-journals.js';

const before='2026-10-21T07:59:00Z',after='2026-10-21T08:01:00Z';
const state=()=>({haccp:emptyHaccp()});
const cleanForm={pointId:'point-1',owner:'Повар смены',zone:'Разделочный стол',
 method:'По техинструкции',agent:'Утверждённое средство',cleaningType:'daily',result:'done',
 at:'2026-10-21T11:00',notes:'Образец от владельца'};
test('One reusable template per journal and point is backed up and never records false completion',()=>{
 const s=state();
 const saved=saveAutoTemplate(s,{kind:'cleaning',pointId:'point-1',form:cleanForm,now:new Date(after)});
 assert.equal(saved.kind,'cleaning');
 assert.equal(s.haccp.autoTemplates.length,1);
 assert.equal(s.haccp.records.length,0);
 assert.equal(dueAutoDrafts(s.haccp,new Date(before)).length,0);
 assert.equal(dueAutoDrafts(s.haccp,new Date(after)).length,1);
 assert.equal(generateAutoDrafts(s,new Date(after)),1);
 assert.equal(s.haccp.autoDrafts.length,1);
 assert.equal(s.haccp.records.length,0);
 assert.equal(generateAutoDrafts(s,new Date(after)),0,'not duplicated after refresh');
 assert.equal(s.haccp.autoDrafts[0].form.zone,'Разделочный стол');
 assert.equal(s.haccp.autoDrafts[0].form.at,'2026-10-21T11:00');
 assert.equal(s.haccp.autoDrafts[0].day,'2026-10-21');
 const restored=validateHaccp(JSON.parse(JSON.stringify(s.haccp)));
 assert.equal(restored.autoTemplates[0].form.agent,'Утверждённое средство');
 assert.equal(restored.autoDrafts[0].form.result,'done');
});
test('Owner can edit daily draft then explicitly confirm actual conditions; confirmation removes only draft',()=>{
 const s=state();
 saveAutoTemplate(s,{kind:'cleaning',pointId:'point-1',form:cleanForm,now:new Date(after)});
 generateAutoDrafts(s,new Date(after));
 const draft=s.haccp.autoDrafts[0];
 updateAutoDraft(s,draft.id,{method:'Фактическая обработка',result:'problem'});
 assert.equal(s.haccp.records.length,0);
 assert.equal(s.haccp.autoDrafts[0].form.method,'Фактическая обработка');
 const input={...s.haccp.autoDrafts[0].form,at:'2026-10-21T12:15',notes:'Корректировка после проверки'};
 const record=confirmAutoDraft(s,draft.id,input,new Date('2026-10-21T10:00:00Z'));
 assert.equal(record.details.method,'Фактическая обработка');
 assert.equal(record.status,'deviation');
 assert.equal(s.haccp.actions.length,1);
 assert.equal(s.haccp.records.length,1);
 assert.equal(s.haccp.autoDrafts.length,0);
 assert.throws(()=>confirmAutoDraft(s,draft.id,input),/не найден/);
 assert.equal(generateAutoDrafts(s,new Date(after)),0,'no duplicate when actual daily check exists');
});
test('Twelve separate templates can be configured and daily entries created once each from 11AM',()=>{
 const s=state();
 const types=['temperature','cleaning','receiving','storage','audit','humidity','frying',
  'cooking','defrosting','quality','hygiene','pests'];
 for(const kind of types)saveAutoTemplate(s,{kind,pointId:'point-1',
  form:{...cleanForm,owner:'Шеф',product:'Блюдо образец'},now:new Date(after)});
 assert.equal(s.haccp.autoTemplates.length,12);
 assert.equal(generateAutoDrafts(s,new Date(after)),12);
 assert.equal(generateAutoDrafts(s,new Date('2026-10-22T07:59:00Z')),0);
 assert.equal(generateAutoDrafts(s,new Date('2026-10-22T08:02:00Z')),12);
 assert.equal(s.haccp.autoDrafts.length,24);
 assert.equal(s.haccp.records.length,0);
 const table=automaticJournalRows(s.haccp,{month:'2026-10',kind:'cleaning',
  pointId:'point-1',now:new Date(after)});
 assert.equal(table.filter(x=>x.type==='draft').length,2);
 const row=table.find(x=>x.type==='draft');
 assert.equal(plannedCell(row,'zone',s.haccp.points),'Разделочный стол');
 assert.equal(plannedCell(row,'result',s.haccp.points),'ЧЕРНОВИК');
 assert.equal(plannedCell(row,'owner',s.haccp.points),'Шеф');
 assert.ok(!JSON.stringify(table).includes('НЕ ПРОВЕРЕНО'));
});
test('New daily drafts move template datetimes relative to original sample and keep previously edited drafts intact',()=>{
 const s=state();
 saveAutoTemplate(s,{kind:'storage',pointId:'point-1',form:{
  pointId:'point-1',at:'2026-10-21T11:00',startedAt:'2026-10-21T08:00',
  useBy:'2026-10-23T08:00',product:'Маркировка',owner:'Шеф',conditions:'Хранить охлаждённым'
 },now:new Date(after)});
 generateAutoDrafts(s,new Date(after));
 const first=s.haccp.autoDrafts[0];
 updateAutoDraft(s,first.id,{product:'Исправленное название'});
 generateAutoDrafts(s,new Date('2026-10-22T09:00:00Z'));
 assert.equal(s.haccp.autoDrafts[0].form.product,'Исправленное название');
 assert.equal(s.haccp.autoDrafts[1].form.product,'Маркировка');
 assert.equal(s.haccp.autoDrafts[1].form.startedAt,'2026-10-22T08:00');
 assert.equal(s.haccp.autoDrafts[1].form.useBy,'2026-10-24T08:00');
});
test('Backups merge templates and unfinished draft queue without deleting local inspections',()=>{
 const s=state();
 saveAutoTemplate(s,{kind:'cleaning',pointId:'point-1',form:cleanForm,now:new Date(after)});
 generateAutoDrafts(s,new Date(after));
 const merged=mergeHaccp(emptyHaccp(),s.haccp);
 assert.equal(merged.autoTemplates.length,1);
 assert.equal(merged.autoDrafts.length,1);
 const again=mergeHaccp(merged,s.haccp);
 assert.equal(again.autoDrafts.length,1);
 assert.equal(again.autoTemplates.length,1);
});

test('Temperature example saves approved limits, never a made-up reading; each refrigerator can differ',()=>{
 const s=state();
 addEquipment(s,{pointId:'point-1',name:'Холодильник (+2 … +6)',min:2,max:6},'fridge1');
 addEquipment(s,{pointId:'point-1',name:'Морозильник (-20 … -12)',min:-20,max:-12},'freezer2');
 const a=saveAutoTemplate(s,{kind:'temperature',pointId:'point-1',form:{
  equipmentId:'fridge1',min:'2',max:'6',owner:'Повар',measured:'3'
 },now:new Date(after)});
 const b=saveAutoTemplate(s,{kind:'temperature',pointId:'point-1',form:{
  equipmentId:'freezer2',min:'-20',max:'-12',owner:'Повар',measured:'-17'
 },now:new Date(after)});
 assert.equal(a.form.measured,undefined,'sample must not store a reading');
 assert.equal(b.form.measured,undefined);
 assert.equal(s.haccp.records.length,0);
 const drafts=dueAutoDrafts(s.haccp,new Date(after));
 assert.equal(drafts.length,2);
 assert.ok(drafts.every(d=>d.form.measured===undefined),'daily drafts start without an invented number');
 assert.deepEqual(drafts.map(d=>d.form.equipmentId),['fridge1','freezer2']);
 const saved=generateAutoDrafts(s,new Date(after));
 assert.equal(saved,2);
 assert.equal(s.haccp.records.length,0);
 assert.ok(s.haccp.autoDrafts.every(d=>!('measured' in d.form)));
});
test('Older temperature templates with a copied reading are sanitized when generating a new day',()=>{
 const s=state();
 addEquipment(s,{pointId:'point-1',name:'Холодильник',min:2,max:6},'f1');
 saveAutoTemplate(s,{kind:'temperature',pointId:'point-1',form:{equipmentId:'f1',owner:'Повар'},now:new Date(after)});
 s.haccp.autoTemplates[0].form.measured='5'; // Legacy data before the fix
 const pending=dueAutoDrafts(s.haccp,new Date(after));
 assert.equal(pending[0].form.measured,undefined);
});
