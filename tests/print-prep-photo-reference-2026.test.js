import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source=path=>fs.readFile(new URL('../'+path,import.meta.url),'utf8');
test('All 17 new sushi prep products show curated Wikimedia representative ingredient photos, credited and owner-overridable',async()=>{
 const {definitions}=await import('../public/farukh-print/japanese-prep-catalog.js');
 const context={window:{}};
 const photos=await source('public/farukh-print/prep-photo-library.js');
 vm.runInNewContext(photos,context);
 const p=context.window.FarukhPrepPhotoLibrary;
 assert.equal(p.entries.length,17);
 for(const item of definitions.slice(19)){
  const photo=p.find(item.name);
  assert.ok(photo, 'Missing representative photo for '+item.name);
  assert.match(photo.url,/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//);
  assert.match(photo.creditUrl,/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
  assert.ok(photo.author);
  assert.ok(photo.license);
 }
 const app=await source('public/farukh-print/print.js'),control=await source('public/print-control.js');
 assert.match(app,/const original=p\.photo&&window\.FarukhPrintPhotos\?\.isPhoto\(p\.photo\)\?p\.photo:''/);
 assert.match(app,/img\.src=original\|\|fallback\.url/);
 assert.match(app,/img\.onerror=/);
 assert.match(control,/chosenPhoto=v\.photo&&window\.FarukhPrintPhotos\?\.isPhoto\(v\.photo\)\?v\.photo:''/);
 assert.match(control,/return p\.kind==='prep'\?window\.FarukhPrepPhotoLibrary\?\.find\(p\)\?\.url\|\|'':''/);
 assert.match(control,/✓ Подтвердить по ТТК/);
});
test('2026 SanPiN guidance uses exact 2003 annex matches, never marks unknown products legally approved',async()=>{
 const c={window:{}};
 vm.runInNewContext(await source('public/farukh-print/prep-sanpin-sources.js'),c);
 const ref=c.window.FarukhPrepShelfReference;
 assert.equal(ref.get('Дайкон (нарезка)').hours,12);
 assert.equal(ref.get('Лук зелёный (нарезка)').hours,18);
 assert.equal(ref.get('Лук зелёный (нарезка)').kind,'direct');
 assert.equal(ref.get('Форель').kind,'analogy');
 assert.match(ref.get('Форель').warning,/НЕ готовая норма/);
 assert.equal(ref.get('Икра масаго (открытая)').kind,'individual');
 const app=await source('public/farukh-print/print.js');
 const owner=await source('public/print-control.js');
 assert.match(app,/p\.needsReview\?/);
 assert.match(owner,/checkbox\.append\(verify/);
 assert.match(owner,/needsReview:!verify\.checked/);
 assert.match(app,/печать до подтверждения заблокирована/);
 assert.match(await source('public/farukh-print/index.html'),/prep-photo-library\.js\?v=1/);
});
