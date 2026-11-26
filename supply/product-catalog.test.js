const test=require('node:test');
const a=require('node:assert/strict');
const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../supply-android/app/src/main/assets/product-catalog.js'),'utf8');const mod={exports:{}};new Function('module',source)(mod);const m=mod.exports;
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

test('packaging change cannot silently reuse an alias',()=>{const r={...row,unit:'уп',packKg:1.8};const aliases=m.confirm(r,'ООО Тест','shrimp','brand1',catalog,{});a.equal(m.resolve({...r,packKg:2},'ООО Тест',catalog,aliases).status,'review');a.equal(m.resolve({...r,unit:'кг'},'ООО Тест',catalog,aliases).status,'review');});

test('embedded app matching module equals the tested source',()=>{const app=require('node:fs').readFileSync(require('node:path').join(__dirname,'../supply-android/app/src/main/assets/app.js'),'utf8');a.ok(app.includes(source));});

test('invoice headers, document identity and daily supplier totals stay separate',()=>{const app=require('node:fs').readFileSync(require('node:path').join(__dirname,'../supply-android/app/src/main/assets/app.js'),'utf8');const source=app.slice(app.indexOf('function invoiceHeader('),app.indexOf('function pageMeta('));const f=new Function('norm','supplierKey','grouped','linesOf','grossMetrics',source+'\\nreturn {invoiceHeader,sameDocument,dailyPurchases};'.replace('\\n','\n'))(x=>String(x||'').toLowerCase().trim(),x=>String(x).toLowerCase().replace(/[«»]/g,''),(xs,k)=>{const m=new Map();for(const x of xs){const key=k(x);if(!m.has(key))m.set(key,[]);m.get(key).push(x)}return m},d=>d.lines,l=>({totalPrice:l.amount}));a.deepEqual(f.invoiceHeader('Реализация № TEST 123456 от 01.01.2025'),{documentNumber:'test123456',documentDate:'2025-01-01'});a.equal(f.invoiceHeader('Реализация № A1 от 01.01.2025\nРеализация № A2 от 01.01.2025').documentNumber,null);const d={supplierId:'Тест',documentNumber:'a',documentDate:'2025-01-01',lines:[{amount:100.25}]},e={...d,documentNumber:'b',lines:[{amount:200.75}]};a.equal(f.sameDocument(d,e),false);a.equal(f.sameDocument(d,{...d}),true);a.deepEqual(f.dailyPurchases([d,e]),[{day:'2025-01-01',count:2,total:301}]);});
