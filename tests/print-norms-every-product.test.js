import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {guidanceForProduct} from '../public/farukh-print/shelf-life-guidance.js';
import {products as readyProducts} from '../public/farukh-print/ready-catalog.js';
import {templates} from '../public/farukh-print/haccp-catalog.js';

test('Every real PRINT label type has meaningful norms and no auto-filled expiry',async()=>{
 const backup=JSON.parse(await fs.readFile(new URL('../print-recovery-catalog.json',import.meta.url),'utf8'));
 const products=[...backup,...readyProducts,...templates];
 assert.ok(products.some(p=>p.kind==='ready'));
 assert.ok(products.some(p=>p.kind==='prep'));
 assert.ok(products.some(p=>p.template));
 for(const product of products){
  const guidance=guidanceForProduct(product);
  assert.ok(guidance&&guidance.group&&guidance.question&&guidance.example,'Missing norms for '+product.name);
  assert.equal('hours' in guidance,false,'Guidance must not overwrite expiry: '+product.name);
  assert.equal('storage' in guidance,false,'Guidance must not set storage: '+product.name);
 }
});

test('Already verified products and HACCP templates receive context-specific guidance',()=>{
 const cold=guidanceForProduct({kind:'ready',name:'Ролл Филадельфия',category:'Холодные роллы'});
 const baked=guidanceForProduct({kind:'ready',name:'Запеченная Калифорния',category:'Запечённые роллы'});
 const tempura=guidanceForProduct({kind:'ready',name:'Темпура с креветкой',category:'Темпура'});
 const haccp=guidanceForProduct(templates[0]);
 assert.match(cold.group,/Холодные/);
 assert.match(baked.group,/Запеч/);
 assert.match(tempura.group,/Темпура/);
 assert.match(haccp.group,/ХАССП/);
 assert.match(haccp.question,/инструкц/);
});

test('Every displayed row gets a Norms button, not only unverified preparations',async()=>{
 const ui=await fs.readFile(new URL('../public/print-control.js',import.meta.url),'utf8');
 const rows=ui.slice(ui.indexOf(' function renderRows(){'),ui.indexOf(' function renderLog(){'));
 assert.match(rows,/for\(const p of selected\.slice\(offset,offset\+PAGE_SIZE\)\)/);
 assert.match(rows,/controls\.append\(btn\('Нормы','pc-edit pc-norms-btn',\(\)=>showGuidance\(p\)\)\)/);
 assert.doesNotMatch(rows,/if\(p\.kind==='prep'[^\n]*\)\s*\{\s*controls\.append\(btn\('Нормы'/);
 assert.match(ui,/if\(!p\.template\)actions\.append\(btn\('Редактировать срок и условия'/);
});
