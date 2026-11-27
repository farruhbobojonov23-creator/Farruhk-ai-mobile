import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const script=readFileSync(new URL('../supply-android/app/src/main/assets/invoice-parser.js',import.meta.url),'utf8');
const ctx=vm.createContext({module:{exports:{}}});
vm.runInContext(script,ctx,{filename:'invoice-parser.js'});
const parser=ctx.module.exports;

// This is the actual second Android OCR pass supplied by the user, not the
// previously hand-normalized test case. The first/third passes are much worse.
const SECOND_PASS=[
 'Приложение № 1 к постановлению Правительства Российской Федерации от 28 декабря 2011 г. № 1137',
 'Универсальный Счет-фактура № 9632 16 ноября 2026 г.(1)',
 'Продавец: "ВИРГО" (2) Покупатель: ИП Мамедова Элнура Барисовна (6)',
 'Единица происхождения Страна Регистрационный',
 'Код товара/ Код вида Коли- Цена (тариф) товаров (работ, числе Налоговая предьяв- товаров (работ, товары или',
 'A 1a 16 2 2a 3 5 6 7 8 9 10 10a 11',
 'Рис шлифованный Гост в/с, 990 меш. 2454,55 7 363,64 5e3 10% 736,36 8 100,00',
 '3,000 акциза',
 'ЛЕБЕДИ СУШИ мЕш/25кг',
 'Уксус рисовый ДУНКАН уп/20л 796 WT 1,000 1337.70 1337,70 5е3 22% 294.30 1632,00',
 'акциза',
 'Лапша "Удон"0,3 796 ET 10,000 77.27 772,73 5е3 10% 77.27 850.00',
 'акциза',
 'Сыр плавленый ломтевой 778 ynак 12,000 828,18 1656,36 503 10% 165.64 1822,00',
 'акциза',
 'Бистро Чеддер уп/1,107 кг(уп',
 '90 ШT) HOCHLAND',
 '796 WT 1954,55 11 727,27 5е3 10% 1172,73 12 900,00',
 'Креветка тигровая 16/20, с/м 6,000 акциза',
 'во льду блок 1.8 кг',
 'Мидии 1/2 рак 30/40, уп/1кг 778 yПак 2,000 327.28 654.55 5е3 10% 65,45 720,00',
 'акциза',
 'Всегo к оплате (9) 23 512,25 x 2511,75 26024,00'
].join('\n');

test('actual OCR: six real products, quantities, printed VAT-inclusive totals',()=>{
 const result=parser.parseSimple(SECOND_PASS);
 assert.equal(result.fragmentedOcrRecovered,true);
 assert.equal(result.supplier,'ООО «ВИРГО»');
 assert.equal(result.balancedInvoice,true);
 assert.equal(result.items.length,6);
 assert.deepEqual(Array.from(result.items,x=>x.quantity),[3,1,10,2,6,2]);
 assert.deepEqual(Array.from(result.items,x=>x.invoiceTotal),[8100,1632,850,1822,12900,720]);
 assert.equal(result.items.reduce((s,x)=>s+x.invoiceTotal,0),26024);
 assert.equal(result.items.every(x=>x.price>0&&x.unit&&x.name&&!/акциза|\d+,000/.test(x.name)),true);
 assert.match(result.items[0].name,/ЛЕБЕДИ СУШИ/);
 assert.match(result.items[3].name,/HOCHLAND/);
 assert.match(result.items[4].name,/Креветка тигровая/);
 assert.equal(result.quantityCorrections,1);
 assert.equal(result.items[3].quantityCorrected,true);
 assert.equal(result.documentVerified,false);
 assert.match(result.warnings.join(' '),/свер/i);
});

test('same photo candidate list retains recovered real second pass',()=>{
 const candidates=parser.parseSamePhotoPasses([
  'Счет-фактура № 9832 Продавец: ВИРГО СИЛЬНО ПОВРЕЖДЕННЫЙ ТЕКСТ',
  SECOND_PASS,
  'БЕ © BS БВ ШУМ ПОВОРОТА'
 ]);
 assert.equal(candidates.some(r=>r.fragmentedOcrRecovered&&r.items.length===6&&r.balancedInvoice),true);
});

test('altered gross, VAT, code, or supplier never auto-reconcile',()=>{
 const broken=[
  SECOND_PASS.replace('26024,00','26025,00'),
  SECOND_PASS.replace('294.30 1632,00','294.30 1633,00'),
  SECOND_PASS.replace('796 ET','777 ET'),
  SECOND_PASS.replace('Продавец: "ВИРГО"','Продавец: "НЕВЕРНО"'),
  SECOND_PASS.replace('11 727,27','11 727,37')
 ];
 for(const x of broken)assert.notEqual(parser.parseSimple(x).fragmentedOcrRecovered,true);
});
