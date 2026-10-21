import test from 'node:test';
import assert from 'node:assert/strict';
import {lookupGenericNutrition,normalizeNutritionName} from '../public/nutrition-catalog.js';
import {calculateNutritionBoth,nutritionReference} from '../public/recipe-math.js';
import {cleanState} from '../assistant-store.js';

test('Screenshot foods сыр творожный and лосось auto-resolve without manual numbers',()=>{
 const cheese=lookupGenericNutrition('Сыр творожный');
 const salmon=lookupGenericNutrition('Лосось');
 assert.ok(cheese&&salmon);
 assert.equal(cheese.nutrition.kcal,337);
 assert.equal(salmon.nutrition.protein,20.4);
 assert.equal(cheese.origin,'reference');
 assert.match(salmon.source,/USDA FoodData Central/);
 const ingredients=[
  {name:'Сыр творожный',grams:300,grossGrams:300,nutrition:cheese.nutrition,nutritionOrigin:'reference'},
  {name:'Лосось',grams:300,grossGrams:300,nutrition:salmon.nutrition,nutritionOrigin:'reference'}
 ];
 const both=calculateNutritionBoth(ingredients,600);
 assert.deepEqual(both.per100,{protein:13.095,fat:23.445,carbs:2.28,kcal:272.5});
 assert.deepEqual(both.perPortion,{protein:78.57,fat:140.67,carbs:13.68,kcal:1635});
 const stored=cleanState({recipes:[{name:'Тестовая ТТК',ingredients,nutritionMode:'ingredients',netYieldGrams:600}]}).recipes[0];
 assert.ok(stored.ingredients.every(i=>i.nutritionOrigin==='reference'),'estimated source remains visible after save');
 assert.equal(nutritionReference([stored]).size,0,'generic source must not masquerade as verified label value');
});
test('Generic aliases are whitespace/case normalized; smoked fish and seasoned rice remain unknown',()=>{
 assert.equal(normalizeNutritionName('  СЫР   ТВОрожный '),'сыр творожный');
 assert.ok(lookupGenericNutrition('  СЫР   ТВОрожный '));
 assert.ok(lookupGenericNutrition('рис отварной'));
 assert.ok(lookupGenericNutrition('огурцы свежие'));
 assert.ok(lookupGenericNutrition('авокадо'));
 assert.equal(lookupGenericNutrition('лосось копчёный'),null);
 assert.equal(lookupGenericNutrition('рис заправленный для суши'),null);
 assert.equal(lookupGenericNutrition('сыр творожный марки XYZ'),null);
});
