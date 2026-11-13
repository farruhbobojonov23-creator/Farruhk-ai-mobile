import test from 'node:test';
import assert from 'node:assert/strict';
import {premiumRecipePdf} from '../recipe-premium-pdf.js';
import {templateFor} from '../public/recipe-math.js';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';

const bytes=doc=>new Promise((resolve,reject)=>{
 const chunks=[];doc.on('data',b=>chunks.push(b));doc.on('error',reject);
 doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.end();
});
const base=category=>({
 ...templateFor(category,8),name:'Филадельфия (проверка макета)',
 category,cardNumber:'001',cardDate:'2026-11-13',status:'draft',
 pieces:8,netYieldGrams:260,chef:'Шеф',approver:'Руководитель',
 nutritionMode:'manual',nutrition:{protein:8,fat:11,carbs:22,kcal:219}
});
for(const [size,category] of [[5,'Холодные роллы'],[12,'Запечённые роллы'],[20,'Темпурные роллы']]){
 for(const layoutTemplate of ['arctic-a4','royal-a4']){
  test('A4 scale diagnostics '+layoutTemplate+' '+size+' rows',async()=>{
   const recipe={...base(category),layoutTemplate,
    ingredients:Array.from({length:size},(_,i)=>({name:'Ингредиент '+(i+1),
       grams:10,grossGrams:10,nutritionOrigin:'manual'})),netYieldGrams:size*10};
   const doc=premiumRecipePdf(recipe),scale=doc.ttkLayoutScale;
   const pdf=await parsePdf(await bytes(doc));
   console.log('TTK_PDF_LEGIBILITY '+JSON.stringify({layoutTemplate,ingredients:size,scale,pageCount:pdf.numpages}));
   assert.equal(pdf.numpages,1);
   assert.match(pdf.text,new RegExp('Ингредиент '+size));
   assert.ok(scale>=0.74&&scale<=1,'Premium A4 must not silently shrink below the readable threshold');
  });
 }
}

test('long premium cards show a clear 422 validation instead of unreadable micro-print',()=>{
 const huge={...base('Холодные роллы'),layoutTemplate:'royal-a4',
  ingredients:Array.from({length:75},(_,i)=>({name:'Ингредиент '+(i+1),grams:10,grossGrams:10})),
  netYieldGrams:750};
 assert.throws(()=>premiumRecipePdf(huge),error=>
  error?.status===422&&error.code==='TTK_A4_TOO_DENSE'&&/один читаемый лист/.test(error.message));
});
test('mismatched declared yield stays unchanged and is flagged for human review',async()=>{
 const draft={...base('Холодные роллы'),layoutTemplate:'arctic-a4',
  ingredients:[{name:'Рис',grams:100,grossGrams:100}],netYieldGrams:150};
 const pdf=premiumRecipePdf(draft);
 assert.ok(pdf.ttkWarnings.some(x=>x.startsWith('ПРОВЕРЬ ВЫХОД')));
 const output=await parsePdf(await bytes(pdf));
 assert.match(output.text,/150 г/);
 assert.match(output.text,/сумма нетто/);
});
