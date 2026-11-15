import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('printed A4 preview begins with TTK heading, not duplicated app/navigation masthead',async()=>{
 const [js,css,html]=await Promise.all([
  source('public/ttk-inline-a4-editor.js'),
  source('public/ttk-clean-a4.css'),
  source('public/index.html')
 ]);
 assert.doesNotMatch(js,/const hero=node\('header','ttk-live-hero'\)/);
 assert.match(js,/page\.append\(title,name,meta,introPair,recipePair,lower\)/);
 assert.match(css,/\.ttk-live-page>\.ttk-live-hero\s*\{[^}]*display:none!important/s);
 assert.match(html,/ttk-one-page-a4\.css\?v=2"><link rel="stylesheet" href="\/ttk-clean-a4\.css\?v=1"/);
});

test('fixed portrait sheet allocates redundant header space to legible fields without adding scrolling',async()=>{
 const css=await source('public/ttk-clean-a4.css');
 assert.match(css,/grid-template-rows:43px 55px 56px 148px 246px minmax\(0,1fr\)!important/);
 assert.match(css,/grid-template-rows:158px 160px 71px 66px 21px!important/);
 assert.match(css,/font-size:10\.9px!important/);
 assert.match(css,/line-height:14\.3px!important/);
 // 1123px page, 16px vertical padding, 5 page gaps of 7px.
 const lowerArea=1123-2*16-5*7-(43+55+56+148+246);
 const lowerUsed=(158+160+71+66+21)+4*7;
 assert.ok(lowerUsed<=lowerArea,'expanded cards must still fit on the unchanged A4 sheet');
 assert.ok(lowerArea-lowerUsed<10,'sheet remains compact, not vertically wasteful');
});

test('four layouts and classic server styles are not deleted',async()=>{
 const [js,pdf]=await Promise.all([
  source('public/ttk-layouts.js'),source('recipe-four-layout-pdf.js')
 ]);
 for(const id of ['teal-matrix','process-matrix','gold-allergen','premium-blue']){
  assert.ok(js.includes(id),'missing card '+id);
  assert.ok(pdf.includes(id),'missing PDF theme '+id);
 }
 assert.match(pdf,/ТЕХНОЛОГИЧЕСКАЯ КАРТА \(ТТК\)/);
 assert.doesNotMatch(pdf,/txt\('♛  FARRUH AI  Premium'/);
});
