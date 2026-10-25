import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Stable public release channel publishes one permanent asset URL and verifies print tests',async()=>{
 const workflow=await read('.github/workflows/farukh-print-apk.yml');
 const page=await read('public/farukh-print/download/index.html');
 assert.match(workflow,/contents: write/);
 assert.match(workflow,/gh release create farukh-print-current/);
 assert.match(workflow,/gh release upload farukh-print-current/);
 assert.match(workflow,/--clobber/);
 assert.match(workflow,/node --test tests\/print-fast-pro-reliability\.test\.js/);
 assert.match(page,/releases\/tags\/farukh-print-current/);
 assert.match(page,/FARUKH-PRINT-test\.apk/);
 assert.match(page,/Подпись APK может меняться/);
});
test('Updater is explicitly opt-in and compares installed native APK version to release metadata',async()=>{
 const java=await read('android/print/src/main/java/ai/farukh/print/MainActivity.java');
 const script=await read('public/farukh-print/print-updates.js');
 const html=await read('public/farukh-print/index.html');
 assert.match(java,/FarukhPrintAndroid\//);
 assert.match(script,/FARUKH_PRINT_VERSION_CODE=/);
 assert.match(script,/info\.code>installed/);
 assert.match(script,/INTERVAL=6\*60\*60\*1000/);
 assert.match(script,/\/farukh-print\/download\//);
 assert.match(html,/print-updates\.js\?v=1/);
 assert.doesNotMatch(script,/startActivity|window\.print\(/);
});
test('Authenticated sync repairs local drift on conditional 304, and label geometry self-check sends no data',async()=>{
 const sync=await read('public/farukh-print/print-sync.js');
 const app=await read('public/farukh-print/print.js');
 const html=await read('public/farukh-print/index.html');
 assert.match(sync,/function catalogFingerprint\(items\)/);
 assert.match(sync,/stored\.catalogFingerprint===localFingerprint/);
 assert.match(sync,/stored\.catalogFingerprint=catalogFingerprint/);
 assert.match(sync,/if\(res\.status===304\)/);
 assert.match(app,/expected=\{ready:\[464,320\],prep:\[240,160\]\}/);
 assert.match(app,/\$\('print-geometry-check'\)\.onclick=/);
 assert.match(html,/id="print-geometry-check"/);
 assert.match(app,/проверены без отправки/);
});
