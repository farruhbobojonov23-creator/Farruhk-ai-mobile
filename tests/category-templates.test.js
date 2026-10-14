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
test('Wok quality and preparation describe noodles instead of rice or filling',()=>{
 const t=templateFor('Воки');
 for(const key of ['preparation','forming','appearance','taste','safety']){
  assert.match(t[key],/лапш/i,key);
  assert.doesNotMatch(t[key],/рис|начинк|ролл|нори/i,key);
 }
 assert.match(t.taste,/без посторонних оттенков/);
 assert.match(t.taste,/не разваренная и не слипшаяся/);
});
test('Existing wok cards migrate both original roll defaults and previous category text',()=>{
 const original=resolveCategoryFields({...legacyTemplateFor('Воки'),category:'Воки'});
 assert.equal(original.taste,templateFor('Воки').taste);
 const previous=resolveCategoryFields({category:'Воки',taste:'Вкус и аромат гарнира, овощей, основного компонента и соуса соответствуют рецептуре. Гарнир не переварен; текстура овощей и начинки соответствует предусмотренной степени готовности.',safety:'Показатели безопасности соответствуют применимым требованиям ТР ТС 021/2011 и профильных регламентов. Контроль — по программе производственного контроля и процедурам ХАССП. Срок годности и режимы технологии требуют обоснования и утверждения предприятием. Контролируют подготовку компонентов и операции, указанные в технологическом процессе категории «Воки».'});
 assert.equal(previous.taste,templateFor('Воки').taste);
 assert.equal(previous.safety,templateFor('Воки').safety);
 assert.deepEqual(resolveCategoryFields(previous),previous);
 const custom='Лапша удон с креветкой, соус сливочный.';
 assert.equal(resolveCategoryFields({category:'Воки',taste:custom}).taste,custom);
});
test('Changing category replaces known category defaults while keeping authored text',()=>{
 for(const from of recipeCategories)for(const to of recipeCategories){
  const updated=resolveCategoryFields({...templateFor(from),category:to});
  for(const key of categoryTextFields)assert.equal(updated[key],templateFor(to)[key],from+' -> '+to+' '+key);
 }
});
