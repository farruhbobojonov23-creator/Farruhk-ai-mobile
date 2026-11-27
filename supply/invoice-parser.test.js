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

test('actual Tesseract output from rendered Russian invoice, unit and border artifacts',()=>{const r=parseSimple('Учебный УПД № 100 от 26.11.2026\nПоставщик: Восток-Запад\nПокупатель: Учебная организация\n№ |Наименование товара Ед. Кол-во | Цена Сумма НДС Налог Всего\n1 |Мука пшеничная высший сорт Kr 5,000 |50,00 250,00 20% 50,00 300,00\n2 |Масло подсолнечное 1 л шт 3,000 1150,00 450,00 20% 90,00 540,00\n3 |Сыр творожный сливочный Kr 4,000 |600,00 2400,00 20% 480,00 2880,00\nВсего к оплате 3720,00\nПодпись');a.equal(r.supplier,'Восток-Запад');a.deepEqual(r.items.map(x=>x.price),[50,150,600]);a.ok(r.items.every(x=>x.uncertain));});
test('do not correct price when VAT arithmetic is inconsistent',()=>{const r=parseSimple('Поставщик: Восток-Запад\nНаименование товара Количество Цена Сумма НДС\nМасло шт 3,000 1150,00 450,00 20% 80,00 540,00');a.ok(r.items.every(x=>x.price===null));});

test('package weight, count, total kg and price per kg extracted',()=>{const r=parseSimple('Поставщик: Восток-Запад\nНаименование товара Количество Цена Сумма\n1 Сыр творожный (фасовка 10кг) шт 3 4 500,00 13 500,00');const x=r.items[0];a.equal(x.quantity,3);a.equal(x.packKg,10);a.equal(x.totalKg,30);a.equal(x.pricePerKg,450);a.equal(x.totalPrice,13500);});
test('mass quantity is not multiplied by package size; unknown packaging stays unknown',()=>{a.equal(browserParser.lineMetrics({quantity:30,unit:'кг',packKg:10,price:450}).totalKg,30);a.equal(browserParser.lineMetrics({quantity:3,unit:'шт',price:4500}).totalKg,null);a.equal(browserParser.packWeight('Сыр 10х1 кг / кор'),null);});

test('quantity before unit and varied food packaging',()=>{const cases=[["Сыр творожный (фасовка 10кг) шт 3 4 500,00 13 500,00",3,30,450],["Сыр творожный 10 кг 3шт 4500,00 13500,00",3,30,450],["Сыр творожный 10 кг 3 шт 4500,00 13500,00",3,30,450],["Рис 25 кг мешок шт 2 2500,00 5000,00",2,50,100],["Майонез 900 г шт 3 180,00 540,00",3,2.7,200],["Креветка 16/20 1 кг уп 5 1000,00 5000,00",5,5,1000],["Форель Trim C кг 12,500 1100,00 13750,00",12.5,12.5,1100],["Сыр творожный 10 кг кг 30 450,00 13500,00",30,30,450],["Нори Gold 100 листов уп 4 850,00 3400,00",4,null,null],["Соус соевый 20 л канистра шт 2 1800,00 3600,00",2,null,null],["Лосось кг 2 1000,00 9999,00",null,null,null]];for(const [s,q,kg,pp] of cases){const r=parseSimple("Поставщик: Восток-Запад\nНаименование товара Количество Цена Сумма\n"+s);a.equal(r.supplier,'Восток-Запад',s);a.equal(r.items.length,1,s);const x=r.items[0];a.equal(x.quantity??null,q,s);a.equal(x.totalKg??null,kg,s);a.equal(x.pricePerKg??null,pp,s);if(q===null)a.equal(x.price,null,s);}});

test('TTN with gross total and shipping quantity: transcribed from two photographed layouts',()=>{for(const [s,p,kg,pp] of [["ТОВАРНО-ТРАНСПОРТНАЯ НАКЛАДНАЯ\nПоставщик: Восток-Запад\nНаименование товара Код Единица измерения Код по ОКЕИ Ставка НДС Сумма с НДС руб. Количество мест Масса брутто\n1 Майонез EFKO FOOD special для запекания с массовой долей жирности 67% 9,4кг/10л 500002158 ШТ 796 22.00 7,627.44 4 39.2\nВсего к оплате 7,627.44",1906.86,37.6,202.86],["ТОВАРНО-ТРАНСПОРТНАЯ НАКЛАДНАЯ\nПоставщик: Восток-Запад\nНаименование товара Код Единица измерения Код по ОКЕИ Ставка НДС Сумма с НДС руб. Количество мест Масса брутто\n1 Форель радужная филе с кожей малосоленая, Trim C 1,8кг+ мороженая, соленая пищевая рыбная продукция 500004565 КГ 166 10.00 284,659.97 149.81 164.81\nВсего к оплате 284,659.97",1900.14,149.81,1900.14],["ТОВАРНО-ТРАНСПОРТНАЯ НАКЛАДНАЯ\nПоставщик: Восток-Запад\nНаименование товара Код Единица измерения Код по ОКЕИ Ставка НДС Сумма с НДС руб. Количество мест Масса брутто\n1 Майонез EFKO FOOD special для\nзапекания с массовой долей жирности 67% 500002158 ШТ 796 22.00 7,627.44 4 39.2\n9,4кт/10л\nВсего к оплате 7,627.44",1906.86,37.6,202.86]]){const r=parseSimple(s);a.equal(r.supplier,'Восток-Запад');a.equal(r.items.length,1);a.equal(r.items[0].price,p);a.equal(r.items[0].totalKg,kg);a.equal(r.items[0].pricePerKg,pp);}});

test('real photo OCR lines after perspective correction: code recovers damaged unit, wrapped item name and pack',()=>{const samples=["Поставщик: Восток-Запад\nНаименование товара Код по ОКЕИ Суммас НДС, руб. Масса брутто\nМайонез \"EFKO FOOD special\" для < В-11\n1 запекания с массовой долей жирности 67% 500002158 LIT 796 | 22.00 7,627.44 4 39.2\n| 9.4кг/1Ол | | |\nИтого: 7,627.44 4 39.200","Поставщик: Восток-Запад\nНаименование товара Код по ОКЕИ Суммас НДС, руб. Масса брутто\nФорель радужная филе с кожей\n1 малосоленая, Trim С 1,8кг+ мороженая, — 500004565 КГ 166 10.00° 284,659.97 149.81 164.81 B-5\nGH соленая пищевая рыбная продукция Bets\nИтого: 294 659.97 150 164.310"];const mayo=parseSimple(samples[0]).items[0],fish=parseSimple(samples[1]).items[0];a.equal(mayo.price,1906.86);a.equal(mayo.totalKg,37.6);a.equal(mayo.unit,'шт');a.equal(fish.price,1900.14);a.equal(fish.quantity,149.81);});

test('split TTN row missing OKEI and headings: verify independent VAT before filling fields',()=>{const s="Поставщик: Восток-Запад\nФорель тестовая филе с кожей\nмороженая, Trim C 1,8кг+ 123456789 КГ\n10.00 85,680.00 47.60 51.20\nсоленая пищевая рыбная продукция\nВ том числе НДС 7,789.09";const r=parseSimple(s);a.equal(r.items.length,1);a.equal(r.items[0].quantity,47.6);a.equal(r.items[0].price,1800);a.equal(r.items[0].unit,'кг');for(const bad of [s.replace('7,789.09','1,000.00'),s.replace('В том числе НДС 7,789.09',''),s.replace('Поставщик: Восток-Запад','Поставщик: Другой')])a.ok(parseSimple(bad).items.every(x=>x.price==null));});

test('same-photo OCR passes share independently verified footer, never guess if conflicting',()=>{const h="Поставщик: Восток-Запад",f="В том числе НДС 1,006.23",row="Майонез учебный 9,4кг/10л 123456789 ШТ\n22.00 5,580.00 3 29.4";const rs=browserParser.parseSamePhotoPasses([h+'\n'+f,row]);a.ok(rs.some(r=>r.items.some(x=>x.price===1860&&x.quantity===3&&x.totalKg===28.2)));a.ok(browserParser.parseSamePhotoPasses([h+'\nВ том числе НДС 999.99',row]).every(r=>r.items.every(x=>x.price==null)));a.ok(browserParser.parseSamePhotoPasses([h+'\n'+f,row,'В том числе НДС 999.99']).every(r=>r.items.every(x=>x.price==null)));a.equal(parseSimple(h+'\n'+row.replace('\n',' ')+'\n'+f).items[0].price,1860);});

test('recover missing package only from same article in another scan of the photo',()=>{const h="Поставщик: Восток-Запад",f="В том числе НДС 1,006.23",row="Майонез учебный для 123456789 ШТ\n22.00 5,580.00 3 29.4",extra="Майонез учебный для 123456789 ШТ\nзапекания с массовой долей жирности 67%\n9,4кг/10л";const r=browserParser.parseSamePhotoPasses([h+'\n'+f,row,extra]);a.ok(r.some(z=>z.items.some(x=>x.packKg===9.4&&x.totalKg===28.2&&x.pricePerKg===197.87)));a.ok(browserParser.parseSamePhotoPasses([h+'\n'+f,row,extra,extra.replace('9,4кг','8кг')]).every(z=>z.items.every(x=>!x.packKg)));});

test('wrapped TTN packaging shares line with shipping count and gross mass',()=>{const s="Поставщик: Восток-Запад\nМайонез учебный для 123456789 ШТ\n22.00 5,580.00 3 29.4\n1V запекания с массовой долей жирности 67%\n9,4кг/10л 3 29.400 x x\nИтого: 5,580.00\nВсего к оплате 5,580.00";const x=parseSimple(s).items[0];a.equal(x.packKg,9.4);a.equal(x.quantity,3);a.equal(x.totalKg,28.2);a.equal(x.price,1860);a.equal(x.pricePerKg,197.87);a.equal(x.invoiceTotal,5580);for(const bad of [s.replace('3 29.400 x x','4 29.400 x x'),s.replace('3 29.400 x x','3 20.400 x x'),s.replace('9,4кг/10л 3 29.400 x x','9,4кг/10л 3 29.400 x x\n8кг/10л 3 29.400 x x')])a.ok(parseSimple(bad).items.every(x=>!x.packKg));});

