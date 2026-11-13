import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/auth/session')return res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({configured:true,authenticated:true}));
 if(url.pathname==='/api/weather')return res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({ok:true,temperature:0,code:2,observedAt:new Date().toISOString()}));
 if(url.pathname.startsWith('/api/'))return res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({ok:false,items:[],configured:false}));
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
 }catch{res.writeHead(404).end('Not found')}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
await fs.mkdir('artifacts',{recursive:true});
const failures=[],results=[];
function check(label,value,context){results.push({label,ok:!!value,context});if(!value)failures.push({label,context})}
async function checkCrystalInk(page,selector,label){
 const ink=await page.evaluate(sel=>{
  const el=document.querySelector(sel);if(!el)return {missing:true};
  const s=getComputedStyle(el),value=s.webkitTextFillColor||s.color;
  const nums=(value.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
  return {color:s.color,fill:s.webkitTextFillColor,nums,
    text:(el.textContent||'').trim().slice(0,60)};
 },selector);
 const avg=ink.nums?.reduce((a,b)=>a+b,0)/3;
 check(label,!ink.missing&&ink.nums.length===3&&avg<150,ink);
}
async function run(theme,width,height){
 const mobile=width<600,tag=theme+'-'+(mobile?'mobile':'desktop');
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.dismiss());
 await page.addInitScript(t=>{localStorage.setItem('farruh-ai-approved-premium-v3','true');localStorage.setItem('farruh-ai-appearance-v1',JSON.stringify({theme:t,density:'standard',radius:20,scale:1,motion:false}))},theme);
 const before=Date.now();
 try{
 await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:25000});
 await page.locator('#home.pf-upgraded .pf-showcase').waitFor({state:'visible',timeout:22000});
 const initial=await page.evaluate(()=>({
  theme:document.body.dataset.pfTheme,old:getComputedStyle(document.querySelector('#home .arctic-shell')).display,
  overflow:document.documentElement.scrollWidth-innerWidth,
  main:getComputedStyle(document.querySelector('#home .pf-showcase')).display
 }));
 check(tag+' theme',initial.theme===theme,initial);
 check(tag+' hides old home',initial.old==='none',initial);
 check(tag+' homepage no overflow',initial.overflow<=16,initial);
 check(tag+' dashboard visible',initial.main!=='none',initial);
 results.push({label:tag+' initial render ms',ok:true,context:Date.now()-before});
 if(theme==='crystal'){
  await page.waitForFunction(()=>{const img=document.querySelector('.pf-banner-visual img');return img&&getComputedStyle(img).opacity!=='0'&&img.complete&&img.naturalWidth>0},null,{timeout:12000});
  await checkCrystalInk(page,'.pf-showcase-banner h1',tag+' homepage heading readable');
  await checkCrystalInk(page,'.pf-showcase-card .pf-card-title',tag+' feature cards readable');
 }
 const focused=await page.evaluate(()=>{
   const grid=[...document.querySelectorAll('#home .pf-showcase-grid .pf-showcase-card')].map(x=>x.querySelector('.pf-card-title')?.textContent?.trim());
   const hidden=['ХАССП','Журналы','Задачи'];
   const visibleBad=[...document.querySelectorAll('#home button, #chef-menu .nav button')].filter(b=>
    ((['lab','tasks'].includes(b.dataset.view)||['lab','tasks'].includes(b.dataset.pfGo)||b.classList.contains('pf-sidebar-journals'))
    &&getComputedStyle(b).display!=='none'&&b.getClientRects().length>0)).map(b=>b.textContent.trim().slice(0,50));
   return {grid,visibleBad,noRemovedCards:grid.every(n=>!hidden.includes(n)),
    compact:JSON.stringify(grid)===JSON.stringify(['ТТК','Полуфабрикаты','FARUKH PRINT','Настройки']),
    assistant:!!document.querySelector('#home .pf-showcase-grid [data-pf-go="chat"]'),
    check:!!document.querySelector('#home .pf-showcase-side [data-pf-go="checks"]')};
  });
  check(tag+' focused dashboard has four core sections, no inactive shortcuts',
  focused.noRemovedCards&&focused.visibleBad.length===0&&focused.compact&&!focused.assistant&&!focused.check,focused);
 await page.screenshot({path:'artifacts/premium-'+tag+'-home.png',timeout:12000});
 // No standalone Design Studio or Extras menu. Both live under Settings.
 const menuStructure=await page.evaluate(()=>({
  design:document.querySelectorAll('#chef-menu .pf-sidebar-design').length,
  extras:document.querySelectorAll('#chef-menu .pf-sidebar-more').length
 }));
 check(tag+' sidebar only contains core sections',menuStructure.design===0&&menuStructure.extras===0,menuStructure);
 await page.locator('.pf-showcase-top-actions [data-pf-action="settings"]').click();
 await page.locator('#site-settings').waitFor({state:'visible',timeout:8000});
 await page.locator('#site-settings #pf-settings-hub').waitFor({state:'visible',timeout:8000});
 const expandedTools=await page.evaluate(()=>({
  design:!!document.querySelector('#site-settings #pf-settings-design-button'),
  collapsed:!document.querySelector('#site-settings #pf-settings-utilities')?.open,
  labels:[...document.querySelectorAll('#site-settings #pf-settings-utilities .pf-settings-utility-button')].map(el=>el.textContent.trim())
 }));
 check(tag+' Settings contains Design Studio and four collapsed utilities',
   expandedTools.design&&expandedTools.collapsed&&expandedTools.labels.length===4,expandedTools);
 await page.locator('#pf-settings-design-button').click();
 check(tag+' Design Studio opens from Settings',await page.locator('#pf-studio-dialog').isVisible(),null);
 await page.locator('#pf-studio-dialog button').filter({hasText:'Отменить'}).click();
 check(tag+' Design Studio cancels without data changes',!(await page.locator('#pf-studio-dialog').isVisible()),null);
 for(const target of ['recipes','lab','tasks','checks','chat','preparations','print-control','site-settings']){
  await page.evaluate(v=>{const b=document.querySelector('#chef-menu button[data-view="'+v+'"]');if(b)b.click();else location.hash=v},target);
  try{await page.waitForFunction(v=>document.body.dataset.view===v,target,{timeout:6000})}catch(e){check(tag+' '+target+' navigation',false,e.message);continue}
  const info=await page.evaluate(()=>({v:document.body.dataset.view,visible:!!document.querySelector('.view:not([hidden])'),overflow:document.documentElement.scrollWidth-innerWidth}));
  check(tag+' '+target+' opens',info.v===target&&info.visible,info);
  check(tag+' '+target+' no horizontal overflow',info.overflow<=22,info);
  if(theme==='crystal'&&target==='recipes'){
   await page.locator('#recipes .lx-stats').waitFor({state:'visible',timeout:10000});
   await checkCrystalInk(page,'#recipes .lx-project-caption',tag+' recipe library readable');
   await checkCrystalInk(page,'#recipes .category-card:not(.lx-all-category) .category-caption strong',tag+' standard category captions readable');
   const ref=await page.evaluate(()=>({
    title:document.querySelector('#recipes .lx-ref-hero h1')?.textContent?.trim(),
    kpis:document.querySelectorAll('#recipes .lx-ref-stats .lx-stat').length,
    project:!!document.querySelector('#lx-project-select'),
    search:!!document.querySelector('#recipe-search'),
    statuses:document.querySelectorAll('#recipes .lx-ref-status button').length,
    categories:document.querySelectorAll('#recipes .recipe-categories .category-card').length,
    bottom:document.querySelectorAll('.mobile-tools.lx-ref-bottom button').length
   }));
   check(tag+' approved reference controls',ref.title==='Техкарты (ТТК)'&&ref.kpis===4&&ref.project&&ref.search&&ref.statuses===5&&ref.categories>=6&&ref.bottom===6,ref);
   if(mobile){
    await page.locator('.mobile-tools #mobile-more').click();
    check(tag+' More opens actual sidebar',await page.evaluate(()=>!document.getElementById('chef-menu').hidden),null);
    await page.locator('#menu-toggle').click();
    check(tag+' sidebar closes from menu button',await page.evaluate(()=>document.getElementById('chef-menu').hidden),null);
   }
   const navDebug=await page.evaluate(()=>[...document.querySelectorAll('nav')].map(n=>{
    const rect=n.getBoundingClientRect(),style=getComputedStyle(n);
    return {className:n.className,id:n.id,visible:style.display!=='none'&&rect.height>0,
      position:style.position,bottom:Math.round(rect.bottom),top:Math.round(rect.top),
      text:n.textContent?.trim().slice(0,160)};
   }).filter(n=>n.visible&&n.bottom>innerHeight-220));
   console.log('TTK_NAV_DEBUG='+JSON.stringify(navDebug));
   const extraNavDebug=await page.evaluate(()=>{
    const nodes=[...document.querySelectorAll('body *')].filter(el=>{
      const cs=getComputedStyle(el),r=el.getBoundingClientRect();
      return r.width>60 && r.height>20 && r.bottom>innerHeight-150 && r.top<innerHeight &&
        (cs.position==='fixed'||cs.position==='sticky') && (el.className||'')!=='lx-bottom-item';
    }).slice(0,22).map(el=>{
      const r=el.getBoundingClientRect(),c=getComputedStyle(el);
      return {tag:el.tagName,id:el.id,cls:typeof el.className==='string'?el.className.slice(0,100):'',text:(el.textContent||'').slice(0,110),
        display:c.display,position:c.position,z:c.zIndex,top:Math.round(r.top),bottom:Math.round(r.bottom),height:Math.round(r.height)};
    });
    const buttons=[...document.querySelectorAll('.mobile-tools.lx-ref-bottom button')].map(el=>({
      outer:el.outerHTML.slice(0,300),before:getComputedStyle(el,'::before').content,after:getComputedStyle(el,'::after').content,order:getComputedStyle(el).order
    }));
    return {nodes,buttons};
   });
   console.log('TTK_NAV_EXTRA='+JSON.stringify(extraNavDebug));

   const navLabels=await page.locator('.mobile-tools.lx-ref-bottom button').allTextContents();
   const expectedLabels=['Кабинет шефа','Проекты','Техкарты','Полуфабрикаты','Маркировка','Ещё'];
   check(tag+' bottom navigation has no duplicated captions',
     navLabels.length===expectedLabels.length&&navLabels.every((s,i)=>s.trim()===expectedLabels[i]),navLabels);
   const refVisual=await page.evaluate(()=>{
    const buttons=[...document.querySelectorAll('.mobile-tools.lx-ref-bottom .lx-bottom-item')];
    const xs=buttons.map(b=>b.getBoundingClientRect().x);
    const current=s=>getComputedStyle(document.querySelector(s)).webkitTextFillColor;
    return {xs,whiteStat:current('#recipes .lx-stat-total .lx-stat-body small'),
      whiteCategory:current('#recipes .lx-all-category .category-caption strong')};
   });
   check(tag+' six navigation buttons appear in focused reference order',
     refVisual.xs.length===6&&refVisual.xs.every((x,i)=>i===0||x>=refVisual.xs[i-1]-1),refVisual);
   check(tag+' white labels remain legible on cobalt cards',
     /255, 255, 255/.test(refVisual.whiteStat)&&/255, 255, 255/.test(refVisual.whiteCategory),refVisual);
   // Exercise the actual recipe-card CSS with a disposable layout probe.
   // The isolated QA account normally has zero TTK, so the screenshot alone
   // cannot reveal a mobile ellipsis overlay or a third action row.
   const cardLayout=await page.evaluate(()=>{
    const host=document.querySelector('#recipelist');
    const sample=document.createElement('article');sample.className='lx-recipe lx-ref-card';
    sample.innerHTML='<div class="lx-recipe-photo"></div>'+
      '<div class="lx-recipe-content"><div class="lx-card-heading">'+
      '<h3>Филадельфия классик</h3><span class="lx-card-state is-ready">✓ Готова</span></div>'+
      '<div class="lx-card-category">Холодные роллы</div>'+
      '<div class="lx-ref-meta"><span>⚖ Выход: 265 г (8 шт.)</span><span>КБЖУ: нет данных</span><span>▢ Изменена: 12.11.2026</span><span>№ 001</span></div></div>'+
      '<details class="lx-card-more"><summary>⋮</summary><div class="lx-card-menu">Меню</div></details>'+
      '<div class="lx-card-actions">'+Array.from({length:5},(_,i)=>'<button class="lx-card-action">Действие '+i+'</button>').join('')+'</div>';
    host.append(sample);
    const more=sample.querySelector('.lx-card-more'),status=sample.querySelector('.lx-card-state');
    const d=more.getBoundingClientRect(),s=status.getBoundingClientRect();
    const buttons=[...sample.querySelectorAll('.lx-card-action')],rows=new Set(buttons.map(b=>Math.round(b.getBoundingClientRect().top))).size;
    const collision=d.left<s.right&&d.right>s.left&&d.top<s.bottom&&d.bottom>s.top;
    const photo=sample.querySelector('.lx-recipe-photo').getBoundingClientRect();
    const title=sample.querySelector('.lx-card-heading h3').getBoundingClientRect();
    const card=sample.getBoundingClientRect();
    const result={menuWidth:Math.round(d.width),menuHeight:Math.round(d.height),collision,rows,
      height:Math.round(card.height),titleVsPhotoTop:Math.round(title.top-photo.top),
      statusVsTitleBottom:Math.round(s.top-title.bottom)};
    sample.remove();return result;
   });
   check(tag+' recipe ellipsis does not obscure ready status',cardLayout.menuWidth<=33&&!cardLayout.collision,cardLayout);
   if(mobile){
    check(tag+' recipe actions fit two rows',cardLayout.rows===2,cardLayout);
    check(tag+' recipe content aligned to thumbnail and compact',
      cardLayout.height<275&&Math.abs(cardLayout.titleVsPhotoTop)<35&&cardLayout.statusVsTitleBottom<45,
      cardLayout);
   }
   await page.screenshot({path:'artifacts/premium-'+tag+'-recipes.png',fullPage:false,timeout:12000});
   await page.locator('#newrecipe').click();
   const editorTools=await page.evaluate(()=>({
    visible:!document.getElementById('editor').hidden,
    photo:!!document.querySelector('#recipe-photo-file[accept*="image/png"]'),
    project:!!document.querySelector('#recipe-project'),
    a4:!!document.querySelector('#editor .ttk-paper')
   }));
   check(tag+' TTK photo upload and project editor',editorTools.visible&&editorTools.photo&&editorTools.project&&editorTools.a4,editorTools);
   await page.locator('#closeeditor').click();
  }
  if(target==='lab'){
   await page.waitForTimeout(400);
   if(theme==='crystal'){
    await page.locator('#lab .haccp-journal-copy strong').first().waitFor({state:'visible',timeout:10000});
    await checkCrystalInk(page,'#lab .haccp-journal-copy strong',tag+' HACCP journal text readable');
   }
  }
  if(target==='print-control'){
   await page.locator('#print-control .pc-hero').waitFor({state:'visible',timeout:9000});
   const print=await page.evaluate(()=>{
    const hero=document.querySelector('#print-control .pc-hero'),stat=document.querySelector('#print-control .pc-stat');
    return {hero:getComputedStyle(hero).backgroundImage,stat:stat?getComputedStyle(stat).backgroundImage:'missing'};
   });
   check(tag+' PRINT themed',print.hero.includes('gradient')&&print.stat.includes('gradient'),print);
   if(theme==='crystal'){
    await checkCrystalInk(page,'#print-control .pc-hero h1',tag+' PRINT heading readable');
    await checkCrystalInk(page,'#print-control .pc-stat strong',tag+' PRINT statistics readable');
   }
   await page.screenshot({path:'artifacts/premium-'+tag+'-print.png',timeout:12000});
  }
  if(theme==='titanium'&&mobile)await page.screenshot({path:'artifacts/premium-'+tag+'-'+target+'.png',timeout:12000});
 }
 if(theme==='titanium'&&mobile){
  await page.evaluate(()=>document.querySelector('#chef-menu button[data-view="home"]').click());
  await page.locator('.pf-showcase-top-button[data-pf-action="settings"]').click();
  await page.locator('#site-settings #pf-settings-design-button').click();
  await page.locator('#pf-studio-dialog').waitFor({state:'visible',timeout:5000});
  const count=await page.locator('#pf-studio-dialog .pf-theme-btn').count();
  check('All eight themes selectable',count===8,count);
  await page.locator('#pf-studio-dialog .pf-theme-btn').filter({hasText:'Royal Gold 3D'}).click();
  const changed=await page.evaluate(()=>document.body.dataset.pfTheme);
  check('Live design switch applies Royal Gold',changed==='royal',changed);
  await page.screenshot({path:'artifacts/premium-'+tag+'-design-studio.png',timeout:12000});
  await page.locator('#pf-studio-dialog .pf-modal-footer button').filter({hasText:'Отменить'}).click();
  const restored=await page.evaluate(()=>document.body.dataset.pfTheme);
  check('Cancel theme preview restores original',restored==='titanium',restored);
 }
 results.push({label:tag+' page errors (non-blocking mocked optional APIs)',ok:true,context:errors.slice(0,8)});
 }catch(e){check(tag+' fatal',false,e.message)}
 await ctx.close();
}
for(const [theme,w,h] of [['titanium',390,844],['crystal',390,844],['royal',390,844],['titanium',1365,900]])await run(theme,w,h);
await browser.close();await new Promise(r=>server.close(r));
const output={passed:results.filter(x=>x.ok).length,total:results.length,failed:failures};
await fs.writeFile('artifacts/premium-audit-results.json',JSON.stringify(output,null,2));
console.log('FARRUH_AI_QA='+JSON.stringify(output));
assert.equal(failures.length,0,'Browser audit found defects');
