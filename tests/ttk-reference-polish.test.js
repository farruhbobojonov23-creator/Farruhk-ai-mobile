import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';
import {recipePdf} from '../recipe-pdf.js';
import {TTK_LAYOUTS} from '../public/ttk-layouts.js';

const source=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const data=doc=>new Promise((resolve,reject)=>{
 const chunks=[];doc.on('data',c=>chunks.push(c));doc.on('error',reject);
 doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.end();
});
const recipe={
 name:'Филадельфия классик',category:'Холодные роллы',
 cardNumber:'001',cardDate:'2026-11-15',status:'draft',
 pieces:8,netYieldGrams:270,chef:'Фаррух Ака',approver:'Бободжонов А.',
 scope:'Ролл для реализации в предприятии общественного питания.',
 rawRequirements:'Принимать сырьё по документам и маркировке.',
 preparation:'Подготовить рис, нори, рыбу и огурец.',
 forming:'Разложить рис и сыр. Собрать и сформовать ролл.',
 serving:'Нарезать на 8 частей. Подавать охлаждённым.',
 storage:'Температура +2…+6 °C. Срок годности 12 часов.',
 appearance:'Ровная форма. Аккуратная нарезка.',
 taste:'Свежий вкус без посторонних запахов.',
 safety:'Контроль сырья. Контроль температуры хранения. Контроль сроков.',
 nutritionMode:'manual',nutrition:{protein:6.6,fat:8.9,carbs:20,kcal:188.3},
 ingredients:[
  {name:'Рис готовый',grossGrams:120,grams:120},
  {name:'Нори',grossGrams:1.5,grams:1.5},
  {name:'Лосось',grossGrams:60,grams:60},
  {name:'Сыр творожный',grossGrams:50,grams:50},
  {name:'Огурец свежий',grossGrams:40,grams:38.5}
 ]};
test('owner reference #03 has golden numbering and #04 has gold allergens, not navy',async()=>{
 const a=TTK_LAYOUTS.find(x=>x.id==='gold-allergen'),b=TTK_LAYOUTS.find(x=>x.id==='premium-blue');
 assert.match(a.name,/Золотая нумерация/);
 assert.match(b.name,/Золотые аллергены/);
 const [css,pdf]=await Promise.all([source('public/ttk-reference-polish.css'),source('recipe-four-layout-pdf.js')]);
 assert.match(css,/\.ttk-live-page\[data-ttk-layout="premium-blue"\]/);
 assert.match(css,/--live-deep:#004F49/);
 assert.match(pdf,/'premium-blue':\{navy:'#004B48',band:'#00756B'/);
 assert.match(pdf,/const recipeW=W\*\(layout==='premium-blue'\?\.54:\.60\)/);
 assert.match(css,/font:900 23\.5px/);
 assert.match(css,/font:500 11\.1px\/15px/);
});

for(const layoutTemplate of ['teal-matrix','process-matrix','gold-allergen','premium-blue']){
 test(layoutTemplate+' retains all ingredients and readable date on one A4',async()=>{
  const doc=recipePdf({...recipe,layoutTemplate});
  const parsed=await parsePdf(await data(doc));
  const extracted=parsed.text.replace(/\s+/g,' ');
  assert.equal(parsed.numpages,1);
  assert.ok(doc.ttkLayoutScale>=.74);
  for(const phrase of ['Филадельфия классик','FARRUH AI','Premium','15.11.2026',
   'Рис готовый','Сыр творожный','Лосось','Бободжонов А.'])
   assert.ok(extracted.includes(phrase),'missing '+phrase);
  if(layoutTemplate==='premium-blue'){
   assert.match(extracted,/АЛЛЕРГЕНЫ В БЛЮДЕ/);
   assert.doesNotMatch(extracted,/3\. Рецептура \(норма закладки\)/);
  }
  if(layoutTemplate==='gold-allergen'){
   assert.match(extracted,/МАТРИЦА АЛЛЕРГЕНОВ/);
   assert.match(extracted,/4/);
  }
 });
}
