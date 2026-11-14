import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';
import {premiumRecipePdf} from '../recipe-premium-pdf.js';
import {templateFor} from '../public/recipe-math.js';

const text=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const bytes=doc=>new Promise((resolve,reject)=>{
 const parts=[];doc.on('data',b=>parts.push(b));doc.on('error',reject);
 doc.on('end',()=>resolve(Buffer.concat(parts)));doc.end();
});
test('FARRUH AI approved mockup styles are loaded without changing print rules',async()=>{
 const html=await text('public/index.html');
 const card=await text('public/luxury-ui.js');
 const sheet=await text('public/recipe-sheet.js');
 const css=await text('public/ttk-royal-approved-ui.css');
 const preview=await text('public/ttk-premium-blue-a4-preview.css');
 assert.match(html,/ttk-royal-approved-ui\.css\?v=1/);
 assert.match(html,/ttk-premium-blue-a4-preview\.css\?v=1/);
 assert.match(card,/lx-recipe-cloud/);
 assert.match(card,/lx-card-menu/);
 assert.match(sheet,/ttk-document-brand/);
 assert.match(sheet,/ttk-document-namebar/);
 assert.match(sheet,/ttk-recipe-totals/);
 assert.match(css,/data-pf-theme="royal"/);
 assert.match(css,/data-section="3"/);
 assert.match(css,/data-section="7"/);
 assert.match(css,/object-fit:contain!important/);
 assert.match(preview,/data-mode="paper"/);
 assert.doesNotMatch(css,/@media print/);
});
test('approved premium A4 is one real vector PDF and preserves all recipe content',async()=>{
 const recipe={
  ...templateFor('Холодные роллы',8),
  name:'Тест 1',category:'Холодные роллы',cardNumber:'001',cardDate:'2026-11-15',
  status:'ready',layoutTemplate:'arctic-a4',pieces:8,netYieldGrams:270,
  chef:'Фаррух',approver:'Бободжонов',nutritionMode:'manual',
  nutrition:{protein:6.565,fat:8.859,carbs:19.97,kcal:188.333},
  ingredients:[['сыр творожный',50],['лосось',50],['терияки соус',50],['рис готовый',120]]
    .map(([name,grams])=>({name,grams,grossGrams:grams,lossPercent:0}))
 };
 const doc=premiumRecipePdf(recipe);
 assert.ok(doc.ttkLayoutScale>=.74);
 const data=await bytes(doc);
 assert.doesNotMatch(data.toString('latin1'),/\/Subtype\s*\/Image/);
 const pdf=await parsePdf(data);
 assert.equal(pdf.numpages,1);
 for(const token of ['FARRUH AI','ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ КАРТА',
  'Тест 1','сыр творожный','лосось','терияки соус','рис готовый','Разработал','Утверждаю','Бободжонов'])
   assert.ok(pdf.text.includes(token),'missing '+token);
 assert.ok(pdf.text.includes('270'));
});