test('single item TTN matches detached packaging to printed shipment totals across scans',()=>{const row="Поставщик: Восток-Запад\nМайонез учебный для 123456789 ШТ\n22.00 5,580.00 3 29.4\nВсего к оплате 5,580.00",tail="39.2\n1V запекания с массовой долей жирности 67%\n9,4кг/10л 3 29.400 x x\nИтого: 5,580.00\nВсего по накладной 5,580.00 3 29.400 x x\nВсего к оплате 5,580.00";const good=browserParser.parseSamePhotoPasses([row,tail]).find(r=>r.items.some(x=>x.packKg===9.4)).items[0];a.deepEqual([good.quantity,good.price,good.packKg,good.totalKg,good.pricePerKg,good.invoiceTotal],[3,1860,9.4,28.2,197.87,5580]);for(const bad of ["39.2\n1V запекания с массовой долей жирности 67%\n9,4кг/10л 4 29.400 x x\nИтого: 5,580.00\nВсего по накладной 5,580.00 3 29.400 x x\nВсего к оплате 5,580.00","39.2\n1V запекания с массовой долей жирности 67%\n9,4кг/10л 3 29.400 x x\nИтого: 5,580.00\nВсего по накладной 5,590.00 3 29.400 x x\nВсего к оплате 5,580.00","39.2\n1V запекания с массовой долей жирности 67%\n9,4кг/10л 3 29.400 x x\nИтого: 5,580.00\nВсего по накладной 5,580.00 3 30.400 x x\nВсего к оплате 5,580.00","39.2\n1V запекания с массовой долей жирности 67%\n9,4кг/10л 3 29.400 x x\nСыр другой 1 кг\nВсего по накладной 5,580.00 3 29.400 x x\nВсего к оплате 5,580.00","39.2\n1V запекания с массовой долей жирности 67%\n9,4кг/10л 3 29.400 x x\nИтого: 5,580.00\nВсего к оплате 5,580.00"])a.ok(browserParser.parseSamePhotoPasses([row,bad]).every(r=>r.items.every(x=>!x.packKg)));a.ok(browserParser.parseSamePhotoPasses([row,tail,tail.replace('9,4кг','8кг')]).every(r=>r.items.every(x=>!x.packKg)));});

test('UPD with displaced financial columns, wrapped names, four items and independent document totals',()=>{const s="Поставщик: ООО «Вирго»\nНаименование товара Стоимость Налоговая ставка Цена\n16 2a 736.36\nРис учебный, 990 меш 3,000 2 454.55 7363.64 10% 8 100,00\nТЕСТ меш/25кГ\n590.98 590.98 22% 130.02 721,00\nСироп учебный 96 1,000\nкарамель 1л\nКреветка учебная 16/20, с/м 1954.55 11 727.27 1172,73 12 900,00\n1 6,000\nво льду блок 1.8 кг\nКрабовые палочки учебные 78 yna 12,000 227.27 2727.27 10% 272.73 3000,00\n6\n500г ТЕСТ\n2311.84 24721,00\nВсего к оплате (9) 22 409,16 x";const r=parseSimple(s);a.deepEqual(r.items.map(x=>[x.quantity,x.price,x.packKg,x.totalKg,x.pricePerKg,x.invoiceTotal]),[[3,2454.55,25,75,98.18,8100],[1,590.98,null,null,null,721],[6,1954.55,1.8,10.8,1085.86,12900],[12,227.27,0.5,6,454.54,3000]]);a.ok(r.items.every(x=>x.uncertain));for(const bad of [s.replace("24721,00","24722,00"),s.replace("1 6,000","1 7,000"),s.replace("130.02","140.02")])a.ok(parseSimple(bad).items.filter(x=>x.price!=null).length<4);});

test('UPD split row, seller name, damaged VAT OCR and totals on next line',()=>{const s="Счет-фактура № 123\nИндивидуальный предприниматель Тестова\nПродавец: Анна Ивановна\nкод налога - всего\nСыр учебный 778 ynak 600,00 1200.00 8 10 10a\nЧеддер уп/1,2 кг(уп 2,000 10% 120,20 1320,00\n90 ШT ТЕСТ\nyn/10kr Творожный сыр учебный 2,000 200.00 400.00 E10% 40,00 440,00\nВсего к оплате (9)\nДокумент Руководитель организации 1600,00 160.00 1760,00";const r=parseSimple(s);a.equal(r.supplier,'ИП Тестова Анна Ивановна');a.deepEqual(r.items.map(x=>[x.quantity,x.price,x.packKg,x.totalKg,x.pricePerKg,x.invoiceTotal]),[[2,600,1.2,2.4,500,1320],[2,200,10,20,20,440]]);for(const bad of ["Счет-фактура № 123\nИндивидуальный предприниматель Тестова\nПродавец: Анна Ивановна\nкод налога - всего\nСыр учебный 778 ynak 600,00 1200.00 8 10 10a\nЧеддер уп/1,2 кг(уп 2,000 10% 120,20 1320,00\n90 ШT ТЕСТ\nyn/10kr Творожный сыр учебный 2,000 200.00 400.00 E10% 40,00 440,00\nВсего к оплате (9)\nДокумент Руководитель организации 1600,00 160.00 1761,00","Счет-фактура № 123\nИндивидуальный предприниматель Тестова\nПродавец: Анна Ивановна\nкод налога - всего\nСыр учебный 778 ynak 600,00 1200.00 8 10 10a\nЧеддер уп/1,2 кг(уп 3,000 10% 120,20 1320,00\n90 ШT ТЕСТ\nyn/10kr Творожный сыр учебный 2,000 200.00 400.00 E10% 40,00 440,00\nВсего к оплате (9)\nДокумент Руководитель организации 1600,00 160.00 1760,00","Счет-фактура № 123\nИндивидуальный предприниматель Тестова\nПродавец: Анна Ивановна\nкод налога - всего\nСыр учебный 778 ynak 600,00 1200.00 8 10 10a\nЧеддер уп/1,2 кг(уп 2,000 10% 125,20 1320,00\n90 ШT ТЕСТ\nyn/10kr Творожный сыр учебный 2,000 200.00 400.00 E10% 40,00 440,00\nВсего к оплате (9)\nДокумент Руководитель организации 1600,00 160.00 1760,00"])a.ok(parseSimple(bad).items.filter(x=>x.price!=null).length<2);});

test('UPD numeric row before product name and footer before its label',()=>{const s="Универсальный Счет-фактура № 123\n\"BECTA\" (2) Покупатель: Тест\nПродавец: адрес\nНаименование товара(описание выполненных Код вида Коли- Цена (тариф) товаров Налоговая\n796 UT 500,00 1000.00 5е3 22% 220.00 1 220,00\nСоус учебный для 2,000 акциза\nкурицы Тест уп/1,8л/2,1 кг\n796 1000.00 1000.00 6е3 22% 220.00 1220,00\n²Морс учебный E 1,000 акциза\nуп/5кг черносмородиновый\nМорс учебный 796 WT 2000.00 2000.00 5ез 22% 440.00 2440,00\n1,000 акциза\nуп/5кг клюквенный\n4000.00 x 880.00 4 880,00\nВсего к оплате (9)";const r=parseSimple(s);a.equal(r.documentVerified,true);a.equal(r.supplier,'ООО «Веста»');a.deepEqual(r.items.map(x=>[x.quantity,x.price,x.packKg,x.totalKg,x.pricePerKg,x.invoiceTotal]),[[2,500,2.1,4.2,238.1,1220],[1,1000,5,5,200,1220],[1,2000,5,5,400,2440]]);for(const bad of ["Универсальный Счет-фактура № 123\n\"BECTA\" (2) Покупатель: Тест\nПродавец: адрес\nНаименование товара(описание выполненных Код вида Коли- Цена (тариф) товаров Налоговая\n796 UT 500,00 1000.00 5е3 22% 220.00 1 220,00\nСоус учебный для 2,000 акциза\nкурицы Тест уп/1,8л/2,1 кг\n796 1000.00 1000.00 6е3 22% 220.00 1220,00\n²Морс учебный E 1,000 акциза\nуп/5кг черносмородиновый\nМорс учебный 796 WT 2000.00 2000.00 5ез 22% 440.00 2440,00\n1,000 акциза\nуп/5кг клюквенный\n4000.00 x 880.00 4 881,00\nВсего к оплате (9)","Универсальный Счет-фактура № 123\n\"BECTA\" (2) Покупатель: Тест\nПродавец: адрес\nНаименование товара(описание выполненных Код вида Коли- Цена (тариф) товаров Налоговая\n796 UT 500,00 1000.00 5е3 22% 220.00 1 220,00\nСоус учебный для 3,000 акциза\nкурицы Тест уп/1,8л/2,1 кг\n796 1000.00 1000.00 6е3 22% 220.00 1220,00\n²Морс учебный E 1,000 акциза\nуп/5кг черносмородиновый\nМорс учебный 796 WT 2000.00 2000.00 5ез 22% 440.00 2440,00\n1,000 акциза\nуп/5кг клюквенный\n4000.00 x 880.00 4 880,00\nВсего к оплате (9)","Универсальный Счет-фактура № 123\n\"BECTA\" (2) Покупатель: Тест\nПродавец: адрес\nНаименование товара(описание выполненных Код вида Коли- Цена (тариф) товаров Налоговая\n796 UT 500,00 1000.00 5е3 22% 220.00 1 220,00\nСоус учебный для 2,000 акциза\nкурицы Тест уп/1,8л/2,1 кг\n796 1000.00 1000.00 6е3 22% 220.00 1220,00\n²Морс учебный E 1,000 акциза\nуп/5кг черносмородиновый\nМорс учебный 796 WT 2000.00 2000.00 5ез 22% 441.00 2440,00\n1,000 акциза\nуп/5кг клюквенный\n4000.00 x 880.00 4 880,00\nВсего к оплате (9)"])a.ok(!parseSimple(bad).documentVerified);});

test('generic invoice header defines column order without a supplier preset',()=>{for(const s of ["Поставщик: ООО «Новый поставщик»\nНаименование товара | Цена | Сумма | Ед. изм. | Количество\nМука 2 кг | 100,00 | 300,00 | уп | 3\nВодоросли 100 г | 40,00 | 80,00 | шт | 2\nИтого: 380,00","Поставщик: ООО «Новый поставщик»\n№;Количество;Единица измерения;Цена за упаковку;Наименование товара;Стоимость\n1;3;упак.;100,00;Мука 2 кг;300,00\n2;2;шт;40,00;Водоросли 100 г;80,00\nВсего к оплате 380,00","Поставщик: ООО «Новый поставщик»\nНаименование товара Цена Количество Ед. изм. Сумма\nМука 2 кг 100,00 3 уп 300,00\nВодоросли 100 г 40,00 2 шт 80,00\nИтого 380,00"]){const r=parseSimple(s);a.equal(r.documentVerified,true);a.deepEqual(r.items.map(x=>[x.quantity,x.price,x.packKg,x.totalKg,x.pricePerKg,x.invoiceTotal]),[[3,100,2,6,50,300],[2,40,0.1,0.2,400,80]]);a.ok(!parseSimple(s.replace('380,00','381,00')).documentVerified);}});
test('generic 100 item invoice reconciles every row and full total',()=>{const s="Поставщик: ООО «Новый поставщик»\nНаименование товара | Цена | Сумма | Ед. изм. | Количество\n"+Array.from({length:100},(_,i)=>'Продукт номер '+(i+1)+' 1 кг | 100,00 | 200,00 | шт | 2').join('\n')+'\nИтого 20000,00';const r=parseSimple(s);a.equal(r.documentVerified,true);a.equal(r.items.length,100);a.ok(!parseSimple(s.replace('20000,00','20001,00')).documentVerified);});

