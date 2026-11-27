'use strict';
const assert = require('node:assert/strict');
const {extract} = require('./invoice-draft');
// Synthetic OCR regions reproducing table structures seen on real supplier invoices.
// Contains NO uploaded photos, buyer identifiers or personal data.
function scan(parts) {
  return {schema:'farukh-ocr-regions-v1',width:1000,height:1000,regions:parts.map(([text,x,y])=>({
    text,score:0.99,box:[[x-8,y-4],[x+8,y-4],[x+8,y+4],[x-8,y+4]]
  }))};
}
function check(parts, expected) {
  const out = extract(scan(parts), []);
  assert.equal(out.rows.length, 1, 'Expected one readable item');
  assert.equal(out.total, expected.total, 'Total amount');
  assert.equal(out.rows[0].qty, expected.qty, 'Quantity');
  assert.equal(out.rows[0].unit, expected.unit, 'Comparison unit');
  assert.equal(out.rows[0].factor, expected.factor, 'Package factor');
  assert.equal(out.rows[0].amount, expected.total, 'Amount with VAT where applicable');
  assert.equal(out.complete, false, 'OCR stays a draft pending manual verification');
}
const updHeader=[['1а',225,290],['1б',315,290],['2',390,290],['2а',440,290],
 ['3',500,290],['4',570,290],['5',650,290],['6',695,290],['7',730,290],
 ['8',775,290],['9',855,290],['10',915,290],['11',950,290]];
check([
 ['Счёт-фактура № DEMO-001 от 01.01.2026',400,50],...updHeader,
 ['Товар А 5 л',225,350],['шт',390,350],['796',440,350],
 ['2,000',500,350],['100,00',570,350],['200,00',650,350],['20%',730,350],
 ['20,00',775,350],['220,00',855,350],
 ['Итого',225,450],['220,00',855,450]
],{qty:2,unit:'л',factor:5,total:220});
check([
 ['Реализация № DEMO-002 от 01.01.2026',400,80],
 ['Наименование',260,250],['Ед. изм.',450,250],['Кол-во',590,250],
 ['Цена',750,250],['Сумма',860,250],
 ['Товар Б 500 г',260,350],['упак',450,350],['12',590,350],
 ['50,00',750,350],['600,00',860,350],['Итого',260,450],
 ['600,00',860,450]
],{qty:12,unit:'кг',factor:0.5,total:600});
check([
 ['ТОВАРНО-ТРАНСПОРТНАЯ НАКЛАДНАЯ',400,50],
 ...[['1',120],['2',220],['3',300],['4',360],['5',440],['6',530],
     ['7',650],['8',740],['9',810]].map(([t,x])=>[t,x,250]),
 ['Товар В 1,8 кг',220,350],['кг',360,350],
 ['325,00',650,350],['3,250',740,350],
 ['Итого',300,450],['325,00',650,450]
],{qty:3.25,unit:'кг',factor:1,total:325});
console.log('SUPPLIER_FORMATS_SMOKE_PASS (3 synthetic layouts based on supplier documents; NOT real-photo OCR)');
