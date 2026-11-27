'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const server=require('../server.cjs');
test('local server refuses unsafe file types and serves offline prototype',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  let r=await fetch(base+'/health');assert.equal(r.status,200);let body=await r.json();assert.equal(body.publication,false);assert.equal(body.offline,true);
  r=await fetch(base+'/');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/html/);assert.match(await r.text(),/изолированная проверка/);
  r=await fetch(base+'/recognizer.js');assert.equal(r.status,200);assert.match(await r.text(),/FARUKH_RECOGNIZER/);
  r=await fetch(base+'/app.js');assert.equal(r.status,200);assert.match(await r.text(),/Tesseract|ocrSource/);
  r=await fetch(base+'/ocr',{method:'POST',headers:{'content-type':'application/x-executable'},body:'not an image'});
  assert.equal(r.status,415);assert.match((await r.json()).error,/JPEG/);
  r=await fetch(base+'/unknown');assert.equal(r.status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});