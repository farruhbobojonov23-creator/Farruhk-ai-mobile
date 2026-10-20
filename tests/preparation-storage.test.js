import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDeviceState,mergeDeviceState} from '../public/device-store.js';
const batch={id:'batch-1',name:'Соус',point:'Кухня',quantity:250,unit:'г',preparedAt:'2026-10-20T08:00:00Z',useBy:'2026-10-21T08:00:00Z',used:false};
test('Existing device backups gain an empty preparation list without losing recipes or tasks',()=>{const result=validateDeviceState({tasks:[{id:'t',text:'Проверка'}],recipes:[]});assert.deepEqual(result.preparations,[]);assert.equal(result.tasks[0].text,'Проверка')});
test('Preparation backups round-trip and merge without duplicating or replacing existing batches',()=>{const current=validateDeviceState({tasks:[],preparations:[batch]});const incoming={tasks:[],preparations:[{...batch,quantity:1},{...batch,id:'batch-2'}]};const result=mergeDeviceState(JSON.parse(JSON.stringify(current)),incoming);assert.equal(result.preparations.length,2);assert.equal(result.preparations[0].quantity,250);assert.equal(current.preparations.length,1)});
test('Malformed preparation quantities and dates are rejected before importing',()=>{for(const patch of [{quantity:0},{quantity:'bad'},{preparedAt:'bad'},{useBy:batch.preparedAt},{useBy:'2026-10-19T08:00:00Z'}])assert.throws(()=>validateDeviceState({tasks:[],preparations:[{...batch,...patch}]}),/заготовки/)});
