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

import {resolveCategoryFields,templateFor} from '../public/recipe-math.js';
import {cleanState} from '../assistant-store.js';
test('personal template fields survive export normalization including intentional blanks',()=>{
 const recipe={id:'personal',name:'Мой вок',category:'Воки',ingredients:[],customTemplate:true,forming:templateFor('Холодные роллы',8).forming,storage:'',appearance:'',taste:'Авторский текст'};
 const clean=cleanState({recipes:[recipe]}).recipes[0];assert.equal(clean.customTemplate,true);assert.equal(resolveCategoryFields(clean).forming,recipe.forming);assert.equal(resolveCategoryFields(clean).storage,'');assert.equal(resolveCategoryFields(clean).appearance,'');assert.equal(resolveCategoryFields(clean).taste,'Авторский текст');
});

test('delivery mode and packaging carry into new card without changing original template',()=>{const t={...template,deliveryMode:'Горячая доставка',packaging:'Контейнер для горячего'};const values=templateValues(t);assert.match(values.storage,/Режим: Горячая доставка/);assert.match(values.storage,/Упаковка и доставка: Контейнер/);assert.equal(t.storage,template.storage);validateMyTemplates([t]);assert.throws(()=>validateMyTemplates([{...t,packaging:42}]));});
