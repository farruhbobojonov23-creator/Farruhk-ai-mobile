import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('FARUKH PRINT staff has a distinct installable shareable URL backed by same catalog and label HTML',async()=>{
 const server=await source('server.js');
 const html=await source('public/farukh-print/index.html');
 const manifest=JSON.parse(await source('public/farukh-print/staff/manifest.webmanifest'));
 assert.match(server,/app\.get\(\['\/farukh-print\/staff','\/farukh-print\/staff\/'\]/);
 assert.match(server,/readFile\(new URL\('\.\/public\/farukh-print\/index\.html'/);
 assert.match(server,/<base href="\/farukh-print\/">/);
 assert.match(server,/window\.FARUKH_PRINT_EMPLOYEE_ENTRY=true/);
 assert.match(server,/href="\/farukh-print\/staff\/manifest\.webmanifest"/);
 assert.equal(manifest.start_url,'/farukh-print/staff/');
 assert.equal(manifest.scope,'/farukh-print/staff/');
 assert.equal(manifest.display,'standalone');
 assert.match(html,/premium-prep-label\.js\?v=1/);
 assert.match(html,/premium-ready-label\.js\?v=3/);
 assert.match(html,/print\.js\?v=54/);
 assert.match(html,/print-staff\.js\?v=8/);
});

test('Employee URL blocks owner management before device pairing without permanently changing personal owner localStorage',async()=>{
 const app=await source('public/farukh-print/print.js');
 const staff=await source('public/farukh-print/print-staff.js');
 const sync=await source('public/farukh-print/print-sync.js');
 assert.match(app,/const isManaged=\(\)=>window\.FARUKH_PRINT_EMPLOYEE_ENTRY===true/);
 assert.match(app,/if\(!window\.FARUKH_PRINT_EMPLOYEE_ENTRY\)\{mergeStarterPrep\(\);save\(\)\}/);
 assert.match(app,/if\(isManaged\(\)\)return/);
 assert.match(staff,/const employeeEntry=window\.FARUKH_PRINT_EMPLOYEE_ENTRY===true/);
 assert.match(staff,/form\.hidden=!paired\|\|!enrolled\|\|!!staff/);
 assert.match(staff,/if\(value&&!employeeEntry\)localStorage\.setItem\(MANAGED,'1'\)/);
 assert.match(staff,/Для печати подключи устройство/);
 assert.match(sync,/localStorage\.setItem\(STAFF_MANAGED,'1'\)/); // actual pairing still persists restricted mode
 assert.match(staff,/X-Farukh-Print-Staff/);
 assert.match(staff,/authorize-print/);
});

test('Owner dashboard provides a copyable employee link, independent from owner panel',async()=>{
 const owner=await source('public/print-control-cloud.js');
 assert.match(owner,/const staffUrl='\/farukh-print\/staff\/'/);
 assert.match(owner,/navigator\.clipboard\.writeText\(url\)/);
 assert.match(owner,/Открыть страницу сотрудников/);
 assert.match(owner,/код подключения устройства и личный логин/);
});
