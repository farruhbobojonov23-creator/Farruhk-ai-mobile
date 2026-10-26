// Real Chromium tap smoke for FARUKH PRINT on local static site.
// No real employees, credentials, cloud writes or Bluetooth jobs involved.
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';

const port=18865;
const http=spawn('python3',['-m','http.server',String(port),'--directory','public'],{stdio:'pipe'});
const errors=[];
http.stderr.on('data',chunk=>{const str=String(chunk);if(/Traceback|Error/.test(str))errors.push(str)});
async function available(){
 for(let i=0;i<50;i++){
  try{const r=await fetch('http://127.0.0.1:'+port+'/farukh-print/');if(r.ok)return}catch{}
  await delay(150);
 }
 throw Error('Static test server did not start');
}
async function tapFlow(browser,config){
 const ctx=await browser.newContext({
  viewport:config.viewport,
  isMobile:config.mobile,hasTouch:true,
  deviceScaleFactor:config.mobile?2:1
 });
 const page=await ctx.newPage();
 const consoleErrors=[];
 page.on('pageerror',e=>consoleErrors.push(String(e)));
 try{
  await page.goto('http://127.0.0.1:'+port+'/farukh-print/',{waitUntil:'domcontentloaded'});
  await page.locator('#choose-prep').click();
  await page.locator('.product-tile').first().waitFor({state:'visible',timeout:12000});
  const first=page.locator('.product-tile').first();
  await first.locator('.product-qr-button').click({timeout:7000});
  await page.locator('#pro-qr-card[open]').waitFor({timeout:9000});
  assert.ok(await page.locator('#pro-qr-art svg').count(),'QR code generated');
  await page.locator('#pro-qr-card-close').click();
  assert.equal(await page.locator('#pro-qr-card[open]').count(),0);
  await first.locator('.product-qr-button').click();
  await page.locator('#pro-qr-card[open]').waitFor();
  await page.locator('#pro-qr-card-close').click();
  await first.locator('.product-tips').click({timeout:7000});
  await page.locator('dialog.print-advice-dialog[open]').waitFor({timeout:10000});
  for(const label of ['Хранение','Соседство','Нормы','Советы']){
    await page.getByRole('tab',{name:label}).click();
    assert.ok(await page.getByRole('tab',{name:label}).getAttribute('aria-selected')==='true');
  }
  await page.locator('.print-advice-close').click();
  assert.equal(await page.locator('dialog.print-advice-dialog[open]').count(),0);
  await page.locator('#pro-qr-open').click();
  await page.locator('#pro-qr-dialog[open]').waitFor({timeout:8000});
  await page.locator('#pro-qr-close').click();
  assert.equal(await page.locator('#pro-qr-dialog[open]').count(),0);
  assert.equal(await page.locator('#print-now').isDisabled(),true,'guest cannot print');
  const chips=page.locator('.category-chip');
  if(await chips.count()>1)await chips.nth(1).click();
  await page.locator('#print-nav-home').click();
  await page.locator('#choose-ready').click();
  assert.ok(await page.locator('#catalog').isVisible());
  const screenshotPath='artifacts/print-qr-'+config.name+'.png';
  await page.screenshot({path:screenshotPath,fullPage:false});
  if(consoleErrors.length)throw Error('Browser JS exceptions: '+consoleErrors.join('\n'));
  console.log('PASS '+config.name+': QR twice, advice tabs, scanner, categories, home, ready, guest access');
 }finally{await ctx.close()}
}
let browser;
try{
 await available();
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 await tapFlow(browser,{name:'android',viewport:{width:390,height:844},mobile:true});
 await tapFlow(browser,{name:'ipad',viewport:{width:820,height:1180},mobile:false});
 console.log('QR browser tap smoke passed for Android and tablet viewports');
}finally{
 if(browser)await browser.close();
 http.kill('SIGTERM');
}
if(errors.length)console.warn('HTTP server:',errors.join('\n'));