test('volume is not mass; preserve printed invoice total and reject ambiguous packs',()=>{a.equal(browserParser.packVolume('Сироп 1л / шт (без НДС)'),1);a.equal(browserParser.packVolume('Соус 750 мл'),.75);a.equal(browserParser.packVolume('Сок 6x1 л'),null);a.equal(browserParser.packVolume('Сироп 1л 2л'),null);const x=browserParser.lineMetrics({unit:'шт',quantity:2,packL:1,price:590.98,invoiceTotal:1442});a.deepEqual([x.totalKg,x.totalL,x.pricePerL,x.totalPrice],[null,2,590.98,1442]);a.equal(browserParser.lineMetrics({unit:'шт',quantity:2,packKg:2.1,packL:1.8,price:517.95}).totalL,null);});

test('shipment act uses shipped units rather than cartons and retains page count',()=>{const s="АКТ ПРИЕМА-ПЕРЕДАЧИ по УПД № 100\nПродавец ООО \"Учебный поставщик\"\nНаименование товара Единица измерения В одном месте Полных упаковок В неполной упаковке НДС Цена Сумма Отгружено количество\n1 1234567890123 Креветки учебные 1 кг ШТ 10 0 2 10 1100.00 2200.00 2 06.05.2028\n2 1234567890124 Васаби порционный 5 гр. [168] ШТ 168 4 0 22 5.94 3991.68 672 08.02.2027\n3 1234567890125 Соус учебный 1,8 л ШТ 6 0 4 22 593.54 2374.16 4 17.03.2028\nстр. 1 из 2";const r=parseSimple(s);a.equal(r.pageVerified,true);a.deepEqual(r.pageInfo,{page:1,pages:2});a.deepEqual(r.items.map(x=>[x.quantity,x.price,x.invoiceTotal]),[[2,1100,2200],[672,5.94,3991.68],[4,593.54,2374.16]]);a.equal(r.items[1].packKg,.005);a.equal(r.items[2].packL,1.8);a.ok(!parseSimple(s.replace('3991.68','3992.68')).pageVerified);a.ok(!parseSimple(s.replace('168 4 0','168 3 0')).pageVerified);});

test('shipment act recovers OCR glued row numbers and wrapped product names without inventing prices',()=>{const s="АКТ ПРИЕМА-ПЕРЕДАЧИ по УПД № 100\nПродавец ООО \"Учебный поставщик\"\nКоличество\nСтои- Опру- При-\nНалorо- Общая Сроки НЯТО\n№ Код Наименование товара(описание выполненных вая с HДС СТОИМОСТЬ КОЛИ- гОДНОСТИ покупа-\nставка за ЕИ, с НДС, чество\n3 4 5 6 7 8 9 10 11 12 13 14 15\n1. 2\n1234567890123 КРЕВЕТКИ учебные сырые в панировке ШТ 10 0 2 10 1100.00 2200.00 2 06.05.2028\n]\nторпедо с/м 1 кг. VICI [1]\n2 01234567890124 ВАСАБИ порционный 5 гр. [168] ШТ 168 4 0 22 5.94 3991.68 672 08.02.2027\n31234567890125 ИМБИРЬ порционный белый 25 гр. [168] ШТ 168 4 0 22 10.43 7008.96 672 07.04.2027\n41234567890126 СОУС соевый порционный Black 30 гр. [168] ШТ 168 4 0 22 8.45 5678.40 672 12.04.2027\n5 1234567890127COУС Унаги 1,8 л. Tamaki [1] ШТ 6 0 4 22 593.54 2374.16 4 17.03.2028\ncmp. 1 u3 2";const r=parseSimple(s);a.equal(r.pageVerified,true);a.deepEqual(r.pageInfo,{page:1,pages:2});a.deepEqual(r.items.map(x=>[x.quantity,x.price,x.invoiceTotal,x.packKg,x.packL]),[[2,1100,2200,1,null],[672,5.94,3991.68,.005,null],[672,10.43,7008.96,.025,null],[672,8.45,5678.4,.03,null],[4,593.54,2374.16,null,1.8]]);a.equal(r.items[2].article,'1234567890125');a.ok(!parseSimple(s.replace('7008.96','7009.96')).pageVerified);});

test('automatic purchase display distinguishes portions, pieces, mass and liquids',()=>{
 const p=browserParser.purchaseMetrics;
 const g=p({name:'Имбирь порционный 25 гр. [168]',unit:'шт',quantity:672,price:10.43,packKg:.025,invoiceTotal:7008.96});
 a.deepEqual([g.basis,g.piecesPerPack,g.totalPieces,g.pricePerPiece,g.totalPrice],['шт',168,672,10.43,7008.96]);
 const v=p({name:'Васаби порционный 5 г [168]',unit:'шт',quantity:672,price:5.94,packKg:.005});
 a.deepEqual([v.basis,v.totalPieces,v.pricePerPiece],['шт',672,5.94]);
 const c=p({name:'Контейнеры 200 шт',unit:'кор',quantity:3,price:1000});
 a.deepEqual([c.basis,c.totalPieces,c.pricePerPiece,c.totalPrice],['шт',600,5,3000]);
 a.equal(p({name:'Контейнеры',unit:'кор',quantity:3,price:1000}).totalPieces,null);
 const k=p({name:'Креветки 1 кг',unit:'шт',quantity:2,price:1100,packKg:1});
 a.deepEqual([k.basis,k.totalKg,k.pricePerKg],['кг',2,1100]);
 const l=p({name:'Соус Унаги 1,8 л',unit:'шт',quantity:4,price:593.54,packL:1.8});
 a.deepEqual([l.basis,l.totalL,l.pricePerL],['л',7.2,329.74]);
 const s=p({name:'Соус соевый порционный 30 г [168]',unit:'шт',quantity:672,price:8.45,packKg:.03,invoiceTotal:5678.4});
 a.deepEqual([s.basis,s.totalPieces,s.pricePerPiece,s.totalPrice],['шт',672,8.45,5678.4]);
});

test('UPD with damaged intermediate VAT cells reconciles all readable original prices and totals',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'../supply-android/app/src/main/assets/invoice-parser.js'),'utf8');const mod={exports:{}};new Function('module',src)(mod);const p=mod.exports;const sample="Счет-фактура № 123 от 02 ноября 2026 г.\nИндивидуальный предприниматель Иванова\nАнна Ивановна (2) Покупатель: ИП Тест\nСтоимость Стоимость товара\nКОД ние\nA 16 2 28 8 10 10a\nСыр плавленый ломтевой 778 ynak 2,000 828,18 16636 BKD 10% 185,84 1822,00\nБистро Чеддер уп/1,107 кг(уп\n90 ШT ТЕСТ\nТворожный сыр Тест 796 2,000 4 237.28 8 474.55 8 10% 847,45 9 322,00\nyn/10kr\nВсего к оплате (9) 10 130,91 x 1 013.09 11 144,00";const r=p.parseSimple(sample);a.equal(r.documentVerified,true);a.deepEqual(r.items.map(x=>[x.quantity,x.price,x.packKg,x.invoiceTotal]),[[2,828.18,1.107,1822],[2,4237.28,10,9322]]);a.ok(!p.parseSimple(sample.replace('11 144,00','11 145,00')).documentVerified);a.ok(!p.parseSimple(sample.replace('828,18','829,18')).documentVerified);a.ok(p.parseSamePhotoPasses([sample]).some(x=>x.documentVerified&&x.items.length===2));});

test('same photo reverse column OCR is reconciled against gross and VAT totals',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'../supply-android/app/src/main/assets/invoice-parser.js'),'utf8');const mod={exports:{}};new Function('module',src)(mod);const p=mod.exports;const f="Счет-фактура № 123\nООО Вирго\nНаименование товара\n3.000 2454.55 7363,64\nРис учебный ГОСТ В/С,\nЛЕБЕДИ СУШИ меш/25кг\nСироп учебный со вкусом\nсоленой карамели 1n\nКреветка учебная 16/20, с/м\nво льду блок 1.8 кг\nКрабовые палочки учебные\nJes краб 500г ТЕСТ\ncero к оплате (9) 24 721 | 24 721,00]",b="Всего к оплате (9) Продавец: Счет-фактура №\nКрабовые палочки учебные Креветка учебная Сироп учебный 1л Рис учебный\nООО Вирго\n12,000 6,000 1,000 3,000 6 (18)\n227.27 1 954.55 590.98 2454.55 нохерения\n22 409.16 2727.27 11 727.27 590.98 7 36364 Адрес:\n20 года 2311.84 272.73 1172,73 130,02 736.36 покупателю\n24721,00 3000,00 12900,00 721,00 8 100,00";const r=p.parseSamePhotoPasses([f,b]).find(x=>x.documentVerified);a.ok(r);a.deepEqual(r.items.map(x=>[x.quantity,x.price,x.invoiceTotal,x.packKg,x.packL]),[[3,2454.55,8100,25,null],[1,590.98,721,null,1],[6,1954.55,12900,1.8,null],[12,227.27,3000,.5,null]]);a.equal(p.purchaseMetrics(r.items[3]).basis,'кг');a.ok(!p.parseSamePhotoPasses([f,b.replace('12900,00','12901,00')]).some(x=>x.documentVerified));a.ok(!p.parseSamePhotoPasses([f,b.replace('Креветка учебная Сироп учебный','Сироп учебный Креветка учебная')]).some(x=>x.documentVerified));});

