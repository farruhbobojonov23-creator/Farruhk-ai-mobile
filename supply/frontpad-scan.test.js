'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
require('../supply-android/app/src/main/assets/invoice-parser.js');
const {parseText,parseWords}=globalThis.supplyFrontpadScan;
const sample=['Накладная','Наименование Кол-во Цена Сумма',
 '1 Продукт один 20 кг. 190.69 руб. 3813.72 руб.',
 '2 Другой продукт 30.044 кг. 1911.47 руб. 57428.2 руб.',
 '3 Третий продукт 2 шт. 216.7 руб. 433.4 руб.',
 'Итого 61675.33 руб.'].join('\n');
test('three Frontpad rows including per-line rounding and total',()=>{
 const r=parseText(sample);assert.equal(r.balanced,true);assert.equal(r.items.length,3);
 assert.deepEqual(r.items.map(x=>x.quantity),[20,30.044,2]);
});
test('misread digit corrected only as review suggestion backed by price and total',()=>{
 const r=parseText(sample.replace('30.044 кг','50.044 кг'));
 assert.equal(r.balanced,true);assert.equal(r.items[1].quantity,30.044);
 assert.equal(r.items[1].quantityCorrected,true);
});
test('one tampered sum refuses acceptance',()=>{
 const r=parseText(sample.replace('57428.2 руб.','51428.2 руб.'));
 assert.equal(r.balanced,false);
});
test('new assortment and quantities do not reuse fixed sample data',()=>{
 const r=parseText(['1 Непохожий продукт 5 шт. 12.34 руб. 61.70 руб.','Итого 61.70 руб.'].join('\n'));
 assert.equal(r.balanced,true);assert.equal(r.items[0].name,'Непохожий продукт');
});
test('synthetic word geometry must produce three rows and same invoice total',()=>{
 const poly=(x,y)=>[[x,y],[x+36,y],[x+36,y+16],[x,y+16]],w=(t,x,y)=>({text:t,poly:poly(x,y)});
 const words=[w('Наименование',64,410),w('Кол-во',281,410),w('Цена',380,410),w('Сумма',476,410)];
 [['Продукт один','20 кг.','190.69','3813.72'],['Другой продукт','30.044 кг.','1911.47','57428.2'],['Третий продукт','2 шт.','216.7','433.4']]
 .forEach((r,i)=>r.forEach((x,j)=>words.push(w(x,[64,280,380,475][j],440+i*24))));
 words.push(w('Итого',64,525),w('61675.33',475,525));
 const r=parseWords(words,{width:709,supplier:'Поставщик'});assert.equal(r.balanced,true);
 assert.equal(r.items.length,3);
});

test('Frontpad number and date are from visible document header only',()=>{
 const raw=['Накладная','Номер 1377','От 26.11.2026 12:27:28','Филиал Полярные зори 43/1',
 'Поставщик Восток-Запад'].join('\n');
 const p=require('../supply-android/app/src/main/assets/invoice-parser.js').frontpad.parseHeader(raw);
 assert.deepEqual(p,{number:'1377',date:'2026-11-26',pointId:'polyar'});
});
test('Frontpad unrelated orphan numbers cannot become document number',()=>{
 const raw='Накладная\nМайонез 20 кг 190.69 руб.\nВсего 61675.33';
 const p=require('../supply-android/app/src/main/assets/invoice-parser.js').frontpad.parseHeader(raw);
 assert.equal(p.number,null);assert.equal(p.date,null);
});
