import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const src=await fs.readFile(new URL('../public/farukh-print/print.js',import.meta.url),'utf8');
const html=await fs.readFile(new URL('../public/farukh-print/index.html',import.meta.url),'utf8');
const css=await fs.readFile(new URL('../public/farukh-print/print.css',import.meta.url),'utf8');
const staff=await fs.readFile(new URL('../public/farukh-print/print-staff.js',import.meta.url),'utf8');
const device=await fs.readFile(new URL('../public/farukh-print/print-sync.js',import.meta.url),'utf8');
const cloud=await fs.readFile(new URL('../public/print-control-cloud.js',import.meta.url),'utf8');

test('worker view has photo grid, point/name and type tabs, mobile print sheet',()=>{
 for(const id of ['worker-dashboard','worker-staff-info','worker-point','worker-ready-tab','worker-prep-tab','worker-sync-status','worker-refresh','worker-close-preview','worker-preview-backdrop']){
  assert.match(html,new RegExp('id="'+id+'"'),'Missing '+id);
 }
 assert.match(src,/function updateWorkerSession\(staff\)/);
 assert.match(src,/openCatalog\('prep'\)/);
 assert.match(src,/renderCatalog\(\);openWorkerPreview\(\)/);
 assert.match(css,/\.product-list\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/worker-managed\.worker-logged-in\.worker-preview-open/);
 assert.match(css,/\.printing-panel\{[\s\S]*?position:fixed/);
 assert.match(staff,/farukh-print-staff-changed/);
});

test('photo/catalog refresh requires internet on managed kitchen device, store remains owner-controlled',()=>{
 assert.match(device,/FARUKH_PRINT_DEVICE_SYNC/);
 assert.match(device,/farukh-print-sync-status/);
 assert.match(device,/setPaired\(protectedDevice\)/);
 assert.match(staff,/catalogRevision:revision/);
 assert.match(cloud,/pcloud-connection-summary/);
 assert.match(cloud,/farukh-print-catalog-local-updated/);
 assert.match(cloud,/publish\(true\)/);
 assert.match(src,/if\(isManaged\(\)\)return;[\s\S]*?manageKind=type/);
 assert.match(src,/\$\('fix-label'\)\.hidden=!p\|\|!p\.needsReview\|\|isManaged\(\)/);
});

test('print output continues to use separate unchanged TSPL graphics',()=>{
 assert.match(src,/function drawReady\(/);
 assert.match(src,/function drawPrep\(/);
 assert.match(src,/function tspl\(/);
 assert.match(src,/w===464&&h===320/);
 assert.match(src,/w===240&&h===160/);
});
