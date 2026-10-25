import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Owner-only statistics include per-product counters without claiming physical print',async()=>{
 const api=await read('print-staff-api.js'),owner=await read('public/print-control-staff.js');
 assert.match(api,/topProducts:/);
 assert.match(api,/transmittedJobs/);
 assert.match(owner,/topProductsHeading/);
 assert.match(owner,/Загрузить историю|Скачать историю CSV/);
 assert.match(owner,/productFilter/);
 assert.match(api,/activity-export',owner,safe/);
 assert.match(api,/Content-Disposition/);
 assert.match(api,/csvField/);
});
test('Locally bundled QR generator and scanner remain independent from thermal label output',async()=>{
 const html=await read('public/farukh-print/index.html');
 const decoder=await read('public/farukh-print/print-pro-scanner.js');
 const label=await read('public/farukh-print/label-svg.js');
 assert.match(html,/vendor\/qrcode\.js/);
 assert.match(html,/vendor\/jsqr\.js/);
 assert.match(decoder,/window\.jsQR/);
 assert.match(decoder,/window\.qrcode/);
 assert.match(decoder,/createSvgTag/);
 assert.match(decoder,/FP\|/);
 assert.match(label,/one vector drawing surface/);
 assert.doesNotMatch(decoder,/fetch\(/);
});