test('reverse OCR matches whole product words, not substrings in unrelated footer text',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'../supply-android/app/src/main/assets/invoice-parser.js'),'utf8');const mod={exports:{}};new Function('module',src)(mod);const p=mod.exports;const f="Счет-фактура № 123\nООО Вирго\nНаименование товара\n3.000 2454.55 7363,64\nРис учебный ГОСТ В/С,\nЛЕБЕДИ СУШИ меш/25кг\nСироп учебный со вкусом\nсоленой карамели 1n\nКреветка учебная 16/20, с/м\nво льду блок 1.8 кг\nКрабовые палочки учебные\nJes краб 500г ТЕСТ\ncero к оплате (9) 24 721 | 24 721,00]",b="Всего к оплате (9) Продавец: Счет-фактура №\nКрабовые палочки учебные Креветка учебная Сироп учебный 1л Рис учебный\nООО Вирго\n12,000 6,000 1,000 3,000 6 (18)\n227.27 1 954.55 590.98 2454.55 нохерения\n22 409.16 2727.27 11 727.27 590.98 7 36364 Адрес:\n20 года 2311.84 272.73 1172,73 130,02 736.36 покупателю\n24721,00 3000,00 12900,00 721,00 8 100,00\nПодпись Борисовна";const r=p.parseSamePhotoPasses([f,b]).find(x=>x.documentVerified);a.ok(r);a.deepEqual(r.items.map(x=>[x.quantity,x.price,x.invoiceTotal]),[[3,2454.55,8100],[1,590.98,721],[6,1954.55,12900],[12,227.27,3000]]);a.ok(!p.parseSamePhotoPasses([f,b.replace('Рис учебный','Борис учебный')]).some(x=>x.documentVerified));});

test('Shanghai Torg UPD: six wrapped rows with two unit-price columns and shipping places',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'../supply-android/app/src/main/assets/invoice-parser.js'),'utf8');const mod={exports:{}};new Function('module',src)(mod);const p=mod.exports;const sample="Счет-фактура № ТЕСТ\nПродавец ООО \"ШАNХАЙ-ТОРГ\" (2) Покупатель Тест\nНаиме нование товара Цена товаров Количество Количество мест Цена с НДС\n4a 5 10 10a 11\nСыр учебный\nПродукт творожный\n65% ПЛАСТ.ВЕДРО 10,5 5(+0)\nN1389 KГ 796 WT 5,000 4 045.45 4450,00 20227,27 6е3 1% 2022,73 22 250.00 112 БЕЛАРУС\nКунжут белый\nU8887 жареный 1 кг 796 WIT 4,000 0(+4) 290,91 320.00 1163,64 63 1% 116.36 1 280.00\nВодоросли НОРИ 100\nЛИСТОВ ТЕСТ 0(+20)\nT1964 Premium 1/40 796 WT 20,000 727.27 800,00 14545.45 6е3 1% 1454,55 16000,00 410\nПалочки бамбуковые\nкруглые ТЕСТ, 0(+10)\nW5070 100пар/уп, 1/50, упак 796 WT 10,000 63.93 78,00 639.34 6 2% 140.66 780.00 156 КИТАЙ 70629\nМайонез Профи\nТест 78% 10 л (9,3 4(+0)\nY9127 KГ) 796 WT 4,000 1487.71 1815,00 5 950.82 6 2% 1309,18 7 260,00\nМасло для фритюра\n\"Тест\" про 5 л 1(+0)\n57352 (термопленка) 796 WT 2,000 726,37 799,00 1 452,73 1% 145,27 1598,00";const r=p.parseSimple(sample);a.equal(r.supplier,'ООО «ШАНХАЙ-ТОРГ»');a.equal(r.pageVerified,true);a.equal(r.documentVerified,false);a.deepEqual(r.items.map(x=>[x.quantity,x.price,x.invoiceTotal,x.packKg,x.packL]),[[5,4450,22250,10.5,null],[4,320,1280,1,null],[20,800,16000,null,null],[10,78,780,null,null],[4,1815,7260,9.3,null],[2,799,1598,null,5]]);a.equal(r.items.reduce((s,x)=>s+x.invoiceTotal,0),49168);a.equal(p.purchaseMetrics(r.items[0]).pricePerKg,423.81);a.equal(p.purchaseMetrics(r.items[4]).pricePerKg,195.16);a.equal(p.purchaseMetrics(r.items[5]).pricePerL,159.8);a.ok(!p.parseSimple(sample.replace('4450,00','4451,00')).pageVerified);a.ok(!p.parseSimple(sample.replace('796 WIT 4,000','796 WIT 5,000')).pageVerified);a.ok(p.parseSamePhotoPasses([sample]).some(x=>x.pageVerified&&x.items.length===6));});

test('reversed OCR columns recover 5, 10, 20, 50 and 100 distinct product rows',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'../supply-android/app/src/main/assets/invoice-parser.js'),'utf8');const mod={exports:{}};new Function('module',src)(mod);const generate=n=>{
 const products=Array.from({length:n},(_,i)=>'Товар'+String.fromCharCode(1072+Math.floor(i/30))+String.fromCharCode(1072+i%30)+' учебный 1 кг');
 const q=products.map((_,i)=>i+1),price=products.map((_,i)=>100+i*10),tax=price.map((x,i)=>x*q[i]*.1),gross=price.map((x,i)=>x*q[i]+tax[i]);const sum=x=>x.reduce((s,v)=>s+v,0),f=x=>x.toFixed(2).replace('.',',');
 const first=['Счет-фактура № ТЕСТ','Поставщик: ООО Учебный','Наименование товара',...products,'Всего к оплате (9) '+f(sum(gross))].join('\n');
 const second=['Счет-фактура № ТЕСТ','Поставщик: ООО Учебный',products.slice().reverse().join(' '),q.slice().reverse().map(x=>x.toFixed(3)).join(' '),price.slice().reverse().map(f).join(' '),[sum(tax),...tax.slice().reverse()].map(f).join(' '),[sum(gross),...gross.slice().reverse()].map(f).join(' ')].join('\n');
 return {first,second,gross};
};for(const n of [5,10,20,50,100]){const {first,second,gross}=generate(n),r=mod.exports.parseSamePhotoPasses([first,second]).find(x=>x.documentVerified&&x.items.length===n);a.ok(r,'row count '+n);a.deepEqual(r.items.map(x=>x.invoiceTotal),gross);}});

test('manual retry crop from real screenshot recovers same-article name and net pack without altering amounts',()=>{const first="Поставщик: Восток-Запад\nзапекания с массовой долей жирности 67% 500002158 ШТ\n22.00 7,627.44 4 39.2\nВ том числе НДС 1,375.44",crop="Майонез \"EFKO FOOD special\" для\nзапекания с массовой долей жирности 67% 500002158 | ШТ 796\n7,627.44 39.2\n9,4кг/10л\nВ том числе НДС 1,375.44\nТоварная накладная имеет продолжение на\nлистах, на бланках за №\nи содержит Один\nпорядковых номеров записей";const result=browserParser.parseSamePhotoPasses([first,crop]).flatMap(r=>r.items).find(x=>x.packKg===9.4&&x.name.includes('EFKO FOOD special'));a.ok(result);a.deepEqual([result.article,result.quantity,result.price,result.totalKg,result.pricePerKg,result.invoiceTotal],['500002158',4,1906.86,37.6,202.86,7627.44]);a.ok(browserParser.parseSamePhotoPasses([first,crop.replace('500002158','500002159')]).every(r=>r.items.every(x=>!x.name.includes('EFKO FOOD special')&&!x.packKg)));});

test('MARR official header, wrapped rows, separate weight and quantity, repeated article',()=>{
 const input='Официальное наименование: "МАРР РУССИЯ" 000\nНаименование Код Кол-во Вес Цена Сумма\n1 0903309716 ()(Креветки)\nКреветки учебные 1 кг упак 2 2,000 100,00 200,00\n2 0903309716 Креветки учебные 1 кг упак 3 3,000 100,00 300,00\n3 2520140121 Картофель учебный 2,5 кг шт 1 2,570 80,00 80,00\nИтого: 6 7,570 580,00';
 const r=browserParser.parseSimple(input);a.equal(r.supplier,'ООО «МАРР РУССИЯ»');a.equal(r.documentVerified,true);a.deepEqual(r.items.map(x=>[x.article,x.quantity,x.packKg,x.price,x.invoiceTotal]),[['0903309716',2,1,100,200],['0903309716',3,1,100,300],['2520140121',1,2.5,80,80]]);
 a.ok(!browserParser.parseSimple(input.replace('580,00','581,00')).documentVerified);
 a.ok(!browserParser.parseSimple(input.replace('300,00','301,00')).documentVerified);
});
test('MARR reversed OCR columns, wrapped numeric columns, duplicate SKU, checked total',()=>{
 const input='Официальное наименование: "МАРР РУССИЯ" 000\n1420043011 2934401710 0903309716 0903309716 0945053074 Код\n8,860 0,860 3,000 1,000 2,000 M Bec\n2,000\n200,00 300,00 300,00 50,00 Цена\n100,00\n1 800,00 200,00 900,00 300,00 200,00 Сумма\n200,00';
 const r=browserParser.parseSimple(input);a.equal(r.supplier,'ООО «МАРР РУССИЯ»');a.equal(r.documentVerified,true);
 a.deepEqual(r.items.map(x=>[x.article,x.quantity,x.price]),[['0945053074',4,50],['0903309716',1,300],['0903309716',3,300],['2934401710',1,200],['1420043011',2,100]]);
 a.ok(!browserParser.parseSimple(input.replace('1 800,00','1 801,00')).documentVerified);
});
test('a new seller in explicit official-name header is not confused with customer',()=>{
 const r=browserParser.parseSimple('Официальное наименование: "НОВЫЙ УЧЕБНЫЙ" ООО\nНаименование контрагента: ООО Покупатель');a.equal(r.supplier,'ООО «НОВЫЙ УЧЕБНЫЙ»');
});

