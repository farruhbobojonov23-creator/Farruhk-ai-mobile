import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const get=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Full studio atlas bundles 17 aligned, self-hosted photos instead of mismatched remote stock',async()=>{
 const source=await get('public/farukh-print/prep-studio-atlas.js');
 const section=source.split('const chunks=[')[1]?.split('];')[0];
 assert.ok(section,'Missing embedded studio atlas');
 const parts=[...section.matchAll(/"([A-Za-z0-9+/=]+)"/g)].map(m=>m[1]);
 assert.equal(parts.length,5);
 const encoded=parts.join('');
 const bytes=Buffer.from(encoded,'base64');
 assert.equal(encoded.length,17040);
 assert.equal(bytes.length,12778);
 assert.equal(bytes.toString('ascii',0,4),'RIFF');
 assert.equal(bytes.toString('ascii',8,12),'WEBP');
 assert.match(source,/const names=\['Авокадо \(нарезка\)'/);
 assert.match(source,/Грибы \(нарезка\)/);
 assert.match(source,/Икра масаго \(открытая\)/);
 assert.match(source,/Томаты черри \(нарезка\)/);
 assert.match(source,/canvas\.toDataURL\('image\/webp',\.82\)/);
 assert.match(source,/farukh-studio-ready/);
});

test('Staff and FARUKH AI both load the complete atlas and repaint after image decoding',async()=>{
 const html=await get('public/farukh-print/index.html');
 const app=await get('public/farukh-print/print.js');
 const control=await get('public/print-control.js');
 const library=await get('public/farukh-print/prep-photo-library.js');
 const shell=await get('public/index.html');
 assert.match(html,/prep-studio-atlas\.js\?v=1/);
 assert.ok(html.indexOf('prep-studio-atlas.js?v=1')<html.indexOf('prep-photo-library.js?v=2'));
 assert.match(app,/window\.addEventListener\('farukh-studio-ready'/);
 assert.match(control,/import\('\.\/farukh-print\/prep-studio-atlas\.js\?v=1'\)/);
 assert.match(control,/window\.addEventListener\('farukh-studio-ready'/);
 assert.match(library,/window\.FarukhStudioPrep\?\.find\(p\)/);
 assert.match(shell,/print-control\.js\?v=17/);
 assert.match(html,/print\.js\?v=36/);
});

test('White studio art is a preview only: owner uploads override and shelf approvals remain unchanged',async()=>{
 const library=await get('public/farukh-print/prep-photo-library.js');
 const staff=await get('public/farukh-print/print.js');
 const owner=await get('public/print-control.js');
 const atlas=await get('public/farukh-print/prep-studio-atlas.js');
 assert.match(staff,/img\.src=original\|\|fallback\.url/);
 assert.match(owner,/if\(p\.photo&&window\.FarukhPrintPhotos\?\.isPhoto\(p\.photo\)\)return p\.photo/);
 assert.match(library,/studio:true/);
 assert.match(atlas,/Never persisted to product data/);
 assert.match(staff,/p\.needsReview\|\|!str\(p\.storage\)/);
 assert.match(owner,/needsReview:!verify\.checked/);
});
