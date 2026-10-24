import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sources=Object.fromEntries(await Promise.all([
 ['owner', '../public/print-control.js'],
 ['ownerStyle','../public/print-control.css'],
 ['ownerPage','../public/index.html'],
 ['standalone','../public/farukh-print/print.js'],
 ['standaloneStyle','../public/farukh-print/print.css'],
 ['standalonePage','../public/farukh-print/index.html'],
 ['renderer','../public/farukh-print/premium-ready-label.js']
].map(async([k,path])=>[k,await readFile(new URL(path,import.meta.url),'utf8')])));

test('FARUKH AI has a saved premium 58x40 manual template with real-data SVG live preview',()=>{
 assert.match(sources.owner,/СОХРАНЁННЫЙ ЭТАЛОН|УТВЕРЖДЁННЫЙ ЭТАЛОН/);
 assert.match(sources.owner,/Заполнить вручную/);
 assert.match(sources.owner,/edit\(null,true\)/);
 assert.match(sources.owner,/premium-ready-label\.js\?v=3/);
 assert.match(sources.owner,/FarukhPremiumReady\.draw\(surface\.g,p/);
 assert.match(sources.owner,/labelStyle='premium-ready-58x40'/);
 assert.match(sources.owner,/needsReview:!verify\.checked/);
 assert.match(sources.ownerStyle,/pc-premium-template/);
 assert.match(sources.ownerStyle,/pc-template-preview-art svg/);
 assert.match(sources.ownerStyle,/not\(\[data-pc-workspace="catalog"\]\)/);
 assert.match(sources.ownerPage,/print-control\.js\?v=12/);
 assert.match(sources.ownerPage,/print-control\.css\?v=14/);
});

test('Standalone FARUKH PRINT can start a new blank premium label and keeps staff read-only',()=>{
 assert.match(sources.standalonePage,/id="home-premium-template"/);
 assert.match(sources.standalonePage,/id="use-premium-template"/);
 assert.match(sources.standalonePage,/id="manual-template-preview"/);
 assert.match(sources.standalonePage,/print\.js\?v=28/);
 assert.match(sources.standalonePage,/print\.css\?v=17/);
 assert.match(sources.standalone,/openEditor\(null,true\)/);
 assert.match(sources.standalone,/manualPremium\?'':/);
 assert.match(sources.standalone,/needsReview=!\$\('edit-approval'\)\.checked/);
 assert.match(sources.standalone,/fields\.labelStyle='premium-ready-58x40'/);
 assert.match(sources.standalone,/if\(isManaged\(\)\|\|cloudPaired\)/);
 assert.match(sources.standalone,/FarukhPremiumReady\.draw\(surface\.g,p/);
 assert.match(sources.standaloneStyle,/body\.worker-managed/);
});

test('Template never invents a shelf-life, calories or production date in saved records',()=>{
 assert.match(sources.owner,/manualTemplate\?\{tolerance:''\}/);
 assert.match(sources.owner,/\['name','composition','p','f','c','kcal','weight','tolerance','storage','hours'\]/);
 assert.match(sources.standalone,/manualPremium\?'':type==='ready'/);
 assert.match(sources.standalone,/if\(fields\.composit/); // actual manual validation for nutrition
 assert.match(sources.renderer,/Требуются название, состав, хранение и подтверждённый срок/);
 assert.doesNotMatch(sources.standalone,/manualPremium\?48:12/);
});

test('Manual editor remains a reusable template, not a new saved placeholder product',()=>{
 assert.match(sources.owner,/const p=\{\.\.\.existing,id:existing\?\.id\|\|uid\(\)/);
 assert.match(sources.standalone,/else products\.push\(\{id:makeId\(\),\.\.\.fields\}\)/);
 assert.match(sources.standalone,/cloudPaired\)return/);
});
