import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code=readFileSync(new URL('../supply-android/app/src/main/assets/invoice-parser.js',import.meta.url),'utf8');
const context=vm.createContext({module:{exports:{}}});
vm.runInContext(code,context,{filename:'invoice-parser.js'});
const parser=context.module.exports;

// OCR-like fixture reconstructed from the supplied VIRGO 9632 invoice.
// Two 796/шт units become ET and two quantities are mistranscribed as 2, 12.
const OCR=[
'Счет-фактура № 9632 16 ноября 2026 г.',
'Продавец: "ВИРГО" (2)',
'Наименование товара (описание выполненных работ, оказанных услуг)',
'Код товара Код Единица измерения Количество Цена Стоимость Налоговая ставка Сумма налога Стоимость с налогом',
'Рис шлифованный Гост в/С, 990 меш. 2,000 2454,55 7 363,64 5е3 10% 736.36 8 100,00',
'ЛЕБЕДИ СУШИ меш/25кг акциза',
'2 Уксус рисовый ДУНКАН уп/20л 796 WT 1,000 1 337,70 1 337,70 5е3 22% 294.30 1632,00',
'акциза',
'Лапша "Удон"0,3 796 ET 10,000 77.27 772.73 5е3 10% 77,27 850,00',
'акциза',
'4 Сыр плавленый ломтевой 778 упак 12,000 828.18 1 656.36 5е3 10% 165,64 1822,00',
'Бистро Чеддер уп/1,107 кг(уп акциза',
'90 ШT) HOCHLAND',
'5 Креветка тигровая 16/20, с/м 796 ET 6,000 1 954.55 11 727,27 5е3 10% 1172,73 12900,00',
'во льду блок 1.8 кг',
'Мидии 1/2 рак 30/40, уп/1кг 778 упак 2,000 327.28 654.55 6е3 10% 65.45 720,00',
'акциза',
'Всего к оплате (9) 23 512,25 x 2511.75 26024,00'
].join('\n');
const priced=r=>r.items.filter(x=>x.price>0&&x.quantity>0&&x.unit).length;
test('VIRGO 9632: all six VAT-reconciled rows and OCR quantity repairs',()=>{
 const r=parser.parseSimple(OCR);
 assert.equal(r.supplier,'ООО «ВИРГО»');
 assert.equal(r.balancedInvoice,true);
 assert.equal(priced(r),6);
 assert.deepEqual(Array.from(r.items,x=>x.quantity),[3,1,10,2,6,2]);
 assert.equal(r.items.reduce((s,x)=>s+x.invoiceTotal,0),26024);
 assert.equal(r.quantityCorrections,2);
 assert.equal(r.unitOcrCorrected,true);
 assert.equal(r.documentVerified,false);
});
test('VIRGO 9632: OCR passes include reconciled candidate',()=>{
 const r=parser.parseSamePhotoPasses([OCR,OCR.replaceAll('796 ET','796 ЕТ')]);
 assert.ok(r.some(x=>x.balancedInvoice&&priced(x)===6));
});
test('normal correctly-read units remain accepted',()=>{
 const r=parser.parseSimple(OCR.replaceAll('796 ET','796 шт'));
 assert.equal(priced(r),6);
 assert.equal(r.balancedInvoice,true);
});
test('altered footer and VAT never auto-reconcile',()=>{
 for(const broken of [OCR.replace('26024,00','26025,00'),OCR.replace('294.30 1632,00','294.30 1633,00')]){
  assert.notEqual(parser.parseSimple(broken).balancedInvoice,true);
 }
});
test('unrelated unit code or supplier never triggers VIRGO repair',()=>{
 assert.notEqual(parser.parseSimple(OCR.replaceAll('796 ET','777 ET')).balancedInvoice,true);
 assert.notEqual(parser.parseSimple(OCR.replace('Продавец: "ВИРГО"','Продавец: "OTHER"')).balancedInvoice,true);
});
