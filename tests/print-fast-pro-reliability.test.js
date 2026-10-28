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
 assert.match(java,/currentSocket\.close\(\)/);
 assert.match(java,/pendingPrinterReply != null \|\| printing\.get\(\)/);
 assert.match(build,/versionCode [5-9]|versionCode [1-9][0-9]+/);
});

test('V3 BT releases Bluetooth after every label for the next employee',async()=>{
 const java=await read('android/print/src/main/java/ai/farukh/print/MainActivity.java');
 const build=await read('android/print/build.gradle');
 assert.match(java,/socket = device\.createRfcommSocketToServiceRecord\(SPP\)/);
 assert.match(java,/socket\.connect\(\)/);
 assert.match(java,/activeSocket = socket;/);
 assert.match(java,/finally \{\s*completed\.set\(true\);/);
 assert.match(java,/if \(socket != null\) try \{ socket\.close\(\); \}/);
 assert.match(java,/activeSocket = null;/);
 assert.match(java,/Bluetooth принтера освобождён для следующего сотрудника/);
 assert.doesNotMatch(java,/heldSocket|heldAddress|socketLease|SOCKET_IDLE_MS|closeHeldSocket/);
 assert.match(java,/mainHandler\.postDelayed\(timeout, 20_000\)/);
 assert.match(java,/stream\.write\(label, offset, size\)/);
 assert.match(java,/offset \+ size < label\.length\) Thread\.sleep\(12\)/);
 assert.match(java,/adapter\.cancelDiscovery\(\)/);
 assert.match(java,/Thread\.sleep\(250\)/);
 assert.match(build,/versionCode 12/);
 assert.match(build,/versionName '1\.4\.5-test'/);
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
 assert.match(html,/legacy\/print\.js\?v=62/);
});

test('Fast printing checks staff and exact approved catalog before the cook taps Print',async()=>{
 const server=await read('print-staff-api.js');
 const sync=await read('print-sync-api.js');
 const staff=await read('public/farukh-print/print-staff.js');
 const ui=await read('public/farukh-print/print.js');
 const html=await read('public/farukh-print/index.html');
 assert.match(server,/device\/staff\/preflight',protectDevice,requireStaff/);
 assert.match(server,/catalog\.products\.find\(p=>p\.id===productId\)/);
 assert.match(server,/product\.needsReview===true/);
 assert.match(server,/FAST_TTL_MS=12_000/);
 assert.match(server,/fastTickets\.delete\(key\)/);
 assert.match(server,/ticket\.deviceHash!==sha/);
 assert.match(server,/ticket\.sessionHash!==sha/);
 assert.match(server,/ticket\.copies!==Number\(req\.body\?\.copies\)/);
 assert.match(server,/app\.post\('\/api\/farukh-print\/device\/staff\/authorize-print',consumeFast,protectDevice,requireStaff/);
 assert.match(server,/writeAuditInBackground\(item\)/);
 assert.match(server,/if\(pending\)\{/);
 assert.match(sync,/if\(req\.farukhPrintFast\)return next\(\)/);
 assert.match(sync,/invalidateFastTickets\(\)/);
 assert.match(staff,/call\('\/preflight'/);
 assert.match(staff,/clearPrepared\(\)/);
 assert.match(staff,/fastTicket=prepared\?\.key===key/);
 assert.match(ui,/function prepareFastPrint\(\)/);
 assert.match(ui,/prepareFastPrint\(\);/);
 assert.match(html,/legacy\/print-staff\.js\?v=10/);
});
