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
 await page.locator('#home .pfv-hub-tile').filter({hasText:'Проекты'}).first().click();
 await page.locator('#pf-project-dialog[open]').waitFor({state:'visible',timeout:12000});
 const pm=await page.evaluate(()=>{
   const e=document.querySelector('#pf-project-dialog'),b=e.getBoundingClientRect(),h=e.querySelector('.pf-modal-header h2')?.getBoundingClientRect();
   return {open:e.open,display:getComputedStyle(e).display,w:b.width,h:b.height,top:b.top,bottom:b.bottom,center:Math.abs((b.left+b.right)/2-innerWidth/2),heading:!!h&&h.height>10&&h.top>=0&&h.bottom<innerHeight,rowHeight:e.querySelector('.pf-project-item')?.getBoundingClientRect().height};
 });
 check(tag+' Projects native modal visible and centered',pm.open&&pm.display==='flex'&&pm.w>270&&pm.h>220&&pm.top>=0&&pm.bottom<=(page.viewportSize()?.height||900)&&pm.center<12&&pm.heading&&pm.rowHeight<180,pm);
 await page.screenshot({path:'artifacts/premium-'+tag+'-projects.png',timeout:12000});
 await page.locator('#pf-project-dialog .pf-modal-header button').click();
 check(tag+' Projects modal closes',!await page.locator('#pf-project-dialog').evaluate(e=>e.open),null);
 const routes=['recipes','lab','tasks','checks','preparations','print-control','chat','site-settings'];
 for(const v of routes){
  await page.evaluate(route=>{
   const button=document.querySelector('#chef-menu button[data-view="'+route+'"]');
   if(button)button.click();
   else location.hash=route;
  },v);
  await page.waitForFunction(route=>document.body.dataset.view===route,v,{timeout:12000});
  if(v==='print-control')await page.locator('#print-control .pc-hero').waitFor({state:'visible',timeout:14000});
  if(v==='lab')await page.locator('#lab .haccp-journal-card').first().waitFor({state:'visible',timeout:15000});
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
   const tidy=await page.evaluate(()=>{
    const card=[...document.querySelectorAll('#recipe-categories .category-card')].find(c=>c.querySelector('.category-photo-frame img'));
    const frame=card?.querySelector('.category-photo-frame');
    const box=sel=>document.querySelector(sel)?.getBoundingClientRect();
    return {cardHeight:card?.getBoundingClientRect().height,photoHeight:frame?.getBoundingClientRect().height,
     divider:frame&&getComputedStyle(frame).borderBottomWidth,
     search:box('#recipes .lx-ref-searchbar .catalog-search')?.top,filters:box('#recipes .lx-filter-menu')?.top,
     sorting:box('#recipes .lx-sort-control')?.top,status:box('#recipes .lx-status-filters')?.top};
   });
   check(tag+' bigger clean category products and no divider',
     tidy.cardHeight>255&&tidy.photoHeight>=185&&tidy.divider==='0px',tidy);
   check(tag+' search/filter/sort/status ordered correctly',
     tidy.search<tidy.filters&&Math.abs(tidy.filters-tidy.sorting)<12&&tidy.filters<tidy.status,tidy);
   await page.screenshot({path:'artifacts/premium-'+tag+'-category-cards.png',timeout:12000});
   const stats=await page.locator('#recipes .lx-ref-stats .lx-stat').count();
   check(tag+' TTK statistics render without fake data',stats===4,stats);
   const noRecipes=await page.locator('#recipes .lx-stat-total strong').first().innerText().catch(()=>'');
   check(tag+' TTK count stays truthful',/^(0|—)$/.test(noRecipes.trim()),noRecipes);
   const edit=page.locator('#newrecipe');
   check(tag+' Create TTK button visible',await edit.isVisible(),null);
   await edit.click();
   check(tag+' Create TTK opens working editor',await page.locator('#editor').isVisible(),null);
   const fourOnOpen=await page.evaluate(()=>{
    const editor=document.querySelector('#editor'),stage=editor.querySelector('#ttk-real-a4-stage');
    const obsolete=editor.querySelector('.ttk-viewport>.ttk-paper');
    const cards=[...stage.querySelectorAll('.ttk-design-card')];
    return {mode:editor.dataset.mode,stage:!!stage&&getComputedStyle(stage).display!=='none',
      oldSheet:obsolete?getComputedStyle(obsolete).display:'missing',
      cards:cards.length,ids:cards.map(c=>c.dataset.ttkLayout)};
   });
   const approvedFirst=await page.evaluate(()=>{
    const editor=document.querySelector('#editor'),mini=editor.querySelector('.ttk-approved-mini');
    const frame=mini?.querySelector('iframe'),page=mini?.querySelector('.ttk-approved-mini-page');
    return {
     selected:editor.dataset.ttkLayout,
     visible:!!mini&&!mini.hidden&&mini.getBoundingClientRect().height>250,
     previewHeight:page?.getBoundingClientRect().height,
     startsBeforeStage:(editor.querySelector('.ttk-approved-controls')?.compareDocumentPosition(editor.querySelector('.ttk-pro-shell'))&Node.DOCUMENT_POSITION_FOLLOWING)!==0,
     hiddenLegacy:getComputedStyle(editor.querySelector('.ttk-viewport')).display==='none',
     frameSrc:frame?.getAttribute('src')
    };
   });
   check(tag+' new TTK opens the approved live Emerald A4 above the old miniature',
    approvedFirst.selected==='emerald-master-a4'&&approvedFirst.visible&&
    approvedFirst.previewHeight>250&&approvedFirst.startsBeforeStage&&
    approvedFirst.hiddenLegacy&&approvedFirst.frameSrc?.includes('/ttk-approved-master.html'),
    approvedFirst);
   await page.screenshot({path:'artifacts/premium-'+tag+'-new-approved-emerald-master.png',timeout:12000});
   // The original four premium variants and their real editable fields are
   // retained behind a clear, user-accessible "Редактировать поля" button.
   await page.locator('#editor .ttk-approved-fields').click();
   await page.waitForFunction(()=>document.querySelector('#editor .ttk-viewport')?.getBoundingClientRect().height>100);
   check(tag+' four legacy cards stay reachable after opening edit fields',
     fourOnOpen.mode==='paper'&&fourOnOpen.cards===4&&
     fourOnOpen.ids.join(',')==='teal-matrix,process-matrix,gold-allergen,premium-blue'&&
     await page.locator('#ttk-real-a4-stage').isVisible(),fourOnOpen);
   await page.screenshot({path:'artifacts/premium-'+tag+'-new-a4-four-options.png',timeout:12000});
   // Production regression: on Android the old icon-only ⚙ could be
   // clipped by the four-button topbar. The full-width labeled row MUST be
   // visible and its panel reachable, before the user taps any template.
   const settingsSummary=page.locator('#ttk-real-a4-stage .ttk-settings-access-row>summary');
   const settingsPosition=await settingsSummary.evaluate(el=>{
    const rect=el.getBoundingClientRect();
    return {text:el.textContent.trim(),left:rect.left,right:rect.right,
      w:rect.width,h:rect.height,viewport:window.innerWidth,
      visible:getComputedStyle(el).display!=='none'};
   });
   check(tag+' Общие настройки ТТК is a prominent visible button on mobile',
    settingsPosition.text.includes('Общие настройки ТТК')&&
    settingsPosition.visible&&settingsPosition.w>180&&settingsPosition.h>=35&&
    settingsPosition.left>=-1&&settingsPosition.right<=settingsPosition.viewport+1,
    settingsPosition);
   await settingsSummary.click();
   check(tag+' settings panel opens and displays real global controls',
    await page.locator('#ttk-real-a4-stage .ttk-settings-access-row').evaluate(el=>el.open)&&
    await page.locator('#ttk-real-a4-stage .ttk-general-panel').isVisible()&&
    await page.locator('#ttk-real-a4-stage .ttk-general-panel').getByText('Количество штук по умолчанию').count()===1,
    null);
   await page.screenshot({path:'artifacts/premium-'+tag+'-ttk-global-settings-visible.png',timeout:12000});
   await settingsSummary.click();
   const layouts=await page.locator('#ttk-design-picker .ttk-design-card').evaluateAll(nodes=>
     nodes.map(node=>({id:node.dataset.ttkLayout,visible:node.getBoundingClientRect().height>30})));
   check(tag+' My TTK editor offers exactly four new Premium allergen templates',
     layouts.length===4&&layouts.every(x=>x.visible)&&
     layouts.map(x=>x.id).join(',')==='teal-matrix,process-matrix,gold-allergen,premium-blue',layouts);
   await page.locator('#ttk-design-picker').scrollIntoViewIfNeeded();
   await page.screenshot({path:'artifacts/premium-'+tag+'-four-ttk-allergen-designs.png',timeout:12000});
   // Real visual regression: each of the four approved A4 options must have
   // its own arrangement, not only a new background/border color.
   for(const [layout,pairKind,processKind,allergensTitle,numbered] of [
    ['teal-matrix','process-quality','table','МАТРИЦА АЛЛЕРГЕНОВ',true],
    ['process-matrix','quality-pair','four-horizontal','МАТРИЦА АЛЛЕРГЕНОВ',false],
    ['gold-allergen','process-quality','table','МАТРИЦА АЛЛЕРГЕНОВ',true],
    ['premium-blue','process-quality','table','АЛЛЕРГЕНЫ В БЛЮДЕ',false]
   ]){
    await page.locator('#ttk-design-picker [data-ttk-layout="'+layout+'"]').click();
    const rendered=await page.evaluate(()=>{
     const root=document.querySelector('#ttk-live-page');
     const lower=root.querySelector('.ttk-live-lower');
     const stage=root.querySelector('.ttk-ref-process-stages');
     const names=[...root.querySelectorAll('.ttk-live-section-head strong')].map(x=>x.textContent);
     const processPair=lower.firstElementChild?.classList.contains('ttk-ref-process-quality');
     return {layout:root.dataset.ttkLayout,lowerFirst:lower.firstElementChild?.className,
      pair:processPair?'process-quality':'quality-pair',
      process:getComputedStyle(stage).gridTemplateColumns.split(' ').length===4?'four-horizontal':'table',
      names,numbered:!!root.querySelector('.ttk-live-scope .ttk-live-count'),
      footer:!!root.querySelector('.ttk-ref-footer-brand'),
      nutritionRows:root.querySelectorAll('.ttk-ref-nutri-table .ttk-ref-info-row').length,
      steps:root.querySelectorAll('.ttk-ref-stage').length,
      allergens:root.querySelector('.ttk-live-allergens .ttk-live-section-head strong')?.textContent,
      mast:root.querySelector('.ttk-live-paper-brand')?.textContent};
    });
    check(tag+' real A4 layout '+layout+' is structurally distinct and data driven',
     rendered.layout===layout&&rendered.pair===pairKind&&rendered.process===processKind&&
      rendered.allergens===allergensTitle&&rendered.numbered===numbered&&
      rendered.nutritionRows===5&&rendered.steps===4&&rendered.footer&&
      rendered.mast?.includes('FARRUH AI'),rendered);
    await page.locator('#ttk-live-page').screenshot({
     path:'artifacts/premium-'+tag+'-reference-'+layout+'.png',timeout:12000
    });
   }
   await page.locator('#ttk-design-picker [data-ttk-layout="gold-allergen"]').click();
   const inlineState=await page.evaluate(()=>{
     const live=document.querySelector('#ttk-live-page');
     return {visible:!!live&&getComputedStyle(live).display!=='none',
       layout:live?.dataset.ttkLayout,
       name:!!live?.querySelector('[data-source="recipe-name"]'),
       rows:live?.querySelectorAll('.ttk-live-ingredient-row').length,
       allergens:live?.querySelectorAll('.ttk-live-allergen-row').length,
       pdfHidden:document.querySelector('#ttk-real-a4-stage iframe')?.hidden};
   });
   check(tag+' four-layout choice opens directly editable actual TTK, not static PDF',
     inlineState.visible&&inlineState.layout==='gold-allergen'&&inlineState.name&&
     inlineState.rows>=1&&inlineState.allergens===8&&inlineState.pdfHidden,inlineState);
   const onePage=await page.evaluate(()=>{
     const page=document.querySelector('#ttk-live-page');
     const outer=page.getBoundingClientRect();
     const stage=document.querySelector('#ttk-real-a4-stage').getBoundingClientRect();
     const size={w:outer.width,h:outer.height,ratio:outer.height/outer.width,
       fixedHeight:page.offsetHeight,zoom:getComputedStyle(page).zoom,
       stageWidth:stage.width,screenHeight:innerHeight,
       stageTop:stage.top,stageBottom:stage.bottom,paperTop:outer.top,paperBottom:outer.bottom,
       nameBg:getComputedStyle(page.querySelector('[data-source="recipe-name"]')).backgroundColor,
       ingredients:[...page.querySelectorAll('.ttk-live-ingredient-row')].filter(x=>!x.hidden).length};
     return size;
   });
   check(tag+' A4 sheet is one fixed portrait page, scaled to phone screen without vertical form',
     onePage.fixedHeight===1123&&Math.abs(onePage.ratio-1123/794)<.03&&
     onePage.w<=onePage.stageWidth+1&&
     onePage.stageTop>=0&&onePage.stageBottom<=onePage.screenHeight+3&&
     onePage.paperTop>=onePage.stageTop-2&&onePage.paperBottom<=onePage.stageBottom+3&&
     (mobile?onePage.h<onePage.screenHeight-165:true)&&onePage.ingredients<=5,onePage);
   const rgb=(onePage.nameBg.match(/\d+(?:\.\d+)?/g)||[]).slice(0,3).map(Number);
   check(tag+' A4 page uses light paper inputs instead of dark fields',
     rgb.length===3&&rgb.every(n=>n>=225),onePage.nameBg);
   await page.screenshot({path:'artifacts/premium-'+tag+'-one-portrait-A4.png',timeout:12000});
   const originalApprover=await page.locator('#card-approver').inputValue();
   const sheetApprover=page.locator('#ttk-live-page [data-source="card-approver"]');
   await sheetApprover.fill('Тест А4 редактор');
   check(tag+' typing directly on A4 updates canonical approver',
     await page.locator('#card-approver').inputValue()==='Тест А4 редактор',null);
   check(tag+' A4 shows NO modal or bottom editing sheet',
     await page.locator('#ttk-onepage-dialog').count()===0,null);
   check(tag+' A4 zooms the same document for in-place typing',
     await page.locator('#ttk-real-a4-stage').evaluate(el=>el.classList.contains('ttk-direct-editing')),null);
   await sheetApprover.fill(originalApprover);
   const originalPrep=await page.locator('#card-prep').inputValue();
   const inlinePreparation=page.locator('#ttk-live-page .ttk-ref-stage-body[contenteditable]').first();
   await inlinePreparation.fill('Подготовить продукты прямо в ТТК');
   check(tag+' technology edits directly in the document',
     await page.locator('#card-prep').inputValue()==='Подготовить продукты прямо в ТТК',null);
   await inlinePreparation.fill(originalPrep);
   const amountBefore=await page.locator('#ingredients .ingredient').count();
   await page.locator('#ttk-live-page .ttk-live-add').click();
   check(tag+' ingredients added without a popup persist in canonical recipe',
     await page.locator('#ingredients .ingredient').count()===amountBefore+1,null);
   await page.locator('#ttk-live-page .ttk-live-remove').last().click();
   await page.screenshot({path:'artifacts/premium-'+tag+'-editable-a4.png',timeout:12000});
   check(tag+' Gold Allergen selection persists in live editor',
     (await page.locator('#editor').getAttribute('data-ttk-layout'))==='gold-allergen',null);
   // Desktop defaults to paper preview; explicitly switch to the editable mobile-style form.
   await page.locator('#editor .ttk-onepage-full-form').click();
   const editAppearance=await page.evaluate(()=>{
     const e=document.querySelector('#editor.ttk-studio-enabled'),p=e?.querySelector('.ttk-paper');
     return {mode:e?.dataset.mode,background:e&&getComputedStyle(e).backgroundImage,
       paper:p&&getComputedStyle(p).backgroundImage};
   });
   check(tag+' Royal editor mobile form is fully dark',
     editAppearance.mode==='form'&&editAppearance.background.includes('rgb(35, 29, 26)')&&
     editAppearance.paper.includes('rgb(35, 31, 28)'),editAppearance);
   await page.screenshot({path:'artifacts/premium-'+tag+'-editor-form.png',timeout:12000});
   await page.locator('#editor .ttk-studio-switch-button').filter({hasText:'Лист А4'}).click();
   const sheet=await page.evaluate(()=>({
     mode:document.querySelector('#editor')?.dataset.mode,
     photo:getComputedStyle(document.querySelector('#editor .ttk-inline-photo')).display
   }));
   check(tag+' A4 view has no photo space',sheet.mode==='paper'&&sheet.photo==='none',sheet);
   check(tag+' A4 view never reveals obsolete editable HTML page',
    await page.evaluate(()=>getComputedStyle(document.querySelector('#editor .ttk-viewport>.ttk-paper')).display==='none'),null);
   check(tag+' four premium templates remain visible in A4 view',
    await page.locator('#ttk-real-a4-stage .ttk-design-card').count()===4,null);
   await page.screenshot({path:'artifacts/premium-'+tag+'-sheet-no-photo.png',timeout:12000});
   await page.locator('#editor .ttk-onepage-full-form').click();
   await page.evaluate(()=>{window.confirm=()=>true});
   await page.locator('#closeeditor').click();
   // Explicit screenshot regression: the owner category editor used white rows
   // with nearly white titles. Test the live dynamically injected manager.
   await page.locator('#manage-categories').click();
   const category=await page.evaluate(()=>{
    const editor=document.querySelector('#recipes .category-dialog.owner-inline');
    const row=editor?.querySelector('.category-manage-row');
    const title=row?.querySelector('strong'),note=row?.querySelector('small');
    const color=e=>e?getComputedStyle(e).webkitTextFillColor:'missing';
    return {visible:!!editor&&!editor.hidden,rows:editor?.querySelectorAll('.category-manage-row').length||0,
      rowBackground:row?getComputedStyle(row).backgroundImage:'missing',
      rowText:color(title),rowMeta:color(note),
      savebar:!!editor?.querySelector('.owner-savebar')};
   });
   check(tag+' category manager keeps dark rows and readable gold labels',
     category.visible&&category.rows>=1&&category.rowBackground.includes('rgb(37, 32, 25)')&&
     category.rowText!=='missing'&&category.rowMeta!=='missing'&&
     [category.rowText,category.rowMeta].every(c=>(c.match(/[\d.]+/g)||[]).slice(0,3).map(Number).every(n=>n>=150))&&category.savebar,category);
   await page.screenshot({path:'artifacts/premium-'+tag+'-category-manager.png',timeout:12000});
   await page.locator('#recipes .owner-inline .owner-savebar button').filter({hasText:'Отменить все правки'}).click();
   // Disposable local-only recipe: same ingredients as owner's approval mockups.
   await page.locator('#newrecipe').click();
   await page.locator('#editor .ttk-onepage-full-form').click();
   await page.locator('#recipe-name').fill('Тест 1');
   await page.locator('#recipe-status').selectOption('ready');
   const sample=[['сыр творожный','50'],['лосось','50'],['терияки соус','50'],['рис готовый','120']];
   for(let i=0;i<sample.length;i++){
     if(i){
       const count=await page.evaluate(()=>{
         document.querySelector('#addingredient').click();
         return document.querySelectorAll('#ingredients .ingredient').length;
       });
       check(tag+' add ingredient '+i+' creates a row',count===i+1,{count,i});
       if(count!==i+1)throw new Error('No new ingredient after add: '+JSON.stringify({count,i,errors}));
     }
     const row=page.locator('#ingredients .ingredient').nth(i);
     await row.locator('[data-key="name"]').fill(sample[i][0]);
     await row.locator('[data-key="grams"]').fill(sample[i][1]);
   }
   const matrix=await page.evaluate(()=>{
     const entries=[...document.querySelectorAll('#editor .ttk-allergen-entry')];
     const row=label=>entries.find(e=>e.textContent.includes(label));
     return {count:entries.length,fish:row('Рыба')?.querySelector('strong')?.textContent,
       milk:row('Молоко')?.querySelector('strong')?.textContent,
       soy:row('Соя')?.querySelector('strong')?.textContent};
   });
   check(tag+' live allergen matrix checks fish and dairy, warns for sauces',
      matrix.count===8&&matrix.fish==='✓'&&matrix.milk==='✓'&&matrix.soy==='?',matrix);
   await page.locator('#card-chef').fill('Фаррух');
   await page.locator('#card-approver').fill('Бободжонов');
   await page.evaluate(()=>{const input=document.getElementById('nutrition-auto');input.checked=false;input.dispatchEvent(new Event('change',{bubbles:true}))});
   for(const [key,n] of [['protein','6.565'],['fat','8.859'],['carbs','19.97'],['kcal','188.333']])
     await page.locator('#card-'+key).fill(n);
   const formCheck=await page.evaluate(()=>{
     const rows=[...document.querySelectorAll('#editor #ingredients .ingredient')];
     const table=document.querySelector('#editor .ttk-block[data-section="7"]>.ttk-table');
     const totals=document.querySelector('#editor .ttk-recipe-totals');
     return {rows:rows.length,gross:rows.map(e=>e.querySelector('[data-key="grossGrams"]').value),
      deleteSize:rows[0].querySelector('button').getBoundingClientRect().height,
      inputBg:getComputedStyle(rows[0].querySelector('[data-key="grams"]')).backgroundColor,
      inputRuleMatch:rows[0].querySelector('[data-key="grams"]').matches('html body.lx-pro[data-pf-theme="royal"] #editor.ttk-studio-enabled[data-mode="form"] #ingredients .ingredient input'),
      theme:document.body.dataset.pfTheme,luxury:document.body.classList.contains('lx-pro'),
      stylesheet:[...document.styleSheets].filter(x=>x.href?.includes('ttk-royal-approved-ui')).map(x=>({href:x.href,rules:x.cssRules?.length})),
      table:table&&getComputedStyle(table).display,
      totals:totals?.querySelector('[data-total="net"]')?.textContent};
   });
   check(tag+' Premium ingredient editor has 4 compact dark cards and accurate totals',
     formCheck.rows===4&&formCheck.gross.join(',')==='50,50,50,120'&&
     formCheck.deleteSize<=51&&formCheck.inputBg==='rgb(15, 18, 19)'&&
     formCheck.table==='table'&&formCheck.totals==='270',formCheck);
   await page.locator('#ingredients .ingredient').first().scrollIntoViewIfNeeded();
   await page.screenshot({path:'artifacts/premium-'+tag+'-approved-ingredients.png',timeout:12000});
   await page.locator('#editor .ttk-nutrition-status').scrollIntoViewIfNeeded();
   await page.screenshot({path:'artifacts/premium-'+tag+'-approved-nutrition.png',timeout:12000});
   await page.locator('#editor button[type="submit"]').click();
   await page.waitForFunction(()=>document.querySelector('#editor')?.hidden,{timeout:12000});
   if(await page.locator('#catalog-all').isVisible())await page.locator('#catalog-all').click();
   const saved=page.locator('#recipelist .lx-recipe').filter({hasText:'Тест 1'}).first();
   await saved.waitFor({state:'visible',timeout:12000});
   const savedView=await saved.evaluate(e=>{
     const photo=e.querySelector('.lx-recipe-photo'),img=photo?.querySelector('img');
     const actions=e.querySelector('.lx-card-actions');
     const cloud=e.querySelector('.lx-recipe-cloud');
     const meta=e.querySelector('.lx-ref-meta');
     return {width:e.getBoundingClientRect().width,
      photoHeight:photo?.getBoundingClientRect().height,
      photoFit:img&&getComputedStyle(img).objectFit,
      actions:actions?.querySelectorAll('button').length,
      actionsDisplay:actions&&getComputedStyle(actions).display,
      metaDisplay:meta&&getComputedStyle(meta).display,
      cloud:!!cloud&&cloud.getBoundingClientRect().height>=70,
      overflow:e.scrollWidth-e.clientWidth};
   });
   check(tag+' approved saved card: contained photo, four buttons, cloud tile',
     savedView.width>=280&&savedView.photoHeight<=310&&savedView.photoFit==='contain'&&
     savedView.actions===4&&savedView.actionsDisplay==='grid'&&savedView.metaDisplay==='grid'&&
     savedView.cloud&&savedView.overflow<=3,savedView);
   await saved.scrollIntoViewIfNeeded();
   await page.screenshot({path:'artifacts/premium-'+tag+'-approved-saved-card.png',timeout:12000});
  }
  if(v==='print-control'){
   const metrics=await page.evaluate(()=>{
    const root=document.querySelector('#print-control-root');
    const buttons=[...root.querySelectorAll('.pc-row-controls button')];
    const minHeights=buttons.slice(0,5).map(x=>Math.round(x.getBoundingClientRect().height));
    const source=root.querySelector('.pc-normative-notice');
    return {catalog:!!root,buttons:buttons.length,minHeights,notice:!!source};
   });
   check(tag+' PRINT catalog, a sample row and normative safety notice',metrics.catalog&&metrics.notice&&metrics.buttons>=4,metrics);
   if(mobile&&metrics.buttons.length)check(tag+' PRINT row actions have >=44px taps',metrics.minHeights.every(h=>h>=43),metrics);
   await page.locator('#print-control-root .pc-workspace-tab[data-workspace="staff"]').click();
   const staffTheme=await page.evaluate(()=>{
    const nav=document.querySelector('#print-control-root .pstaff-tabbar');
    const inactive=nav?.querySelector('.pstaff-tab:not(.active)');
    const active=nav?.querySelector('.pstaff-tab.active');
    return {navBackground:nav?getComputedStyle(nav).backgroundImage:'missing',
      inactiveFill:inactive?getComputedStyle(inactive).webkitTextFillColor:'missing',
      activeFill:active?getComputedStyle(active).webkitTextFillColor:'missing'};
   });
   check(tag+' owner staff tabs match Royal dark / gold palette',
     staffTheme.navBackground.includes('rgb(37, 30, 24)')&&
     staffTheme.inactiveFill.includes('232, 212, 178')&&
     staffTheme.activeFill.includes('31, 23, 16'),staffTheme);
   await page.screenshot({path:'artifacts/premium-'+tag+'-staff-tabs.png',timeout:12000});
   await page.locator('#print-control-root .pc-workspace-tab[data-workspace="cloud"]').click();
   const cloudTheme=await page.evaluate(()=>{
    const badge=document.querySelector('#print-control-root .pcloud-state');
    const count=document.querySelector('#print-control-root .pcloud-devices-count');
    return {badge:badge?getComputedStyle(badge).backgroundImage:'missing',
      devices:count?getComputedStyle(count).backgroundImage:'missing'};
   });
   check(tag+' cloud status badges use dark Premium colors',
     cloudTheme.badge.includes('rgb(24, 53, 43)')&&cloudTheme.devices.includes('rgb(26, 46, 53)'),cloudTheme);
   await page.screenshot({path:'artifacts/premium-'+tag+'-cloud-badges.png',timeout:12000});
  }
  if(v==='site-settings'){
   check(tag+' settings and design controls available',
     await page.locator('#pf-settings-design-button').count()===1,null);
  }
  await page.screenshot({path:'artifacts/premium-'+tag+'-'+v+'.png',timeout:12000});
 }
 if(mobile){
   // Owner changes live text, saves on this device, reloads, then restores defaults.
   await page.locator('#site-settings #pf-site-visual-editor-button').click();
   const panel=page.locator('#fai-visual-editor-panel');
   await panel.waitFor({state:'visible',timeout:8000});
   check(tag+' visual editor opens working inspector',await page.locator('#home').isVisible(),null);
   const title=page.locator('#home .pfv-intro h1');
   const beforeText=await title.evaluate(el=>el.textContent.trim());
   await title.click();
   const input=panel.locator('input[type="text"]').first();
   await input.fill('Проверка визуального редактора');
   await input.dispatchEvent('change');
   check(tag+' visual edit immediately changes heading',
     (await title.innerText()).includes('Проверка визуального редактора'),null);
   await panel.locator('.fai-ve-save').click();
   check(tag+' visual edits persist in local records',
     await page.evaluate(()=>JSON.parse(localStorage.getItem('farruh-ai-visual-layout-v1')||'[]')
      .some(r=>r.label==='Проверка визуального редактора')),null);
   await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('#home .pfv-intro h1')?.textContent?.includes('Проверка визуального редактора'),null,{timeout:16000});
   check(tag+' visual label survives browser refresh',
     (await page.locator('#home .pfv-intro h1').innerText()).includes('Проверка визуального редактора'),null);
   await page.evaluate(()=>{
     window.confirm=()=>true;
     window.__faiVisualEditor.open();
     [...document.querySelectorAll('#fai-visual-editor-panel button')]
      .find(b=>b.textContent.includes('Сбросить все изменения')).click();
     document.querySelector('#fai-visual-editor-panel .fai-ve-save').click();
   });
   await page.waitForFunction(expected=>document.querySelector('#home .pfv-intro h1')?.textContent?.includes(expected),beforeText,{timeout:8000});
   check(tag+' visual editor reset restores original site without touching TTK',
     await page.evaluate(()=>JSON.parse(localStorage.getItem('farruh-ai-visual-layout-v1')||'[]').length===0),null);
 }
 check(tag+' no browser errors',errors.length===0,errors.slice(0,12));
}

