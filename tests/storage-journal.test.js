import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyHaccp,addJournalRecord,validateHaccp} from '../public/haccp-model.js';
import {storageSettings,updateStorageSettings} from '../public/storage-config.js';
import {saveAutoTemplate,dueAutoDrafts} from '../public/haccp-template-drafts.js';
import {paperColumns,paperCell} from '../public/haccp-paper-layout.js';

const fixture=()=>({haccp:emptyHaccp()});
const base={kind:'storage',pointId:'point-1',at:'2026-10-22T12:00:00+03:00',
 owner:'Сушист',product:'Заготовка лосось',batch:'L-222',storageType:'semifinished',
 storageZone:'Холодильник',startedAt:'2026-10-22T09:00:00+03:00',
 useBy:'2026-10-23T09:00:00+03:00',conditions:'По утверждённой технологической карте',
 labelCheck:'ok',conditionsCheck:'ok'};
const save=(state,patch={})=>addJournalRecord(state,{...base,...patch});

test('All four points keep their own storage hints, no universal shelf life',()=>{
 const state=fixture();
 const def=storageSettings(state.haccp,'point-1');
 assert.ok(def.products.includes('Лосось')&&def.zones.includes('Холодильник'));
 assert.ok(!Object.keys(def).some(x=>/hours|days|duration|shelf|expiry/i.test(x)));
 updateStorageSettings(state,'point-1',{products:['Рис','Сыр'],zones:['Холодильник №4']});
 updateStorageSettings(state,'point-2',{products:['Тунец'],zones:['Морозильник']});
 const validated=validateHaccp(state.haccp);
 assert.deepEqual(storageSettings(validated,'point-1').zones,['Холодильник №4']);
 assert.deepEqual(storageSettings(validated,'point-2').zones,['Морозильник']);
 assert.deepEqual(storageSettings(validated,'point-3').zones,def.zones);
});
test('A factual storage label is saved and exported with relevant A4 columns',()=>{
 const state=fixture(),saved=save(state);
 assert.equal(saved.status,'ok');
 assert.equal(saved.details.batch,'L-222');
 assert.equal(saved.details.storageType,'semifinished');
 assert.equal(saved.details.labelCheck,'ok');
 const cols=paperColumns('storage').map(row=>row.key);
 for(const name of ['storageZone','storageProductBatch','storageReview','useBy','status'])
  assert.ok(cols.includes(name),'missing printable column: '+name);
 assert.match(paperCell(saved,'storageProductBatch',state.haccp.points),/L-222/);
 assert.match(paperCell(saved,'storageReview',state.haccp.points),/Маркировка: Да/);
});
test('Expired stock, absent labels and violated storage conditions trigger a deviation',()=>{
 const state=fixture();
 const past=save(state,{useBy:'2026-10-22T10:00:00+03:00',notes:'Изолировали от реализации'});
 assert.equal(past.status,'deviation');
 const labels=save(state,{labelCheck:'problem',notes:'Маркировка отсутствует'});
 assert.equal(labels.status,'deviation');
 const storage=save(state,{conditionsCheck:'problem',notes:'Несоответствие условий'});
 assert.equal(storage.status,'deviation');
 assert.equal(state.haccp.actions.length,3);
 assert.throws(()=>save(state,{useBy:'2026-10-22T10:00:00+03:00'}),/комментарии/);
 assert.throws(()=>save(state,{startedAt:'2026-10-22T14:00:00+03:00'}),/позже даты проверки/);
 assert.throws(()=>save(state,{useBy:'2026-10-22T08:00:00+03:00'}),/позже приготовления/);
 assert.throws(()=>save(state,{labelCheck:'problem'}),/комментарии/);
});
test('Recurring storage sample never copies prior batch dates or successful inspection',()=>{
 const state=fixture();
 saveAutoTemplate(state,{kind:'storage',pointId:'point-1',form:{
  ...base,product:'Заготовка лосось',storageType:'semifinished',
  labelCheck:'ok',conditionsCheck:'ok'
 },now:new Date('2026-10-21T13:00:00Z')});
 const template=state.haccp.autoTemplates[0];
 assert.equal(template.form.startedAt,undefined);
 assert.equal(template.form.useBy,undefined);
 assert.equal(template.form.batch,undefined);
 assert.equal(template.form.owner,undefined);
 assert.equal(template.form.labelCheck,undefined);
 assert.equal(template.form.conditionsCheck,undefined);
 const drafts=dueAutoDrafts(state.haccp,new Date('2026-10-22T13:00:00Z'));
 assert.ok(drafts.length>0);
 for(const d of drafts){
  assert.equal(d.form.useBy,undefined);
  assert.equal(d.form.labelCheck,undefined);
 }
 assert.equal(state.haccp.records.length,0);
});
