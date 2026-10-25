import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('PRO batch queues one approved same-format label at a time',async()=>{
 const app=await read('public/farukh-print/print.js');
 assert.match(app,/const batchSelection=new Set\(\)/);
 assert.match(app,/batchSelection\.size<10/);
 assert.match(app,/function batchReady\(p\)/);
 assert.match(app,/!p\.needsReview&&!isHaccp\(p\)/);
 assert.match(app,/const success=await doPrint\(false,true\)/);
 assert.match(app,/if\(!success\).*break;/);
 assert.match(app,/nativePrintResolver=resolve/);
 assert.match(app,/const resolve=nativePrintResolver;nativePrintResolver=null;resolve\(answer\.ok===true\)/);
});
test('PRO QR scanner is local, explicitly gated by camera and has manual fallback',async()=>{
 const html=await read('public/farukh-print/index.html');
 const js=await read('public/farukh-print/print-pro-scanner.js');
 const manifest=await read('android/print/src/main/AndroidManifest.xml');
 for(const id of ['pro-qr-dialog','pro-qr-open','pro-batch-start','pro-batch-toggle','pro-batch-count'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/BarcodeDetector/);
 assert.match(js,/getUserMedia/);
 assert.match(js,/stream\.getTracks\(\)/);
 assert.doesNotMatch(js,/fetch\(/);
 assert.match(manifest,/android\.permission\.CAMERA/);
});
