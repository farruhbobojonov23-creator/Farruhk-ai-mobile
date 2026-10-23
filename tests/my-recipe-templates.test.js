import test from 'node:test';
import assert from 'node:assert/strict';
import {fields,validateMyTemplates,templateValues} from '../public/my-recipe-templates.js';
import {validateDeviceState,mergeDeviceState} from '../public/device-store.js';
const template={id:'own-wok',name:'Мой вок',category:'Воки',...Object.fromEntries(Object.keys(fields).map(k=>[k,''])),forming:'Обжарить лапшу',storage:'Подать в контейнере',shelfLife:'2 часа',temperature:'+2…+6 °C'};
test('own templates survive backup and restore without replacing existing recipes',()=>{
 const original={tasks:[],recipes:[{id:'r1',name:'Старое блюдо',ingredients:[],technology:'Авторский текст'}]};
 const incoming=validateDeviceState({...original,myRecipeTemplates:[template]});
 const restored=mergeDeviceState(original,JSON.parse(JSON.stringify(incoming)));
 assert.deepEqual(restored.recipes,original.recipes);assert.deepEqual(restored.myRecipeTemplates,[template]);
 assert.deepEqual(mergeDeviceState(restored,incoming).myRecipeTemplates,[template]);
});
test('application combines storage without changing template',()=>{
 const before=structuredClone(template);const values=templateValues(template);
 assert.match(values.storage,/Срок годности: 2 часа/);assert.match(values.storage,/Температура хранения: \+2/);assert.deepEqual(template,before);
 const empty=templateValues({...template,shelfLife:'',temperature:''});assert.equal(empty.storage,template.storage);
});
test('corrupt template backup is rejected',()=>{
 assert.throws(()=>validateMyTemplates([{}]));assert.throws(()=>validateMyTemplates([{...template,forming:42}]));validateMyTemplates([template]);validateMyTemplates(undefined);
});
