import test from 'node:test';
import assert from 'node:assert/strict';
import {installPrintSyncApi} from '../print-sync-api.js';

function makeApi(){
 const routes=new Map(),cloud=new Map();
 const app={};
 for(const method of ['get','post','put','patch','delete'])app[method]=(path,...handlers)=>routes.set(method+' '+path,handlers);
 const store={storage:'yandex',
  read:async(name,fallback)=>cloud.has(name)?structuredClone(cloud.get(name)):structuredClone(fallback),
  write:async(name,value)=>cloud.set(name,structuredClone(value)),
  transaction:async(fn)=>fn()
 };
 const auth={enabled:true,verify:value=>value==='ok'};
 installPrintSyncApi(app,{store,auth});
 async function req(method,path,{body={},token='',cookie='',params={}}={}){
  const route=routes.get(method+' '+path);
  assert.ok(route,'route '+method+' '+path);
  const request={body,ip:'127.0.0.1',params,headers:{cookie},get:function(k){if(k==='X-Farukh-Print-Device')return token;if(k==='origin')return 'https://example.com';if(k==='host')return 'example.com';return ''}};
  const reply={code:200,payload:null,headers:{},
   status(n){this.code=n;return this},
   set(k,v){this.headers[k]=v;return this},
   json(o){this.payload=o;return this},
   sendStatus(n){this.code=n;return this},
  };
  for(const fn of route){
   if(reply.payload!==null||reply.code!==200)break;
   let continued=false;
   if(fn.length>=3){await fn(request,reply,()=>{continued=true});if(!continued)break}
   else await fn(request,reply);
  }
  return reply;
 }
 return {req,cloud};
}

test('FARUKH PRINT cloud sync: owner auth, atomic revisions, device pairing and revoke',async()=>{
 const {req}=makeApi();
 const anonymous=await req('get','/api/farukh-print/admin/catalog');
 assert.equal(anonymous.code,401);
 const owner={cookie:'fai_owner=ok'};
 let catalog=await req('get','/api/farukh-print/admin/catalog',owner);
 assert.equal(catalog.code,200);assert.equal(catalog.payload.revision,0);
 const draft={id:'spicy',kind:'prep',name:'Соус спайси',storage:'+2…+6 °C',hours:48,needsReview:true};
 let published=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{revision:0,products:[draft]}});
 assert.equal(published.code,200);assert.equal(published.payload.revision,1);
 const conflict=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{revision:0,products:[]}});
 assert.equal(conflict.code,409);
 const invalid=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{revision:1,products:[{...draft,hours:null,needsReview:false}]}});
 assert.equal(invalid.code,400);
 const invitation=await req('post','/api/farukh-print/admin/pair',{...owner,body:{}});
 assert.equal(invitation.code,200);assert.equal(invitation.payload.code.length,12);
 const joined=await req('post','/api/farukh-print/device/pair',{body:{code:invitation.payload.code,name:'Планшет Плазма'}});
 assert.equal(joined.code,200);assert.equal(joined.payload.device.name,'Планшет Плазма');
 const secret=joined.payload.token;assert.equal(secret.length,43);
 const anotherJoin=await req('post','/api/farukh-print/device/pair',{body:{code:invitation.payload.code,name:'Second'}});
 assert.equal(anotherJoin.code,401); // single use
 const downloaded=await req('get','/api/farukh-print/device/catalog',{token:secret});
 assert.equal(downloaded.code,200);assert.equal(downloaded.payload.products.length,1);
 assert.equal(downloaded.payload.products[0].needsReview,true);
 const row=(await req('get','/api/farukh-print/admin/devices',owner)).payload.devices[0];
 assert.equal('hash' in row,false);assert.equal('token' in row,false);
 const revoked=await req('delete','/api/farukh-print/admin/devices/:id',{...owner,params:{id:row.id}});
 assert.equal(revoked.code,200);
 const denied=await req('get','/api/farukh-print/device/catalog',{token:secret});
 assert.equal(denied.code,403);
});

test('FARUKH PRINT cloud disabled without durable storage or owner auth',async()=>{
 const routes=new Map();
 const app={get:(name,...handlers)=>routes.set(name,handlers),post(){},put(){},patch(){},delete(){}};
 installPrintSyncApi(app,{store:{storage:'disk'},auth:{enabled:false}});
 const res={payload:null,json(o){this.payload=o;return this}};
 routes.get('/api/farukh-print/sync/status')[0]({},res);
 assert.equal(res.payload.enabled,false);
});
