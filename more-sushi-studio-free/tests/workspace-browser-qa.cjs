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
 const copyPanels=await page.locator('#hubFeaturedProjects .project-card .project-copy').count();
 assert(copyPanels===7,label+' — все семь карточек имеют отдельный читабельный текстовый блок');
 const geometry=await page.locator('#hubFeaturedProjects .project-card:not(.wide-project)').first().evaluate(card=>{
  const copy=card.querySelector('.project-copy'),title=card.querySelector('.project-title'),arrow=card.querySelector('.project-go');
  const panel=copy.getBoundingClientRect(),text=title.getBoundingClientRect(),button=arrow.getBoundingClientRect();
  const bg=getComputedStyle(copy).backgroundImage;
  return {glass:bg.includes('gradient'),textInside:text.left>=panel.left&&text.right<=panel.right+1,
   arrowAtRight:button.left>panel.left+panel.width/2,
   titleAboveArrow:text.bottom<button.bottom+1,cardHeight:card.getBoundingClientRect().height};
 });
 assert(geometry.glass&&geometry.textInside&&geometry.arrowAtRight&&geometry.titleAboveArrow,
  label+' — текст отделён от 3D-объекта, кнопка справа, читабельность '+JSON.stringify(geometry));

 const artVisible=await page.locator('#hubFeaturedProjects .project-illustration img').evaluateAll(items=>
  items.length===7&&items.every(img=>img.complete&&img.naturalWidth>0));
 assert(artVisible,label+' — все семь премиальных иллюстраций загрузились');
 const theme=await page.locator('body').evaluate(el=>({
   bg:getComputedStyle(el).backgroundImage,
   fg:getComputedStyle(el).color
 }));
 assert(theme.bg.includes('linear-gradient')&&theme.fg==='rgb(255, 243, 236)',label+' — новая тёмная Ultra Premium тема активна');

 assert(await page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--ruby').trim())==='#d61045',label+' — новая единая тема');
 const sheets=await page.locator('link[rel=stylesheet]').evaluateAll(links=>links.map(x=>new URL(x.href).pathname));
 assert(sheets.length===1&&sheets[0]==='/workspace-command.css',label+' — одна активная CSS тема без старых накладок');
 const img=await page.locator('.hero-photo').evaluate(el=>el.complete&&el.naturalWidth>0);
 assert(img,label+' — главное фото действительно загрузилось');
 const scrollWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
 assert(scrollWidth<=width+1,label+' — нет горизонтальной прокрутки, ширина '+scrollWidth);
 const navRect=await page.locator('.bottomnav').boundingBox();
 if(width<=480){
  const menuHeight=await page.locator('.bottomnav').evaluate(el=>el.getBoundingClientRect().height);
  assert(menuHeight<=71,label+' — мобильное меню компактное ('+menuHeight.toFixed(1)+'px)');
 }
 checkWithinWidth(navRect,width,label+' — нижнее меню в пределах экрана');
 const logoRect=await page.locator('.brand-identity').boundingBox();
 checkWithinWidth(logoRect,width,label+' — шапка не обрезана');
 await page.screenshot({path:path.join(out,label+'-home.png'),fullPage:true});
 await page.locator('.bottomnav [data-mss-tab="projects"]').click();
 await page.locator('#mss-projects').waitFor({state:'visible'});
 assert(await page.locator('#hubAllProjects .project-card').count()===7,label+' — вкладка Проекты загружает все 7');
 assert(await page.locator('#mss-home').isHidden(),label+' — предыдущая вкладка скрыта');
 await page.evaluate(()=>{
  const region=document.querySelector('#hubScrollRegion');
  if(region&&getComputedStyle(region).overflowY==='auto')region.scrollTop=region.scrollHeight;
  else window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});
 });
 await page.waitForTimeout(100);
 const clearance=await page.evaluate(()=>{
  const last=document.querySelector('#hubAllProjects .add-project-tile')?.getBoundingClientRect();
  const nav=document.querySelector('.bottomnav')?.getBoundingClientRect();
  return {lastBottom:last?.bottom,navTop:nav?.top};
 });
 assert(clearance.lastBottom<=clearance.navTop-6,label+' — последняя карточка и добавление не скрыты за меню ('+Math.round(clearance.lastBottom)+' / '+Math.round(clearance.navTop)+')');
 if(width<=699){
  const dock=await page.evaluate(()=>{
   const region=document.querySelector('#hubScrollRegion'),nav=document.querySelector('.bottomnav');
   const content=region.getBoundingClientRect(),menu=nav.getBoundingClientRect();
   return {scrollable:region.scrollHeight>region.clientHeight,
     clear:content.bottom<=menu.top-4,flow:getComputedStyle(nav).position!=='fixed',
     visible:menu.bottom<=window.innerHeight+1,
     contentBottom:content.bottom,menuTop:menu.top};
  });
  assert(dock.scrollable&&dock.clear&&dock.flow&&dock.visible,
   label+' — меню всегда вне прокрутки и НЕ перекрывает проекты '+JSON.stringify(dock));
 }
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
 assert((await page.locator('.recipe-readonly-row .recipe-state').first().textContent())?.trim()==='Черновик','Recipe browser — draft not marked approved');
 assert(requests.length===1,'Recipe browser — exactly one read-only GET');
 assert(errors.length===0,'Recipe browser — no uncaught runtime errors');
 await ctx.close();
}


