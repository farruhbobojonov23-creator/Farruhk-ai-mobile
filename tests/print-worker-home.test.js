import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read=path=>fs.readFile(new URL(path,import.meta.url),'utf8');
const [html,css,worker,staff,sync,owner]=await Promise.all([
 read('../public/farukh-print/index.html'),
 read('../public/farukh-print/print.css'),
 read('../public/farukh-print/print.js'),
 read('../public/farukh-print/print-staff.js'),
 read('../public/farukh-print/print-sync.js'),
 read('../public/print-control-cloud.js'),
]);
test('Employee home shows verified identity, assigned kitchen point, search, both sizes and 3-column catalog',()=>{
 for(const id of ['worker-dashboard','worker-staff-info','worker-point','worker-ready-tab','worker-prep-tab','worker-refresh','worker-sync-status','worker-close-preview','worker-preview-backdrop','catalog-search','product-list','copies','print-now']){
  assert.ok(html.includes('id="'+id+'"'),'Missing '+id);
 }
 assert.match(css,/product-list\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/\.worker-preview-backdrop/);
 assert.match(css,/worker-preview-open/);
 assert.match(worker,/function updateWorkerSession\(staff\)/);
 assert.match(worker,/workerLoggedIn\.name/);
 assert.match(worker,/workerLoggedIn\.point/);
 assert.match(worker,/function openWorkerPreview\(/);
 assert.match(worker,/window\.addEventListener\('farukh-print-staff-changed'/);
 assert.match(staff,/new CustomEvent\('farukh-print-staff-changed'/);
});
test('Paired employees cannot modify catalog, default point is read-only and print requires online authorization',()=>{
 assert.match(worker,/function openManage\(type=manageKind\)\{\s*if\(isManaged\(\)\)return;/);
 assert.match(worker,/if\(localStorage\.getItem\('farukh-print:staff-managed:v1'\)==='1'\)/);
 assert.match(worker,/await api\.authorize\(/);
 assert.match(css,/body\.worker-managed #manage,body\.worker-managed \.manage-link\{display:none!important\}/);
 assert.match(staff,/point\.readOnly=true/);
 assert.match(staff,/catalogRevision:revision/);
 assert.match(sync,/FARUKH_PRINT_DEVICE_SYNC/);
 assert.match(sync,/setInterval\(\(\)=>\{if\(document\.visibilityState!=='hidden'\)void sync\(\)\},60_000\)/);
});
test('FARUKH AI owner sees unpublished catalog changes and connected devices',()=>{
 assert.match(owner,/pcloud-connection-summary/);
 assert.match(owner,/Не опубликованы последние изменения/);
 assert.match(owner,/deviceState\.textContent='Устройства:/);
 assert.match(owner,/queue=queue\.then\(\(\)=>publish\(true\)\)/);
 assert.match(owner,/«Опубликовать локальную базу»/);
});
