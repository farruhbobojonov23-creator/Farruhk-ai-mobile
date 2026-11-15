import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('paper A4 includes approved premium brand, HORECA caption and four compact icon labels',async()=>{
 const [js,css,html]=await Promise.all([
  source('public/ttk-inline-a4-editor.js'),
  source('public/ttk-clean-a4.css'),
  source('public/index.html')
 ]);
 assert.match(js,/const masthead=node\('header','ttk-live-hero ttk-live-paper-mast'\)/);
 assert.match(js,/page\.append\(masthead,title,name,meta,introPair,recipePair,lower\)/);
 assert.match(css,/\.ttk-live-page>\.ttk-live-paper-mast\s*\{[^}]*display:grid!important/s);
 assert.match(html,/ttk-one-page-a4\.css\?v=2"><link rel="stylesheet" href="\/ttk-clean-a4\.css\?v=2"/);
 for(const label of ['FARRUH AI','Premium','ПФ','ХАССП','Печать','ТТК']){
  assert.ok(js.includes(label),'missing paper masthead label: '+label);
 }
 for(const icon of ['crown','chef','shield','box','print']){
  assert.ok(js.includes(icon+':')||js.includes("['"+icon+"'"),'missing inline SVG icon: '+icon);
 }

});

test('fixed portrait sheet allocates redundant header space to legible fields without adding scrolling',async()=>{
 const css=await source('public/ttk-clean-a4.css');
 assert.match(css,/grid-template-rows:46px 43px 51px 52px 141px 224px minmax\(0,1fr\)!important/);
 assert.match(css,/grid-template-rows:154px 160px 69px 66px 21px!important/);
 assert.match(css,/font-size:10\.9px!important/);
 assert.match(css,/line-height:14\.3px!important/);
 // 1123px page, 16px vertical padding, 6 gaps of 6px.
 const lowerArea=1123-2*16-6*6-(46+43+51+52+141+224);
 const lowerUsed=(154+160+69+66+21)+4*7;
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
 assert.match(pdf,/function masthead\(y,s,draw\)/);
 assert.match(pdf,/txt\('FARRUH AI'/);
 assert.match(pdf,/txt\('Premium'/);
});
