import test from 'node:test';
import assert from 'node:assert/strict';
import {filterCatalog,categoryPhotos} from '../public/recipe-catalog.js';
import {recipeCategories,templateFor} from '../public/recipe-math.js';
import {existsSync} from 'node:fs';
test('All eleven categories have supplied original photos and distinct new templates',()=>{
 assert.equal(recipeCategories.length,11);
 for(const category of recipeCategories)assert.ok(existsSync('public'+categoryPhotos[category]),category);
 assert.match(templateFor('Онигири').forming,/онигири/);
 assert.match(templateFor('Закуски').forming,/Закуску/);
});
test('Catalog search handles names, categories, case and whitespace without changing recipes',()=>{
 const recipes=[{name:'Филадельфия',category:'Холодные роллы'},{name:'Креветка',category:'Закуски'},{name:'Тунец',category:'Онигири'}];
 const before=structuredClone(recipes);
 assert.deepEqual(filterCatalog(recipes,'Все','  ФИЛА '),[recipes[0]]);
 assert.deepEqual(filterCatalog(recipes,'Все','онигири'),[recipes[2]]);
 assert.deepEqual(filterCatalog(recipes,'Закуски','Тунец'),[]);
 assert.deepEqual(recipes,before);
});
