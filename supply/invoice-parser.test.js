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

test('quantity is a review hint only on incomplete numeric row',()=>{const r=parse('Соус тестовый 1.000 100.00 22.00 122.00');a.equal(r.items.length,0);a.equal(r.fragments[0].quantityHint,1);a.equal(r.fragments[0].quantity,undefined);a.equal(r.fragments[0].grossTotal,undefined);});
test('a separate package continuation is merged as a review suggestion only',()=>{const r=parse('Рис тестовый 5:000 100.00 500.00\nЛЕБЕДИ СУШИ меш/25кг');a.equal(r.fragments.length,1);a.equal(r.fragments[0].joinedHint,true);a.equal(r.fragments[0].quantityHint,5);a.equal(r.fragments[0].unit,undefined);});

const parserCode=require('node:fs').readFileSync(require('node:path').join(__dirname,'../supply-android/app/src/main/assets/invoice-parser.js'),'utf8');
const browserParser=new Function('module', 'globalThis',parserCode+'\nreturn globalThis.supplyInvoiceParser;')(undefined,{});
const {parseSimple}=browserParser;
test('simple two-column invoice fills supplier, names and prices',()=>{const r=parseSimple('Поставщик: ООО «Тест»\nТовар Цена\n1 Рис 135,00\n2 Нори 850,00\nИтого 985,00');a.equal(r.supplier,'ООО «Тест»');a.deepEqual(r.items.map(x=>[x.name,x.price]),[['Рис',135],['Нори',850]]);});
test('product percentage is not VAT',()=>{const r=parseSimple('Майонез 67% кг 2 135,00 270,00');a.equal(r.items[0].price,135);a.ok(!r.items[0].name.includes('без НДС'));});
test('VAT price is marked separately',()=>{const r=parseSimple('Рис кг 2 135,00 270,00 20% 54,00 324,00');a.equal(r.items[0].price,135);a.ok(r.items[0].name.includes('без НДС'));});
test('unreliable row must not populate price',()=>{const r=parseSimple('Сыр тестовый 4,900 w == 3 644,00');a.ok(r.items.every(x=>x.price===null));});

test('split row and unit code: exact price without incomplete duplicate',()=>{const r=parseSimple('Восток-Запад\nРис для суши 166 кг\n2,000 135,00 270,00');a.equal(r.supplier,'Восток-Запад');a.equal(r.items.length,1);a.equal(r.items[0].price,135);});
test('split row with mismatched total is not priced',()=>{const r=parseSimple('Восток-Запад\nРис для суши кг\n2,000 135,00 300,00');a.ok(r.items.every(x=>x.price===null));});

test('arbitrary products, packaging and no VAT',()=>{const r=parseSimple('Поставщик: Восток-Запад\nНаименование товара Количество Цена Сумма\n1 Масло подсолнечное упак. 2 150,00 300,00\n2 Салфетки бумажные шт 3 100,00 300,00 без НДС');a.deepEqual(r.items.map(x=>x.price),[150,100]);});
test('unknown raw ingredient remains visible but wrong price is not guessed',()=>{const r=parseSimple('Поставщик: Восток-Запад\nНаименование товара Количество Цена Сумма\n1 Мука пшеничная кг 5 50,00 999,00');a.equal(r.items.length,1);a.equal(r.items[0].price,null);});
