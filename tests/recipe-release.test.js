import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {upsertRecipe} from '../public/recipe-actions.js';
import {readyArchive,recipeDigest} from '../public/recipe-release.js';
import {mergeDeviceState} from '../public/device-store.js';
import {installRecipeExportApi,validGoogleEndpoint} from '../recipe-export-api.js';
const base={id:'recipe-1',name:'Ролл',category:'Холодные роллы',status:'draft',ingredients:[{name:'Рис',grams:80,grossGrams:80}]};
test('Drafts never enter the ready archive; return to draft and delete preserve the latest ready version',()=>{
 const state={recipes:[]};upsertRecipe(state,base);assert.equal(readyArchive(state).length,0);
 upsertRecipe(state,{...base,status:'ready',name:'Готовая версия'});assert.equal(readyArchive(state).length,1);
 upsertRecipe(state,{...base,name:'Новый черновик'});assert.equal(readyArchive(state)[0].name,'Готовая версия');
 state.recipes=[];assert.equal(readyArchive(state)[0].name,'Готовая версия');
 const restored=mergeDeviceState({recipes:[]},state);assert.equal(readyArchive(restored)[0].name,'Готовая версия');
});
test('Changing ready content updates the same archived recipe; digests do not depend on object key order',async()=>{
 const state={recipes:[]};upsertRecipe(state,{...base,status:'ready'});upsertRecipe(state,{...base,status:'ready',name:'Новая версия'});
 assert.equal(readyArchive(state).length,1);assert.equal(readyArchive(state)[0].name,'Новая версия');
 assert.equal(await recipeDigest({id:'a',name:'b'}),await recipeDigest({name:'b',id:'a'}));
 assert.notEqual(await recipeDigest({id:'a',name:'b'}),await recipeDigest({id:'a',name:'c'}));
});
test('Google endpoint permits only published Apps Script URLs',()=>{
 assert.equal(validGoogleEndpoint('https://script.google.com/macros/s/ABCDEFGHIJKLMNOPQRST/exec'),true);
 for(const url of ['http://script.google.com/macros/s/ABCDEFGHIJKLMNOPQRST/exec','https://attacker.example/macros/s/ABCDEFGHIJKLMNOPQRST/exec','https://script.google.com.attacker.example/macros/s/ABCDEFGHIJKLMNOPQRST/exec','https://script.google.com/macros/s/ABCDEFGHIJKLMNOPQRST/exec?x=1'])assert.equal(validGoogleEndpoint(url),false);
});
test('Google gateway rejects drafts, requires matching acknowledgement and returns valid Word',async()=>{
 const app=express();app.use(express.json());let calls=0,bad=false;
 installRecipeExportApi(app,{request:async(url,options)=>{calls++;const packet=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true,recipeId:packet.recipe.id,digest:bad?'wrong':packet.digest,tabId:'t.recipe'})}}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const url='http://127.0.0.1:'+server.address().port;
 const post=(path,data)=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 const connection={endpoint:'https://script.google.com/macros/s/ABCDEFGHIJKLMNOPQRST/exec',key:'a'.repeat(48),digest:'a'.repeat(64)};
 try{
  assert.equal((await post('/api/recipes/google-sync',{...connection,recipe:base})).status,400);assert.equal(calls,0);
  assert.equal((await post('/api/recipes/google-sync',{...connection,recipe:{...base,status:'ready'}})).status,200);
  bad=true;assert.equal((await post('/api/recipes/google-sync',{...connection,recipe:{...base,status:'ready'}})).status,502);
  const word=await post('/api/recipes/word',{recipe:base});assert.equal(word.status,200);const bytes=new Uint8Array(await word.arrayBuffer());assert.deepEqual([...bytes.slice(0,2)],[80,75]);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
});
