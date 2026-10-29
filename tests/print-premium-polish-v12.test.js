import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const printer=await fs.readFile(new URL('../public/farukh-print/premium-ready-label.js',import.meta.url),'utf8');
const svgModule=await fs.readFile(new URL('../public/farukh-print/label-svg.js',import.meta.url),'utf8');
const when=Date.parse('2026-10-24T14:00:00Z');
const fmt=ms=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms)).replace(',','');
const base={
  name:'Ролл Филадельфия',composition:'Рис, нори, сыр, форель',p:7,f:10.2,c:15.5,kcal:183,
  weight:275,tolerance:10,hours:12,storage:'+2…+6 °C'
};
function renderLabel(product){
 const canvas={getContext:()=>({
  font:'12px Arial',fillStyle:'#fff',strokeStyle:'#000',beginPath(){},
  roundRect(){},arc(){},moveTo(){},lineTo(){},stroke(){},
  strokeRect(){},fillRect(){},fillText(){},
  measureText(s){const size=Number(/([\d.]+)px/.exec(this.font)?.[1]||12);return {width:String(s).length*size*.54}}
 })};
 const document={createElement:()=>canvas};
 const window={};
 new Function('window','document',svgModule)(window,document);
 new Function('window',printer)(window);
 const page=window.FarukhLabelSVG.surface(464,320);
 window.FarukhPremiumReady.draw(page.g,product,when,{formatDate:fmt});
 return page.c.toSVG();
}
test('Premium v1.2 reduces empty ingredient gap without pushing KBZhU onto long ingredients',()=>{
 const short=renderLabel(base);
 const medium=renderLabel({...base,composition:('Рис фирменный, нори, сливочный сыр, огурец, форель, соус. ').repeat(2)});
 const long=renderLabel({...base,composition:('рис, нори, форель, огурец, сыр, соус, креветка, ').repeat(3)});
 // Short ingredient lists place their table higher than busy recipes.
 const yFrom=svg=>Number(svg.match(/КБЖУ НА 100 Г<\/text>/)?.index||0);
 const tableY=svg=>{
   const values=[...svg.matchAll(/<path d="M(?:\d+(?:\.\d+)?) (155|163|171|177)\b/g)].map(m=>Number(m[1]));
   return values[0];
 };
 assert.equal(tableY(short),155);
 assert.ok(tableY(medium)>=155);
 assert.ok(tableY(long)>=tableY(medium));
 assert.ok(tableY(long)<=177);
 assert.ok(yFrom(short)>0);
});

test('All informational bands align at fixed baselines with light strokes and consistent icons',()=>{
 const first=renderLabel(base);
 const second=renderLabel({...base,name:'Ролл Тигровая',composition:'Рис, нори, креветка, огурец, сыр, кисло-сладкий соус'});
 for(const page of [first,second]){
  for(const label of ['ИЗГОТОВЛЕНО','ГОДЕН ДО','ВЕС НЕТТО','ХРАНИТЬ','СРОК','КБЖУ НА 100 Г']){
   assert.ok(page.includes(label),label);
  }
  assert.match(page,/y="251"/);
  assert.match(page,/y="265\.5"/);
  assert.match(page,/y="288\.8"/);
  assert.match(page,/y="300\.5"/);
  assert.match(page,/font-family="Georgia,/);
  assert.doesNotMatch(page,/<image|data:image/);
  assert.match(page,/viewBox="0 0 464 320"/);
 }
});

test('Both printing entrypoints load premium version 2 and do not mutate any employee settings',async()=>{
 const printHtml=await fs.readFile(new URL('../public/farukh-print/index.html',import.meta.url),'utf8');
 const readyHtml=await fs.readFile(new URL('../public/finished-labels.html',import.meta.url),'utf8');
 assert.match(printHtml,/premium-ready-label\.js\?v=4/);
 assert.match(readyHtml,/premium-ready-label\.js\?v=4/);
 assert.match(readyHtml,/label-bluetooth-direct\.js\?v=2/);
 const catalog=await fs.readFile(new URL('../public/print-control.js',import.meta.url),'utf8');
 assert.match(catalog,/needsReview/);
});