async function runRecipeImport(browser){
 const uid='00000000-0000-4000-a000-000000000011',project='00000000-0000-4000-a000-000000000022';
 const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
 await ctx.addInitScript(({uid})=>localStorage.setItem('ms_session',JSON.stringify({
  access_token:'qa-import-token',refresh_token:'qa-token',expires_at:Math.floor(Date.now()/1000)+3600,
  user:{id:uid,email:'qa@example.test'}
 })),{uid});
 const writes=[],submitted=[];
 await ctx.route('https://mhsmmssipligbmvfzkce.supabase.co/**',route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  if(req.method()==='POST'&&path.endsWith('/ttk_documents')){
   const data=req.postDataJSON();submitted.push(data);
   return route.fulfill({status:201,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
    body:JSON.stringify([{...data,id:'00000000-0000-4000-a000-000000000044',version:1,owner_id:uid}])});
  }
  if(req.method()!=='GET'&&path.startsWith('/rest/v1/')){
   writes.push(path);return route.fulfill({status:403,body:'{"error":"No writes in QA"}',headers:{'access-control-allow-origin':'*'}});
  }
  let result=[];
  if(path.endsWith('/ttk_projects'))result=[{id:project,name:'Море Суши',is_archived:false,accent:'#e23267'}];
  else if(path.endsWith('/ttk_documents'))result=[];
  else if(path.endsWith('/ttk_preferences'))result=[{owner_id:uid,chef_name:'Шеф',auto_presets:{}}];
  else if(path.endsWith('/recipe_lines'))result=[
    {ingredient_id:8,prefab_id:null,gross_g:3,net_g:3,seq:0},
    {ingredient_id:null,prefab_id:9,gross_g:125,net_g:125,seq:1}
  ];
  else if(path.endsWith('/ingredients'))result=[{id:8,name:'Нори'}];
  else if(path.endsWith('/recipes'))result=url.searchParams.get('kind')==='eq.prefab'
   ?[{id:9,name:'Рис подготовленный',kind:'prefab'}]
   :[{id:30,name:'Филадельфия Северная',kind:'product',code:'МС-ХР-001',status:'Черновик',category:'Холодные роллы',yield_g:247,version:1,
    scope:'Пример',raw_requirements:'Проверить сырье',process:'Сформовать ролл',serving:'8 частей',
    storage:'Не утверждено',quality:'Без дефектов',allergens:'Не подтверждены',nutrition:{text:''}}];
  else if(path.endsWith('/auth/v1/user'))result={id:uid};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result),
   headers:{'access-control-allow-origin':'*','content-range':'0-1/2','access-control-expose-headers':'content-range'}});
 });
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8898/index.html?ocean=1&view=editor&from_recipe=30&from_kind=product',{waitUntil:'domcontentloaded',timeout:20000});
 await page.locator('#recipeImportedBanner').waitFor({state:'visible',timeout:12000});
 assert(await page.locator('#eTitle').inputValue()==='Филадельфия Северная','Import — title copied');
 assert(await page.locator('#eProject').inputValue()===project,'Import — project auto-selected');
 assert(await page.locator('#eStatus').inputValue()==='Черновик','Import — forced unapproved draft');
 assert(await page.locator('#eYield').inputValue()==='247','Import — yield matches source');
 const lineNames=await page.locator('tr[data-line] input[data-line-field="name"]').evaluateAll(x=>x.map(y=>y.value));
 assert(lineNames.join('|')==='Нори|Рис подготовленный','Import — ingredient and prefab lookup');
 assert(await page.locator('#fProcess').inputValue()==='Сформовать ролл','Import — process copied');
 assert((await page.locator('#recipeImportedBanner').innerText()).includes('НЕ СОХРАНЁН'),'Import — safe unsaved warning');
 assert(await page.locator('#fApproved').inputValue()==='','Import — no automatic approval');
 assert(writes.length===0,'Import — no database writes until explicit Save');
 assert(errors.length===0,'Import — zero JavaScript errors'+(errors.length?': '+errors.slice(0,2).join(' / '):''));
 // Render the actual studio's print CSS to a browser-generated A4 PDF.
 // The saved artifact contains MOCK recipe data only and no real user records.
 await page.emulateMedia({media:'print'});
 assert(await page.locator('#recipeImportedBanner').isHidden(),'Print — editor-only provenance warning is not printed');
 assert(await page.locator('.workspace-appbar').isHidden(),'Print — workspace header hidden, does not add a second A4 sheet');
 // Playwright's page.pdf() honours the explicitly emulated CSS media.
 // Do NOT switch to screen before PDF: that paginates the editor UI (2 sheets)
 // rather than the actual @media print A4 document.
 const pdf=await page.pdf({printBackground:true,preferCSSPageSize:true,format:'A4'});
 await page.emulateMedia({media:'screen'});
 fs.writeFileSync(path.join(out,'TTK-Philadelphia-MOCK-A4.pdf'),pdf);
 const pdfText=pdf.toString('latin1');
 const pages=(pdfText.match(/\/Type\s*\/Page(?!s)\b/g)||[]).length;
 assert(pdf.subarray(0,5).toString()==='%PDF-','PDF — generated file has a valid PDF header');
 assert(pages===1,'PDF — print layout contains exactly 1 A4 sheet (actual '+pages+')');
 const media=pdfText.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
 const a4=!!media&&Math.abs(Number(media[1])-595.28)<2&&Math.abs(Number(media[2])-841.89)<2;
 assert(a4,'PDF — document media box is A4 210 × 297 mm'+(media?' '+media[1]+'×'+media[2]:' (unknown)'));
 assert(pdf.length>4000,'PDF — rendered content is not empty');
 // Explicit Save is the only event allowed to write a document.
 await page.locator('#saveDoc').click();
 await page.locator('#editorDuplicate').waitFor({state:'visible',timeout:7000});
 assert(submitted.length===1,'TTK Save — exactly one document INSERT after Save click');
 assert(submitted[0]?.status==='Черновик','TTK Save — stored document remains a draft');
 assert(submitted[0]?.fields?.source_recipe_id===30,'TTK Save — provenance preserved');
 assert(submitted[0]?.fields?.approved==='','TTK Save — approval is not fabricated');
 assert(submitted[0]?.lines?.length===2,'TTK Save — both ingredient rows preserved');
 assert(writes.length===0,'TTK Save — no unintended source or storage mutation');
 await ctx.close();
}


