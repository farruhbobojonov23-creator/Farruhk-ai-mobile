import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('Premium v2 has two correct formats and reuses user photos or existing approved 3D art',async()=>{
 const html=await read('public/farukh-print/index.html');
 const js=await read('public/farukh-print/print.js');
 const skin=await read('public/farukh-print/print-premium.css');
 assert.match(html,/print-premium\.css\?v=2/);
 assert.ok(html.indexOf('id="choose-prep"')<html.indexOf('id="choose-ready"'));
 for(const id of ['home-prep-art','home-ready-art','home-status','home-worker-info','home-quick','home-point-name'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/function homeFeatureArt\(\)/);
 assert.match(js,/photoStyle==='manual'/);
 assert.match(js,/window\.FarukhApprovedPrep3D\?\.find\(p\)/);
 assert.match(js,/function homeQuickAccess\(\)/);
 assert.match(skin,/\.home-welcome\{/);
 assert.match(skin,/\.choice-grid \.type-image\{/);
});

test('Prep categories and status are display-only and retain employee access checks',async()=>{
 const js=await read('public/farukh-print/print.js');
 const html=await read('public/farukh-print/index.html');
 assert.match(js,/function prepGroup\(p\)/);
 assert.match(js,/function productGroup\(p\)/);
 assert.match(js,/productGroup\(p\)===activeCategory/);
 assert.match(html,/id="catalog-found"/);
 assert.match(html,/id="catalog-review-count"/);
 assert.match(js,/items\.filter\(p=>p\.needsReview\)/);
 assert.match(js,/const authorized=await api\.authorize/);
 assert.match(js,/closeWorkerPreview\(\);show\('home'\);renderHome\(\)/);
 assert.match(html,/id="worker-refresh"/);
 assert.match(js,/Нет пометок «на проверке»/);
});
