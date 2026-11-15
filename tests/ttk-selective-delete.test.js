import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {readFileSync} from 'node:fs';
import {installDeviceSyncApi} from '../device-sync-api.js';
import {installRecipeExportApi} from '../recipe-export-api.js';

const recipe=id=>({id,name:'Тест '+id,category:'Холодные роллы',status:'ready',ingredients:[]});
const blankSnapshot=()=>({
 recipes:[recipe('one'),recipe('two')],
 releasedRecipes:[recipe('one')],
 preparations:[],tasks:[],inspections:[],memory:[],myRecipeTemplates:[],categories:[],
 projectCatalog:{projects:[]}
});
async function startApp(mount){
 const app=express();app.use(express.json());mount(app);
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 return {
  url:'http://127.0.0.1:'+server.address().port,
  close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
 };
}
test('only authenticated owner can delete an exact cloud recipe with revision guard',async()=>{
 let snapshot={revision:4,snapshot:blankSnapshot(),updatedAt:'2026-11-15T00:00:00Z'};
 const prior=[];
 const store={
  storage:'yandex',
  read:async file=>snapshot,
  write:async(file,value)=>{if(file==='device-sync-v1.json')snapshot=value;else prior.push(value)},
  transaction:async fn=>fn()
 };
 const ctx=await startApp(app=>installDeviceSyncApi(app,{store,auth:{enabled:true,verify:token=>token==='owner'}}));
 const req=(path,opts={})=>fetch(ctx.url+path,{...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});
 try{
  const noOwner=await req('/api/device-sync/recipes/one',{method:'DELETE',body:JSON.stringify({revision:4})});
  assert.equal(noOwner.status,401);
  const stale=await req('/api/device-sync/recipes/one',{method:'DELETE',headers:{Cookie:'fai_owner=owner'},body:JSON.stringify({revision:3})});
  assert.equal(stale.status,409);
  const valid=await req('/api/device-sync/recipes/one',{method:'DELETE',headers:{Cookie:'fai_owner=owner'},body:JSON.stringify({revision:4})});
  assert.equal(valid.status,200,await valid.text());
  assert.deepEqual(snapshot.snapshot.recipes.map(r=>r.id),['two']);
  assert.deepEqual(snapshot.snapshot.releasedRecipes,[]);
  assert.deepEqual(snapshot.snapshot.deletedRecipeIds,['one']);
  assert.equal(prior.length,1);
  const again=await req('/api/device-sync/recipes/one',{method:'DELETE',headers:{Cookie:'fai_owner=owner'},body:JSON.stringify({revision:5})});
  assert.equal(again.status,404);
  // Older phone does not carry tombstones; server still prevents resurrection.
  const oldPhone=blankSnapshot();
  const put=await req('/api/device-sync',{method:'PUT',headers:{Cookie:'fai_owner=owner'},body:JSON.stringify({revision:5,snapshot:oldPhone})});
  assert.equal(put.status,200);
  assert.deepEqual(snapshot.snapshot.recipes.map(r=>r.id),['two']);
  assert.deepEqual(snapshot.snapshot.deletedRecipeIds,['one']);
 }finally{await ctx.close()}
});

test('Google gateway confirms only the matching exact deleted ID, without generating PDFs',async()=>{
 let payload=null,mismatch=false;
 const ctx=await startApp(app=>installRecipeExportApi(app,{request:async(_url,{body})=>{
  payload=JSON.parse(body);
  return {ok:true,json:async()=>({ok:true,recipeId:mismatch?'wrong':payload.recipeId,
   found:true,deleted:true,tabDeleted:true,pdfTrashed:true})};
 }}));
 const req={endpoint:'https://script.google.com/macros/s/ABCDEFGHIJKLMNOPQRSTUVWXYZ12345/exec',
  key:'X'.repeat(50),action:'deleteRecipe',recipeId:'one',projectId:'more-sushi'};
 try{
  const sent=await fetch(ctx.url+'/api/recipes/google-sync',{method:'POST',
   headers:{'Content-Type':'application/json'},body:JSON.stringify(req)});
  assert.equal(sent.status,200);
  assert.equal(payload.action,'deleteRecipe');
  assert.equal(payload.recipeId,'one');
  assert.equal(payload.pdfBase64,undefined);
  assert.equal(payload.recipe,undefined);
  mismatch=true;
  const invalid=await fetch(ctx.url+'/api/recipes/google-sync',{method:'POST',
   headers:{'Content-Type':'application/json'},body:JSON.stringify(req)});
  assert.equal(invalid.status,502);
 }finally{await ctx.close()}
});

test('Apps Script deletes only a known child tab and PDF in the recipe project',()=>{
 const script=readFileSync(new URL('../public/google-ttk.gs',import.meta.url),'utf8');
 assert.match(script,/function deleteOwnedRecipe\(properties,packet\)/);
 assert.match(script,/previous\.documentId!==documentId/);
 assert.match(script,/!tab\.tabProperties\.parentTabId/);
 assert.match(script,/deleteTab:\{tabId:previous\.tabId\}/);
 assert.match(script,/parent\.getName\(\)!=='ТТК PDF A4'/);
 assert.match(script,/file\.setTrashed\(true\)/);
 assert.match(script,/properties\.deleteProperty\(recordKey\)/);
 assert.doesNotMatch(script,/DriveApp\.getFileById\(documentId\)\.setTrashed\(true\)/);
});
