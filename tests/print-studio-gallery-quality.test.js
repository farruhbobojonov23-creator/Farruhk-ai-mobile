import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=p=>fs.readFile(new URL('../'+p,import.meta.url),'utf8');

test('17 local studio images render at crisp 3× quality with original image aspect ratio',async()=>{
 const atlas=await source('public/farukh-print/prep-studio-atlas.js');
 const client=await source('public/farukh-print/print.js');
 const css=await source('public/farukh-print/print.css');
 const page=await source('public/farukh-print/index.html');
 assert.match(atlas,/const names=\[/);
 const names=atlas.match(/const names=\[([^\]]+)\];/);
 assert.ok(names);
 assert.equal(names[1].split("','").length,17);
 assert.match(atlas,/w:450,h:288/);
 assert.match(atlas,/imageSmoothingQuality='high'/);
 assert.match(atlas,/canvas\.toDataURL\('image\/webp',\.94\)/);
 assert.match(client,/fallback\?\.studio\)visual\.classList\.add\('studio-preview'\)/);
 assert.match(css,/\.product-tile \.product-visual\.studio-preview\s*\{/);
 assert.match(css,/aspect-ratio:150 \/ 96/);
 assert.match(css,/\.product-visual\.studio-preview \.product-photo/);
 assert.match(page,/prep-studio-atlas\.js\?v=2/);
 assert.match(page,/print\.css\?v=22/);
 assert.match(page,/print\.js\?v=37/);
});

test('Improving catalog photos cannot alter approved shelf lives, TTK or printed label dimensions',async()=>{
 const atlas=await source('public/farukh-print/prep-studio-atlas.js');
 const client=await source('public/farukh-print/print.js');
 const owner=await source('public/print-control.js');
 assert.doesNotMatch(atlas,/needsReview|hours|storage|save\(|fetch\(/);
 assert.match(client,/const original=p\.photo&&window\.FarukhPrintPhotos\?\.isPhoto\(p\.photo\)\?p\.photo:''/);
 assert.match(owner,/if\(p\.photo&&window\.FarukhPrintPhotos\?\.isPhoto\(p\.photo\)\)return p\.photo/);
 assert.match(client,/p\.needsReview\|\|!str\(p\.storage\)/);
 assert.match(owner,/prep-studio-atlas\.js\?v=2/);
});
