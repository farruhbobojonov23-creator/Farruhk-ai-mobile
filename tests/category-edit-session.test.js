import test from 'node:test';
import assert from 'node:assert/strict';
import {beginCategoryEdit,applyCategoryEdit} from '../public/category-edit-session.js';
import {updateCategory,deleteCategory} from '../public/category-model.js';
const fixture=()=>({categories:[{id:'a',name:'Роллы',color:'#eeeeee'},{id:'b',name:'Суши',color:'#ffffff'}],recipes:[{id:'r',name:'Ролл',category:'Роллы',ingredients:[]}]});
test('preview does not mutate storage; saving renames categories without replacing recipes',()=>{const state=fixture(),draft=beginCategoryEdit(state);updateCategory(draft.working,{...draft.working.categories[0],name:'Новые роллы'});assert.equal(state.recipes[0].category,'Роллы');state.recipes[0].name='Обновлённый ролл';applyCategoryEdit(state,draft);assert.equal(state.recipes[0].category,'Новые роллы');assert.equal(state.recipes[0].name,'Обновлённый ролл');});
test('delete transfers recipes including newly added recipes; reorder and hide persist',()=>{const state=fixture(),draft=beginCategoryEdit(state);deleteCategory(draft.working,'a','Суши');draft.working.categories[0].visible=false;state.recipes.push({id:'new',category:'Роллы'});applyCategoryEdit(state,draft);assert.ok(state.recipes.every(r=>r.category==='Суши'));assert.equal(state.categories[0].visible,false);});
test('concurrent category change is rejected without overwriting it',()=>{const state=fixture(),draft=beginCategoryEdit(state);state.categories[0].name='Другая категория';assert.throws(()=>applyCategoryEdit(state,draft),/другой вкладке/);assert.equal(state.categories[0].name,'Другая категория');});
