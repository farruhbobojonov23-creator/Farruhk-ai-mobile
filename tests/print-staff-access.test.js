import test from 'node:test';
import assert from 'node:assert/strict';
import {installPrintSyncApi} from '../print-sync-api.js';

function setup(){
 const routes=new Map(),persist=new Map();
 const app={};
 for(const method of ['get','post','put','patch','delete'])app[method]=(path,...handlers)=>routes.set(method+' '+path,handlers);
 const store={
  storage:'yandex',
  read:async(name,fallback)=>persist.has(name)?structuredClone(persist.get(name)):structuredClone(fallback),
  write:async(name,data)=>{persist.set(name,structuredClone(data))},
  transaction:async fn=>fn(),
 };
 installPrintSyncApi(app,{store,auth:{enabled:true,verify:t=>t==='ok'}});
 const call=async(method,path,{body={},owner='',device='',staff='',params={},query={},ip='127.0.0.1'}={})=>{
  const stack=routes.get(method+' '+path);
  assert.ok(stack,'Missing '+method+' '+path);
  const req={body,params,query,ip,method:method.toUpperCase(),headers:{cookie:owner?'fai_owner='+owner:''},get(key){
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
 const noStaff=await call('post','/api/farukh-print/device/staff/authorize-print',{device,body:{productId:'p2',point:'Плазма',copies:1,printedAt:new Date().toISOString(),catalogRevision:1}});
 assert.equal(noStaff.code,401);
 const wrongPoint=await call('post','/api/farukh-print/device/staff/authorize-print',{device,staff,body:{productId:'p2',point:'Центр',copies:1,printedAt:new Date().toISOString(),catalogRevision:1}});
 assert.equal(wrongPoint.code,403);
 const wrongProduct=await call('post','/api/farukh-print/device/staff/authorize-print',{device,staff,body:{productId:'p1',point:'Плазма',copies:1,printedAt:new Date().toISOString(),catalogRevision:1}});
 assert.equal(wrongProduct.code,403);
 const approvedRequest=await call('post','/api/farukh-print/device/staff/authorize-print',{device,staff,body:{productId:'p2',point:'Плазма',copies:2,printedAt:new Date().toISOString(),catalogRevision:1}});
 assert.equal(approvedRequest.code,200);
 const log=(await call('get','/api/farukh-print/admin/staff/activity',own)).data.events;
 assert.equal(log.length,1);assert.equal(log[0].copies,2);
 assert.match(log[0].status,/не подтверждение физической печати/);
 const changed=await call('put','/api/farukh-print/admin/catalog',{
  ...own,body:{revision:1,products:[draft,{...approved,hours:12}]}
 });
 assert.equal(changed.code,200);
 const stale=await call('post','/api/farukh-print/device/staff/authorize-print',{
  device,staff,body:{productId:'p2',point:'Плазма',copies:1,printedAt:new Date().toISOString(),catalogRevision:1}
 });
 assert.equal(stale.code,409);
 const current=await call('post','/api/farukh-print/device/staff/authorize-print',{
  device,staff,body:{productId:'p2',point:'Плазма',copies:1,printedAt:new Date().toISOString(),catalogRevision:2}
 });
 assert.equal(current.code,200);
 const disabled=await call('post','/api/farukh-print/admin/staff/:id/status',{...own,params:{id:account.id},body:{active:false}});
 assert.equal(disabled.code,200);
 const denied=await call('post','/api/farukh-print/device/staff/authorize-print',{device,staff,body:{productId:'p2',point:'Плазма',copies:1,printedAt:new Date().toISOString(),catalogRevision:1}});
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

test('Owner can configure four points and switch employee location without losing account',async()=>{
 const {call}=setup(),own={owner:'ok'};
 assert.deepEqual((await call('get','/api/farukh-print/admin/staff/points',own)).data.points,['Плазма']);
 for(const name of ['Пункт 2','Пункт 3','Пункт 4']){
  const res=await call('post','/api/farukh-print/admin/staff/points',{...own,body:{name}});
  assert.equal(res.code,201);
 }
 assert.equal((await call('get','/api/farukh-print/admin/staff/points',own)).data.points.length,4);
 assert.equal((await call('post','/api/farukh-print/admin/staff/points',{...own,body:{name:'пЛаЗмА'}})).code,409);
 const worker=(await call('post','/api/farukh-print/admin/staff',{...own,body:{name:'Повар один',login:'cook_one',point:'Плазма'}})).data.staff;
 const renamed=await call('patch','/api/farukh-print/admin/staff/:id',{...own,params:{id:worker.id},body:{name:'Повар первый',login:'cook_one',point:'Пункт 2'}});
 assert.equal(renamed.code,200);assert.equal(renamed.data.staff.point,'Пункт 2');
 const repeat=await call('post','/api/farukh-print/admin/staff',{...own,body:{name:'Повар два',login:'cook_two',point:'Пункт 4'}});
 assert.equal(repeat.code,201);
 const conflict=await call('patch','/api/farukh-print/admin/staff/:id',{...own,params:{id:worker.id},body:{name:'Повар один',login:'cook_two',point:'Плазма'}});
 assert.equal(conflict.code,409);
 const deletedActive=await call('delete','/api/farukh-print/admin/staff/points',{...own,body:{name:'Пункт 2'}});
 assert.equal(deletedActive.code,409);
 const pointRename=await call('patch','/api/farukh-print/admin/staff/points',{...own,body:{oldName:'Пункт 2',name:'Пункт второй'}});
 assert.equal(pointRename.code,200);
 const staff=(await call('get','/api/farukh-print/admin/staff',own)).data.staff;
 assert.equal(staff.find(x=>x.id===worker.id).point,'Пункт второй');
 const all=(await call('get','/api/farukh-print/admin/staff/points',own)).data.points;
 assert.ok(all.includes('Пункт второй')&&!all.includes('Пункт 2'));
 assert.equal((await call('delete','/api/farukh-print/admin/staff/points',{...own,body:{name:'Пункт 3'}})).code,200);
 assert.equal((await call('patch','/api/farukh-print/admin/staff/points',{body:{oldName:'Плазма',name:'Иное'}})).code,401);
});

test('Owner sees honest counts of print REQUESTS by each point and period',async()=>{
 const {call}=setup(),own={owner:'ok'};
 await call('post','/api/farukh-print/admin/staff/points',{...own,body:{name:'Пункт 2'}});
 const first=(await call('post','/api/farukh-print/admin/staff',{...own,body:{name:'Повар первый',login:'cook_01',point:'Плазма'}})).data;
 await call('post','/api/farukh-print/admin/staff',{...own,body:{name:'Повар второй',login:'cook_02',point:'Пункт 2'}});
 const item={id:'roll-1',kind:'prep',name:'Соус',storage:'+2…+6 °C',hours:12,needsReview:false};
 assert.equal((await call('put','/api/farukh-print/admin/catalog',{...own,body:{revision:0,products:[item]}})).code,200);
 const invite=(await call('post','/api/farukh-print/admin/pair',own)).data.code;
 const paired=(await call('post','/api/farukh-print/device/pair',{body:{code:invite}})).data.token;
 const staff=(await call('post','/api/farukh-print/device/staff/login',{device:paired,body:{login:first.staff.login,password:first.password}})).data.session;
 const sent=await call('post','/api/farukh-print/device/staff/authorize-print',{device:paired,staff,body:{productId:'roll-1',point:'Плазма',copies:3,printedAt:new Date().toISOString(),catalogRevision:1}});
 assert.equal(sent.code,200);
 const report=(await call('get','/api/farukh-print/admin/staff/report',{...own,query:{days:'30'}})).data;
 assert.equal(report.summary.points,2);assert.equal(report.summary.staff,2);
 assert.equal(report.summary.requests,1);assert.equal(report.summary.labels,3);
 assert.equal(report.rows.find(r=>r.point==='Плазма').requests,1);
 assert.equal(report.rows.find(r=>r.point==='Пункт 2').requests,0);
 assert.match(report.note,/не доказательство фактической печати/);
 const filtered=(await call('get','/api/farukh-print/admin/staff/report',{...own,query:{days:'7',point:'Пункт 2'}})).data;
 assert.equal(filtered.summary.requests,0);assert.equal(filtered.rows.length,1);
 assert.equal((await call('get','/api/farukh-print/admin/staff/report',{...own,query:{days:'3'}})).code,400);
 assert.equal((await call('get','/api/farukh-print/admin/staff/report',{query:{days:'30'}})).code,401);
});
