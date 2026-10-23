import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const src=await fs.readFile(new URL('../public/farukh-print/print.js',import.meta.url),'utf8');
function makeHarness({managed=false,staffApi=null}={}){
 const sent=[];
 class Canvas{
  constructor(){this.width=0;this.height=0;this.ctx={
    fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},scale(){},drawImage(){},clearRect(){},
    font:'12px Arial',
    measureText(word){const fontSize=Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1]||12);return {width:String(word).length*fontSize*0.52}},
    getImageData(x,y,w,h){const data=new Uint8ClampedArray(w*h*4);data.fill(255);return {data}}
   }}
  getContext(){return this.ctx}
 }
 const elems={};
 const doc={
  createElement(tag){assert.equal(tag,'canvas');return new Canvas()},
  getElementById(id){return elems[id] ||= {value:id==='copies'?'1':id==='printed-at'?'2026-10-23T20:00':'',dataset:{},disabled:false,hidden:false,textContent:''}}
 };
 const win={FarukhPrinter:{postMessage(data){sent.push(JSON.parse(data))}},FARUKH_PRINT_STAFF_API:staffApi};
 const hook=src.replace('boot();\n})();',
 "window.__unit={tspl,doPrint,legacy:()=>legacyNative30Transport,pending:()=>pendingNativePrint,setSelected(p){products=[p];kind='prep';selected=p.id}};\n})();");
 assert.notEqual(hook,src);
 new Function('window','document','localStorage',hook)(win,doc,{getItem:key=>key==='farukh-print:staff-managed:v1'&&managed?'1':null});
 const item={kind:'prep',name:'Бульон Том Ям',id:'broth',storage:'+2…+6 °C',hours:48,needsReview:false,point:''};
 win.__unit.setSelected(item);
 return {win,doc,sent,api:win.__unit,elems};
}
const payload=(packet)=>new Uint8Array(Buffer.from(packet.tspl,'base64'));
const marker=(p)=>new TextDecoder().decode(payload(p).subarray(0,130));

test('native 30×20 request uses exact physical dimensions',()=>{
 const {api,sent}=makeHarness();
 api.doPrint();
 assert.equal(sent.length,1);
 assert.match(marker(sent[0]),/SIZE 30 mm,20 mm/);
 assert.match(marker(sent[0]),/BITMAP 0,0,30,160,0,/);
});
test('old FARUKH PRINT 31×20 bridge retries rejected 30mm job exactly once with one white padded byte per scanline',()=>{
 const {api,win,sent,elems}=makeHarness();
 api.doPrint();
 win.FarukhPrinter.onmessage({data:JSON.stringify({ok:false,message:'Неверный формат данных этикетки: размер должен быть 58×40 или 31×20'})});
 assert.equal(sent.length,2);
 assert.match(marker(sent[1]),/SIZE 31 mm,20 mm/);
 assert.match(marker(sent[1]),/BITMAP 0,0,31,160,0,/);
 assert.equal(api.legacy(),true);
 const header=new TextEncoder().encode('\r\nSIZE 31 mm,20 mm\r\nGAP 2 mm,0 mm\r\nSPEED 3\r\nDENSITY 8\r\nDIRECTION 0,0\r\nREFERENCE 0,0\r\nCLS\r\nBITMAP 0,0,31,160,0,');
 const data=payload(sent[1]);
 for(let y=0;y<160;y++)assert.equal(data[header.length+y*31+30],255,'padding byte '+y+' is always white');
 win.FarukhPrinter.onmessage({data:JSON.stringify({ok:true,message:'Печать завершена.'})});
 assert.equal(sent.length,2);
 assert.match(elems['print-message'].textContent,/Режим совместимости/);
 assert.equal(api.pending(),null);
 api.doPrint();
 assert.equal(sent.length,3);
 assert.match(marker(sent[2]),/SIZE 31 mm,20 mm/);
});
test('never retry Bluetooth failures that may have printed labels',()=>{
 const {api,win,sent}=makeHarness();
 api.doPrint();
 win.FarukhPrinter.onmessage({data:JSON.stringify({ok:false,message:'Bluetooth-соединение прервано.'})});
 assert.equal(sent.length,1);
 assert.equal(api.legacy(),false);
});
test('modern Android bridge receives exact 30mm TSPL and does not retry',()=>{
 const {api,win,sent}=makeHarness();
 api.doPrint();
 win.FarukhPrinter.onmessage({data:JSON.stringify({ok:true,message:'Напечатано.'})});
 assert.equal(sent.length,1);
 assert.equal(api.legacy(),false);
});

test('paired staff-managed FARUKH PRINT cannot print before employee sign-in',async()=>{
 const {api,sent,elems}=makeHarness({managed:true});
 await api.doPrint();
 assert.equal(sent.length,0);
 assert.match(elems['print-message'].textContent,/Войди|войти/i);
});
test('paired staff-managed FARUKH PRINT requires successful server permission before Bluetooth output',async()=>{
 const requests=[];
 const staffApi={point:()=> 'Плазма',async authorize(j){requests.push(j);return {ok:true}}};
 const {api,sent,elems}=makeHarness({managed:true,staffApi});
 await api.doPrint();
 assert.equal(requests.length,1);
 assert.equal(requests[0].product.name,'Бульон Том Ям');
 assert.equal(elems['point-name'].value,'Плазма');
 assert.equal(sent.length,1);
});
test('server rejection or offline state blocks staff-managed Bluetooth output',async()=>{
 const staffApi={point:()=> 'Плазма',async authorize(){throw Error('Нет подключения к серверу.')}};
 const {api,sent,elems}=makeHarness({managed:true,staffApi});
 await api.doPrint();
 assert.equal(sent.length,0);
 assert.match(elems['print-message'].textContent,/не выполнена/i);
});
