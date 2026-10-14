import test from 'node:test';
import assert from 'node:assert/strict';
import {deleteRecipe,upsertRecipe} from '../public/recipe-actions.js';
test('delete removes only the selected recipe, retains other work and fails safely for unknown ids',()=>{
 const state={recipes:[{id:'a',name:'Ролл'},{id:'b',name:'Суп'}],tasks:[{id:'task'}]};
 assert.equal(deleteRecipe(state,'a').name,'Ролл');assert.deepEqual(state.recipes,[{id:'b',name:'Суп'}]);assert.equal(state.tasks.length,1);
 assert.throws(()=>deleteRecipe(state,'missing'));assert.equal(state.recipes.length,1);
});
test('edits replace the same card without duplicates and never resurrect deleted cards',()=>{
 const state={recipes:[{id:'a',name:'Ролл'}]};upsertRecipe(state,{id:'a',name:'Новый ролл'},{editing:true});assert.equal(state.recipes.length,1);assert.equal(state.recipes[0].name,'Новый ролл');deleteRecipe(state,'a');assert.throws(()=>upsertRecipe(state,{id:'a'},{editing:true}));assert.equal(state.recipes.length,0);
});
