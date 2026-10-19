import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dir=path.resolve('public/next');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const js=fs.readFileSync(path.join(dir,'workspace.js'),'utf8');
const css=fs.readFileSync(path.join(dir,'workspace.css'),'utf8');

test('next workspace has home, TTK, HACCP only in primary navigation',()=>{
 const nav=html.match(/<nav aria-label="Основные разделы">([\s\S]*?)<\/nav>/);
 assert.ok(nav);
 assert.deepEqual([...nav[1].matchAll(/data-to="([^"]+)"/g)].map(m=>m[1]),['home','recipes','lab']);
});
test('all DOM hooks used by new JS exist in HTML',()=>{
 for(const [,id] of js.matchAll(/\$\('([\w-]+)'\)/g)){
   assert.ok(html.includes('id="'+id+'"'),'missing element #'+id);
 }
});
test('ES module imports resolve to existing public modules',()=>{
 for(const [,p] of js.matchAll(/^import .*? from '([^']+)';/gm)){
   assert.ok(fs.existsSync(path.resolve('public',p.slice(1))),'missing import '+p);
 }
});
test('retains original store and recipe/HACCP data models',()=>{
 for(const token of ['DeviceStore','upsertRecipe','deleteRecipe','mountHaccp','mountGoogleSync','/api/recipes/pdf','/api/recipes/word']){
   assert.ok(js.includes(token),'missing integration '+token);
 }
});
test('HACCP is represented as actual records and never synthesized measurements',()=>{
 assert.ok(js.includes('state.haccp?.records'));
 assert.ok(!js.includes('Math.random('));
 assert.ok(!js.includes('confirmed:true'));
});
test('mobile menu and accessible reduced-motion support are present',()=>{
 assert.ok(html.includes('class="mobile-nav"'));
 assert.ok(css.includes('@media(max-width:750px)'));
 assert.ok(css.includes('prefers-reduced-motion:reduce'));
});
