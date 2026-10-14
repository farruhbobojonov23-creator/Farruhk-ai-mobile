import test from 'node:test';
import assert from 'node:assert/strict';
import {grossFromNet,calculateNutrition} from '../public/recipe-math.js';
import {cleanState} from '../assistant-store.js';
test('gross conversion handles losses and rejects unknown or impossible loss',()=>{assert.equal(grossFromNet(80,20),100);assert.equal(grossFromNet(80,0),80);assert.equal(grossFromNet(80,100),null);assert.equal(grossFromNet('',0),null)});
test('nutrition excludes waste and uses finished yield; zero values survive',()=>{const i={name:'Продукт',grams:80,grossGrams:100,lossPercent:20,nutrition:{protein:10,fat:0,carbs:20,kcal:120}};const saved=cleanState({recipes:[{name:'Ролл',nutritionMode:'ingredients',ingredients:[i]}]}).recipes[0];assert.equal(saved.nutritionMode,'ingredients');assert.equal(saved.ingredients[0].lossPercent,20);assert.deepEqual(calculateNutrition(saved.ingredients,160),{protein:5,fat:0,carbs:10,kcal:60});assert.equal(calculateNutrition([{...i,nutrition:{protein:10}}],160),null);assert.equal(calculateNutrition([i],null),null)});