test('MARR actual displaced OCR header and wrapped columns recover all eleven rows',()=>{const head="Официальное наименование: \"МАРР РУССИЯ\" 000",raw="1420043011 1420050355 2934401710 1012401000 2934502625 4166000120 0903309716 0903309716 2520140121 0945053071 0945053074 Место хранения: Телефоны: Фактический адрес: Юридическое лицо: Фактический адрес: Официальное наименование:\nМесто хранения: Охлажденка Место хранения: Сухие продукты Код Наименование контрагента: СПБ WМS NЕW Ф-Л МАРР\n\"МАРР РУССИЯ\" ООО\nM упак ET WT упак упак упак упак ИЗМ. Ед.\nИТОГО: Mесt\nM Кол-во\nN N 8 N 9 N\n9\nN N\n43,430 0,860 3,000 2,000 2,000 18,000 2,000 2,570 3,000 6,000 M Bec\n2,000 2,000\n440,57 1610,38 141,51 712,26 281,13 1 183,96 1 183,96 660,38 594,34 594,34 Цена Реализация № ТЕСТ\n830,19\n42 025,44 1 424,52 562,26 21 311,28 2367,92 660.38 3 566,04 7 132,08 Cумма\n166038 881,14 1610,38 849.06";const r=browserParser.parseSamePhotoPasses([head,raw]).find(x=>x.documentVerified);a.ok(r);a.deepEqual(r.items.map(x=>[x.article,x.quantity,x.packKg,x.price,x.invoiceTotal]),[["0945053074",12,0.5,594.34,7132.08],["0945053071",6,0.5,594.34,3566.04],["2520140121",1,2.5,660.38,660.38],["0903309716",2,1,1183.96,2367.92],["0903309716",18,1,1183.96,21311.28],["4166000120",2,1,281.13,562.26],["2934502625",2,1,712.26,1424.52],["12401000",6,0.5,141.51,849.06],["2934401710",1,0.86,1610.38,1610.38],["1420050355",2,1,440.57,881.14],["1420043011",2,1,830.19,1660.38]]);a.equal(r.items.reduce((s,x)=>s+Math.round(x.invoiceTotal*100),0),4202544);a.equal(r.items.reduce((s,x)=>s+Math.round(x.invoiceWeightKg*1000),0),43430);a.equal(r.items.reduce((s,x)=>s+Math.round(x.totalKg*1000),0),43360);const fries=r.items.find(x=>x.article==='2520140121');a.deepEqual([fries.packKg,fries.totalKg,fries.invoiceWeightKg,fries.pricePerKg],[2.5,2.5,2.57,264.15]);for(const bad of [raw.replace('42 025,44','42 025,45'),raw.replace('43,430','43,431'),raw.replace('1420043011','1420043012')])a.ok(!browserParser.parseSamePhotoPasses([head,bad]).some(x=>x.documentVerified));});

test('MARR combined diagnostic replay selects verified eleven rows over incomplete crops',()=>{const samples=["Официальное наименование: \"МАРР РУССИЯ\" 000\nМесто хранения: Глубокая заморозка\n((ПАНАЗИАТСКАЯ КУХНЯ)\n1 [0945053074\nИкра красная с/м Масаго\n2 10945053071\nПутина 500 г\n()(Твёрдые, полутвёрдые\nсыры) Сыр для пиццы\nМоцарелла м.д.ж. 40% Le\nPlaisir кубик, пакет 1 т\n1420050355\n()(Твёрдые, полутвёрдые\nсыры) Пармезан 40% крошка\nParmesan Primo 1 кг\n1420043011","6\n∞ H % Телефоны:\nV C A ω N Форма оплаты:\n1420043011 1420050355 2934401710 1012401000 2934502625 4166000120 0903309716 0903309716 2520140121 0945053071 0945053074 Место хранения: Телефоны: Фактический адрес: Юридическое лицо: Фактический адрес: Официальное наименование:\nМесто хранения: Охлажденка Место хранения: Сухие продукты Код Наименование контрагента: СПБ WМS NЕW Ф-Л МАРР\nParmesan Primo 1кг сыры) Пармезан 40% крошка ((Твёрдые, полутвёрдые Plaisir кубик, пакет 1 кГ Моцарелла м.д.ж. 40% Lе сыры) Сыр для пиццы ((Твёрдые, полутвёрдые (1200 мл) п/б, Австрия измельчённый Коtaпу 860 г (Коtanyi) Чеснок 500 г, Китай Редька (редис) маринованная ((ПАНАЗИАТСКАЯ КУХНЯ) пакет жареный Планета вкуса 1 кг ()(Все производители) Лук ванильное с ЗМж Соntadino 1 ()(МОРОжЕНОЕ) Мороженое 16/20 (Вьетнам) 1 кг б/хв., без пищ., свежемор. Vаппатеi) Креветки б/г очищ. ()(Креветки королевские 16/20 (Вьетнам) 1 кг. б/хв., без пищ., свежемор. аппатеi) Креветки 6/г очищ. ()(Креветки королевские We Fry 2,5 кг фри в панировке 6 х 6 Ехрегт изделия) FMS6 Картофель ()(Картофель и картофельные Путина 500 г Икра оранжевая с/м Масаго ((ПАНАЗИАТСКАЯ КУХНЯ) Путина 500 г Икра красная с/м Масаго (0(ПАНАЗИАТСКАЯ КУХНЯ) Глубокая заморозка Наименование Дата отгрузки до: 31 октября 2026 г.\nA\n\"МАРР РУССИЯ\" ООО\nM упак ET WT упак упак упак упак ИЗМ. Ед.\nИТОГО: Mесt\nM Кол-во\nN N 8 N 9 N\n9\nN N\n43,430 0,860 3,000 2,000 2,000 18,000 2,000 2,570 3,000 6,000 M Bec\n2,000 2,000\n440,57 1610,38 141,51 712,26 281,13 1 183,96 1 183,96 660,38 594,34 594,34 Цена Реализация № ТЕСТ от 31.10.2026\n830,19\n42 025,44 1 424,52 562,26 21 311,28 2367,92 660.38 3 566,04 7 132,08 Cумма 31.10.2026 0:11:22\n166038 881,14 1610,38 849.06","Официальное наименование: \"МАРР РУССИЯ\" 000\n()(Твёрдые, полутвёрд\nсыры) Пармезан 40% крошка\n1420043011\nParmesan Primo 1 кг\nEC (EXEL\n42 025,44"];const r=browserParser.parseSimple(samples.join('\n---\n'));a.equal(r.documentVerified,true);a.equal(r.items.length,11);a.equal(r.items.filter(x=>x.article==='0903309716').length,2);a.equal(r.items.reduce((s,x)=>s+Math.round(x.invoiceTotal*100),0),4202544);});

test('MARR unknown package must not use separate invoice weight as net mass',()=>{const r=browserParser.parseSimple('Официальное наименование: "МАРР РУССИЯ" ООО\n1 1234567890 Продукт учебный шт 2 5,120 100,00 200,00\nИтого: 2 5,120 200,00');a.equal(r.documentVerified,true);a.equal(r.items[0].packKg,null);a.equal(r.items[0].invoiceWeightKg,5.12);a.equal(r.items[0].pricePerKg,null);});

test('MARR two-column OCR, carton quantity from amounts and separate net weight',()=>{const raw="Официальное наименование: \"МАРР РУССИЯ\" 000\nАвтор: Итого сумма: 800,00 Итого количество: 6 Всего мест: 0 0903309716 37085102 Телефоны: Фактический адрес:\nМесто хранения: Глубокая заморозка Код Юридическое лицо:\nкг/кор.\n16/20 (Вьетнам) 1 кг Креветки Десерт Тарталетка Лимонная\nИТОГО:1\n5,820\n4,000 1,820 M Bec\n150,00 100,00 Цена Реализация № TEST0001 от 01.01.2025\n800,00\nCуMма 01.01.2025 0:00:00\n600,00 200,00";const r=browserParser.parseSimple(raw);a.equal(r.documentVerified,true);a.deepEqual(r.items.map(x=>[x.article,x.unit,x.quantity,x.packKg,x.invoiceWeightKg,x.price,x.invoiceTotal]),[['37085102','кор',2,.81,1.82,100,200],['0903309716','уп',4,1,4,150,600]]);a.ok(!browserParser.parseSimple(raw.replace('600,00 200,00','600,01 200,00')).documentVerified);const rows=browserParser.parseSimple("Официальное наименование: \"МАРР РУССИЯ\" ООО\n1 37085102 Десерт Тарталетка 0,81 кг/кор. кор. 2 1,820 100,00 200,00\n2 0903309716 Креветки 1 кг упак 4 4,000 150,00 600,00\nИтого: 6 5,820 800,00");a.equal(rows.documentVerified,true);a.equal(rows.items[0].unit,'кор');});

test('new legal supplier without preset, exact totals and duplicate OCR passes',()=>{const raw="Официальное наименование: \"НОВЫЙ ПОСТАВЩИК\" ООО\nНаименование | Количество | Ед. | Цена | Сумма\nРис 25 кг | 2 | уп | 2500,00 | 5000,00\nСоус 1 л | 3 | уп | 200,00 | 600,00\nИтого 5600,00";const r=browserParser.parseSimple(raw);a.equal(r.supplier,'ООО «НОВЫЙ ПОСТАВЩИК»');a.equal(r.documentVerified,true);a.deepEqual(r.items.map(x=>[x.quantity,x.price,x.invoiceTotal]),[[2,2500,5000],[3,200,600]]);a.ok(!browserParser.parseSimple(raw.replace('5600,00','5601,00')).documentVerified);a.ok(browserParser.parseSamePhotoPasses([raw,raw]).some(x=>x.documentVerified&&x.items.length===2));const revised=raw.replace('2500,00','2600,00').replace('5000,00','5200,00').replace('5600,00','5800,00');a.equal(browserParser.parseSimple(revised).items[0].price,2600);});

test('MARR unfamiliar article on next invoice uses explicit OCR name rather than fixed catalogue',()=>{
 const s="Официальное наименование: \"МАРР РУССИЯ\" 000\nАвтор: Итого сумма: 900,00 Итого количество: 6 Всего мест: 0 0903309716 37085199 Телефоны: Фактический адрес:\nМесто хранения: Глубокая заморозка Код Юридическое лицо:\nИТОГО:1\n5,820\n4,000 1,820 M Bec\n175,00 100,00 Цена Реализация № TEST0002 от 02.01.2025\n900,00\nCуMма 02.01.2025 0:00:00\n700,00 200,00";
 const detail="1 37085199 Десерт Тарталетка Ягодная 0,81 кг кор.\n2 0903309716 Креветки очищенные 1 кг упак";
 const read=(...p)=>browserParser.parseSamePhotoPasses(p).find(r=>r.columnRecovered&&r.documentVerified);
 const r=read(s,detail);a.ok(r);a.deepEqual(r.items.map(x=>[x.article,x.quantity,x.price,x.invoiceTotal]),[['37085199',2,100,200],['0903309716',4,175,700]]);
 const next=s.replaceAll('900,00','1100,00').replace('175,00 100,00','225,00 100,00').replace('700,00 200,00','900,00 200,00').replaceAll('02.01.2025','03.01.2025').replace('TEST0002','TEST0003');
 a.deepEqual(read(next,detail).items.map(x=>x.price),[100,225]);
 a.ok(!read(s.replace('700,00 200,00','701,00 200,00'),detail));
 a.ok(!read(s,detail.replace('37085199','37085200')));
 a.ok(!read(s,detail,detail.replace('Ягодная','Лимонная')));
});
test('ALIDI unseen product names and changed units are read from barcodes and pack delimiters',()=>{
 const s="АКТ ПРИЕМА-ПЕРЕДАЧИ по УПД № TEST от 10.11.2026\nООО \"АЛИДИ ПРОФ\"\n1234567890123 Мука рисовая 1 кг [1] 1234567890124 Лимонад 1 л [1] Наименование товара\nШТ ШТ Единица измерения\n200.00 150.00 за ЕИ\n400.00 450.00 Общая";
 const cross="150.00 450.00\n200.00 400.00",read=(...p)=>browserParser.parseSamePhotoPasses(p).find(r=>r.columnRecovered&&r.items.some(x=>x.article==='1234567890124'));
 const r=read(s,cross);a.ok(r);a.deepEqual(r.items.map(x=>[x.article,x.quantity,x.price,x.invoiceTotal]),[['1234567890124',3,150,450],['1234567890123',2,200,400]]);
 const next=s.replace('Мука рисовая 1 кг','Семена льна').replace('ШТ ШТ','КГ ШТ').replace('400.00 450.00','500.00 450.00');
 const n=read(next,cross.replace('200.00 400.00','200.00 500.00'));a.ok(n);a.equal(n.items[1].quantity,2.5);a.equal(n.items[1].unit,'кг');
 a.ok(!read(s,cross.replace('450.00','451.00')));
 a.ok(!read(s.replace('ШТ ШТ','ШТ'),cross));
});

