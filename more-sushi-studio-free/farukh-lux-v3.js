/* FARUKH TTK PRO — private professional recipe document studio */
(function(){
'use strict';
const ARCHIVE_HTML="\n<svg id=\"topArtwork\" viewBox=\"0 0 794 303\" preserveAspectRatio=\"none\"><defs>\n <linearGradient id=\"ocean\" x1=\"0\" y1=\"0\" x2=\".9\" y2=\".9\"><stop stop-color=\"#06223f\"/><stop offset=\".66\" stop-color=\"#0b4a78\"/><stop offset=\"1\" stop-color=\"#14426b\"/></linearGradient>\n <linearGradient id=\"plate\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop stop-color=\"#c0cfd9\"/><stop offset=\".38\" stop-color=\"#e4edf3\"/><stop offset=\"1\" stop-color=\"#fff\"/></linearGradient>\n </defs>\n <path d=\"M0 0H199 C193 42 184 98 180 140 C168 203 134 259 0 292Z\" fill=\"url(#ocean)\"/>\n <path d=\"M199 0 C190 45 183 94 175 141 C164 202 129 257 0 303\" fill=\"none\" stroke=\"#e72940\" stroke-width=\"7\"/>\n <path d=\"M179 149 C311 125 468 146 526 202 C569 244 503 289 375 301 L0 301 C120 277 153 218 179 149Z\" fill=\"url(#plate)\" opacity=\".74\"/>\n </svg>\n<div id=\"brand\"><img id=\"logo\" title=\"Нажмите для замены логотипа\" src=\"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA4KCw0LCQ4NDA0QDw4RFiQXFhQUFiwgIRokNC43NjMuMjI6QVNGOj1OPjIySGJJTlZYXV5dOEVmbWVabFNbXVn/2wBDAQ8QEBYTFioXFypZOzI7WVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVn/wAARCABQAFADASIAAhEBAxEB/8QAGwAAAgIDAQAAAAAAAAAAAAAABQYDBAABAgf/xAA6EAACAQMCAgcGAwYHAAAAAAABAgMABBEFIRIxBhMiQVFhcTJCgZGhsRRS0RUjJDPB8TRDU2KCouH/xAAZAQADAQEBAAAAAAAAAAAAAAACAwQBBQD/xAAoEQACAgIBAwMDBQAAAAAAAAABAgADESESBDEyQVFxBRThIoGhwfH/2gAMAwEAAhEDEQA/APQa3W8VhIUZY4FbPTMYGTsKptqMHGUiPWsPy8vnVfXbqG3twJpCWf2Ik5tS/bWV/cnPEbeM+6hwfif7UapkZMWz4OBsxk/aJEvDL1US+LGppdQgVcxzwyHwDigcfR2MnL4ZvEjJ+ZqR+jNu45DPmorcJ7zA1nt/P4hqK8R4w8imMeJ3FWBhgCpBB5EUm3On3mndi1vFI/0HfIPwO4qbQtSlW4aE5Rxu8Dn6ihK+oMZseQxGvFZisRlkQOhyDWUM2bpe1nUHjPWrkop4UUe+1FNTldLNxF/MYcIpdsYpbm+PW5ZbRCyqfzkbUaKCdxdjEDXeXtN02SRzdXrdZcPzzyXyFHI4go2FKOgdKrdLRYL0FZFJyw3zk5o8nSHTGxi4+lOemzPbMSl1QGzj5hThqrqtw1ppdzPF/MSMlfI13b31rcnEM6OfDODXVxH1sbIRkEYI8amdSNHUrpdCwbuJ5nqWszXUaoW7CjZf6+vnRe1tJtQ0O3vA7C5jJCyd+3L18Klk6NWC3JLzIi59kuNqYVls7OwWKOWPAXhRUOaV09VitnE6f1HrOneoIn+fmcaBqEc9mOM8M4bglXwbx+NGDSTKxt7yC6jHDHeR9oDlnmDTbp9z+LsYpe8jB9RtVDrxM49bchuRzXKQzjrMHIxvQ/Q+1HcT98szn64FUek8zQtC655kVe0L/DSJ+WRvkdx961fEzHP6lixr2ifgrt7iEYgduIbbLnmp8PLxoXLBDJHmNwkg93NenPEHUqQCCMEEbGl3U+iVrdIzWv8ADTc14fZJ8x3fCrKupwMNJLelJPJTEaGa6huFETtxA7b8qeINfWa1BvJAI0UBnO3GfTvJpXaIWOnr14xPMSd+YQfrU+jaFPq5E9zIYbQHsgc29P1qizhxy0mAZjhdf3Jr3Xklk6uxsUJJ24xxMfgNh9aJaPoV9ekT6niCA79Ugwz+R8BR/TdMsdOQfhoUQj/Mc5PzNEAzSbIpP+7uqNr2xhZUlC5ywgbpDbgWcUgAAjkXAHcM4qfo2SLOaM+5MwFb1oNNa9XhlJkUBcZzvz2rehgRxyAkBpJGYCkN4iUr5k/Er65bCdFDcuIVXuZX0S2WZlkaNlAbgxnI27/LHyozfQiWJlPeKXr/AFFwqwXSlkPYbbPo3r/7Qo3Ft9ptqFkwO8mj6UpIAIbe4YFdi7AZbvHKp5tdD2TloZIXPZDnGB4/HFBGu4dMmCT2ts0JGUkZnPFXM+qWmp8KtGyIgIU9aQBnyxV61JkanKN1ozk4/aAb24N9fO52UYVR4dwr0m0tlht4lACwooUf29aXdJtLa3LTWVnxOBxG5uDhY/TP3q3ca/a28rrFLJdXSJwiT3A3ft3+tDeSxwI2p1UZhq5uIrRerHVyzb7OQNudKd30tv5pP4eMRR4xw88Gq11HNqV6LiZArkAFU8avLpyxRIrKC5zhR3n9KBaveIt67fGuXLLpGl6VjuoGJVe26j2T5Gj1mvBGFikVgG3LHJIpYsbVWuVWIAxoeIsPebx9Ka7ZAigAY2xU7EZ1OrWrYHLvJmXIoJqun9YONACw7j30fGGAIIIO4I76j/dy8QV1fhODg5waXHZi1dPYXGlCKSI8cftKea/qKC21vbBw1qFdx3Nlsf8AHn96bb3Skm7S9lvEUv3GhyxScax5x3rt9KbXayDHpEXdOtuz3lW/hmvEWOa+yF5RcPAg+H61rTtOjicdZ/1Io1Z35tF4Z7S4lA8gfvW5dSnuAVt7aeIH0X7Uz7gD0kbfT2bXPXxJFeKzUYijiGNnmJz8BzPyqCd4516uAs8sntsRuR/QeVQwaNPPL1kuVzzycmj9np0duoCr8aS1haVU9KlPbZkWn2SwRgY3okq4FdLHiuuGgzKsT//Z\" alt=\"Море суши\"><div class=\"brandname\"><span data-layout=\"brand_first\" class=\"editableLayout\" contenteditable=\"true\">Море</span> <em><span data-layout=\"brand_accent\" class=\"editableLayout\" contenteditable=\"true\">суши</span></em></div><div class=\"brandsub editableLayout\" data-layout=\"brand_subtitle\" contenteditable=\"true\">— ДОСТАВКА СУШИ —</div></div>\n<div id=\"pageTitle\" class=\"editableLayout\" contenteditable=\"true\" data-layout=\"document_title\">Технико-технологическая карта</div><div id=\"titleDash\"></div>\n<div id=\"nameStrip\"><span class=\"labelN editableLayout\" contenteditable=\"true\" data-layout=\"code_label\">Код ТТК:</span><span class=\"namecode edit\" data-key=\"code\" contenteditable=\"true\" data-ph=\"Заполнить\"></span><span class=\"separator\">•</span><span class=\"labelN editableLayout\" contenteditable=\"true\" data-layout=\"name_label\">Название блюда:</span><span class=\"namedish edit\" data-key=\"name\" contenteditable=\"true\" data-ph=\"Заполнить\"></span></div>\n<div id=\"photoBox\" title=\"Нажмите, чтобы выбрать фотографию\"><img id=\"dishPhoto\"><span class=\"uploadEmpty\" id=\"photoPlaceholder\">\n<svg viewBox=\"0 0 90 90\"><rect x=\"13\" y=\"12\" width=\"63\" height=\"65\" rx=\"4\" fill=\"none\" stroke=\"#738599\" stroke-width=\"5\"/><circle cx=\"61\" cy=\"31\" r=\"8\" fill=\"#738599\"/><path d=\"M15 74L36 46L47 56L58 44L77 69\" fill=\"#738599\"/></svg><span class=\"editableLayout\" contenteditable=\"true\" data-layout=\"photo_title\">ФОТО БЛЮДА</span><small class=\"editableLayout\" contenteditable=\"true\" data-layout=\"photo_subtitle\">(вставьте изображение)</small></span><span class=\"photoTip\">Нажмите, чтобы заменить фото</span></div>\n<input type=\"file\" accept=\"image/jpeg,image/png,image/webp\" id=\"photoInput\">\n<div id=\"factBox\">\n<div class=\"fact\"><b class=\"editableLayout\" data-layout=\"category_label\" contenteditable=\"true\">Категория:</b><div class=\"value\"><span class=\"edit\" data-key=\"category\" contenteditable=\"true\" data-ph=\"Заполнить\"></span></div></div>\n\n<div class=\"fact\"><b class=\"editableLayout\" data-layout=\"yield_label_text\" contenteditable=\"true\">Выход:</b><div class=\"value\"><span class=\"yieldInline\"><input id=\"autoYield\" type=\"number\" step=\"0.01\" min=\"0\" data-key=\"yield_g\" title=\"Автоматический расчёт по массе компонентов и потерям\" readonly aria-label=\"Выход готового блюда, г\"><span class=\"unitG\">г</span></span></div></div>\n</div>\n<section class=\"card card1\"><div class=\"cardHead editableLayout\" data-layout=\"section1\" contenteditable=\"true\">1. ОБЛАСТЬ ПРИМЕНЕНИЯ</div><div class=\"body edit\" contenteditable=\"true\" data-key=\"scope\" data-ph=\"Введите текст\"></div></section>\n<section class=\"card card2\"><div class=\"cardHead editableLayout\" data-layout=\"section2\" contenteditable=\"true\">2. ТРЕБОВАНИЯ К СЫРЬЮ</div><div class=\"body edit\" contenteditable=\"true\" data-key=\"raw_requirements\" data-ph=\"Введите текст\"></div></section>\n<section class=\"card card3\"><div class=\"cardHead editableLayout\" data-layout=\"section3\" contenteditable=\"true\">3. РЕЦЕПТУРА</div><div class=\"body\">\n<table id=\"recipeTable\"><thead><tr><th class=\"editableLayout\" contenteditable=\"true\" data-layout=\"th1\">№</th><th class=\"editableLayout\" contenteditable=\"true\" data-layout=\"th2\">Наименование ингредиента / полуфабриката</th><th class=\"editableLayout\" contenteditable=\"true\" data-layout=\"th3\">Брутто, г</th><th class=\"editableLayout\" contenteditable=\"true\" data-layout=\"th4\">Нетто, г</th><th class=\"editableLayout\" contenteditable=\"true\" data-layout=\"th5\">Выход, г</th></tr></thead><tbody id=\"recipeLines\"></tbody>\n<tfoot><tr class=\"total\"><td colspan=\"4\" class=\"editableLayout\" contenteditable=\"true\" data-layout=\"total_label\">Выход готового блюда:</td><td id=\"totalYield\">—</td></tr></tfoot>\n</table>\n<div class=\"smalltools\"><button id=\"addLine\" type=\"button\">+ строка</button><label>Потери, г <input id=\"lossG\" type=\"number\" min=\"0\" step=\"0.1\" value=\"0\" style=\"width:51px;border:1px solid #a9c5d7;border-radius:3px;font-size:9px;text-align:right\"></label><span id=\"massStatus\"></span></div></div></section>\n<section class=\"card card4\"><div class=\"cardHead editableLayout\" data-layout=\"section4\" contenteditable=\"true\">4. ТЕХНОЛОГИЧЕСКИЙ ПРОЦЕСС</div><div class=\"body\" id=\"process\"><div class=\"processSteps\">\n<div class=\"step\"><b>1.</b><div class=\"edit\" data-key=\"step1\" contenteditable=\"true\" data-ph=\"Введите текст\"></div></div>\n<div class=\"step\"><b>2.</b><div class=\"edit\" data-key=\"step2\" contenteditable=\"true\" data-ph=\"Введите текст\"></div></div>\n<div class=\"step\"><b>3.</b><div class=\"edit\" data-key=\"step3\" contenteditable=\"true\" data-ph=\"Введите текст\"></div></div>\n<div class=\"step\"><b>4.</b><div class=\"edit\" data-key=\"step4\" contenteditable=\"true\" data-ph=\"Введите текст\"></div></div>\n</div></div></section>\n<section class=\"card card5\"><div class=\"cardHead editableLayout\" data-layout=\"section5\" contenteditable=\"true\">5. ОФОРМЛЕНИЕ, РЕАЛИЗАЦИЯ, УСЛОВИЯ ХРАНЕНИЯ И ТРАНСПОРТИРОВАНИЯ</div><div id=\"f5\">\n<div class=\"four\">\n<label>Оформление:</label><div class=\"edit\" contenteditable=\"true\" data-key=\"serving_design\" data-ph=\"Введите текст\"></div>\n<label>Реализация:</label><div class=\"edit\" contenteditable=\"true\" data-key=\"serving_sale\" data-ph=\"Введите текст\"></div>\n<label>Условия хранения:</label><div class=\"edit\" contenteditable=\"true\" data-key=\"storage\" data-ph=\"Введите текст\"></div>\n<label>Транспортирование:</label><div class=\"edit\" contenteditable=\"true\" data-key=\"serving_transport\" data-ph=\"Введите текст\"></div>\n</div><div id=\"allergy\"><h3 data-layout=\"allergens_label\" class=\"editableLayout\" contenteditable=\"true\">АЛЛЕРГЕНЫ</h3><div class=\"edit\" contenteditable=\"true\" data-key=\"allergens\" data-ph=\"Введите список аллергенов\"></div></div>\n</div></section>\n<section class=\"card card6\"><div class=\"cardHead editableLayout\" data-layout=\"section6\" contenteditable=\"true\">6. ПОКАЗАТЕЛИ КАЧЕСТВА И БЕЗОПАСНОСТИ</div><div class=\"body\" style=\"padding:1px 1px\"><table id=\"qualityTable\">\n<tbody><tr><td class=\"editableLayout\" data-layout=\"qualityLabel1\" contenteditable=\"true\">Внешний вид</td><td class=\"edit\" contenteditable=\"true\" data-key=\"quality_appearance\"></td></tr>\n<tr><td class=\"editableLayout\" data-layout=\"qualityLabel2\" contenteditable=\"true\">Консистенция</td><td class=\"edit\" contenteditable=\"true\" data-key=\"quality_consistency\"></td></tr>\n<tr><td class=\"editableLayout\" data-layout=\"qualityLabel3\" contenteditable=\"true\">Вкус и запах</td><td class=\"edit\" contenteditable=\"true\" data-key=\"quality_taste\"></td></tr>\n<tr><td class=\"editableLayout\" data-layout=\"qualityLabel4\" contenteditable=\"true\">Цвет</td><td class=\"edit\" contenteditable=\"true\" data-key=\"quality_color\"></td></tr>\n<tr><td class=\"editableLayout\" data-layout=\"qualityLabel5\" contenteditable=\"true\">Безопасность</td><td class=\"edit\" contenteditable=\"true\" data-key=\"quality_safety\"></td></tr></tbody></table></div></section>\n<section class=\"card card7\"><div class=\"cardHead editableLayout\" data-layout=\"section7\" contenteditable=\"true\">7. ПИЩЕВАЯ И ЭНЕРГЕТИЧЕСКАЯ ЦЕННОСТЬ</div>\n<div class=\"body\"><div id=\"nutritionHead\"><span data-layout=\"nutrition_prefix\" class=\"editableLayout\" contenteditable=\"true\">На 1 порцию (</span><span class=\"edit\" data-key=\"yield_label\">—</span><span data-layout=\"nutrition_suffix\" class=\"editableLayout\" contenteditable=\"true\"> г):</span></div>\n<table id=\"nutritionTable\"><thead><tr><th class=\"editableLayout\" data-layout=\"nutHead1\" contenteditable=\"true\">Белки, г</th><th class=\"editableLayout\" data-layout=\"nutHead2\" contenteditable=\"true\">Жиры, г</th><th class=\"editableLayout\" data-layout=\"nutHead3\" contenteditable=\"true\">Углеводы, г</th><th class=\"editableLayout\" data-layout=\"nutHead4\" contenteditable=\"true\">Энергетическая ценность, ккал</th></tr></thead><tbody><tr><td class=\"edit\" data-key=\"protein\" contenteditable=\"true\" data-ph=\"—\"></td><td class=\"edit\" data-key=\"fat\" contenteditable=\"true\" data-ph=\"—\"></td><td class=\"edit\" data-key=\"carbs\" contenteditable=\"true\" data-ph=\"—\"></td><td class=\"edit\" data-key=\"kcal\" contenteditable=\"true\" data-ph=\"—\"></td></tr></tbody></table>\n</div></section>\n<footer id=\"foot\">\n<span id=\"version\" hidden></span>\n<div class=\"sign\"><label data-layout=\"footer_date\" class=\"editableLayout\" contenteditable=\"true\">Дата введения:</label> <span class=\"edit\" contenteditable=\"true\" data-key=\"introduced_at\" data-ph=\"гггг-мм-дд\"></span></div>\n<div class=\"sign\"><label data-layout=\"footer_developed\" class=\"editableLayout\" contenteditable=\"true\">Разработал:</label> <span class=\"edit\" contenteditable=\"true\" data-key=\"developed_by\"></span></div>\n<div class=\"sign\"><label data-layout=\"footer_approved\" class=\"editableLayout\" contenteditable=\"true\">Утвердил:</label> <span class=\"edit\" contenteditable=\"true\" data-key=\"approved_by\"></span></div>\n</footer>\n<svg id=\"bottomWave\" viewBox=\"0 0 794 73\" preserveAspectRatio=\"none\"><defs>\n<linearGradient id=\"seaFoot\" x1=\"0\" x2=\"1\" y1=\"1\" y2=\"0\"><stop stop-color=\"#08436d\"/><stop offset=\".55\" stop-color=\"#0ca6da\"/><stop offset=\"1\" stop-color=\"#e5f5ff\"/></linearGradient></defs>\n<path d=\"M0 0 Q64 10 118 41 Q161 63 214 73H0Z\" fill=\"#083b65\"/>\n<path d=\"M0 24 Q75 20 129 52 Q171 71 214 73H0Z\" fill=\"url(#seaFoot)\"/>\n<path d=\"M0 44 Q76 34 150 73H0Z\" fill=\"#6ecce9\" opacity=\".8\"/>\n</svg>\n";
const ARCHIVE_CSS="#paper.archive-sheet .archive-sheet-content{width:794px;height:1123px;overflow:hidden;position:relative;background:white;color:#152c45;box-shadow:0 6px 24px #20486640}#paper.archive-sheet .archive-sheet-content::before{content:\"\";position:absolute;left:0;top:0;bottom:0;width:26px;background:linear-gradient(#09294d,#0c4e7f 90%,#1385ae);z-index:0}#paper.archive-sheet .archive-sheet-content #topArtwork{position:absolute;left:0;top:0;width:794px;height:303px;pointer-events:none}#paper.archive-sheet .archive-sheet-content #brand{position:absolute;left:12px;top:12px;width:159px;text-align:center;color:white;z-index:10}#paper.archive-sheet .archive-sheet-content #brand img{display:block;width:126px;height:126px;object-fit:cover;margin:0 auto 3px;border-radius:50%;border:2px solid #e4f2fa;background:#13395c}#paper.archive-sheet .archive-sheet-content #brand .brandname{font-size:24px;font-weight:900;color:white;line-height:1.05}#paper.archive-sheet .archive-sheet-content #brand .brandname em{font-style:normal;color:#f82d41}#paper.archive-sheet .archive-sheet-content #brand .brandsub{font-size:10px;letter-spacing:1.7px;margin-top:7px}#paper.archive-sheet .archive-sheet-content #pageTitle{position:absolute;left:218px;right:16px;top:18px;line-height:1.04;color:#092d52;font-size:27.8px;font-weight:900;letter-spacing:-.7px}#paper.archive-sheet .archive-sheet-content #titleDash{position:absolute;left:219px;top:64px;background:#e92839;width:180px;height:3px}#paper.archive-sheet .archive-sheet-content #nameStrip{position:absolute;left:216px;top:75px;width:559px;height:37px;background:linear-gradient(96deg,#c4e0f6,#e9f5fe);border-radius:6px;display:flex;align-items:center;gap:8px;padding:4px 10px 4px 17px;color:#112f51;font-size:15.7px;font-weight:800}#paper.archive-sheet .archive-sheet-content #nameStrip:before{content:\"\";position:absolute;left:-8px;top:0;width:14px;height:100%;background:#e01f38;transform:skewX(-19deg)}#paper.archive-sheet .archive-sheet-content #nameStrip .namecode{width:91px;flex-shrink:0;font-size:13px;font-weight:500}#paper.archive-sheet .archive-sheet-content #nameStrip .namedish{flex:1;min-width:0;font-size:13px;font-weight:500}#paper.archive-sheet .archive-sheet-content #nameStrip .separator{opacity:.7}#paper.archive-sheet .archive-sheet-content #nameStrip .labelN{font-size:13.6px;font-weight:800;white-space:nowrap}#paper.archive-sheet .archive-sheet-content #photoBox{position:absolute;left:215px;top:125px;width:288px;height:176px;display:flex;justify-content:center;align-items:center;overflow:hidden;border:2px dashed #f0f6fcab;background:linear-gradient(138deg,#afc0cd,#d0dce5 43%,#f1f7fc 77%);border-radius:6px;cursor:pointer;z-index:2}#paper.archive-sheet .archive-sheet-content #photoBox img{width:100%;height:100%;object-fit:cover;display:none}#paper.archive-sheet .archive-sheet-content #photoBox .uploadEmpty{color:#667687;text-align:center;font-size:16px;font-weight:800;display:flex;flex-direction:column;gap:7px;align-items:center}#paper.archive-sheet .archive-sheet-content #photoBox .uploadEmpty svg{width:73px;height:73px;opacity:.6}#paper.archive-sheet .archive-sheet-content #photoBox .uploadEmpty small{font-size:11px;font-weight:400}#paper.archive-sheet .archive-sheet-content #photoBox:hover .photoTip{display:block}#paper.archive-sheet .archive-sheet-content #photoBox .photoTip{position:absolute;bottom:0;left:0;right:0;background:#073c6dcf;color:#fff;text-align:center;padding:4px;font-size:11px;display:none}#paper.archive-sheet .archive-sheet-content #factBox{position:absolute;left:507px;top:136px;width:270px;display:flex;flex-direction:column;gap:10px}#paper.archive-sheet .archive-sheet-content .fact{height:37px;display:grid;grid-template-columns:114px 1fr;background:linear-gradient(100deg,#dfedf7,#eff7fc);border-radius:5px;overflow:hidden;align-items:stretch}#paper.archive-sheet .archive-sheet-content .fact b{display:flex;align-items:center;padding:8px;background:linear-gradient(100deg,#075485,#0b3d6d);color:white;font-size:13px}#paper.archive-sheet .archive-sheet-content .fact .value{padding:6px 8px;display:flex;align-items:center;font-size:12.5px;min-width:0}#paper.archive-sheet .archive-sheet-content .fact .value input,#paper.archive-sheet .archive-sheet-content .fact .value select{min-width:0;width:100%;background:transparent;border:0;color:#173c5e;font-size:12px}#paper.archive-sheet .archive-sheet-content .card{position:absolute;border:1px solid #b5cadd;border-radius:4px;background:#fff}#paper.archive-sheet .archive-sheet-content .cardHead{height:27px;display:flex;align-items:center;padding:4px 7px 4px 23px;background:linear-gradient(95deg,#0a3d68,#0a538a);border-radius:4px 4px 2px 2px;position:relative;font-weight:900;color:#fff;font-size:12px;line-height:1.08}#paper.archive-sheet .archive-sheet-content .cardHead:before{content:\"\";position:absolute;left:5px;top:0;height:100%;width:11px;background:#e42338;transform:skewX(-16deg)}#paper.archive-sheet .archive-sheet-content .body{padding:7px 9px;line-height:1.27;font-size:10.5px;overflow:hidden}#paper.archive-sheet .archive-sheet-content .edit{outline:none;white-space:pre-wrap;overflow-wrap:anywhere;border-bottom:1px dashed transparent;cursor:text}#paper.archive-sheet .archive-sheet-content .edit:hover{border-bottom-color:#95b8d1}#paper.archive-sheet .archive-sheet-content .edit:focus{background:#fff6dd;border-bottom-color:#d38b2c}#paper.archive-sheet .archive-sheet-content .edit:empty:before{content:attr(data-ph);font-style:italic;color:#8293a6}#paper.archive-sheet .archive-sheet-content .card1{left:38px;top:302px;width:334px;height:92px}#paper.archive-sheet .archive-sheet-content .card2{left:382px;top:302px;width:395px;height:92px}#paper.archive-sheet .archive-sheet-content .card1 .body,#paper.archive-sheet .archive-sheet-content .card2 .body{height:64px}#paper.archive-sheet .archive-sheet-content .card3{left:38px;top:406px;width:395px;height:238px}#paper.archive-sheet .archive-sheet-content .card4{left:443px;top:406px;width:334px;height:238px}#paper.archive-sheet .archive-sheet-content .card5{left:38px;top:654px;width:739px;height:148px}#paper.archive-sheet .archive-sheet-content .card6{left:38px;top:812px;width:406px;height:160px}#paper.archive-sheet .archive-sheet-content .card7{left:454px;top:812px;width:323px;height:160px}#paper.archive-sheet .archive-sheet-content .card3 .body{padding:3px 5px 5px}#paper.archive-sheet .archive-sheet-content .card4 .body{height:210px;font-size:10px}#paper.archive-sheet .archive-sheet-content table{width:100%;border-collapse:collapse;table-layout:fixed}#paper.archive-sheet .archive-sheet-content #recipeTable th,#paper.archive-sheet .archive-sheet-content #recipeTable td{border:1px solid #97b7cb;padding:0 3px;height:14px;line-height:1.08;font-size:9px;vertical-align:middle}#paper.archive-sheet .archive-sheet-content #recipeTable thead th{height:27px;background:#0b4579;color:#fff;text-align:center}#paper.archive-sheet .archive-sheet-content #recipeTable th:nth-child(1){width:24px}#paper.archive-sheet .archive-sheet-content #recipeTable th:nth-child(2){width:auto}#paper.archive-sheet .archive-sheet-content #recipeTable th:nth-child(3){width:60px}#paper.archive-sheet .archive-sheet-content #recipeTable th:nth-child(4){width:60px}#paper.archive-sheet .archive-sheet-content #recipeTable th:nth-child(5){width:52px}#paper.archive-sheet .archive-sheet-content #recipeTable td:nth-child(1){text-align:center}#paper.archive-sheet .archive-sheet-content #recipeTable td:nth-child(3),#paper.archive-sheet .archive-sheet-content #recipeTable td:nth-child(4),#paper.archive-sheet .archive-sheet-content #recipeTable td:nth-child(5){text-align:right}#paper.archive-sheet .archive-sheet-content #recipeTable tr.total td{background:#d0e8f7;font-weight:bold;height:18px}#paper.archive-sheet .archive-sheet-content #recipeTable input{min-width:0;width:100%;height:15px;padding:0 1px;border:0;background:transparent;color:#183953;font-size:9px}#paper.archive-sheet .archive-sheet-content #recipeTable .number{width:100%;text-align:right}#paper.archive-sheet .archive-sheet-content #recipeTable .itemInput{font-size:9px}#paper.archive-sheet .archive-sheet-content #recipeTable .remove{display:none;position:absolute;right:0;color:#ca203c}#paper.archive-sheet .archive-sheet-content #recipeTable tr:hover .remove{display:inline}#paper.archive-sheet .archive-sheet-content #recipeTable td:nth-child(5) input{width:100%;height:15px;font-size:9px;padding:0;text-align:right;border:0;background:transparent}#paper.archive-sheet .archive-sheet-content #recipeTable td:nth-child(5) input:focus{outline:1px solid #5c9cc6}#paper.archive-sheet .archive-sheet-content table tr{position:relative}#paper.archive-sheet .archive-sheet-content .smalltools{display:flex;align-items:center;gap:8px;position:absolute;top:207px;right:5px;z-index:3;font-size:9px;color:#68829a}#paper.archive-sheet .archive-sheet-content .smalltools button{border:0;background:#dceefb;color:#0d5b97;border-radius:4px;font-size:9px;padding:2px 5px}#paper.archive-sheet .archive-sheet-content #process{height:210px;font-size:10.4px;line-height:1.28}#paper.archive-sheet .archive-sheet-content .processSteps{height:100%;display:grid;grid-template-rows:repeat(4,1fr);gap:2px}#paper.archive-sheet .archive-sheet-content .processSteps .step{display:grid;grid-template-columns:19px minmax(0,1fr);gap:3px;min-height:0;border-bottom:1px solid #d1dfea;padding:3px 2px}#paper.archive-sheet .archive-sheet-content .processSteps .step:last-child{border-bottom:0}#paper.archive-sheet .archive-sheet-content .processSteps .step b{font-size:12px;color:#18395a;padding-top:1px}#paper.archive-sheet .archive-sheet-content .processSteps .step .edit{font-size:10.1px;line-height:1.18;min-height:0;max-height:100%;overflow:hidden}#paper.archive-sheet .archive-sheet-content #f5{display:grid;grid-template-columns:2.05fr .95fr;gap:8px;height:119px;padding:7px 8px}#paper.archive-sheet .archive-sheet-content #f5 .four{display:grid;grid-template-columns:110px 1fr;grid-template-rows:repeat(4,minmax(0,1fr));gap:3px 3px;align-items:center}#paper.archive-sheet .archive-sheet-content #f5 .four label{font-size:10.1px;font-weight:bold;white-space:nowrap}#paper.archive-sheet .archive-sheet-content #f5 .four .edit{font-size:10px}#paper.archive-sheet .archive-sheet-content #allergy{border:1px solid #c4d8e7;background:#f4f9fe;border-radius:4px;overflow:hidden}#paper.archive-sheet .archive-sheet-content #allergy h3{margin:0;background:linear-gradient(90deg,#e9344d,#f5e5eb);color:#fff;padding:4px 8px;font-size:12px}#paper.archive-sheet .archive-sheet-content #allergy .edit{height:86px;padding:6px;font-size:9.7px}#paper.archive-sheet .archive-sheet-content #qualityTable td{border:1px solid #b8cad8;height:22px;padding:0 3px;font-size:10px}#paper.archive-sheet .archive-sheet-content #qualityTable td:first-child{width:109px;font-weight:700;background:#deedf9}#paper.archive-sheet .archive-sheet-content #qualityTable .edit{max-height:40px;line-height:1.08}#paper.archive-sheet .archive-sheet-content #nutritionHead{font-size:11.2px;font-weight:700;margin:9px 0}#paper.archive-sheet .archive-sheet-content #nutritionTable th,#paper.archive-sheet .archive-sheet-content #nutritionTable td{border:1px solid #adc2d2;text-align:center;padding:5px 3px;font-size:10px}#paper.archive-sheet .archive-sheet-content #nutritionTable th{background:#d8e9f6;font-weight:700;height:34px}#paper.archive-sheet .archive-sheet-content #nutritionTable td{height:29px;font-size:12px}#paper.archive-sheet .archive-sheet-content #foot{position:absolute;left:40px;right:17px;top:988px;height:80px;display:grid;grid-template-columns:1.2fr 1.45fr 1.45fr;gap:14px;align-items:start}#paper.archive-sheet .archive-sheet-content #foot>[hidden]{display:none!important}#paper.archive-sheet .archive-sheet-content .sign{padding-top:5px;font-size:11px}#paper.archive-sheet .archive-sheet-content .sign label{font-weight:700}#paper.archive-sheet .archive-sheet-content .sign .edit{display:inline-block;vertical-align:bottom;min-width:28px;min-height:17px;border-bottom:1px solid #667e92}#paper.archive-sheet .archive-sheet-content .sign small{display:block;font-size:9px;margin-top:2px;color:#647b91;text-align:right}#paper.archive-sheet .archive-sheet-content #bottomWave{position:absolute;bottom:0;left:0;width:794px;height:73px;pointer-events:none}#paper.archive-sheet .archive-sheet-content #photoInput{display:none}#paper.archive-sheet .archive-sheet-content #nutritionHint{font-size:9.5px;color:#7a5a36;margin-top:5px}#paper.archive-sheet .archive-sheet-content input:focus,#paper.archive-sheet .archive-sheet-content select:focus{outline:1px solid #3d91ca;background:#fff9e7!important}#paper.archive-sheet .archive-sheet-content #overflowInfo{display:none}\n\n\n\n#paper.archive-sheet .archive-sheet-content{transition:background-color .14s}\n#paper.archive-sheet .archive-sheet-content[data-template] .card, #paper.archive-sheet .archive-sheet-content[data-template] .fact, #paper.archive-sheet .archive-sheet-content[data-template] #photoBox{box-shadow:none}\n#paper.archive-sheet .archive-sheet-content[data-template] .cardHead{color:#fff;overflow:hidden}\n#paper.archive-sheet .archive-sheet-content[data-template] .cardHead::before{background:var(--ttk-red)}\n#paper.archive-sheet .archive-sheet-content[data-template] #photoBox{border:1px solid #bdd6e5;box-shadow:0 4px 13px #0b34512c}\n#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable .itemInput{font-size:9px!important}\n#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable tbody tr{height:15px}\n#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable tbody td{height:15px;max-height:15px}\n#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable tr.total td{height:18px}\n#paper.archive-sheet .archive-sheet-content[data-template] .smalltools{top:208px;right:6px;padding:1px 2px;background:#f7fbfdea;border-radius:3px}\n#paper.archive-sheet .archive-sheet-content[data-template] .card3 .body{padding:3px 5px 3px}\n#paper.archive-sheet .archive-sheet-content[data-template] .card1 .body,#paper.archive-sheet .archive-sheet-content[data-template] .card2 .body{height:calc(100% - 27px)}\n#paper.archive-sheet .archive-sheet-content[data-template] .card4 #process{height:calc(100% - 27px);padding:5px 7px}\n#paper.archive-sheet .archive-sheet-content[data-template] .processSteps .step{padding:2px 1px;gap:2px}\n#paper.archive-sheet .archive-sheet-content[data-template] .processSteps .edit{font-size:10px}\n\n#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable .itemInput:focus{position:relative;z-index:10;background:#fffef3}\n#paper.archive-sheet .archive-sheet-content[data-template] .fact .value{line-height:1.1}\n#paper.archive-sheet .archive-sheet-content[data-template] #brand img{object-fit:contain}\n#paper.archive-sheet .archive-sheet-content[data-template] .card6 table,#paper.archive-sheet .archive-sheet-content[data-template] .card7 table{width:100%}\n#paper.archive-sheet .archive-sheet-content[data-template] #nutritionTable th{overflow-wrap:anywhere;font-size:9.8px;line-height:1.13}\n#paper.archive-sheet .archive-sheet-content[data-template] #qualityTable td{font-size:9.7px}\n#paper.archive-sheet .archive-sheet-content[data-template] .card5 .cardHead{font-size:11.5px}\n#paper.archive-sheet .archive-sheet-content[data-template] #foot{top:990px;height:74px;z-index:4}\n#paper.archive-sheet .archive-sheet-content[data-template] #bottomWave{opacity:.8}\n\n/* 1 · Фирменная классика — elegant blue brand ribbon and crimson slash. */\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-01\"]::before{\n width:30px;background:linear-gradient(180deg,var(--ttk-navy),var(--ttk-blue) 68%,#118bca)\n}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-01\"] #brand{top:12px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-01\"] .cardHead{background:linear-gradient(90deg,var(--ttk-navy),var(--ttk-blue))}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-01\"] #photoBox{border-radius:10px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-01\"] #bottomWave{opacity:.92}\n\n/* 2 · Ледяной А4 PRO — horizontal brand masthead, larger food shot. */\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"]{background:linear-gradient(var(--ttk-paper) 0,var(--ttk-paper) 78%,#e7f5fc 100%)!important}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"]::before{\n top:0;left:0;right:0;bottom:auto;width:100%;height:79px;\n background:linear-gradient(108deg,var(--ttk-navy),var(--ttk-blue) 77%,#207ca9)\n}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] #topArtwork{display:none}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] #brand{left:22px;top:7px;width:230px;height:62px;display:flex;align-items:center;gap:11px;text-align:left}\n #paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] #brand img{flex:0 0 auto;border-width:1px;margin:0}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] #brand .brandname{font-size:17px;line-height:1.05;margin-top:-10px;white-space:nowrap}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] #brand .brandsub{position:absolute;left:71px;top:38px;font-size:7.6px;letter-spacing:1px;white-space:nowrap}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] #pageTitle{left:260px;top:21px;right:20px;color:#fff;font-size:24.5px;line-height:1.1}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] #titleDash{left:258px;top:56px;width:160px;height:3px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] #nameStrip{left:24px;top:91px;width:746px;height:39px;background:linear-gradient(95deg,#cfecfc,#f3faff);box-shadow:inset 0 0 0 1px #c5ddec}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] #photoBox{left:24px;top:142px;width:439px;height:154px;border-radius:9px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] #factBox{left:476px;top:150px;width:294px;gap:9px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] .fact{height:40px;grid-template-columns:120px 1fr;background:#e5f3fd;border-radius:8px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] .card{border-color:#a9d2e5;border-radius:9px;background:#f9fdff}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] .cardHead{background:linear-gradient(90deg,var(--ttk-blue),#2787b7);border-radius:8px 8px 0 0}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] .card1{left:24px;top:307px;width:363px;height:91px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] .card2{left:398px;top:307px;width:372px;height:91px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] .card3{left:24px;top:410px;width:418px;height:240px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] .card4{left:453px;top:410px;width:317px;height:240px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] .card5{left:24px;top:661px;width:746px;height:148px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] .card6{left:24px;top:819px;width:418px;height:160px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] .card7{left:453px;top:819px;width:317px;height:160px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] #foot{left:30px;right:25px;top:992px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] #bottomWave{opacity:.30;filter:saturate(.7)}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] #allergy{background:#edf8ff}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] #recipeTable thead th{background:#135989}\n\n/* 4 · Северное сияние — arctic upper and lower ocean silhouettes. */\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"]{\n background:linear-gradient(180deg,#eefaff 0%,var(--ttk-paper) 27%,var(--ttk-paper) 88%,#e0f5fd 100%)!important\n}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"]::before{\n content:\"\";top:0;bottom:auto;left:0;right:0;width:100%;height:145px;\n background:\n linear-gradient(170deg,transparent 78%,#ecf8fe 78.3%,transparent 82%),\n linear-gradient(140deg,rgba(145,215,239,.3) 70%,transparent 70.2%),\n linear-gradient(110deg,var(--ttk-navy) 0%,var(--ttk-blue) 65%,#3296c3);\n}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] #topArtwork{display:none}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"]::after{\n content:\"\";pointer-events:none;position:absolute;left:0;right:0;bottom:0;height:86px;z-index:0;\n background:\n linear-gradient(161deg,transparent 62%,#c7edfa 62.3%,transparent 80%),\n linear-gradient(8deg,#c3eafa 0%,transparent 65%);\n}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] #brand{left:12px;top:8px;width:179px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] #brand img{object-fit:contain}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] #brand .brandname{font-size:22px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] #brand .brandsub{font-size:8px;margin-top:4px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] #pageTitle{left:212px;top:26px;right:18px;font-size:29px;color:white}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] #titleDash{left:211px;top:72px;width:220px;background:#ec273e}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] #nameStrip{left:210px;top:88px;width:564px;height:38px;background:linear-gradient(97deg,#d1f2ff,#f4fbff);box-shadow:0 2px 9px #0c456033}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] #photoBox{left:31px;top:158px;width:422px;height:150px;border-radius:11px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] #factBox{left:465px;top:164px;width:306px;gap:8px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] .fact{height:42px;background:#edfaff;border:1px solid #b6d9eb;border-radius:8px;grid-template-columns:124px 1fr}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] .card{background:#fff;border:1px solid #a6d1e7;border-radius:8px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] .cardHead{background:linear-gradient(90deg,var(--ttk-blue),#35a0cb);border-radius:7px 7px 0 0}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] .card1{left:30px;top:323px;width:365px;height:89px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] .card2{left:406px;top:323px;width:365px;height:89px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] .card3{left:30px;top:423px;width:420px;height:230px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] .card4{left:461px;top:423px;width:310px;height:230px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] .card5{left:30px;top:665px;width:741px;height:147px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] .card6{left:30px;top:822px;width:420px;height:155px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] .card7{left:461px;top:822px;width:310px;height:155px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] #foot{left:40px;right:24px;top:991px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] #bottomWave{opacity:.7}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] #recipeTable thead th{background:#1676a2}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] #allergy{background:#f3fcff}\n\n/* 5 · Морской флагман — strong navy vertical ribbon and polished geometric panels. */\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"]{background:linear-gradient(90deg,#f2f8fc 0%,var(--ttk-paper) 18%,var(--ttk-paper) 100%)!important}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"]::before{\n top:0;left:0;bottom:0;width:46px;\n background:\n repeating-linear-gradient(152deg,transparent 0,transparent 44px,#2b80b43d 45px,#2b80b43d 47px,transparent 48px,transparent 77px),\n linear-gradient(180deg,var(--ttk-navy),var(--ttk-blue) 65%,#0d3558)\n}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] #topArtwork{display:none}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] #brand{left:50px;top:16px;width:150px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] #brand img{object-fit:contain}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] #brand .brandname{font-size:22px;color:var(--ttk-navy)}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] #brand .brandsub{color:#1d5f90;font-size:8px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] #pageTitle{left:218px;top:23px;right:20px;font-size:27px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] #titleDash{left:220px;top:65px;width:180px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] #nameStrip{left:217px;top:84px;width:554px;height:38px;background:linear-gradient(99deg,#bedcf2,#f3f9fd)}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] #photoBox{left:202px;top:139px;width:354px;height:156px;border-radius:10px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] #factBox{left:567px;top:143px;width:204px;gap:7px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .fact{height:44px;grid-template-columns:88px 1fr;border:1px solid #c2d8e7}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .fact b{font-size:11px;padding:5px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .fact .value{font-size:10.6px;padding:5px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .fact .value input,#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .fact .value select{font-size:10px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .card{border-radius:5px;border:1px solid #b3cadf;background:#fff}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .cardHead{background:linear-gradient(90deg,var(--ttk-navy),#174d80);font-size:11.6px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .card1{left:57px;top:308px;width:343px;height:92px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .card2{left:412px;top:308px;width:360px;height:92px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .card3{left:57px;top:412px;width:395px;height:238px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .card4{left:463px;top:412px;width:309px;height:238px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .card5{left:57px;top:661px;width:715px;height:147px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .card6{left:57px;top:819px;width:395px;height:159px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .card7{left:463px;top:819px;width:309px;height:159px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] #foot{left:61px;right:25px;top:991px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] #bottomWave{opacity:.40}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] #recipeTable thead th{background:#103960}\n\n/* Editing tools stay outside printed page. */\n@media print{\n #templateGallery,#designPanel,#templatePicker,#templateOpen{display:none!important}\n #paper.archive-sheet .archive-sheet-content[data-template] .smalltools{display:none!important}\n #paper.archive-sheet .archive-sheet-content[data-template] .card{break-inside:avoid}\n #paper.archive-sheet .archive-sheet-content[data-template] #recipeTable .itemInput{\n   text-overflow:clip!important;overflow:hidden!important\n }\n}\n@media(max-width:860px){\n #templateGallery .templates{grid-template-columns:repeat(2,minmax(0,1fr))}\n #templateGallery{padding:8px}\n #templateGallery .galleryInner{padding:12px}\n #templateGallery h2{font-size:18px}\n}\n@media(max-width:430px){#templateGallery .templates{grid-template-columns:1fr 1fr;gap:8px}}\n\n\n/* No visual frame around product photo: true transparent PNG/WebP appears on page. */\n#paper.archive-sheet .archive-sheet-content #photoBox, #paper.archive-sheet .archive-sheet-content[data-template] #photoBox{\n border:0!important;outline:0!important;box-shadow:none!important;\n border-radius:0!important;isolation:isolate;overflow:hidden;\n}\n#paper.archive-sheet .archive-sheet-content #photoBox::before, #paper.archive-sheet .archive-sheet-content #photoBox::after,\n#paper.archive-sheet .archive-sheet-content[data-template] #photoBox::before, #paper.archive-sheet .archive-sheet-content[data-template] #photoBox::after{\n display:none!important;content:none!important;\n}\n#paper.archive-sheet .archive-sheet-content #dishPhoto, #paper.archive-sheet .archive-sheet-content[data-template] #dishPhoto{\n display:none;object-fit:contain;padding:0!important;\n border:0!important;outline:0!important;background:transparent!important;\n}\n#paper.archive-sheet .archive-sheet-content #photoBox.photo-has-image .photoTip{\n display:none!important;\n}\n@media print{\n #paper.archive-sheet .archive-sheet-content #photoBox,#paper.archive-sheet .archive-sheet-content[data-template] #photoBox{\n  border:0!important;box-shadow:none!important;background-clip:border-box;\n }\n #paper.archive-sheet .archive-sheet-content #dishPhoto,#paper.archive-sheet .archive-sheet-content[data-template] #dishPhoto{\n  padding:0!important;border:0!important;\n }\n}\n\n/* TTK PRINT-FINISH 2026-11-10\n   Let each approved A4 variation use the printable page height.\n   Keep signature and approval fields on the same single sheet. */\n#toolbar .workflowStatus{display:inline-flex;align-items:center;gap:5px;font-size:12px;white-space:nowrap}\n#toolbar .workflowStatus select{max-width:120px;padding:8px 6px}\n#paper.archive-sheet .archive-sheet-content[data-template] #factBox{gap:12px}\n#paper.archive-sheet .archive-sheet-content[data-template] .yieldInline{display:inline-flex;align-items:center;justify-content:flex-start;gap:2px;white-space:nowrap;max-width:100%}\n#paper.archive-sheet .archive-sheet-content[data-template] #autoYield{width:7.2ch;min-width:0;max-width:90px;flex:0 0 auto!important;padding:0!important;margin:0!important;border:0!important;appearance:textfield;-moz-appearance:textfield;font-size:13px!important;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.2}\n#paper.archive-sheet .archive-sheet-content[data-template] #autoYield::-webkit-outer-spin-button,#paper.archive-sheet .archive-sheet-content[data-template] #autoYield::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}\n#paper.archive-sheet .archive-sheet-content[data-template] .unitG{display:inline-block;flex:0 0 auto;font-size:13px;font-weight:800;line-height:1.2}\n#paper.archive-sheet .archive-sheet-content[data-template] #f5{height:calc(100% - 27px);min-height:0}\n#paper.archive-sheet .archive-sheet-content[data-template] #allergy .edit{height:calc(100% - 22px);overflow:hidden}\n#paper.archive-sheet .archive-sheet-content[data-template] .card6 .body{height:calc(100% - 27px);min-height:0}\n#paper.archive-sheet .archive-sheet-content[data-template] #qualityTable{height:100%}\n#paper.archive-sheet .archive-sheet-content[data-template] #qualityTable td{height:auto;line-height:1.17}\n#paper.archive-sheet .archive-sheet-content[data-template] .card7 .body{height:calc(100% - 27px);display:flex;flex-direction:column;justify-content:center}\n#paper.archive-sheet .archive-sheet-content[data-template] #nutritionTable th{height:39px}\n#paper.archive-sheet .archive-sheet-content[data-template] #nutritionTable td{height:35px}\n#paper.archive-sheet .archive-sheet-content[data-template] #nutritionHead{margin:4px 0 10px}\n#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable tbody tr{height:16px}\n#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable tbody td{height:16px;max-height:16px}\n#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable .itemInput{height:14px;line-height:14px}\n#paper.archive-sheet .archive-sheet-content[data-template] #foot{\n top:1041px;height:67px;\n display:grid;grid-template-columns:1fr 1fr;grid-template-rows:23px 38px;\n column-gap:23px;row-gap:6px;align-items:start;z-index:5;\n}\n#paper.archive-sheet .archive-sheet-content[data-template] #foot .sign{display:flex;align-items:baseline;gap:7px;min-width:0;padding-top:0;font-size:12px;white-space:nowrap}\n#paper.archive-sheet .archive-sheet-content[data-template] #foot .sign:first-of-type{grid-column:1 / -1}\n#paper.archive-sheet .archive-sheet-content[data-template] #foot .sign label{flex:0 0 auto;font-weight:800}\n#paper.archive-sheet .archive-sheet-content[data-template] #foot .sign .edit{display:inline-block;min-height:25px;min-width:135px;flex:1 1 auto;padding:1px 2px 3px;border-bottom:1px solid #4b6e88;outline:0}\n#paper.archive-sheet .archive-sheet-content[data-template] #foot .sign:first-of-type .edit{flex:0 0 240px;min-width:210px}\n#paper.archive-sheet .archive-sheet-content[data-template] #bottomWave{height:31px;opacity:.34;z-index:0}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-01\"] .card1,#paper.archive-sheet .archive-sheet-content[data-template=\"a4-01\"] .card2{height:100px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-01\"] .card3,#paper.archive-sheet .archive-sheet-content[data-template=\"a4-01\"] .card4{top:413px;height:250px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-01\"] .card5{top:674px;height:159px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-01\"] .card6,#paper.archive-sheet .archive-sheet-content[data-template=\"a4-01\"] .card7{top:845px;height:187px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] .card1,#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] .card2{height:99px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] .card3,#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] .card4{top:417px;height:249px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] .card5{top:677px;height:159px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] .card6,#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] .card7{top:848px;height:184px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] .card1,#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] .card2{height:96px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] .card3,#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] .card4{top:430px;height:238px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] .card5{top:679px;height:157px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] .card6,#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] .card7{top:848px;height:184px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .card1,#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .card2{height:99px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .card3,#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .card4{top:419px;height:247px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .card5{top:677px;height:158px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .card6,#paper.archive-sheet .archive-sheet-content[data-template=\"a4-05\"] .card7{top:847px;height:185px}\n@media print{\n #paper.archive-sheet .archive-sheet-content[data-template] #foot .sign .edit{background:transparent!important}\n #toolbar .workflowStatus{display:none!important}\n #paper.archive-sheet .archive-sheet-content[data-template] #bottomWave{opacity:.25!important}\n}\n\n#paper.archive-sheet{width:794px;height:1123px;padding:0;display:block;background:white;color:#152c45;font-family:Arial,sans-serif;overflow:hidden}\n#paper.archive-sheet .archive-sheet-content{position:relative;display:block;width:794px;height:1123px;padding:0;margin:0;--ttk-navy:#082a4b;--ttk-blue:#0c5790;--ttk-red:#e72339;--ttk-paper:#fff;font-family:Arial,sans-serif}\n#paper.archive-sheet *{box-sizing:border-box}\n#paper.archive-sheet .card{margin:0;box-shadow:none}\n#paper.archive-sheet #photoBox{border:0!important;background:transparent!important;box-shadow:none!important}\n#paper.archive-sheet #photoBox img{object-fit:contain!important;background:transparent}\n#paper.archive-sheet #brand{cursor:pointer}\n#paper.archive-sheet .sheet-edit{font:inherit;color:inherit;padding:0;min-height:0;line-height:inherit;border:0;background:transparent;border-radius:0}\n#paper.archive-sheet .sheet-row-actions{white-space:nowrap}\n#paper.archive-sheet .sheet-row-actions button{font:9px Arial;padding:0 2px;border:0;background:transparent;color:#075485}\n#paper.archive-sheet #recipeTable th:last-child{width:48px}\n#paper.archive-sheet .smalltools{top:auto!important;bottom:5px}\n#paper.archive-sheet .edit{min-width:0}\n#paper.archive-sheet .archive-nutrition-legacy{font-size:10px;margin-top:8px;white-space:pre-wrap}\n@media print{#paper.archive-sheet{width:210mm!important;height:297mm!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}#paper.archive-sheet .smalltools,#paper.archive-sheet .photoTip,#paper.archive-sheet .uploadEmpty{display:none!important}}\n\n#paper.archive-sheet #recipeTable .sheet-row-actions button{min-width:12px;width:12px;min-height:14px;height:14px;padding:0;margin:0;font:9px Arial}\n#paper.archive-sheet .card3 .body{height:calc(100% - 27px)}\n#paper.archive-sheet #recipeTable .sheet-item-name>.sheet-edit{min-height:14px}\n@media print{#paper.archive-sheet .edit:empty:before{content:\"\"!important}}\n\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-02\"] #brand img{width:58px;height:58px}\n#paper.archive-sheet .archive-sheet-content[data-template=\"a4-04\"] #brand img{width:96px;height:96px}\n\n\n#paper.archive-sheet .archive-sheet-content[data-template]{--lux-edge:#6b98b2;--lux-head:#003664;background:transparent!important;color:#092944}\n#paper.archive-sheet .archive-sheet-content[data-template]::before,#paper.archive-sheet .archive-sheet-content[data-template]::after,#paper.archive-sheet .archive-sheet-content[data-template] #topArtwork,#paper.archive-sheet .archive-sheet-content[data-template] #bottomWave{display:none!important}\n#paper.archive-sheet .archive-sheet-content[data-template] .lux-background{position:absolute;inset:0;width:794px;height:1123px;z-index:0;pointer-events:none}\n#paper.archive-sheet .archive-sheet-content[data-template] #brand{left:20px;top:19px;width:124px;height:150px;display:block;text-align:center}\n#paper.archive-sheet .archive-sheet-content[data-template] #brand img{width:91px;height:91px;object-fit:contain;margin:0 auto 7px;border:1px solid #dcefff;border-radius:50%;background:#0c3556}\n#paper.archive-sheet .archive-sheet-content[data-template] #brand .brandname{font-size:22px;line-height:1.04;white-space:normal;color:#fff;margin:0!important}\n#paper.archive-sheet .archive-sheet-content[data-template] #brand .brandname em{color:inherit}\n#paper.archive-sheet .archive-sheet-content[data-template] #brand .brandsub{display:none}\n#paper.archive-sheet .archive-sheet-content[data-template] #pageTitle{left:235px;top:38px;right:24px;color:#061e37;font-size:23px;line-height:1.08;font-weight:800;letter-spacing:-.8px}\n#paper.archive-sheet .archive-sheet-content[data-template] #titleDash{display:none}\n#paper.archive-sheet .archive-sheet-content[data-template] #nameStrip{left:222px;top:92px;width:548px;height:43px;display:flex;padding:5px 12px;gap:13px;background:linear-gradient(100deg,#d2eafa9c,#a5cce1a6);color:#08243b;border-radius:9px;box-shadow:inset 0 1px #ffffffaa}\n#paper.archive-sheet .archive-sheet-content[data-template] #nameStrip:before,#paper.archive-sheet .archive-sheet-content[data-template] #nameStrip .labelN{display:none}\n#paper.archive-sheet .archive-sheet-content[data-template] #nameStrip .namecode{width:108px;font-size:14px;font-weight:600}\n#paper.archive-sheet .archive-sheet-content[data-template] #nameStrip .namedish{font-size:22px;font-weight:800;line-height:1.1;max-height:48px;overflow:hidden}\n#paper.archive-sheet .archive-sheet-content[data-template] #nameStrip .separator{font-size:0;width:1px;height:26px;background:#8cb1c9}\n#paper.archive-sheet .archive-sheet-content[data-template] #photoBox{left:82px;top:150px;width:432px;height:157px;border:0!important;border-radius:0;background:transparent!important;box-shadow:none!important}\n#paper.archive-sheet .archive-sheet-content[data-template] #photoBox img{object-fit:contain!important;filter:drop-shadow(0 5px 5px #193d5120)}\n#paper.archive-sheet .archive-sheet-content[data-template] #photoPlaceholder{font-size:12px;color:#5c8096}\n#paper.archive-sheet .archive-sheet-content[data-template] #photoPlaceholder svg{width:50px;height:50px;opacity:.3}\n#paper.archive-sheet .archive-sheet-content[data-template] #factBox{left:548px;top:181px;width:222px;gap:11px}\n#paper.archive-sheet .archive-sheet-content[data-template] .fact{height:38px;border:1px solid #9fbdd2;border-radius:8px;background:linear-gradient(#f9fdffcc,#c4e0f2b0);grid-template-columns:85px 1fr;box-shadow:inset 0 1px white}\n#paper.archive-sheet .archive-sheet-content[data-template] .fact b{background:transparent;color:#15354d;font-size:10px;padding:7px}\n#paper.archive-sheet .archive-sheet-content[data-template] .fact .value,#paper.archive-sheet .archive-sheet-content[data-template] .fact .value input{font-size:12px;color:#092b43;font-weight:700}\n#paper.archive-sheet .archive-sheet-content[data-template] .card{border:1px solid var(--lux-edge);border-radius:9px;background:#f2f9ff82;box-shadow:inset 0 1px white,0 3px 4px #12375220;overflow:hidden}\n#paper.archive-sheet .archive-sheet-content[data-template] .cardHead{height:29px;border-radius:8px 8px 4px 4px;padding:6px 10px;background:linear-gradient(175deg,#759bb8 0%,#174d76 18%,var(--lux-head) 70%,#002a50);color:#fff;border:1px solid #e8f5ff88;box-shadow:0 1px 2px #133b5b55;font-size:11px;font-weight:700;letter-spacing:0;line-height:1.1}\n#paper.archive-sheet .archive-sheet-content[data-template] .cardHead:before{display:none}\n#paper.archive-sheet .archive-sheet-content[data-template] .card1{left:30px;top:316px;width:364px;height:100px}\n#paper.archive-sheet .archive-sheet-content[data-template] .card2{left:405px;top:316px;width:365px;height:100px}\n#paper.archive-sheet .archive-sheet-content[data-template] .card3{left:30px;top:429px;width:374px;height:228px}\n#paper.archive-sheet .archive-sheet-content[data-template] .card4{left:416px;top:429px;width:354px;height:228px}\n#paper.archive-sheet .archive-sheet-content[data-template] .card5{left:30px;top:671px;width:740px;height:143px}\n#paper.archive-sheet .archive-sheet-content[data-template] .card6{left:30px;top:829px;width:402px;height:148px}\n#paper.archive-sheet .archive-sheet-content[data-template] .card7{left:444px;top:829px;width:326px;height:148px}\n#paper.archive-sheet .archive-sheet-content[data-template] .card1 .body,#paper.archive-sheet .archive-sheet-content[data-template] .card2 .body,#paper.archive-sheet .archive-sheet-content[data-template] .card3 .body,#paper.archive-sheet .archive-sheet-content[data-template] .card4 #process,#paper.archive-sheet .archive-sheet-content[data-template] .card6 .body,#paper.archive-sheet .archive-sheet-content[data-template] .card7 .body{height:calc(100% - 29px)}\n#paper.archive-sheet .archive-sheet-content[data-template] .body{font-size:10px;line-height:1.2;padding:7px 9px}\n#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable th,#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable td{border-color:#8baabe;font-size:9.5px}\n#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable th{background:linear-gradient(#e6f5ff,#c3daeb);color:#092b43;font-weight:700;height:25px}\n#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable tbody tr:nth-child(even){background:#d1e8f455}\n#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable tbody td{height:20px}\n#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable .sheet-edit{font-size:10px}\n#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable .total td{background:#c5dfeeb0}\n#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable th:nth-child(3),#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable th:nth-child(4){width:57px}\n#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable th:last-child{width:42px}\n#paper.archive-sheet .archive-sheet-content[data-template] .smalltools{bottom:3px;top:auto!important;font-size:8px;background:transparent}\n#paper.archive-sheet .archive-sheet-content[data-template] .smalltools button{padding:2px 4px;font-size:9px}\n#paper.archive-sheet .archive-sheet-content[data-template] #f5{height:calc(100% - 29px);grid-template-columns:2.2fr 1fr;gap:8px;padding:6px 8px}\n#paper.archive-sheet .archive-sheet-content[data-template] #f5 .four{grid-template-columns:112px 1fr}\n#paper.archive-sheet .archive-sheet-content[data-template] #f5 .four label{font-size:9px}\n#paper.archive-sheet .archive-sheet-content[data-template] #allergy{background:#e7f2f980;border-color:#96b5ca;border-radius:6px}\n#paper.archive-sheet .archive-sheet-content[data-template] #allergy h3{background:linear-gradient(#ecf8ff,#c0d8ea);color:#153651;font-size:10px;letter-spacing:.5px}\n#paper.archive-sheet .archive-sheet-content[data-template] #allergy .edit{height:76px}\n#paper.archive-sheet .archive-sheet-content[data-template] #qualityTable td{background:transparent;border-color:#9cb5c9;font-size:9px}\n#paper.archive-sheet .archive-sheet-content[data-template] #qualityTable td:first-child{background:#d7e9f580}\n#paper.archive-sheet .archive-sheet-content[data-template] #nutritionHead{font-size:9px;margin:2px 0 5px}\n#paper.archive-sheet .archive-sheet-content[data-template] #nutritionTable th{background:#d7e9f580;border-color:#9cb5c9;font-size:8px;height:27px}\n#paper.archive-sheet .archive-sheet-content[data-template] #nutritionTable td{border-color:#9cb5c9;font-size:11px;height:25px}\n#paper.archive-sheet .archive-sheet-content[data-template] #foot{left:31px;right:26px;top:988px;height:76px;display:flex;flex-direction:column;gap:4px;z-index:2}\n#paper.archive-sheet .archive-sheet-content[data-template] #foot .sign{width:100%;font-size:10px;min-height:20px;display:flex;align-items:baseline;gap:8px;padding:0}\n#paper.archive-sheet .archive-sheet-content[data-template] #foot .sign label{min-width:72px}\n#paper.archive-sheet .archive-sheet-content[data-template] #foot .sign .edit{flex:1;min-height:19px;border-bottom:1px solid #547a92;max-width:520px}\n#paper.archive-sheet .archive-sheet-content[data-template] #foot .sign:first-of-type .edit{flex:0 0 210px}\n#paper.archive-sheet .archive-sheet-content[data-template][data-template=\"a4-02\"]{--lux-edge:#6da4c1;--lux-head:#004775}\n#paper.archive-sheet .archive-sheet-content[data-template][data-template=\"a4-04\"]{--lux-edge:#af9361;--lux-head:#052438}\n#paper.archive-sheet .archive-sheet-content[data-template][data-template=\"a4-04\"] .card{background:#fffdf880}\n#paper.archive-sheet .archive-sheet-content[data-template][data-template=\"a4-04\"] .cardHead{background:linear-gradient(175deg,#37516b,#052438 60%);border-color:#bfa269}\n#paper.archive-sheet .archive-sheet-content[data-template][data-template=\"a4-04\"] #nameStrip{background:linear-gradient(100deg,#eceeedc9,#bfcbd5aa)}\n#paper.archive-sheet .archive-sheet-content[data-template][data-template=\"a4-04\"] #allergy h3,#paper.archive-sheet .archive-sheet-content[data-template][data-template=\"a4-04\"] #nutritionTable th,#paper.archive-sheet .archive-sheet-content[data-template][data-template=\"a4-04\"] #qualityTable td:first-child,#paper.archive-sheet .archive-sheet-content[data-template][data-template=\"a4-04\"] #recipeTable th{background:#e3e6e8a0}\n@page{size:A4 portrait;margin:0}\n@media print{#paper.archive-sheet{width:210mm!important;height:297mm!important;overflow:hidden!important;break-after:avoid;page-break-after:avoid}#paper.archive-sheet .archive-sheet-content[data-template]{width:210mm!important;height:297mm!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}#paper.archive-sheet .archive-sheet-content[data-template] .lux-background{width:100%;height:100%}#paper.archive-sheet .archive-sheet-content[data-template] .edit:empty:before{content:''!important}#paper.archive-sheet .archive-sheet-content[data-template] .card{box-shadow:none}#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable .sheet-screen-only{display:none!important}#paper.archive-sheet .archive-sheet-content[data-template] #recipeTable th:nth-child(2){width:auto}}\n";
const archiveStyle=document.createElement('style');archiveStyle.textContent=ARCHIVE_CSS;document.head.append(archiveStyle);
const SB='https://mhsmmssipligbmvfzkce.supabase.co';
const KEY='sb_publishable_JKA5HzoGDIkLxBnctT27hw_TBIqnoc0';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>v===''||v==null?null:(Number.isFinite(Number(v))?Number(v):null);
const fmt=v=>Number(v||0).toLocaleString('ru-RU',{maximumFractionDigits:2});
const clone=x=>JSON.parse(JSON.stringify(x));
const dateRu=v=>v?new Date(v).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}):'—';
let session=null,projects=[],docs=[],prefs={studio_name:'FARUKH TTK PRO',title:'Студия технико-технологических карт',chef_name:''};
let currentView='dashboard',editorTab='main',draft=null,dirty=false,workingId=null,modalProjectId=null,modalLogo=null,pendingCreate=false,copySourceId=null,busy=false,toastTimer;
const templates=[
{id:'atelier',name:'Фирменный LUX',sub:'Синий · красный · вода',desc:'Цветной фотолист с фирменной лентой и волной.'},
{id:'classic',name:'ARCTIC PRO',sub:'Сапфир · лёд · серебро',desc:'Ледяная фактура и кристаллы по краям листа.'},
{id:'arctic',name:'DEEP BLUE',sub:'Тёмно-синий · золото',desc:'Жемчужный лист, золотая лента и морские блики.'}
];
const iconPaths={
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3z"/>',
 book:'<path d="M4 4h15v17H6a2 2 0 0 1 0-4h13"/><path d="M6 4v13"/>',
 edit:'<path d="M12 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="m16 5 3 3m-9 6 3-.6L21 5l-3-3-8 8z"/>',
 layers:'<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 save:'<path d="M4 3h14l3 3v15H3V3z"/><path d="M7 3v7h10V3M7 21v-9h10v9"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
 print:'<path d="M7 9V3h10v6M7 18H4V9h16v9h-3"/><path d="M7 14h10v7H7z"/>',
 list:'<path d="M9 5h12M9 12h12M9 19h12"/><circle cx="4" cy="5" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="19" r="1"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/>',
 left:'<path d="m14 5-7 7 7 7M7 12h14"/>',
 upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 star:'<path d="m12 2 3.3 6.7 7.4 1.1-5.3 5.2 1.2 7.3L12 18.9 5.4 22.3l1.3-7.3-5.3-5.2 7.3-1.1z"/>',
 trash:'<path d="M4 7h16M10 4h4m-7 3 1 13h8l1-13M10 11v6m4-6v6"/>',
 archive:'<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v12h14V9M10 14h4"/>'
};
function icon(name){const p=iconPaths[name]||iconPaths.grid;return '<span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24">'+p+'</svg></span>'}
function paintIcons(){document.querySelectorAll('[data-icon]').forEach(el=>{const name=el.getAttribute('data-icon');el.innerHTML='<svg viewBox="0 0 24 24">'+(iconPaths[name]||'')+'</svg>';el.removeAttribute('data-icon')})}
function tell(message,error=false){const el=$('toast');el.textContent=message;el.className='toast'+(error?' error':'');el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true},4800)}
function setBusy(flag){busy=flag;['saveDoc','projectSaveButton','loginButton'].forEach(id=>{const el=$(id);if(el)el.disabled=flag})}
function errText(e){return String(e?.message||e||'Неизвестная ошибка')}
async function api(path,opts={}){
 const headers={apikey:KEY,...opts.headers};
 if(opts.body!=null)headers['Content-Type']='application/json';
 if(session?.access_token)headers.Authorization='Bearer '+session.access_token;
 const res=await fetch(SB+path,{method:opts.method||'GET',headers,body:opts.body!=null?JSON.stringify(opts.body):undefined});
 const raw=await res.text();let data;
 try{data=raw?JSON.parse(raw):null}catch{data=raw}
 if(!res.ok)throw Error(data?.message||data?.msg||data?.error_description||data?.error||('Сервер вернул '+res.status));
 return data;
}
function storedSession(){try{return JSON.parse(localStorage.getItem('ms_session')||'null')}catch{return null}}
function persist(){if(session)localStorage.setItem('ms_session',JSON.stringify(session));else localStorage.removeItem('ms_session')}
async function freshSession(){
 if(!session)return false;
 if(session.expires_at&&session.expires_at>Math.floor(Date.now()/1000)+100)return true;
 if(!session.refresh_token)return false;
 try{session=await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});persist();return !!session.access_token}
 catch{return false}
}
async function signIn(ev){ev.preventDefault();if(busy)return;
 const email=$('loginEmail').value.trim(),password=$('loginPassword').value;
 if(!email||password.length<8){$('authError').textContent='Укажите электронную почту и пароль не менее 8 символов.';return}
 setBusy(true);$('authError').textContent='';
 try{session=await api('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
  persist();await enter();
 }catch(e){$('authError').textContent='Не удалось войти: '+errText(e)}
 finally{setBusy(false)}
}
async function signOut(){
 if(dirty&&!confirm('Выйти без сохранения изменений ТТК?'))return;
 try{await api('/auth/v1/logout',{method:'POST'})}catch{}
 session=null;persist();projects=[];docs=[];draft=null;dirty=false;
 $('shell').hidden=true;$('auth').hidden=false;$('loginPassword').value='';$('authError').textContent='';window.scrollTo(0,0);
}
async function loadAll(){
 const [p,d,pref]=await Promise.all([
  api('/rest/v1/ttk_projects?select=*&order=updated_at.desc&limit=1000'),
  api('/rest/v1/ttk_documents?select=*&order=updated_at.desc&limit=2000'),
  api('/rest/v1/ttk_preferences?select=*&limit=1')
 ]);
 projects=Array.isArray(p)?p:[];docs=Array.isArray(d)?d:[];
 prefs=Array.isArray(pref)&&pref[0]?pref[0]:{studio_name:'FARUKH TTK PRO',title:'Студия технико-технологических карт',chef_name:'',auto_presets:{}};
 renderAll();window.FARUKH_TTK_AUTO?.onReady();
}
async function enter(){
 $('auth').hidden=true;$('shell').hidden=false;
 $('sideEmail').textContent=session?.user?.email||'Закрытый аккаунт';
 try{await loadAll();navigate('dashboard',true)}catch(e){tell('Не удалось загрузить базу: '+errText(e),true);navigate('dashboard',true)}
}
const pageTitle={dashboard:'Обзор студии',projects:'Мои проекты',library:'Библиотека ТТК',editor:'Конструктор ТТК',templates:'Шаблоны документов',settings:'Настройки студии'};
function navigate(view,force=false){
 if(!pageTitle[view])return false;
 if(!force&&currentView==='editor'&&view!=='editor'&&dirty&&!confirm('У вас есть несохранённые изменения ТТК. Закрыть без сохранения?'))return false;
 if(view==='editor'&&!draft){startNewDoc();return true}
 currentView=view;
 document.querySelectorAll('.page').forEach(el=>el.hidden=el.dataset.view!==view);
 document.querySelectorAll('.nav-btn[data-nav]').forEach(el=>{
  const active=el.dataset.nav===view;el.classList.toggle('active',active);el.setAttribute('aria-current',active?'page':'false');
 });
 $('topTitle').textContent=pageTitle[view];window.scrollTo(0,0);
 if(view==='editor')requestAnimationFrame(()=>{fitPaper();detectOverflow()});
 return true;
}
async function imageData(file,maxSize=800){
 if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('Поддерживаются только PNG, JPG и WEBP.');
 if(file.size>12*1024*1024)throw Error('Файл слишком большой (до 12 МБ).');
 const img=await new Promise((resolve,reject)=>{
  const u=URL.createObjectURL(file),i=new Image();
  i.onload=()=>{URL.revokeObjectURL(u);resolve(i)};
  i.onerror=()=>{URL.revokeObjectURL(u);reject(Error('Файл изображения повреждён.'))};i.src=u;
 });
 const ratio=Math.min(1,maxSize/Math.max(img.naturalWidth,img.naturalHeight));
 const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(img.naturalWidth*ratio));cv.height=Math.max(1,Math.round(img.naturalHeight*ratio));
 const c=cv.getContext('2d');if(!c)throw Error('Обработка фото в браузере недоступна.');
 c.clearRect(0,0,cv.width,cv.height);c.drawImage(img,0,0,cv.width,cv.height);
 const out=cv.toDataURL('image/webp',.87);
 if(out.length>1250000)throw Error('Изображение после обработки слишком большое.');
 return out;
}
const validImg=x=>typeof x==='string'&&x.length<1400000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(x);
function emptyView(title,description,button,action){
 return '<div class="empty"><div class="empty-symbol">'+icon('folder')+'</div><strong>'+esc(title)+'</strong><p>'+esc(description)+'</p>'+
 (button?'<button type="button" class="btn btn-primary btn-sm" data-command="'+esc(action)+'">'+esc(button)+'</button>':'')+'</div>';
}
function byProject(id){return projects.find(p=>p.id===id)||null}
function projectName(id){return byProject(id)?.name||'Проект не найден'}
function docStatus(doc){const c=doc.status==='Утверждено'?'approved':doc.status==='На проверке'?'review':doc.status==='Архив'?'archive':'';return '<span class="pill '+c+'">'+esc(doc.status||'Черновик')+'</span>'}
function renderAll(){
 renderDash();renderProjects();renderLibrary();renderTemplates();renderSettings();
}
/* Projects: client brands live inside this single closed chef workspace. */
let pendingTemplate='atelier';
let lastRemovedLine=null;
function renderDash(){
 $('statProjects').textContent=projects.filter(p=>!p.is_archived).length;
 $('statDocuments').textContent=docs.filter(d=>d.status!=='Архив').length;
 $('statDrafts').textContent=docs.filter(d=>d.status==='Черновик'||d.status==='На проверке').length;
 $('statApproved').textContent=docs.filter(d=>d.status==='Утверждено').length;
 const recent=docs.filter(d=>d.status!=='Архив').slice(0,4);
 $('dashDocs').innerHTML=recent.length?'<div class="list">'+recent.map(d=>rowHtml(d,true)).join('')+'</div>':
 emptyView('Начни с первой ТТК','Создай проект, а затем добавь первую технологическую карту.','Создать ТТК','newDoc');
 const active=projects.filter(p=>!p.is_archived).slice(0,2);
 $('dashProjects').innerHTML=active.map(projectCard).join('')+
 '<button type="button" class="project-card surface project-add" data-command="newProject"><span class="plus">+</span><strong>Новый проект</strong><small>Ресторан · бренд · заказчик</small></button>';
}
function projectCard(p){
 const count=docs.filter(d=>d.project_id===p.id&&d.status!=='Архив').length;
 const initial=esc((p.name||'P').trim().slice(0,1).toLocaleUpperCase('ru'));
 const logo=validImg(p.logo_data)?'<img src="'+p.logo_data+'" alt="">':initial;
 return '<article class="surface project-card" style="--project-color:'+esc(p.accent||'#0F6479')+'">'+
 '<div class="row between"><div class="proj-mark">'+logo+'</div><span class="pill '+(p.is_archived?'archive':'approved')+'">'+(p.is_archived?'Архив':'Активный')+'</span></div>'+
 '<div><h3>'+esc(p.name)+'</h3><p>'+esc(p.description||'Частная коллекция ТТК')+'</p><p style="margin-top:6px">'+count+' документов</p></div>'+
 '<div class="proj-actions"><button type="button" class="btn btn-primary btn-sm" data-project-open="'+p.id+'">Открыть ТТК →</button>'+
 '<button type="button" class="btn btn-light btn-sm" data-project-edit="'+p.id+'" aria-label="Настроить проект">Изменить</button>'+
 '<button type="button" class="btn btn-light btn-sm" data-project-archive="'+p.id+'">'+(p.is_archived?'Вернуть':'В архив')+'</button>'+
 (docs.every(d=>d.project_id!==p.id)?'<button type="button" class="btn btn-danger btn-sm" data-project-remove="'+p.id+'">Удалить</button>':'')+
 '</div></article>';
}
function renderProjects(){
 const q=$('projectSearch').value.trim().toLocaleLowerCase('ru'),status=$('projectStatus').value;
 const filtered=projects.filter(p=>(status==='all'||(status==='active'?!p.is_archived:p.is_archived))&&
 (!q||[p.name,p.description].some(t=>String(t||'').toLocaleLowerCase('ru').includes(q))));
 $('projectGrid').innerHTML=filtered.map(projectCard).join('')+
 (status!=='archive'?'<button type="button" class="project-card surface project-add" data-command="newProject"><span class="plus">+</span><strong>Создать новый проект</strong><small>Открой следующую коллекцию</small></button>':'')||
 emptyView('Пока нет проектов','Создай первое заведение для своей коллекции ТТК.','Новый проект','newProject');
}
function rowHtml(d,compact=false){
 const meta=esc(d.code||'Без кода')+' · '+dateRu(d.updated_at);
 return '<article class="doc-row"><div class="doc-main"><div class="doc-label">'+esc(d.title)+'</div><div class="doc-meta">'+meta+'</div></div>'+
 '<span class="doc-project">'+esc(projectName(d.project_id))+'</span>'+docStatus(d)+
 '<div class="action-menu"><button class="btn btn-primary btn-sm" type="button" data-doc-open="'+d.id+'">Открыть</button>'+
 (compact?'': '<button class="btn btn-light btn-sm" type="button" data-doc-copy="'+d.id+'" aria-label="Копировать">Копия</button>'+
 '<button class="btn btn-light btn-sm" type="button" data-doc-archive="'+d.id+'">'+(d.status==='Архив'?'Вернуть':'В архив')+'</button>'+
 '<button class="btn btn-danger btn-sm" type="button" data-doc-delete="'+d.id+'" aria-label="Удалить документ">×</button>')+
 '</div></article>';
}
function renderLibrary(){
 const old=$('docProject').value;
 $('docProject').innerHTML='<option value="">Все проекты</option>'+projects.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('');
 if(projects.some(p=>p.id===old))$('docProject').value=old;
 const p=$('docProject').value,s=$('docStatus').value,q=$('docSearch').value.trim().toLocaleLowerCase('ru');
 const filtered=docs.filter(d=>(!p||d.project_id===p)&&
 (s==='all'||s==='active'&&d.status!=='Архив'||d.status===s)&&
 (!q||[d.title,d.code,d.category,projectName(d.project_id)].some(x=>String(x||'').toLocaleLowerCase('ru').includes(q))));
 $('libraryDocs').innerHTML=filtered.length?filtered.map(d=>rowHtml(d)).join(''):
 emptyView('Документов пока нет','Создайте первую ТТК. Здесь появятся карточки всех заведений.','Создать ТТК','newDoc');
 $('libraryCount').textContent='Показано: '+filtered.length+' из '+docs.length+' документов';
}
function renderTemplates(){
 $('templateGrid').innerHTML=templates.map(t=>
 '<article class="surface template-card"><div class="design-mini '+esc(t.id)+'"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>'+
 '<div class="mini-label">'+esc(t.sub)+'</div><h3>'+esc(t.name)+'</h3><p>'+esc(t.desc)+'</p>'+
 '<button type="button" class="btn btn-primary" data-template-create="'+esc(t.id)+'">'+icon('plus')+' Создать ТТК в этом стиле</button></article>').join('');
}
function renderSettings(){
 $('prefStudio').value=prefs.studio_name||'FARUKH TTK PRO';
 $('prefTitle').value=prefs.title||'Студия технико-технологических карт';
 $('prefChef').value=prefs.chef_name||'';
}
async function saveSettings(ev){ev.preventDefault();if(busy)return;
 const data={owner_id:session?.user?.id,studio_name:$('prefStudio').value.trim().slice(0,100)||'FARUKH TTK PRO',
 title:$('prefTitle').value.trim().slice(0,180),chef_name:$('prefChef').value.trim().slice(0,160),updated_at:new Date().toISOString()};
 setBusy(true);try{
 const rows=await api('/rest/v1/ttk_preferences?on_conflict=owner_id&select=*',{
  method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:data});
 if(!rows?.[0])throw Error('Настройки не подтверждены сервером');
 prefs=rows[0];tell('Настройки студии сохранены');
 }catch(e){tell('Ошибка сохранения настроек: '+errText(e),true)}finally{setBusy(false)}
}
function renderLogoPreview(){
 const preview=$('pLogoPreview');
 preview.innerHTML=validImg(modalLogo)?'<img src="'+modalLogo+'" alt="Предпросмотр логотипа бренда">':'<span>Логотип бренда</span>';
}
function openProjectDialog(id=null){
 const p=id?byProject(id):null;
 modalProjectId=p?.id||null;modalLogo=p?.logo_data||null;
 $('projectDialogTitle').textContent=p?'Редактировать проект':'Новый проект';
 $('pName').value=p?.name||'';$('pDesc').value=p?.description||'';$('pColor').value=p?.accent||'#0F6479';
 $('pLogo').value='';$('pLogoStatus').textContent=modalLogo?'Логотип уже загружен':'Логотип пока не выбран';
 renderLogoPreview();$('projectDialog').showModal();$('pName').focus();
}
async function logoSelected(){
 const file=$('pLogo').files?.[0];if(!file)return;
 try{modalLogo=await imageData(file,1000);renderLogoPreview();$('pLogoStatus').textContent='Логотип подготовлен · '+Math.round(modalLogo.length/1024)+' КБ'}
 catch(e){tell(errText(e),true)}
 finally{$('pLogo').value=''}
}
async function saveProject(ev){
 ev.preventDefault();if(busy)return;
 const name=$('pName').value.trim().replace(/\s+/g,' ');
 if(!name){tell('Введите название проекта.',true);return}
 const patch={name,description:$('pDesc').value.trim().slice(0,500),accent:$('pColor').value,logo_data:modalLogo,updated_at:new Date().toISOString()};
 setBusy(true);
 try{
  const rows=modalProjectId?await api('/rest/v1/ttk_projects?id=eq.'+modalProjectId+'&select=*',{
    method:'PATCH',headers:{Prefer:'return=representation'},body:patch}):
   await api('/rest/v1/ttk_projects?select=*',{
    method:'POST',headers:{Prefer:'return=representation'},body:patch});
  if(!rows?.[0]?.id)throw Error('Сервер не подтвердил сохранение проекта');
  const saved=rows[0];
  if(modalProjectId){projects=projects.map(p=>p.id===saved.id?saved:p)}
  else projects.unshift(saved);
  $('projectDialog').close();renderAll();
  if(draft&&draft.project_id===saved.id)renderPreview();
  tell(modalProjectId?'Проект обновлён':'Новый проект создан');
  if(pendingCreate){pendingCreate=false;startNewDoc(saved.id,pendingTemplate)}
 }catch(e){tell('Не удалось сохранить проект: '+errText(e),true)}
 finally{setBusy(false)}
}
async function toggleProjectArchive(id){
 const p=byProject(id);if(!p)return;
 const next=!p.is_archived;
 if(next&&!confirm('Переместить проект «'+p.name+'» в архив? ТТК сохранятся.'))return;
 try{
  const rows=await api('/rest/v1/ttk_projects?id=eq.'+id+'&select=*',{
   method:'PATCH',headers:{Prefer:'return=representation'},body:{is_archived:next,updated_at:new Date().toISOString()}});
  if(!rows?.[0])throw Error('Изменения не подтверждены сервером');
  projects=projects.map(x=>x.id===id?rows[0]:x);renderAll();tell(next?'Проект отправлен в архив':'Проект восстановлен');
 }catch(e){tell(errText(e),true)}
}
async function removeProject(id){
 const p=byProject(id);if(!p)return;
 if(docs.some(d=>d.project_id===id)){tell('В проекте есть ТТК. Сначала перенесите или удалите документы.',true);return}
 if(!confirm('Безвозвратно удалить пустой проект «'+p.name+'»?'))return;
 try{
  const rows=await api('/rest/v1/ttk_projects?id=eq.'+id+'&select=id',{method:'DELETE',headers:{Prefer:'return=representation'}});
  if(!rows?.[0])throw Error('Удаление не подтверждено');
  projects=projects.filter(x=>x.id!==id);renderAll();tell('Пустой проект удалён');
 }catch(e){tell(errText(e),true)}
}
async function listForProject(id){
 $('docProject').value=id;navigate('library',true);renderLibrary();
}

