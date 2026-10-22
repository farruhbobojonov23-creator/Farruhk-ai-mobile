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

test('Sushi staples resolve aliases and produce a complete roll calculation',()=>{
 for(const name of ['Нори','ТОБИККО','икра масаго','угорь','Унаги','соус-терияки','Панко','Креветки варёные','кунжут']){
  const result=lookupGenericNutrition(name);
  assert.ok(result,name);
  assert.equal(result.origin,'reference');
  assert.ok(result.sourceUrl.startsWith('https://'));
  assert.ok(Object.values(result.nutrition).every(n=>Number.isFinite(n)&&n>=0));
 }
 const ingredients=[['рис готовый',150],['нори',3],['угорь',40],['соус унаги',10]].map(([name,grams])=>({name,grams,grossGrams:grams,nutrition:lookupGenericNutrition(name).nutrition}));
 const result=calculateNutritionBoth(ingredients,203);
 assert.ok(Math.abs(result.perPortion.kcal-351.14)<0.00001);
 assert.ok(Math.abs(result.per100.kcal-351.14/203*100)<0.000001);
 ingredients.push({name:'Неизвестный соус',grams:10,grossGrams:10});
 assert.equal(calculateNutritionBoth(ingredients,213),null);
});

test('Preparation, brands and unknown foods are not silently substituted',()=>{
 for(const name of ['креветки сырые','угорь сырой','соус спайси домашний','рис сухой','рис заправленный для суши','нори марки XYZ'])assert.equal(lookupGenericNutrition(name),null,name);
 assert.equal(lookupGenericNutrition('соус унаги').id,lookupGenericNutrition('унаги').id);
 assert.notEqual(lookupGenericNutrition('угорь').id,lookupGenericNutrition('унаги').id);
 assert.notEqual(lookupGenericNutrition('кунжут').id,lookupGenericNutrition('кунжут жареный').id);
});