async function run(theme,width,height){
 const mobile=width<600,tag=theme+'-'+(mobile?'mobile':'desktop');
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.dismiss());
 await page.addInitScript(t=>{localStorage.setItem('farruh-ai-approved-premium-v3','true');localStorage.setItem('farruh-ai-approved-black-ice-v1','true');localStorage.setItem('farruh-ai-approved-royal-premium-20261114','true');localStorage.setItem('farruh-ai-appearance-v1',JSON.stringify({theme:t,density:'standard',radius:20,scale:1,motion:false}));if(t==='royal')localStorage.setItem('farukh-print:catalog:v1',JSON.stringify([{id:'qa-prep-only',kind:'prep',name:'Капуста — QA образец',storage:'+2…+6 °C',hours:12,needsReview:false,prepCategory:'Овощи'}]))},theme);
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
   const expectedLabels=['Главная','Проекты','ТТК','Заготовки','Маркировка','Ещё'];
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
   // A4 is a fixed focus surface: old PRO bar lives underneath.
   await page.screenshot({path:'artifacts/premium-'+tag+'-editor-pro.png',fullPage:false,timeout:12000});
   const catalog=await page.evaluate(()=>({
    count:document.querySelectorAll('#ttk-design-picker .ttk-design-card').length,
    selected:document.querySelector('#ttk-design-picker .ttk-design-card[aria-pressed="true"]')?.dataset.ttkLayout,
    sheet:document.querySelector('#editor .ttk-paper')?.dataset.ttkLayout,
    unchangedForm:!!document.querySelector('#card-scope'),
     galleryVisible:document.querySelector('#ttk-design-picker')?.getBoundingClientRect().height>30,
     uploadButton:!!document.querySelector('.ttk-studio-photo-action')
   }));
   check(tag+' 4 Premium allergen A4 layouts appear in TTK editor with current selection',
     catalog.count===4&&catalog.selected==='teal-matrix'&&catalog.sheet==='teal-matrix'&&catalog.unchangedForm&&catalog.galleryVisible&&catalog.uploadButton,catalog);
   await page.locator('#ttk-design-picker [data-ttk-layout="premium-blue"]').click();
   check(tag+' selecting Premium Blue changes the live A4 paper',
     await page.evaluate(()=>document.querySelector('#editor .ttk-paper')?.dataset.ttkLayout==='premium-blue'),null);
   if(theme==='crystal'&&mobile){
    // The design showroom is read-only; switch to original editable fields first.
    await page.locator('#editor .ttk-onepage-full-form').click();
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
      draft.name==='Пробный ролл'&&draft.layoutTemplate==='premium-blue'&&
      draft.ingredients?.some(x=>x.name==='Рис'&&Number(x.grams)===100),
      {name:draft.name,layout:draft.layoutTemplate,ingredients:draft.ingredients?.length});
   }
   await page.evaluate(()=>{window.confirm=()=>true});
   // PDF preview returns to fixed A4 focus mode, which has its own Back button.
   if(await page.locator('#editor').getAttribute('data-mode')==='paper')
    await page.locator('#editor .ttk-onepage-back').click();
   else await page.locator('#closeeditor').click();
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
