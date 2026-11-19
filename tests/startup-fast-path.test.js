import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const page=()=>readFile(new URL('../public/index.html',import.meta.url),'utf8');

test('FARUKH PRINT administration loads on first visit, not on every Home visit',async()=>{
 const html=await page();
 for(const script of ['print-control.js?v=27','print-control-cloud.js?v=7','print-control-staff.js?v=9']){
  assert.ok(html.includes("import('/"+script+"')"),'Lazy import missing: '+script);
  assert.ok(!html.includes("from '/"+script+"'"),'Eager import remains: '+script);
 }
 assert.match(html,/function ensurePrintControl\(\)/);
 assert.match(html,/printControlPromise=Promise\.all/);
 assert.match(html,/function renderPrintControl\(\)/);
 assert.match(html,/if\(view==='print-control'\)\{renderPrintControl\(\);return\}/);
 assert.match(html,/renderLocal:\(\)=>printCenter\.render\(\)/);
 assert.match(html,/staff\.mountPrintStaffControl\(\{root\}\)/);
});

test('Noncritical functional styles are async, all stylesheet URLs remain stable',async()=>{
 const html=await page();
 const deferred=['recipe-sheet.css','haccp.css','haccp-plan.css','haccp-paper-premium.css','haccp-minimal-v2.css','print-control.css','print-control-theme.css','ttk-layouts.css','ttk-pro-workspace.css','ttk-studio.css'];
 for(const css of deferred){
  const link=html.match(new RegExp('<link rel="stylesheet" href="/'+css.replace(/\\./g,'\\\\.')+'[^>]*>'))?.[0];
  assert.ok(link,'Missing stylesheet '+css);
  assert.match(link,/media="print" onload="this\.media='all'"/);
 }
 // Home still retains synchronous layout styles so its first paint does not flash unstyled.
 assert.match(html,/<link rel="stylesheet" href="\/premium-workspace\.css[^>]*>/);
 assert.match(html,/<link rel="stylesheet" href="\/premium-showcase\.css[^>]*>/);
 assert.match(html,/root\.dataset\.pfBoot='premium'/);
 assert.match(html,/\},15000\)/);
});

test('Legacy print builds on install, not on every Render cold start',async()=>{
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(pkg.scripts.postinstall,'node scripts/build-legacy-print.js');
 assert.equal(pkg.scripts.start,'node server.js');
});
