import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load = path => readFile(new URL('../'+path, import.meta.url), 'utf8');

test('Owner photo uploads are marked manual and clear returns to 3D',async()=>{
 const owner=await load('public/print-control.js');
 assert.match(owner,/photoChanged=true;showPhoto\(\)/);
 assert.match(owner,/photoChanged=true;showPhoto\(\);formError/);
 assert.match(owner,/if\(kind==='prep'&&photoChanged\)p\.photoStyle=chosenPhoto\?'manual':'3d'/);
});
test('Cloud recovers accepted offline edits and staff favors manual photos',async()=>{
 const cloud=await load('public/print-control-cloud.js');
 const app=await load('public/farukh-print/print.js');
 const sync=await load('public/farukh-print/print-sync.js');
 assert.match(cloud,/accepted\?\.revision===rev&&accepted\.remote===digest\(remoteProducts\)/);
 assert.match(cloud,/if\(auto&&!same\)/);
 assert.match(app,/const usingCustom=!!original&&p\.photoStyle==='manual'/);
 assert.match(sync,/cache:'no-store'/);
 assert.match(sync,/!localMatches/);
});
