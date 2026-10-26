import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {transform} from 'esbuild';

const read=name=>fs.readFile(new URL('../public/farukh-print/'+name,import.meta.url),'utf8');
const legacy=async(name)=>{
 const src=await read(name);
 return (await transform(src,{target:'es2018',format:'iife',loader:'js'})).code;
};

test('Legacy Android build exposes bundled QR generator globally and emits valid SVG',async()=>{
 const window={};
 vm.runInNewContext(await legacy('vendor/qrcode.js'),{window});
 assert.equal(typeof window.qrcode,'function','legacy transpilation must export the QR function');
 const qr=window.qrcode(0,'M');
 qr.addData('FP|roll-001');
 qr.make();
 const svg=qr.createSvgTag(6,4);
 assert.match(svg,/<svg\b/);
 assert.match(svg,/<path\b/);
});

test('QR buttons point to a functioning scanner and legacy assets are referenced',async()=>{
 const app=await read('print.js');
 const html=await read('index.html');
 assert.match(html,/legacy\/vendor\/qrcode\.js\?v=/);
 assert.match(html,/legacy\/print-pro-scanner\.js\?v=/);
 assert.match(app,/qrButton\.onclick=\(\)=>\{/);
 assert.match(app,/scanner\.showCode\(p\)/);
 assert.match(app,/scanner\.open\(\)/);
 for(const id of ['pro-qr-dialog','pro-qr-video','pro-qr-card','pro-qr-art','pro-qr-card-close','pro-qr-download']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
});

test('Product-card QR opens, remains clickable on second tap, closes and reports errors',async()=>{
 const fakeElements=new Map();
 const alerts=[];
 function node(id=''){
  return {
   id,open:false,innerHTML:'',textContent:'',onclick:null,style:{},
   handlers:{},
   addEventListener(event,fn){this.handlers[event]=fn;},
   showModal(){if(this.open)throw Error('dialog already open');this.open=true;},
   close(){this.open=false;this.handlers.close?.();},
   pause(){},
   append(){},
   remove(){},
   click(){this.onclick?.()},
   setAttribute(){},
   removeAttribute(){},
   getContext(){return null}
  };
 }
 const ids=['pro-qr-dialog','pro-qr-video','pro-qr-status','pro-qr-close',
  'pro-qr-restart','pro-qr-find','pro-qr-value','pro-qr-card','pro-qr-art',
  'pro-qr-product-name','pro-qr-product-id','pro-qr-download','pro-qr-card-close'];
 for(const id of ids)fakeElements.set(id,node(id));
 const qrWindow={alerts,alert:s=>alerts.push(s)};
 vm.runInNewContext(await legacy('vendor/qrcode.js'),{window:qrWindow});
 const body={append(){},appendChild(){}};
 const document={
  body,hidden:false,visibilityState:'visible',
  getElementById:id=>fakeElements.get(id)||null,
  createElement:tag=>node(tag),
  addEventListener(){},
 };
 const context={
  document,window:qrWindow,navigator:{mediaDevices:null},
  setTimeout,clearTimeout,URL,Blob,console
 };
 vm.runInNewContext(await legacy('print-pro-scanner.js'),context);
 const scanner=qrWindow.FARUKH_PRINT_PRO_SCANNER;
 assert.ok(scanner,'QR scanner should initialize with the page');
 const product={id:'roll-001',name:'Ролл тестовый'};
 assert.equal(scanner.showCode(product),true);
 assert.equal(fakeElements.get('pro-qr-card').open,true);
 assert.match(fakeElements.get('pro-qr-art').innerHTML,/<svg\b/);
 assert.equal(fakeElements.get('pro-qr-product-id').textContent,'Код: FP|roll-001');
 assert.equal(scanner.showCode(product),true,'second QR tap should not throw');
 fakeElements.get('pro-qr-card-close').handlers.click();
 assert.equal(fakeElements.get('pro-qr-card').open,false);
 assert.deepEqual(alerts,[]);

 delete qrWindow.qrcode;
 assert.equal(scanner.showCode(product),false,'missing QR library must report an error');
 assert.match(alerts.at(-1),/Генератор QR-кода не загрузился/);
});

test('QR scan dialog opens even without camera and explains manual fallback',async()=>{
 const elements=new Map();
 const ids=['pro-qr-dialog','pro-qr-video','pro-qr-status','pro-qr-close',
  'pro-qr-restart','pro-qr-find','pro-qr-value','pro-qr-card','pro-qr-art',
  'pro-qr-product-name','pro-qr-product-id','pro-qr-download','pro-qr-card-close'];
 for(const id of ids)elements.set(id,{
  id,open:false,textContent:'',value:'',handlers:{},
  onclick:null,addEventListener(e,f){this.handlers[e]=f;},
  showModal(){this.open=true;},close(){this.open=false;},
  getContext(){return null;},pause(){},setAttribute(){},append(){},
 });
 const document={
  getElementById:id=>elements.get(id)||null,
  createElement:()=>({getContext(){return null}}),
  addEventListener(){},
  hidden:false
 };
 const win={alert(){}};
 vm.runInNewContext(await legacy('print-pro-scanner.js'),{document,window:win,navigator:{},setTimeout,clearTimeout,console});
 win.FARUKH_PRINT_PRO_SCANNER.open();
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(elements.get('pro-qr-dialog').open,true);
 assert.match(elements.get('pro-qr-status').textContent,/Камера недоступна.*вручную/i);
 elements.get('pro-qr-close').onclick();
 assert.equal(elements.get('pro-qr-dialog').open,false);
});
