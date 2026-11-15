import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../public/'+path,import.meta.url),'utf8');

test('Approved Black Ice has four real working kitchen routes, not dead mockup buttons',async()=>{
 const s=await read('premium-showcase.js');
 for(const [title,route] of [['ТТК','recipes'],['ХАССП','lab'],['Ингредиенты','preparations'],['Журналы','lab']]){
  assert.ok(s.includes('data-pf-go="'+route+'"><span class="pf-ice-tile-art">'),route+' card missing');
  assert.ok(s.includes('pf-ice-tile-label">'+title+'</span>'),title+' label missing');
 }
 for(const name of ['Главная','Проекты','Поиск','Профиль'])assert.ok(s.includes('>'+name+'</span>'),'Bottom item missing: '+name);
 assert.match(s,/target\.dataset\.pfGo\)goto\(target\.dataset\.pfGo\)/);
 assert.match(s,/target\.dataset\.pfAction==='search'/);
 assert.match(s,/document\.getElementById\('recipe-search'\)/);
});

test('Black Ice projects use real project select and are not invented data',async()=>{
 const s=await read('premium-showcase.js');
 assert.match(s,/document\.getElementById\('pf-home-project-select'\)/);
 assert.match(s,/document\.addEventListener\('pf:projects',syncProjects\)/);
 assert.match(s,/original\.dispatchEvent\(new Event\('change',\{bubbles:true\}\)\)/);
 assert.match(s,/option\.text\.replace/);
 assert.match(s,/add\.dataset\.pfAction='projects'/);
});

test('Owner-approved theme activates once; current theme remains user-editable',async()=>{
 const s=await read('premium-workspace.js');
 assert.match(s,/const BLACK_ICE_APPROVAL='farruh-ai-approved-black-ice-v1'/);
 assert.match(s,/if\(!getJson\(BLACK_ICE_APPROVAL,false\)\)/);
 assert.match(s,/config=\{\.\.\.config,theme:'titanium',accent:''\}/);
 assert.match(s,/setJson\(BLACK_ICE_APPROVAL,true\)/);
 assert.match(s,/function applyDesign\(value\)/);
});

test('Black Ice CSS is included after old themes and cannot recolor printed A4',async()=>{
 const html=await read('index.html');
 const css=await read('black-ice-approved.css');
 assert.ok(html.includes('/black-ice-approved.css?v=1'));
 assert.ok(html.indexOf('black-ice-approved.css')>html.indexOf('focused-workspace.css'));
 assert.match(css,/body\[data-pf-theme="titanium"\]/);
 assert.match(css,/@media print/);
 assert.match(css,/\.ttk-paper/);
 assert.match(css,/\.haccp-a4-paper/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(html,/premium-workspace\.js\?v=24/);
});
