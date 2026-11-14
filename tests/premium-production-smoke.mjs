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

/* Royal V2 replaced the old .pf-showcase with .pfv-showcase. Audit the actual
 * owner-approved dashboard and its live sections, rather than testing a hidden
 * legacy layout. Browser tests use mocked API responses and never alter user data. */
async function auditRoyal(page,tag,mobile,errors){
 const root=page.locator('#home.pf-upgraded .pfv-showcase');
 await root.waitFor({state:'visible',timeout:22000});
 const initial=await page.evaluate(()=>{
  const home=document.querySelector('#home');
  const header=document.querySelector('.aurora-top');
  const fixedNav=document.querySelector('.mobile-tools.lx-ref-bottom');
  const duplicate=document.querySelector('#pf-workspace .pfv-phone-nav');
  return {
   theme:document.body.dataset.pfTheme,
   title:home.querySelector('.pfv-intro h1')?.textContent?.trim(),
   old:getComputedStyle(home.querySelector('.arctic-shell')).display,
   royal:getComputedStyle(home.querySelector('.pfv-showcase')).display,
   header:getComputedStyle(header).display,
   dock:fixedNav?getComputedStyle(fixedNav).display:null,
   duplicate:duplicate?getComputedStyle(duplicate).display:null,
   overflow:document.documentElement.scrollWidth-innerWidth
  };
 });
 check(tag+' Royal V2 boot',initial.theme==='royal'&&initial.title.includes('Premium')&&initial.royal!=='none'&&initial.old==='none',initial);
 check(tag+' no horizontal overflow',initial.overflow<=20,initial);
 if(mobile){
  check(tag+' one unified header and dock',initial.header==='flex'&&initial.dock==='grid'&&initial.duplicate==='none',initial);
  const nav=await page.locator('.mobile-tools.lx-ref-bottom button').allTextContents();
  check(tag+' mobile dock contains six readable routes',JSON.stringify(nav.map(x=>x.trim()))===JSON.stringify(['Главная','Проекты','ТТК','Заготовки','Маркировка','Ещё']),nav);
  await page.locator('.mobile-tools.lx-ref-bottom #mobile-more').click();
  check(tag+' More opens native sidebar',await page.locator('#chef-menu').isVisible(),null);
  await page.locator('#chef-menu-close').click();
  check(tag+' mobile menu can close',!(await page.locator('#chef-menu').isVisible()),null);
 }else{
  check(tag+' desktop has sidebar instead of mobile dock',initial.dock==='none'&&await page.locator('#home .pfv-side').isVisible(),initial);
 }
 await page.screenshot({path:'artifacts/premium-'+tag+'-home.png',timeout:12000});
 const routes=['recipes','lab','tasks','checks','preparations','print-control','chat','site-settings'];
 for(const v of routes){
  await page.evaluate(route=>{
   const button=document.querySelector('#chef-menu button[data-view="'+route+'"]');
   if(button)button.click();
   else location.hash=route;
  },v);
  await page.waitForFunction(route=>document.body.dataset.view===route,v,{timeout:12000});
  if(v==='print-control')await page.locator('#print-control .pc-hero').waitFor({state:'visible',timeout:14000});
  const view=await page.evaluate(route=>{
   const target=document.getElementById(route);
   const header=document.querySelector('.aurora-top');
   const bottom=document.querySelector('.mobile-tools.lx-ref-bottom');
   const body=getComputedStyle(document.body);
   return {
    visible:target&&!target.hidden&&target.getBoundingClientRect().height>0,
    nav:bottom&&getComputedStyle(bottom).display,
    header:header&&getComputedStyle(header).display,
    bodyColor:body.backgroundColor,
    overflow:document.documentElement.scrollWidth-innerWidth
   };
  },v);
  check(tag+' '+v+' opens genuine workspace',!!view.visible,view);
  check(tag+' '+v+' fits viewport',view.overflow<=24,view);
  if(mobile)check(tag+' '+v+' shares Royal top and bottom bars',view.header==='flex'&&view.nav==='grid',view);
  if(v==='recipes'){
   const stats=await page.locator('#recipes .lx-ref-stats .lx-stat').count();
   check(tag+' TTK statistics render without fake data',stats===4,stats);
   const noRecipes=await page.locator('#recipes .lx-stat-total strong').first().innerText().catch(()=>'');
   check(tag+' TTK count stays truthful',/^(0|—)$/.test(noRecipes.trim()),noRecipes);
   const edit=page.locator('#newrecipe');
   check(tag+' Create TTK button visible',await edit.isVisible(),null);
   await edit.click();
   check(tag+' Create TTK opens working editor',await page.locator('#editor').isVisible(),null);
   await page.evaluate(()=>{window.confirm=()=>true});
   await page.locator('#closeeditor').click();
  }
  if(v==='print-control'){
   const metrics=await page.evaluate(()=>{
    const root=document.querySelector('#print-control-root');
    const buttons=[...root.querySelectorAll('.pc-row-controls button')];
    const minHeights=buttons.slice(0,5).map(x=>Math.round(x.getBoundingClientRect().height));
    const source=root.querySelector('.pc-normative-notice');
    return {catalog:!!root,buttons:buttons.length,minHeights,notice:!!source};
   });
   check(tag+' PRINT catalog and normative safety notice',metrics.catalog&&metrics.notice,metrics);
   if(mobile&&metrics.buttons.length)check(tag+' PRINT row actions have >=44px taps',metrics.minHeights.every(h=>h>=43),metrics);
  }
  if(v==='site-settings'){
   check(tag+' settings and design controls available',
     await page.locator('#pf-settings-design-button').count()===1,null);
  }
  await page.screenshot({path:'artifacts/premium-'+tag+'-'+v+'.png',timeout:12000});
 }
 check(tag+' no browser errors',errors.length===0,errors.slice(0,12));
}

