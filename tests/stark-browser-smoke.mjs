import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

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
 const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:isMobile,isMobile});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(()=>document.body.classList.contains('stark-ready'),{timeout:20000});
  assert.equal(await page.locator('.ss-marker').count(),8,'8 product categories');
  assert.equal(await page.locator('.ss-item').count(),3,'3 initial samples');
  assert.equal(await page.locator('.ss-showcase h2').textContent(),'Холодные роллы');
  await page.getByRole('button',{name:'Онигири',exact:true}).click({timeout:8000});
  assert.equal(await page.locator('.ss-showcase h2').textContent(),'Онигири','category click updates table');
  await page.locator('.ss-item').first().click({timeout:8000});
  assert.match(await page.locator('.ss-selected-caption').textContent(),/Онигири 01/,'click selects product');
  await page.locator('.ss-pause').click();
  const before=await page.locator('.ss-portal canvas').evaluate(el=>el.toDataURL());
  const box=await page.locator('.ss-portal').boundingBox();
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.42);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.5+65,box.y+box.height*.42+28,{steps:9});
  await page.mouse.up();
  const after=await page.locator('.ss-portal canvas').evaluate(el=>el.toDataURL());
  assert.notEqual(before,after,'drag rotates the 3D globe');
  await page.screenshot({path:'artifacts/stark-v4-'+(isMobile?'mobile':'desktop')+'.png',fullPage:true});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<10,'horizontal overflow '+overflow+'px');
  await page.getByRole('button',{name:/Открыть товары и техкарты/}).click({timeout:8000});
  assert.equal(await page.locator('#recipes').isVisible(),true,'TTK section still works');
  const sync=page.getByRole('button',{name:'Google Документы'});
  assert.equal(await sync.count(),1,'Google integration still mounted');
  await page.locator('#menu-toggle').click();
  assert.equal(await page.locator('#chef-menu').isVisible(),true,'menu opens');
  await page.locator('#chef-menu button[data-view="home"]').click();
  assert.equal(await page.locator('.stark-showroom').isVisible(),true,'returns to Stark home');
  if(errors.length)throw Error('uncaught page error(s): '+errors.join('; '));
  process.stdout.write((isMobile?'MOBILE':'DESKTOP')+' PASS: 8 categories, sample selection, globe drag, TTK, Google, menu, navigation, overflow='+overflow+'px\n');
 }catch(error){
  await page.screenshot({path:'artifacts/stark-v4-FAILED-'+(isMobile?'mobile':'desktop')+'.png',fullPage:true}).catch(()=>{});
  failures.push((isMobile?'Mobile':'Desktop')+': '+error.stack+' / errors '+errors.join(' | '));
 }finally{await context.close()}
}
try{
 await verify({width:1440,height:900},false);
 await verify({width:390,height:844},true);
 if(failures.length)throw Error(failures.join('\n\n'));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
