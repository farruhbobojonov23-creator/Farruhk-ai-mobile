import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Read-only V3 BT health and explicit switch use the selected printer safely',async()=>{
 const n=await read('android/print/src/main/java/ai/farukh/print/MainActivity.java');
 const js=await read('public/farukh-print/print.js');
 const html=await read('public/farukh-print/index.html');
 assert.match(n,/if \("status"\.equals\(type\)\) \{ printerStatus\(reply\); return; \}/);
 assert.match(n,/Bluetooth включён/);
 assert.match(n,/!pendingSelectOnly/);
 assert.match(n,/\? " · текущий" : ""/);
 assert.match(js,/sendNative\(\{type:'status'\}\)/);
 assert.match(html,/id="check-printer"/);
 assert.match(html,/print-premium\.css\?v=\d+/);
});
