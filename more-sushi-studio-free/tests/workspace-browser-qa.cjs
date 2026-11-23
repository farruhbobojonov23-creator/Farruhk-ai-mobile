/* Standalone Chromium UI regression test: runs ONLY against localhost.
 * No production auth, no Supabase writes, no TTK/revision data mutations.
 * Screenshots and pass/fail report are saved for review.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const appRoot=path.resolve(__dirname,'..');
const out=path.join(__dirname,'qa-results');
fs.mkdirSync(out,{recursive:true});
const checks=[];
let fatal=false;
const assert=(ok,msg)=>{checks.push({ok:!!ok,msg});if(!ok)fatal=true;console.log((ok?'PASS ':'FAIL ')+msg)};
const mime={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'text/javascript;charset=utf-8','.json':'application/json;charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{
 let target;
 try{
  const wanted=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  target=path.resolve(appRoot,'.'+wanted);
  if(target!==appRoot&&!target.startsWith(appRoot+path.sep))throw Error('Path escape');
  if(!fs.statSync(target).isFile())throw Error('Not file');
  res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(target).pipe(res);
 }catch(e){res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found')}
});
function checkWithinWidth(rect,width,msg){
 const ok=rect&&rect.x>=-1&&rect.x+rect.width<=width+1&&rect.width>0;
 assert(ok,msg+(rect?' x='+rect.x.toFixed(1)+' right='+(rect.x+rect.width).toFixed(1):' missing'));
}
async function runView(browser,{width,height,label}){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<=480,hasTouch:width<=480});
 await context.route('https://mhsmmssipligbmvfzkce.supabase.co/**',route=>route.fulfill({status:401,body:'{}',headers:{'access-control-allow-origin':'*'}}));
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8898/mobile.html',{waitUntil:'domcontentloaded',timeout:20000});
 await page.locator('#hubSplash').waitFor({state:'hidden',timeout:7000});
 await page.locator('#hubFeaturedProjects .project-card').first().waitFor({state:'visible'});
 await page.waitForTimeout(500);
 assert(await page.locator('.bottomnav [data-mss-tab]').count()===5,label+' — пять кнопок меню');
 assert(await page.locator('#hubFeaturedProjects .project-card').count()===7,label+' — семь проектов на главной');
 assert(await page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--ruby').trim())==='#d61045',label+' — новая единая тема');
 const sheets=await page.locator('link[rel=stylesheet]').evaluateAll(links=>links.map(x=>new URL(x.href).pathname));
 assert(sheets.length===1&&sheets[0]==='/workspace-command.css',label+' — одна активная CSS тема без старых накладок');
 const img=await page.locator('.hero-photo').evaluate(el=>el.complete&&el.naturalWidth>0);
 assert(img,label+' — главное фото действительно загрузилось');
 const scrollWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
 assert(scrollWidth<=width+1,label+' — нет горизонтальной прокрутки, ширина '+scrollWidth);
 const navRect=await page.locator('.bottomnav').boundingBox();
 checkWithinWidth(navRect,width,label+' — нижнее меню в пределах экрана');
 const logoRect=await page.locator('.brand-identity').boundingBox();
 checkWithinWidth(logoRect,width,label+' — шапка не обрезана');
 await page.screenshot({path:path.join(out,label+'-home.png'),fullPage:true});
 await page.locator('.bottomnav [data-mss-tab="projects"]').click();
 await page.locator('#mss-projects').waitFor({state:'visible'});
 assert(await page.locator('#hubAllProjects .project-card').count()===7,label+' — вкладка Проекты загружает все 7');
 assert(await page.locator('#mss-home').isHidden(),label+' — предыдущая вкладка скрыта');
 await page.screenshot({path:path.join(out,label+'-projects.png'),fullPage:true});
 await page.locator('.bottomnav [data-mss-tab="ttk"]').click();
 await page.locator('#mss-ttk').waitFor({state:'visible'});
 assert(await page.locator('#mss-ttk a[href*="index.html"]').count()===4,label+' — рабочие ТТК маршруты');
 await page.locator('.bottomnav [data-mss-tab="tools"]').click();
 await page.locator('#mss-tools').waitFor({state:'visible'});
 assert(await page.locator('#mss-tools .action-card').count()===5,label+' — быстрые инструменты');
 await page.locator('.bottomnav [data-mss-tab="more"]').click();
 await page.locator('#mss-more').waitFor({state:'visible'});
 assert(await page.locator('#mss-more [data-ocean-refresh]').count()===1,label+' — кнопка обновления существует');
 await page.locator('.bottomnav [data-mss-tab="home"]').click();
 await page.locator('#hubFeaturedProjects .project-card .project-go').first().click();
 await page.locator('#hubViewer').waitFor({state:'visible',timeout:5000});
 const iframeSrc=await page.locator('#hubViewerFrame').getAttribute('src');
 assert(iframeSrc.includes('index.html'),label+' — проект MORE SUSHI открывается через встроенное окно');
 assert(await page.locator('#hubViewerExternal').getAttribute('href')!==null,label+' — доступен fallback Открыть отдельно');
 await page.locator('#hubViewerBack').click();
 await page.locator('#hubViewer').waitFor({state:'hidden',timeout:5000});
 assert(await page.locator('#mss-home').isVisible(),label+' — возвращение из проекта работает');
 assert(errors.length===0,label+' — нет необработанных ошибок JavaScript'+(errors.length?': '+errors.join(' | ').slice(0,250):''));
 await context.close();
}
async function runStorage(browser){
 const ctx=await browser.newContext({viewport:{width:393,height:852}});
 await ctx.route('https://mhsmmssipligbmvfzkce.supabase.co/**',route=>route.fulfill({status:401,body:'{}',headers:{'access-control-allow-origin':'*'}}));
 const p=await ctx.newPage();
 await p.goto('http://127.0.0.1:8898/mobile.html#projects',{waitUntil:'domcontentloaded'});
 await p.locator('#hubSkipSplash').click().catch(()=>{});
 await p.locator('#mss-projects').waitFor({state:'visible'});
 await p.locator('#mss-projects [data-hub-add]').click();
 await p.locator('#hubProjectDialog').waitFor({state:'visible'});
 await p.fill('#hubEditName','ТЕСТ QA');
 await p.fill('#hubEditUrl','https://example.com/');
 await p.fill('#hubEditDescription','Проверка локальных данных');
 await p.locator('#hubProjectForm button[type=submit]').click();
 await p.locator('#hubAllProjects').getByText('ТЕСТ QA').waitFor({state:'visible'});
 assert(await p.locator('#hubAllProjects .project-card').count()===8,'CRUD — создан новый восьмой проект');
 await p.reload({waitUntil:'domcontentloaded'});
 await p.locator('#hubAllProjects').getByText('ТЕСТ QA').waitFor({state:'visible'});
 assert(await p.locator('#hubAllProjects .project-card').count()===8,'Storage — проект сохранился после перезагрузки');
 await p.fill('#hubProjectSearch','ТЕСТ QA');
 assert(await p.locator('#hubAllProjects .project-card').count()===1,'Search — поиск отфильтровал проекты');
 await p.locator('#hubAllProjects .project-card .project-fav').click();
 assert(await p.locator('#hubAllProjects .project-card .project-fav.is-favorite').count()===1,'Favorites — избранное работает');
 await ctx.close();
}
async function main(){
 await new Promise((ok,fail)=>server.listen(8898,'127.0.0.1',e=>e?fail(e):ok()));
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const v of [{width:393,height:852,label:'phone-393'},{width:360,height:700,label:'phone-360'},{width:768,height:1024,label:'tablet-768'}]){
   try{await runView(browser,v)}catch(e){assert(false,v.label+' — runtime '+e.message)}
  }
  try{await runStorage(browser)}catch(e){assert(false,'CRUD/storage — runtime '+e.message)}
 }finally{
  if(browser)await browser.close();
  server.close();
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({runAt:new Date().toISOString(),checks,passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok).length},null,2));
 }
 console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok).length}));
 if(fatal)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;server.close()});
