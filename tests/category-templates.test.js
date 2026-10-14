import test from 'node:test';
import assert from 'node:assert/strict';
import {recipeCategories,templateFor,legacyTemplateFor,resolveCategoryFields,categoryTextFields} from '../public/recipe-math.js';
test('Each category has its own preparation, cooking, service and quality descriptions',()=>{
 for(const key of categoryTextFields)assert.equal(new Set(recipeCategories.map(c=>templateFor(c)[key])).size,8,key);
 assert.match(templateFor('Темпурные роллы').forming,/Обжаривают/);
 assert.match(templateFor('Запечённые роллы').forming,/Запекают/);
 assert.match(templateFor('Воки').forming,/воке/);
 assert.match(templateFor('Маки-роллы').forming,/нори наружу/);
 assert.match(templateFor('Суши').serving,/без нарезки/);
 assert.match(templateFor('Гунканы').forming,/бортиком/);
});
test('Known cold-roll defaults upgrade for an existing tempura card; custom edits survive',()=>{
 const recipe={...legacyTemplateFor('Холодные роллы',4),category:'Темпурные роллы',pieces:4,taste:'Мой вкус'};
 const updated=resolveCategoryFields(recipe);
 assert.equal(updated.forming,templateFor(recipe.category,4).forming);
 assert.equal(updated.technology,updated.forming);
 assert.match(updated.serving,/4 равных/);
 assert.equal(updated.taste,'Мой вкус');
 assert.match(updated.appearance,/корочка/);
 assert.deepEqual(resolveCategoryFields(updated),updated);
});
test('One whole roll never says cut into one equal part; all quantities are retained',()=>{
 for(const category of recipeCategories){
  assert.doesNotMatch(templateFor(category,1).serving,/1 равных/);
  for(const count of [1,4,6,8])assert.match(templateFor(category,count).serving,new RegExp(String(count)));
 }
});
test('Storage templates do not invent a universal shelf life or cold regime for hot dishes',()=>{
 for(const category of recipeCategories)assert.doesNotMatch(templateFor(category).storage,/12 часов|\+2/);
});
