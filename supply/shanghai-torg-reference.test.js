'use strict';
// Regression fixture: SHANGHAI-TORG invoice ШТП0143860, 11.11.2026.
// Independent expected values; do not use this fixture as a production product catalog.
const assert=require('node:assert/strict');
const parser=require('./vendor-layouts-v98.js');
const header=['Наименование','Количество','Ед. изм.','Цена с НДС','Сумма с НДС'];
const rows=[
 ['Сыр Савушкин 65% 10,5 кг','5','шт','4450','22250'],
 ['Кунжут белый жареный 1 кг','4','шт','355','1420'],
 ['Нори KAMINARY Premium 100 листов','10','шт','800','8000'],
 ['Палочки бамбуковые KAMINARY 100 пар','10','шт','78','780'],
 ['Майонез Печагин Профи 78% 10 л / 9,3 кг','4','шт','1815','7260'],
 ['Крабовые палочки Санта Бремор 0,5 кг','36','шт','216','7776']
];
assert.equal(parser.detectSupplierTemplate('ООО ШАНХАЙ-ТОРГ ИНН 6319241516').id,'shanghai');
const result=parser.parseSupplierTable('shanghai',header,rows,{printedTotal:47486});
assert.ok(result,'Table must parse');
assert.equal(result.items.length,6);
assert.equal(result.items.reduce((s,x)=>s+x.invoiceTotal,0),47486);
assert.equal(result.documentVerified,true);
for(let i=0;i<rows.length;i++){
 assert.equal(result.items[i].name,rows[i][0]);
 assert.equal(result.items[i].quantity,Number(rows[i][1]));
 assert.equal(result.items[i].price,Number(rows[i][3]));
 assert.equal(result.items[i].invoiceTotal,Number(rows[i][4]));
}
console.log('SHANGHAI-TORG structured invoice fixture passed (6 rows, 47486 RUB)');
