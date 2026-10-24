import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {neighborsFor} from '../public/farukh-print/employee-advice.js';
import {storageAdviceFor} from '../public/farukh-print/storage-advice.js';
import {products as ready} from '../public/farukh-print/ready-catalog.js';
import {templates} from '../public/farukh-print/haccp-catalog.js';

test('Variant B has a visible independent advice button on every gallery tile',async()=>{
 const main=await fs.readFile(new URL('../public/farukh-print/print.js',import.meta.url),'utf8');
 const html=await fs.readFile(new URL('../public/farukh-print/index.html',import.meta.url),'utf8');
 const css=await fs.readFile(new URL('../public/farukh-print/print.css',import.meta.url),'utf8');
 const begin=main.indexOf('function renderCatalog(){');
 const end=main.indexOf('function openManage(',begin);
 const render=main.slice(begin,end);
 assert.match(render,/const tipsButton=node\('button','product-tips','▣ Советы'\)/);
 assert.match(render,/tipsButton\.onclick=\(\)=>openProductAdvice\(p\)/);
 assert.ok(render.indexOf('bottom.append')<render.indexOf('tipsButton.onclick'));
 assert.match(render,/item\.append\(tipsButton,meta\)/);
 assert.match(css,/\.product-tile \.product-tips/);
 assert.match(html,/\.\/print\.js\?v=37/);
 assert.match(html,/\.\/print\.css\?v=22/);
});

test('Every product category has readable neighbors and safety notes',async()=>{
 const base=JSON.parse(await fs.readFile(new URL('../print-recovery-catalog.json',import.meta.url),'utf8'));
 const items=[...base,...ready,...templates];
 assert.ok(items.length>40);
 for(const product of items){
  const n=neighborsFor(product);
  const tips=storageAdviceFor(product);
  assert.ok(n.yes.length>0&&n.no.length>0);
  assert.ok(n.yes.every(x=>x.length>18)&&n.no.every(x=>x.length>18));
  assert.ok(n.note.length>40);
  assert.ok(tips.temperature.length>30);
  assert.ok(!Object.hasOwn(n,'hours'));
  assert.ok(!Object.hasOwn(n,'storage'));
 }
});

test('Raw fish must never be recommended to sit with ready-to-eat rolls',()=>{
 const n=neighborsFor({kind:'prep',name:'Форель'});
 assert.match(n.no.join(' '),/готовые роллы/i);
 assert.match(n.no.join(' '),/птица/i);
 assert.match(n.yes.join(' '),/отдельн/);
 const dishes=neighborsFor({kind:'ready',name:'Ролл с лососем',category:'Холодные роллы'});
 assert.match(dishes.no.join(' '),/сырая рыба/i);
});

test('Kitchen advice UI separates reading from authorizing a print',async()=>{
 const ui=await fs.readFile(new URL('../public/farukh-print/employee-advice.js',import.meta.url),'utf8');
 const app=await fs.readFile(new URL('../public/farukh-print/print.js',import.meta.url),'utf8');
 assert.match(ui,/\['Советы','♧'\],\['Хранение','❄'\],\['Соседство','▱'\],\['Нормы','▤'\]/);
 assert.match(ui,/print-advice-neighbor-grid/);
 assert.match(ui,/\!product\.needsReview&&Number\(product\.hours\)>0&&!!product\.storage/);
 assert.match(ui,/printBtn\.disabled=!available/);
 assert.match(app,/renderCatalog\(\);openWorkerPreview\(\)/);
 assert.doesNotMatch(ui,/\b(?:print|save|deleteDB|authorize)\s*\(/);
 assert.match(ui,/срок и температура определяются маркировкой/i);
});