async function runBackup(browser){
 const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
 await ctx.route('https://mhsmmssipligbmvfzkce.supabase.co/**',r=>r.fulfill({status:401,body:'{}',headers:{'access-control-allow-origin':'*'}}));
 const page=await ctx.newPage();
 await page.goto('http://127.0.0.1:8898/mobile.html#more',{waitUntil:'domcontentloaded'});
 await page.locator('#hubSkipSplash').click().catch(()=>{});
 await page.locator('#hubBackupExport').waitFor({state:'visible'});
 const pkg=await page.evaluate(()=>window.FarruhWorkspace.exportBackup());
 assert(pkg.format==='farruh-workspace-links-v1','Backup — format is versioned');
 assert(!JSON.stringify(pkg).includes('access_token'),'Backup — no bearer tokens exported');
 assert(!JSON.stringify(pkg).includes('ms_session'),'Backup — no session exported');
 const obj=await page.evaluate(()=>window.FarruhWorkspace.validateBackup({
  format:'farruh-workspace-links-v1',
  projects:[{id:'added-chef',name:'CHEF QA',url:'https://example.com/',color:'blue'}],
  favorites:['more','added-chef']
 }));
 assert(obj.projects.length===1&&obj.favorites.length===2,'Backup — safe restore is parsed');
 const rejected=await page.evaluate(()=>{
  try{
   window.FarruhWorkspace.validateBackup({format:'farruh-workspace-links-v1',
    projects:[{id:'evil',name:'X',url:'javascript:alert(1)'}],favorites:[]});
   return false;
  }catch{return true}
 });
 assert(rejected,'Backup — rejects JavaScript protocol');
 const modalRejected=await page.evaluate(()=>{
  try{
   window.FarruhWorkspace.validateBackup({format:'farruh-workspace-links-v1',
    projects:[{id:'more',name:'False default override',url:'https://example.com'}],favorites:[]});
   return false;
  }catch{return true}
 });
 assert(modalRejected,'Backup — blocks improper default override');
 const download=page.waitForEvent('download',{timeout:7000});
 await page.locator('#hubBackupExport').click();
 const dl=await download;
 assert(dl.suggestedFilename().startsWith('FARRUH_WORKSPACE_Backup_'),'Backup — browser downloads a JSON file');
 await ctx.close();
}


