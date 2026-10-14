import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyHaccp,addEquipment,updateEquipment,addJournalRecord,closeCorrectiveAction,validateHaccp,journalCsv} from '../public/haccp-model.js';
import {validateDeviceState,mergeDeviceState} from '../public/device-store.js';
const base=()=>({recipes:[],haccp:emptyHaccp()});
const record={kind:'temperature',pointId:'point-1',at:'2026-10-14T12:00:00Z',owner:'Шеф',equipmentId:'fridge',measured:'5'};
const setup=()=>{const s=base();addEquipment(s,{pointId:'point-1',name:'Холодильник',min:0,max:4},'fridge');return s};
test('Temperature limits create actions and retain the measured-time limits after equipment changes',()=>{
 const s=setup();addJournalRecord(s,record,'r');assert.equal(s.haccp.actions.length,1);assert.equal(s.haccp.actions[0].status,'open');
 updateEquipment(s,'fridge',{name:'Холодильник',min:0,max:8});assert.equal(s.haccp.records[0].details.max,4);
 assert.throws(()=>closeCorrectiveAction(s,'action-r',{action:'Исправлено',reviewer:''}),/кто проверил/);assert.equal(s.haccp.actions[0].status,'open');
 closeCorrectiveAction(s,'action-r',{action:'Переместили продукты, исправили оборудование',reviewer:'Старший смены'});assert.equal(s.haccp.actions[0].status,'closed');
});
test('Boundary readings pass, absent limits stay unassessed, wrong-point equipment rejected',()=>{
 const s=setup();addJournalRecord(s,{...record,measured:4},'a');assert.equal(s.haccp.records[0].status,'ok');
 assert.throws(()=>addJournalRecord(s,{...record,pointId:'point-2'},'b'),/оборудование/);
 updateEquipment(s,'fridge',{name:'Холодильник',min:'',max:''});addJournalRecord(s,record,'c');assert.equal(s.haccp.records[1].status,'unconfigured');assert.equal(s.haccp.actions.length,0);
});
test('Receiving, storage, cleaning and audits reject missing data and route deviations',()=>{
 const s=base(),common={pointId:'point-2',at:record.at,owner:'Повар'};
 assert.throws(()=>addJournalRecord(s,{...common,kind:'receiving',supplier:'Поставка',product:'Рыба',quantity:'5 кг',checks:'Проверено',expiry:'2026-10-13',decision:'accepted'},'bad'),/истёк/);
 addJournalRecord(s,{...common,kind:'receiving',supplier:'Поставка',product:'Рыба',quantity:'5 кг',checks:'Нарушена упаковка',decision:'rejected'},'receive');
 addJournalRecord(s,{...common,kind:'cleaning',zone:'Стол',method:'Обработка',agent:'По инструкции',result:'problem'},'clean');
 addJournalRecord(s,{...common,kind:'storage',product:'Соус',startedAt:'2026-10-12',useBy:'2026-10-13',conditions:'По инструкции'},'store');
 assert.throws(()=>addJournalRecord(s,{...common,kind:'audit'},'bad-audit'),/все пункты/);
 addJournalRecord(s,{...common,kind:'audit',check0:'yes',check1:'no',check2:'yes',check3:'na',check4:'yes'},'audit');assert.equal(s.haccp.actions.length,4);
});
test('Backups round trip photos and documents, merge other points and preserve existing entries',()=>{
 const current=setup();addJournalRecord(current,{...record,photo:'data:image/png;base64,YQ=='},'r');current.haccp.documents.push({id:'doc',title:'Инструкция',fileName:'file.pdf',owner:'Шеф',createdAt:record.at,data:'data:application/pdf;base64,YQ=='});
 const restored=validateDeviceState(JSON.parse(JSON.stringify(current)));assert.equal(restored.haccp.documents[0].data,current.haccp.documents[0].data);assert.equal(restored.haccp.records[0].photo,current.haccp.records[0].photo);
 const other=base();addJournalRecord(other,{kind:'cleaning',pointId:'point-3',at:record.at,owner:'Повар',zone:'Стол',method:'Обработка',agent:'Средство',result:'done'},'other');const merged=mergeDeviceState(restored,other);assert.equal(merged.haccp.records.length,2);assert.equal(mergeDeviceState(merged,other).haccp.records.length,2);assert.ok(merged.haccp.revision>restored.haccp.revision);
});
test('Malformed backups fail and CSV blocks spreadsheet formulas',()=>{
 const s=setup();addJournalRecord(s,record,'r');const broken=structuredClone(s.haccp);broken.records[0].details=null;assert.throws(()=>validateHaccp(broken));broken.records[0]=s.haccp.records[0];broken.records.push(broken.records[0]);assert.throws(()=>validateHaccp(broken),/Повторяющиеся/);
 const csv=journalCsv([{...s.haccp.records[0],owner:'=SUM(1)',notes:'<script>"'}],s.haccp.points);assert.ok(csv.includes("'="));assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('<script>""'));
});
