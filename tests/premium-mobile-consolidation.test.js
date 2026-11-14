import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('One Royal mobile header and bottom dock are reused for Home and workspaces',async()=>{
 const css=await read('public/premium-mobile-unified.css');
 const html=await read('public/index.html');
 const luxury=await read('public/luxury-ui.js');
 assert.ok(html.includes('/premium-mobile-unified.css?v=1'));
 assert.ok(html.includes('/luxury-ui.js?v=10'));
 assert.ok(css.includes('body.lx-pro[data-pf-theme="royal"][data-view="home"] > .aurora-top'));
 assert.ok(css.includes('body.lx-pro[data-pf-theme="royal"][data-view="home"] .mobile-tools.lx-ref-bottom'));
 assert.ok(css.includes('#pf-workspace .pfv-phone-nav'));
 assert.ok(css.includes('grid-template-columns:repeat(6,minmax(0,1fr))'));
 for(const label of ["'Главная','home'","'Проекты','projects'","'ТТК','recipes'","'Заготовки','preparations'","'Маркировка','print-control'"]){
  assert.ok(luxury.includes(label),'Missing mobile navigation item '+label);
 }
 assert.ok(luxury.includes("b.addEventListener('click',()=>opts.onOpenProjects?.())"));
 assert.ok(luxury.includes("else b.dataset.view=target"));
});
test('Royal mobile corrections keep all kitchen routes, preserve data, and scope to screen',async()=>{
 const css=await read('public/premium-mobile-unified.css');
 const ws=await read('public/premium-workspace.js');
 assert.ok(css.includes('button[data-view="lab"]'));
 assert.ok(css.includes('button[data-view="tasks"]'));
 assert.ok(ws.includes('mountPremiumRoyalV2({shell,goto,openStudio,openProjects})'));
 assert.ok(ws.includes("projectButton.insertAdjacentHTML('afterbegin',icon('book'))"));
 assert.ok(css.includes('@media screen and (max-width:720px)'));
 assert.ok(!css.includes('@media print'));
 assert.ok(!css.includes('localStorage.setItem'));
});
test('FARUKH PRINT mobile rows have readable actions without altering storage/printing',async()=>{
 const css=await read('public/premium-mobile-unified.css');
 const print=await read('public/print-control.js');
 const html=await read('public/index.html');
 assert.ok(html.includes("import('/print-control.js?v=27')"));
 assert.ok(css.includes('#print-control-root .pc-row-controls button'));
 assert.ok(css.includes('min-height:44px!important'));
 assert.ok(css.includes('#print-control-root .pc-filters'));
 assert.ok(print.includes("const deleteButton=btn('Удалить','pc-remove',()=>remove(p))"));
 assert.ok(print.includes("deleteButton.setAttribute('aria-label'"));
 assert.ok(print.includes("if(!confirm('Удалить этикетку"));
 assert.ok(print.includes("const DB_KEY='farukh-print:catalog:v1'"));
});