async function runSplashOnce(browser){
 const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
 await ctx.route('https://mhsmmssipligbmvfzkce.supabase.co/**',r=>r.fulfill({status:401,body:'{}',headers:{'access-control-allow-origin':'*'}}));
 const page=await ctx.newPage();
 await page.goto('http://127.0.0.1:8898/mobile.html',{waitUntil:'domcontentloaded'});
 assert(await page.locator('#hubSplash').count()===1,'Splash — intro exists at initial launch');
 await page.locator('#hubSkipSplash').click();
 await page.locator('#hubSplash').waitFor({state:'detached',timeout:3000});
 await page.reload({waitUntil:'domcontentloaded'});
 assert(await page.locator('#hubSplash').count()===0,'Splash — returning/refreshing skips cinematic delay');
 await page.locator('.bottomnav [data-mss-tab="more"]').click();
 await page.locator('#hubReplay').click();
 await page.locator('#hubSplash').waitFor({state:'visible',timeout:7000});
 assert(await page.locator('#hubSplash').count()===1,'Splash — user can still replay cinematic intro');
 await ctx.close();
}


async function runDeleteOffline(browser){
 const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
 await ctx.route('https://mhsmmssipligbmvfzkce.supabase.co/**',r=>r.fulfill({status:401,body:'{}',headers:{'access-control-allow-origin':'*'}}));
 const page=await ctx.newPage();page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:8898/mobile.html#projects',{waitUntil:'domcontentloaded'});
 await page.locator('#hubSkipSplash').click().catch(()=>{});
 await page.locator('#mss-projects [data-hub-add]').click();
 await page.fill('#hubEditName','Удаляемый ярлык QA');
 await page.fill('#hubEditUrl','https://example.com/');
 await page.locator('#hubProjectForm button[type=submit]').click();
 assert(await page.locator('#hubAllProjects .project-card').count()===8,'Delete — custom link created');
 await page.locator('#hubAllProjects .project-card').filter({hasText:'Удаляемый ярлык QA'}).locator('.project-remove').click();
 assert(await page.locator('#hubAllProjects .project-card').count()===7,'Delete — custom link removed with confirmation');
 await page.reload({waitUntil:'domcontentloaded'});
 assert(await page.locator('#hubAllProjects .project-card').count()===7,'Delete — removal persists after refresh');
 await ctx.close();
}


