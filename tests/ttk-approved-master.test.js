import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {TTK_LAYOUTS,TTK_GALLERY_LAYOUTS,ttkLayoutId,ttkLayout} from '../public/ttk-layouts.js';

const source=async path=>fs.readFile(new URL('../'+path,import.meta.url),'utf8');
const FOUR=['teal-matrix','process-matrix','gold-allergen','premium-blue'];

test('original four owner A4 designs are the only visible choices',async()=>{
 assert.deepEqual(TTK_LAYOUTS.map(item=>item.id),FOUR);
 assert.deepEqual(TTK_GALLERY_LAYOUTS.map(item=>item.id),FOUR);
 assert.equal(ttkLayoutId('emerald-master-a4'),'teal-matrix',
  'saved cards using the retired layout should remain openable');
 assert.equal(ttkLayout('emerald-master-a4').id,'teal-matrix');
 const gallery=await source('public/ttk-layouts.js');
 assert.match(gallery,/grid\.replaceChildren\(\.\.\.TTK_GALLERY_LAYOUTS\.map/);
 assert.doesNotMatch(gallery,/name:'05 · Emerald Gold'/);
});

test('the real inline A4 form and PDF renderer are restored',async()=>{
 const [page,studio,css,index]=await Promise.all([
  source('public/ttk-real-a4-preview.js'),
  source('public/ttk-studio.js'),
  source('public/ttk-one-page-a4.css'),
  source('public/index.html')
 ]);
 assert.match(page,/4 шаблона технологической карты/);
 assert.match(page,/live\.refresh\(\)/);
 assert.match(page,/live\.setLayout\(\)/);
 assert.doesNotMatch(page,/isEmerald|emerald-master-a4|#ttk-approved-open/);
 assert.match(studio,/четыре|four editable A4 designs|four original editable A4 designs/i);
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
 assert.match(index,/ttk-one-page-a4\.css\?v=4/);
 assert.match(index,/ttk-studio\.js\?v=15/);
 assert.match(index,/ttk-layouts\.js\?v=7/);
 assert.doesNotMatch(index,/mountApprovedA4Preview|APPROVED_A4_LAYOUT|ttk-approved-preview\.css/);
});

test('saved recipe data remain intact and old Emerald cards export using an editable fallback',async()=>{
 const [index,store,server]=await Promise.all([
  source('public/index.html'),
  source('assistant-store.js'),
  source('server.js')
 ]);
 assert.match(index,/const printable=\{\.\.\.recipe,layoutTemplate:ttkLayoutId\(recipe\.layoutTemplate\)\}/);
 assert.match(index,/brandLogo:previous\?\.brandLogo\|\|null/);
 assert.match(store,/recipes:list\(input\.recipes\)/);
 assert.match(server,/res\.setHeader\('X-Frame-Options','DENY'\)/);
 assert.doesNotMatch(server,/frame-ancestors 'self'/);
});
