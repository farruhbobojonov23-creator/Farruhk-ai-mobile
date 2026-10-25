import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('Owner and staff preserve transparent PNG ingredients as compact WebP thumbnails',async()=>{
 const photo=await read('public/farukh-print/photo-utils.js');
 const server=await read('print-sync-api.js');
 const owner=await read('public/index.html');
 const staff=await read('public/farukh-print/index.html');
 assert.ok(photo.includes("mime=file.type==='image/jpeg'?'image/jpeg':'image/webp'"));
 assert.ok(photo.includes("ctx.clearRect(0,0,canvas.width,canvas.height)"));
 assert.ok(photo.includes("if(mime==='image/jpeg')"));
 assert.ok(photo.includes("(?:jpeg|webp)"));
 assert.ok(server.includes("(?:jpeg|webp)"));
 assert.ok(owner.includes("photo-utils.js?v=2"));
 assert.ok(staff.includes("photo-utils.js?v=2"));
});
test('Owner and staff accept larger catalog backups but maintain 45K thumbnail limit',async()=>{
 const photo=await read('public/farukh-print/photo-utils.js');
 const owner=await read('public/print-control.js');
 const staff=await read('public/farukh-print/print.js');
 assert.ok(photo.includes("CAP=45000"));
 assert.ok(owner.includes("file.size>5*1024*1024"));
 assert.ok(staff.includes("file.size>5*1024*1024"));
});
