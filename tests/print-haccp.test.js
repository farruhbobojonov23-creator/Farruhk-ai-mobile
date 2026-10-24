import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as h from '../public/farukh-print/haccp-catalog.js';
const start=Date.parse('2026-10-24T09:00:00Z');
test('HACCP dates: 21 days reserve, 30 days bounded by factory date, explicit shift',()=>{
 assert.equal(h.deadline(h.templates[0],start),Date.parse('2026-11-14T09:00:00Z'));
 const t=h.templates[3];
 assert.equal(h.deadline(t,start,start+60*86400000),Date.parse('2026-11-23T09:00:00Z'));
 assert.equal(h.deadline(t,start,start+5*86400000),start+5*86400000);
 assert.throws(()=>h.deadline(t,start,NaN));
 assert.throws(()=>h.deadline(h.templates[1],start,start+25*3600000));
 assert.equal(h.deadline(h.templates[1],start,start+8*3600000),start+8*3600000);
 assert.equal(h.deadline(h.templates[6],start),null);
});
test('Saved batch survives repeated print and restart; nine templates render 464×320',async()=>{
 const storage=new Map(),els=new Map();
 const texts=[];
 const doc={getElementById(id){if(!els.has(id))els.set(id,{value:''});return els.get(id)},createElement(){return {width:0,height:0,getContext(){return {scale(){},fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(s){texts.push(s)},measureText(s){return {width:s.length*parseFloat(/([0-9.]+)px/.exec(this.font)?.[1]||12)*.54}}}}}}};
 const code=(await fs.readFile(new URL('../public/farukh-print/print.js',import.meta.url),'utf8')).replace('boot();\n})();', 'window.test={set(m){HACCP=m},prepareHaccp,haccpBatch,drawHaccp,newBatch(p){haccpDraft={id:p.id,batch:null}}};\n})();');
 function load(){const w={};new Function('window','document','localStorage',code)(w,doc,{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)});w.test.set(h);return w.test;}
 let api=load();const p=h.templates[0];api.prepareHaccp(p);const first=api.haccpBatch(p);
 api.prepareHaccp(p);assert.deepEqual(api.haccpBatch(p),first);
 api=load();assert.deepEqual(api.haccpBatch(p),first);
 for(const t of h.templates){
  doc.getElementById('haccp-limit').value=new Date(Date.now()+3600000).toISOString();
  api.prepareHaccp(t);const c=api.drawHaccp(t,1);assert.equal(c.width,464);assert.equal(c.height,320);
 }
 assert.ok(texts.some(t=>t.includes('Заменить до:')));
 assert.ok(!texts.some(t=>t.includes('Ккал')));
});
