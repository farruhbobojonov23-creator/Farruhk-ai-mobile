/* FARUKH REVISION smoke QA — anonymous localhost only.
 * Real Chromium and touch-sized viewport. No production database writes.
 */
'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const out=path.resolve(__dirname,'qa-results');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const full=path.resolve(root,'.'+pathname);
  if(!(full===root||full.startsWith(root+path.sep))||!fs.statSync(full).isFile())throw Error('Invalid path');
  res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(full).pipe(res);
 }catch(err){res.writeHead(404);res.end('Not found')}
});
const checks=[];
function verify(flag,message){checks.push({pass:!!flag,message});console.log((flag?'PASS':'FAIL')+' '+message);if(!flag)throw Error(message)}
async function test(browser){
 const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 await context.route('https://mhsmmssipligbmvfzkce.supabase.co/**',route=>route.fulfill({status:401,body:'{}',headers:{'access-control-allow-origin':'*'}}));
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8899/revision.html',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(1500);
 const diagnostics=await page.evaluate(()=>({ready:document.readyState,brand:document.querySelector('.brandword')?.outerHTML?.slice(0,330),versionCount:document.querySelectorAll('.rev061-version').length,priceInputCount:document.querySelectorAll('#rev061NewPrice').length,activeView:document.querySelector('.menu button.active')?.textContent?.trim()}));
 console.log('Revision boot diagnostics:',JSON.stringify(diagnostics),'JS errors:',JSON.stringify(errors));
 await page.screenshot({path:path.join(out,'revision-v061-debug-initial.png'),fullPage:true});
 await page.locator('.rev061-version').waitFor({state:'attached',timeout:5000});
 const badge=(await page.locator('.rev061-version').innerText()).trim();
 verify(badge.includes('0.6.1'),'new interface release badge displayed');
 await page.waitForTimeout(300);
 // Skip intro by using its existing skip button, when available.
 const skip=page.locator('#premiumBoot [data-boot-skip]');
 if(await skip.count())await skip.click({timeout:6000}).catch(()=>{});
 await page.locator('.menu button[onclick*="products"]').click();
 await page.locator('#rev061NewPrice').waitFor({state:'attached'});
 const before=await page.locator('#productsrows tr').count();
 verify(before>=3,'existing products loaded');
 await page.locator('#newproduct').fill('Проверочный тестовый продукт');
 await page.locator('#rev061NewPrice').fill('750,50');
 await page.locator('button[onclick="addProduct()"]').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('#productsrows tr')].some(tr=>tr.textContent.includes('Проверочный тестовый продукт')),null,{timeout:10000});
 verify(await page.locator('#productsrows tr').count()===before+1,'new product created');
 const catalogRow=page.locator('#productsrows tr').filter({hasText:'Проверочный тестовый продукт'});
 verify((await catalogRow.innerText()).includes('750,50'),'single catalog price preserved');
 await page.locator('.menu button[onclick*="revision"]').click();
 await page.locator('#store').selectOption({label:'Плазма'});
 await page.locator('#mode').selectOption('start');
 await page.waitForTimeout(250);
 // Fill the inputs without auto keyboard popups — same DOM input events as touch.
 await page.evaluate(()=>{
  document.querySelectorAll('#rows tr[data-product]').forEach((tr,i)=>{
   const raw=tr.querySelector('input[data-field="raw"]');
   if(raw){raw.value=String(i+1);raw.dispatchEvent(new Event('input',{bubbles:true}))}
  });
 });
 await page.locator('#rev060Report').waitFor({state:'attached'});
 const pre=await page.locator('#rev060Save').innerText();
 verify(pre.includes('Черновик'),'before saving clearly identified as a draft');
 const save=page.locator('button[onclick="saveRevision()"]');
 await save.click();
 await page.locator('.rev060-popup').waitFor({timeout:7000});
 const confirm=await page.locator('.rev060-popup .rev060-box').innerText();
 verify(confirm.includes('Плазма'),'confirmation identifies selected outlet');
 await page.locator('.rev060-popup .btn.main').click();
 await page.waitForFunction(()=>document.querySelector('#rev060Save')?.dataset.status==='success',{timeout:10000}).catch(()=>{});
 const status=await page.locator('#rev060Save').getAttribute('data-status');
 verify(status==='success','successful local save verified with green receipt');
 const archive=await page.evaluate(()=>state.history.filter(r=>r.store==='Плазма'&&r.type==='start').length);
 verify(archive===1,'only one initial revision created in local history');
 const productPrice=await page.evaluate(()=>state.history.find(r=>r.store==='Плазма'&&r.type==='start')?.products.find(p=>p.name==='Проверочный тестовый продукт')?.price);
 verify(productPrice===750.5,'new revision used one-time product catalogue price');
 await page.screenshot({path:path.join(out,'revision-v061-saved-mobile.png'),fullPage:true});
 const overlay=page.locator('.rev060-popup');
 if(await overlay.count())await overlay.locator('.btn').first().click();
 await page.locator('.menu button[onclick*="products"]').click();
 const newRow=page.locator('#productsrows tr').filter({hasText:'Проверочный тестовый продукт'});
 verify((await newRow.innerText()).includes('750,50'),'price persists when moving between sections');
 // Reopening after page load should keep local audit and price.
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.rev061-version').waitFor({timeout:10000});
 const reloaded=await page.evaluate(()=>({count:state.history.filter(r=>r.store==='Плазма').length,price:localStorage.getItem('farukh-revision-catalogue-prices-v060')}));
 verify(reloaded.count===1,'saved audit persists across reload');
 verify(reloaded.price.includes('750.5'),'catalogue purchase price persists across reload');
 verify(errors.length===0,'no uncaught page errors: '+errors.join(' | ').slice(0,300));
 await context.close();
}
(async()=>{
 let browser;
 try{
  await new Promise(resolve=>server.listen(8899,'127.0.0.1',resolve));
  const bin=process.env.CHROME_BIN||'/usr/bin/google-chrome';
  try{browser=await chromium.launch({headless:true,executablePath:fs.existsSync(bin)?bin:undefined,args:['--no-sandbox']})}
  catch(error){browser=await chromium.launch({headless:true,args:['--no-sandbox']})}
  await test(browser);
  fs.writeFileSync(path.join(out,'revision-v061-report.json'),JSON.stringify({checks,passed:checks.every(x=>x.pass)},null,2));
  console.log('FARUKH REVISION QA PASSED: '+checks.length+' checks.');
 }catch(error){
  console.error(error?.stack||error);
  fs.writeFileSync(path.join(out,'revision-v061-report.json'),JSON.stringify({checks,passed:false,error:String(error)},null,2));
  process.exitCode=1;
 }finally{if(browser)await browser.close();server.close()}
})();