/* Document studio: a separate card belongs to one selected restaurant project. */
const fieldMap={
 fScope:'scope',fRaw:'raw',fProcess:'process',fServing:'serving',fStorage:'storage',
 fQuality:'quality',fAllergens:'allergens',fNutrition:'nutrition',fDeveloped:'developed',
 fApproved:'approved',fDate:'date',fVerified:'verified'
};
function nextTtkCode(projectId){
 const nums=docs.filter(d=>d.project_id===projectId).map(d=>
  String(d.code||'').match(/^(?:ТТК|TTK)-(\d+)$/i)).filter(Boolean).map(m=>Number(m[1]));
 const next=Math.max(0,...nums)+1;
 return 'ТТК-'+String(next).padStart(3,'0');
}
function blankDoc(projectId,template='atelier'){
 return {id:null,project_id:projectId||'',title:'',code:projectId?nextTtkCode(projectId):'',category:'Блюда',status:'Черновик',
  yield_g:null,photo_data:null,lines:[{name:'',gross_g:null,net_g:null}],fields:{scope:'',raw:'',process:'',serving:'',storage:'',
   quality:'',allergens:'',nutrition:'',developed:prefs.chef_name||'',approved:'',date:'',verified:'no'},
  template,version:1};
}
function confirmNew(){
 if(dirty&&!confirm('Создать новую ТТК? Несохранённые изменения текущей карты будут потеряны.'))return false;
 return true;
}
function startNewDoc(projectId=null,template=pendingTemplate){
 if(!confirmNew())return;
 const suitable=projects.filter(p=>!p.is_archived);
 if(!suitable.length){
  pendingCreate=true;pendingTemplate=template||'atelier';
  tell('Сначала создайте проект для будущих ТТК.');
  openProjectDialog();return;
 }
 const chosen=suitable.find(p=>p.id===projectId)?.id||suitable[0].id;
 draft=blankDoc(chosen,template||'atelier');workingId=null;dirty=false;editorTab='main';
 fillEditor();navigate('editor',true);
}
function openDocument(id){
 const item=docs.find(d=>d.id===id);
 if(!item){tell('ТТК не найдена в библиотеке',true);return}
 if(currentView==='editor'&&dirty&&!confirm('Открыть другую ТТК без сохранения текущих изменений?'))return;
 draft=clone(item);draft.fields={...blankDoc().fields,...(draft.fields||{})};
 draft.lines=Array.isArray(draft.lines)?draft.lines:[];
 workingId=id;dirty=false;editorTab='main';
 fillEditor();navigate('editor',true);
}
function fillEditor(){
 if(!draft)return;
 lastRemovedLine=null;
 const sel=$('eProject');
 sel.innerHTML='<option value="">Выберите проект</option>'+
 projects.filter(p=>!p.is_archived||p.id===draft.project_id).map(p=>
 '<option value="'+p.id+'">'+esc(p.name)+'</option>').join('');
 $('eProject').value=draft.project_id||'';
 $('eTitle').value=draft.title||'';$('eCode').value=draft.code||'';$('eCategory').value=draft.category||'Блюда';
 $('eYield').value=draft.yield_g??'';$('eStatus').value=draft.status||'Черновик';
 Object.entries(fieldMap).forEach(([id,key])=>{$(id).value=draft.fields?.[key]|| (key==='verified'?'no':'')});
 $('ePhotoInput').value='';renderPhotoZone();renderLineRows();setTab(editorTab);
 $('editorHeading').textContent=draft.title||'Новая технико-технологическая карта';
 $('editorDuplicate').hidden=!draft.id;renderEditorDesigns();renderPreview();renderReview();
 window.FARUKH_TTK_AUTO?.onDraft();
}
function renderPhotoZone(){
 const z=$('photoZone');if(!z)return;
 if(validImg(draft?.photo_data)){
  z.innerHTML='<img src="'+draft.photo_data+'" alt="Фото блюда"><strong>Нажмите, чтобы заменить фото</strong><span>Изображение добавлено</span>';
  $('removePhoto').disabled=false;
 }else{
  z.innerHTML=icon('upload')+'<strong>Загрузить фотографию</strong><span>PNG / JPG / WEBP · будет отображаться в ТТК</span>';
  $('removePhoto').disabled=true;
 }
}
function renderLineRows(){
 const rows=Array.isArray(draft?.lines)?draft.lines:[];
 $('editorLines').innerHTML=rows.map((line,i)=>
 '<tr data-line="'+i+'"><td><input class="control" maxlength="180" data-line-field="name" aria-label="Ингредиент '+(i+1)+'" placeholder="Название сырья или ПФ" value="'+esc(line.name||'')+'"></td>'+
 '<td><input class="control" data-line-field="gross_g" type="number" min="0" step=".001" inputmode="decimal" aria-label="Брутто '+(i+1)+'" placeholder="0" value="'+esc(line.gross_g??'')+'"></td>'+
 '<td><input class="control" data-line-field="net_g" type="number" min="0" step=".001" inputmode="decimal" aria-label="Нетто '+(i+1)+'" placeholder="0" value="'+esc(line.net_g??'')+'"></td>'+
 '<td><div class="line-actions">'+
 '<button type="button" title="Переместить выше" data-move-line="'+i+'" data-direction="-1" aria-label="Выше: '+(i+1)+'" '+(i===0?'disabled':'')+'>'+icon('left')+'</button>'+
 '<button type="button" title="Переместить ниже" data-move-line="'+i+'" data-direction="1" aria-label="Ниже: '+(i+1)+'" '+(i===rows.length-1?'disabled':'')+'>'+icon('left')+'</button>'+
 '<button type="button" title="Дублировать строку" data-duplicate-line="'+i+'" aria-label="Дублировать: '+(i+1)+'">'+icon('copy')+'</button>'+
 '<button type="button" class="remove-line" title="Удалить строку" data-remove-line="'+i+'" aria-label="Удалить: '+(i+1)+'">'+icon('trash')+'</button>'+
 '</div></td></tr>').join('');
 $('undoLineBtn').hidden=!lastRemovedLine;
 sumLines();
}
function sumLines(){
 let gross=0,net=0;
 for(const l of draft?.lines||[]){
  gross+=Math.max(0,Number(l.gross_g)||0);
  net+=Math.max(0,Number(l.net_g)||0);
 }
 $('sumNet').textContent=fmt(net)+' г';$('sumGross').textContent=fmt(gross)+' г';
 const y=draft?.yield_g;
 const info=$('yieldCompare');
 if(!info)return;
 if(y==null||Number(y)<=0){info.textContent='Укажи выход блюда на вкладке «Основное», чтобы сравнить массу.';info.className='line-yield-compare';return}
 const delta=Number(y)-net;
 info.textContent='Заявленный выход: '+fmt(y)+' г · сумма нетто: '+fmt(net)+' г · разница: '+fmt(delta)+' г. Расхождение требует технологической проверки.';
 info.className='line-yield-compare'+(Math.abs(delta)<.001?' matched':' discrepancy');
}
function getLineInputs(){
 draft.lines=[...$('editorLines').querySelectorAll('tr[data-line]')].map(tr=>({
  name:tr.querySelector('[data-line-field="name"]')?.value.trim()||'',
  gross_g:n(tr.querySelector('[data-line-field="gross_g"]')?.value),
  net_g:n(tr.querySelector('[data-line-field="net_g"]')?.value)
 }));
}
function syncDraft(options={}){
 if(!draft)return;
 draft.project_id=$('eProject').value;draft.title=$('eTitle').value.trim();
 draft.code=$('eCode').value.trim();draft.category=$('eCategory').value.trim()||'Блюда';
 draft.yield_g=n($('eYield').value);draft.status=$('eStatus').value;
 draft.fields=draft.fields||{};
 Object.entries(fieldMap).forEach(([id,key])=>draft.fields[key]=$(id).value.trim());
 getLineInputs();dirty=true;
 $('editorHeading').textContent=draft.title||'Новая технико-технологическая карта';
 sumLines();
 if(options.noPaperRender){renderReview()}
 else renderPreview();
}
function lineRemove(index){
 if(!draft)return;syncDraft();
 if(index<0||index>=draft.lines.length)return;
 lastRemovedLine={index,line:clone(draft.lines[index])};
 draft.lines.splice(index,1);dirty=true;renderLineRows();renderPreview();renderReview();
 tell('Строка удалена. Можно вернуть её кнопкой «Вернуть строку».');
}
function lineUndo(){
 if(!draft||!lastRemovedLine)return;
 syncDraft();
 draft.lines.splice(Math.min(lastRemovedLine.index,draft.lines.length),0,lastRemovedLine.line);
 lastRemovedLine=null;dirty=true;renderLineRows();renderPreview();renderReview();
}
function lineMove(index,direction){
 if(!draft)return;syncDraft();
 const other=index+direction;
 if(index<0||other<0||index>=draft.lines.length||other>=draft.lines.length)return;
 [draft.lines[index],draft.lines[other]]=[draft.lines[other],draft.lines[index]];
 dirty=true;renderLineRows();renderPreview();renderReview();
}
function lineDuplicate(index){
 if(!draft)return;syncDraft();
 if(index<0||index>=draft.lines.length)return;
 if(draft.lines.length>=100){tell('Допустимо не более 100 строк на документ.',true);return}
 draft.lines.splice(index+1,0,clone(draft.lines[index]));
 dirty=true;renderLineRows();renderPreview();renderReview();
}
function clearEmptyLines(){
 if(!draft)return;syncDraft();
 const before=draft.lines.length;
 draft.lines=draft.lines.filter(l=>String(l.name||'').trim()||l.gross_g!=null||l.net_g!=null);
 if(before===draft.lines.length){tell('Пустых строк нет.');return}
 lastRemovedLine=null;dirty=true;renderLineRows();renderPreview();renderReview();
 tell('Удалено пустых строк: '+(before-draft.lines.length));
}
function setTab(tab){
 editorTab=['main','lines','tech','design','review'].includes(tab)?tab:'main';
 document.querySelectorAll('[data-tab]').forEach(b=>{
  const on=b.dataset.tab===editorTab;b.classList.toggle('active',on);
  b.setAttribute('aria-selected',on?'true':'false');
 });
 document.querySelectorAll('[data-tab-panel]').forEach(p=>p.hidden=p.dataset.tabPanel!==editorTab);
}
function renderEditorDesigns(){
 if(!$('editorDesigns'))return;
 $('editorDesigns').innerHTML=templates.map(t=>
 '<button type="button" class="design-tile '+(draft?.template===t.id?'active':'')+'" data-editor-template="'+t.id+'">'+
 '<div class="design-mini '+t.id+'"><i></i><i></i><i></i><i></i><i></i></div><strong>'+esc(t.name)+'</strong><small>'+esc(t.sub)+'</small></button>').join('');
}
async function photoSelected(){
 if(!draft)return;
 const file=$('ePhotoInput').files?.[0];if(!file)return;
 try{draft.photo_data=await imageData(file,950);dirty=true;renderPhotoZone();renderPreview();tell('Фото блюда загружено в редактор. Сохраните ТТК, чтобы закрепить его.')}
 catch(e){tell(errText(e),true)}finally{$('ePhotoInput').value=''}
}
function approvedIssues(d){
 const f=d.fields||{},issues=[];
 if(!d.project_id||!byProject(d.project_id))issues.push('проект');
 if(!d.title.trim())issues.push('название блюда');
 if(!Number.isFinite(Number(d.yield_g))||Number(d.yield_g)<=0)issues.push('выход блюда');
 if(!Array.isArray(d.lines)||!d.lines.length||d.lines.some(l=>!String(l.name||'').trim()||n(l.gross_g)==null||n(l.net_g)==null||n(l.gross_g)<0||n(l.net_g)<0))issues.push('полная рецептура брутто/нетто');
 for(const [key,label] of [['scope','область применения'],['raw','требования к сырью'],['process','технологический процесс'],['serving','подача и реализация'],['storage','условия хранения'],['quality','показатели качества'],['allergens','аллергены'],['nutrition','КБЖУ'],['developed','разработал'],['approved','утвердил'],['date','дата утверждения']]){
  if(!String(f[key]||'').trim()||window.FARUKH_TTK_AUTO?.isPending(f[key]))issues.push(label);
 }
 if(f.verified!=='yes')issues.push('ручное подтверждение документов');
 return issues;
}
function validateDoc(d){
 if(!d||!d.project_id||!byProject(d.project_id))throw Error('Сначала выберите проект.');
 if(!d.title.trim())throw Error('Введите название блюда.');
 if(d.title.length>180)throw Error('Название длиннее 180 символов.');
 if(d.yield_g!=null&&(!Number.isFinite(Number(d.yield_g))||Number(d.yield_g)<=0))throw Error('Выход блюда должен быть больше нуля.');
 if(!Array.isArray(d.lines)||d.lines.length>100)throw Error('В ТТК должно быть не более 100 ингредиентов.');
 for(const l of d.lines){
  if(n(l.gross_g)!=null&&n(l.gross_g)<0||n(l.net_g)!=null&&n(l.net_g)<0)throw Error('Масса ингредиента не может быть отрицательной.');
 }
 if(d.status==='Утверждено'){
  const issues=approvedIssues(d);
  if(issues.length)throw Error('Для утверждения проверьте: '+issues.slice(0,5).join(', ')+(issues.length>5?' и другие обязательные поля':''));
 }
}
async function saveDocument(){
 if(!draft||busy)return;
 syncDraft();
 try{validateDoc(draft)}catch(e){tell(errText(e),true);return}
 setBusy(true);
 const payload={project_id:draft.project_id,title:draft.title,code:draft.code||'',category:draft.category||'Блюда',
  status:draft.status,yield_g:draft.yield_g,photo_data:draft.photo_data||null,
  lines:draft.lines,fields:draft.fields,template:draft.template,updated_at:new Date().toISOString()};
 try{
  let rows;
  if(workingId){
   const version=draft.version||1;
   rows=await api('/rest/v1/ttk_documents?id=eq.'+workingId+'&version=eq.'+version+'&select=*',{
    method:'PATCH',headers:{Prefer:'return=representation'},body:{...payload,version:version+1}});
   if(!rows?.[0])throw Error('Карточка изменилась в другом окне. Обновите её из библиотеки перед сохранением.');
  }else{
   rows=await api('/rest/v1/ttk_documents?select=*',{method:'POST',
     headers:{Prefer:'return=representation'},body:payload});
   if(!rows?.[0]?.id)throw Error('Сервер не подтвердил создание ТТК.');
  }
  const saved=rows[0];workingId=saved.id;draft=clone(saved);dirty=false;
  docs=docs.filter(d=>d.id!==saved.id);docs.unshift(saved);lastRemovedLine=null;
  $('editorDuplicate').hidden=false;renderAll();fillEditor();
  tell('ТТК сохранена в проекте «'+projectName(saved.project_id)+'» · версия '+saved.version);
 }catch(e){tell('Не удалось сохранить ТТК: '+errText(e),true)}
 finally{setBusy(false)}
}
async function archiveDocument(id){
 const d=docs.find(x=>x.id===id);if(!d)return;
 const next=d.status==='Архив'?'Черновик':'Архив';
 if(next==='Архив'&&!confirm('Отправить «'+d.title+'» в архив? Документ сохранится.'))return;
 try{
  const rows=await api('/rest/v1/ttk_documents?id=eq.'+id+'&version=eq.'+d.version+'&select=*',{
   method:'PATCH',headers:{Prefer:'return=representation'},body:{status:next,version:d.version+1,updated_at:new Date().toISOString()}});
  if(!rows?.[0])throw Error('Изменения не подтверждены. Обновите страницу.');
  docs=docs.map(x=>x.id===id?rows[0]:x);
  if(workingId===id&&draft){draft.status=rows[0].status;draft.version=rows[0].version;$('eStatus').value=draft.status;renderPreview()}
  renderAll();tell(next==='Архив'?'ТТК перенесена в архив':'ТТК восстановлена как черновик');
 }catch(e){tell(errText(e),true)}
}
async function deleteDocument(id){
 const d=docs.find(x=>x.id===id);if(!d)return;
 if(!confirm('Удалить ТТК «'+d.title+'» безвозвратно? Это действие нельзя отменить.'))return;
 try{
  const rows=await api('/rest/v1/ttk_documents?id=eq.'+id+'&select=id',{
   method:'DELETE',headers:{Prefer:'return=representation'}});
  if(!rows?.[0])throw Error('Сервер не подтвердил удаление');
  docs=docs.filter(x=>x.id!==id);
  if(workingId===id){workingId=null;draft=null;dirty=false;navigate('library',true)}
  renderAll();tell('ТТК удалена из библиотеки');
 }catch(e){tell('Не удалось удалить: '+errText(e),true)}
}
function openCopy(id){
 const d=docs.find(x=>x.id===id)|| (draft?.id===id?draft:null);if(!d)return;
 if(!projects.some(p=>!p.is_archived)){tell('Создайте активный проект для копии.',true);return}
 copySourceId=id;
 $('copyProject').innerHTML=projects.filter(p=>!p.is_archived).map(p=>
 '<option value="'+p.id+'">'+esc(p.name)+'</option>').join('');
 $('copyProject').value=projects.some(p=>p.id===d.project_id&&!p.is_archived)?d.project_id:projects.find(p=>!p.is_archived).id;
 $('copyDialog').showModal();
}
async function copyDocument(ev){
 ev.preventDefault();if(busy)return;
 const source=docs.find(x=>x.id===copySourceId)|| (draft?.id===copySourceId?draft:null);
 if(!source){tell('Оригинальная ТТК не найдена',true);return}
 const dest=byProject($('copyProject').value);
 if(!dest||dest.is_archived){tell('Выберите действующий проект',true);return}
 const fields={...clone(source.fields||{}),verified:'no',approved:'',date:''};
 const payload={project_id:dest.id,title:source.title+' — копия',code:source.code?source.code+'-COPY':'',
  category:source.category,status:'Черновик',yield_g:source.yield_g,photo_data:source.photo_data,
  lines:clone(source.lines||[]),fields,template:source.template||'atelier',version:1};
 setBusy(true);try{
  const rows=await api('/rest/v1/ttk_documents?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:payload});
  if(!rows?.[0])throw Error('Сервер не подтвердил создание копии');
  docs.unshift(rows[0]);$('copyDialog').close();renderAll();openDocument(rows[0].id);
  tell('Независимая копия сохранена в «'+dest.name+'»');
 }catch(e){tell('Не удалось скопировать: '+errText(e),true)}finally{setBusy(false)}
}

function renderReview(){
 if(!draft)return;
 const f=draft.fields||{},validLines=Array.isArray(draft.lines)&&draft.lines.length>0&&draft.lines.every(l=>
  !!String(l.name||'').trim()&&n(l.gross_g)!=null&&n(l.net_g)!=null&&n(l.gross_g)>=0&&n(l.net_g)>=0);
 const check=[
  ['Выбран проект',!!byProject(draft.project_id),'main'],
  ['Название блюда',!!draft.title?.trim(),'main'],
  ['Выход блюда больше нуля',draft.yield_g!=null&&draft.yield_g>0,'main'],
  ['Рецептура: названия и граммовки',validLines,'lines'],
  ['Область применения',!!f.scope?.trim()&&!window.FARUKH_TTK_AUTO?.isPending(f.scope),'tech'],
  ['Требования к сырью',!!f.raw?.trim()&&!window.FARUKH_TTK_AUTO?.isPending(f.raw),'tech'],
  ['Технологический процесс',!!f.process?.trim()&&!window.FARUKH_TTK_AUTO?.isPending(f.process),'tech'],
  ['Оформление и реализация',!!f.serving?.trim()&&!window.FARUKH_TTK_AUTO?.isPending(f.serving),'tech'],
  ['Сроки и условия хранения',!!f.storage?.trim()&&!window.FARUKH_TTK_AUTO?.isPending(f.storage),'tech'],
  ['Качество и безопасность',!!f.quality?.trim()&&!window.FARUKH_TTK_AUTO?.isPending(f.quality),'tech'],
  ['Аллергены (источник проверен вручную)',!!f.allergens?.trim()&&!window.FARUKH_TTK_AUTO?.isPending(f.allergens),'tech'],
  ['КБЖУ (источник проверен вручную)',!!f.nutrition?.trim()&&!window.FARUKH_TTK_AUTO?.isPending(f.nutrition),'tech'],
  ['Разработал и утвердил',!!f.developed?.trim()&&!!f.approved?.trim(),'tech'],
  ['Дата утверждения',!!f.date?.trim(),'tech'],
  ['Ручное подтверждение сведений',f.verified==='yes','tech']
 ];
 const done=check.filter(v=>v[1]).length,total=check.length;
 const pct=Math.round(done/total*100);
 $('ttkCheckCount').textContent=done+' / '+total;
 $('ttkCheckBar').style.width=pct+'%';
 $('ttkCheckTitle').textContent=done===total?'Поля документа заполнены':'Проверка заполненности ТТК';
 $('ttkCheckHint').textContent=done===total?
  'Теперь ответственный должен подтвердить соответствие продукции требованиям.' :
  'Не заполнено: '+(total-done)+' пунктов. До проверки сохраняй документ как черновик.';
 $('reviewChecklist').innerHTML=check.map(([label,ok,tab],i)=>
  '<button class="review-item '+(ok?'complete':'incomplete')+'" type="button" data-review-tab="'+tab+'">'+
  '<span class="review-number">'+(ok?icon('check'):(i+1))+'</span>'+
  '<span class="review-item-text">'+esc(label)+'</span>'+
  '<strong>'+(ok?'Заполнено':'Заполнить')+'</strong></button>').join('');
 const badge=$('editorSaveBadge');
 if(badge){
  badge.textContent=!draft.id?'● Новый документ · не сохранён':
    dirty?'● Есть несохранённые изменения':'✓ Сохранено в библиотеке · версия '+(draft.version||1);
  badge.className='editor-save-badge'+(!draft.id||dirty?' unsaved':' saved');
 }
 const save=$('saveDoc');if(save)save.textContent=dirty&&!!draft.id?'Сохранить изменения':'Сохранить ТТК';
}

/* Premium A4 preview; all variable content is escaped before interpolation. */

function editablePaper(id,val,hint,kind='multi'){
 const label=String(hint||id);
 if(kind==='date')return '<input type="date" class="sheet-edit sheet-date" data-sheet-field="'+id+'" value="'+esc(val||'')+'" aria-label="'+esc(label)+'">';
 if(kind==='number')return '<input type="number" min="0.001" step="0.001" inputmode="decimal" class="sheet-edit sheet-number" data-sheet-field="'+id+'" value="'+esc(val??'')+'" placeholder="0" aria-label="'+esc(label)+'">';
 return '<span class="sheet-edit '+(kind==='line'?'sheet-single':'sheet-text')+'" contenteditable="true" spellcheck="false" data-sheet-field="'+id+'" role="textbox" aria-label="'+esc(label)+'" data-placeholder="'+esc(label)+'">'+esc(String(val||'')).replace(/\n/g,'<br>')+'</span>';
}
function sheetParagraph(id,number,label,val,hint,sectionClass=''){
 return '<section class="sheet-section '+sectionClass+'"><div class="sheet-section-head"><span>'+esc(number)+'</span><h3>'+esc(label)+'</h3></div>'+
 '<div class="sheet-section-content">'+editablePaper(id,val,hint)+'</div></section>';
}
function buildSheetRow(line,i){
 return '<tr data-sheet-line="'+i+'">'+
 '<td class="sheet-seq">'+String(i+1).padStart(2,'0')+'</td>'+
 '<td class="sheet-item-name"><span class="sheet-edit sheet-single" contenteditable="true" spellcheck="false" data-sheet-line-field="name" data-placeholder="Название сырья / ПФ" role="textbox" aria-label="Название ингредиента '+(i+1)+'">'+esc(line.name||'')+'</span></td>'+
 '<td><input class="sheet-edit sheet-weight" type="number" min="0" step="0.001" inputmode="decimal" data-sheet-line-field="gross_g" value="'+esc(line.gross_g??'')+'" placeholder="0" aria-label="Брутто, строка '+(i+1)+'"></td>'+
 '<td><input class="sheet-edit sheet-weight" type="number" min="0" step="0.001" inputmode="decimal" data-sheet-line-field="net_g" value="'+esc(line.net_g??'')+'" placeholder="0" aria-label="Нетто, строка '+(i+1)+'"></td>'+
 '<td class="sheet-row-actions sheet-screen-only">'+
 '<button type="button" data-sheet-move="'+i+'" data-sheet-move-dir="-1" aria-label="Строка выше" title="Выше">↑</button>'+
 '<button type="button" data-sheet-move="'+i+'" data-sheet-move-dir="1" aria-label="Строка ниже" title="Ниже">↓</button>'+
 '<button type="button" data-sheet-remove="'+i+'" aria-label="Убрать ингредиент" title="Удалить строку">×</button></td>'+
 '</tr>';
}
function renderPreview(){
 if(!draft)return;
 const paper=$('paper'),p=byProject(draft.project_id),f=draft.fields||{};
 paper.className='sheet-document archive-sheet';
 paper.innerHTML='<div class="sheet-main archive-sheet-content" data-template="'+({atelier:'a4-01',classic:'a4-02',arctic:'a4-04'}[draft.template]||'a4-01')+'">'+ARCHIVE_HTML+'</div>';
 const q=s=>paper.querySelector(s);
 const bg=document.createElement('img');bg.className='lux-background';bg.src='./'+({atelier:'lux',classic:'arctic',arctic:'deep'}[draft.template]||'lux')+'-paper.webp';bg.alt='';q('.archive-sheet-content').prepend(bg);
 q('[data-key="name"]').dataset.ph='Название блюда';
 paper.querySelectorAll('[data-layout]').forEach(el=>el.removeAttribute('contenteditable'));
 const mapping={code:['eCode',draft.code],name:['eTitle',draft.title],category:['eCategory',draft.category],yield_g:['eYield',draft.yield_g],scope:['fScope',f.scope],raw_requirements:['fRaw',f.raw],storage:['fStorage',f.storage],allergens:['fAllergens',f.allergens],introduced_at:['fDate',f.date],developed_by:['fDeveloped',f.developed],approved_by:['fApproved',f.approved]};
 Object.entries(mapping).forEach(([key,[id,value]])=>{const el=q('[data-key="'+key+'"]');if(!el)return;el.dataset.sheetField=id;if(el.matches('input')){el.value=value??'';el.readOnly=false}else el.textContent=value||'';el.setAttribute('aria-label',key)});
 const parts=f.archive_parts||{};
 const groups={process:['step1','step2','step3','step4'],serving:['serving_design','serving_sale','serving_transport'],quality:['quality_appearance','quality_consistency','quality_taste','quality_color','quality_safety'],nutrition:['protein','fat','carbs','kcal']};
 Object.entries(groups).forEach(([group,keys])=>keys.forEach((key,i)=>{const el=q('[data-key="'+key+'"]');el.dataset.archiveField=key;el.dataset.archiveGroup=group;el.textContent=parts[key]??(i===0&&group!=='nutrition'?(f[group]||''):'');el.setAttribute('aria-label',key)}));
 q('#nutritionHead').textContent=f.auto_meta?.nutrition_calculated&&f.verified!=='yes'?'Расчётно на 100 г · проверить:':'На 100 г готового продукта:';
 if(f.nutrition&&!groups.nutrition.some(k=>parts[k])){const legacy=document.createElement('div');legacy.className='archive-nutrition-legacy edit';legacy.dataset.sheetField='fNutrition';legacy.contentEditable='true';legacy.textContent=f.nutrition;q('.card7 .body').append(legacy)}
 q('#brand').dataset.command='sheetProjectEdit';q('#brand').title='Изменить логотип бренда';
 if(!/море|more/i.test(p?.name||'')){q('.brandname').textContent=p?.name||'Ваш бренд';q('.brandsub').textContent=''}
 const logo=q('#logo');if(p&&validImg(p.logo_data))logo.src=p.logo_data;else if(!/море|more/i.test(p?.name||'')){logo.remove();q('.brandname').style.marginTop='35px'}
 q('#photoInput')?.remove();q('#photoBox').dataset.command='sheetPhoto';q('#photoBox').setAttribute('role','button');q('#photoBox').tabIndex=0;
 if(validImg(draft.photo_data)){q('#dishPhoto').src=draft.photo_data;q('#dishPhoto').style.display='block';q('#photoPlaceholder').style.display='none'}
 const rows=draft.lines||[];q('#recipeLines').id='sheetIngredients';q('#sheetIngredients').innerHTML=rows.map(buildSheetRow).join('');
 q('#recipeTable th:last-child').textContent='';q('#recipeTable th:last-child').classList.add('sheet-screen-only');
 q('#recipeTable tfoot td').colSpan=3;q('#totalYield').textContent=fmt(draft.yield_g)+' г';
 q('.smalltools').innerHTML='<button type="button" data-command="sheetAddLine">＋ Строка</button><span>Брутто: <b id="sheetTotalGross">'+fmt(rows.reduce((s,l)=>s+(Number(l.gross_g)||0),0))+' г</b> · Нетто: <b id="sheetTotalNet">'+fmt(rows.reduce((s,l)=>s+(Number(l.net_g)||0),0))+' г</b></span>';
 window.FARUKH_A4_EDITOR?.apply();
 window.FARUKH_TTK_SETTINGS?.apply();
 $('previewStatus').textContent=draft.status||'Черновик';refreshSheetToolbar();fitPaper();requestAnimationFrame(()=>{window.FARUKH_A4_EDITOR?.fit();detectOverflow()});renderReview();
}

/* One-sheet, WYSIWYG editing. Existing validated data model remains the source of truth. */
let sheetManualZoom=null, sheetOverflowRequest=0;
function refreshSheetToolbar(){
 const project=$('sheetProject'),status=$('sheetStatus'),verified=$('sheetVerified');
 if(!project||!status||!verified||!draft)return;
 const options=projects.filter(p=>!p.is_archived||p.id===draft.project_id);
 const now=project.value;
 const currentOptions=options.map(p=>p.id).join('|');
 if(project.dataset.optionIds!==currentOptions){
  project.innerHTML='<option value="">Выберите проект</option>'+options.map(p=>
   '<option value="'+p.id+'">'+esc(p.name)+'</option>').join('');
  project.dataset.optionIds=currentOptions;
 }
 project.value=draft.project_id||'';
 status.value=draft.status||'Черновик';
 verified.checked=draft.fields?.verified==='yes';
 document.querySelectorAll('[data-sheet-theme]').forEach(btn=>{
  btn.textContent=templates.find(t=>t.id===btn.dataset.sheetTheme)?.name||'';
  const active=btn.dataset.sheetTheme===draft.template;
  btn.classList.toggle('active',active);
  btn.setAttribute('aria-pressed',String(active));
 });
}
function collectSheetValues(){
 if(!draft)return;
 const paper=$('paper');
 if(!paper||!paper.classList.contains('sheet-document'))return;
 for(const field of paper.querySelectorAll('[data-sheet-field]')){
  const id=field.dataset.sheetField,hidden=$(id);
  if(!hidden)continue;
  const isNative=field.matches('input,select,textarea');
  let val=isNative?field.value:field.innerText;
  val=String(val||'').replace(/\u00a0/g,' ').replace(/\r/g,'').trim();
  if(id==='eTitle')val=val.slice(0,180);
  if(id==='eCode')val=val.slice(0,40);
  if(id==='eCategory')val=val.slice(0,90);
  hidden.value=val;
 }
 const archive=[...paper.querySelectorAll('[data-archive-field]')];
 if(archive.length){
  draft.fields=draft.fields||{};const parts=draft.fields.archive_parts||{};
  archive.forEach(el=>parts[el.dataset.archiveField]=(el.innerText||'').trim());draft.fields.archive_parts=parts;
  const ids={process:'fProcess',serving:'fServing',quality:'fQuality',nutrition:'fNutrition'};
  Object.entries(ids).forEach(([group,id])=>{const cells=archive.filter(el=>el.dataset.archiveGroup===group);const labels={protein:'Белки, г',fat:'Жиры, г',carbs:'Углеводы, г',kcal:'Энергия, ккал',quality_appearance:'Внешний вид',quality_consistency:'Консистенция',quality_taste:'Вкус и запах',quality_color:'Цвет',quality_safety:'Безопасность'};const text=cells.filter(el=>parts[el.dataset.archiveField]).map(el=>(labels[el.dataset.archiveField]?labels[el.dataset.archiveField]+': ':'')+parts[el.dataset.archiveField]).join('\n');if(group!=='nutrition'||text)$(id).value=text});
 }
 const rows=[...paper.querySelectorAll('tr[data-sheet-line]')];
 draft.lines=rows.map(tr=>{
  const name=tr.querySelector('[data-sheet-line-field="name"]');
  const gross=tr.querySelector('[data-sheet-line-field="gross_g"]');
  const net=tr.querySelector('[data-sheet-line-field="net_g"]');
  return {
   name:(name?.innerText||'').replace(/\u00a0/g,' ').trim().slice(0,180),
   gross_g:n(gross?.value??''),net_g:n(net?.value??'')
  };
 });
 renderLineRows(); // synchronize the hidden legacy form for shared save/validation functions
}
function sheetMassSummary(){
 if(!draft)return;
 const gross=draft.lines.reduce((acc,l)=>acc+(Number(l.gross_g)||0),0);
 const net=draft.lines.reduce((acc,l)=>acc+(Number(l.net_g)||0),0);
 if($('totalYield'))$('totalYield').textContent=fmt(draft.yield_g)+' г';
 if($('sheetTotalGross'))$('sheetTotalGross').textContent=fmt(gross)+' г';
 if($('sheetTotalNet'))$('sheetTotalNet').textContent=fmt(net)+' г';
 sumLines();
}
function sheetInputHandler(event){
 if(!draft||!event.target.closest('[data-sheet-field],[data-sheet-line],[data-archive-field]'))return;
 collectSheetValues();
 syncDraft({noPaperRender:true});
 sheetMassSummary();
 // Don't replace the live paper while the caret is inside an editable field.
 cancelAnimationFrame(sheetOverflowRequest);
 sheetOverflowRequest=requestAnimationFrame(()=>{window.FARUKH_A4_EDITOR?.fit();detectOverflow()});
}
function directSheetMove(index,direction){
 collectSheetValues();
 lineMove(index,direction);
}
function directSheetRemove(index){
 collectSheetValues();
 lineRemove(index);
}
function plainSheetPaste(event){
 const edit=event.target.closest('[contenteditable="true"]');
 if(!edit)return;
 event.preventDefault();
 const text=event.clipboardData?.getData('text/plain')||'';
 const max=edit.dataset.sheetField==='eTitle'?180:edit.dataset.sheetField==='eCode'?40:
  edit.dataset.sheetField==='eCategory'?90:edit.hasAttribute('data-sheet-line-field')?180:2400;
 const selection=window.getSelection();
 if(!selection||!selection.rangeCount)return;
 const range=selection.getRangeAt(0);
 const used=(edit.innerText||'').length-selection.toString().length;
 const chunk=text.replace(/\r/g,'').slice(0,Math.max(0,max-used));
 range.deleteContents();
 const node=document.createTextNode(chunk);
 range.insertNode(node);
 range.setStartAfter(node);range.collapse(true);
 selection.removeAllRanges();selection.addRange(range);
 edit.dispatchEvent(new Event('input',{bubbles:true}));
}
function sheetZoomBy(amount){
 const stage=$('paperStage');
 if(!stage)return;
 const natural=Math.min(1,Math.max(.35,(stage.clientWidth-28)/794));
 sheetManualZoom=Math.max(.4,Math.min(1.6,Math.round(((sheetManualZoom??natural)+amount)*100)/100));
 fitPaper();
}
function sheetSelectProject(){
 if(!draft)return;
 collectSheetValues();
 const id=$('sheetProject').value;
 if(!byProject(id)){tell('Выберите проект для ТТК',true);return}
 const prior=draft.project_id;
 $('eProject').value=id;
 if(!draft.id&&$('eCode').value===nextTtkCode(prior))$('eCode').value=nextTtkCode(id);
 syncDraft();
}
function sheetSelectStatus(){
 if(!draft)return;
 collectSheetValues();
 const value=$('sheetStatus').value;
 if(value==='Утверждено'){
  $('eStatus').value=value;
  syncDraft({noPaperRender:true});
  const issues=approvedIssues(draft);
  if(issues.length){
   $('eStatus').value='На проверке';
   draft.status='На проверке';
   $('sheetStatus').value='На проверке';
   tell('Пока нельзя утвердить ТТК: '+issues.slice(0,3).join(', ')+'. Сохраняй как черновик или «На проверке».',true);
  }
 }else $('eStatus').value=value;
 syncDraft();
}
function sheetCheckVerified(){
 if(!draft)return;
 const checked=$('sheetVerified').checked;
 if(checked&&!confirm('Подтверждаете, что сведения о сырье, аллергенах, КБЖУ и хранении проверены по документам и проработке?')){
  $('sheetVerified').checked=false;return;
 }
 collectSheetValues();
 $('fVerified').value=checked?'yes':'no';
 if(!checked&&$('eStatus').value==='Утверждено')$('eStatus').value='На проверке';
 syncDraft();
}

function fitPaper(){
 const stage=$('paperStage'),holder=$('paperHolder'),paper=$('paper');
 if(!stage||!holder||!paper||stage.clientWidth<50)return;
 const auto=Math.min(1,Math.max(.35,(stage.clientWidth-28)/794));
 const scale=sheetManualZoom??auto;
 holder.style.width=Math.round(794*scale)+'px';
 holder.style.height=Math.round(1123*scale)+'px';
 paper.style.transform='scale('+scale+')';
 if($('sheetZoomValue'))$('sheetZoomValue').textContent=Math.round(scale*100)+'%';
}
function detectOverflow(){
 const paper=$('paper'),stage=$('paperStage'),main=paper?.querySelector('.sheet-main');
 if(!paper||!stage||!main)return false;
 // Full A4: never silently clip content or shrink typography to hide overflows.
 const bodyOverflow=main.scrollHeight>main.clientHeight+3||main.scrollWidth>main.clientWidth+3;
 const pageOverflow=paper.scrollHeight>1126||paper.scrollWidth>797;
 const childOverflow=[...main.querySelectorAll('.sheet-section,.sheet-dish-header,.sheet-recipe-section,.sheet-signatures,.card .body,.card .edit,#f5 .edit,#nameStrip .edit,#foot .edit' )]
  .some(el=>el.scrollHeight>el.clientHeight+4||el.scrollWidth>el.clientWidth+4);
 const designerOverflow=window.FARUKH_A4_EDITOR?.hasOverflow()||false;
  const overflow=bodyOverflow||pageOverflow||childOverflow||designerOverflow;
 let hint=$('paperOverflow');
 if(!hint){
  hint=document.createElement('div');
  hint.id='paperOverflow';hint.className='notice sheet-overflow-notice';
  hint.style.marginTop='10px';stage.after(hint);
 }
 hint.hidden=!overflow;
 hint.textContent=overflow?
  '⚠️ Материалы не помещаются на 1 лист А4. Сократите формулировки без удаления обязательных сведений. Печать заблокирована, чтобы не обрезать документ.':'';
 if($('editorPrint')){
  $('editorPrint').disabled=overflow;
  $('editorPrint').title=overflow?'Переполнение листа А4. Сначала исправьте документ.':'Печать / сохранение в PDF';
 }
 return overflow;
}
async function printDocument(){
 if(!draft){tell('Сначала создайте или откройте ТТК',true);return}
 collectSheetValues();
 syncDraft();
 if(draft.status==='Утверждено'){
  const issues=approvedIssues(draft);if(issues.length){tell('Нельзя печатать как утверждённую ТТК: '+issues.slice(0,3).join(', '),true);return}
 }
 try{
  await Promise.all([...$('paper').querySelectorAll('img')].filter(img=>img.getAttribute('src')&&getComputedStyle(img).display!=='none').map(img=>img.decode()));
  if(document.fonts?.ready)await document.fonts.ready;
 }catch{tell('Фото или фон ещё не загружены. Проверьте соединение и повторите печать.',true);return}
 if(detectOverflow()){tell('Печать заблокирована: документ выходит за границы одного листа А4.',true);return}
 window.print();
}
/* Main actions and keyboard-safe event wiring. */
function onCommand(name){
 if(name==='sheetAddLine'){
  if(!draft)return;
  collectSheetValues();
  if(draft.lines.length>=100){tell('Не более 100 ингредиентов на ТТК.',true);return}
  draft.lines.push({name:'',gross_g:null,net_g:null});
  renderLineRows();dirty=true;renderPreview();
  const row=$('paper')?.querySelector('tr[data-sheet-line]:last-child [data-sheet-line-field="name"]');
  row?.focus();return;
 }
 if(name==='sheetUndoLine'){collectSheetValues();lineUndo();return}
 if(name==='sheetPhoto'){$('ePhotoInput')?.click();return}
 if(name==='sheetRemovePhoto'){
  if(!draft)return;
  collectSheetValues();
  if(!confirm('Удалить фотографию из этой ТТК?'))return;
  draft.photo_data=null;dirty=true;renderPhotoZone();renderPreview();return;
 }
 if(name==='sheetProjectEdit'){
  if(draft?.project_id)return openProjectDialog(draft.project_id);
  tell('Сначала выберите проект.',true);return;
 }
 if(name==='sheetZoomIn')return sheetZoomBy(.1);
 if(name==='sheetZoomOut')return sheetZoomBy(-.1);
 if(name==='sheetZoomFit'){sheetManualZoom=null;fitPaper();return}
 if(name==='newDoc')return startNewDoc();
 if(name==='newProject')return openProjectDialog();
 if(name==='closeProject'){pendingCreate=false;$('projectDialog').close();return}
 if(name==='closeCopy'){$('copyDialog').close();return}
 if(name==='saveDoc')return saveDocument();
 if(name==='library'||name==='projects'||name==='templates'||name==='dashboard'||name==='settings')return navigate(name);
 if(name==='addLine'){
  if(!draft)return;
  syncDraft();draft.lines.push({name:'',gross_g:null,net_g:null});
  renderLineRows();renderPreview();return;
 }
 if(name==='undoLine')return lineUndo();
 if(name==='clearEmptyLines')return clearEmptyLines();
 if(name==='showReview'){setTab('review');renderReview();return}
 if(name==='goTech'){setTab('tech');return}
 if(name==='removePhoto'){if(draft){draft.photo_data=null;dirty=true;renderPhotoZone();renderPreview()}return}
 if(name==='print')return printDocument();
 if(name==='duplicate'){if(draft?.id)return openCopy(draft.id);tell('Сначала сохраните ТТК для копирования.',true);return}
}
function clickHandler(ev){
 const t=ev.target;
 const btn=t.closest('[data-nav],[data-link],[data-command],[data-project-open],[data-project-edit],[data-project-archive],[data-project-remove],[data-doc-open],[data-doc-copy],[data-doc-archive],[data-doc-delete],[data-template-create],[data-editor-template],[data-tab],[data-remove-line],[data-sheet-remove],[data-sheet-move],[data-sheet-theme],[data-move-line],[data-duplicate-line],[data-review-tab]');
 if(!btn)return;
 if(btn.matches('a'))ev.preventDefault();
 if(btn.dataset.nav!==undefined){if(btn.dataset.nav==='editor'){if(draft)navigate('editor');else startNewDoc()}else navigate(btn.dataset.nav);return}
 if(btn.dataset.link!==undefined){navigate(btn.dataset.link);return}
 if(btn.dataset.command!==undefined){onCommand(btn.dataset.command);return}
 if(btn.dataset.projectOpen!==undefined){listForProject(btn.dataset.projectOpen);return}
 if(btn.dataset.projectEdit!==undefined){openProjectDialog(btn.dataset.projectEdit);return}
 if(btn.dataset.projectArchive!==undefined){toggleProjectArchive(btn.dataset.projectArchive);return}
 if(btn.dataset.projectRemove!==undefined){removeProject(btn.dataset.projectRemove);return}
 if(btn.dataset.docOpen!==undefined){openDocument(btn.dataset.docOpen);return}
 if(btn.dataset.docCopy!==undefined){openCopy(btn.dataset.docCopy);return}
 if(btn.dataset.docArchive!==undefined){archiveDocument(btn.dataset.docArchive);return}
 if(btn.dataset.docDelete!==undefined){deleteDocument(btn.dataset.docDelete);return}
 if(btn.dataset.templateCreate!==undefined){pendingTemplate=btn.dataset.templateCreate;startNewDoc(null,pendingTemplate);return}
 if(btn.dataset.editorTemplate!==undefined){if(draft){syncDraft();draft.template=btn.dataset.editorTemplate;dirty=true;renderEditorDesigns();renderPreview()}return}
 if(btn.dataset.sheetTheme!==undefined){
  if(!draft)return;
  collectSheetValues();
  if(templates.some(t=>t.id===btn.dataset.sheetTheme)){
   draft.template=btn.dataset.sheetTheme;dirty=true;renderPreview();
  }return;
 }
 if(btn.dataset.sheetRemove!==undefined){directSheetRemove(Number(btn.dataset.sheetRemove));return}
 if(btn.dataset.sheetMove!==undefined){
  directSheetMove(Number(btn.dataset.sheetMove),Number(btn.dataset.sheetMoveDir));return;
 }
 if(btn.dataset.tab!==undefined){setTab(btn.dataset.tab);return}
 if(btn.dataset.reviewTab!==undefined){setTab(btn.dataset.reviewTab);return}
 if(btn.dataset.moveLine!==undefined){lineMove(Number(btn.dataset.moveLine),Number(btn.dataset.direction));return}
 if(btn.dataset.duplicateLine!==undefined){lineDuplicate(Number(btn.dataset.duplicateLine));return}
 if(btn.dataset.removeLine!==undefined){lineRemove(Number(btn.dataset.removeLine));return}
}
function init(){
 paintIcons();
 document.addEventListener('click',clickHandler);
 $('loginForm').addEventListener('submit',signIn);
 $('logout').addEventListener('click',signOut);
 $('logoutMobile').addEventListener('click',signOut);
 $('projectForm').addEventListener('submit',saveProject);
 $('copyForm').addEventListener('submit',copyDocument);
 $('settingsForm').addEventListener('submit',saveSettings);
 $('pLogo').addEventListener('change',logoSelected);
 $('pRemoveLogo').addEventListener('click',()=>{modalLogo=null;renderLogoPreview();$('pLogoStatus').textContent='Логотип удалён из формы проекта'});
 for(const id of ['projectSearch','projectStatus'])$(id).addEventListener('input',renderProjects);
 for(const id of ['docSearch','docProject','docStatus'])$(id).addEventListener('input',renderLibrary);
 const editorIds=['eProject','eTitle','eCode','eCategory','eYield','eStatus',...Object.keys(fieldMap)];
 editorIds.forEach(id=>$(id).addEventListener('input',()=>{
  if(!draft)return;
  if(id==='eProject'&&!draft.id){
   const previous=nextTtkCode(draft.project_id);
   const current=$('eCode').value.trim();
   if(!current||current===previous)$('eCode').value=nextTtkCode($('eProject').value);
  }
  syncDraft();
 }));
 $('editorLines').addEventListener('input',()=>{if(draft)syncDraft()});
 $('ePhotoInput').addEventListener('change',photoSelected);
 $('paper').addEventListener('input',sheetInputHandler);
 $('paper').addEventListener('change',sheetInputHandler);
 $('paper').addEventListener('paste',plainSheetPaste);
 $('sheetProject').addEventListener('change',sheetSelectProject);
 $('sheetStatus').addEventListener('change',sheetSelectStatus);
 $('sheetVerified').addEventListener('change',sheetCheckVerified);

 window.FARUKH_A4_EDITOR?.init({
   getDraft:()=>draft,
   markDirty:()=>{dirty=true;renderReview()},
   checkOverflow:()=>{if(currentView==='editor')detectOverflow()},
   rerender:()=>{if(draft)renderPreview()}
  });
 window.FARUKH_TTK_SETTINGS?.init();
 window.FARUKH_TTK_AUTO?.init({
  getDraft:()=>draft,
  getPreferences:()=>prefs,
  setPreferences:x=>{prefs=x},
  getSession:()=>session,
  getDocs:()=>docs,
  getProjects:()=>projects,
  projectName:id=>byProject(id)?.name||'',
  isDirty:()=>dirty,
  api:(path,options)=>api(path,options),
  markDirty:()=>{dirty=true;renderReview()},
  sync:()=>{collectSheetValues();syncDraft({noPaperRender:true})},
  hydrate:()=>fillEditor(),
  reload:()=>loadAll()
 });
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{if(currentView==='editor')fitPaper()}).observe($('paperStage'));
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
 // Reuse the existing user login so this replacement starts empty without requiring new account setup.
 session=storedSession();
 if(!session){$('auth').hidden=false;return}
 (async()=>{if(await freshSession())await enter();else{
   session=null;persist();$('shell').hidden=true;$('auth').hidden=false;
 }})().catch(e=>{session=null;persist();$('shell').hidden=true;$('auth').hidden=false;
  $('authError').textContent='Войдите снова: '+errText(e)});
}
init();

})();

{const s=document.createElement("style");s.textContent="#paper.archive-sheet .archive-sheet-content[data-template][data-template=\"a4-02\"] #recipeTable th{background:#dcecf5;color:#173b50}";document.head.append(s);}
