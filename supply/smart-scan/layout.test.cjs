'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{parse}=require('./layout.cjs');
function invoice(n){
 const boxes=[],expected=[];
 const add=(t,x,y,w=20)=>boxes.push({text:String(t),score:.99,poly:[[x-w/2,y-4],[x+w/2,y-4],[x+w/2,y+4],[x-w/2,y+4]]});
 for(const [t,x] of [['2',400],['3',480],['4',548],['5',606],['6',660],['7',700],['8',755],['9',820],['10',870],['11',980]])add(t,x,100);
 let sum=0;
 for(let i=0;i<n;i++){
   const y=120+i*36,q=i%9+1,price=110+i*11,net=price*100/110,gross=price*q;sum+=gross;
   const name='Новый товар '+(i+1)+' 1 кг';
   expected.push([name,q,price,gross]);
   add(name,235,y+7,200);add(q.toFixed(3).replace('.',','),484,y+5);add(net.toFixed(2),548,y);add((net*q).toFixed(2),619,y);add('10%',690,y);add(gross.toFixed(2),830,y);
 }
 add(sum.toFixed(2),830,120+n*36);add('Всего к оплате',175,130+n*36,100);return {boxes,expected,sum};
}
for(const count of [1,100,250,500])test('no row-count cap: '+count,()=>{
 const {boxes,expected,sum}=invoice(count),r=parse(boxes);
 assert.equal(r.layout,'upd');assert.equal(r.rows.length,count);assert.equal(r.totalOk,true);assert.equal(r.sum,sum);
 assert.deepEqual(r.rows.map(x=>[x.name,x.quantity,x.price,x.total]),expected);
 assert.equal(r.reviewRequired,true); // arithmetic alone is not proof of correct product names.
});
test('missing name stays missing and flagged, never invented',()=>{
 const {boxes}=invoice(3);const r=parse(boxes.filter(b=>b.text!=='Новый товар 2 1 кг'));
 assert.equal(r.rows.length,3);assert.equal(r.rows[1].name,'');assert.ok(r.unresolved.includes(2));assert.equal(r.reviewRequired,true);
});
test('missing line amount fails footer validation',()=>{
 const {boxes}=invoice(5);const idx=boxes.findIndex(b=>b.text==='242.00'&&b.poly[0][0]>800);
 assert.ok(idx>=0);boxes.splice(idx,1);const r=parse(boxes);assert.equal(r.rows.length,4);assert.equal(r.totalOk,false);assert.equal(r.reviewRequired,true);
});
test('arbitrary unstructured picture is not an invoice',()=>{assert.equal(parse([{text:'Случайный текст',score:.99,poly:[[1,1],[10,1],[10,5],[1,5]]}]).rows.length,0);});
