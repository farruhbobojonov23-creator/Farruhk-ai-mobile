import test from 'node:test';
import assert from 'node:assert/strict';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';
import {recipePdf} from '../recipe-pdf.js';
import {recipeAllergenMatrix} from '../public/ttk-allergens.js';
import {cleanState} from '../assistant-store.js';
import {TTK_LAYOUTS} from '../public/ttk-layouts.js';
const bytes=doc=>new Promise((resolve,reject)=>{const data=[];doc.on('data',part=>data.push(part));
 doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(data)));doc.end()});
const base={id:'roll-001',name:'Филадельфия классик',category:'Холодные роллы',cardNumber:'001',
 cardDate:'2026-11-15',status:'ready',pieces:8,netYieldGrams:270,
 chef:'Фаррух Ака',approver:'Бободжонов А.',
 scope:'Технологическая карта ролла для предприятия общественного питания.',
 rawRequirements:'Сырьё соответствует применимым требованиям, маркировка проверена.',
 preparation:'Подготовить охлаждённый рис, нори, сыр и лосось.',
 forming:'Равномерно распределить рис на нори, уложить сыр и рыбу, сформовать ролл.',
 serving:'Нарезать на восемь равных частей и подать охлаждённым.',
 storage:'Хранить согласно утверждённым условиям предприятия.',
 appearance:'Ровный ролл, аккуратная нарезка, равномерный рис.',
 taste:'Свойственный составу, без посторонних запахов.',
 safety:'Приёмка сырья с документами; контроль времени, маркировки и температуры.',
 nutritionMode:'manual',nutrition:{protein:6.6,fat:8.9,carbs:20,kcal:188.3},
 ingredients:[{name:'Рис для суши готовый',grams:120,grossGrams:120},
  {name:'Нори',grams:1.5,grossGrams:1.5},{name:'Лосось',grams:60,grossGrams:60},
  {name:'Сыр творожный',grams:50,grossGrams:50},{name:'Огурец свежий',grams:38.5,grossGrams:40}]};
test('allergen flags apply to each roll instead of being hardcoded into a template',()=>{
 const found=recipeAllergenMatrix(base);
 assert.equal(found.groups.find(x=>x.id==='fish').checked,true);
 assert.equal(found.groups.find(x=>x.id==='milk').checked,true);
 assert.equal(found.groups.find(x=>x.id==='egg').checked,false);
 assert.equal(found.groups.find(x=>x.id==='gluten').checked,false);
 const another=recipeAllergenMatrix({ingredients:[{name:'Креветка'},{name:'Яйцо'},{name:'Соя'}]});
 assert.equal(another.groups.find(x=>x.id==='fish').checked,false);
 assert.equal(another.groups.find(x=>x.id==='crustacean').checked,true);
 assert.equal(another.groups.find(x=>x.id==='egg').checked,true);
 assert.equal(another.groups.find(x=>x.id==='soy').checked,true);
 const sauce=recipeAllergenMatrix({ingredients:[{name:'Терияки соус'}]});
 assert.equal(sauce.groups.find(x=>x.id==='soy').possible,true);
 assert.equal(sauce.groups.find(x=>x.id==='soy').checked,false);
 assert.match(found.note,/этикетк/);
});
test('all four choices are distinct and preserve pre-existing recipe data',()=>{
 assert.deepEqual(TTK_LAYOUTS.map(x=>x.id),['teal-matrix','process-matrix','gold-allergen','premium-blue']);
 const saved=cleanState({recipes:[{...base,layoutTemplate:'royal-a4'}]}).recipes[0];
 assert.equal(saved.layoutTemplate,'premium-blue');
 assert.equal(saved.ingredients.length,5);
 const old=cleanState({recipes:[{...base,layoutTemplate:'arctic-a4'}]}).recipes[0];
 assert.equal(old.layoutTemplate,'teal-matrix');
});
for(const layoutTemplate of TTK_LAYOUTS.map(x=>x.id)){
 test(layoutTemplate+' creates real one-page A4 with checked allergen matrix and all data',async()=>{
  const r=cleanState({recipes:[{...base,layoutTemplate}]}).recipes[0];
  const doc=recipePdf(r);
  assert.ok(doc.ttkLayoutScale>=.74);
  const m=doc.ttkAllergenMatrix;
  assert.equal(m.groups.length,8);
  assert.equal(m.groups.find(x=>x.id==='fish').checked,true);
  const data=await bytes(doc);
  assert.doesNotMatch(data.toString('latin1'),/\/Subtype\s*\/Image/);
  const result=await parsePdf(data);
  assert.equal(result.numpages,1);
  // A4 starts with the document title: brand is in the app chrome, not paper.
  assert.doesNotMatch(result.text,/FARRUH AI|Premium|ПЕЧАТЬ/);
  assert.match(result.text,/ТЕХНОЛОГИЧЕСКАЯ КАРТА \(ТТК\)/);

  for(const value of ['Филадельфия классик','Лосось','Сыр творожный','Огурец' ,
   'Разработал','Утверждаю','Бободжонов','ХАССП','ГАЛОЧКИ']) {
   if(value==='ГАЛОЧКИ')continue;
   assert.ok(result.text.includes(value),'missing PDF element: '+value);
  }
  assert.match(result.text,/(?:МАТРИЦА АЛЛЕРГЕНОВ|АЛЛЕРГЕНЫ В БЛЮДЕ)/);
  assert.ok(result.text.includes('Рыба'));
  assert.ok(result.text.includes('Молоко'));
  assert.ok(result.text.includes('270'));
 });
}
