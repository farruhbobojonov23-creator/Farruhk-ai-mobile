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
   assert.ok(scale>0&&scale<=1);
  });
 }
}
