'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../supply-android/app/src/main/assets');
const c={};vm.runInNewContext(fs.readFileSync(path.join(root,'invoice-parser.js'),'utf8'),c);
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
vm.runInNewContext(app.split('\n})();')[0]+'\n})();',c);
const spatial=c.supplySpatial,parser=c.supplyInvoiceParser;
const m=['№','Код','Наименование','Ед.','Мест','Кол-во','Вес','Цена','Сумма'];
const u=['А','1','1а','1б','2','2а','3','4','5','6','7','8','9','10','10а','11'];
const a=Array.from({length:15},(_,i)=>String(i+1));
const f=(n,d=2)=>n.toFixed(d).replace('.',',');
function boxes(header,rows,foot){
 const out=[];const add=(r,y)=>r.forEach((v,i)=>{if(v!==''&&v!=null)out.push({text:String(v),left:i*100+10,right:i*100+90,top:y,bottom:y+12,confidence:.98})});
 if(header)add(header,20);rows.forEach((r,i)=>add(r,50+i*30));if(foot)add(foot,50+rows.length*30);return out;
}
const marr=(i,q=2)=>[i,String(9900000000+i),'Новый ингредиент '+i+' 1 кг','упак','',q,f(q,3),f(100+i),f(q*(100+i))];
const sum=(rs,i)=>rs.reduce((s,r)=>s+Number(String(r[i]).replace(',','.')),0);
const mf=rs=>['','','ИТОГО:','','',sum(rs,5),f(sum(rs,6),3),'',f(sum(rs,8))];
const upd=(i,q=2)=>['',i,'Новый продукт '+i+' 500 г','','796','шт',f(q,3),f(100+i),f(q*(100+i)),'без акциза','10%',f(q*(100+i)/10),f(q*(100+i)*1.1),'','',''];
const uf=rs=>['','Всего к оплате','','','','','','',f(sum(rs,8)),'','x',f(sum(rs,11)),f(sum(rs,12)),'','',''];
const act=i=>[i,String(9900000000000+i),'Новый товар '+i+' 1 кг','шт','','','','22',f(50+i),f(2*(50+i)),2,'','','',''];
const extract=(header,rows,footer,supplier='Тестовый поставщик')=>spatial.spatialInvoiceTable(boxes(header,rows,footer),'',{supplier,items:[]},parser);
const total=r=>r.items.reduce((s,x)=>s+Math.round(x.invoiceTotal*100),0)/100;
test('eight document shapes: all 53 unknown product rows, no catalog lookup',()=>{
 const rows=Array.from({length:16},(_,i)=>marr(i+1));[rows[4],rows[15]]=[rows[15],rows[4]];
 const first=extract(m,rows.slice(0,12),null,'ООО «МАРР РУССИЯ»'),second=extract(null,rows.slice(12),mf(rows),'ООО «МАРР РУССИЯ»');
 assert.equal(first.items.length,12);assert.equal(second.items.length,4);assert.equal(first.documentVerified,false);assert.equal(second.documentVerified,false);
 assert.equal(Math.round((total(first)+total(second))*100),Math.round(sum(rows,8)*100));assert.equal(second.marrControl.quantity,32);
 let found=16;
 for(const n of [2,11]){
  const rs=Array.from({length:n},(_,i)=>marr(i+1));if(n===11)rs[4][1]=rs[3][1];
  const r=extract(m,rs,mf(rs));assert.equal(r.items.length,n);assert.equal(r.documentVerified,true);assert.equal(total(r),sum(rs,8));found+=r.items.length;
 }
 for(const n of [4,6,1,2]){
  const rs=Array.from({length:n},(_,i)=>upd(i+1));rs[0][6]='✓';const r=extract(u,rs,uf(rs));assert.equal(r.items.length,n);assert.equal(r.documentVerified,true);assert.equal(r.items[0].quantity,2);assert.equal(Math.round(total(r)*100),Math.round(sum(rs,12)*100));found+=r.items.length;
 }
 const rs=Array.from({length:11},(_,i)=>act(i+1)),r=extract(a,rs,null);assert.equal(r.items.length,11);assert.equal(r.documentVerified,false);found+=r.items.length;
 assert.equal(found,53);
});
test('reject inconsistent VAT, duplicate row numbers and supplierless headerless pages',()=>{
 const rs=[upd(1),upd(2)],ft=uf(rs);rs[0][11]='99,99';assert.equal(extract(u,rs,ft),null);
 const ms=[marr(1),marr(1)];assert.equal(extract(m,ms,mf(ms)),null);
 assert.equal(extract(null,[marr(1),marr(2)],null,''),null);
});
test('preserve unknown products and distinct rows with the same article',()=>{
 const rs=[marr(1),marr(2,3)];rs[1][1]=rs[0][1];const r=extract(m,rs,mf(rs));assert.equal(r.items.length,2);assert.equal(r.items[0].article,r.items[1].article);assert.equal(r.items[1].quantity,3);
});
