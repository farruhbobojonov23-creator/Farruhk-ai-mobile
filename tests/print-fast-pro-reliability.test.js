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
 assert.match(java,/mainHandler\.postDelayed\(timeout, 20_000\)/);
 assert.match(java,/mainHandler\.removeCallbacks\(timeout\)/);
 assert.match(java,/active\.close\(\)/);
 assert.match(java,/pendingPrinterReply != null \|\| printing\.get\(\)/);
 assert.match(build,/versionCode [5-9]|versionCode [1-9][0-9]+/);
});

test('V3 BT session is reused briefly and released for other tablets',async()=>{
 const java=await read('android/print/src/main/java/ai/farukh/print/MainActivity.java');
 const build=await read('android/print/build.gradle');
 assert.match(java,/socket = heldSocket;/);
 assert.match(java,/socket = device\.createRfcommSocketToServiceRecord\(SPP\)/);
 assert.match(java,/if \(!reused\) \{/);
 assert.match(java,/socketLease == lease && !printing\.get\(\)/);
 assert.match(java,/closeHeldSocket\(\)/);
 assert.match(java, /\}, SOCKET_IDLE_MS\);/);
 assert.match(java,/mainHandler\.postDelayed\(timeout, 20_000\)/);
 assert.match(java,/stream\.write\(label, offset, size\)/);
 assert.doesNotMatch(java,/socket\.connect\(\)[\s\S]{0,30}socket\.connect\(\)/);
 assert.match(build,/versionCode 11/);
 assert.match(java,/offset \+ size < label\.length\) Thread\.sleep\(12\)/);
 assert.doesNotMatch(java,/Thread\.sleep\(20\)/);
 assert.match(java,/SOCKET_IDLE_MS = 180_000/);
 assert.match(java,/adapter\.cancelDiscovery\(\)/);
 assert.match(java,/final long connectedAt = android\.os\.SystemClock\.elapsedRealtime\(\)/);
});

test('New roll timestamps refresh automatically without losing manual production times',async()=>{
 const js=await read('public/farukh-print/print.js');
 const html=await read('public/farukh-print/index.html');
 assert.match(js,/function refreshPrintedAt\(\)/);
 assert.match(js,/autoPrintedAt=true;\$\('printed-at'\)\.value=nowLocal\(\)/);
 assert.match(js,/\$\('printed-at'\)\.addEventListener\('input',\(\)=>\{autoPrintedAt=false;updatePreview\(\)\}\)/);
 assert.match(js,/setInterval\(refreshPrintedAt,20_000\)/);
 assert.match(js,/if\(busy\)return false;\s*\/\/ Refresh the time immediately before printing unless manually fixed\.\s*refreshPrintedAt\(\)/);
 assert.match(js,/if\(!autoPrintedAt\|\|busy\|\|batchRunning\|\|!current\(\)\|\|isHaccp\(current\(\)\)\|\|\$\('catalog'\)\.hidden\)return false/);
 assert.match(html,/id="printed-at-now"/);
 assert.match(html,/legacy\/print\.js\?v=60/);
});
