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

async function runCloud(browser){
 const uid='00000000-0000-4000-a000-000000000011';
 const fake={owner_id:uid,projects:[],favorites:[],updated_at:new Date(Date.now()-10000).toISOString()};
 const writes=[];
 const cloudRoute=async(route)=>{
  const u=new URL(route.request().url());
  const method=route.request().method();
  if(u.pathname.endsWith('/auth/v1/user')){
   return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({id:uid,email:'qa@example.test'})});
  }
  if(u.pathname.endsWith('/rest/v1/workspace_hub_settings')){
   if(method==='GET'){
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(fake.updated_at?[fake]:[])});
   }
   if(method==='POST'){
    const json=route.request().postDataJSON();writes.push(json);
    Object.assign(fake,json);
    return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'apikey,authorization,content-type,prefer','access-control-allow-methods':'GET,POST,OPTIONS'}});
   }
  }
  return route.fulfill({status:401,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});
 };
 async function createUserPage(context){
  await context.addInitScript(({uid})=>{
   localStorage.setItem('ms_session',JSON.stringify({
    access_token:'qa-auth-token',refresh_token:'qa-refresh-token',
    expires_at:Math.floor(Date.now()/1000)+3600,user:{id:uid,email:'qa@example.test'}
   }));
  },{uid});
  await context.route('https://mhsmmssipligbmvfzkce.supabase.co/**',cloudRoute);
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8898/mobile.html#projects',{waitUntil:'domcontentloaded'});
  await page.locator('#hubSkipSplash').click().catch(()=>{});
  await page.waitForFunction(()=>document.querySelector('#hubCloudState')?.dataset.state==='ok',{timeout:8000});
  assert(await page.locator('#hubCloudSyncNow').isEnabled(),'Cloud — after read, refresh button is enabled');
  return {page,errors};
 }
 let ctx=await browser.newContext({viewport:{width:393,height:852}});
 const first=await createUserPage(ctx);
 const p=first.page;
 await p.locator('#mss-projects [data-hub-add]').click();
 await p.fill('#hubEditName','ОБЛАКО QA');
 await p.fill('#hubEditUrl','https://example.org/');
 await p.fill('#hubEditDescription','Тест синхронизации');
 await p.locator('#hubProjectForm button[type=submit]').click();
 await p.waitForFunction(()=>document.querySelector('#hubCloudState')?.dataset.state==='ok'
  &&document.querySelector('#hubCloudSyncNow')?.disabled===false,{timeout:12000});
 await p.waitForTimeout(1200);
 assert(writes.some(x=>Array.isArray(x.projects)&&x.projects.some(y=>y.name==='ОБЛАКО QA')),
  'Cloud — after local edit, payload uploaded to private table');
 assert(writes.every(x=>x.owner_id===uid),'Cloud — payload owner must match authenticated user');
 assert(first.errors.length===0,'Cloud — zero JS runtime errors');
 await ctx.close();
 // A new browser/device does not have the first browser's localStorage.
 const secondContext=await browser.newContext({viewport:{width:393,height:852}});
 const second=await createUserPage(secondContext);
 await second.page.locator('#hubAllProjects').getByText('ОБЛАКО QA').waitFor({state:'visible',timeout:7000});
 assert(await second.page.locator('#hubAllProjects .project-card').count()===8,
  'Cloud — project restored on a second browser without local cache');
 assert(second.errors.length===0,'Cloud second device — zero JS runtime errors');
 await secondContext.close();
}


