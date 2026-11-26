import assert from 'node:assert/strict';
import {extractLayout} from './smart-scan-layout.mjs';
function synthetic(n){
 const out=[];const add=(text,x,y,w=20)=>out.push({text:String(text),score:.99,poly:[[x-w/2,y-4],[x+w/2,y-4],[x+w/2,y+4],[x-w/2,y+4]]});
 for(const [text,x] of [['2',400],['3',480],['4',548],['5',606],['6',660],['7',700],['8',755],['9',820],['10',870],['11',980]])add(text,x,100);
 let sum=0;const expected=[];
 for(let i=0;i<n;i++){
  const y=120+i*36,q=i%9+1,p=110+i*11,net=p*100/110,total=q*p;sum+=total;expected.push([q,p,total]);
  add('Новый товар '+(i+1)+' 1 кг',235,y+7,200);add(q+',000',484,y+5);add(net.toFixed(2),548,y);add((net*q).toFixed(2),619,y);add('10%',690,y);add(total.toFixed(2),830,y);
 }
 const y=120+n*36;add(sum.toFixed(2),830,y);add('Всего к оплате',175,y+10,100);
 return {items:out,expected,sum};
}
for(const n of [1,100,250,500]){
 const s=synthetic(n),r=extractLayout(s.items);
 assert.equal(r.kind,'upd');assert.equal(r.rows.length,n);assert.equal(r.sum,s.sum);assert.equal(r.totalOK,true);assert.equal(r.reviewRequired,true);
 assert.deepEqual(r.rows.map(x=>[x.quantity,x.price,x.total]),s.expected);assert.ok(r.rows.every(x=>x.name.startsWith('Новый товар ')));
 console.log('Synthetic layout:',n,'/',n);
}
assert.equal(extractLayout([]).rows.length,0);
const missing=synthetic(100);missing.items=missing.items.filter(b=>b.text!=='110.00'||b.poly[0][1]!==116);const result=extractLayout(missing.items);assert.equal(result.totalOK,false);assert.equal(result.reviewRequired,true);
console.log('Incomplete invoice is not reconciled.');
