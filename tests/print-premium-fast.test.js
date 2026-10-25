import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('FARUKH PRINT FAST PREMIUM mobile nav and access gate',async()=>{
 const html=await read('public/farukh-print/index.html');
 const css=await read('public/farukh-print/print-premium.css');
 const js=await read('public/farukh-print/print.js');
 for(const id of ['print-nav-home','print-nav-prep','print-nav-ready'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/print-premium\.css\?v=\d+/);
 assert.match(css,/body\.worker-managed:not\(\.worker-logged-in\) \.print-mobile-nav/);
 assert.match(css,/\.print-advice-dialog\{color-scheme:light\}/);
 assert.match(js,/function updatePremiumNav\(section\)/);
 assert.match(js,/const api=window\.FARUKH_PRINT_STAFF_API/);
});
test('FAST uses batched DOM rendering, coalesced image refresh and search debounce',async()=>{
 const js=await read('public/farukh-print/print.js');
 assert.match(js,/document\.createDocumentFragment\(\)/);
 assert.match(js,/cards\.append\(item\)/);
 assert.match(js,/list\.append\(cards\)/);
 assert.match(js,/searchDebounce=setTimeout\(renderCatalog,110\)/);
 assert.match(js,/artFrame=requestAnimationFrame/);
 assert.match(js,/function doPrint\(forceSystem=false\)/);
});
test('Premium Android reserves OS insets, dark shell and new version',async()=>{
 const native=await read('android/print/src/main/java/ai/farukh/print/MainActivity.java');
 const gradle=await read('android/print/build.gradle');
 assert.match(native,/setOnApplyWindowInsetsListener/);
 assert.match(native,/safeFrame\.setBackgroundColor\(Color\.rgb\(16, 19, 26\)\)/);
 assert.match(native,/webView\.setBackgroundColor\(Color\.rgb\(16, 19, 26\)\)/);
 assert.match(gradle,/versionCode 3/);
});
