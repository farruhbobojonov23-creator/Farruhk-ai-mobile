const test=require('node:test');
const assert=require('node:assert/strict');
const p=require('../supply-android/app/src/main/assets/invoice-parser.js');
const head='Поставщик: Тестовый поставщик\nНаименование товара Количество Цена с НДС Сумма\n';
test('minimal fields and derived prices',()=>{
 const r=p.parsePurchaseFields(head+'1 Рис 25 кг уп 3 2700,00 8100,00\n2 Масаго 500 г 6 шт 570,00\nИтого: 11520,00');
 assert.equal(r.supplier,'Тестовый поставщик');assert.equal(r.items.length,2);
 assert.equal(r.items[0].packKg,25);assert.equal(r.items[1].packKg,.5);
 assert.equal(r.items[1].invoiceTotal,3420);assert.equal(r.documentVerified,true);
 assert.equal(p.purchaseMetrics(r.items[0]).pricePerKg,108);
});
test('gross price must be explicit',()=>{
 assert.equal(p.parsePurchaseFields(head.replace('Цена с НДС','Цена')+'Рис шт 3 2700,00'),null);
 assert.equal(p.parsePurchaseFields(head.replace('Цена с НДС','Цена без НДС')+'Рис шт 3 2700,00'),null);
});
test('wrong total or missing rows never marked verified',()=>{
 const r=p.parsePurchaseFields(head+'Рис 25 кг шт 3 2700,00\nСтрока не прочитана\nИтого: 8100,00');
 assert.equal(r.documentVerified,false);assert.equal(r.unparsed,1);
 assert.equal(p.parsePurchaseFields(head+'Рис шт 3 2700,00 8000,00'),null);
 assert.equal(p.parsePurchaseFields(head+'Рис шт 3 2700,00\nИтого: 9000,00').documentVerified,false);
});
test('500 independent rows, preserve duplicate products',()=>{
 const rows=Array.from({length:500},(_,i)=>(i+1)+' Мука тестовая 5 кг шт 2 100,00');
 const r=p.parsePurchaseFields(head+rows.join('\n')+'\nИтого: 100000,00');
 assert.equal(r.items.length,500);assert.equal(r.documentVerified,true);
});
test('liters and weighed purchases',()=>{
 const r=p.parsePurchaseFields(head+'Соус 20 л уп 2 1500,00\nРыба кг 2,5 900,00\nИтого: 5250,00');
 assert.equal(r.documentVerified,true);assert.equal(r.items[0].packL,20);
 assert.equal(p.purchaseMetrics(r.items[0]).pricePerL,75);
 assert.equal(p.purchaseMetrics(r.items[1]).pricePerKg,900);
});