async function runHandoff(browser){
 const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
 const p=await ctx.newPage();
 const errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 const targets=[
  {name:'FARRUH AI',pattern:'https://farruhk-ai-mobile.onrender.com/',path:'/'},
  {name:'FARUKH PRINT',pattern:'https://farruhk-ai-mobile.onrender.com/farukh-print/staff/',path:'/farukh-print/staff/'},
  {name:'СУШИ БЕРИ',pattern:'https://sushi-beri.ru/murmansk',path:'/murmansk'}
 ];
 await p.route('https://farruhk-ai-mobile.onrender.com/**',route=>route.fulfill({
  status:200,contentType:'text/html',body:'<!doctype html><title>Direct external app</title><h1>Direct app loaded</h1>'
 }));
 await p.route('https://sushi-beri.ru/**',route=>route.fulfill({
  status:200,contentType:'text/html',body:'<!doctype html><title>Direct Sushi Beri</title><h1>Delivery loaded</h1>'
 }));
 await p.route('https://mhsmmssipligbmvfzkce.supabase.co/**',route=>route.fulfill({status:401,body:'{}',headers:{'access-control-allow-origin':'*'}}));
 for(const item of targets){
  await p.goto('http://127.0.0.1:8898/mobile.html#home',{waitUntil:'domcontentloaded'});
  await p.locator('#hubSkipSplash').click().catch(()=>{});
  const card=p.locator('#hubFeaturedProjects .project-card').filter({hasText:item.name});
  await card.locator('.project-go').click();
  await p.waitForURL(u=>u.href.startsWith(item.pattern),{timeout:10000});
  assert(p.url().startsWith(item.pattern),'External handoff '+item.name+' — top-level navigation, not iframe');
  assert(await p.locator('#hubViewer').count()===0,'External handoff '+item.name+' — old modal not visible in destination');
  await p.goBack({waitUntil:'domcontentloaded'});
  await p.locator('#hubFeaturedProjects .project-card').first().waitFor({state:'attached',timeout:10000});
  assert(new URL(p.url()).pathname==='/mobile.html','External handoff '+item.name+' — system Back restores Workspace');
 }
 assert(errors.length===0,'External handoff — no JavaScript runtime errors');
 await ctx.close();
}


async function runRecipeCatalog(browser){
 const uid='00000000-0000-4000-a000-000000000011';
 const ctx=await browser.newContext({viewport:{width:393,height:852},hasTouch:true,isMobile:true});
 await ctx.addInitScript(({uid})=>{
  localStorage.setItem('ms_session',JSON.stringify({access_token:'qa-auth-token',refresh_token:'qa-refresh-token',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:uid,email:'qa@example.test'}}));
 },{uid});
 const requests=[];
 await ctx.route('https://mhsmmssipligbmvfzkce.supabase.co/**',route=>{
  const req=route.request(),u=new URL(req.url()),method=req.method();
  if(u.pathname==='/rest/v1/recipes'&&method==='GET'){
   requests.push({method,url:u.pathname});
   return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
    body:JSON.stringify([
     {id:1,code:'PF-01',name:'Спайси',kind:'prefab',category:'Соусы',status:'Черновик',yield_g:125,version:1},
     {id:2,code:'P-01',name:'Филадельфия',kind:'product',category:'Холодные роллы',status:'Черновик',yield_g:220,version:1},
     {id:3,code:'P-02',name:'Запечённый краб',kind:'product',category:'Запечённые',status:'Тест',yield_g:210,version:1}
    ])});
  }
  if(u.pathname.startsWith('/rest/v1/'))return route.fulfill({status:200,body:'',headers:{'content-range':'0-0/0','access-control-allow-origin':'*','access-control-expose-headers':'content-range'}});
  return route.fulfill({status:401,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8898/mobile.html#ttk',{waitUntil:'domcontentloaded'});
 await page.locator('#hubSkipSplash').click().catch(()=>{});
 await page.waitForFunction(()=>document.querySelectorAll('.recipe-readonly-row').length===3,{timeout:8000});
 assert(await page.locator('.recipe-readonly-row').count()===3,'Recipe browser — fetches 3 authenticated records');
 assert(await page.locator('#hubRecipeList').getByText('Спайси').count()===1,'Recipe browser — prefab displayed');
 await page.selectOption('#hubRecipeKind','product');
 assert(await page.locator('.recipe-readonly-row').count()===2,'Recipe browser — product kind filter');
 await page.fill('#hubRecipeSearch','Филадельфия');
 assert(await page.locator('.recipe-readonly-row').count()===1,'Recipe browser — Russian search');
 assert(await page.locator('.recipe-readonly-row').first().getByText('Черновик').count()===1,'Recipe browser — draft not marked approved');
 assert(requests.length===1,'Recipe browser — exactly one read-only GET');
 assert(errors.length===0,'Recipe browser — no uncaught runtime errors');
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
  try{await runCloud(browser)}catch(e){assert(false,'Cloud sync — runtime '+e.message)}
  try{await runHandoff(browser)}catch(e){assert(false,'External handoff — runtime '+e.message)}
  try{await runRecipeCatalog(browser)}catch(e){assert(false,'Recipe catalog — runtime '+e.message)}
 }finally{
  if(browser)await browser.close();
  server.close();
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({runAt:new Date().toISOString(),checks,passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok).length},null,2));
 }
 console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok).length}));
 if(fatal)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;server.close()});
