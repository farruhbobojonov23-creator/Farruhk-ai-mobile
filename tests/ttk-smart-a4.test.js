import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {cleanState} from '../assistant-store.js';
import {buildApprovedA4Payload} from '../public/ttk-approved-preview.js';
import {ttkLayoutId,ttkLayout,TTK_LAYOUTS} from '../public/ttk-layouts.js';
test('A4 is fixed to 15 rows and refuses clipping',async()=>{
 const s=await fs.readFile(new URL('../public/ttk-smart-a4.html',import.meta.url),'utf8');
 for(const pattern of [/@page\{size:A4;margin:0\}/,/width:1024px;height:1448px/,/for\(let i=0;i<15;i\+\+\)/,/window\.applyTtkData=/,/window\.checkTtkPage=/,/itemCount>15/])assert.match(s,pattern);
 assert.ok(!s.includes('Филадельфия классик'),'no invented recipe stored in blank template');
});
test('Smart persists and the four legacy layouts remain available',()=>{
 assert.equal(ttkLayoutId('premium-smart-a4'),'premium-smart-a4');
 assert.equal(ttkLayout('premium-smart-a4')?.id,'premium-smart-a4');
 assert.equal(TTK_LAYOUTS.length,4);
 const recipe={id:'x',name:'Тест',layoutTemplate:'premium-smart-a4',ingredients:Array.from({length:15},(_,i)=>({name:'Компонент '+i,grams:1,grossGrams:1}))};
 const saved=cleanState({recipes:[recipe]}).recipes[0];
 assert.equal(saved.layoutTemplate,'premium-smart-a4');assert.equal(saved.ingredients.length,15);
});
test('1, 15 and 16 ingredients are passed to rendering without deletion',()=>{
 for(const n of [1,15,16]){
  const recipe={name:'Проверка',netYieldGrams:n,ingredients:Array.from({length:n},(_,i)=>({name:'Ингредиент '+i,grams:1,grossGrams:1}))};
  const p=buildApprovedA4Payload(recipe);
  assert.equal(p.ingredients.length,n);
 }
});
test('editor and saved PDF use the new preview',async()=>{
 const s=await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8');
 for(const pattern of [/mountSmartA4Preview/,/smartPreview\.populate\(r\)/,/smartPreview\.openForRecipe\(recipe\)/,/recipe\.layoutTemplate===SMART_A4_LAYOUT/,/brandLogo:smartPreview\?\.getLogo\(\)/])assert.match(s,pattern);
});
