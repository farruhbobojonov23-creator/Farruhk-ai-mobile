import test from 'node:test';
import assert from 'node:assert/strict';
import {settingsState} from '../public/site-settings.js';
import {validateDeviceState,mergeDeviceState} from '../public/device-store.js';
import {emptyHaccp,validateHaccp} from '../public/haccp-model.js';
test('settings preserve custom pages and order, reject unsafe IDs and keep home available',()=>{
 const config=settingsState({sections:[{id:'tasks',name:'План',hidden:true},{id:'custom-abc',name:'Меню',content:'Текст'},{id:'home',name:'Главная',deleted:true},{id:'tasks',name:'Дубликат'},{id:'bad\"',name:'Bad'}]});
 assert.equal(config.sections[0].name,'План');assert.equal(config.sections.filter(x=>x.id==='tasks').length,1);assert.equal(config.sections.find(x=>x.id==='home').deleted,false);assert.ok(!config.sections.some(x=>x.id==='bad\"'));assert.equal(config.sections.find(x=>x.id==='custom-abc').content,'Текст');
});
test('device backup preserves settings and restores them on a clean device',()=>{
 const original={tasks:[],recipes:[],siteSettings:settingsState({brand:'Мой кабинет'})};assert.equal(validateDeviceState(original).siteSettings.brand,'Мой кабинет');assert.equal(mergeDeviceState({tasks:[],recipes:[]},original).siteSettings.brand,'Мой кабинет');
});
test('removed personal journal is dropped without affecting real measurements',()=>{
 const h=emptyHaccp();h.personalTemperatureSamples=[{value:4}];assert.equal(validateHaccp(h).personalTemperatureSamples,undefined);assert.deepEqual(validateHaccp(h).records,[]);
});
