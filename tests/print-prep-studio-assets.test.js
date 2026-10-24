import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('Approved three new Japanese prep photo cutouts are locally bundled WebP studio images, no stock scenes',async()=>{
 const context={window:{}};
 vm.runInNewContext(await read('public/farukh-print/prep-studio-images.js'),context);
 vm.runInNewContext(await read('public/farukh-print/prep-photo-library.js'),context);
 const studio=context.window.FarukhStudioPrep;
 assert.equal(studio.count,3);
 for(const n of ['Авокадо (нарезка)','Дайкон (нарезка)','Грибы (нарезка)']){
  const url=studio.find(n);
  assert.match(url,/^data:image\/webp;base64,/);
  const raw=Buffer.from(url.split(',')[1],'base64');
  assert.equal(raw.subarray(0,4).toString(),'RIFF');
  assert.equal(raw.subarray(8,12).toString(),'WEBP');
  assert.ok(raw.length>1000&&raw.length<25000);
  const record=context.window.FarukhPrepPhotoLibrary.find(n);
  assert.equal(record.studio,true);
  assert.equal(record.url,url);
  assert.equal(record.creditUrl,undefined);
 }
 const other=context.window.FarukhPrepPhotoLibrary.find('Мидии (мясо)');
 assert.match(other.url,/^https:\/\/commons\.wikimedia\.org\//);
 assert.ok(other.creditUrl);
});
test('Employee and owner photo precedence does not overwrite original uploads or food safety status',async()=>{
 const app=await read('public/farukh-print/print.js');
 const owner=await read('public/print-control.js');
 const html=await read('public/farukh-print/index.html');
 const home=await read('public/index.html');
 assert.match(html,/prep-studio-images\.js\?v=1/);
 assert.ok(html.indexOf('prep-studio-images.js?v=1')<html.indexOf('prep-photo-library.js?v=2'));
 assert.match(owner,/import\('\.\/farukh-print\/prep-studio-images\.js\?v=1'\)\.then/);
 assert.match(app,/img\.src=original\|\|fallback\.url/);
 assert.match(owner,/if\(p\.photo&&window\.FarukhPrintPhotos\?\.isPhoto\(p\.photo\)\)return p\.photo/);
 assert.match(app,/p\.needsReview/);
 assert.match(owner,/verify\.checked=product\?product\.needsReview!==true:false/);
 assert.match(home,/print-control\.js\?v=17/);
 assert.match(html,/print\.js\?v=35/);
});
