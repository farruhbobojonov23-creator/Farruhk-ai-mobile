const test=require('node:test'),a=require('node:assert/strict'),{parse}=require('./invoice-parser.js');
test('explicit totals and matching simple rows',()=>{const r=parse('Накладная № УТ-3255 от 17.11.2026\nООО ВЕСТА\n1 Рис Лебеди кг 25 100,00 2 500,00\nВсего к оплате 2 500,00');a.equal(r.number,'УТ-3255');a.equal(r.date,'2026-11-17');a.equal(r.supplier,'ООО «Веста»');a.equal(r.total,2500);a.equal(r.items.length,1);a.equal(r.items[0].grossTotal,2500);a.equal(r.items[0].comparisonGroupId,'');});
test('valid VAT row accepted; mismatched simple row rejected',()=>{const r=parse('Рис кг 25 100,00 200,00\nСыр кг 2 100,00 200,00 20% 40,00 240,00\nВсего к оплате 500,00');a.equal(r.items.length,1);a.equal(r.items[0].grossTotal,240);a.ok(r.warnings.length);});
test('ambiguous supplier and total not guessed',()=>{const r=parse('Вирго Веста\nВсего к оплате 100,00\nВсего к оплате 200,00');a.equal(r.supplier,null);a.equal(r.total,null);});
test('packages require manual size',()=>{const r=parse('Майонез 78% уп 2 500,00 1 000,00');a.equal(r.items[0].unit,'уп');a.ok(r.warnings.some(x=>x.includes('фасовку')));});

test('text date from noisy screenshot and partial product names',()=>{const r=parse('1:09 H = MA HE\n17 нояб. в 15:21\nна - pedadle 9693 17 ноября 2026 г. в г\nЛЕБЕДИ СУШИ меш/25кг\n| СОУС рисовый МИРИН ФУ 20 1,000 ; 2 66\n| Сыр плавленый ломтевой. - 4,900 644,0');a.equal(r.number,'9693');a.equal(r.date,'2026-11-17');a.equal(r.items.length,0);a.equal(r.fragments.length,3);a.equal(r.fragments[0].grossTotal,undefined);});
test('ambiguous textual date not guessed',()=>{const r=parse('9693 17 ноября 2026 г.\n1234 18 ноября 2026 г.');a.equal(r.number,null);});

test('VAT with unit code and excise marker',()=>{const r=parse('1 Товар тестовый 796 шт 4,000 100,00 400,00 без акциза 20% 80,00 480,00');a.equal(r.items.length,1);a.equal(r.items[0].grossTotal,480);a.equal(r.items[0].quantity,4);});
test('VAT inconsistent row rejected',()=>{const r=parse('Товар тестовый шт 4,000 100,00 490,00 без акциза 20% 80,00 480,00');a.equal(r.items.length,0);});
test('uncertain amount is hint only',()=>{const r=parse('Сыр тестовый 4,900 w == 3 644,00');a.equal(r.fragments[0].amountHint,3644);a.equal(r.fragments[0].grossTotal,undefined);});
