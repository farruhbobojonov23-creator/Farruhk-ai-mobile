import test from 'node:test';
import assert from 'node:assert/strict';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';
import {cleanState} from '../assistant-store.js';
import {templateFor,cardDateNow,nextCardNumber} from '../public/recipe-math.js';
import {recipePdf,installRecipePdfApi} from '../recipe-pdf.js';
const bytes=r=>new Promise((resolve,reject)=>{const chunks=[],doc=recipePdf(r);doc.on('data',b=>chunks.push(b));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.end()});
test('Recipe metadata survives saves; unknown gross mass and nutrition stay unknown',()=>{
 const recipe={name:'Филадельфия',cardNumber:'001',netYieldGrams:275,pieces:8,nutrition:{protein:7,fat:0},ingredients:[{name:'Рис',grams:130}],storage:'Утверждённые условия',preparation:'Подготовка'};
 const saved=cleanState({recipes:[recipe]}).recipes[0];assert.equal(saved.netYieldGrams,275);assert.equal(saved.cardNumber,'001');assert.equal(saved.ingredients[0].grossGrams,null);assert.equal(saved.nutrition.carbs,null);assert.equal(saved.nutrition.fat,0);assert.equal(saved.storage,recipe.storage);
});
test('PDF preserves Cyrillic and the six sections; missing values are marked as a draft',async()=>{
 const out=await bytes({name:'Филадельфия',status:'ready',ingredients:[{name:'Рис',grams:130,grossGrams:null}],netYieldGrams:275,nutrition:{protein:7}});const pdf=await parsePdf(out);assert.equal(pdf.numpages,1);assert.match(pdf.text,/Филадельфия/);assert.match(pdf.text,/ПРОЕКТ ТТК/);assert.match(pdf.text,/19,3/);assert.match(pdf.text,/Масса БРУТТО/);assert.match(pdf.text,/7\. Пищевая ценность/);
});
test('Long technology and ingredient tables fit one A4 without truncating content',async()=>{
 const out=await bytes({name:'Длинная карта',preparation:'Подготовка сырья. '.repeat(1000),ingredients:Array.from({length:60},(_,i)=>({name:'Ингредиент '+i,grams:10,grossGrams:12})),taste:'Последний блок проверки'});const pdf=await parsePdf(out);assert.equal(pdf.numpages,1);assert.match(pdf.text,/Ингредиент 59/);assert.match(pdf.text,/Последний блок проверки/);assert.match(pdf.text,/4282-26/);
});
test('Download rejects unknown recipes instead of rendering a different card',async()=>{
 let handler;installRecipePdfApi({post(){},get(_,fn){handler=fn}},{store:{state:async()=>({recipes:[]})}});let status;await handler({params:{id:'missing'}},{status(n){status=n;return this},json(){}});assert.equal(status,404);
});

test('Blue category templates fit one A4 page and preserve storage, scope and safety',async()=>{
 for(const category of ['Холодные роллы','Запечённые роллы','Темпурные роллы','Маки-роллы','Гунканы','Суши','Воки','Беридоги']){
  const template=templateFor(category,8);
  const r={...template,name:'Филадельфия',category,scope:template.scope.replace('{name}','Филадельфия'),status:'draft',cardNumber:'001',cardDate:'2026-10-14',netYieldGrams:250,pieces:8,nutrition:{protein:7,fat:10,carbs:20,kcal:198},ingredients:[{name:'Рис готовый',grams:130,grossGrams:130},{name:'Лосось',grams:60,grossGrams:70},{name:'Сыр сливочный',grams:40,grossGrams:40},{name:'Огурец',grams:18,grossGrams:20},{name:'Нори',grams:2,grossGrams:2}]};
  const saved=cleanState({recipes:[r]}).recipes[0];assert.equal(saved.scope,r.scope);assert.equal(saved.safety,r.safety);
  const pdf=await parsePdf(await bytes(saved));assert.equal(pdf.numpages,1,category);assert.match(pdf.text,/Область применения/);assert.match(pdf.text,/утверждённым данным предприятия/);assert.match(pdf.text,/4282-26/);
 }
});
test('Automatic card metadata uses Moscow date and skips existing numbers',()=>{assert.equal(cardDateNow(new Date('2026-10-14T22:30:00Z')),'2026-10-15');assert.equal(nextCardNumber([{cardNumber:'001'},{cardNumber:'003'}]),'002')});

