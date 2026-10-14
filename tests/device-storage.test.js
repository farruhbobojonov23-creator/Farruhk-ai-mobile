import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDeviceState,mergeDeviceState,DeviceStore} from '../public/device-store.js';
test('Backup import preserves existing device cards and adds missing cloud cards',()=>{
 const current={recipes:[{id:'one',name:'Местная версия',ingredients:[]}],tasks:[],chat:[]};
 const imported={state:{recipes:[{id:'one',name:'Старая облачная версия',ingredients:[]},{id:'two',name:'Вторая карта',ingredients:[]}],tasks:[{id:'task',text:'Рис'}],chat:[{role:'ai',text:'Привет'}]}};
 const result=mergeDeviceState(current,imported);assert.deepEqual(result.recipes.map(r=>r.name),['Местная версия','Вторая карта']);assert.equal(result.storage,'device');assert.equal(current.recipes.length,1);assert.equal(mergeDeviceState(result,imported).chat.length,1);
});
test('Invalid imports and unavailable device storage fail instead of resetting data',async()=>{
 assert.throws(()=>validateDeviceState({}));assert.throws(()=>validateDeviceState({recipes:[{id:'x',name:'Карта',ingredients:null}]}));assert.throws(()=>validateDeviceState({tasks:[null]}));await assert.rejects(()=>new DeviceStore(null).load(),/не поддерживает/);
});
