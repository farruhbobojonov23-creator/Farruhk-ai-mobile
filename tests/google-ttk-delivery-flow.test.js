import test from 'node:test';
import assert from 'node:assert/strict';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';
import {upsertRecipe} from '../public/recipe-actions.js';
import {googleReady} from '../public/recipe-google.js';
import {recipeDigest} from '../public/recipe-release.js';
import {installRecipeExportApi} from '../recipe-export-api.js';

const endpoint='https://script.google.com/macros/s/TEST_RECEIVER_20261117_ABCDEFGHIJKLMN/exec';
const documentUrl='https://docs.google.com/document/d/TEST_DOCUMENT_20261117/edit';
const folderUrl='https://drive.google.com/drive/folders/TEST_FOLDER_20261117';
const pdfUrl='https://drive.google.com/file/d/TEST_PDF_20261117/view';

// Contract test: the Google transport is simulated; the release path and PDF generator are real.
test('draft → ready → project → Google packet → confirmed PDF; retry and edit keep the recipe ID',async()=>{
 const state={recipes:[]}, saved=new Map(), packets=[];
 let handler;
 installRecipeExportApi({post(path,fn){if(path==='/api/recipes/google-sync')handler=fn}},{
  request:async(_url,options)=>{
   const packet=JSON.parse(options.body);
   packets.push(packet);
   let result;
   if(packet.action==='check')result={ok:true,documentUrl,pdfA4Supported:true};
   else if(packet.action==='ensureProject')result={ok:true,documentUrl,folderUrl,pdfA4Supported:true};
   else {
    assert.equal(packet.pdfPageCount,1);
    const bytes=Buffer.from(packet.pdfBase64||'','base64');
    assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
    const pdf=await parsePdf(bytes);
    assert.equal(pdf.numpages,1);
    assert.ok(packet.sections.length>=7);
    saved.set(packet.recipe.id,{digest:packet.digest,pdfUrl});
    result={ok:true,recipeId:packet.recipe.id,digest:packet.digest,documentUrl,folderUrl,pdfUrl,pdfA4Supported:true};
   }
   return {ok:true,json:async()=>result};
  }
 });
 const send=async(action,extra={})=>{
  const res={statusCode:200,status(n){this.statusCode=n;return this},json(data){this.data=data;return this}};
  await handler({body:{endpoint,key:'TEST_ONLY_'.repeat(4),action,...extra}},res);
  assert.equal(res.statusCode,200,JSON.stringify(res.data));
  return res.data;
 };
 const recipe={id:'test-ttk-20261117',name:'ТЕСТ — проверка Google',status:'draft',category:'Холодные роллы',pieces:8,
  ingredients:[{name:'Рис',grams:100,grossGrams:100},{name:'Огурец',grams:30,grossGrams:30}]};
 upsertRecipe(state,recipe);
 assert.equal(googleReady(state).length,0);
 assert.equal(packets.length,0);
 upsertRecipe(state,{...recipe,status:'ready'});
 assert.equal(googleReady(state).length,1);
 assert.equal((await send('check')).pdfA4Supported,true);
 assert.equal((await send('ensureProject',{projectName:'Без проекта'})).folderUrl,folderUrl);
 const upload=async()=>{
  const ready=googleReady(state)[0],digest=await recipeDigest(ready);
  const result=await send('sync',{recipe:ready,digest});
  assert.equal(result.pdfReady,true);
  assert.equal(result.pdfUrl,pdfUrl);
  state.googleDelivery={[ready.id]:{digest,layoutVersion:'a4-pdf-1',url:result.documentUrl,pdfUrl:result.pdfUrl}};
  return digest;
 };
 const firstDigest=await upload();
 await upload();
 assert.equal(saved.size,1);
 upsertRecipe(state,{...recipe,status:'ready',name:'ТЕСТ — проверка Google, изменение'});
 const nextDigest=await upload();
 assert.notEqual(nextDigest,firstDigest);
 assert.equal(saved.size,1);
 assert.equal(saved.get(recipe.id).digest,nextDigest);
 assert.equal(state.googleDelivery[recipe.id].digest,nextDigest);
});

test('Docs-only legacy receiver is not reported as a completed Drive PDF upload',async()=>{
 let handler;
 installRecipeExportApi({post(path,fn){if(path==='/api/recipes/google-sync')handler=fn}},{
  request:async(_url,options)=>{
   const packet=JSON.parse(options.body);
   return {ok:true,json:async()=>({ok:true,recipeId:packet.recipe.id,digest:packet.digest,documentUrl})};
  }
 });
 const res={status(n){this.statusCode=n;return this},json(data){this.data=data;return this}};
 await handler({body:{endpoint,key:'TEST_ONLY_'.repeat(4),action:'sync',digest:'a'.repeat(64),
  recipe:{id:'test-legacy',name:'ТЕСТ — старый скрипт',status:'ready',ingredients:[{name:'Рис',grams:100}]}}},res);
 assert.equal(res.statusCode,502);
 assert.equal(res.data.code,'GOOGLE_PDF_NOT_CONFIRMED');
 assert.equal(res.data.documentSaved,true);
 assert.equal(res.data.pdfReady,false);
});
