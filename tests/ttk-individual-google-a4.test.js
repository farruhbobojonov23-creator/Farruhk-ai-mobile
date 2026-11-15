import test from 'node:test';
import assert from 'node:assert/strict';
import parsePdf from 'pdf-parse/lib/pdf-parse.js';
import {individualRecipeFields,resolveCategoryFields,templateFor} from '../public/recipe-math.js';
import {installRecipeExportApi} from '../recipe-export-api.js';

test('each roll receives its own editable fields from its actual recipe',()=>{
 const a={id:'roll-a',name:'Филадельфия с лососем',category:'Холодные роллы',pieces:8,
  ingredients:[{name:'Рис',grams:130},{name:'Лосось',grams:65},{name:'Сливочный сыр',grams:45}]};
 const b={...a,id:'roll-b',name:'Креветка чили',ingredients:[{name:'Рис',grams:130},{name:'Креветка',grams:65},{name:'Огурец',grams:45}]};
 const f=individualRecipeFields(a),g=individualRecipeFields(b);
 for(const key of ['scope','rawRequirements','preparation','forming','serving','storage','appearance','taste','safety']){
  assert.ok(f[key]?.trim(),key+' cannot be blank');
  assert.notEqual(f[key],g[key],key+' must identify the individual roll');
 }
 assert.match(f.preparation,/Лосось/);
 assert.doesNotMatch(g.preparation,/Лосось/);
 assert.match(g.forming,/Креветка/);
 assert.match(f.serving,/8 шт/);
 // No nutrition, allergens, temperatures or actual holding time are invented.
 assert.doesNotMatch(f.preparation,/\d+\s*°C/);
});
test('an owner-written technology survives category regeneration',()=>{
 const manual='Лосось нарезать утверждённым способом и разложить по техкарте шефа.';
 const raw={...templateFor('Холодные роллы',8),name:'Филадельфия',category:'Холодные роллы',
  forming:manual,preparation:manual,customTemplate:false};
 const result=resolveCategoryFields(raw);
 assert.equal(result.forming,manual);
 assert.equal(result.preparation,manual);
});
test('Google receiver request includes the exact single-page A4 PDF and every ingredient',async()=>{
 let handler,packet;
 const app={post(path,callback){if(path==='/api/recipes/google-sync')handler=callback}};
 installRecipeExportApi(app,{request:async(_url,options)=>{
  packet=JSON.parse(options.body);
  return {ok:true,json:async()=>({ok:true,recipeId:packet.recipe.id,digest:packet.digest,
   documentUrl:'https://docs.google.com/document/d/1uQdJ3l_sfR2nl317O1C85-T_x6s2BwYE8gj1Hhx-cm8/edit',pdfUrl:'https://drive.google.com/file/d/1Hv4IxMj6bCUrZwgu_x2OrV8fH_oLQZvD/view'})};
 }});
 assert.equal(typeof handler,'function');
 const ingredients=Array.from({length:55},(_,i)=>({name:'Ингредиент '+(i+1),grams:5,grossGrams:5,lossPercent:0}));
 const req={body:{endpoint:'https://script.google.com/macros/s/ABCDEFGHIJKLMNOPQRSTUVWXYZ12345/exec',
  key:'K'.repeat(32),action:'sync',digest:'a'.repeat(64),recipe:{
   id:'single-page-55',name:'Авторский ролл',category:'Холодные роллы',
   cardNumber:'007',cardDate:'2026-11-15',status:'ready',pieces:8,
   ...templateFor('Холодные роллы',8),layoutTemplate:'royal-a4',ingredients,netYieldGrams:275,
   chef:'Шеф',approver:'Директор',nutrition:{protein:6,fat:3,carbs:20,kcal:130},nutritionMode:'manual'}}};
 const res={json(v){this.value=v;return this},status(code){this.code=code;return this}};
 await handler(req,res);
 assert.equal(res.code,undefined,JSON.stringify(res.value));
 assert.equal(res.value.pdfReady,true);
 assert.ok(packet.pdfBase64.length>1000);
 assert.equal(packet.pdfPageCount,1);
 assert.equal(packet.sections[2][1].length,57); // header + 55 materials + yield
 const pages=await parsePdf(Buffer.from(packet.pdfBase64,'base64'));
 assert.equal(pages.numpages,1);
 assert.match(pages.text,/Ингредиент 55/);
});
