import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('public/index.html');
const workspace=read('public/premium-workspace.js');
const royal=read('public/premium-royal-v2.js');
const ultra=read('public/ultra-admin.js');
const health=read('public/system-health.js');
test('owner has a real Ultra Admin category and protected route',()=>{
 assert.match(html,/id="ultra-admin" hidden/);
 assert.match(html,/'ultra-admin':'ULTRA ADMIN'/);
 assert.match(html,/ultra-admin\.css\?v=1/);
 assert.match(html,/mountPremiumWorkspace\(\{show,openDataCenter:/);
 assert.ok(html.indexOf('await requireOwner()')<html.indexOf('mountPremiumWorkspace({show,'));
});
test('Ultra Admin is reachable from premium sidebar, home and settings',()=>{
 assert.match(workspace,/mountUltraAdmin\(/);
 assert.match(workspace,/pf-sidebar-ultra-admin/);
 assert.match(workspace,/ULTRA ADMIN · Управление/);
 assert.match(workspace,/\['settings','ULTRA ADMIN'/);
 assert.match(royal,/\['chef','♛ ULTRA ADMIN','ultra-admin'\]/);
 assert.match(royal,/\['settings','ULTRA ADMIN',\(\)=>goto\('ultra-admin'\)\]/);
});
test('enabled owner actions navigate to existing working editors',()=>{
 for(const target of ["goTo('site-settings')","goTo('recipes')","goTo('preparations')",
  "goTo('lab')","goTo('print-control')","openProjects","openStudio",
  "openDataCenter","document.getElementById('manage-categories')"])assert.ok(ultra.includes(target),target);
 assert.match(ultra,/пока не реализованы/);
 assert.doesNotMatch(ultra,/eval\(|innerHTML/);
});
test('admin section is included in honest availability indicators',()=>{
 assert.match(health,/'ultra-admin': local/);
 assert.match(health,/\/ultra admin\/\.test\(name\)/);
});
