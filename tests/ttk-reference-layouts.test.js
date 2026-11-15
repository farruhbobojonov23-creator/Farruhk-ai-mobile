import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';
import {recipePdf} from '../recipe-pdf.js';
const bytes=doc=>new Promise((resolve,reject)=>{
 const parts=[];doc.on('data',v=>parts.push(v));doc.on('error',reject);
 doc.on('end',()=>resolve(Buffer.concat(parts)));doc.end();
});
const base={
 id:'reference-card',name:'Филадельфия классик',category:'Холодные роллы',
 cardNumber:'001',cardDate:'2026-11-15',status:'draft',pieces:8,netYieldGrams:269.5,
 chef:'Фаррух Ака',approver:'Бободжонов А.',
 scope:'Настоящая карта применяется к конкретному готовому роллу.',
 rawRequirements:'Рыбу, рис и молочные продукты проверяют по документам и этикеткам.',
 preparation:'Подготовить рис, нори, лосось, творожный сыр и огурец.',
 forming:'Распределить рис на нори. Уложить сыр и огурец. Сформовать ролл и накрыть лососем.',
 serving:'Нарезать на восемь кусочков. Подать без дополнительного нагрева.',
 storage:'Хранить при +2…+6 °C. Срок годности 12 часов после изготовления.',
 appearance:'Ролл ровный, нарезка аккуратная.',
 taste:'Свойственный продуктам, без посторонних запахов.',
 safety:'Проверять поставщика и сроки. Контролировать температуру хранения. Следить за маркировкой.',
 nutritionMode:'manual',nutrition:{protein:6.6,fat:8.9,carbs:20,kcal:188.3},
 ingredients:[{name:'Рис для суши готовый',grossGrams:120,grams:120},
  {name:'Нори',grossGrams:1.5,grams:1.5},{name:'Лосось',grossGrams:60,grams:60},
  {name:'Сыр творожный',grossGrams:50,grams:50},{name:'Огурец свежий',grossGrams:40,grams:38}]
};
test('A4 screen layouts use real data fields in four unique groups',async()=>{
 const [script,css,html]=await Promise.all([
  readFile(new URL('../public/ttk-reference-layouts.js',import.meta.url),'utf8'),
  readFile(new URL('../public/ttk-reference-layouts.css',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8')
 ]);
 for(const id of ['teal-matrix','process-matrix','gold-allergen','premium-blue'])
  assert.ok(script.includes(id)&&css.includes(id));
 assert.match(script,/function arrange\(value\)/);
 assert.match(script,/duoProcess\.append\(process,quality\)/);
 assert.match(script,/qualityPair\.append\(quality,conditions,nutrition\)/);
 assert.match(script,/function update\(\)/);
 assert.match(script,/get\('card-storage'\)/);
 assert.match(script,/get\('card-yield'\)/);
 assert.match(script,/get\('card-protein'\)/);
 assert.match(html,/ttk-reference-layouts\.css\?v=1/);
});
for(const [layout,required] of [
 ['teal-matrix',['4. ТЕХНОЛОГИЯ ПРИГОТОВЛЕНИЯ','5. КОНТРОЛЬ КАЧЕСТВА','12 часов']],
 ['process-matrix',['ТЕХНОЛОГИЧЕСКИЙ ПРОЦЕСС ПРИГОТОВЛЕНИЯ','Критические точки','Контроль','Результат','СТАНДАРТЫ КАЧЕСТВА']],
 ['gold-allergen',['5. ТЕХНОЛОГИЯ ПРИГОТОВЛЕНИЯ','6. КОНТРОЛЬ КАЧЕСТВА','9. БЕЗОПАСНОСТЬ']],
 ['premium-blue',['АЛЛЕРГЕНЫ В БЛЮДЕ','ТЕХНОЛОГИЯ ПРИГОТОВЛЕНИЯ','ПИЩЕВАЯ ЦЕННОСТЬ']]
]){
 test(layout+' exports independently structured vector A4 preserving user recipe',async()=>{
  const doc=recipePdf({...base,layoutTemplate:layout});
  const pdf=await parsePdf(await bytes(doc));
  assert.equal(pdf.numpages,1);
  assert.ok(doc.ttkLayoutScale>=.74,'unreadable export scale: '+doc.ttkLayoutScale);
  for(const phrase of required)assert.ok(pdf.text.includes(phrase),'missing '+phrase);
  for(const phrase of ['FARRUH AI','Premium','Филадельфия классик',
   'Рис для суши готовый','Огурец свежий','Фаррух Ака','Бободжонов А.',
   '6,6','8,9','12 часов','15.11.2026'])
   assert.ok(pdf.text.includes(phrase),'lost recipe content '+phrase);
  assert.ok(pdf.text.includes('Формовка')&&pdf.text.includes('Сборка'));
 });
}
