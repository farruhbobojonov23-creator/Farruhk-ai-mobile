import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {storageAdviceFor,PRACTICE_REFERENCES} from '../public/farukh-print/storage-advice.js';
import {products as ready} from '../public/farukh-print/ready-catalog.js';
import {templates} from '../public/farukh-print/haccp-catalog.js';

test('Every catalog item gets six nonempty operational tips',async()=>{
 const backup=JSON.parse(await fs.readFile(new URL('../print-recovery-catalog.json',import.meta.url),'utf8'));
 const products=[...backup,...ready,...templates];
 assert.ok(products.length>60);
 for(const product of products){
  const tip=storageAdviceFor(product);
  for(const key of ['heading','temperature','form','packaging','spoilage','control','avoid']){
   assert.ok(typeof tip[key]==='string'&&tip[key].length>(key==='heading'?8:40),'No '+key+' for '+product.name);
  }
  assert.ok(!('hours' in tip)&&!('needsReview' in tip)&&!('storage' in tip),'Tips must never change TTK values: '+product.name);
 }
});

test('Different preparations get genuinely relevant storage, packaging and spoilage advice',()=>{
 const testCases=[
  [{kind:'prep',name:'Капуста'},/овощи/i],
  [{kind:'prep',name:'Форель'},/рыба/i],
  [{kind:'prep',name:'Креветка'},/морепродукты/i],
  [{kind:'prep',name:'Курица готовая'},/курица/i],
  [{kind:'prep',name:'Бульон Том Ям'},/бульон/i],
  [{kind:'prep',name:'Омлет'},/рис, омлет/i],
  [{kind:'prep',name:'Соус спайси'},/соус/i],
  [{kind:'prep',name:'Унаги соус'},/покупной соус/i],
  [{kind:'ready',name:'Ролл Филадельфия',category:'Холодные роллы'},/холодный ролл/i],
  [{kind:'ready',name:'Запеченная Калифорния',category:'Запечённые роллы'},/запечённый ролл/i],
  [{kind:'ready',name:'Темпура с креветкой',category:'Темпура'},/темпура/i],
  [{kind:'ready',name:'Онигири',category:'Онигири'},/онигири/i],
  [{kind:'ready',name:'Вок с курицей',category:'Воки'},/вок/i],
  [templates[0],/ХАССП/],
  [templates.find(p=>p.template==='mop'),/инвентарь/i],
 ];
 for(const [item,pattern] of testCases)assert.match(storageAdviceFor(item).heading,pattern,item.name);
});

test('Food advice warns appearance cannot prove safety and does not encourage tasting',()=>{
 const fish=storageAdviceFor({kind:'prep',name:'Форель'});
 const roll=storageAdviceFor({kind:'ready',name:'Ролл Филадельфия'});
 assert.match(fish.spoilage,/НЕ означает безопасности/);
 assert.match(roll.spoilage,/может быть опасен/);
 assert.match(storageAdviceFor(templates[0]).avoid,/не пробуйте/i);
 assert.ok(PRACTICE_REFERENCES.every(ref=>ref.url.startsWith('https://')));
});

test('Norms modal leads with practical tips and keeps underlying expiry unchanged',async()=>{
 const ui=await fs.readFile(new URL('../public/print-control.js',import.meta.url),'utf8');
 const begin=ui.indexOf(' function showGuidance(p){');
 const end=ui.indexOf(" const dialog=el('dialog','pc-dialog');",begin);
 assert.ok(begin>0&&end>begin);
 const body=ui.slice(begin,end);
 assert.match(body,/storageAdviceFor\(item\)/);
 assert.match(body,/pc-advice-grid/);
 assert.match(body,/pc-guide-norm-details/);
 assert.ok(body.indexOf('pc-advice-grid')<body.indexOf('pc-guide-norm-details'));
 assert.doesNotMatch(body,/(?:p|item)\.(?:hours|storage|needsReview)\s*=(?!=)/);
 assert.match(ui,/controls.append\(btn\('Нормы','pc-edit pc-norms-btn'/);
});
