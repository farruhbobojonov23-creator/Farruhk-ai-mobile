'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('/tmp/supply-qa/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:393,height:873},isMobile:true,hasTouch:true});
  page.on('dialog',d=>d.accept());
  const exceptions=[];page.on('pageerror',e=>exceptions.push(e.message));
  await page.goto('http://127.0.0.1:8766/index.html');
  await page.waitForFunction(()=>typeof window.supplyOcrFinish==='function');
  await page.locator('[data-go="entry"]').first().click();
  await page.locator('#file').setInputFiles([
   {name:'synthetic-page-1.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5EAX0AAAAASUVORK5CYII=','base64')},
   {name:'synthetic-page-2.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5EAX0AAAAASUVORK5CYII=','base64')}
  ]);
  const raw=[
   'Счет-фактура № 123 от 09 ноября 2026 г.\nПоставщик: ООО «Тестовый поставщик»\nНаименование товара Стоимость товаров\n1 Сыр учебный 778 упак 3,000 828,18 2 484,55 без акциза 10% 248,45 2 733,00\n2 Панировка учебная 796 шт 4,000 233,64 934,55 без акциза 10% 93,45 1 028,00\nВсего к оплате (9) 3419.10 341.90 3761,00',
   'Страница 2 из 2\nВСЕГО ПЕРЕДАНО 3 761,00\nАкт приёма-передачи'
  ];
  const result=await page.evaluate(raw=>{
   window.supplyOcrStart(9001);
   window.supplyOcrFinish(9001,'FARUKH_PDF_PAGES_V1\n'+JSON.stringify(raw),'','[]');
   return {
    status:document.querySelector('#ocrState').textContent,
    count:document.querySelector('#lines').children.length,
    pages:eval('pages.map(p=>({name:p.file?.name,footerOnly:p.footerOnly,number:p.number,expected:p.expected,review:p.reviewRequired}))'),
    inputFiles:document.querySelector('#file').files.length,
    supplier:document.querySelector('#supplier').value,
    saveDisabled:document.querySelector('#save').disabled
   };
  },raw);
  assert.equal(result.inputFiles,2,'Both originals selected');
  assert.equal(result.pages.length,2,'Footer-only sheet should not be silently discarded');
  assert.equal(result.pages[0].name,'synthetic-page-1.png');
  assert.equal(result.pages[1].name,'synthetic-page-2.png');
  assert.equal(result.pages[1].footerOnly,true);
  assert.equal(result.pages[1].review,true,'Footer-only page requires human review');
  assert.ok(result.status.includes('2 стр.'),result.status);
  assert.ok(result.count>=2,'Recognized item rows remain visible for review');
  assert.ok(!result.saveDisabled,'Reviewed draft may be corrected and saved explicitly');
  assert.ok(!exceptions.length,'Browser JS errors: '+exceptions.join('; '));
  console.log('SUPPLY_NATIVE_MULTIPAGE_BROWSER_REVIEW_PASS (synthetic text and image placeholders; NOT real photo OCR)');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
