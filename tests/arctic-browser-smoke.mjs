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

  // The new free Google Drive backup controls must appear under Device Data.
  const backupLocated=await page.evaluate(()=>document.getElementById('device-export')?.parentElement?.contains(document.querySelector('.google-backup-open')));
  assert.equal(backupLocated,true,'Google backup is alongside local backup controls');
  const settingsDialog=page.locator('.lunar-dialog[aria-label="Настройки и данные"]');
  await settingsDialog.evaluate(el=>el.showModal());
  const settingsContrast=await settingsDialog.evaluate(el=>{
   const header=el.querySelector(':scope > .bar');
   const section=el.querySelector('.voice-settings > summary');
   const title=header.querySelector('h2');
   const color=getComputedStyle(section).color;
   const match=color.match(/[0-9.]+/g)?.map(Number)||[];
   return {
     headerBackground:getComputedStyle(header).backgroundImage,
     titleColor:getComputedStyle(title).color,
     summaryColor:color,
     summaryRgb:match.slice(0,3)
   };
  });
  assert.ok(settingsContrast.headerBackground.includes('gradient')&&!settingsContrast.headerBackground.includes('rgb(30, 36, 40)'),'Settings header remains dark: '+JSON.stringify(settingsContrast));
  assert.ok(settingsContrast.summaryRgb.length===3&&settingsContrast.summaryRgb[0]<120&&settingsContrast.summaryRgb[2]<190,'Settings summary is too pale: '+JSON.stringify(settingsContrast));
  const deviceBar=await page.locator('#device-export').evaluate(el=>{
    const bar=el.closest('.bar'),style=getComputedStyle(bar);
    return {background:style.backgroundImage,position:style.position,backgroundColor:style.backgroundColor};
  });
  assert.ok(deviceBar.background.includes('rgb(248, 252, 255)')&&deviceBar.position!=='sticky',
    'Device backup buttons have inherited legacy black bar: '+JSON.stringify(deviceBar));
  await page.screenshot({path:'artifacts/arctic-settings-'+mode+'.png',fullPage:false,timeout:12000});
  await page.locator('#device-export').evaluate(el=>el.closest('details').open=true);
  await page.locator('.google-backup-open').click();
  assert.equal(await visible(page,'.google-backup-dialog'),true,'Google backup dialog opens');
  const backupFormBar=await page.locator('.google-backup-dialog form .bar').evaluate(el=>{
    const s=getComputedStyle(el);
    return {background:s.backgroundImage,position:s.position,columns:s.gridTemplateColumns};
  });
  assert.ok(backupFormBar.background.includes('rgb(247, 252, 255)')&&backupFormBar.position!=='sticky',
    'Google connect buttons have inherited black action bar: '+JSON.stringify(backupFormBar));

  assert.equal(await page.locator('.google-backup-dialog [data-save]').isDisabled(),true,'No upload before Google is connected');
  assert.equal(await page.locator('.google-backup-dialog [data-list]').isDisabled(),true,'No cloud operations before connection');
  await page.screenshot({path:'artifacts/arctic-google-backup-'+mode+'.png',fullPage:false,timeout:12000});
  await page.locator('.google-backup-dialog [data-close]').click();

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
  assert.equal(await visible(page,'#lab .haccp-autofill-panel button.primary'),true,'auto-filled monthly PDF bundle available on HACCP dashboard');
  const packStatus=await page.locator('#lab .haccp-auto-stats').innerText();
  assert.match(packStatus,/12 журналов/,'all 12 journals prepared automatically');
  assert.match(packStatus,/строк по графику без подтверждения/,'unverified entries are not represented as measured');
  assert.match(await page.locator('#lab .haccp-autofill-panel').innerText(),/черновики/i,'auto-filled reports explicitly protect factual inspection data');

  await page.screenshot({path:'artifacts/arctic-haccp-'+mode+'.png',fullPage:false,timeout:12000});
  const dailyOverview=await page.locator('#lab .haccp-daily-overview').first().innerText();
  assert.match(dailyOverview,/запланированных проверок|план на сегодня/i,'daily checks use approved schedule, not all event-based journals');
  assert.match(dailyOverview,/Генеральная уборка:/,'monthly deep-clean progress is visible');
  await page.locator('#lab .haccp-utilities button').last().click();
  assert.equal(await visible(page,'#lab .haccp-plan-settings'),true,'HACCP daily schedule settings open');
  assert.equal(await page.locator('#lab .haccp-plan-check input:checked').count(),4,'four routine journals enabled initially');
  assert.equal(await page.locator('#lab .haccp-plan-settings input[name=generalCleaningTarget]').inputValue(),'2','deep-clean goal defaults to twice per month');
  await page.screenshot({path:'artifacts/arctic-haccp-plan-'+mode+'.png',fullPage:false,timeout:12000});
  await page.locator('#lab .haccp-back').click();
  await page.locator('#lab [data-journal=cleaning]').click();
  assert.equal(await page.locator('#lab .haccp-paper-premium').getAttribute('data-mode'),'paper','professional A4 page is default');
  const headTexts=await page.locator('#lab .haccp-paper-premium .haccp-a4-table th').allInnerTexts();
  assert.ok(headTexts.includes('Вид уборки')&&headTexts.includes('Участок / инвентарь'),'cleaning A4 table has process-specific columns');
  const paperColors=await page.locator('#lab .haccp-a4-paper').evaluate(el=>({bg:getComputedStyle(el).backgroundColor,w:el.getBoundingClientRect().width,overflow:getComputedStyle(el.parentElement).overflowX}));
  assert.match(paperColors.bg,/rgb\(255, 255, 255\)/,'A4 page is white, not legacy dark');
  assert.ok(paperColors.w>=1000&&paperColors.overflow==='auto','A4 journal is legible and horizontally scrollable on phones: '+JSON.stringify(paperColors));
  await page.screenshot({path:'artifacts/arctic-haccp-cleaning-a4-'+mode+'.png',fullPage:false,timeout:12000});
  await page.locator('#lab .haccp-sheet-toolbar button').first().click();
  assert.equal(await visible(page,'#lab select[name=cleaningType]'),true,'cleaning type is accessible after entering edit mode');
  assert.equal(await page.locator('#lab select[name=cleaningType] option').count(),2,'cleaning mode options');
  await page.locator('#lab select[name=cleaningType]').selectOption('general');
  await page.locator('#lab input[name=zone]').fill('Витрина');
  await page.locator('#lab .journal-modes button').first().click();
  const draftText=await page.locator('#lab .haccp-draft-row').innerText();
  assert.match(draftText,/Генеральная/,'A4 preview reflects selected cleaning kind');
  assert.match(draftText,/Витрина/,'A4 preview reflects entered zone');
  assert.match(draftText,/Черновик/,'unsaved preview cannot be mistaken for confirmed inspection');
  assert.ok(await page.locator('#lab .haccp-blank-row').count()>=1,'empty A4 journal has unconfirmed blank slots');
  await page.locator('#lab .haccp-back').click();
  await page.locator('#lab [data-journal=receiving]').click();
  const receivingHeads=await page.locator('#lab .haccp-a4-table th').allInnerTexts();
  assert.ok(receivingHeads.includes('Поставщик')&&receivingHeads.includes('Факт / границы, °C')&&
   receivingHeads.includes('Годен до'),'receiving A4 captures suppliers, actual temperatures and product expiry');
  assert.ok(!receivingHeads.includes('Вид уборки'),'journals do not reuse cleaning columns');
  assert.match(await page.locator('#lab .haccp-receiving-settings').innerText(),/Приёмка сырья/,'branch-specific receiving catalog visible');
  assert.match(await page.locator('#lab .haccp-daily-overview').last().innerText(),/по факту поставки/i,'delivery is event-based, not fabricated daily');
  assert.equal(await page.locator('#lab .haccp-sheet-toolbar button').filter({hasText:'Сохранить образец'}).count(),0,
   'receiving has no daily auto-approval template');
  await page.locator('#lab .haccp-sheet-toolbar button').first().click();
  assert.equal(await page.locator('#lab select[name^=inspect]').count(),6,'all six actual receiving checks are present');
  await page.locator('#lab select[name=category]').selectOption('chilled');
  await page.locator('#lab select[name=decision]').selectOption('accepted');
  assert.equal(await page.locator('#lab input[name=measured]').evaluate(el=>el.required),true,
   'cold deliveries cannot be accepted without actual measured temperature');
  await page.locator('#lab select[name=decision]').selectOption('rejected');
  assert.equal(await page.locator('#lab input[name=measured]').evaluate(el=>el.required),false,
   'damaged deliveries can be rejected even if a thermometer was not used');
  await page.screenshot({path:'artifacts/arctic-haccp-receiving-'+mode+'.png',fullPage:false,timeout:12000});
  await page.locator('#lab .haccp-back').click();
  await page.locator('#lab [data-journal=hygiene]').click();
  const hygieneHeads=await page.locator('#lab .haccp-a4-table th').allInnerTexts();
  assert.ok(hygieneHeads.includes('Сотрудник')&&hygieneHeads.includes('Допуск к работе'),'hygiene has its own A4 table');
  await page.locator('#lab .haccp-sheet [name=pointId]').evaluate(el=>{el.value='point-1';el.dispatchEvent(new Event('change',{bubbles:true}))});
  const sampleButton=page.locator('#lab .haccp-sheet-toolbar button').filter({hasText:'Сохранить образец'});
  assert.equal(await sampleButton.count(),1,'hygiene example can be saved for daily auto-fill');
  await sampleButton.click();
  await page.waitForFunction(()=>document.querySelector('#lab .haccp-message')?.textContent?.includes('Образец сохранён'),null,{timeout:12000});
  await page.waitForFunction(()=>document.querySelector('#lab .haccp-drafts-panel h2')?.textContent?.includes('черновики'),null,{timeout:12000});



  await page.locator('#lab .haccp-back').click();
  await page.locator('#lab [data-journal=temperature]').click();
  const branchSelector='#lab .haccp-temperature-point-selector select';
  await page.locator(branchSelector).selectOption('point-1');
  const branchTheme=await page.locator('#lab .haccp-temperature-point-selector').evaluate(el=>{
   const surface=getComputedStyle(el),hint=getComputedStyle(el.querySelector('p'));
   return {background:surface.backgroundImage,foreground:surface.color,detail:hint.color};
  });
  assert.match(branchTheme.background,/linear-gradient/i,'branch selector has a light Arctic Sapphire background, not the obsolete dark translucent slab');
  assert.ok(!branchTheme.background.includes('13, 48, 65'),'no legacy dark slate background in branch selector: '+JSON.stringify(branchTheme));
  await page.screenshot({path:'artifacts/arctic-haccp-point-theme-'+mode+'.png',fullPage:false,timeout:12000});
  const branchSettings=page.locator('#lab .haccp-temperature-point-settings');
  assert.equal(await branchSettings.count(),1,'selected location exposes rename control in temperature journal');
  await branchSettings.locator('summary').click();
  const branchName='QA филиал '+mode;
  await branchSettings.locator('input[type=text]').fill(branchName);
  await branchSettings.locator('button').click();
  await page.waitForFunction(name=>document.querySelector('#lab .haccp-temperature-point-selector select')?.selectedOptions?.[0]?.text===name,branchName,{timeout:12000});
  const branch2=await page.locator(branchSelector).locator('option[value="point-2"]').innerText();
  assert.equal(branch2,'Точка 2','renaming first point never changes other location');
  assert.equal(await visible(page,'#lab .haccp-temperature-sample'),true,'temperature sample form visible without opening the hidden single-reading panel');
  assert.match(await page.locator('#lab .haccp-temperature-sample h3').innerText(),/МОЙ ОБРАЗЕЦ/,'sample has an obvious headline');
  const saveTempSample=page.locator('#lab .haccp-temperature-sample-actions button').filter({hasText:'Сохранить образец'});
  assert.equal(await saveTempSample.isVisible(),true,'save sample button visible directly in temperature journal');
  assert.equal(await visible(page,'#lab .haccp-temperature-drafts'),true,'reviewable temperature drafts list visible');
  const addEquipmentButton=page.locator('#lab .haccp-temperature-add>button');
  assert.equal(await addEquipmentButton.isVisible(),true,'user can add another refrigerator in the temperature journal');
  await addEquipmentButton.click();
  assert.equal(await visible(page,'#lab .haccp-temperature-add-editor'),true,'inline add equipment form opens');
  await page.locator('#lab .haccp-temperature-add-fields input[type=text]').fill('Морозильник QA 2');
  const tempLimits=page.locator('#lab .haccp-temperature-add-fields input[type=number]');
  await tempLimits.nth(0).fill('-20');
  await tempLimits.nth(1).fill('-12');
  await page.locator('#lab .haccp-temperature-add-editor button.primary').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#lab .haccp-temperature-range strong')].some(x=>x.textContent==='Морозильник QA 2'),null,{timeout:12000});
  assert.ok((await page.locator('#lab .haccp-temperature-range strong').allInnerTexts()).includes('Морозильник QA 2'),
   'added freezer appears in the sample range list without navigating to settings');
  const addedRange=page.locator('#lab .haccp-temperature-range').filter({hasText:'Морозильник QA 2'});
  assert.deepEqual(await addedRange.locator('input[type=number]').evaluateAll(els=>els.map(x=>x.value)),['-20','-12'],'new freezer limits retained');
  const editId=await addedRange.getAttribute('data-equipment-id');
  const editRow=page.locator('#lab .haccp-temperature-range[data-equipment-id="'+editId+'"]');
  const editableName=editRow.locator('.haccp-temperature-equipment-name');
  await editableName.fill('Морозильник QA · после переименования');
  await editRow.locator('input[type=number]').nth(0).fill('-25');
  await editRow.locator('input[type=number]').nth(1).fill('-18');
  await editRow.locator('.haccp-temperature-equipment-save').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#lab .haccp-temperature-range strong')].some(x=>x.textContent==='Морозильник QA · после переименования'),null,{timeout:12000});
  const renamed=page.locator('#lab .haccp-temperature-range').filter({hasText:'Морозильник QA · после переименования'});
  assert.deepEqual(await renamed.locator('input[type=number]').evaluateAll(els=>els.map(x=>x.value)),['-25','-18'],'edited limits persist');
  await page.locator(branchSelector).selectOption('point-2');
  assert.equal(await page.locator('#lab .haccp-temperature-range strong').filter({hasText:'Морозильник QA · после переименования'}).count(),0,'other point is separate');
  await page.locator(branchSelector).selectOption('point-1');
  assert.equal(await page.locator('#lab .haccp-temperature-range strong').filter({hasText:'Морозильник QA · после переименования'}).count(),1,'equipment name persists after changing point');
  await page.screenshot({path:'artifacts/arctic-haccp-temperature-sample-'+mode+'.png',fullPage:false,timeout:12000});

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
  // Simulate a syntactically broken optional HACCP module: the rest of the app must remain responsive.
  const isolated=await context.newPage();
  await isolated.route('**/haccp-ui.js*',route=>route.fulfill({
   status:200,contentType:'text/javascript; charset=utf-8',
   body:'export function mountHaccp(){})'
  }));
  await isolated.goto(base+'/',{waitUntil:'domcontentloaded',timeout:20000});
  await isolated.waitForFunction(()=>document.querySelector('#connection')?.textContent==='Хранение на устройстве',null,{timeout:20000});
  await isolated.waitForFunction(()=>document.querySelector('#lab')?.textContent?.includes('ХАССП временно недоступен'),null,{timeout:10000});
  await isolated.locator('#ruby-menu').click();
  assert.equal(await visible(isolated,'#chef-menu'),true,'menu still opens with a broken HACCP module');
  await isolated.locator('#ruby-menu').click();
  await isolated.locator('#home-new-recipe').click();
  assert.equal(await isolated.locator('body').getAttribute('data-view'),'recipes','TTK still opens with a broken HACCP module');
  await isolated.close();

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
