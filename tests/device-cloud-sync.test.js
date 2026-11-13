import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileSnapshots,pickSyncSnapshot} from '../public/device-sync-merge.js';

const recipe=(id,name,extra={})=>({id,name,category:'Холодные роллы',ingredients:[],...extra});
const snapshot=(recipes=[],projects=[])=>({
 recipes,releasedRecipes:[],preparations:[],tasks:[],inspections:[],memory:[],myRecipeTemplates:[],categories:[],
 projectCatalog:{projects}
});

test('first connection combines unrelated recipes from phone and tablet without deletion',()=>{
 const phone=snapshot([recipe('old-phone','Тест')],[{id:'sushi-beri',name:'Суши Бери'}]);
 const tablet=snapshot([recipe('new-tablet','Филадельфия')],[{id:'more-sushi',name:'Море Суши'}]);
 const result=reconcileSnapshots(null,phone,tablet);
 assert.deepEqual(result.recipes.map(r=>r.id),['old-phone','new-tablet']);
 assert.equal(result.projectCatalog.projects.length,2);
 assert.equal(phone.recipes.length,1);
 assert.equal(tablet.recipes.length,1);
});

test('subsequent remote edit is pulled when local copy is unchanged',()=>{
 const old=snapshot([recipe('1','Филадельфия')]);
 const remote=snapshot([recipe('1','Филадельфия', {technology:'Новый процесс'})]);
 const result=reconcileSnapshots(old,old,remote);
 assert.equal(result.recipes[0].technology,'Новый процесс');
});

test('local updates sync when server is unchanged',()=>{
 const old=snapshot([recipe('1','Филадельфия')]);
 const phone=snapshot([recipe('1','Филадельфия',{nutrition:{kcal:200}})]);
 const result=reconcileSnapshots(old,phone,old);
 assert.equal(result.recipes[0].nutrition.kcal,200);
});

test('legitimate deletions propagate after a known shared baseline',()=>{
 const old=snapshot([recipe('1','Удаляемый')]);
 const deleted=snapshot([]);
 const result=reconcileSnapshots(old,deleted,old);
 assert.deepEqual(result.recipes,[]);
});

test('simultaneous conflicting updates fail without silently losing a version',()=>{
 const old=snapshot([recipe('1','Исходный')]);
 const phone=snapshot([recipe('1','Телефон')]);
 const tablet=snapshot([recipe('1','Планшет')]);
 assert.throws(()=>reconcileSnapshots(old,phone,tablet),/Конфликт изменений/);
});

test('only approved data are included; Google integration keys remain local',()=>{
 const state={recipes:[recipe('1','ТТК')],googleSync:{key:'secret'},googleBackup:{key:'secret2'},haccp:{private:'not-in-snapshot'}};
 const result=pickSyncSnapshot(state,{projects:[{id:'more-sushi',name:'Море Суши'}],selected:'more-sushi'});
 assert.equal(result.googleSync,undefined);
 assert.equal(result.googleBackup,undefined);
 assert.equal(result.haccp,undefined);
 assert.equal(result.projectCatalog.selected,undefined);
});

test('first merge preserves two divergent legacy recipes with the same ID',()=>{
 const phone=snapshot([recipe('legacy-id','Тест со старого телефона')]);
 const tablet=snapshot([recipe('legacy-id','Филадельфия с планшета')]);
 const merged=reconcileSnapshots(null,phone,tablet);
 assert.equal(merged.recipes.length,2);
 assert.notEqual(merged.recipes[0].id,merged.recipes[1].id);
 assert.ok(merged.recipes.some(r=>r.name==='Филадельфия с планшета'));
 assert.ok(merged.recipes.some(r=>/копия с другого устройства/.test(r.name)));
});

test('legacy ID collision is idempotent when server accepted the upload but client has not recorded baseline',()=>{
 const local=snapshot([recipe('legacy-id','Тест со старого телефона')]);
 const cloud=snapshot([recipe('legacy-id','Филадельфия с планшета')]);
 const first=reconcileSnapshots(null,local,cloud);
 const again=reconcileSnapshots(null,local,first);
 assert.equal(again.recipes.length,2);
 assert.deepEqual(new Set(again.recipes.map(x=>x.id)).size,2);
});

test('implicit default categories are kept absent, rather than overwritten by an empty array',()=>{
 const phone={recipes:[recipe('a','Филадельфия')]};
 const cloud={recipes:[recipe('b','Калифорния')]};
 const localSnapshot=pickSyncSnapshot(phone,{});
 const cloudSnapshot=pickSyncSnapshot(cloud,{});
 assert.equal(localSnapshot.categories,undefined);
 assert.equal(reconcileSnapshots(null,localSnapshot,cloudSnapshot).categories,undefined);
});

test('sync has visible entry, deep link opens panel without silently enabling writes',async()=>{
 const {readFileSync}=await import('node:fs');
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const client=readFileSync(new URL('../public/device-cloud-sync.js',import.meta.url),'utf8');
 assert.match(html,/sync-quick-access/);
 assert.match(html,/deviceCloudSync\.open\(\)/);
 assert.match(html,/new URLSearchParams\(location\.search\)\.get\('sync'\)==='1'/);
 assert.match(client,/node\.id='device-cloud-sync-settings'/);
 assert.match(client,/node\.open=true/);
 assert.match(client,/return \{schedule,start:\(\)=>schedule\(600\),status:\(\)=>lastError,open\}/);
 assert.doesNotMatch(client,/const open=[\s\S]*localStorage\.setItem\(ENABLED_KEY/);
});

test('Premium TTK button is outside the hero and Settings exposes visible cloud sync',async()=>{
 const {readFileSync}=await import('node:fs');
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const settings=readFileSync(new URL('../public/site-settings.js',import.meta.url),'utf8');
 const luxury=readFileSync(new URL('../public/luxury-ui.js',import.meta.url),'utf8');
 assert.match(luxury,/hero\?\.append\(lead\)/,'Premium layout moves the subtitle into the hero');
 assert.match(html,/document\.querySelector\('#recipes > \.lx-ref-hero'\)/,'Place sync row after the hero, not inside its grid');
 assert.doesNotMatch(html,/document\.querySelector\('#recipes \.section-subtitle'\)\?\.after\(syncQuickButton\)/);
 assert.match(settings,/button\('☁️ Синхронизация телефона и планшета'/);
 assert.match(settings,/#device-cloud-sync-settings/);
 assert.match(html,/site-settings\.js\?v=8/,'PWA must load the updated Settings component');
});

test('compact premium sync shortcut fits narrow Android viewports without vertical word wraps',async()=>{
 const {readFileSync}=await import('node:fs');
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/luxury-reference.css',import.meta.url),'utf8');
 assert.match(html,/syncQuickRow\.className='lx-sync-shortcut-row'/);
 assert.match(html,/syncQuickRow\.append\(syncQuickButton\)/);
 assert.match(html,/>Синхронизация<\/span>/);
 assert.doesNotMatch(html,/syncQuickButton\.style\.cssText=/);
 assert.match(html,/luxury-reference\.css\?v=11/);
 assert.match(css,/#recipes #sync-quick-access/);
 assert.match(css,/white-space:nowrap!important/);
 assert.match(css,/height:36px!important/);
 assert.match(css,/\.lx-ref-hero > #sync-quick-access/);
});
