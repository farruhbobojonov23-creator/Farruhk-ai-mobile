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
 verify(badge.includes('0.6.3'),'new interface release badge displayed');
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

 // Cloud success and failed-network queue are simulated inside the browser.
 // They never connect to or write a real Supabase account.
 await page.evaluate(()=>{
  cloudEnabled=true;
  cloudToken='x.'+btoa(JSON.stringify({sub:'00000000-0000-4000-8000-000000000061'}))+'.x';
  window.__fakeAuditWrites=0;window.__fakeCloudProducts=[];
  rest=async function(table,opts={}){
   if(table==='revision_products' && opts.method==='POST'){
    const item={id:crypto.randomUUID(),name:opts.body.name,unit:'кг',
      price_per_unit_rub:opts.body.price_per_unit_rub,
      has_semi_finished:false,pf_add_percent:0,active:true};
    window.__fakeCloudProducts.push(item);return [item];
   }
   if(table==='revision_products' && opts.query?.startsWith('?id=eq.'))return [window.__fakeCloudProducts.at(-1)];
   if(table==='revision_audits'&&opts.method==='POST'){
    window.__fakeAuditWrites++;
    return [{id:opts.body.id,created_at:new Date().toISOString()}];
   }
   throw Error('Unexpected fake cloud call: '+table);
  };
 });
 await page.locator('.menu button[onclick*="products"]').click();
 await page.locator('#newproduct').fill('Тестовый облачный продукт');
 await page.locator('#rev061NewPrice').fill('1390');
 await page.locator('button[onclick="addProduct()"]').click();
 await page.waitForFunction(()=>state.products.includes('Тестовый облачный продукт'));
 const cloudRowText=await page.locator('#productsrows tr').filter({hasText:'Тестовый облачный продукт'}).innerText();
 console.log('Cloud catalogue row:',JSON.stringify(cloudRowText));
 verify(/1[\s\u00a0\u202f]*390/.test(cloudRowText),'cloud product price stored and shown');
 await page.locator('.menu button[onclick*="revision"]').click();
 await page.locator('#store').selectOption({label:'Героев Североморцев'});
 await page.locator('#mode').selectOption('start');
 await page.evaluate(()=>{
  document.querySelectorAll('#rows tr[data-product]').forEach((tr,i)=>{
   const raw=tr.querySelector('input[data-field="raw"]');
   if(raw){raw.value=String(i+2);raw.dispatchEvent(new Event('input',{bubbles:true}))}
  });
 });
 await page.locator('button[onclick="saveRevision()"]').click();
 await page.locator('.rev060-popup .btn.main').click();
 await page.waitForFunction(()=>document.querySelector('#rev060Save')?.dataset.status==='success',{timeout:10000});
 verify(await page.evaluate(()=>window.__fakeAuditWrites)===1,'cloud saves exactly once (no overlapping old handlers)');
 verify(await page.evaluate(()=>state.history.filter(r=>r.store==='Героев Североморцев'&&r.type==='start').length)===1,
  'cloud success appears once in selected outlet');
 verify(await page.evaluate(()=>state.history.find(r=>r.store==='Героев Североморцев')?.products.find(p=>p.name==='Тестовый облачный продукт')?.price)===1390,
  'cloud price reused in revision without re-entering it');
 if(await page.locator('.rev060-popup').count())await page.locator('.rev060-popup .btn').first().click();
 // Now make the mocked network fail: the record must go only to a durable local queue.
 await page.evaluate(()=>{
  rest=async function(table,opts){if(table==='revision_audits'&&opts?.method==='POST')throw Error('Test simulated network outage');throw Error('Unexpected request')}
 });
 await page.locator('#store').selectOption({label:'Полярные Зори'});
 await page.locator('#mode').selectOption('start');
 await page.evaluate(()=>{
  document.querySelectorAll('#rows tr[data-product]').forEach((tr,i)=>{
   const raw=tr.querySelector('input[data-field="raw"]');
   if(raw){raw.value=String(i+3);raw.dispatchEvent(new Event('input',{bubbles:true}))}
  });
 });
 await page.locator('button[onclick="saveRevision()"]').click();
 await page.locator('.rev060-popup .btn.main').click();
 await page.waitForFunction(()=>document.querySelector('#rev060Save')?.dataset.status==='pending',{timeout:10000});
 const queueCheck=await page.evaluate(()=>({queue:rev041Queue().length,marked:state.history.filter(r=>r.store==='Полярные Зори'&&r.pendingSync).length}));
 verify(queueCheck.queue===1&&queueCheck.marked===1,'cloud outage retains exactly one queued local audit');

 if(await page.locator('.rev060-popup').count())await page.locator('.rev060-popup .btn').first().click();
 // Saved weekly data only; never display drafts or overwrite stored audit snapshots.
 await page.evaluate(()=>{
   state.history.push({
    id:crypto.randomUUID(),store:'Плазма',type:'weekly',date:'2026-11-24',timestamp:Date.now()+1000,
    products:[
     {name:'Лосось',diff:-1.5,price:null,program:10,actual:8.5},
     {name:'Угорь',diff:4.25,price:800,program:4,actual:8.25},
     {name:'Сыр',diff:0,price:250,program:5,actual:5},
     {name:'Мидии',diff:-0.5,price:1000,program:3,actual:2.5},
     {name:'Краб',diff:2,price:700,program:2,actual:4}
    ]
   });
   renderSummary();
 });
 await page.locator('.menu button[onclick*="summary"]').click();
 const plasma=page.locator('.rev053-store-card[data-rev053-store="Плазма"]');
 const mini=plasma.locator('.rev063-mini');
 await mini.waitFor();
 verify((await mini.innerText()).includes('Лосось')&&(await mini.innerText()).includes('нет цены'),'saved shortage with missing historical price is honest');
 const miniText=await mini.innerText();
 verify(miniText.includes('Угорь')&&/3[\s\u00a0\u202f]*400/.test(miniText),'saved surplus shows price multiplied by quantity');
 verify(await plasma.locator('.rev063-row').count()===5,'all five saved products included (including matches)');
 verify(await plasma.locator('.rev063-row:visible').count()===5,'all five products visible without expansion');
 verify((await page.locator('.rev053-store-card[data-rev053-store="Баумана 18"] .rev063-mini').innerText()).includes('После первой ревизии'),
  'no product data leaked from Плазма to an outlet with no saved audit');
 verify((await mini.innerText()).includes('Сыр')&&(await mini.innerText()).includes('0 ₽'),
   'matching product shows zero kilograms and rubles');
 verify(await plasma.locator('.rev062-toggle').count()===0,'no extra expand button required');
 const boxes=await plasma.evaluate(card=>({
  table:card.querySelector('.rev063-mini')?.getBoundingClientRect().toJSON(),
  button:card.querySelector('.point-open')?.getBoundingClientRect().toJSON(),
  card:card.getBoundingClientRect().toJSON()
 }));
 verify(boxes.table.bottom<=boxes.button.top+1,'mini table does not overlap open-point action');
 verify(boxes.button.bottom<=boxes.card.bottom+1,'mini table and action fit inside the outlet card');
 const other=page.locator('.rev053-store-card[data-rev053-store="Баумана 18"]');
 const heights=await Promise.all([plasma,other].map(async tile=>tile.evaluate(node=>({
  card:node.getBoundingClientRect().toJSON(),
  button:node.querySelector('.point-open').getBoundingClientRect().toJSON()
 }))));
 verify(Math.abs(heights[0].button.top-heights[1].button.top)<=1,
  'first row outlet actions share the same vertical baseline');
 verify(Math.abs(heights[0].card.bottom-heights[1].card.bottom)<=1,
  'first row cards have equal bottom edge');
 verify(await page.locator('.rev053-store-card[data-rev053-store="Героев Североморцев"] .rev063-row').count()>0,
  'saved initial revision lists all stock products without invented plus/minus');
 verify(await page.locator('.rev053-store-card[data-rev053-store="Полярные Зори"] .rev063-row').count()>0,
  'offline initial revision lists its saved stock products');
 await page.screenshot({path:path.join(out,'revision-v063-full-table-mobile.png'),fullPage:true});


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