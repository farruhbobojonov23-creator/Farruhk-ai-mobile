import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {illustrationFor,subjectFor,neighborPicture,advicePicture} from '../public/farukh-print/advice-art.js';

test('Illustrated advice has genuine local SVG food images and is independent of remote CDN',()=>{
 for(const id of ['cucumber','vegetables','herbs','cheese','sauce','rawmeat','sushi','seafood','onion','container','fridge','spoiled','magnifier','package','clipboard','books','chemical','fish']){
  const src=illustrationFor(id);
  assert.match(src,/^data:image\/svg\+xml;charset=utf-8,/);
  const markup=decodeURIComponent(src.split(',')[1]);
  assert.match(markup,/<svg /);
  assert.match(markup,/<defs>/);
  assert.match(markup,/<\/svg>$/);
  assert.ok(markup.length>500,id+' has no illustration');
  assert.doesNotMatch(markup.replace('xmlns="http://www.w3.org/2000/svg"',''),/https?:\/\//);
 }
});

test('Food photographs in owner catalog are reused for the correct product, not mixed with unrelated photos',()=>{
 const photo='data:image/jpeg;base64,abcDEF123';
 // The real photograph belongs only to the product heading. Internal advice
 // cards must be identical, universal and clean for any ingredient.
 for(const id of ['Форма','Упаковка','Температура','Порча','Контроль','Важно','Технология','Справка']){
  const a=advicePicture({name:'Форель',photo},id,'Форма хранения');
  const b=advicePicture({name:'Снежный краб',photo},id,'Форма хранения');
  const d=advicePicture({name:'Огурцы',photo},id,'Форма хранения');
  assert.equal(a,b,id+' changed picture by product name');
  assert.equal(b,d,id+' changed picture by product name');
  assert.match(a,/^data:image\\/svg\\+xml/);
  assert.notEqual(a,photo);
 }
 assert.notEqual(advicePicture({name:'Огурцы'},'Форма','Форма хранения'),advicePicture({name:'Огурцы'},'Температура','Температура и охлаждение'));
 assert.match(advicePicture({name:'Огурцы'},'Температура','При какой температуре'),/^data:image\/svg\+xml/);
 assert.equal(subjectFor('зелень (в контейнере)'),'herbs');
 assert.equal(subjectFor('сырое мясо и птица'),'rawmeat');
 assert.equal(subjectFor('готовые роллы'),'sushi');
 assert.equal(subjectFor('сырые морепродукты'),'seafood');
 assert.equal(subjectFor('сыр в упаковке'),'cheese');
 assert.equal(subjectFor('продукты с сильным запахом'),'onion');
 assert.match(neighborPicture('Овощи'),/^data:image\/svg\+xml/);
});

test('Every printed-product advice tab displays colorful themed artwork, not initial letters',async()=>{
 const ui=await fs.readFile(new URL('../public/farukh-print/employee-advice.js',import.meta.url),'utf8');
 const style=await fs.readFile(new URL('../public/farukh-print/print.css',import.meta.url),'utf8');
 const app=await fs.readFile(new URL('../public/farukh-print/print.js',import.meta.url),'utf8');
 const html=await fs.readFile(new URL('../public/farukh-print/index.html',import.meta.url),'utf8');
 assert.match(ui,/import \{advicePicture,neighborPicture,illustrationFor,isCatalogPhoto\}/);
 assert.match(ui,/picture\(advicePicture\(product,icon,title\)/);
 assert.match(ui,/picture\(neighborPicture\(line\)/);
 assert.match(ui,/print-advice-row-picture/);
 assert.match(ui,/print-advice-neighbor-picture/);
 assert.match(ui,/\['Советы','♧'\],\['Хранение','❄'\],\['Соседство','▱'\],\['Нормы','▤'\]/);
 assert.doesNotMatch(ui,/print-advice-icon',icon.slice/);
 assert.match(style,/\.print-advice-row-picture\{/);
 assert.match(style,/\.print-advice-neighbor-picture\{/);
 assert.match(style,/\.print-advice-neighbor-grid/);
 assert.match(app,/employee-advice\.js\?v=3/);
 assert.match(html,/print\.css\?v=16/);
 assert.match(html,/print\.js\?v=25/);
});

test('Advice never guesses or writes shelf-life values, and does not override print authorization',async()=>{
 const ui=await fs.readFile(new URL('../public/farukh-print/employee-advice.js',import.meta.url),'utf8');
 const art=await fs.readFile(new URL('../public/farukh-print/advice-art.js',import.meta.url),'utf8');
 assert.match(ui,/printBtn\.disabled=!available/);
 assert.match(ui,/!product\.needsReview&&Number\(product\.hours\)>0&&!!product\.storage/);
 assert.doesNotMatch(ui,/product\.(hours|storage|needsReview)\s*=/);
 assert.doesNotMatch(art,/\beval\(/);
});
