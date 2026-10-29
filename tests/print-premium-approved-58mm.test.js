import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source=await fs.readFile(new URL('../public/farukh-print/premium-ready-label.js',import.meta.url),'utf8');
const vector=await fs.readFile(new URL('../public/farukh-print/label-svg.js',import.meta.url),'utf8');
const print=await fs.readFile(new URL('../public/farukh-print/print.js',import.meta.url),'utf8');
const printPage=await fs.readFile(new URL('../public/farukh-print/index.html',import.meta.url),'utf8');
const aiPage=await fs.readFile(new URL('../public/finished-labels.html',import.meta.url),'utf8');
const aiBluetooth=await fs.readFile(new URL('../public/label-bluetooth-direct.js',import.meta.url),'utf8');

function env(){
 const doc={createElement(name){
  assert.equal(name,'canvas');
  const ctx={
   font:'12px Arial',fillStyle:'#fff',strokeStyle:'#000',
   beginPath(){},roundRect(){},arc(){},moveTo(){},lineTo(){},stroke(){},
   strokeRect(){},fillRect(){},fillText(){},
   measureText(s){
    const fs=Number(/([\d.]+)px/.exec(this.font)?.[1]||12);
    return {width:String(s).length*fs*(this.font.includes('Georgia')?.55:.50)};
   }
  };
  return {getContext(){return ctx}};
 }};
 const win={};
 new Function('window','document',vector)(win,doc);
 new Function('window',source)(win);
 return win;
}
const when=Date.parse('2026-10-24T13:40:00Z');
const fmt=ms=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms)).replace(',','');
const roll={
 kind:'ready',name:'Ролл Тигровая',
 composition:'Рис фирменный (готовый, заправленный), Водоросли Нори, Сыр творожный, Огурец свежий, Креветка отварная слайсы, Соус кисло-сладкий (поливается)',
 p:6.4,f:7.2,c:27.7,kcal:201.3,weight:270,tolerance:10,hours:12,storage:'+2…+6 °C'
};

test('Approved template is exactly 58×40 mm and uses genuine scalable paths, not raster screenshots',()=>{
 const w=env(),s=w.FarukhLabelSVG.surface(464,320);
 w.FarukhPremiumReady.draw(s.g,roll,when,{formatDate:fmt});
 const svg=s.c.toSVG();
 assert.match(svg,/width="58mm" height="40mm" viewBox="0 0 464 320"/);
 assert.match(svg,/РОЛЛ ТИГРОВАЯ/);
 assert.match(svg,/СУШИ БЕРИ/);
 assert.match(svg,/ГОТОВАЯ ПРОДУКЦИЯ/);
 assert.match(svg,/КБЖУ НА 100 Г/);
 assert.match(svg,/Состав:/);
 assert.match(svg,/6,4/);assert.match(svg,/7,2/);assert.match(svg,/27,7/);assert.match(svg,/201,3/);
 assert.match(svg,/270 г ±10 г/);assert.match(svg,/\+2…\+6 °C/);assert.match(svg,/12 ч/);
 assert.match(svg,/24\.10\.26 16:40/);assert.match(svg,/25\.10\.26 04:40/);
 assert.match(svg,/font-family="Georgia,/);
 assert.match(svg,/ A\d+ \d+ 0 1 0/); // geometric clock and weight circles
 assert.match(svg,/ Q\d+ \d+/); // rounded premium borders
 assert.doesNotMatch(svg,/<image|data:image/);
});

test('No substitute demo values and all information always comes from real product',()=>{
 const w=env(),p={...roll,name:'Ролл Шеф',hours:24,weight:305,p:4.1,kcal:173,storage:'0…+2 °C'};
 const s=w.FarukhLabelSVG.surface(464,320);
 w.FarukhPremiumReady.draw(s.g,p,when,{formatDate:fmt});
 const svg=s.c.toSVG();
 for(const actual of ['РОЛЛ ШЕФ','305 г','4,1','173','24 ч','0…+2 °C'])assert.ok(svg.includes(actual),actual);
 for(const old of ['РОЛЛ ТИГРОВАЯ','270 г','201,3','12 ч'])assert.ok(!svg.includes(old),old);
 assert.throws(()=>w.FarukhPremiumReady.draw(s.g,{...p,composition:''},when,{formatDate:fmt}),/Требуются/);
 assert.throws(()=>w.FarukhPremiumReady.draw(s.g,{...p,hours:0},when,{formatDate:fmt}),/Требуются/);
});

test('FARUKH AI, FARUKH PRINT and direct V3 printing are all wired to one approved design',()=>{
 assert.match(printPage,/premium-ready-label\.js\?v=4/);
 assert.match(printPage,/label-svg\.js\?v=3/);
 assert.match(print,/FarukhPremiumReady\.draw\(g,p,epoch/);
 assert.match(aiPage,/premium-ready-label\.js\?v=4/);
 assert.match(aiPage,/FarukhPremiumReady\.draw\(surface\.g,p,epoch/);
 assert.match(aiPage,/premium-svg-label/);
 assert.match(aiBluetooth,/FarukhPremiumReady\.draw\(g,p,epoch/);
 assert.match(aiPage,/label-bluetooth-direct\.js\?v=2/);
 assert.match(print,/p\.needsReview\|\|!str\(p\.storage\)/);
 assert.match(aiPage,/p\.needsReview\|\|p\.sourceChanged/);
});


test('Universal premium 58×40 preserves gram defaults and displays volume, pieces and kilogram labels',()=>{
 const w=env();
 for(const [unit,amount,tolerance,caption,quantity,nutrition] of [
  [undefined,270,10,'ВЕС НЕТТО','270 г ±10 г','КБЖУ НА 100 Г'],
  ['г',270,10,'ВЕС НЕТТО','270 г ±10 г','КБЖУ НА 100 Г'],
  ['кг',1.2,0.1,'ВЕС НЕТТО','1,2 кг ±0,1 кг','КБЖУ НА 100 Г'],
  ['мл',500,10,'ОБЪЁМ НЕТТО','500 мл ±10 мл','КБЖУ НА 100 МЛ'],
  ['л',0.5,0.05,'ОБЪЁМ НЕТТО','0,5 л ±0,05 л','КБЖУ НА 100 МЛ'],
  ['шт',2,0,'КОЛИЧЕСТВО','2 шт','КБЖУ НА 100 Г']
 ]){
  const s=w.FarukhLabelSVG.surface(464,320);
  w.FarukhPremiumReady.draw(s.g,{...roll,weight:amount,tolerance,weightUnit:unit},when,{formatDate:fmt});
  const svg=s.c.toSVG();
  assert.match(svg,/width="58mm" height="40mm" viewBox="0 0 464 320"/);
  assert.ok(svg.includes(caption),String(unit));
  assert.ok(svg.includes(quantity),String(unit));
  assert.ok(svg.includes(nutrition),String(unit));
  assert.ok(svg.includes('СУШИ БЕРИ'),String(unit));
  assert.ok(svg.includes('ГОДЕН ДО'),String(unit));
 }
});
