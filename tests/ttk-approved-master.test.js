import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildApprovedA4Payload,APPROVED_A4_LAYOUT} from '../public/ttk-approved-preview.js';
import {cleanState} from '../assistant-store.js';
import {ttkLayoutId,ttkLayout,TTK_LAYOUTS} from '../public/ttk-layouts.js';

test('approved master is a standalone A4 with embedded visual ornaments and live data binding',async()=>{
 const html=await fs.readFile(new URL('../public/ttk-approved-master.html',import.meta.url),'utf8');
 assert.ok(html.length>600000,'all graphics need to be embedded');
 assert.match(html,/@page\{size:A4;margin:0\}/);
 assert.match(html,/width:1024px;height:1448px/);
 assert.match(html,/window\.applyTtkData=/);
 assert.match(html,/window\.checkTtkPage=/);
 assert.ok((html.match(/data:image\/png;base64/g)||[]).length>=10,'logo, section headings, fan and footer must not be lost');
 assert.ok(!/https?:\/\/[^"']+\.(png|jpg|woff)/i.test(html),'standalone source should not fetch external assets');
});
test('approved master is a selectable and persisted layout',()=>{
 assert.equal(ttkLayoutId(APPROVED_A4_LAYOUT),APPROVED_A4_LAYOUT);
 assert.equal(ttkLayout(APPROVED_A4_LAYOUT)?.id,APPROVED_A4_LAYOUT);
 assert.equal(TTK_LAYOUTS.length,4,'legacy choices remain available unchanged');
 const recipe={id:'test',name:'Филадельфия',category:'Холодные роллы',layoutTemplate:APPROVED_A4_LAYOUT,
  brandLogo:'data:image/png;base64,AAAA',ingredients:[{name:'Форель',grams:30,grossGrams:31}]};
 const saved=cleanState({recipes:[recipe]}).recipes[0];
 assert.equal(saved.layoutTemplate,APPROVED_A4_LAYOUT);
 assert.equal(saved.brandLogo,recipe.brandLogo);
});
test('draft data replaces demo numbers, ingredients, statuses, nutrition and checked allergens',()=>{
 const r={name:'Тестовый ролл',cardNumber:'099',category:'Маки',
  cardDate:'2026-11-19',pieces:8,netYieldGrams:187,
  status:'draft',scope:'Только для теста',rawRequirements:'По накладной',
  ingredients:[{name:'Лосось',grams:70,grossGrams:75},{name:'Сыр сливочный',grams:40,grossGrams:40}],
  preparation:'Подготовить сырьё',forming:'Свернуть',serving:'Нарезать',
  storage:'Условия по утверждённой документации',
  nutrition:{protein:10,fat:12,carbs:20,kcal:228}
 };
 const p=buildApprovedA4Payload(r);
 assert.equal(p.cardNumber,'099');
 assert.equal(p.name,'Тестовый ролл');
 assert.equal(p.date,'19.11.2026');
 assert.equal(p.status,'В разработке');
 assert.equal(p.ingredients.length,2);
 assert.equal(p.ingredients[0].net,'70');
 assert.equal(p.yield,'8 шт. · 187 г');
 assert.equal(p.nutrition.protein.perPortion,'18,7');
 assert.ok(p.allergens.includes('fish'));
 assert.ok(p.allergens.includes('milk'));
 assert.ok(!p.allergens.includes('crustaceans'));
});
test('unknown nutritional values stay unknown; no demo recipe silently appears',()=>{
 const p=buildApprovedA4Payload({name:'Без состава',ingredients:[],nutrition:{},status:'draft'});
 assert.deepEqual(p.ingredients,[]);
 assert.equal(p.nutrition.protein.per100,'—');
 assert.equal(p.nutrition.protein.perPortion,'—');
 assert.notEqual(p.status,'Утверждено');
 assert.ok(p.warnings.some(x=>x.includes('ингредиенты')));
});
test('controls connect existing editor to master without changing other PDFs and docs',async()=>{
 const index=await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(index,/mountApprovedA4Preview/);
 assert.match(index,/approvedPreview\.populate\(r\)/);
 assert.match(index,/approvedPreview\.getLogo\(\)/);
 assert.match(index,/recipe\.layoutTemplate===APPROVED_A4_LAYOUT/);
 assert.match(index,/Word 1:1 для эталона/);
});


test('large approved A4 artwork loads only on preview open, never on home startup',async()=>{
 const preview=await fs.readFile(new URL('../public/ttk-approved-preview.js',import.meta.url),'utf8');
 const index=await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(preview,/let masterRequested=false/);
 assert.match(preview,/function ensureMasterLoaded\(\)/);
 assert.match(preview,/if\(masterRequested\)return/);
 assert.match(preview,/ensureMasterLoaded\(\);/);
 assert.match(preview,/typeof iframe\.contentWindow\?\.applyTtkData==='function'/);
 const showAt=preview.indexOf('function show(recipe)');
 const setSrcAt=preview.indexOf("iframe.src='/ttk-approved-master.html");
 assert.ok(showAt>setSrcAt,'the source assignment must only exist inside the lazy loader');
 assert.match(index,/ttk-approved-preview\.js\?v=2/);
});
