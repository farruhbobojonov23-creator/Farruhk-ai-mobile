import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('Ingredient photo fallbacks cover every added Japanese preparation, preserve local photos and have attribution',async()=>{
 const lib=await read('public/farukh-print/prep-photo-library.js');
 const app=await read('public/farukh-print/print.js');
 const owner=await read('public/print-control.js');
 const html=await read('public/farukh-print/index.html');
 assert.match(lib,/const entries=/);
 assert.match(lib,/Wikimedia Commons/);
 assert.equal([...lib.matchAll(/https:\/\/commons\.wikimedia\.org/g)].length,2);
 assert.match(app,/original\|\|fallback/);
 assert.match(app,/if\(!original&&fallback\)/);
 assert.match(app,/img\.onerror/);
 assert.match(owner,/displayPhoto\(p\)/);
 assert.match(owner,/window\.FarukhPrepPhotoLibrary\?\.find\(p\)/);
 assert.match(html,/prep-photo-library\.js\?v=2/);
 assert.match(html,/print\.js\?v=36/);
});

test('Photo fallbacks never approve any shelf life or store linked remote photos as uploaded JPEG',async()=>{
 const owner=await read('public/print-control.js');
 const client=await read('public/farukh-print/print.js');
 const source=await read('public/farukh-print/prep-sanpin-sources.js');
 assert.match(owner,/chosenPhoto=v\.photo&&window\.FarukhPrintPhotos\?\.isPhoto\(v\.photo\)\?v\.photo:''/);
 assert.match(owner,/verify\.checked=product\?product\.needsReview!==true:false/);
 assert.match(client,/p\.needsReview\|\|!str\(p\.storage\)/);
 assert.match(source,/универсального подтверждённого срока/i);
 assert.match(source,/2026/);
 assert.doesNotMatch(source,/2\.3\.2\.1324-03/);
});

test('Kitchen owner can review each pending prep and shows selected shelf proposal before confirmation',async()=>{
 const owner=await read('public/print-control.js');
 const client=await read('public/farukh-print/print.js');
 assert.match(owner,/Подтвердить по ТТК/);
 assert.match(owner,/ждёт подтверждения по ТТК/);
 assert.match(client,/требует подтверждения/);
 assert.match(client,/Предложено:/);
 assert.match(owner,/window\.FarukhPrepShelfReference\?\.get\(p\.name\)/);
});
