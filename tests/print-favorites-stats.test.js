import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {installPrintSyncApi} from '../print-sync-api.js';

function setup(){
 const routes=new Map(),disk=new Map(),app={};
 for(const method of ['get','post','put','patch','delete'])app[method]=(path,...fns)=>routes.set(method+' '+path,fns);
 const store={storage:'yandex',read:async(k,fallback)=>structuredClone(disk.has(k)?disk.get(k):fallback),
  write:async(k,data)=>{disk.set(k,structuredClone(data))},transaction:async fn=>fn()};
 installPrintSyncApi(app,{store,auth:{enabled:true,verify:v=>v==='yes'}});
 const call=async(method,path,{body={},params={},query={},owner=false,device='',staff=''}={})=>{
  const stack=routes.get(method+' '+path);assert.ok(stack,'missing route '+method+' '+path);
  const req={body,params,query,ip:'127.0.0.2',method:method.toUpperCase(),
   headers:{cookie:owner?'fai_owner=yes':''},get(k){return {'origin':'https://site.example','host':'site.example','X-Farukh-Print-Device':device,'X-Farukh-Print-Staff':staff}[k]||''}};
  const res={code:200,body:null,status(c){this.code=c;return this},set(){return this},json(o){this.body=o;return this}};
  for(const fn of stack){let forward=false;if(fn.length>=3){await fn(req,res,()=>forward=true);if(!forward)break}else{await fn(req,res);break}}
  return res
 };
 return {call,disk};
}
async function worker(h){
 const created=(await h.call('post','/api/farukh-print/admin/staff',{owner:true,body:{name:'Работник тест',login:'testworker',point:'Плазма'}})).body;
 const pin=(await h.call('post','/api/farukh-print/admin/pair',{owner:true})).body.code;
 const device=(await h.call('post','/api/farukh-print/device/pair',{body:{code:pin,name:'Тестовая точка'}})).body.token;
 const login=await h.call('post','/api/farukh-print/device/staff/login',{device,body:{login:'testworker',password:created.password}});
 assert.equal(login.code,200);
 return {device,staff:login.body.session,created};
}
test('remembered staff sessions survive new API instances with shared durable store and end on logout',async()=>{
 const h=setup(),w=await worker(h);
 assert.equal(Object.hasOwn((await h.call('get','/api/farukh-print/device/staff/session',{device:w.device,staff:w.staff})).body,'staff'),true);
 assert.equal(h.disk.get('farukh-print-staff-sessions.json').length,1);
 assert.equal((await h.call('post','/api/farukh-print/device/staff/logout',{device:w.device,staff:w.staff})).code,200);
 assert.equal((await h.call('get','/api/farukh-print/device/staff/session',{device:w.device,staff:w.staff})).code,401);
});
test('owner history, employee shift stats, print outcome and alert endpoints are permission checked',async()=>{
 const h=setup(),w=await worker(h);
 const item={id:'p1',kind:'prep',name:'Соус',storage:'+2…+6',hours:12,needsReview:false};
 const published=await h.call('put','/api/farukh-print/admin/catalog',{owner:true,body:{revision:0,products:[item]}});
 assert.equal(published.code,200);
 const request=await h.call('post','/api/farukh-print/device/staff/authorize-print',{device:w.device,staff:w.staff,
  body:{productId:'p1',point:'Плазма',copies:3,printedAt:new Date().toISOString(),catalogRevision:1}});
 assert.equal(request.code,200);
 const eventId=request.body.eventId;
 const result=await h.call('post','/api/farukh-print/device/staff/print-result',{device:w.device,staff:w.staff,body:{eventId,result:'failed',details:'Bluetooth не отвечает'}});
 assert.equal(result.code,200);
 const repeat=await h.call('post','/api/farukh-print/device/staff/print-result',{device:w.device,staff:w.staff,body:{eventId,result:'sent'}});
 assert.equal(repeat.body.result,'failed');
 const history=await h.call('get','/api/farukh-print/admin/staff/activity',{owner:true,query:{point:'Плазма',login:'testworker',result:'failed',limit:25}});
 assert.equal(history.body.total,1);
 assert.equal(history.body.events[0].details,'Bluetooth не отвечает');
 const alerts=await h.call('get','/api/farukh-print/admin/staff/alerts',{owner:true});
 assert.equal(alerts.body.alerts[0].type,'print_error');
 const report=await h.call('get','/api/farukh-print/admin/staff/report',{owner:true,query:{days:'shift'}});
 assert.equal(report.body.summary.requests,1);
 assert.equal(report.body.rows[0].users[0].labels,3);
 assert.equal(report.body.rows[0].users[0].failed,1);
 assert.equal((await h.call('get','/api/farukh-print/admin/staff/activity')).code,401);
 assert.equal((await h.call('get','/api/farukh-print/admin/staff/alerts')).code,401);
});
test('worker UI offers favorites and repeat; owner UI filters reports by date and shows alerts',async()=>{
 const read=async p=>fs.readFile(new URL('../'+p,import.meta.url),'utf8');
 const [html,code,control,client,css]=await Promise.all([
  read('public/farukh-print/index.html'),read('public/farukh-print/print.js'),
  read('public/print-control-staff.js'),read('public/farukh-print/print-staff.js'),
  read('public/farukh-print/print.css')]);
 for(const part of ['worker-fav-filter','worker-repeat','worker-repeat-hint'])assert.match(html,new RegExp('id="'+part+'"'));
 assert.match(code,/function toggleFav\(/);
 assert.match(code,/function repeatLast\(/);
 assert.match(code,/activePrintEvent/);
 assert.match(client,/localStorage\.setItem\(SESSION/);
 assert.match(control,/Статистика сотрудников/);
 assert.match(control,/Уведомления владельцу/);
 assert.match(control,/pstaff-history-filters/);
 assert.match(css,/product-favorite/);
});
