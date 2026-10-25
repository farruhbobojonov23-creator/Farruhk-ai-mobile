import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('Android 15 print APK insets prevent status bar and navigation overlay',async()=>{
 const native=await read('android/print/src/main/java/ai/farukh/print/MainActivity.java');
 assert.match(native,/setOnApplyWindowInsetsListener/);
 assert.match(native,/WindowInsets\.Type\.statusBars\(\)/);
 assert.match(native,/WindowInsets\.Type\.navigationBars\(\)/);
 assert.match(native,/WindowInsets\.Type\.displayCutout\(\)/);
 assert.match(native,/view\.setPadding\(0, top, 0, bottom\)/);
 assert.match(native,/setContentView\(safeFrame\)/);
 assert.match(native,/getWindow\(\)\.getDecorView\(\)\.setSystemUiVisibility\(0\)/);
 assert.match(native,/getWindow\(\)\.setStatusBarColor\(Color\.rgb\(16, 19, 26\)\)/);
 const gradle=await read('android/print/build.gradle');
 assert.match(gradle,/targetSdk 35/);
});
test('Advice modal has a large accessible close target above card content',async()=>{
 const css=await read('public/farukh-print/print.css');
 const js=await read('public/farukh-print/employee-advice.js');
 const html=await read('public/farukh-print/index.html');
 assert.match(css,/\.print-advice-dialog \.print-advice-close\{[\s\S]*?z-index:1000;/);
 assert.match(css,/width:54px;/);
 assert.match(css,/touch-action:manipulation;/);
 assert.match(css,/@media \(display-mode: standalone\) and \(max-width:900px\)/);
 assert.match(js,/closeBtn\.setAttribute\('aria-label','Закрыть советы'\)/);
 assert.match(js,/closeBtn\.onclick=closeAdvice/);
 assert.match(js,/dialog\.addEventListener\('click',e=>\{if\(e\.target===dialog\)closeAdvice\(\)\}\)/);
 assert.match(html,/\.\/print\.css\?v=29/);
});