test('UPD actual noisy table: missing quantity, glued net, displaced legal seller and full arithmetic',()=>{const raw="Универсальный Счет-фактура № 9357 09 ноября 2026 г.(1)\nОбщество с ограниченной ответственностью\nПродавец: \"ВИРГО\" ИП Покупатель\nНаименование товара (описание выполненных Код вида условное за товаров\nA 1a 16 2 2a 3 4 5 8 9 10 10a 11\nРис шлифованный Гост в/с, 990 меш. 1000 2 454,55 7363,64 86 10% 736.36 8 100,00\nЛЕБЕДИ СУШИ мЕШ/25кг\n²Уксус рисовый ДУНКАН уп/20л 796 ET 000 1337.70 1337.70 294.30 1632,00\nСОУС рисоВЫЙ МИРИН ФУ 20 796 ET 2131,97 2131.97 22% 469.03 2601,00\nл, ДУНКАН\nКреветка тигровая 16/20, с/м 796 6,000 1954.55 1172727 5е3 10% 1172.73 12900,00\nакциза\nво льду блок 1.8 кг\nВсего к оплате (9) 22 560.58 x 2672.42 25 233,00";const r=browserParser.parseSimple(raw);a.equal(r.supplier,'ООО «ВИРГО»');a.equal(r.documentVerified,true);a.deepEqual(r.items.map(x=>[x.quantity,x.price,x.invoiceTotal,x.packKg,x.packL]),[[3,2454.55,8100,25,null],[1,1337.7,1632,null,20],[1,2131.97,2601,null,20],[6,1954.55,12900,1.8,null]]);a.ok(browserParser.parseSamePhotoPasses([raw]).some(x=>x.documentVerified&&x.items.length===4));for(const bad of [raw.replace('25 233,00','25 234,00'),raw.replace('469.03','468.03'),raw.replace('6,000','5,000')])a.ok(!browserParser.parseSimple(bad).documentVerified);});

// Regression from a photographed supplier UPD: no private buyer details.

const virgoPhotoOCR=[
 'Универсальный счет-фактура № 9632 от 16 ноября 2026 г.',
 'Общество с ограниченной ответственностью',
 'Продавец: "ВИРГО" (2) Покупатель: ИП Учебный покупатель',
 'Наименование товара (описание выполненных) Количество Цена Стоимость НДС',
 '1 Рис шлифованный ГОСТ в/с, ЛЕБЕДИ СУШИ меш/25кг 990 меш 2,000 2 454,55 7 363,64 без акциза 10% 736,36 8 100,00',
 '2 Уксус рисовый ДУНКАН уп/20л 796 шт 1,000 1 337,70 1 337,70 без акциза 22% 294,30 1 632,00',
 '3 Лапша "Удон" 0,3 796 шт 10,000 77,27 772,73 без акциза 10% 77,27 850,00',
 '4 Сыр плавленый ломтевой Бистро Чеддер уп/1,107 кг HOCHLAND 778 упак 12,000 828,18 1 656,36 без акциза 10% 165,64 1 822,00',
 '5 Креветка тигровая 16/20, с/м во льду блок 1,8 кг 796 шт 6,000 1 954,55 11 727,27 без акциза 10% 1 172,73 12 900,00',
 '6 Мидии 1/2 рак 30/40, уп/1кг 778 упак 2,000 327,28 654,55 без акциза 10% 65,45 720,00',
 'Всего к оплате (9) 23 512,25 x 2 511,75 26 024,00'
].join('\n');

test('VIRGO UПД: 6 products recovered, damaged quantities flagged',()=>{
 const r=browserParser.parseSimple(virgoPhotoOCR);
 a.equal(r.supplier,'ООО «ВИРГО»');
 a.equal(r.balancedInvoice,true);
 a.equal(r.documentVerified,false);
 a.equal(r.quantityCorrections,2);
 a.deepEqual(r.items.map(x=>x.quantity),[3,1,10,2,6,2]);
 a.deepEqual(r.items.map(x=>x.invoiceTotal),[8100,1632,850,1822,12900,720]);
 a.equal(r.items.reduce((s,x)=>s+x.invoiceTotal,0),26024);
 a.equal(r.items[0].packKg,25);
 a.equal(r.items[1].packL,20);
 a.equal(r.items[4].packKg,1.8);
});
test('VIRGO correct OCR may verify, corrupted VAT/totals never verify',()=>{
 const clean=virgoPhotoOCR.replace('990 меш 2,000','990 меш 3,000').replace('778 упак 12,000','778 упак 2,000');
 a.equal(browserParser.parseSimple(clean).documentVerified,true);
 for(const bad of [virgoPhotoOCR.replace('26 024,00','26 025,00'),virgoPhotoOCR.replace('294,30','294,40'),virgoPhotoOCR.replace('Продавец: "ВИРГО"','Продавец: "ВЕСТА"')])
  a.notEqual(browserParser.parseSimple(bad).balancedInvoice,true);
});
test('VIRGO only joins complementary rows of the SAME photo, no conflicts',()=>{
 const ls=virgoPhotoOCR.split('\n');
 const first=[...ls.slice(0,4),...ls.slice(4,7),ls.at(-1)].join('\n');
 const second=[...ls.slice(0,4),...ls.slice(7,10),ls.at(-1)].join('\n');
 a.ok(browserParser.parseSamePhotoPasses([first,second]).some(x=>x.items.length===6&&x.balancedInvoice));
 a.equal(browserParser.parseSamePhotoPasses([first,second.replace('26 024,00','26 025,00')]).some(x=>x.items.length===6&&x.balancedInvoice),false);
});


// Regression on the actual Android OCR second pass (line wraps, WT/ET glyphs,
// quantity 12 instead of 2, and the shrimp name after its monetary cells).
const virgoUserAndroidOCR=[
 'Универсальный Счет-фактура № 9632 16 ноября 2026 г.(1)',
 'Продавец: "ВИРГО" (2)',
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
test('actual VIRGO Android OCR: wrapped monetary columns yield all six totals',()=>{
 const r=browserParser.parseSimple(virgoUserAndroidOCR);
 a.equal(r.fragmentedOcrRecovered,true);
 a.equal(r.balancedInvoice,true);
 a.equal(r.documentVerified,false);
 a.equal(r.items.length,6);
 a.deepEqual(Array.from(r.items,x=>x.quantity),[3,1,10,2,6,2]);
 a.deepEqual(Array.from(r.items,x=>x.invoiceTotal),[8100,1632,850,1822,12900,720]);
 a.equal(r.items.reduce((s,x)=>s+x.invoiceTotal,0),26024);
 a.ok(r.items.every(x=>x.name&&x.price>0&&x.unit&&!/акциза|\d+,000/.test(x.name)));
 a.match(r.items[0].name,/ЛЕБЕДИ СУШИ/);
 a.match(r.items[3].name,/HOCHLAND/);
 a.match(r.items[4].name,/Креветка тигровая/);
 a.equal(r.quantityCorrections,1);
 a.equal(r.items[3].quantityCorrected,true);
 a.equal(browserParser.parseSamePhotoPasses(['Счет-фактура OCR SHUFFLE',virgoUserAndroidOCR,'<garbled rotated OCR>']).some(x=>x.fragmentedOcrRecovered&&x.items.length===6),true);
});
test('damaged OCR rescue rejects mismatched footer, VAT, OKEI and supplier',()=>{
 for(const broken of [
  virgoUserAndroidOCR.replace('26024,00','26025,00'),
  virgoUserAndroidOCR.replace('294.30 1632,00','294.30 1633,00'),
  virgoUserAndroidOCR.replace('796 ET','777 ET'),
  virgoUserAndroidOCR.replace('Продавец: "ВИРГО"','Продавец: "ДРУГОЙ"'),
  virgoUserAndroidOCR.replace('11 727,27','11 727,37')
 ])a.notEqual(browserParser.parseSimple(broken).fragmentedOcrRecovered,true);
});

// Regression for shorthand packaging and independent piece price basis.
test('SUPPLY OTA: UDON 0,3 kg without invented seafood packaging',()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const code=fs.readFileSync(require.resolve('../supply-android/app/src/main/assets/invoice-parser.js'),'utf8');
 const context={module:{exports:{}}};vm.runInNewContext(code,context,{filename:'invoice-parser.js'});
 const p=context.module.exports;
 a.equal(p.packWeight('Лапша "Удон"0,3 / шт (без НДС)'),0.3);
 a.equal(p.packWeight('Лапша "Удон"0,3 / шт (с НДС)'),0.3);
 a.equal(p.packWeight('Креветка тигровая 16/20 / шт (без НДС)'),null);
 a.equal(p.packWeight('Мидии 1/2 рак 30/40 / уп (с НДС)'),null);
});

