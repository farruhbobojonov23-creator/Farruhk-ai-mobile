import test from 'node:test';
import assert from 'node:assert/strict';
import {installPrintStaffApi} from '../print-staff-api.js';

const expectedPoints=['Баумана 18','Плазма','Героев североморцев','Полярные зори'];
function harness(){
 const handlers=new Map(),database=new Map(),app={};
 for(const method of ['get','post','patch','delete'])app[method]=(url,...stack)=>handlers.set(method+' '+url,stack);
 const store={
  read:async(key,defaultValue)=>structuredClone(database.has(key)?database.get(key):defaultValue),
  write:async(key,value)=>database.set(key,structuredClone(value)),
  transaction:async(callback)=>callback()
 };
 const auth={verify:cookie=>cookie==='owner'};
 const protectDevice=(req,res,next)=>{req.farukhPrintDevice={id:'kitchen-device',name:'Планшет кухни'};next()};
 const readCatalog=async()=>({revision:1,products:[{id:'test-roll',name:'Тестовый ролл',kind:'prep',storage:'+2…+6 °C',hours:24,needsReview:false}]});
 installPrintStaffApi(app,{store,auth,enabled:true,protectDevice,readCatalog});
 async function request(method,url,{body={},owner=false,session='',params={},device='x'.repeat(43)}={}){
  const stack=handlers.get(method+' '+url);
  assert.ok(stack,'Missing route '+method+' '+url);
  const req={body,params,ip:'127.0.0.1',headers:{cookie:owner?'fai_owner=owner':''},
   get:k=>({'origin':'https://example.com','host':'example.com','X-Farukh-Print-Device':device,'X-Farukh-Print-Staff':session})[k]||''};
  const res={code:200,data:null,status(n){this.code=n;return this},
   json(v){this.data=v;return this},set(){return this}};
  for(const fn of stack){
   if(res.data!==null||res.code!==200)break;
   if(fn.length>=3){
    let next=false;
    await fn(req,res,()=>{next=true});
    if(!next)break;
   }else await fn(req,res);
  }
  return res;
 }
 return {request,database};
}

test('FARUKH PRINT: four points, per-employee multi-point authorization and revocation',async()=>{
 const {request}=harness();
 const points=await request('get','/api/farukh-print/admin/staff/points',{owner:true});
 assert.equal(points.code,200);
 assert.deepEqual(points.data.points,expectedPoints);
 const creation=await request('post','/api/farukh-print/admin/staff',{
  owner:true,body:{name:'Тестовый повар',login:'testcook',points:['Плазма','Баумана 18'],accessDays:30}
 });
 assert.equal(creation.code,201,JSON.stringify(creation.data));
 assert.deepEqual(creation.data.staff.points,['Плазма','Баумана 18']);
 const id=creation.data.staff.id;
 const login=await request('post','/api/farukh-print/device/staff/login',{
  body:{login:'testcook',password:creation.data.password}
 });
 assert.equal(login.code,200);
 let session=login.data.session;
 const job={productId:'test-roll',copies:1,catalogRevision:1,printedAt:new Date().toISOString()};
 const denied=await request('post','/api/farukh-print/device/staff/authorize-print',{
  session,body:{...job,point:'Полярные зори'}
 });
 assert.equal(denied.code,403,'Employee must not print at an unauthorized point');
 const allowed=await request('post','/api/farukh-print/device/staff/preflight',{
  session,body:{...job,point:'Баумана 18'}
 });
 assert.equal(allowed.code,200,JSON.stringify(allowed.data));
 const granted=await request('post','/api/farukh-print/device/staff/authorize-print',{
  session,body:{...job,point:'Баумана 18',fastTicket:allowed.data.fastTicket}
 });
 assert.equal(granted.code,200,JSON.stringify(granted.data));
 const changed=await request('patch','/api/farukh-print/admin/staff/:id',{
  owner:true,params:{id},body:{name:'Тестовый повар',login:'testcook',points:['Героев североморцев']}
 });
 assert.equal(changed.code,200);
 assert.deepEqual(changed.data.staff.points,['Героев североморцев']);
 assert.equal(changed.data.sessionRevoked,true);
 const revoked=await request('get','/api/farukh-print/device/staff/session',{session});
 assert.equal(revoked.code,401);
 const again=await request('post','/api/farukh-print/device/staff/login',{
  body:{login:'testcook',password:creation.data.password}
 });
 assert.equal(again.code,200);
 session=again.data.session;
 const oldPoint=await request('post','/api/farukh-print/device/staff/authorize-print',{
  session,body:{...job,point:'Баумана 18'}
 });
 assert.equal(oldPoint.code,403);
 const newPoint=await request('post','/api/farukh-print/device/staff/authorize-print',{
  session,body:{...job,point:'Героев североморцев'}
 });
 assert.equal(newPoint.code,200);
});

test('FARUKH PRINT: old single-point users remain compatible, core locations cannot be removed',async()=>{
 const {request,database}=harness();
 database.set('farukh-print-points.json',['Плазма']);
 const pts=await request('get','/api/farukh-print/admin/staff/points',{owner:true});
 assert.deepEqual(pts.data.points,expectedPoints);
 const deleted=await request('delete','/api/farukh-print/admin/staff/points',{owner:true,body:{name:'Плазма'}});
 assert.equal(deleted.code,403);
 const legacy=await request('post','/api/farukh-print/admin/staff',{
  owner:true,body:{name:'Старый повар',login:'legacycook',point:'Плазма',accessDays:null}
 });
 assert.equal(legacy.code,201);
 assert.deepEqual(legacy.data.staff.points,['Плазма']);
});
