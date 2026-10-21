import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const media={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/auth/session'){
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
   return res.end(JSON.stringify({configured:true,authenticated:true}));
  }
  if(url.pathname==='/api/weather'){
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
   return res.end(JSON.stringify({ok:true,temperature:5,code:3,observedAt:new Date().toISOString()}));
  }
  if(url.pathname.startsWith('/api/')){
   res.writeHead(200,{'Content-Type':'application/json'});
   return res.end(JSON.stringify({ok:false,configured:false,items:[]}));
  }
  const name=decodeURIComponent(url.pathname);
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden')}
  const data=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':media[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(data);
 }catch{res.writeHead(404);res.end('Not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
await fs.mkdir('artifacts',{recursive:true});
const failures=[];
const visible=async(page,selector)=>page.locator(selector).isVisible();

async function verify(mode,width,height){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1.5,isMobile:mode==='mobile',hasTouch:mode==='mobile',reducedMotion:'reduce',serviceWorkers:'block'});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',async dialog=>{throw Error('Unexpected destructive-confirmation dialog: '+dialog.message())});
 try{
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(()=>document.querySelector('#connection')?.textContent==='Хранение на устройстве',null,{timeout:20000});
  await page.waitForFunction(()=>document.querySelector('#home .arctic-reference-orb')?.naturalWidth>0,null,{timeout:15000});
  assert.equal(await page.locator('body').getAttribute('data-view'),'home','homepage view');
  assert.match(await page.locator('#home .arctic-greeting h1').innerText(),/Будущее\.\s*В ваших руках\./,'approved home headline must not be overwritten');
  assert.equal(await visible(page,'#home-new-recipe'),true,'create TTK button visible');
  assert.equal(await visible(page,'#ruby-talk'),true,'microphone visible');
  const hasWeather=await page.locator('#home .home-weather').count();assert.equal(hasWeather,1,'weather mounted');
  const homeLayout=await page.evaluate(()=>{
   const r=document.querySelector('.arctic-art-area .ruby-scene').getBoundingClientRect();
   return {center:r.left+r.width/2,viewport:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,hiddenFooter:getComputedStyle(document.querySelector('.mobile-tools')).display==='none',hiddenLegacyHeader:getComputedStyle(document.querySelector('.aurora-top')).display==='none'};
  });
  assert.ok(Math.abs(homeLayout.center-homeLayout.viewport/2)<35,'AI sphere centred: '+JSON.stringify(homeLayout));
  assert.ok(homeLayout.overflow<12,'homepage horizontal overflow: '+homeLayout.overflow);
  assert.ok(homeLayout.hiddenLegacyHeader&&homeLayout.hiddenFooter,'no duplicate navigation on the home screen');
  await page.screenshot({path:'artifacts/arctic-home-'+mode+'.png',fullPage:false,timeout:12000});

  await page.locator('#ruby-menu').click();
  assert.equal(await visible(page,'#chef-menu'),true,'menu opens from home shortcut');
  await page.locator('#ruby-menu').click();
  assert.equal(await visible(page,'#chef-menu'),false,'menu closes on second tap');

  await page.locator('#home-new-recipe').click();
  assert.equal(await page.locator('body').getAttribute('data-view'),'recipes','create TTK navigates to recipes');
  assert.equal(await visible(page,'#editor'),true,'TTK editor opens');
  assert.equal(await page.locator('#editor').getAttribute('data-mode'),'form','TTK editor starts in form mode');
  const colors=await page.locator('#recipe-name').evaluate(el=>{
   const c=getComputedStyle(el);return {background:c.backgroundColor,color:c.color};
  });
  const rgb=colors.background.match(/[\d.]+/g)?.slice(0,3).map(Number)||[];
  assert.ok(rgb.length===3&&rgb.every(n=>n>218),'TTK input is dark or illegible: '+JSON.stringify(colors));
  await page.screenshot({path:'artifacts/arctic-ttk-'+mode+'.png',fullPage:false,timeout:12000});
  await page.locator('#closeeditor').evaluate(el=>el.click());
  assert.equal(await visible(page,'#editor'),false,'TTK closes without changing saved recipes');

  await page.locator('button[data-view="lab"]').first().evaluate(el=>el.click());
  assert.equal(await page.locator('body').getAttribute('data-view'),'lab','HACCP navigation');
  await page.waitForFunction(()=>document.querySelector('.haccp-daily-overview')!==null,null,{timeout:12000});
  const overview=await page.locator('.haccp-daily-overview').evaluate(el=>({
   background:getComputedStyle(el).backgroundImage,color:getComputedStyle(el).color,
   journalCards:document.querySelectorAll('.haccp-journal-card').length
  }));
  assert.ok(!overview.background.includes('32, 36, 39'),'HACCP daily card must not have legacy dark background: '+overview.background);
  assert.ok(overview.journalCards>=5,'HACCP cards mounted: '+overview.journalCards);
  await page.screenshot({path:'artifacts/arctic-haccp-'+mode+'.png',fullPage:false,timeout:12000});

  await page.locator('button[data-view="tasks"]').first().evaluate(el=>el.click());
  assert.equal(await page.locator('body').getAttribute('data-view'),'tasks','Tasks navigation');
  const details=page.locator('details.create-panel').filter({has:page.locator('#taskform')});
  await details.locator('summary').click();
  const unique='QA test '+mode+' '+Date.now();
  await page.locator('#tasktext').fill(unique);
  await page.locator('#taskform button[type="submit"]').click();
  await page.waitForFunction(text=>document.querySelector('#tasklist')?.textContent?.includes(text),unique,{timeout:12000});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#connection')?.textContent==='Хранение на устройстве',null,{timeout:12000});
  await page.locator('button[data-view="tasks"]').first().evaluate(el=>el.click());
  assert.match(await page.locator('#tasklist').innerText(),new RegExp(unique),'Tasks persist after reload');
  assert.deepEqual(errors,[],'uncaught client JS errors');
  console.log(mode.toUpperCase()+' PASSED: home, 3D art, menus, responsive layout, TTK editor, HACCP, tasks persistence');
 }catch(err){
  console.error('FAIL '+mode+':',err.stack);
  if(errors.length)console.error('Page errors: '+errors.join(' | '));
  failures.push(mode+': '+err.stack+'; pageErrors='+errors.join(' | '));
  await page.screenshot({path:'artifacts/arctic-FAILED-'+mode+'.png',fullPage:false,timeout:6000}).catch(()=>{});
 }finally{await context.close()}
}

try{
 await verify('mobile',390,844);
 await verify('desktop',1440,900);
 if(failures.length)throw Error(failures.join('\n\n'));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
