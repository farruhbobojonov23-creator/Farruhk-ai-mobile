import test from 'node:test';
import assert from 'node:assert/strict';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';
import {filledIngredientRows,netYield,calculateNutritionBoth} from '../public/recipe-math.js';
import {recipeAllergenMatrix,validAllergenOverrides} from '../public/ttk-allergens.js';
import {cleanState} from '../assistant-store.js';
import {recipePdf} from '../recipe-pdf.js';

const buffer=doc=>new Promise((resolve,reject)=>{
 const parts=[];doc.on('data',x=>parts.push(x));doc.on('error',reject);
 doc.on('end',()=>resolve(Buffer.concat(parts)));doc.end();
});

test('extra fully blank mobile input row cannot blank calculated yield or nutrition',()=>{
 const ingredients=filledIngredientRows([
  {name:'Сыр творожный',grams:50,grossGrams:50,nutrition:{protein:6,fat:30,carbs:4,kcal:310}},
  {name:'Яйцо',grams:70,grossGrams:70,nutrition:{protein:13,fat:11,carbs:1,kcal:155}},
  {name:'',grams:null,grossGrams:null,nutrition:{protein:null,fat:null,carbs:null,kcal:null}}
 ]);
 assert.equal(ingredients.length,2);
 assert.equal(netYield(ingredients),120);
 const calculated=calculateNutritionBoth(ingredients,120);
 assert.ok(calculated);
 assert.equal(calculated.weightGrams,120);
 assert.ok(calculated.per100.kcal>0);
});

test('partly filled rows are NOT skipped and cannot create fabricated nutrition',()=>{
 const ingredients=filledIngredientRows([
  {name:'Сыр творожный',grams:50,grossGrams:50,nutrition:{protein:6,fat:30,carbs:4,kcal:310}},
  {name:'Яйцо',grams:null,grossGrams:null}
 ]);
 assert.equal(ingredients.length,2);
 assert.equal(netYield(ingredients),null);
 assert.equal(calculateNutritionBoth(ingredients,50),null);
});

test('allergen manual checks retain tri-state semantics and survive normalization',()=>{
 const saved=cleanState({recipes:[{
  name:'Сыр и яйцо',category:'Закуски',
  ingredients:[{name:'Сыр творожный',grams:50,grossGrams:50},{name:'Яйцо',grams:70,grossGrams:70}],
  allergenOverrides:{egg:false,soy:true,notAGroup:true,nuts:'false'}
 }]}).recipes[0];
 assert.deepEqual(saved.allergenOverrides,{egg:false,soy:true});
 assert.deepEqual(validAllergenOverrides(saved.allergenOverrides),{egg:false,soy:true});
 const m=recipeAllergenMatrix(saved);
 assert.equal(m.groups.find(g=>g.id==='egg').checked,false);
 assert.equal(m.groups.find(g=>g.id==='egg').possible,true);
 assert.equal(m.groups.find(g=>g.id==='milk').checked,true);
 assert.equal(m.groups.find(g=>g.id==='soy').checked,true);
 assert.equal(m.groups.find(g=>g.id==='soy').manual,true);
 assert.equal(m.hasUnverified,true);
});

test('four-layout PDF exports the manually adjusted matrix on one A4',async()=>{
 const input={
  name:'Сыр и яйцо',category:'Закуски',cardNumber:'002',cardDate:'2026-11-15',
  status:'draft',pieces:8,netYieldGrams:120,layoutTemplate:'gold-allergen',
  ingredients:[{name:'Сыр творожный',grams:50,grossGrams:50},{name:'Яйцо',grams:70,grossGrams:70}],
  allergenOverrides:{egg:false,soy:true},
  scope:'Пробная карта',rawRequirements:'Проверить этикетки',
  preparation:'Подготовить компоненты',forming:'Смешать компоненты',
  serving:'Подать порцию',storage:'По утверждённым условиям',
  appearance:'Обычный внешний вид',taste:'Свойственный',
  safety:'Требуется контроль ХАССП',chef:'Шеф',approver:'Руководитель',
  nutritionMode:'manual',nutrition:{protein:9,fat:20,carbs:3,kcal:250}
 };
 const pdf=recipePdf(cleanState({recipes:[input]}).recipes[0]);
 assert.ok(pdf.ttkLayoutScale>=.74);
 assert.equal(pdf.ttkAllergenMatrix.groups.find(g=>g.id==='soy').checked,true);
 assert.equal(pdf.ttkAllergenMatrix.groups.find(g=>g.id==='egg').checked,false);
 const text=await parsePdf(await buffer(pdf));
 assert.equal(text.numpages,1);
 assert.match(text.text,/МАТРИЦА АЛЛЕРГЕНОВ|АЛЛЕРГЕНЫ В БЛЮДЕ/);
 assert.match(text.text,/Молоко/);
 assert.match(text.text,/Соя/);
});