async function runNativeSingleWebView(browser){
 const base='http://127.0.0.1:8898/mobile.html#home';
 const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36 FarruhWorkspaceNative/1.0'});
 const entries=[
  {name:'MORE SUSHI STUDIO',prefix:'http://127.0.0.1:8898/index.html'},
  {name:'FARRUH AI',prefix:'https://farruhk-ai-mobile.onrender.com/'},
  {name:'FARUKH REVISION',prefix:'http://127.0.0.1:8898/revision.html'},
  {name:'FARUKH PRINT',prefix:'https://farruhk-ai-mobile.onrender.com/farukh-print/staff/'},
  {name:'FARUKH KITCHEN',prefix:'https://chefaka.onrender.com/'},
  {name:'SHEF51',prefix:'https://shef51.onrender.com/'},
  {name:'СУШИ БЕРИ',prefix:'https://sushi-beri.ru/murmansk'}
 ];
 await context.route('https://mhsmmssipligbmvfzkce.supabase.co/**',route=>
  route.fulfill({status:401,body:'{}',headers:{'access-control-allow-origin':'*'}}));
 for(const origin of ['https://farruhk-ai-mobile.onrender.com/**',
  'https://chefaka.onrender.com/**','https://shef51.onrender.com/**','https://sushi-beri.ru/**']){
  await context.route(origin,route=>route.fulfill({status:200,contentType:'text/html',
   body:'<!doctype html><html lang="ru"><title>Проект внутри Android WebView</title><body>Наш проект открыт</body></html>'}));
 }
 const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(const entry of entries){
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#hubSkipSplash').click().catch(()=>{});
  const card=page.locator('#hubFeaturedProjects .project-card').filter({hasText:entry.name});
  await card.locator('.project-go').click();
  await page.waitForURL(url=>url.href.startsWith(entry.prefix),{timeout:15000});
  assert(page.url().startsWith(entry.prefix),
   'Native WebView — '+entry.name+' navigates top-level, not external tab/iframe');
  if(page.url().startsWith('http://127.0.0.1:8898/')){
   assert(!page.url().includes('/mobile.html#open-'),
    'Native WebView — '+entry.name+' does not open an iframe modal');
  }
  await page.goBack({waitUntil:'domcontentloaded'}).catch(()=>{});
  await page.goto(base,{waitUntil:'domcontentloaded'});
 }
 assert(errors.length===0,'Native WebView — zero Workspace JavaScript errors');
 await context.close();
}

async function main(){
 await new Promise((ok,fail)=>server.listen(8898,'127.0.0.1',e=>e?fail(e):ok()));
 let browser;
 try{
  try{
   browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
   console.log('Browser QA: using runner preinstalled Google Chrome');
  }catch(error){
   browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
   console.log('Browser QA: fallback to Playwright Chromium');
  }
  for(const v of [{width:393,height:852,label:'phone-393'},{width:360,height:700,label:'phone-360'},{width:768,height:1024,label:'tablet-768'}]){
   try{await runView(browser,v)}catch(e){assert(false,v.label+' — runtime '+e.message)}
  }
  try{await runStorage(browser)}catch(e){assert(false,'CRUD/storage — runtime '+e.message)}
  try{await runCloud(browser)}catch(e){assert(false,'Cloud sync — runtime '+e.message)}
  try{await runHandoff(browser)}catch(e){assert(false,'External handoff — runtime '+e.message)}
  try{await runRecipeCatalog(browser)}catch(e){assert(false,'Recipe catalog — runtime '+e.message)}
  try{await runRecipeImport(browser)}catch(e){assert(false,'Recipe import — runtime '+e.message)}
  try{await runBackup(browser)}catch(e){assert(false,'Backup — runtime '+e.message)}
  try{await runSplashOnce(browser)}catch(e){assert(false,'Splash — runtime '+e.message)}
  try{await runDeleteOffline(browser)}catch(e){assert(false,'Delete — runtime '+e.message)}
  try{await runNativeSingleWebView(browser)}catch(e){assert(false,'Native WebView — runtime '+e.message)}
 }finally{
  if(browser)await browser.close();
  server.close();
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({runAt:new Date().toISOString(),checks,passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok).length},null,2));
 }
 console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok).length}));
 if(fatal)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;server.close()});
