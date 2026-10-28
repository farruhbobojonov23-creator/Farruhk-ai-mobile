import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
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
 assert.match(page,/id="download" class="primary" href="https:\/\/github\.com\/[^" ]+\/FARUKH-PRINT-test\.apk"/);
 assert.doesNotMatch(page,/id="download"[^>]+aria-disabled="true"/);
 assert.match(workflow,/keeping original signed binary/);
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
 assert.match(html,/print-updates\.js\?v=2/);
 assert.match(html,/print-premium\.css\?v=9/);
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

test('Update panel has a single contextual button, with no manual check or competing update link',async()=>{
 const script=await read('public/farukh-print/print-updates.js');
 assert.match(script,/const button=document.createElement\('button'\)/);
 assert.match(script,/setButton\('Обновить до '\+info.version,'update'\)/);
 assert.match(script,/setButton\('Актуальная версия'\)/);
 assert.match(script,/window.location.assign\(BASE\)/);
 assert.doesNotMatch(script,/Посмотреть обновление|↻ Проверить|Скачать APK ↗/);
 const versionBody='FARUKH_PRINT_VERSION_CODE=10\nFARUKH_PRINT_VERSION_NAME=1.4.3-test\n';
 const response={ok:true,json:async()=>({body:versionBody,assets:[{name:'FARUKH-PRINT-test.apk',browser_download_url:'https://github.com/example/release.apk'}]})};
 async function runPanel(userAgent,source){
   const elements=[],redirects=[];
   const createElement=tag=>{
     const node={tag,children:[],disabled:false,textContent:'',handlers:{},
       append(...children){this.children.push(...children)},
       setAttribute(){},
       addEventListener(ev,fn){this.handlers[ev]=fn},
       before(){}};
     elements.push(node);return node;
   };
   const root={querySelector:()=>null,append(){}};
   vm.runInNewContext(script,{
     navigator:{userAgent},document:{getElementById:id=>id==='home'?root:null,createElement,addEventListener(){}},
     window:{location:{assign:url=>redirects.push(url)}},
     localStorage:{getItem:()=>null,setItem(){}},fetch:source
   });
   await new Promise(resolve=>setImmediate(resolve));
   return {button:elements.find(e=>e.tag==='button'),elements,redirects};
 }
 const older=await runPanel('Mozilla FarukhPrintAndroid/9',async()=>response);
 assert.equal(older.elements.filter(e=>e.tag==='button').length,1);
 assert.equal(older.button.textContent,'Обновить до 1.4.3-test');
 assert.equal(older.button.disabled,false);
 older.button.handlers.click();
 assert.deepEqual(older.redirects,['/farukh-print/download/']);
 const current=await runPanel('Mozilla FarukhPrintAndroid/10',async()=>response);
 assert.equal(current.button.textContent,'Актуальная версия');
 assert.equal(current.button.disabled,true);
 const browser=await runPanel('Mozilla Chrome',async()=>response);
 assert.equal(browser.button.disabled,true);
 const failed=await runPanel('Mozilla FarukhPrintAndroid/9',async()=>{throw Error('offline')});
 assert.equal(failed.button.textContent,'Повторить проверку');
 assert.equal(failed.button.disabled,false);
});
