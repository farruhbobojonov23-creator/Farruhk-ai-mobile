import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const renderer=await fs.readFile(new URL('../public/farukh-print/premium-ready-label.js',import.meta.url),'utf8');
const vector=await fs.readFile(new URL('../public/farukh-print/label-svg.js',import.meta.url),'utf8');
const date=Date.parse('2026-10-24T15:00:00Z');
const time=ms=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms)).replace(',','');
const product={
 name:'Ролл Тигровая',
 composition:'Рис фирменный (готовый, заправленный), Водоросли Нори, Сыр творожный, Огурец свежая, Креветка отварная слайсы, Соус кисло сладкий (поливается)',
 p:6.4,f:7.2,c:27.7,kcal:201.3,weight:270,tolerance:10,hours:12,storage:'+2…+6 °C'
};
function svg(p){
 const window={};
 const document={createElement:()=>({getContext:()=>({
  font:'12px Arial',fillStyle:'#000',strokeStyle:'#000',
  measureText(v){let px=Number(/([\d.]+)px/.exec(this.font)?.[1]||12);return {width:String(v).length*px*(this.font.includes('Georgia')?.55:.53)}}
 })})};
 new Function('window','document',vector)(window,document);
 new Function('window',renderer)(window);
 const page=window.FarukhLabelSVG.surface(464,320);
 window.FarukhPremiumReady.draw(page.g,p,date,{formatDate:time});
 return page.c.toSVG();
}
test('Состав is drawn once; ingredients begin after actual bold label with a space',()=>{
 const result=svg(product);
 const found=[...result.matchAll(/<text x="([^"]+)" y="117\.5"[^>]*>([^<]*)<\/text>/g)];
 assert.equal(found.length,2, 'first ingredient baseline must contain exactly two text runs');
 assert.equal(found[0][2],'Состав:');
 assert.equal(Number(found[0][1]),21);
 assert.ok(Number(found[1][1])>70,'ingredients must start right of bold title');
 assert.match(found[1][2],/^Рис\s+фирменный/);
 assert.equal([...result.matchAll(/>Состав:<\/text>/g)].length,1);
 assert.doesNotMatch(found[1][2],/Состав:/);
 assert.match(result,/Креветка/);
 assert.match(result,/кисло/);
});
test('Very short composition and long compositions both render without doubled prefix',()=>{
 for(const composition of [
  'Рис, нори, сыр, форель',
  'Рис фирменный (готовый, заправленный), Водоросли Нори, Сыр творожный, Огурец свежий, Форель слайсы',
  'Рис, нори, сыр творожный, огурец, креветки, соус, кунжут, тунец, зелёный лук, икра, имбирь'
 ]){
  const result=svg({...product,composition});
  assert.equal([...result.matchAll(/>Состав:<\/text>/g)].length,1);
  assert.match(result,/КБЖУ НА 100 Г/);
  assert.doesNotMatch(result,/<image/);
 }
});
test('Expiry is a precise hourglass rather than a clock and is legibly labeled',()=>{
 const result=svg(product);
 assert.match(result,/СРОК ГОДН\./);
 assert.match(result,/12 ч/);
 assert.match(renderer,/function hourglass\(g,x,y\)/);
 assert.match(renderer,/hourglass\(g,320,283\.5\)/);
 assert.doesNotMatch(renderer,/clock\(g,320/);
 assert.match(result,/viewBox="0 0 464 320"/);
});
test('Both AI and PRINT must request corrected v3 so mobile browsers do not display stale labels',async()=>{
 const page=await fs.readFile(new URL('../public/farukh-print/index.html',import.meta.url),'utf8');
 const ai=await fs.readFile(new URL('../public/finished-labels.html',import.meta.url),'utf8');
 assert.match(page,/premium-ready-label\.js\?v=3/);
 assert.match(ai,/premium-ready-label\.js\?v=3/);
});