test('multi-supplier guard never silently accepts unreadable Chistyakova rows',()=>{
 const candidate=browserParser.auditCandidate({supplier:'ИП Чистякова Ирина Юрьевна',
  items:[{name:'Сыр плавленый ломтевой 778 упак',quantity:null,unit:'',price:0,invoiceTotal:null}]});
 a.equal(candidate.safeToAutoAccept,false);
 a.equal(candidate.needsReview,true);
 a.equal(candidate.items[0].quantity,null);
 a.equal(candidate.items[0].price,0);
 a.ok(candidate.reviewIssues.some(v=>/количество/.test(v)));
 a.ok(candidate.reviewIssues.some(v=>/цен/.test(v)));
 a.ok(candidate.reviewIssues.some(v=>/единица/.test(v)));
});
test('supplier-independent OKEI units require real source evidence and are unambiguous',()=>{
 const source={name:'Соус Унаги 1,8 л. Тамаки',source:'Соус Унаги 1,8 л. Тамаки 796 WT 4,000 593,54 2 374,16',quantity:4,price:593.54,invoiceTotal:2374.16};
 const detected=browserParser.auditCandidate({supplier:'Тестовый поставщик',items:[source]});
 a.equal(detected.items[0].unit,'шт');
 a.equal(detected.items[0].unitEvidence,'ОКЕИ');
 a.equal(browserParser.packVolume(source.name),1.8);
 const noEvidence=browserParser.auditCandidate({items:[{...source,source:'Соус Унаги 1,8 л. Тамаки 4 593,54 2 374,16'}]});
 a.equal(noEvidence.items[0].unit,undefined);
 const conflict=browserParser.auditCandidate({items:[{...source,source:source.source+' 166 кг 4,000 593,54 2 374,16'}]});
 a.equal(conflict.items[0].unit,undefined);
});
test('portions compare by piece even with readable gram packaging',()=>{
 const row={name:'Соус соевый порционный Black 30 гр. [168]',unit:'шт',quantity:840,price:8.45,invoiceTotal:7098};
 const m=browserParser.purchaseMetrics(row);
 a.equal(m.basis,'шт');a.equal(m.pricePerPiece,8.45);a.equal(m.totalPieces,840);
 a.equal(browserParser.packWeight(row.name),.03);
 const ginger={name:'Имбирь порционный маринованный белый 25г.[1]',unit:'шт',quantity:504,price:10.43,invoiceTotal:5256.72};
 a.equal(browserParser.purchaseMetrics(ginger).basis,'шт');
 const una={name:'Соус Унаги 1,8 л. Тамаки',unit:'шт',packL:1.8,quantity:4,price:593.54,invoiceTotal:2374.16};
 const p=browserParser.purchaseMetrics(una);
 a.equal(p.basis,'л');a.equal(p.totalL,7.2);a.equal(p.pricePerL,329.74);
});
test('bad OCR names and document total mismatches cannot become auto-approved',()=>{
 const damaged=browserParser.auditCandidate({documentVerified:true,printedTotal:820,
  items:[{name:'ВДОРИ ЛДЛяОГИ100.TDO□',unit:'шт',quantity:1,price:818.38,invoiceTotal:818.38}]});
 a.equal(damaged.safeToAutoAccept,false);
 a.equal(damaged.items[0].nameNeedsReview,true);
 a.ok(damaged.reviewIssues.some(v=>/итогом/.test(v)));
});

test('do not accept a bare package as an item or two OCR-merged brands',()=>{
 const p=browserParser;
 const make=name=>({items:[{name,quantity:2,price:911,unit:'шт',invoiceTotal:1822}],supplier:'ИП Чистякова'});
 a.equal(p.auditCandidate(make('уп/10кг')).items[0].nameNeedsReview,true);
 a.equal(p.auditCandidate(make('Бистро Чеддер уп/1,107 кг(уп 90 WT) HOCHLAND Творожный сыр')).items[0].nameNeedsReview,true);
 a.equal(p.auditCandidate(make('Сыр творожный Креметте 1,107 кг')).items[0].nameNeedsReview,undefined);
});
test('recover missing document unit from OKEI + reconciled numeric cells, never from packaging alone',()=>{
 const unit=(source,extra={})=>browserParser.unitFromEvidence({source,quantity:4,price:576,invoiceTotal:2304,...extra});
 a.equal(unit('Соус унаги 1,8 л 796 4,000 576,00 2 304,00'),'шт');
 a.equal(unit('Соус унаги 1,8 л 112 4,000 576,00 2 304,00'),'л');
 a.equal(unit('Соус унаги 1,8 л 796 4,000 576,00 2 303,00'),null);
 a.equal(unit('Соус унаги 1,8 л 796 4,000 576,00 2 304,00',{quantity:8}),null);
 a.equal(unit('Соус унаги 1,8 л 4 576,00 2 304,00'),null);
 a.equal(unit('Соус унаги 1,8 л 796 4,000 576,00 2 304,00 166 4,000 576,00 2 304,00'),null);
});
test('version guard is bundled with exact signed HTML/JS revision',()=>{
 const fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'../supply-android/app/src/main/assets');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const js=fs.readFileSync(path.join(root,'app.js'),'utf8');
 const rev=Number(fs.readFileSync(path.join(root,'web-version.txt'),'utf8').trim());
 a.ok(html.includes('id="supplyWebNumber">'+rev+'</span>'));
 a.ok(js.includes('window.SUPPLY_WEB_BUILD='+rev+';'));
 a.ok(html.includes('farukh-supply-last-good-web-revision'));
 a.ok(js.includes('const historical=evidence||data.nameNeedsReview?'));
});
test('allow both OKEI orders but do not derive units from a package label',()=>{
 const unit=source=>browserParser.unitFromEvidence({source});
 a.equal(unit('Сыр творожный 796 шт 2 911,00 1 822,00'),'шт');
 a.equal(unit('Сыр творожный шт 796 2 911,00 1 822,00'),'шт');
 a.equal(unit('Сыр творожный 166 кг 2 911,00 1 822,00'),'кг');
 a.equal(unit('Сыр творожный уп/1,107 кг(уп 90 WT) 2 911,00'),null);
 a.equal(unit('Сыр творожный 796 шт 2 166 кг 2'),null);
});
test('unit correction preserves only a unique exact existing supplier alias',()=>{
 const app=require('node:fs').readFileSync(require('node:path').join(__dirname,'../supply-android/app/src/main/assets/app.js'),'utf8');
 const source=app.slice(app.indexOf('function catalogMatch('),app.indexOf('function catalogTitle('));
 const aliasKey=(s,r)=>JSON.stringify([s,r.article||'',r.name,r.unit||'',r.packKg||null,r.packL||null]);
 const api={aliasKey,resolve:()=>({status:'review'})};
 const old={name:'Сыр творожный 1,107 кг',article:'A1',unit:'',packKg:1.107};
 const aliases={[aliasKey('Чистякова',old)]:{productId:'cheese',variantId:'item'}};
 const get=()=>({aliases,byId:new Map([['cheese',{}]]),products:[{id:'cheese'}]});
 const match=new Function('catalogAPI','catalogSnapshot',source+'\\nreturn catalogMatch;'.replace('\\n','\n'))(api,get);
 a.equal(match({...old,unit:'шт'},'Чистякова').status,'known');
 a.equal(match({...old,unit:'шт',packKg:2},'Чистякова').status,'review');
 a.equal(match({...old,unit:'шт'},'Другой поставщик').status,'review');
 a.equal(match({...old,unit:'шт',article:'B2'},'Чистякова').status,'review');
});
test('a unique confirmed unit may be reused only for the same supplier, name, and pack',()=>{
 const app=require('node:fs').readFileSync(require('node:path').join(__dirname,'../supply-android/app/src/main/assets/app.js'),'utf8');
 const source=app.slice(app.indexOf('function confirmedUnitFromHistory('),app.indexOf('function knownPack('));
 const fn=new Function('norm','supplierKey','productIdentity','numeric','window','docs',source+'\\nreturn confirmedUnitFromHistory;'.replace('\\n','\n'))(
  x=>String(x||'').toLowerCase(),x=>String(x||'').toLowerCase(),x=>String(x||'').toLowerCase(),x=>Number(x)||null,
  {supplyInvoiceParser:{packWeight:()=>null,packVolume:()=>null}},[]);
 const sample={simpleVersion:1,supplierId:'ИП Чистякова',lines:[{name:'Сыр творожный',unit:'шт',packKg:1.107}]};
 a.equal(fn({name:'Сыр творожный',packKg:1.107},'ИП Чистякова',[sample]),'шт');
 a.equal(fn({name:'Сыр творожный',packKg:2},'ИП Чистякова',[sample]),'');
 a.equal(fn({name:'Сыр творожный',packKg:1.107},'Другой',[sample]),'');
 a.equal(fn({name:'Сыр творожный',packKg:1.107},'ИП Чистякова',[sample,{...sample,lines:[{name:'Сыр творожный',unit:'кг',packKg:1.107}]}]),'');
});

test('signed HTML revision is displayed without reading an outdated APK version file',()=>{
 const fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'../supply-android/app/src/main/assets');
 const ver=fs.readFileSync(path.join(root,'web-version.txt'),'utf8').trim();
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
 a.ok(html.includes('id="supplyWebNumber">'+ver+'</span>'));
 a.ok(!app.includes("fetch('web-version.txt'"));
});



/* Seven supplier templates: values below represent independent photographed
 * example rows, never catalog defaults used by the application. */
