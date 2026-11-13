import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {installDeviceSyncApi} from '../device-sync-api.js';

class TestStore{
 constructor(){this.storage='yandex';this.content=new Map();this.queue=Promise.resolve()}
 async read(name,fallback){return structuredClone(this.content.has(name)?this.content.get(name):fallback)}
 async write(name,value){this.content.set(name,structuredClone(value))}
 async transaction(fn){const job=this.queue.then(fn);this.queue=job.catch(()=>{});return job}
}

const recipe=(id,name)=>({id,name,ingredients:[]});
const sample=()=>({recipes:[recipe('a','Филадельфия')],tasks:[],memory:[],inspections:[],preparations:[],releasedRecipes:[],myRecipeTemplates:[],projectCatalog:{projects:[{id:'more-sushi',name:'Море Суши'}]}});
async function withServer(fn){
 const app=express();app.use(express.json({limit:'20mb'}));
 const store=new TestStore();
 installDeviceSyncApi(app,{store,auth:{enabled:true,verify:token=>token==='test-only-session'}});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const req=async(method,body)=>{
  const res=await fetch(base+'/api/device-sync',{method,headers:{'Content-Type':'application/json',Cookie:'fai_owner=test-only-session'},...(body?{body:JSON.stringify(body)}:{})});
  return {status:res.status,json:await res.json()};
 };
 try{await fn({req,store})}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
}
test('sync API first saves to a separate workspace and enforces optimistic revisions',async()=>{
 await withServer(async({req,store})=>{
  const initial=await req('GET');assert.equal(initial.status,200);assert.equal(initial.json.revision,0);
  assert.equal(initial.json.snapshot,null);
  let result=await req('PUT',{revision:0,snapshot:sample()});
  assert.equal(result.status,200);assert.equal(result.json.revision,1);
  result=await req('GET');
  assert.equal(result.json.revision,1);
  assert.equal(result.json.snapshot.recipes[0].name,'Филадельфия');
  assert.equal(result.json.snapshot.categories,undefined,'Absence of custom categories is not an explicit deletion');
  assert.equal(store.content.has('state.json'),false,'Legacy state is never modified');
  const stale=await req('PUT',{revision:0,snapshot:sample()});
  assert.equal(stale.status,409);
  assert.equal((await req('GET')).json.revision,1);
  const edited=sample();edited.recipes[0].name='Филадельфия PRO';
  assert.equal((await req('PUT',{revision:1,snapshot:edited})).status,200);
  assert.equal((await req('GET')).json.snapshot.recipes[0].name,'Филадельфия PRO');
  assert.equal(store.content.get('device-sync-previous-v1.json').snapshot.recipes[0].name,'Филадельфия');
 });
});
test('sync API rejects malformed and oversized snapshots without overwriting cloud data',async()=>{
 await withServer(async({req})=>{
  assert.equal((await req('PUT',{revision:0,snapshot:{recipes:[{id:'a'},{id:'a'}]}})).status,400);
  assert.equal((await req('PUT',{revision:0,snapshot:{recipes:[null]}})).status,400);
  assert.equal((await req('PUT',{revision:-1,snapshot:sample()})).status,400);
  assert.equal((await req('GET')).json.snapshot,null);
 });
});
