// Mobile-sized local model benchmark. This never handles real customer photos in CI.
import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {parse} from 'yaml';
import {MODEL_PACK_BYTES} from './smart-scan-models.mjs';

const model=fs.readFileSync('table.onnx'),cfg=fs.readFileSync('table.yml','utf8');
const total=MODEL_PACK_BYTES+model.length+Buffer.byteLength(cfg);
console.log(JSON.stringify({baseBytes:MODEL_PACK_BYTES,tableBytes:model.length,totalBytes:total}));
assert.ok(total<=60_000_000,'Models + runtime exceed the approved 60 MB budget');
const dictionary=parse(cfg).PostProcess.character_dict;
assert.ok(Array.isArray(dictionary)&&dictionary.includes('<tr>'));
const server=http.createServer((req,res)=>{
 const path=req.url.split('?')[0];
 if(['/smart-scan-models.mjs','/smart-scan-engine.mjs','/smart-scan-layout.mjs','/table.onnx'].includes(path)){
  res.setHeader('content-type',path.endsWith('.mjs')?'text/javascript':'application/octet-stream');
  return res.end(fs.readFileSync(path.slice(1)));
 }
 res.setHeader('content-type','text/html');res.end('<!doctype html><meta charset="utf-8"><title>Mobile OCR lab</title>');
});
await new Promise(r=>server.listen(4173,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage();let locked=false,blocked=0;
 await page.route('**/*',r=>{
  const u=new URL(r.request().url());
  if(u.origin==='http://127.0.0.1:4173')return r.continue();
  if(locked){blocked++;return r.abort();}
  return r.continue();
 });
 await page.goto('http://127.0.0.1:4173/');
 await page.evaluate(async()=>{const m=await import('/smart-scan-models.mjs');await m.readModelPack();});
 locked=true;
 const report=await page.evaluate(async(dict)=>{
  const m=await import('/smart-scan-models.mjs'),e=await import('/smart-scan-engine.mjs');
  const p=await m.readModelPack({offline:true}),sessions=await m.openModelSessions(p);
  sessions.chars=e.dictionary(sessions.dictionaryYaml);
  const c=document.createElement('canvas');c.width=1280;c.height=570;const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#000';ctx.font='27px Arial';
  const rows=[['Наименование товара','Ед.','Количество','Цена с НДС','Сумма'],['Рис 25 кг','шт','3','2700,00','8100,00'],['Мука 5 кг','шт','2','125,00','250,00'],['Соус 1 л','шт','4','190,00','760,00'],['Масло 5 л','шт','2','820,00','1640,00']];
  const xs=[20,450,560,780,1010,1260],ys=Array.from({length:6},(_,i)=>45+i*95);
  for(const x of xs){ctx.beginPath();ctx.moveTo(x,ys[0]);ctx.lineTo(x,ys.at(-1));ctx.stroke();}
  for(const y of ys){ctx.beginPath();ctx.moveTo(xs[0],y);ctx.lineTo(xs.at(-1),y);ctx.stroke();}
  rows.forEach((row,i)=>row.forEach((t,j)=>ctx.fillText(t,xs[j]+12,ys[i]+60)));
  const source=ctx.getImageData(0,0,c.width,c.height);
  const image=ctx.getImageData(0,0,c.width,c.height);
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
   const shadow=1-.5*Math.exp(-((x/1280-.69)**2/.033+(y/570-.63)**2/.095));
   const i=(y*image.width+x)*4;for(let ch=0;ch<3;ch++)image.data[i+ch]*=shadow;
  }
  const normalized=e.normalizePaper(image);
  const scan=await e.scanRaster(image,{sessions,offline:true,normalize:true});
  // Table model gets just the document's table in this first controlled benchmark.
  const table=await sessions.ort.InferenceSession.create(new Uint8Array(await (await fetch('/table.onnx')).arrayBuffer()),{executionProviders:['wasm']});
  try {
   const size=488,scale=Math.min(size/(xs.at(-1)-xs[0]),size/(ys.at(-1)-ys[0])),w=Math.round((xs.at(-1)-xs[0])*scale),h=Math.round((ys.at(-1)-ys[0])*scale);
   ctx.putImageData(new ImageData(normalized.data,normalized.width,normalized.height),0,0);
   const cv=document.createElement('canvas');cv.width=w;cv.height=h;const cx=cv.getContext('2d',{willReadFrequently:true});
   cx.drawImage(c,xs[0],ys[0],xs.at(-1)-xs[0],ys.at(-1)-ys[0],0,0,w,h);
   const px=cx.getImageData(0,0,w,h).data,n=size*size,input=new Float32Array(3*n),mean=[.485,.456,.406],std=[.229,.224,.225];
   for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let ch=0;ch<3;ch++)input[ch*n+y*size+x]=(px[(y*w+x)*4+2-ch]/255-mean[ch])/std[ch];
   const output=await table.run({[table.inputNames[0]]:new sessions.ort.Tensor('float32',input,[1,3,size,size])});
   const shapes=Object.fromEntries(Object.entries(output).map(([k,v])=>[k,v.dims]));
   const logits=Object.values(output).find(v=>v.dims.length===3&&v.dims[2]===dict.length+2);
   if(!logits)throw Error('Table structure output shape mismatch: '+JSON.stringify(shapes));
   const tokens=['sos',...dict,'eos'];let structure=[];
   for(let i=0;i<logits.dims[1];i++){
    let best=0;for(let j=1;j<tokens.length;j++)if(logits.data[i*tokens.length+j]>logits.data[i*tokens.length+best])best=j;
    if(tokens[best]==='eos')break;if(best)structure.push(tokens[best]);
   }
   const norm=s=>s.toLowerCase().replace(/\s/g,'');
   const seen=norm(scan.items.map(x=>x.text).join(' '));
   const expected=rows.slice(1).flatMap(r=>[r[0],r[3],r[4]]);
   const exact=expected.filter(x=>seen.includes(norm(x)));
   return {shapes,structure,rowTokens:structure.filter(t=>t==='<tr>').length,expected,exact,seconds:scan.seconds,recognized:scan.items.map(x=>x.text)};
  } finally {await table.release();await sessions.dispose();}
 },dictionary);
 console.log(JSON.stringify(report));
 assert.equal(blocked,0,'Inference should be completely offline after models are cached');
 assert.equal(report.rowTokens,5,'Expected five structural rows');
 assert.equal(report.exact.length,report.expected.length,'Expected every product and price from shaded synthetic table');
} finally {await browser.close();server.close();}
