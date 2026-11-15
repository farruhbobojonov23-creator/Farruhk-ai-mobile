import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {googleReady} from '../public/recipe-google.js';

const item=id=>({id,name:'Тест '+id,category:'Холодные роллы',status:'ready',ingredients:[]});

test('a deleted phone recipe is never queued for Google again, even if a release archive survives',()=>{
 const state={recipes:[item('live')],releasedRecipes:[item('deleted'),item('paused'),item('tombstone')],
  googleSuppressed:{paused:true},
  localOnlyDeletedIds:{deleted:true},
  deletedRecipeIds:['tombstone']};
 assert.deepEqual(googleReady(state).map(recipe=>recipe.id),['live']);
});

test('phone deletion cancels queued uploads and does not acknowledge stale Google completion',()=>{
 const client=readFileSync(new URL('../public/recipe-google.js',import.meta.url),'utf8');
 const manager=readFileSync(new URL('../public/recipe-delete-manager.js',import.meta.url),'utf8');
 assert.match(client,/document\.addEventListener\('farruh:recipe-local-deleted'/);
 assert.match(client,/controller\.abort\(\)/);
 assert.match(client,/if\(isStopped\(recipe\.id\)\)continue/);
 assert.match(client,/s\.googleSuppressed\?\.\[recipe\.id\]/);
 assert.match(manager,/document\.dispatchEvent\(new CustomEvent\('farruh:recipe-local-deleted'/);
});

test('one-tap delete everywhere waits for both Google and cloud confirmations',()=>{
 const manager=readFileSync(new URL('../public/recipe-delete-manager.js',import.meta.url),'utf8');
 const code=manager.slice(manager.indexOf("if(scope==='all')"),manager.indexOf("}else if(scope==='phone')"));
 assert.match(manager,/scope:'all',label:'🗑️ Везде ✕'/);
 assert.match(code,/await postGoogle\(paused,id,recipe\)/);
 assert.match(code,/await deleteCloud\(id\)/);
 assert.match(code,/d\.recipes=\(d\.recipes\|\|\[\]\)\.filter/);
 assert.ok(code.indexOf('await postGoogle')<code.indexOf('await deleteCloud'));
 assert.ok(code.indexOf('await deleteCloud')<code.indexOf('d.recipes='));
 assert.match(manager,/Удалена только с телефона/);
});