const vendorApi=(()=>{const m={exports:{}};new Function('module','exports',require('node:fs').readFileSync(require('node:path').join(__dirname,'../supply-android/app/src/main/assets/invoice-parser.js'),'utf8'))(m,m.exports);return m.exports;})();
const vendorHeaders={
 marr:['№','Код','Наименование','Ед. изм.','Мест','Кол-во','Вес кг','Цена','Сумма'],
 upd:['Наименование товара','Код ОКЕИ','Единица измерения','Количество','Цена (тариф) за единицу измерения','Стоимость товаров без налога','Сумма налога','Стоимость товаров с налогом'],
 simple:['Наименование товара','Единица измерения','Количество','Цена с НДС','Стоимость с НДС']
};
test('all seven supplier layouts registered; missing supplier never guessed',()=>{
 const p=vendorApi.supplierTemplates;
 a.equal(p.length,7);
 a.deepEqual(p.map(x=>x.id),['chistyakova','virgo','vesta','vostok_zapad','marr','shanghai','alidi']);
 for(const x of p)a.equal(vendorApi.detectSupplierTemplate('Продавец: '+x.name+'\nНакладная № 12'),x);
 a.equal(vendorApi.detectSupplierTemplate('Покупатель: ИП Мамедова'),null);
});
test('MARR 11 independent positions, including two separate shrimp lines',()=>{
 const raw=[
 ['1','0945053074','Масаго красная Путина 500 г','упак','','12','6,000','594,34','7132,08'],
 ['2','0945053071','Масаго оранжевая Путина 500 г','упак','','6','3,000','594,34','3566,04'],
 ['3','2520140121','Картофель фри Expert We Fry 2,5 кг','шт','','1','2,570','660,38','660,38'],
 ['4','0903309716','Креветки Vannamei 16/20 1 кг','упак','','2','2,000','1183,96','2367,92'],
 ['5','0903309716','Креветки Vannamei 16/20 1 кг','упак','','18','18,000','1183,96','21311,28'],
 ['7','4166000120','Мороженое Contadino 1 кг','шт','','2','2,000','281,13','562,26'],
 ['6','2934502625','Лук жареный Планета вкуса 1 кг','шт','','2','2,000','712,26','1424,52'],
 ['10','12401000','Редька маринованная 500 г','упак','','6','3,000','141,51','849,06'],
 ['11','2934401710','Чеснок Kotanyi 860 г','шт','','1','0,860','1610,38','1610,38'],
 ['8','1420050355','Моцарелла Le Plaisir 1 кг','шт','','2','2,000','440,57','881,14'],
 ['9','1420043011','Пармезан Parmesan Primo 1 кг','шт','','2','2,000','830,19','1660,38']
 ];
 const r=vendorApi.parseSupplierTable('marr',vendorHeaders.marr,raw,{printedTotal:'42025,44'});
 a.equal(r.items.length,11);a.equal(r.documentVerified,true);
 a.equal(r.items.reduce((s,x)=>s+x.invoiceWeightKg,0).toFixed(3),'43.430');
 a.equal(r.items.reduce((s,x)=>s+x.quantity,0),54);
 a.equal(r.items.filter(x=>x.article==='0903309716').length,2);
 const smaller=vendorApi.parseSupplierTable('marr',vendorHeaders.marr,[raw[2]],{printedTotal:'660,38'});
 a.equal(smaller.items.length,1);a.equal(smaller.documentVerified,true);
});
test('Chistyakova UPD distinguishes 2 rows and gross prices, not net VAT price',()=>{
 const rows=[
 ['Сыр плавленый Бистро Чеддер 1,107 кг','778','упак','2,000','828,18','1656,36','165,64','1822,00'],
 ['Творожный сыр Креметте 10 кг','796','шт','2,000','4237,28','8474,55','847,45','9322,00']
 ];
 const r=vendorApi.parseSupplierTable('chistyakova',vendorHeaders.upd,rows,{printedTotal:'11144,00'});
 a.equal(r.items.length,2);a.equal(r.items[1].unit,'шт');
 a.equal(r.items[1].price,4661);a.equal(r.documentVerified,true);
 const invalid=[...rows[1]];invalid[6]='800,00';
 a.equal(vendorApi.parseSupplierTable('chistyakova',vendorHeaders.upd,[invalid]),null);
});
test('VIRGO and VESTA UPD preserve different line counts',()=>{
 const h=['Наименование товара','Код ОКЕИ','Единица измерения','Количество','Стоимость товаров с налогом'];
 const virgo=vendorApi.parseSupplierTable('virgo',h,[
  ['Рис Лебеди Суши 25 кг','796','шт','3','8100,00'],
  ['Уксус рисовый 20 л','796','шт','1','1632,00'],
  ['Лапша Удон','796','шт','10','850,00']
 ],{printedTotal:'10582,00'});
 const vesta=vendorApi.parseSupplierTable('vesta',h,[
  ['Масло VOLFOOD 5л','796','шт','2','1640,00'],
  ['Майонез Pechagin 10л','796','шт','4','7220,00'],
  ['Соус чили Tamaki','796','шт','3','1895,67'],
  ['Соус Терияки Tamaki','796','шт','2','1211,76']
 ],{printedTotal:'11967,43'});
 a.equal(virgo.items.length,3);a.equal(virgo.documentVerified,true);
 a.equal(vesta.items.length,4);a.equal(vesta.documentVerified,true);
});
test('EastWest TTN uses quantity kilograms not shipping gross weight',()=>{
 const h=['Наименование товара','Код','Единица измерения','Количество мест (в ЕИ отгрузки)','Масса брутто','Сумма с НДС'];
 const r=vendorApi.parseSupplierTable('vostok_zapad',h,[['Форель радужная Trim C','500005219','кг','32,858','36,058','61444,46']],{printedTotal:'61444,46'});
 a.equal(r.items[0].quantity,32.858);a.equal(r.items[0].price,1870);
 a.equal(r.items[0].invoiceWeightKg,undefined);a.equal(r.documentVerified,true);
});
test('Shanghai gross price and Alidi incomplete multipage do not share rules',()=>{
 const s=vendorApi.parseSupplierTable('shanghai',vendorHeaders.simple,[
  ['Сыр Бабушкин Продукт','шт','5','4450,00','22250,00'],
  ['Кунжут белый','шт','4','355,00','1420,00'],
  ['Нори KAMINARY','шт','10','800,00','8000,00'],
  ['Палочки KAMINARY','шт','10','78,00','780,00'],
  ['Майонез Профи','шт','4','1815,00','7260,00'],
  ['Крабовые палочки Санта Бремор','шт','36','216,00','7776,00']
 ],{printedTotal:'47486,00'});
 const a1=vendorApi.parseSupplierTable('alidi',vendorHeaders.simple,[
  ['Масаго красная 500 г','шт','8','599,37','4794,96'],
  ['Масаго оранжевая 500 г','шт','8','599,37','4794,96']
 ]);
 a.equal(s.items.length,6);a.equal(s.documentVerified,true);
 a.equal(a1.items.length,2);a.equal(a1.documentVerified,false);
});
test('Conflicting OKEI/unit requires manual review',()=>{
 const h=['Наименование товара','Код ОКЕИ','Единица измерения','Количество','Сумма с НДС'];
 const r=vendorApi.parseSupplierTable('virgo',h,[['Творожный сыр','796','кг','2','1822,00']],{printedTotal:'1822,00'});
 a.equal(r.items[0].unit,'');a.equal(r.documentVerified,false);
 a.ok(r.warnings.some(x=>x.includes('конфликт')));
});
test('Delimited OCR automatically applies vendor layout without fixing assortment',()=>{
 const text='Продавец: ООО «ВЕСТА»\nНаименование товара | Единица измерения | Количество | Сумма с НДС\nМасло VOLFOOD | шт | 2 | 1640,00\nМайонез Pechagin | шт | 4 | 7220,00\nИтого | | | 8860,00';
 const r=vendorApi.parseSupplierDelimited(text);
 a.equal(r.items.length,2);a.equal(r.documentVerified,true);
 a.equal(vendorApi.parseSimple(text).items.length,2);
});


// Supplier templates must run on the ordinary Android photo OCR path, not
// just on pasted PP-StructureV3 JSON and delimited regression fixtures.
test('seven supplier photo grid: 1, 6, 10, 20 and 25 lines',()=>{
 const ids=vendorApi.supplierTemplates,counts=[1,6,10,20,25];
 const columns=[['Наименование',75],['Артикул',245],['Ед',330],['Количество',425],['Цена',520],['Сумма',615]];
 const boxesFor=(items,total)=>{
  const out=[],add=(text,x,y)=>out.push({text,left:x-4,right:x+4,top:y,bottom:y+14,confidence:.99});
  columns.forEach(([s,x])=>add(s,x,100));
  items.forEach((cells,i)=>cells.forEach((s,j)=>{if(s)add(s,columns[j][1],125+i*24)}));
  add('Итого:',75,151+items.length*24);add(total.toFixed(2).replace('.',','),615,151+items.length*24);
  return out;
 };
 for(const p of ids)for(const count of counts){
  const items=Array.from({length:count},(_,i)=>['Товар '+(i+1),'A'+i,'шт','1','12,00','12,00']);
  const r=vendorApi.parsePhoto('Продавец: '+p.name+'\nИтого: '+(count*12)+',00',JSON.stringify(boxesFor(items,count*12)));
  a.equal(r.items.length,count,p.id+': '+count);
  a.equal(r.supplierPhotoGrid,true,p.id+': '+count);
  // UPD has a net-price column: the sum is still the authoritative gross.
  a.equal(r.items.every(x=>x.quantity===1&&x.invoiceTotal===12),true,p.id+': '+count);
 }
});
test('photo spatial columns keep packaging codes out of product name',()=>{
 const photo=[
  {text:'Наименование',x:80,y:20},{text:'Артикул',x:230,y:20},{text:'Ед',x:320,y:20},{text:'Количество',x:410,y:20},{text:'Цена',x:505,y:20},{text:'Сумма',x:615,y:20},
  {text:'Майонез Профи Печагин 78% 10 л',x:80,y:50},{text:'100пар/уп 1/50',x:230,y:50},{text:'шт',x:320,y:50},{text:'10',x:410,y:50},{text:'78,00',x:505,y:50},{text:'780,00',x:615,y:50}
 ].map(b=>({text:b.text,left:b.x-4,right:b.x+4,top:b.y,bottom:b.y+14,confidence:.99}));
 const raw='Продавец: ООО «ШАНХАЙ-ТОРГ»\nИтого: 780,00';
 const r=vendorApi.parsePhoto(raw,photo);
 a.equal(r.supplierPhotoGrid,true);
 a.equal(r.items[0].name,'Майонез Профи Печагин 78% 10 л');
 a.equal(r.items[0].unit,'шт');
 a.equal(r.items[0].packL,10);
 a.equal(r.items[0].quantity*r.items[0].price,r.items[0].invoiceTotal);
});
test('damaged or ambiguous photo grid falls back without creating verified data',()=>{
 const r=vendorApi.parsePhoto('Продавец: ООО «ШАНХАЙ-ТОРГ»\nКунжут белый кг 5 4450,00 22250,00','[]');
 a.equal(!!r.supplierPhotoGrid,false);
 const wrong=vendorApi.parsePhoto('Продавец: ООО «ШАНХАЙ-ТОРГ»\nИтого: 100,00',[
  ['Наименование',75,10],['Ед',330,10],['Количество',420,10],['Цена',515,10],['Сумма',615,10],
  ['Кунжут белый',75,40],['шт',330,40],['4',420,40],['100,00',515,40],['999,00',615,40]
 ].map(([text,x,y])=>({text,left:x-4,right:x+4,top:y,bottom:y+14,confidence:.99})));
 a.equal(!!wrong.supplierPhotoGrid,false);
});
test('Android ordinary photo OCR feeds vendor parser instead of only JSON importer',()=>{
 const app=require('node:fs').readFileSync(require('node:path').join(__dirname,'../supply-android/app/src/main/assets/app.js'),'utf8');
 a.ok(app.includes("parsePhoto(text||'',spatialJson)"));
});

test('photo OCR packaging prefix is separated from ingredient name and flagged',()=>{
 const text='Продавец: ООО «ШАНХАЙ-ТОРГ»\n100пар/уп, 1/50, упак Майонез Профи Печагин 78% 10 л (9,3 кг) шт 10 78,00 780,00';
 const r=vendorApi.parsePhoto(text,'[]');
 a.equal(r.items.length,1);
 a.equal(r.items[0].name.startsWith('Майонез Профи Печагин'),true);
 a.equal(r.items[0].ocrOriginalName.includes('100пар/уп'),true);
 a.equal(r.items[0].nameNeedsReview,true);
 a.equal(r.documentVerified,false);
 a.equal(r.items[0].quantity,10);
 a.equal(r.items[0].invoiceTotal,780);
});
