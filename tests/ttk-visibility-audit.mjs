/* Browser QA of the ACTUAL 794×1123 DOM as a user would see it.
 * Each run uses synthetic local-only data, never connected user recipes.
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/api/auth/session')return res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({configured:true,authenticated:true}));
  if(u.pathname.startsWith('/api/'))return res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({ok:false,items:[],configured:false}));
  const file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  const data=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
 }catch{res.writeHead(404).end('Not found')}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const base='http://127.0.0.1:'+server.address().port;
await fs.mkdir('artifacts',{recursive:true});
const results=[];
const longValues={
 'recipe-name':'Филадельфия классик — контрольная длинная технологическая карта',
 'card-scope':'Технологическая карта распространяется на блюдо, производимое и реализуемое в суши-баре, ресторане и при доставке. Описывает ингредиенты, этапы сборки, температурные режимы, требования к безопасности, контроль сроков хранения и систему документирования каждой партии. Все операции выполняют подготовленные сотрудники с применением проверенных ингредиентов.',
 'card-raw':'Сырьё поступает с подтверждающими документами, подлежит органолептическому контролю, проверке маркировки, сроков и температуры. Рыба должна поступать в допустимом температурном режиме; молочные продукты должны сохраняться закрытыми до использования. Для каждой поставки контролируют транспортировку, упаковку и дату изготовления.',
 'card-prep':'Подготовить все ингредиенты по рецептуре. Охлаждённые продукты достать непосредственно перед сборкой. Проверить сроки годности, маркировку и отсутствие признаков порчи. Разделить зоны работы с сырыми и готовыми продуктами.',
 'technology':'На бамбуковом коврике распределить рис по нори. Уложить сыр, нарезанный огурец и рыбу согласно норме закладки. Сформовать плотный ролл. Накрыть ломтиками лосося и выровнять форму. Проверить плотность сборки перед нарезкой и отбраковать дефектные изделия.',
 'card-serving':'Готовый ролл нарезать на восемь равных частей. Подавать охлаждённым, без дополнительного нагрева. Соблюдать утверждённые стандарты внешнего вида и маркировки.',
 'card-appearance':'Ровные кусочки одинакового размера, аккуратная нарезка, начинка по центру, равномерное покрытие лососем; край нори без разрывов.',
 'card-taste':'Свойственный ингредиентам, свежий. Не допускаются посторонние привкусы и запахи. Текстура риса упругая, рыба нежная.',
 'card-storage':'Хранить при температуре +2…+6 °C в холодильном оборудовании. Срок годности 12 часов от окончания приготовления. Не допускать повторного замораживания, немаркированной продукции и нарушения холодовой цепи.',
 'card-safety':'Приёмка сырья с документами и проверка партии. Контроль санитарной обработки инвентаря. Контроль температуры холодильного хранения. Регистрация времени изготовления, маркировки и допустимого срока годности.'
};
const pick=['.ttk-live-intro-pair textarea','.ttk-ref-stage-body','.ttk-ref-info-row strong',
 '.ttk-ref-info-row span','.ttk-live-safety textarea','.ttk-ref-haccp-card span',
 '.ttk-live-allergen-row span','.ttk-live-regulatory'];
async function measure(page){
 return page.evaluate(selectors=>{
  const root=document.querySelector('#ttk-live-page');
  const nodes=[...new Set(selectors.flatMap(s=>[...root.querySelectorAll(s)]))];
  const measureText=el=>{
   const s=getComputedStyle(el),r=el.getBoundingClientRect();
   const text=(el.value||el.textContent||'').trim();
   const bbox={x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};
   return {node:el.tagName.toLowerCase(),cls:String(el.className||'').slice(0,70),
    text:text.slice(0,74),len:text.length,client:el.clientHeight,scroll:el.scrollHeight,
    clipped:el.scrollHeight>el.clientHeight+3,
    overflow:s.overflowY,font:s.fontSize,lineHeight:s.lineHeight,color:s.color,
    fill:s.webkitTextFillColor,background:s.backgroundColor,bbox};
  };
  const data=nodes.map(measureText);
  const issues=data.filter(x=>x.len>22&&x.clipped);
  return {layout:root.dataset.ttkLayout,editing:!!document.querySelector('#ttk-real-a4-stage')?.classList.contains('ttk-direct-editing'),
   pageSize:{width:root.offsetWidth,height:root.offsetHeight,scrollHeight:root.scrollHeight},
   stage:document.querySelector('#ttk-real-a4-stage')?.getBoundingClientRect().toJSON(),
   page:root.getBoundingClientRect().toJSON(),issues,measured:data.length,
   samples:data.filter(x=>x.cls.includes('stage-body')||x.cls.includes('ref-info')).slice(0,16)};
 },pick);
}
for(const [kind,width,height] of [['android',393,851],['desktop',1365,915]]){
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:kind==='android',hasTouch:kind==='android',serviceWorkers:'block'});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e.stack||e.message)));
 page.on('dialog',d=>d.dismiss());
 await page.addInitScript(()=>{localStorage.setItem('farruh-ai-approved-premium-v3','true');localStorage.setItem('farruh-ai-approved-black-ice-v1','true');localStorage.setItem('farruh-ai-approved-royal-premium-20261114','true');localStorage.setItem('farruh-ai-appearance-v1',JSON.stringify({theme:'royal',density:'standard',radius:20,scale:1,motion:false}));});
 await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:25000});
 await page.evaluate(()=>document.querySelector('#chef-menu button[data-view="recipes"]')?.click());
 await page.waitForFunction(()=>document.body.dataset.view==='recipes');
 await page.locator('#newrecipe').click();
 // Reveal the original editable four-layout workspace only for this deep audit.
 await page.locator('#ttk-approved-fields').click();
 await page.waitForSelector('#ttk-live-page',{state:'visible',timeout:18000});
 for(const id of ['teal-matrix','process-matrix','gold-allergen','premium-blue']){
  await page.locator('#ttk-design-picker [data-ttk-layout="'+id+'"]').click();
  let info=await measure(page);
  results.push({device:kind,scenario:'initial',...info});
  await page.locator('#ttk-live-page').screenshot({path:'artifacts/ttk-audit-'+kind+'-'+id+'-before.png',timeout:16000});
 }
 await page.evaluate(values=>{
  for(const [id,value] of Object.entries(values)){
   const el=document.getElementById(id);if(!el)continue;
   el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));
  }
 },longValues);
 await page.locator('#ttk-design-picker [data-ttk-layout="process-matrix"]').click();
 const longBefore=await measure(page);
 results.push({device:kind,scenario:'stress-compact',...longBefore});
 await page.locator('#ttk-onepage-zoom').count().catch(()=>0);
 await page.locator('.ttk-onepage-zoom').click();
 await page.waitForTimeout(580);
 const longEdit=await measure(page);
 const scroller=await page.evaluate(()=>{
  const node=document.querySelector('#ttk-real-a4-stage');
  node.scrollTop=node.scrollHeight;
  const safety=document.querySelector('#ttk-live-page .ttk-live-safety');
  const rect=safety?.getBoundingClientRect();
  const viewport=node.getBoundingClientRect();
  const name=document.querySelector('#ttk-live-page [data-source="recipe-name"]');
  const scope=document.querySelector('#ttk-live-page [data-source="card-scope"]');
  return {
   top:node.scrollTop,available:node.scrollHeight-node.clientHeight,
   safetyVisible:!!rect&&rect.top<viewport.bottom&&rect.bottom>viewport.top,
   nameFull:name?.value.includes('контрольная длинная технологическая карта'),
   scopeSynced:scope?.value===document.querySelector('#card-scope')?.value,
   clippedVisibleTextareas:[...document.querySelectorAll('#ttk-live-page textarea.ttk-live-control')]
    .filter(el=>el.getBoundingClientRect().width>0&&el.scrollHeight>el.clientHeight+3)
    .map(x=>x.dataset.source)
  };
 });
 results.push({device:kind,scenario:'stress-editing',...longEdit,scroller});
 await page.screenshot({path:'artifacts/ttk-audit-'+kind+'-stress-editing-bottom.png',timeout:15000});
 await page.locator('.ttk-onepage-zoom').click();
 const compact=await page.evaluate(()=>({
  pageHeight:document.querySelector('#ttk-live-page').offsetHeight,
  overflowWarning:document.querySelector('.ttk-visibility-notice')?.textContent,
  hiddenExtra:document.querySelectorAll('#ttk-live-page .ttk-live-ingredient-row[hidden]').length
 }));
 results.push({device:kind,scenario:'return-to-one-A4',compact});
 results.push({device:kind,scenario:'errors',messages:errors});
 await ctx.close();
}
await fs.writeFile('artifacts/ttk-visibility-audit.json',JSON.stringify(results,null,2));
const findings=results.filter(x=>
 (x.scenario==='errors'&&x.messages?.length)||
 (x.scenario==='stress-editing'&&
 (x.issues?.length||!x.scroller?.safetyVisible||!x.scroller?.nameFull||!x.scroller?.scopeSynced||
  x.scroller?.clippedVisibleTextareas?.length)));
if(findings.length)process.exitCode=1;
for(const result of results){
 console.log('TTK_QA',result.device,result.scenario,result.layout||'',
 'pageHeight',result.pageSize?.height,'issues',result.issues?.length,
 JSON.stringify(result.issues?.slice(0,8).map(x=>x.text.slice(0,22))||result.messages||[]));
}
await browser.close();server.close();
