import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildApprovedA4Payload,APPROVED_A4_LAYOUT} from '../public/ttk-approved-preview.js';
import {cleanState} from '../assistant-store.js';
import {ttkLayoutId,ttkLayout,TTK_LAYOUTS,TTK_GALLERY_LAYOUTS} from '../public/ttk-layouts.js';

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
 assert.match(preview,/if\(masterRequested\|\|loaded\)return/);
 assert.match(preview,/ensureMasterLoaded\(\);/);
 assert.match(preview,/typeof iframe\.contentWindow\?\.applyTtkData==='function'/);
 assert.match(preview,/function loadFailed\(\)/);
 assert.match(preview,/iframe\.addEventListener\('error',loadFailed\)/);
 assert.match(preview,/setTimeout\(loadFailed,15000\)/);
 assert.match(preview,/if\(!loaded\)\{loadFailed\(\);return\}/);
 const showAt=preview.indexOf('function show(recipe,openedFromEditor=false)');
 const setSrcAt=preview.indexOf("iframe.src='/ttk-approved-master.html");
 assert.ok(showAt>setSrcAt,'the source assignment must only exist inside the lazy loader');
 assert.match(index,/ttk-approved-preview\.js\?v=6/);
 const real=await fs.readFile(new URL('../public/ttk-real-a4-preview.js',import.meta.url),'utf8');
 assert.match(real,/const isEmerald=\(\)=>chosen\(\)==='emerald-master-a4'/);
 assert.match(real,/if\(isEmerald\(\)\)\{/);
 assert.match(real,/picker\.querySelector\('#ttk-approved-open'\)/);
 assert.match(real,/live\.shell\.hidden=emerald/);
 assert.match(real,/5 шаблонов технологической карты/);
});

test('owner gallery has five selectable A4 layouts and one contextual Emerald control group',async()=>{
 assert.equal(TTK_LAYOUTS.length,4,'the legacy four templates stay available');
 assert.equal(TTK_GALLERY_LAYOUTS.length,5,'all five templates should be visible together');
 assert.deepEqual(TTK_GALLERY_LAYOUTS.map(x=>x.id),[
  'teal-matrix','process-matrix','gold-allergen','premium-blue','emerald-master-a4'
 ]);
 for(const item of TTK_GALLERY_LAYOUTS)assert.equal(ttkLayoutId(item.id),item.id);
 const gallery=await fs.readFile(new URL('../public/ttk-layouts.js',import.meta.url),'utf8');
 const bridge=await fs.readFile(new URL('../public/ttk-approved-preview.js',import.meta.url),'utf8');
 const index=await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const styles=await fs.readFile(new URL('../public/ttk-approved-preview.css',import.meta.url),'utf8');
 assert.match(gallery,/grid\.replaceChildren\(\.\.\.TTK_GALLERY_LAYOUTS\.map/);
 assert.match(gallery,/new CustomEvent\('ttk:layout-change'/);
 assert.match(bridge,/if\(picker\)picker\.append\(menu\)/);
 assert.match(bridge,/menu\.hidden=true/);
 assert.match(bridge,/editor\.addEventListener\('ttk:layout-change'/);
 assert.match(bridge,/syncVisibility\(r\?\.layoutTemplate\)/);
 assert.match(styles,/\.ttk-approved-controls\[hidden\]\{display:none!important\}/);
 assert.match(index,/ttk-layouts\.js\?v=6/);
 assert.match(index,/ttk-approved-preview\.js\?v=6/);
});

test('only the Emerald master can be embedded, and only by the same origin',async()=>{
 const server=await fs.readFile(new URL('../server.js',import.meta.url),'utf8');
 const guard=/if\(req\.path==='\/ttk-approved-master\.html'\)\{[\s\S]*?res\.setHeader\('X-Frame-Options','SAMEORIGIN'\);[\s\S]*?res\.setHeader\('Content-Security-Policy',"frame-ancestors 'self'"\);[\s\S]*?\}else\{[\s\S]*?res\.setHeader\('X-Frame-Options','DENY'\)/;
 assert.match(server,guard);
 const bridge=await fs.readFile(new URL('../public/ttk-approved-preview.js',import.meta.url),'utf8');
 assert.match(bridge,/owner-master-20261120-frame/);
 assert.match(bridge,/Повторить загрузку/);
});

test('Emerald A4 is editable through the same recipe form, not a second disconnected draft',async()=>{
 const preview=await fs.readFile(new URL('../public/ttk-approved-preview.js',import.meta.url),'utf8');
 const studio=await fs.readFile(new URL('../public/ttk-real-a4-preview.js',import.meta.url),'utf8');
 const app=await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(preview,/className=cls/);
 assert.match(preview,/ttk-approved-edit/);
 assert.match(preview,/edit\.onclick=\(\)=>editCurrent\(\)/);
 assert.match(preview,/onEditRecipe\(recipe\)/);
 assert.match(preview,/fromEditor=openedFromEditor/);
 assert.match(preview,/editor\.querySelector\(fieldId\)/);
 assert.match(preview,/master\?\.addEventListener\('click'/);
 assert.match(preview,/warning\.dataset\.overflow='false'/);
 assert.match(studio,/startEdit\.textContent=emerald\?'✎ Заполнить ТТК Emerald Gold'/);
 assert.match(app,/onEditRecipe:r=>openEditor\(r\)/);
 assert.match(app,/ttk-approved-preview\.css\?v=4/);
});

test('the visible Emerald gallery, not just its print dialog, offers a real fill button',async()=>{
 const bridge=await fs.readFile(new URL('../public/ttk-approved-preview.js',import.meta.url),'utf8');
 const css=await fs.readFile(new URL('../public/ttk-approved-preview.css',import.meta.url),'utf8');
 assert.match(bridge,/fill\.id='ttk-approved-fill'/);
 assert.match(bridge,/menu\.append\(heading,note,fill,open,logo,file\)/);
 assert.match(bridge,/fill\.onclick=\(\)=>\{current=getDraft\(\);fromEditor=true;editCurrent\('#recipe-name'\);\}/);
 assert.match(css,/#editor \.ttk-approved-controls \.ttk-approved-fill/);
 assert.match(css,/grid-column:1\/-1!important/);
});
