'use strict';
const t=require('node:test'),a=require('node:assert/strict'),s=require('../spatial-layout.js'),api=require('../server.cjs');
const w=(txt,x,y)=>({text:String(txt),left:x,right:x+Math.max(28,String(txt).length*7),top:y,bottom:y+12,confidence:.97});
function sample(n=2){
 let boxes=[w('Наименование',80,100),w('Количество',440,100),w('Цена',625,100),w('Сумма',850,100)],sum=0;
 for(let i=0;i<n;i++){const y=170+i*90,q=i+2,p=50+i*10;sum+=q*p;
 boxes.push(w('Новый продукт '+(i+1),75,y-20),w('пачка 1 кг',75,y-5),w(q,450,y),w(p,635,y),w(q*p,855,y))}
 return {boxes,sum}
}
t('spatial model supports 1,2,6,20 dynamic rows, exact quantities and prices',()=>{
 for(const n of [1,2,6,20]){const d=sample(n),r=s.parse(d.boxes,{supplier:'Тест',printedTotalRub:d.sum});
  a.equal(r.items.length,n);a.equal(r.calculatedTotalRub,d.sum);a.equal(r.verified,false)}
});
t('spatial model refuses missing price and does not guess from document total',()=>{
 const d=sample(2);d.boxes=d.boxes.filter(x=>x.text!=='60');const r=s.parse(d.boxes,{supplier:'Тест',printedTotalRub:d.sum});
 a.equal(r.status,'incomplete');a.equal(r.items.length,1)
});
t('no supplier / invalid geometry never auto-accepted',()=>{
 const d=sample(1);a.equal(s.parse(d.boxes).items.length,0);
 a.equal(s.normBoxes([{text:'X',left:20,right:10,top:5,bottom:10}]).length,0)
});
t('TSV transport preserves x/y boxes and rejects disguised file types',()=>{
 const hdr='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n';
 const out=api.tsvToLayout(hdr+'5\t1\t1\t1\t1\t1\t20\t30\t40\t12\t95.0\tТовар\n');
 a.equal(out.text,'Товар');a.equal(out.boxes.length,1);a.equal(out.boxes[0].right,60);
 a.equal(api.validMagic('image/jpeg',Buffer.from([255,216,255])),true);
 a.equal(api.validMagic('image/jpeg',Buffer.from('BAD')),false)
});
