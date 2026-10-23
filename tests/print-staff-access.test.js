import test from 'node:test';
import assert from 'node:assert/strict';
import {installPrintSyncApi} from '../print-sync-api.js';

function setup(){
 const routes=new Map(),persist=new Map();
 const app={};
 for(const method of ['get','post','put','delete'])app[method]=(path,...handlers)=>routes.set(method+' '+path,handlers);
 const store={
  storage:'yandex',
  read:async(name,fallback)=>persist.has(name)?structuredClone(persist.get(name)):structuredClone(fallback),
  write:async(name,data)=>{persist.set(name,structuredClone(data))},
  transaction:async fn=>fn(),
 };
 installPrintSyncApi(app,{store,auth:{enabled:true,verify:t=>t==='ok'}});
 const call=async(method,path,{body={},owner='',device='',staff='',params={},ip='127.0.0.1'}={})=>{
  const stack=routes.get(method+' '+path);
  assert.ok(stack,'Missing '+method+' '+path);
  const req={body,params,ip,method:method.toUpperCase(),headers:{cookie:owner?'fai_owner='+owner:''},get(key){
   return {'origin':'https://example.com','host':'example.com','X-Farukh-Print-Device':device,'X-Farukh-Print-Staff':staff}[key]||''
  }};
  const res={code:200,data:null,head:{},
    status(c){this.code=c;return this},
    set(k,v){this.head[k]=v;return this},
    json(value){this.data=value;return this},
  };
  for(const fn of stack){
   let ok=false;
   if(fn.length===3){await fn(req,res,()=>ok=true);if(!ok)break}
   else{await fn(req,res);break}
  }
  return res;
 };
 return {call,persist};
}
test('Owner creates employee, credentials are one-time, only authorized kitchen can print',async()=>{
 const {call,persist}=setup(),own={owner:'ok'};
 const anon=await call('get','/api/farukh-print/admin/staff');
 assert.equal(anon.code,401);
 const invalid=await call('post','/api/farukh-print/admin/staff',{...own,body:{name:'Гуля',login:'g',point:'Плазма'}});
 assert.equal(invalid.code,400);
 const create=await call('post','/api/farukh-print/admin/staff',{...own,body:{name:'Гуля',login:'gulya01',point:'Плазма'}});
 assert.equal(create.code,201);assert.equal(create.data.staff.role,'Повар · только печать');
 assert.match(create.data.password,/^[A-Za-z0-9_-]{16}$/);
 const account=persist.get('farukh-print-staff.json')[0];
 assert.equal(account.passhash.length,64);
 assert.equal('password' in account,false);
 assert.equal('password' in (await call('get','/api/farukh-print/admin/staff',own)).data.staff[0],false);
 const duplicate=await call('post','/api/farukh-print/admin/staff',{...own,body:{name:'Другой',login:'gulya01',point:'Плазма'}});
 assert.equal(duplicate.code,409);
 const draft={kind:'prep',id:'p1',name:'Непроверенный',hours:48,storage:'+2…+6 °C',needsReview:true};
 const approved={kind:'prep',id:'p2',name:'Соус спайси',hours:24,storage:'+2…+6 °C',needsReview:false};
 assert.equal((await call('put','/api/farukh-print/admin/catalog',{...own,body:{revision:0,products:[draft,approved]}})).code,200);
 const code=(await call('post','/api/farukh-print/admin/pair',own)).data.code;
 const device=(await call('post','/api/farukh-print/device/pair',{body:{code,name:'Плазма планшет'}})).data.token;
 const wrong=await call('post','/api/farukh-print/device/staff/login',{device,body:{login:'gulya01',password:'not-a-valid-password'}});
 assert.equal(wrong.code,401);
 const login=await call('post','/api/farukh-print/device/staff/login',{device,body:{login:'gulya01',password:create.data.password}});
 assert.equal(login.code,200);
 const staff=login.data.session;assert.equal(staff.length,43);
 const noStaff=await call('post','/api/farukh-print/device/staff/authorize-print',{device,body:{productId:'p2',point:'Плазма',copies:1,printedAt:new Date().toISOString()}});
 assert.equal(noStaff.code,401);
 const wrongPoint=await call('post','/api/farukh-print/device/staff/authorize-print',{device,staff,body:{productId:'p2',point:'Центр',copies:1,printedAt:new Date().toISOString()}});
 assert.equal(wrongPoint.code,403);
 const wrongProduct=await call('post','/api/farukh-print/device/staff/authorize-print',{device,staff,body:{productId:'p1',point:'Плазма',copies:1,printedAt:new Date().toISOString()}});
 assert.equal(wrongProduct.code,403);
 const approvedRequest=await call('post','/api/farukh-print/device/staff/authorize-print',{device,staff,body:{productId:'p2',point:'Плазма',copies:2,printedAt:new Date().toISOString()}});
 assert.equal(approvedRequest.code,200);
 const log=(await call('get','/api/farukh-print/admin/staff/activity',own)).data.events;
 assert.equal(log.length,1);assert.equal(log[0].copies,2);
 assert.match(log[0].status,/не подтверждение физической печати/);
 const disabled=await call('post','/api/farukh-print/admin/staff/:id/status',{...own,params:{id:account.id},body:{active:false}});
 assert.equal(disabled.code,200);
 const denied=await call('post','/api/farukh-print/device/staff/authorize-print',{device,staff,body:{productId:'p2',point:'Плазма',copies:1,printedAt:new Date().toISOString()}});
 assert.equal(denied.code,401);
 const noNewLogin=await call('post','/api/farukh-print/device/staff/login',{device,body:{login:'gulya01',password:create.data.password}});
 assert.equal(noNewLogin.code,401);
});
test('New password ends existing employee session immediately',async()=>{
 const {call}=setup(),own={owner:'ok'};
 const p=(await call('post','/api/farukh-print/admin/staff',{...own,body:{name:'Повар',login:'cook_01',point:'Плазма'}})).data;
 const code=(await call('post','/api/farukh-print/admin/pair',own)).data.code;
 const device=(await call('post','/api/farukh-print/device/pair',{body:{code}})).data.token;
 const oldSession=(await call('post','/api/farukh-print/device/staff/login',{device,body:{login:p.staff.login,password:p.password}})).data.session;
 const reset=await call('post','/api/farukh-print/admin/staff/:id/reset',{...own,params:{id:p.staff.id}});
 assert.equal(reset.code,200);
 assert.notEqual(reset.data.password,p.password);
 assert.equal((await call('get','/api/farukh-print/device/staff/session',{device,staff:oldSession})).code,401);
 assert.equal((await call('post','/api/farukh-print/device/staff/login',{device,body:{login:p.staff.login,password:p.password}})).code,401);
 assert.equal((await call('post','/api/farukh-print/device/staff/login',{device,body:{login:p.staff.login,password:reset.data.password}})).code,200);
});
