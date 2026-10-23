import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

class FakeCanvas {
 constructor(){
  this.width=0;this.height=0;this.font='12px Arial';
  const c=this;
  this.context={
   fillStyle:'#fff',strokeStyle:'#000',lineWidth:1,font:'12px Arial',
   fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},scale(){},
   measureText(str){
    const fontSize=Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1]||12);
    return {width:String(str).length*fontSize*0.54};
   },
   getImageData(x,y,w,h){return {data:new Uint8ClampedArray(w*h*4)}}
  }
 }
 getContext(){return this.context}
}
const doc={createElement(name){assert.equal(name,'canvas');return new FakeCanvas()}};
const js=await fs.readFile(new URL('../public/farukh-print/print.js',import.meta.url),'utf8');
const end='boot();\n})();';
assert.ok(js.includes(end),'Expected FARUKH PRINT source structure');
const hooked=js.replace(end,"window.__labelTest={drawPrep,drawReady,tspl};\n})();");
const w={};
new Function('window','document',hooked)(w,doc);
const {drawPrep,drawReady,tspl}=w.__labelTest;

test('premium v2 exact 30x20 physical raster and crisp 3x preview',()=>{
 const p={name:'Бульон Том Ям',storage:'+2…+6 °C',hours:48};
 const at=new Date('2026-10-23T19:00:00Z').getTime();
 const physical=drawPrep(p,at,'Плазма');
 assert.deepEqual([physical.width,physical.height],[240,160]);
 const preview=drawPrep(p,at,'Плазма',3);
 assert.deepEqual([preview.width,preview.height],[720,480]);
 const bytes=tspl(physical,1);
 const start=new TextDecoder().decode(bytes.subarray(0,125));
 assert.match(start,/\r\nSIZE 30 mm,20 mm\r\n/);
 assert.match(start,/BITMAP 0,0,30,160,0,/);
 assert.match(new TextDecoder().decode(bytes.subarray(-11)),/PRINT 1,1/);
 assert.equal(bytes.length,new TextEncoder().encode('\r\nSIZE 30 mm,20 mm\r\nGAP 2 mm,0 mm\r\nSPEED 3\r\nDENSITY 8\r\nDIRECTION 0,0\r\nREFERENCE 0,0\r\nCLS\r\nBITMAP 0,0,30,160,0,').length+4800+new TextEncoder().encode('\r\nPRINT 1,1\r\n').length);
});
test('long product names fit two lines and ready format stays 58x40',()=>{
 const at=Date.now();
 for(const name of ['Соус спайси','Курица готовая','Снежный краб','Фирменный соус','Бульон Том Ям','Сливочный соус']){
  assert.equal(drawPrep({name,storage:'+2…+6 °C',hours:24},at,'Плазма').width,240);
 }
 const ready=drawReady({name:'Калифорния',composition:'рис, краб, огурцы',p:1,f:1,c:1,kcal:150,weight:210,tolerance:10,storage:'+2…+6 °C',hours:12},at);
 assert.deepEqual([ready.width,ready.height],[464,320]);
 assert.match(new TextDecoder().decode(tspl(ready,1).subarray(0,35)),/SIZE 58 mm,40 mm/);
});
test('FARUKH AI and Android print validators use 30x20 consistently',async()=>{
 for(const path of [
  '../public/farukh-print/index.html',
  '../public/marking.html',
  '../public/print-control.js',
  '../public/index.html',
  '../android/print/src/main/java/ai/farukh/print/MainActivity.java',
  '../android/app/src/main/java/ai/farukh/mobile/MainActivity.java'
 ]){
  const src=await fs.readFile(new URL(path,import.meta.url),'utf8');
  assert.doesNotMatch(src,/31\s*(?:×|mm|x)\s*20|31mm|BITMAP 0,0,31,160/,'legacy format in '+path);
 }
});
