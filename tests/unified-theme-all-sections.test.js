import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Unified theme CSS is the final override after all legacy styles',()=>{
 const html=read('public/index.html');
 const old=html.indexOf('/print-control.css?v=');
 const premium=html.indexOf('/premium-showcase.css?v=');
 const unified=html.indexOf('/unified-theme.css?v=1');
 const print=html.indexOf('/print-control-theme.css?v=1');
 assert.ok(old>=0&&old<premium&&premium<unified&&unified<print);
});
test('All eight designs keep one consistent design-token contract',()=>{
 const studio=read('public/premium-workspace.js');
 const skin=read('public/premium-showcase.css')+read('public/premium-workspace.css');
 for(const name of ['titanium','crystal','royal','arctic','ice','white','gold','burgundy']){
  assert.ok(studio.includes(name+':'),name+' in Design Studio');
  assert.ok(skin.includes('data-pf-theme="'+name+'"'),name+' has a theme palette');
 }
 const shared=read('public/unified-theme.css');
 for(const token of ['--pf-bg','--pf-panel','--pf-raised','--pf-ink','--pf-muted','--pf-line','--pf-accent','--pf-on-accent'])
  assert.ok(shared.includes('var('+token+')'),token);
});
test('Print manager hero, stats, tabs, form fields, paired staff panel and modal use theme tokens',()=>{
 const css=read('public/print-control-theme.css');
 for(const cls of ['pc-hero','pc-stat','pc-tab','pc-workspace-tab','pc-primary','pc-secondary','pc-field','pc-row','pcloud','pcloud-owner-login','pstaff','pstaff-tab','pstaff-point-option','pc-dialog','pc-badge','pc-readiness-fill']){
  assert.ok(css.includes('.'+cls),cls+' should be themed');
 }
 assert.match(css,/@media screen/);
 assert.match(css,/--pf-accent/);
 assert.match(css,/--pf-ink/);
 assert.match(css,/--pf-on-accent/);
});
test('HACCP, journals, chef assistant, navigation and floating AI share theme variables',()=>{
 const css=read('public/unified-theme.css');
 for(const view of ['recipes','tasks','checks','preparations','calc','chat','site-settings','lab'])
  assert.ok(css.includes('#'+view),view+' present');
 for(const control of ['#chef-menu','.mobile-tools','.aurora-top','#neural-launch','.haccp-journal-card','.haccp-metric','.voice-panel','.lunar-dialog'])
  assert.ok(css.includes(control),control+' themed');
});
test('A4 printing and staff web app remain isolated from owner theme styles',()=>{
 const base=read('public/unified-theme.css');
 const print=read('public/print-control-theme.css');
 assert.match(base,/@media screen/);
 assert.match(print,/@media screen/);
 assert.match(base,/:not\(\.ttk-paper \*\)/);
 assert.match(base,/:not\(\.haccp-a4-paper \*\)/);
 assert.match(print,/:not\(\.pc-template-preview \*\)/);
 assert.doesNotMatch(read('public/index.html'),/\/farukh-print\/index\.html[\s\S]*?unified-theme\.css/);
});
