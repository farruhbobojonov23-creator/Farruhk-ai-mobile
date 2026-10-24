import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const svgCode=await fs.readFile(new URL('../public/farukh-print/label-svg.js',import.meta.url),'utf8');
const printCode=await fs.readFile(new URL('../public/farukh-print/print.js',import.meta.url),'utf8');
const hooked=printCode.replace('boot();\n})();','window.__vectors={drawReady,drawPrep,doPrint,setProduct(p){products=[p];kind=p.kind;selected=p.id}};\n})();');
assert.notEqual(hooked,printCode,'Expected print.js entrypoint');

function env(){
 const packets=[],els={};
 class FakeCanvas {
  constructor(){this.width=0;this.height=0;this.ctx={
   font:'12px Arial',fillStyle:'#fff',textAlign:'left',
   fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},scale(){},
   getImageData(x,y,w,h){const data=new Uint8ClampedArray(w*h*4);data.fill(255);return {data}},
   measureText(value){const font=Number(/([\d.]+)px/.exec(this.font)?.[1]||12);return {width:String(value).length*font*0.45}}
  }}
  getContext(){return this.ctx}
 }
 const doc={
  createElement(name){assert.equal(name,'canvas');return new FakeCanvas()},
  getElementById(id){return els[id] ||= {value:id==='copies'?'1':id==='printed-at'?'2026-10-24T12:00':'',disabled:false,textContent:'',dataset:{}}},
 };
 const win={FarukhPrinter:{postMessage(value){packets.push(JSON.parse(value))}}};
 const storage={getItem:()=>null};
 new Function('window','document',svgCode)(win,doc);
 new Function('window','document','localStorage',hooked)(win,doc,storage);
 return {win,doc,packets,els,testApi:win.__vectors,FakeCanvas};
}
const sampleReady={
 id:'ready1',kind:'ready',name:'Калифорния',composition:'рис & сыр <огурец>',
 p:5,f:4,c:20,kcal:136,weight:230,tolerance:10,storage:'+2…+6 °C',hours:12
};
const samplePrep={id:'prep1',kind:'prep',name:'Бульон Том Ям',point:'Плазма',storage:'+2…+6 °C',hours:48};
const time=new Date('2026-10-24T10:00:00Z').getTime();

test('both label formats are real vector SVG with native physical size',()=>{
 const {testApi}=env();
 const ready=testApi.drawReady(sampleReady,time,1,true).toSVG();
 const prep=testApi.drawPrep(samplePrep,time,'Плазма',1,true).toSVG();
 assert.match(ready,/width="58mm" height="40mm" viewBox="0 0 464 320"/);
 assert.match(prep,/width="30mm" height="20mm" viewBox="0 0 240 160"/);
 for(const value of [ready,prep]){
  assert.match(value,/<path /);
  assert.match(value,/<text /);
  assert.match(value,/<rect /);
  assert.doesNotMatch(value,/<image /);
 }
 assert.match(ready,/СУШИ БЕРИ/);
 assert.match(prep,/БУЛЬОН ТОМ ЯМ/);
 assert.match(ready,/рис &amp; сыр &lt;огурец&gt;/);
});
test('Bluetooth raster comes from exactly the SVG used for label preview',async()=>{
 const {win,packets,testApi,FakeCanvas}=env();
 testApi.setProduct(samplePrep);
 let used=false;
 win.FarukhLabelSVG.rasterize=async(svg,w,h)=>{
  used=true;
  assert.match(svg,/БУЛЬОН ТОМ ЯМ/);
  assert.deepEqual([w,h],[240,160]);
  const result=new FakeCanvas();
  result.width=w;result.height=h;
  return result;
 };
 await testApi.doPrint();
 assert.equal(used,true);
 assert.equal(packets.length,1);
 const bytes=Buffer.from(packets[0].tspl,'base64');
 assert.match(bytes.toString('utf8',0,135),/SIZE 30 mm,20 mm/);
 assert.match(bytes.toString('utf8',0,135),/BITMAP 0,0,30,160,0,/);
});
