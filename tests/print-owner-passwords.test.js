import test from 'node:test';
import assert from 'node:assert/strict';
import {installPrintSyncApi} from '../print-sync-api.js';

function harness(){
 const routes=new Map(),data=new Map(),app={};
 for(const method of ['get','post','put','patch','delete'])
  app[method]=(path,...steps)=>routes.set(method+' '+path,steps);
 const store={
  storage:'yandex',
  read:async(key,defaultValue)=>structuredClone(data.has(key)?data.get(key):defaultValue),
  write:async(key,value)=>{data.set(key,structuredClone(value))},
  transaction:async fn=>fn()
 };
 installPrintSyncApi(app,{store,auth:{enabled:true,verify:v=>v==='owner'}});
 return {data,async call(method,path,body={},options={}){
  const req={body,params:options.params||{},ip:'127.0.0.1',method:method.toUpperCase(),
   headers:{cookie:options.owner?'fai_owner=owner':''},
   get(k){return {'origin':'https://example.com','host':'example.com','X-Farukh-Print-Device':options.device||'','X-Farukh-Print-Staff':options.staff||''}[k]||''}};
  const res={code:200,body:null,status(v){this.code=v;return this},set(){return this},json(v){this.body=v;return this}};
  for(const fn of routes.get(method+' '+path)){
   let proceed=false;
   if(fn.length>=3){await fn(req,res,()=>proceed=true);if(!proceed)break}
   else{await fn(req,res);break}
  }
  return res;
 }};
}

test('owner chooses employee credentials while system only stores a salted verifier',async()=>{
 const h=harness();
 const password='OceanKitchen-8472!';
 const newUser=await h.call('post','/api/farukh-print/admin/staff',
  {name:'Повар',login:'chef_blue',point:'Плазма',password},{owner:true});
 assert.equal(newUser.code,201);
 assert.equal(newUser.body.staff.login,'chef_blue');
 assert.equal(Object.hasOwn(newUser.body,'password'),false);
 const record=h.data.get('farukh-print-staff.json')[0];
 assert.equal(record.passhash.length,64);
 assert.equal(Object.hasOwn(record,'password'),false);
 const token=(await h.call('post','/api/farukh-print/admin/pair',{}, {owner:true})).body.code;
 const device=(await h.call('post','/api/farukh-print/device/pair',{code:token})).body.token;
 const first=await h.call('post','/api/farukh-print/device/staff/login',{login:'chef_blue',password},{device});
 assert.equal(first.code,200);
 const nextPassword='OceanKitchen-9983!';
 const renewed=await h.call('post','/api/farukh-print/admin/staff/:id/reset',{password:nextPassword},
  {owner:true,params:{id:record.id}});
 assert.equal(renewed.code,200);
 assert.equal(Object.hasOwn(renewed.body,'password'),false);
 assert.equal((await h.call('get','/api/farukh-print/device/staff/session',{}, {device,staff:first.body.session})).code,401);
 assert.equal((await h.call('post','/api/farukh-print/device/staff/login',{login:'chef_blue',password:nextPassword},{device})).code,200);
 assert.equal((await h.call('post','/api/farukh-print/device/staff/login',{login:'chef_blue',password},{device})).code,401);
});

test('owner password input rejects unsafe strings and unauthorized resets',async()=>{
 const h=harness();
 for(const password of ['12345678','123',' many-spaces ','x'.repeat(129)]){
  const result=await h.call('post','/api/farukh-print/admin/staff',
   {name:'Повар',login:'chef_test',point:'Плазма',password},{owner:true});
  assert.equal(result.code,400);
 }
 const ok=await h.call('post','/api/farukh-print/admin/staff',
  {name:'Повар',login:'chef_test',point:'Плазма',password:'BetterPass-5382'},{owner:true});
 assert.equal(ok.code,201);
 const denied=await h.call('post','/api/farukh-print/admin/staff/:id/reset',
  {password:'AnotherGood-5382'},{params:{id:ok.body.staff.id}});
 assert.equal(denied.code,401);
});