async function run(theme,width,height){
 const mobile=width<600,tag=theme+'-'+(mobile?'mobile':'desktop');
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.dismiss());
 await page.addInitScript(t=>{localStorage.setItem('farruh-ai-approved-premium-v3','true');localStorage.setItem('farruh-ai-approved-black-ice-v1','true');localStorage.setItem('farruh-ai-approved-royal-premium-20261114','true');localStorage.setItem('farruh-ai-appearance-v1',JSON.stringify({theme:t,density:'standard',radius:20,scale:1,motion:false}))},theme);
 const before=Date.now();
 try{
 await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:25000});
 if(theme==='royal'){
  await auditRoyal(page,tag,mobile,errors);
  await ctx.close();
  return;
 }
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
 if(theme==='titanium'){
  const ice=page.locator('.pf-ice-screen');
  await ice.waitFor({state:'visible',timeout:12000});
  const cards=await ice.locator('.pf-ice-tile .pf-ice-tile-label').allInnerTexts();
  check(tag+' approved four Black Ice sections',
    JSON.stringify(cards)===JSON.stringify(['ТТК','ХАССП','Ингредиенты','Журналы']),cards);
  const projectButtons=ice.locator('.pf-ice-project[data-pf-project]');
  check(tag+' real project cards render',await projectButtons.count()>=2,
   await projectButtons.allInnerTexts());
  check(tag+' approved four-item navigation',
   await ice.locator('.pf-ice-bottom .pf-ice-nav-btn').count()===4,null);
  await page.screenshot({path:'artifacts/black-ice-'+tag+'-home.png',timeout:12000});
  const second=await projectButtons.nth(1).getAttribute('data-pf-project');
  await projectButtons.nth(1).click();
  check(tag+' selection updates working project',
   await page.locator('#pf-home-project-select').inputValue()===second,second);
  await ice.locator('.pf-ice-tile[data-pf-go="lab"]').first().click();
  await page.waitForFunction(()=>document.body.dataset.view==='lab',null,{timeout:12000});
  check(tag+' HACCP opens working safety section',await page.locator('#lab').isVisible(),null);
  await page.evaluate(()=>document.querySelector('#chef-menu button[data-view="home"]')?.click());
  await ice.locator('[data-pf-action="search"]').click();
  await page.waitForFunction(()=>document.body.dataset.view==='recipes',null,{timeout:12000});
  await page.waitForFunction(()=>document.activeElement?.id==='recipe-search',null,{timeout:8000});
  check(tag+' search focuses recipe input',await page.locator('#recipe-search').isVisible(),null);
  await page.evaluate(()=>document.querySelector('#chef-menu button[data-view="home"]')?.click());
  await ice.locator('[data-pf-go="site-settings"]').click();
  await page.waitForFunction(()=>document.body.dataset.view==='site-settings',null,{timeout:8000});
  check(tag+' profile opens settings',await page.locator('#site-settings').isVisible(),null);
  await page.evaluate(()=>document.querySelector('#chef-menu button[data-view="home"]')?.click());
  await ice.locator('[data-pf-action="more"]').click();
  check(tag+' menu is operable',await page.locator('#chef-menu').isVisible(),null);
  await page.locator('#chef-menu-close').click();
  check(tag+' no client uncaught errors',errors.length===0,errors.slice(0,5));
  await ctx.close();
  return;
 }
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
 if(!mobile){
  await page.locator('#home .pf-showcase-quick [data-pf-action="newrecipe"]').click();
  await page.waitForFunction(()=>document.body.dataset.view==='recipes'&&!document.getElementById('editor').hidden,null,{timeout:9000});
  check(tag+' quick Create TTK opens actual editor',await page.locator('#editor').isVisible(),null);
  await page.locator('#closeeditor').click();
  await page.evaluate(()=>document.querySelector('#chef-menu button[data-view="home"]').click());
 }
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
   const pilot=await page.evaluate(()=>({
    hero:!!document.querySelector('#editor .ttk-pro-head'),
    preview:!!document.querySelector('#editor .ttk-studio-preview'),
    rail:!!document.querySelector('#editor .ttk-pro-rail'),
    audit:document.querySelectorAll('#editor .ttk-pro-check').length,
    progress:Number(document.querySelector('#editor .ttk-pro-gauge')?.getAttribute('aria-valuenow')),
    note:document.querySelector('#editor .ttk-pro-audit-note')?.textContent,
    overflow:document.documentElement.scrollWidth-innerWidth
   }));
   check(tag+' Premium PRO editor has working audit and PDF preview shortcut',
     pilot.hero&&pilot.preview&&pilot.rail&&pilot.audit===13&&pilot.progress<100&&
     pilot.note?.includes('не соответствие')&&pilot.overflow<=16,pilot);
   await page.locator('#editor .ttk-pro-head').scrollIntoViewIfNeeded();
   await page.screenshot({path:'artifacts/premium-'+tag+'-editor-pro.png',fullPage:false,timeout:12000});
   const catalog=await page.evaluate(()=>({
    count:document.querySelectorAll('#ttk-design-picker .ttk-design-card').length,
    selected:document.querySelector('#ttk-design-picker .ttk-design-card[aria-pressed="true"]')?.dataset.ttkLayout,
    sheet:document.querySelector('#editor .ttk-paper')?.dataset.ttkLayout,
    unchangedForm:!!document.querySelector('#card-scope'),
     galleryVisible:document.querySelector('#ttk-design-picker')?.getBoundingClientRect().height>100,
     uploadButton:!!document.querySelector('.ttk-studio-photo-action')
   }));
   check(tag+' 2 A4 layouts appear in TTK editor with current selection',
     catalog.count===2&&catalog.selected==='arctic-a4'&&catalog.sheet==='arctic-a4'&&catalog.unchangedForm&&catalog.galleryVisible&&catalog.uploadButton,catalog);
   await page.locator('#ttk-design-picker [data-ttk-layout="royal-a4"]').click();
   check(tag+' selecting Royal changes the live A4 paper',
     await page.evaluate(()=>document.querySelector('#editor .ttk-paper')?.dataset.ttkLayout==='royal-a4'),null);
   if(theme==='crystal'&&mobile){
    // Upload/delete use the same photo handlers as the original editor.
    const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/OQAAAABJRU5ErkJggg==','base64');
    await page.locator('#recipe-photo-file').setInputFiles({name:'dish.png',mimeType:'image/png',buffer:tinyPng});
    await page.waitForFunction(()=>document.querySelector('#editor .ttk-inline-photo img')?.getAttribute('src')?.startsWith('data:image/'),null,{timeout:6000});
    check(tag+' dish photo uploads into the editable sheet',
      await page.locator('#editor .ttk-studio-photo-remove').isVisible(),null);
    await page.locator('#editor .ttk-studio-photo-remove').click();
    check(tag+' photo removes from the editable sheet',
      await page.evaluate(()=>!document.querySelector('#editor .ttk-inline-photo img')?.getAttribute('src')),null);
    const newState=await page.locator('#editor .ttk-pro-save-state').getAttribute('data-state');
    check(tag+' new TTK is honestly marked as not yet saved',newState==='new',newState);
    await page.locator('#recipe-name').fill('Пробный ролл');
    await page.locator('#ingredients .ingredient input[data-key="name"]').first().fill('Рис');
    await page.locator('#ingredients .ingredient input[data-key="grams"]').first().fill('100');
    await page.waitForFunction(()=>document.querySelector('#editor .ttk-pro-save-state')?.dataset.state==='dirty',null,{timeout:5000});
    const pdfRequest=page.waitForRequest(req=>req.url().endsWith('/api/recipes/pdf')&&req.method()==='POST',{timeout:10000});
    await page.locator('#editor .ttk-studio-preview').click();
    const req=await pdfRequest;
    const draft=JSON.parse(req.postData()).recipe;
    check(tag+' preview sends unsaved Royal A4 draft to actual PDF route',
      draft.name==='Пробный ролл'&&draft.layoutTemplate==='royal-a4'&&
      draft.ingredients?.some(x=>x.name==='Рис'&&Number(x.grams)===100),
      {name:draft.name,layout:draft.layoutTemplate,ingredients:draft.ingredients?.length});
   }
   await page.evaluate(()=>{window.confirm=()=>true});
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
for(const [theme,w,h] of [['titanium',390,844],['crystal',390,844],['royal',390,844],['royal',1365,900],['titanium',1365,900]])await run(theme,w,h);
await browser.close();await new Promise(r=>server.close(r));
const output={passed:results.filter(x=>x.ok).length,total:results.length,failed:failures};
await fs.writeFile('artifacts/premium-audit-results.json',JSON.stringify(output,null,2));
console.log('FARRUH_AI_QA='+JSON.stringify(output));
assert.equal(failures.length,0,'Browser audit found defects');
