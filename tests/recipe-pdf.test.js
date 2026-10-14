import test from 'node:test';
import assert from 'node:assert/strict';
import parsePdf from 'pdf-parse';
import {cleanState} from '../assistant-store.js';
import {recipePdf,installRecipePdfApi} from '../recipe-pdf.js';
const bytes=r=>new Promise((resolve,reject)=>{const chunks=[],doc=recipePdf(r);doc.on('data',b=>chunks.push(b));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.end()});
test('Recipe metadata survives saves; unknown gross mass and nutrition stay unknown',()=>{
 const recipe={name:'Филадельфия',cardNumber:'001',netYieldGrams:275,pieces:8,nutrition:{protein:7,fat:0},ingredients:[{name:'Рис',grams:130}],storage:'Утверждённые условия',preparation:'Подготовка'};
 const saved=cleanState({recipes:[recipe]}).recipes[0];assert.equal(saved.netYieldGrams,275);assert.equal(saved.cardNumber,'001');assert.equal(saved.ingredients[0].grossGrams,null);assert.equal(saved.nutrition.carbs,null);assert.equal(saved.nutrition.fat,0);assert.equal(saved.storage,recipe.storage);
});
test('PDF preserves Cyrillic and the six sections; missing values are marked as a draft',async()=>{
 const out=await bytes({name:'Филадельфия',status:'ready',ingredients:[{name:'Рис',grams:130,grossGrams:null}],netYieldGrams:275,nutrition:{protein:7}});const pdf=await parsePdf(out);assert.equal(pdf.numpages,1);assert.match(pdf.text,/Филадельфия/);assert.match(pdf.text,/ПРОЕКТ ТТК/);assert.match(pdf.text,/19,3/);assert.match(pdf.text,/Масса БРУТТО/);assert.match(pdf.text,/6\. Пищевая ценность/);
});
test('Long technology and ingredient tables paginate without silently truncating content',async()=>{
 const out=await bytes({name:'Длинная карта',preparation:'Подготовка сырья. '.repeat(1000),ingredients:Array.from({length:60},(_,i)=>({name:'Ингредиент '+i,grams:10,grossGrams:12})),taste:'Последний блок проверки'});const pdf=await parsePdf(out);assert.ok(pdf.numpages>1);assert.match(pdf.text,/Ингредиент 59/);assert.match(pdf.text,/Последний блок проверки/);assert.match(pdf.text,/Страница/);
});
test('Download rejects unknown recipes instead of rendering a different card',async()=>{
 let handler;installRecipePdfApi({get(_,fn){handler=fn}},{store:{state:async()=>({recipes:[]})}});let status;await handler({params:{id:'missing'}},{status(n){status=n;return this},json(){}});assert.equal(status,404);
});
