'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const a=require('./analytics');
const line={status:'confirmed',productId:'rice-a',comparisonGroupId:'rice-sushi',quantity:2,unit:'уп',pack:{size:25,unit:'кг'},grossTotal:5000};
const doc=(id,date,over={})=>({id,number:id,date,supplierId:'vendor-a',pointId:'baumana',status:'confirmed',lines:[line],...over});
test('normalize grams, ml, pack; no guessed pack',()=>{
assert.deepEqual(a.quantity(500,'г'),{value:.5,unit:'кг'});
assert.deepEqual(a.quantity(750,'мл'),{value:.75,unit:'л'});
assert.deepEqual(a.linePrice(line),{quantity:50,unit:'кг',price:100});
assert.throws(()=>a.quantity(1,'уп'));
});
test('draft lines ignored; duplicate confirmed invoices blocked',()=>{
const d=doc('a','2026-11-01');
assert.equal(a.observations([d,doc('b','2026-11-02',{status:'draft'}),doc('c','2026-11-02',{lines:[{...line,status:'review'}]})]).length,1);
assert.throws(()=>a.observations([d,{...d,id:'copy'}]));
});
test('history compares same brand, supplier and point; same day weighted',()=>{
const r=a.observations([doc('a','2026-11-01'),doc('b','2026-11-02',{lines:[{...line,grossTotal:5500}]}),doc('c','2026-11-02',{lines:[{...line,quantity:1,grossTotal:3250}]}),doc('d','2026-11-03',{pointId:'plasma'})]);
const c=a.changes(r);assert.equal(c.length,1);assert.equal(c[0].previousPrice,100);assert.equal(c[0].price,116.6667);assert.equal(c[0].percent,16.67);
});
test('supplier alternatives must match approved group, unit, point and recency',()=>{
const r=a.observations([doc('a','2026-11-10'),doc('b','2026-11-11',{supplierId:'vendor-b',lines:[{...line,productId:'rice-b',grossTotal:4500}]}),doc('c','2026-11-11',{lines:[{...line,productId:'other',comparisonGroupId:'other'}]}),doc('old','2026-09-01',{supplierId:'vendor-c'})]);
const c=a.compare(r,{groupId:'rice-sushi',unit:'кг',pointId:'baumana',asOf:'2026-11-15'});
assert.equal(c.length,2);assert.equal(c[0].price,90);assert.equal(a.potentialSaving(c[1],c[0],50),500);
assert.throws(()=>a.potentialSaving(c[1],{...c[0],pointId:'gs'},50));
});
