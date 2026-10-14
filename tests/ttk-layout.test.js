import test from 'node:test';
import assert from 'node:assert/strict';
import {scopeForName,storageWithSanpin,templateFor} from '../public/recipe-math.js';
import {cleanState} from '../assistant-store.js';
import {recipePdf} from '../recipe-pdf.js';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';
test('Dish name follows typing and renaming, while custom scope stays intact',()=>{
 const original=templateFor('Холодные роллы').scope;
 const first=scopeForName(original,'Филадельфия');assert.match(first,/«Филадельфия»/);
 assert.match(scopeForName(first,'Канада'),/«Канада»/);assert.equal(scopeForName('Мой текст','Канада'),'Мой текст');assert.match(scopeForName(original,'Блюдо $&'),/Блюдо \$&/);
});
test('Portions 1, 4, 6 and 8 and current sanitary reference appear in templates',()=>{
 for(const pieces of [1,4,6,8]){const t=templateFor('Холодные роллы',pieces);assert.match(t.serving,pieces===1?/1 шт\./:new RegExp(pieces+' равных'));assert.match(t.storage,/СанПиН 2\.3\/2\.4\.4282-26/)}
 assert.equal(storageWithSanpin(storageWithSanpin('Срок предприятия: 12 часов.')),storageWithSanpin('Срок предприятия: 12 часов.'));assert.doesNotMatch(storageWithSanpin('СанПиН 2.3/2.4.3590-20'),/3590-20/);
});
test('Every ingredient survives the single A4 export for 1, 10 and 100 rows',async()=>{
 for(const count of [1,10,100,101]){
  const recipe={...templateFor('Холодные роллы'),name:'Тестовая карта',pieces:6,ingredients:Array.from({length:count},(_,i)=>({name:'Сырьё номер '+i,grams:10,grossGrams:12})),netYieldGrams:count*10};
  const bytes=await new Promise((resolve,reject)=>{const doc=recipePdf(cleanState({recipes:[recipe]}).recipes[0]),chunks=[];doc.on('data',b=>chunks.push(b));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.end()});
  const pdf=await parsePdf(bytes);assert.equal(pdf.numpages,1);assert.match(pdf.text,new RegExp('Сырьё номер '+(count-1)));assert.match(pdf.text,/«Тестовая карта»/);assert.match(pdf.text,/4282-26/);
 }
});
