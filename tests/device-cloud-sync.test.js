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
 assert.equal(merged.recipes[0].name,'Филадельфия с планшета');
 assert.match(merged.recipes[1].name,/копия с другого устройства/);
});

test('legacy ID collision is idempotent when server accepted the upload but client has not recorded baseline',()=>{
 const local=snapshot([recipe('legacy-id','Тест со старого телефона')]);
 const cloud=snapshot([recipe('legacy-id','Филадельфия с планшета')]);
 const first=reconcileSnapshots(null,local,cloud);
 const again=reconcileSnapshots(null,local,first);
 assert.equal(again.recipes.length,2);
 assert.deepEqual(new Set(again.recipes.map(x=>x.id)).size,2);
});
