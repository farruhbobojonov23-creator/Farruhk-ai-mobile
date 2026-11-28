'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const api=require('../public/vendor-layouts-v2.js');
const suppliers=[
 ['shanghai','ООО «ШАНХАЙ-ТОРГ»'],
 ['alidi','ООО «АЛИДИ ПРОФ»'],
 ['vesta','ООО «ВЕСТА»'],
 ['virgo','ООО «ВИРГО»'],
 ['chistyakova','ИП Чистякова Ирина Юрьевна'],
 ['vostok_zapad','ООО «ВОСТОК-ЗАПАД»'],
 ['marr','ООО «МАРР РУССИЯ»']
];
const rub=v=>v.toFixed(2).replace('.',',');
function fixture(supplier,n=6,wrong=-1){
 let total=0,lines=['Поставщик: '+supplier,
 'Наименование\tКоличество\tЕд. изм.\tЦена с НДС\tСумма с НДС'];
 for(let i=0;i<n;i++){
  const qty=i+1,price=125+i*3,sum=qty*price;total+=sum;
  lines.push(['Новый продукт '+(i+1)+' 0,5 кг',qty,'шт',rub(price),rub(sum+(wrong===i?5:0))].join('\t'));
 }
 lines.push(['Итого','','','',rub(total)].join('\t'));
 return lines.join('\n');
}
test('all seven vendors handle variable 1, 6 and 20 lines without catalog prices',()=>{
 for(const [id,name] of suppliers)for(const count of [1,6,20]){
  const src=fixture(name,count),detected=api.detectSupplierTemplate(src),parsed=api.parseSupplierDelimited(src);
  assert.equal(detected?.id,id,id+' vendor');
  assert.equal(parsed?.items?.length,count,name+' '+count);
  assert.equal(parsed.documentVerified,true,name+' arithmetic');
  assert.equal(parsed.pageVerified,false,'OCR text alone cannot verify photo');
  assert.equal(parsed.items[count-1].name,'Новый продукт '+count+' 0,5 кг');
  assert.equal(parsed.items[count-1].unit,'шт');
  assert.equal(parsed.items[count-1].price,125+3*(count-1));
 }
});
test('gross line price mismatch is never accepted from correct printed grand total',()=>{
 const raw=fixture('ООО «ШАНХАЙ-ТОРГ»',6,2);
 const result=api.parseSupplierDelimited(raw);
 assert(result);
 assert.equal(result.documentVerified,false);
 assert.equal(result.items.length,5);
 assert(result.warnings.some(w=>/не сходится|Пропущено|совпадает/i.test(w)));
});
test('ambiguous supplier is unsupported',()=>{
 assert.equal(api.detectSupplierTemplate('ООО ИНОЙ ПОСТАВЩИК'),null);
 assert.equal(api.parseSupplierDelimited('ООО ИНОЙ ПОСТАВЩИК\nНаименование\tКоличество\tЕд. изм.\tЦена с НДС\tСумма с НДС'),null);
});

test('TTN keeps goods quantity distinct from gross mass and labels derived price',()=>{
 const headers=['Наименование','Количество мест','Ед. изм.','Масса брутто','Сумма с НДС'];
 const rows=[['Синтетический продукт','5,000','кг','5,500','100,00']];
 const got=api.parseSupplierTable('vostok_zapad',headers,rows,{printedTotal:'100,00'});
 assert.equal(got?.items?.length,1);
 assert.equal(got.items[0].quantity,5);
 assert.equal(got.items[0].invoiceGrossKg,5.5);
 assert.equal(got.items[0].price,20);
 assert.equal(got.items[0].unitPriceDerived,true);
 assert.equal(got.documentVerified,false);
});
test('VAT excluded printed unit price is not compared to VAT included total',()=>{
 const headers=['Наименование','Количество','Ед. изм.','Цена','Стоимость без НДС','Сумма НДС','Стоимость с НДС'];
 const rows=[['Синтетический продукт','2','шт','100,00','200,00','20,00','220,00']];
 const got=api.parseSupplierTable('vesta',headers,rows,{printedTotal:'220,00'});
 assert.equal(got?.items?.length,1);
 assert.equal(got.items[0].quantity,2);
 assert.equal(got.items[0].price,110);
 assert.equal(got.items[0].unitPriceDerived,true);
 assert.equal(got.documentVerified,false);
});
