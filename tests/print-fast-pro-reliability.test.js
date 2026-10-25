import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('Authenticated cloud sync uses 304 for unchanged catalog',async()=>{
 const api=await read('print-sync-api.js'),client=await read('public/farukh-print/print-sync.js');
 assert.match(api,/If-None-Match/);assert.match(api,/res\.status\(304\)\.end\(\)/);
 assert.match(api,/device\/catalog',protectDevice,wrap/);
 assert.match(client,/res\.status===304/);assert.match(client,/state\.notModified/);
 assert.match(client,/state\.revision!==cloudRev\|\|!localMatches/);
});
test('Catalog selection avoids re-render and print needs conscious duplicate consent',async()=>{
 const js=await read('public/farukh-print/print.js');
 assert.match(js,/list\.querySelector\('\.product-tile\.selected'\)/);
 assert.match(js,/item\.classList\.add\('selected'\);updatePreview\(\);openWorkerPreview\(\)/);
 assert.match(js,/lastSuccessfulTransfer=\{key:pendingNativePrint\.transferKey,at:Date\.now\(\)\}/);
 assert.match(js,/lastSuccessfulTransfer\.at<12000/);
});
test('V3 BT native printing watchdog closes hung socket without automatic retry',async()=>{
 const java=await read('android/print/src/main/java/ai/farukh/print/MainActivity.java');
 const build=await read('android/print/build.gradle');
 assert.match(java,/mainHandler\.postDelayed\(timeout, 45000\)/);
 assert.match(java,/mainHandler\.removeCallbacks\(timeout\)/);
 assert.match(java,/active\.close\(\)/);
 assert.match(java,/pendingPrinterReply != null \|\| printing\.get\(\)/);
 assert.match(build,/versionCode [5-9]|versionCode [1-9][0-9]+/);
});
