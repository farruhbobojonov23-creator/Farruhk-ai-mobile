const test=require('node:test');
const a=require('node:assert/strict');
const m=require('../supply-android/app/src/main/assets/product-catalog.js');
const catalog=[{id:'shrimp',name:'Креветка очищенная 16/20'},{id:'raw',name:'Креветка неочищенная 16/20'}];
const row={name:'Креветка в/м 16/20',article:'A100',price:1200};
test('similar names require confirmation; a new supplier cannot inherit aliases',()=>{
 a.equal(m.resolve(row,'ООО Тест',catalog,{}).status,'review');
 const aliases=m.confirm(row,'ООО Тест','shrimp','brand1',catalog,{});
 a.deepEqual(m.resolve({...row,price:1300},'ООО «Тест»',catalog,aliases),{status:'known',productId:'shrimp',variantId:'brand1'});
 a.equal(m.resolve(row,'Другой',catalog,aliases).status,'review');
 a.equal(m.resolve({...row,name:'Креветка неочищенная 16/20'},'ООО Тест',catalog,aliases).status,'review');
 a.equal(m.resolve({...row,article:'A101'},'ООО Тест',catalog,aliases).status,'review');
 a.equal(m.resolve({name:'Нори'},'ООО Тест',catalog,aliases).status,'new');
 a.equal(m.resolve(row,'ООО Тест',catalog,m.unlink(row,'ООО Тест',aliases)).status,'review');
 a.equal(row.price,1200);
});
test('cannot confirm unknown product or missing variant',()=>{
 a.throws(()=>m.confirm(row,'ООО Тест','unknown','v',catalog,{}));
 a.throws(()=>m.confirm(row,'ООО Тест','shrimp','',catalog,{}));
});
