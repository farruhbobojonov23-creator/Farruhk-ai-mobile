import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const get=async name=>readFile(new URL('../public/'+name,import.meta.url),'utf8');
const prep=await get('farukh-print/premium-prep-label.js');
const svgModule=await get('farukh-print/label-svg.js');
function render(product){
 const window={};
 const document={createElement:tag=>{
  assert.equal(tag,'canvas');
  return {getContext:()=>({
   font:'12px Arial',fillStyle:'#000',strokeStyle:'#000',textAlign:'left',
   fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},roundRect(){},
   measureText(s){const n=Number(/([\d.]+)px/.exec(this.font)?.[1]||12);return {width:String(s).length*n*(this.font.includes('Georgia')?.52:.47)};}
  })}
 }};
 new Function('window','document',svgModule)(window,document);
 new Function('window',prep)(window);
 const sheet=window.FarukhLabelSVG.surface(240,160);
 window.FarukhPremiumPrep.draw(sheet.g,product,Date.parse('2026-10-24T15:00:00Z'),{
  formatDate:ms=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms)).replace(',','')
 });
 return sheet.c.toSVG();
}
const fish={name:'Форель',storage:'+2…+6 °C',hours:24,prepEvent:'thawed'};
test('Approved variant 3 is a 30x20 black-and-white SVG with no ingredients or KBZhU',()=>{
 const result=render(fish);
 assert.match(result,/width="30mm" height="20mm" viewBox="0 0 240 160"/);
 for(const word of ['СУШИ БЕРИ','ПОЛУФАБРИКАТ','ФОРЕЛЬ','РАЗМОРОЖЕНО','ГОДЕН ДО','ХРАНИТЬ','СРОК','24 ч'])assert.ok(result.includes(word),word);
 assert.match(result,/24\.10\.26 18:00/);
 assert.match(result,/25\.10\.26 18:00/);
 assert.match(result,/\+2…\+6 °C/);
 assert.doesNotMatch(result,/Состав:|КБЖУ|<image/);
 assert.match(result,/font-family="Georgia,/);
 assert.match(result,/ Q\d+/);
});
test('Manual blank template permits different dates and shelf-lives but never invents them',()=>{
 assert.match(render({...fish,name:'Омлет',storage:'+1…+4 °C',hours:12,prepEvent:'prepared'}),/ИЗГОТОВЛЕНО/);
 const opened=render({...fish,name:'Соус спайси',hours:7,prepEvent:'opened'});
 assert.match(opened,/ВСКРЫТО/);assert.match(opened,/7 ч/);
 assert.doesNotMatch(opened,/>24 ч<|>РАЗМОРОЖЕНО</);
 assert.throws(()=>render({...fish,hours:null}),/проверенный срок/);
 assert.throws(()=>render({...fish,storage:''}),/проверенный срок/);
 assert.throws(()=>render({...fish,name:''}),/проверенный срок/);
});
test('Full catalog of older preparations uses approved template without new ingredient fields',async()=>{
 const ui=await get('farukh-print/print.js');
 const html=await get('farukh-print/index.html');
 const css=await get('farukh-print/print.css');
 assert.match(ui,/window\.FarukhPremiumPrep\.draw\(g,p,epoch/);
 assert.match(ui,/return drawPrepPrevious\(p,epoch,point,scale,vector\)/);
 assert.match(html,/premium-prep-label\.js\?v=1/);
 assert.match(html,/use-premium-prep/);
 assert.match(html,/home-premium-prep/);
 assert.match(html,/print\.js\?v=37/);
 assert.match(html,/print\.css\?v=22/);
 assert.match(ui,/fields\.prepEvent=\$\('edit-prep-event'\)\.value/);
 assert.match(ui,/fields\.labelStyle='premium-prep-30x20'/);
 assert.match(ui,/const needsReview=!\$\('edit-approval'\)\.checked/);
 assert.match(ui,/if\(p\.needsReview\|\|!str\(p\.storage\)/);
 assert.match(css,/body\.worker-managed #premium-prep-card/);
});
test('FARUKH AI owner controls can fill small approved blank template and preview in SVG',async()=>{
 const owner=await get('print-control.js');
 const home=await get('index.html');
 assert.match(owner,/Премиальная этикетка полуфабриката/);
 assert.match(owner,/edit\(null,'prep'\)/);
 assert.match(owner,/labelStyle='premium-prep-30x20'/);
 assert.match(owner,/FarukhPremiumPrep\.draw\(surface\.g,p/);
 assert.match(owner,/premium-prep-label\.js\?v=1/);
 assert.match(owner,/prepEvent:/);
 assert.match(home,/print-control\.js\?v=\d+/);
 assert.match(home,/print-control\.css\?v=\d+/);
});
