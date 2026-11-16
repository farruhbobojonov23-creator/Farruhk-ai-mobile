import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const root=path.resolve('public');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/healthz')return res.writeHead(200,{'Content-Type':'application/json'}).end('{"ok":true}');
  if(url.pathname==='/api/auth/session')return res.writeHead(200,{'Content-Type':'application/json'}).end('{"configured":true,"authenticated":true}');
  if(url.pathname.startsWith('/api/'))return res.writeHead(200,{'Content-Type':'application/json'}).end('{"ok":true,"configured":false,"items":[]}');
  const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(await fs.readFile(file));
 }catch{res.writeHead(404).end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});
const report={note:'CI browser with empty local state and simulated APIs; not a measurement on the owner phone.',samples:[],live:[]};
try{
 for(const throttled of [false,true]){
  const context=await browser.newContext({viewport:{width:393,height:851},deviceScaleFactor:1,isMobile:true});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.perfLongTasks=[];
   try{new PerformanceObserver(list=>window.perfLongTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true})}catch{}
  });
  const cdp=await context.newCDPSession(page);
  if(throttled){
   await cdp.send('Network.enable');
   await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:500000,uploadThroughput:125000});
   await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  }
  const start=performance.now();
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded',timeout:90000});
  const domMs=performance.now()-start;
  await page.locator('#home.pf-upgraded .pfv-showcase').waitFor({state:'visible',timeout:60000});
  const dashboardMs=performance.now()-start;
  await page.waitForTimeout(5000);
  const details=await page.evaluate(()=>({
   resources:performance.getEntriesByType('resource').map(e=>({path:new URL(e.name).pathname,query:new URL(e.name).search,bytes:e.decodedBodySize,transfer:e.transferSize,ms:e.duration,type:e.initiatorType})),
   longTasks:window.perfLongTasks
  }));
  const grouped=new Map();
  for(const r of details.resources){if(!grouped.has(r.path))grouped.set(r.path,[]);grouped.get(r.path).push(r.query)}
  report.samples.push({throttled,domMs:Math.round(domMs),dashboardMs:Math.round(dashboardMs),requests:details.resources.length,
   decodedBytes:details.resources.reduce((a,r)=>a+r.bytes,0),longTaskTotalMs:Math.round(details.longTasks.reduce((a,r)=>a+r.duration,0)),
   duplicateModules:[...grouped].filter(([p,q])=>p.endsWith('.js')&&q.length>1),
   largest:details.resources.sort((a,b)=>b.bytes-a.bytes).slice(0,20),errors});
  await context.close();
 }
 for(const route of ['/healthz','/healthz','/healthz','/premium-workspace.js?v=24']){
  const start=performance.now();
  try{
   const response=await fetch('https://farruhk-ai-mobile.onrender.com'+route,{signal:AbortSignal.timeout(90000)});
   const headerMs=performance.now()-start,bytes=(await response.arrayBuffer()).byteLength;
   report.live.push({route,status:response.status,headerMs:Math.round(headerMs),totalMs:Math.round(performance.now()-start),encoding:response.headers.get('content-encoding'),bytes});
  }catch(e){report.live.push({route,error:e.name,ms:Math.round(performance.now()-start)})}
 }
 console.log(JSON.stringify(report,null,2));
 await fs.mkdir('artifacts',{recursive:true});
 await fs.writeFile('artifacts/performance-audit.json',JSON.stringify(report,null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
