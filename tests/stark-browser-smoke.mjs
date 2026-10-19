import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const timeout=setTimeout(()=>{console.error('BROWSER QA TIMEOUT: process exceeded 95 seconds');process.exit(1)},95000);timeout.unref();
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const media={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{
  if(req.url.startsWith('/api/auth/session')){
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({configured:true,authenticated:true}));return;
  }
  if(req.url.startsWith('/api/')){
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,configured:false,items:[]}));return;
  }
  const reqPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(reqPath==='/'?'/index.html':reqPath));
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);res.end();return}
  const bytes=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':media[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
 }catch(e){res.writeHead(404);res.end('Not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port,origin='http://127.0.0.1:'+port;
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
await fs.mkdir('artifacts',{recursive:true});
let failures=[];
async function verify(viewport,isMobile=false){
 console.log('SMOKE: opening',isMobile?'mobile':'desktop');
 const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:isMobile,isMobile,reducedMotion:'reduce'});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',m=>{if(m.type()==='error')console.log('BROWSER CONSOLE:',m.text().slice(0,450))});page.on('response',r=>{if(r.status()>=400)console.log('BROWSER HTTP',r.status(),r.url().slice(0,140))});
 try{
  await page.goto(origin+'/',{waitUntil:'commit',timeout:12000});await page.locator('body').waitFor({state:'attached',timeout:12000});console.log('SMOKE: navigated');
  await page.waitForFunction(()=>document.body?.classList.contains('stark-ready'),null,{timeout:18000});console.log('SMOKE: stark-ready');
  assert.equal(await page.locator('.ss-marker').count(),8,'8 product categories');console.log('SMOKE: category count OK');
  assert.equal(await page.locator('.ss-item').count(),3,'3 initial samples');console.log('SMOKE: sample count OK');
  const snapshot=await page.evaluate(()=>({showcase:document.querySelector('.ss-showcase')?.outerHTML.slice(0,700),headings:[...document.querySelectorAll('h2')].map(e=>e.className+' '+e.textContent.slice(0,50)).slice(0,15),ready:document.body.className,marked:document.querySelector('.ss-markers')?.children.length}));console.log('SMOKE: DOM',JSON.stringify(snapshot));
  assert.equal(await page.locator('.ss-showcase h2').textContent(),'Холодные роллы');
  const categoryBox=await page.getByRole('button',{name:'Онигири',exact:true}).boundingBox();assert.ok(categoryBox,'Onigiri visible');
  const catX=categoryBox.x+categoryBox.width/2,catY=categoryBox.y+categoryBox.height/2;
  if(isMobile)await page.touchscreen.tap(catX,catY);else await page.mouse.click(catX,catY);
  console.log('SMOKE: tapped onigiri');
  assert.equal(await page.locator('.ss-showcase h2').textContent(),'Онигири','category click updates table');
  const afterTap=await page.evaluate(()=>({title:document.querySelector('.ss-category-name')?.textContent,items:document.querySelectorAll('.ss-item').length,activeView:document.body?.dataset?.view}));console.log('SMOKE: postcategory',JSON.stringify(afterTap));
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.ss-item').length),1,'Onigiri has one real demo photo rather than three fake triangles');
  const sampleBox=await page.evaluate(()=>{const b=document.querySelector('.ss-item')?.getBoundingClientRect();return b?{x:b.x,y:b.y,width:b.width,height:b.height}:null});assert.ok(sampleBox,'Sample visible after category tap');
  const sampleX=sampleBox.x+sampleBox.width/2,sampleY=sampleBox.y+sampleBox.height/2;
  if(isMobile)await page.touchscreen.tap(sampleX,sampleY);else await page.mouse.click(sampleX,sampleY);
  console.log('SMOKE: tapped item');
  assert.match(await page.evaluate(()=>document.querySelector('.ss-selected-caption')?.textContent),/Онигири.*образец/i,'click selects product');
  await page.waitForFunction(()=>{const image=document.querySelector('.ss-item img');return image&&image.complete&&image.naturalWidth>0&&Number(image.style.opacity)===1},null,{timeout:17000});
  console.log('SMOKE: local product photo decoded with one-time background removal');
  assert.equal(await page.evaluate(()=>document.querySelector('.ss-pause')?.getAttribute('aria-pressed')),'true','respect reduced-motion preference');console.log('SMOKE: motion reduced');
  const before=await page.evaluate(()=>document.querySelector('.ss-marker')?.style.transform);
  const box=await page.evaluate(()=>{const r=document.querySelector('.ss-portal').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}});
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.42);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.5+65,box.y+box.height*.42+28,{steps:9});
  await page.mouse.up();
  const after=await page.evaluate(()=>document.querySelector('.ss-marker')?.style.transform);
  assert.notEqual(before,after,'drag rotates the product orbit around the 3D globe');
  await page.screenshot({path:'artifacts/stark-v4-'+(isMobile?'mobile':'desktop')+'.png',fullPage:true,timeout:8000}).catch(error=>console.log('SMOKE: screenshot skipped:',error.message.slice(0,160)));console.log('SMOKE: screenshot stage passed');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<10,'horizontal overflow '+overflow+'px');
  await page.locator('.ss-ttk').evaluate(el=>el.click());console.log('SMOKE: navigated to TTK');
  assert.equal(await page.locator('#recipes').isVisible(),true,'TTK section still works');
  const sync=page.getByRole('button',{name:'Google Документы'});
  assert.equal(await sync.count(),1,'Google integration still mounted');
  await page.waitForTimeout(250);
  const instant=await page.evaluate(()=>{const b=document.getElementById('menu-toggle');const m=document.getElementById('chef-menu');const pre=m.hidden;b.click();return {pre,post:m.hidden,handler:typeof b.onclick}});console.log('SMOKE menu sync',JSON.stringify(instant));
  const menuSnapshot=await page.evaluate(()=>{const el=document.querySelector('#chef-menu'),computed=getComputedStyle(el);return {hidden:el.hidden,display:computed.display,visibility:computed.visibility,rect:el.getBoundingClientRect().toJSON(),body:document.body.dataset.view,toggle:document.querySelector('#menu-toggle')?.getAttribute('aria-expanded')}});console.log('SMOKE: menu diagnostics',JSON.stringify(menuSnapshot));
  assert.equal(await page.locator('#chef-menu').isVisible(),true,'menu opens');
  await page.locator('#chef-menu button[data-view="home"]').evaluate(el=>el.click());
  assert.equal(await page.locator('.stark-showroom').isVisible(),true,'returns to Stark home');
  if(errors.length)throw Error('uncaught page error(s): '+errors.join('; '));
  process.stdout.write((isMobile?'MOBILE':'DESKTOP')+' PASS: 8 categories, sample selection, globe drag, TTK, Google, menu, navigation, overflow='+overflow+'px\n');
 }catch(error){
  console.error('SMOKE: FAIL',error.stack);console.log('SMOKE: captured errors',errors.join(' | '));
  await page.screenshot({path:'artifacts/stark-v4-FAILED-'+(isMobile?'mobile':'desktop')+'.png',fullPage:false,timeout:3500}).catch(()=>{});
  failures.push((isMobile?'Mobile':'Desktop')+': '+error.stack+' / errors '+errors.join(' | '));
 }finally{await context.close()}
}
try{
 await verify({width:1440,height:900},false);
 await verify({width:390,height:844},true);
 if(failures.length)throw Error(failures.join('\n\n'));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
