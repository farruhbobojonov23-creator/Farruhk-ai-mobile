import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const printCode=await fs.readFile(new URL('../public/farukh-print/print.js',import.meta.url),'utf8');
const svgCode=await fs.readFile(new URL('../public/farukh-print/label-svg.js',import.meta.url),'utf8');
const injected=printCode.replace('boot();\n})();','window.__labelv3={drawReady,drawPrep,tspl};\n})();');
assert.notEqual(injected,printCode);

function harness(){
 class TestCanvas{
  constructor(){this.width=0;this.height=0;this.ctx={
    font:'12px Arial,sans-serif',lineWidth:1,textAlign:'left',
    fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},scale(){},
    measureText(s){const px=Number(/([\d.]+)px/.exec(this.font)?.[1]||12);return {width:String(s).length*px*.48}},
    getImageData(x,y,w,h){const data=new Uint8ClampedArray(w*h*4);data.fill(255);return {data}}
  }}
  getContext(){return this.ctx}
 }
 const doc={createElement(tag){assert.equal(tag,'canvas');return new TestCanvas()}};
 const win={};
 new Function('window','document',svgCode)(win,doc);
 new Function('window','document',injected)(win,doc);
 return {win,...win.__labelv3};
}
const data={
 name:'Калифорния',kind:'ready',composition:'рис, нори, снежный краб, огурец, сыр',
 p:6.2,f:3.1,c:22.4,kcal:155,weight:230,tolerance:10,storage:'+2…+6 °C',hours:12
};
const date=Date.parse('2026-10-24T13:00:00Z');

test('Both premium labels remain crisp physical-size SVG and preserve actual TTK values',()=>{
 const {drawReady,drawPrep}=harness();
 const ready=drawReady(data,date,1,true).toSVG();
 const prep=drawPrep({name:'Форель',storage:'0…+2 °C',hours:16},date,'Плазма',1,true).toSVG();
 assert.match(ready,/width="58mm" height="40mm"/);
 assert.match(prep,/width="30mm" height="20mm"/);
 assert.match(ready,/КАЛИФОРНИЯ/);
 assert.match(ready,/рис, нори, снежный краб, огурец, сыр/);
 for(const value of ['230 г ±10 г','6,2','3,1','22,4','155','12 ч','+2…+6 °C'])assert.ok(ready.includes(value),'Missing original value '+value);
 assert.match(prep,/ФОРЕЛЬ/);
 assert.match(prep,/16:|16 ч|Годен до:/);
 assert.match(prep,/0…\+2 °C/);
 assert.doesNotMatch(ready,/<image|fill="#[Ff]{2}0000"/);
 assert.doesNotMatch(prep,/<image/);
});

test('Unchanged underlying pixel grid and Bluetooth TSPL sizes',()=>{
 const {drawReady,drawPrep,tspl}=harness();
 const r=drawReady(data,date),p=drawPrep({name:'Форель',storage:'+2…+6 °C',hours:12},date,'Плазма');
 assert.deepEqual([r.width,r.height],[464,320]);
 assert.deepEqual([p.width,p.height],[240,160]);
 const headerReady=new TextDecoder().decode(tspl(r,1).subarray(0,136));
 const headerPrep=new TextDecoder().decode(tspl(p,1).subarray(0,136));
 assert.match(headerReady,/SIZE 58 mm,40 mm/);
 assert.match(headerReady,/BITMAP 0,0,58,320,0,/);
 assert.match(headerPrep,/SIZE 30 mm,20 mm/);
 assert.match(headerPrep,/BITMAP 0,0,30,160,0,/);
});

test('Labels never replace product data with demo tuna or cucumber shelf life',()=>{
 const {drawPrep,drawReady}=harness();
 const a=drawPrep({name:'Огурцы',storage:'+2…+6 °C',hours:24},date,'Плазма',1,true).toSVG();
 const b=drawReady({...data,name:'Тунец',hours:7,storage:'0…+2 °C'},date,1,true).toSVG();
 assert.match(a,/ОГУРЦЫ/);assert.match(a,/\+2…\+6 °C/);
 assert.match(b,/ТУНЕЦ/);assert.match(b,/7 ч/);
 assert.doesNotMatch(b,/>48 ч</);
 const unknown={...data,name:'Сыр',composition:'Рис',hours:0,storage:''};
 // Actual validation remains in makePreview and blocks unapproved settings.
 assert.match(printCode,/p\.needsReview\|\|!str\(p\.storage\)/);
 assert.match(printCode,/Срок и условия хранения/);
});
