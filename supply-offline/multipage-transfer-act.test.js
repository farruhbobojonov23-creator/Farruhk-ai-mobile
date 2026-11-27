'use strict';
const assert=require('node:assert/strict');
const {extract}=require('./invoice-draft');
// Anonymous, synthetic page geometry based on the type of invoice, not customer data.
const pt=(text,x,y)=>({text,score:.99,box:[[x-5,y-3],[x+5,y-3],[x+5,y+3],[x-5,y+3]]});
const scan=regions=>({schema:'farukh-ocr-regions-v1',width:1000,height:1000,regions});
const page1=[pt('АКТ ПРИЕМА-ПЕРЕДАЧИ по УПД № DEMO-742/851 от 23.11.2026',350,50)];
for(let k=1;k<=15;k++)page1.push(pt(String(k),[45,120,245,405,460,500,550,600,645,700,782,834,880,925,970][k-1],300));
const amounts=[100,200,300,400,500,600,700,800,900,1000];
for(let i=0;i<10;i++){
  const y=340+i*35;
  const name=i===0?'Соус порционный 30 г':i===1?'Нори 100 шт':'Продукт '+(i+1)+' 1 кг';
  const u=i===9?'кг':'шт',qty=i===9?'5':String(i+1);
  page1.push(pt(name,245,y),pt(u,405,y),pt(String(10+i)+',00',645,y),
             pt(amounts[i].toFixed(2).replace('.',','),700,y),pt(qty,782,y));
}
const page2=[pt('ВСЕГО ПЕРЕДАНО',490,250),pt('10',550,250),
  pt('5 500,00',700,250),pt('999',782,250),pt('Страница 2 из 2',500,940)];
const batch={schema:'farukh-ocr-batch-v1',pages:[scan(page1),scan(page2)]};
const d=extract(batch,[]);
assert.equal(d.rows.length,10,'All ten rows should be collected from first page');
assert.equal(d.total,5500,'Total should be matched against page 2 footer');
assert.equal(d.number,'DEMO-742/851');
assert.equal(d.date,'2026-11-23');
assert.equal(d.page_count,2);
assert.equal(d.complete,false,'Never auto-confirm full invoice');
assert.equal(d.rows[0].unit,'шт','Portioned product must be priced per piece');
assert.equal(d.rows[0].factor,1);
assert.equal(d.rows[1].unit,'шт','Nori count must be per piece');
assert.equal(d.rows[1].factor,100);
assert.equal(d.rows[9].unit,'кг');
assert.equal(d.rows[9].factor,1);
const mismatched=scan(page2.map(r=>({...r,text:r.text==='5 500,00'?'5 400,00':r.text})));
const bad=extract({schema:'farukh-ocr-batch-v1',pages:[scan(page1),mismatched]},[]);
assert.equal(bad.total,null,'Do not accept an unmatched document total');
assert.equal(bad.complete,false);
assert.throws(()=>extract({schema:'farukh-ocr-batch-v1',pages:[scan(page1)]},[]));
console.log('MULTIPAGE_TRANSFER_ACT_DRAFT_PASS (10 synthetic rows; no supplier photos uploaded)');
