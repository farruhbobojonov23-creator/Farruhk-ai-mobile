'use strict';
const test=require('node:test'),a=require('node:assert/strict'),api=require('../public/marr-block-layout.js');
const b=(text,left,top,width=40)=>({text:String(text),left,right:left+width,top,bottom:top+17,confidence:.97});
function invoice(n){
 let words=[b('Наименование',271,454,120),b('Кол-во',602,454,56),b('Цена',781,447),
 b('Сумма',888,443,56)],sum=0;
 for(let i=0;i<n;i++){
  const y=515+i*90,q=i+1,p=100+5*i;sum+=q*p;
  words.push(b('Новый',217,y),b('товар',280,y),b('500',220,y+20),b('г',268,y+20,15),
   b('упак',480,y+20),b(q,649,y+25,20),b(p.toFixed(2).replace('.',','),788,y+22,55),
   b((q*p).toFixed(2).replace('.',','),915,y+22,65),b((i+1)+'1234567890',82,y+58,115));
 }
 return {words,sum};
}
test('1, 2, 6, 20 dynamic lines from geometry (synthetic; not real photos)',()=>{
 for(const n of [1,2,6,20]){
  const d=invoice(n),r=api.parse(d.words,{supplier:'МАРР РУССИЯ',printedTotalRub:d.sum});
  a.equal(r.items.length,n,JSON.stringify(r.warnings));
  a.equal(r.calculatedTotalRub,d.sum);
  a.equal(r.verified,false);
  a.equal(r.items[0].unit,'уп');
 }
});
test('split thousands only join when q * price matches printed total',()=>{
 const d=invoice(1);
 d.words.find(x=>x.left===649).text='12';d.words.find(x=>x.left===788).text='594,34';
 const k=d.words.findIndex(x=>x.left===915),old=d.words[k];
 d.words.splice(k,1,b('7',901,old.top,15),b('132,08',930,old.top,55));
 const r=api.parse(d.words,{supplier:'МАРР РУССИЯ',printedTotalRub:7132.08});
 a.equal(r.items.length,1);a.equal(r.items[0].lineTotalRub,7132.08);
});
test('missing values never filled from total and never auto verified',()=>{
 const d=invoice(2),words=d.words.filter(x=>!(x.left===915&&x.top>560));
 const r=api.parse(words,{supplier:'МАРР РУССИЯ',printedTotalRub:d.sum});
 a.equal(r.items.length,1);a.equal(r.status,'incomplete');a.equal(r.verified,false);
 a.equal(api.parse(d.words,{supplier:'Неизвестный'}).items.length,0);
});
