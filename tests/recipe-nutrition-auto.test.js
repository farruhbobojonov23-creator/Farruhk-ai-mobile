import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateNutrition,calculateNutritionBoth,nutritionOnPortion,nutritionMissing,nutritionReference}
 from '../public/recipe-math.js';

const rice={name:'Рис готовый',grossGrams:150,grams:150,
 nutrition:{protein:3,fat:1,carbs:30,kcal:140}};
const fish={name:'Лосось',grossGrams:65,grams:50,lossPercent:23.076923,
 nutrition:{protein:20,fat:10,carbs:0,kcal:170}};

test('TTK automatically calculates accurate KBJU per 100 g and per 200 g portion',()=>{
 const nutrition=calculateNutritionBoth([rice,fish],200);
 assert.ok(nutrition);
 assert.deepEqual(nutrition.per100,{protein:7.25,fat:3.25,carbs:22.5,kcal:147.5});
 assert.deepEqual(nutrition.perPortion,{protein:14.5,fat:6.5,carbs:45,kcal:295});
 assert.deepEqual(calculateNutrition([rice,fish],200),nutrition.per100);
});

test('Manual 100 g nutrition also recalculates automatically for different portions',()=>{
 const base={protein:5,fat:3,carbs:20,kcal:127};
 assert.deepEqual(nutritionOnPortion(base,240),{protein:12,fat:7.2,carbs:48,kcal:304.8});
 assert.equal(nutritionOnPortion(base,0),null);
});

test('Missing ingredient KBJU remains missing with clear diagnostic, never invented',()=>{
 const incomplete={...fish,nutrition:{protein:20,fat:10,carbs:null,kcal:null}};
 assert.equal(calculateNutritionBoth([rice,incomplete],200),null);
 assert.match(nutritionMissing([rice,incomplete],200).join(' '),/Лосось: нет углеводов, ккал/);
 assert.equal(nutritionOnPortion({protein:5,fat:null,carbs:20,kcal:100},150),null);
});

test('Existing saved TTK ingredients reuse complete nutrient references conservatively',()=>{
 const recipes=[{ingredients:[rice,fish]},{ingredients:[{...rice,name:'  РИС   ГОТОВЫЙ '}]}];
 const reference=nutritionReference(recipes);
 assert.deepEqual(reference.get('рис готовый'),rice.nutrition);
 assert.deepEqual(reference.get('лосось'),fish.nutrition);
 const conflicting={...fish,nutrition:{...fish.nutrition,kcal:171}};
 assert.equal(nutritionReference([{ingredients:[fish,conflicting]}]).has('лосось'),false);
 assert.equal(nutritionReference([{ingredients:[{name:'Нори',nutrition:{protein:40}}]}]).has('нори'),false);
});
