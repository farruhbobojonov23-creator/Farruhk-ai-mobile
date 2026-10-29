import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {installPrintSyncApi} from '../print-sync-api.js';
import fs from 'node:fs';

function makeApi(readyCatalogImport,catalogPhotoImport,haccpCatalogImport,prepCatalogImport=null){
 const routes=new Map(),cloud=new Map();
 const app={};
 for(const method of ['get','post','put','patch','delete'])app[method]=(path,...handlers)=>routes.set(method+' '+path,handlers);
 const store={storage:'yandex',
  read:async(name,fallback)=>cloud.has(name)?structuredClone(cloud.get(name)):structuredClone(fallback),
  write:async(name,value)=>cloud.set(name,structuredClone(value)),
  transaction:async(fn)=>fn()
 };
 const auth={enabled:true,verify:value=>value==='ok'};
 installPrintSyncApi(app,{store,auth,readyCatalogImport,catalogPhotoImport,haccpCatalogImport,prepCatalogImport});
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

test('Missing photos fill all 76 cards, preserve owner photos and survive publication',async()=>{
 const ready=await import('../public/farukh-print/ready-catalog.js');
 const photo=await import('../public/farukh-print/catalog-photos.js');
 const haccp=await import('../public/farukh-print/haccp-catalog.js');
 const seed=JSON.parse(fs.readFileSync(new URL('../print-recovery-catalog.json',import.meta.url),'utf8'));
 const products=haccp.merge(photo.merge(ready.merge(seed)));
 const before=new Map(products.filter(p=>p.photo).map(p=>[p.id,p.photo]));
 const {req,cloud}=makeApi(ready,photo,haccp);
 cloud.set('farukh-print-catalog.json',{revision:12,products,appliedImports:[ready.version,photo.version,haccp.version]});
 const owner={cookie:'fai_owner=ok'};
 const filled=await req('get','/api/farukh-print/admin/catalog',owner);
 assert.equal(filled.code,200);assert.equal(filled.payload.revision,13);
 assert.equal(filled.payload.products.length,76);
 assert.ok(filled.payload.products.every(p=>p.photo?.startsWith('data:image/jpeg;base64,')));
 for(const p of filled.payload.products)if(before.has(p.id)&&p.name!=='Бульон Том Ям')assert.equal(p.photo,before.get(p.id));
 const broth=filled.payload.products.find(p=>p.name==='Бульон Том Ям');
 assert.notEqual(broth.photo,before.get(broth.id));
 assert.equal(broth.photo,(await import('../public/farukh-print/broth-photo.js')).photo);
 assert.ok(Buffer.byteLength(JSON.stringify({revision:13,products:filled.payload.products}))<1024*1024);
 const again=await req('get','/api/farukh-print/admin/catalog',owner);assert.equal(again.payload.revision,13);
 const custom=filled.payload.products.map(p=>p.template==='soap'?{...p,photo:'data:image/jpeg;base64,AAAA'}:p);
 const saved=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{revision:13,products:custom}});
 assert.equal(saved.code,200);assert.equal(saved.payload.products.find(p=>p.template==='soap').photo,'data:image/jpeg;base64,AAAA');
});

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

test('photo thumbnails survive owner cloud publishing and device catalog pull',async()=>{
 const {req}=makeApi(),owner={cookie:'fai_owner=ok'};
 const photo='data:image/jpeg;base64,'+Buffer.alloc(25000,49).toString('base64');
 const record={id:'sauce-1',kind:'prep',name:'Соус спайси',needsReview:true,storage:'',hours:null,photo,photoStyle:'manual'};
 const published=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{revision:0,products:[record]}});
 assert.equal(published.code,200);
 assert.equal(published.payload.products[0].photo,photo);
 assert.equal(published.payload.products[0].photoStyle,'manual');
 const fromCloud=await req('get','/api/farukh-print/admin/catalog',owner);
 assert.equal(fromCloud.payload.products[0].photo,photo);
 assert.equal(fromCloud.payload.products[0].photoStyle,'manual');
 const badStyle=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{revision:1,products:[{...record,photoStyle:'javascript:alert(1)'}]}});
 assert.equal(badStyle.code,400);
 const tooLarge='data:image/jpeg;base64,'+'A'.repeat(47000);
 const invalid=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{revision:1,products:[{...record,photo:tooLarge}]}});
 assert.equal(invalid.code,400);
 const unsafe=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{revision:1,products:[{...record,photo:'https://example.com/tracker'}]}});
 assert.equal(unsafe.code,400);
});
test('FARUKH PRINT variant 3 is three-column and supports owner-managed photo picker',async()=>{
 const fs=await import('node:fs/promises');
 const css=await fs.readFile(new URL('../public/farukh-print/print.css',import.meta.url),'utf8');
 const js=await fs.readFile(new URL('../public/farukh-print/print.js',import.meta.url),'utf8');
 const owner=await fs.readFile(new URL('../public/print-control.js',import.meta.url),'utf8');
 const html=await fs.readFile(new URL('../public/farukh-print/index.html',import.meta.url),'utf8');
 assert.match(css,/\.product-list\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(js,/product-visual/);
 assert.match(html,/id="edit-photo-file"/);
 assert.match(owner,/Фотография|Фото для каталога|Фото/);
 assert.match(js,/function drawPrep\(/);
});


test('ready TTK import preserves existing labels, bumps revision once and respects later deletions',async()=>{
 const catalog=await import('../public/farukh-print/ready-catalog.js');
 assert.equal(catalog.products.length,48);
 const {req,cloud}=makeApi(catalog);
 const custom={...catalog.products[0],weight:999,photo:'data:image/jpeg;base64,AAAA'};
 cloud.set('farukh-print-catalog.json',{revision:7,products:[custom]});
 const owner={cookie:'fai_owner=ok'};
 const first=await req('get','/api/farukh-print/admin/catalog',owner);
 assert.equal(first.code,200);assert.equal(first.payload.revision,8);
 assert.equal(first.payload.products.length,48);
 assert.equal(first.payload.products[0].weight,999);
 assert.equal(first.payload.products[0].photo,custom.photo);
 const next=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{revision:8,products:[]}});
 assert.equal(next.code,200);
 assert.deepEqual(next.payload.appliedImports,[catalog.version,'missing-card-photos-2026-10-24-v1','tom-yum-broth-photo-2026-10-24-v1']);
 const reread=await req('get','/api/farukh-print/admin/catalog',owner);
 assert.deepEqual(reread.payload.products,[]);
 assert.equal(reread.payload.revision,9);
});

test('ready TTK import is additive, idempotent and excludes disputed cards',async()=>{
 const {products,merge}=await import('../public/farukh-print/ready-catalog.js');
 const prep={id:'my-prep',kind:'prep',name:'Капуста',hours:12};
 const edited={...products[0],id:'owner-id',name:products[0].name.toUpperCase(),weight:321};
 const list=merge([prep,edited]);
 assert.equal(list.length,49);assert.deepEqual(list.slice(0,2),[prep,edited]);
 assert.deepEqual(merge(list),list);
 for(const p of products){
  assert.equal(p.kind,'ready');assert.ok(p.composition);assert.ok(p.weight>0);
  for(const key of ['p','f','c','kcal'])assert.ok(Number.isFinite(p[key]));
  assert.equal(p.hours,12);assert.equal(p.storage,'+2…+6 °C');
  if(p.name==='Запеченный краб Том Ям')assert.equal(p.weight,280);
 }
});


test('v2 imports only the newly approved crab roll on previously imported devices',async()=>{
 const catalog=await import('../public/farukh-print/ready-catalog.js');
 const upgraded=catalog.merge([],true);
 assert.equal(upgraded.length,1);
 assert.equal(upgraded[0].name,'Запеченный краб Том Ям');
 assert.equal(upgraded[0].weight,280);
 assert.deepEqual(catalog.merge(upgraded,true),upgraded);
 const {req,cloud}=makeApi(catalog);
 cloud.set('farukh-print-catalog.json',{revision:10,products:[],appliedImports:[catalog.previousVersion]});
 const result=await req('get','/api/farukh-print/admin/catalog',{cookie:'fai_owner=ok'});
 assert.equal(result.code,200);assert.equal(result.payload.products.length,1);
 assert.equal(result.payload.revision,11);
 assert.deepEqual(result.payload.appliedImports,[catalog.previousVersion,catalog.version,'missing-card-photos-2026-10-24-v1','tom-yum-broth-photo-2026-10-24-v1']);
});


test('website photos cover all 48 labels, preserve owner photos and deleted labels',async()=>{
 const ready=await import('../public/farukh-print/ready-catalog.js');
 const photos=await import('../public/farukh-print/catalog-photos.js');
 assert.equal(photos.photos.length,48);
 const withPhotos=photos.merge(ready.products);
 assert.equal(withPhotos.length,48);
 for(const p of withPhotos){
  assert.match(p.photo,/^data:image\/jpeg;base64,/);
  assert.ok(p.photo.length<=45000);
 }
 assert.ok(JSON.stringify(withPhotos).length<1024*1024);
 assert.deepEqual(photos.merge([]),[]);
 const owner={...ready.products[0],photo:'data:image/jpeg;base64,AAAA',weight:999};
 assert.deepEqual(photos.merge([owner]),[owner]);
 const renamedId={...ready.products[1],id:'local-owner-id'};
 assert.ok(photos.merge([renamedId])[0].photo);
 const {req,cloud}=makeApi(ready,photos);
 cloud.set('farukh-print-catalog.json',{revision:9,products:[owner,ready.products[1]],appliedImports:[ready.previousVersion,ready.version]});
 const first=await req('get','/api/farukh-print/admin/catalog',{cookie:'fai_owner=ok'});
 assert.equal(first.code,200);assert.equal(first.payload.revision,10);
 assert.equal(first.payload.products.length,2);
 assert.equal(first.payload.products[0].photo,owner.photo);
 assert.equal(first.payload.products[0].weight,999);
 assert.ok(first.payload.products[1].photo.length>100);
 assert.ok(first.payload.appliedImports.includes(photos.version));
 const second=await req('get','/api/farukh-print/admin/catalog',{cookie:'fai_owner=ok'});
 assert.equal(second.payload.revision,10);
});

test('ready categories classify 48 rolls and preserve custom assignments through cloud sync',async()=>{
 await import('../public/farukh-print/categories.js');
 const api=globalThis.FarukhPrintCategories;
 const {products}=await import('../public/farukh-print/ready-catalog.js');
 const counts=products.reduce((out,p)=>{const name=api.category(p);out[name]=(out[name]||0)+1;return out},{});
 assert.deepEqual(counts,{'Запечённые роллы':17,'Холодные роллы':23,'Темпура':4,'Маки':4});
 assert.equal(api.list(products).length,19);
 assert.equal(api.category({...products[0],category:'Новинки'}),'Новинки');
 const {req}=makeApi();
 const owner={cookie:'fai_owner=ok'};
 const result=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{revision:0,products:[{...products[0],category:'Новинки'}]}});
 assert.equal(result.code,200);assert.equal(result.payload.products[0].category,'Новинки');
 const bad=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{revision:1,products:[{...products[0],category:'x'.repeat(61)}]}});
 assert.equal(bad.code,400);
});


test('HACCP migration survives cloud validation without food fields and runs once',async()=>{
 const h=await import('../public/farukh-print/haccp-catalog.js');
 const {req}=makeApi(null,null,h),owner={cookie:'fai_owner=ok'};
 const a=await req('get','/api/farukh-print/admin/catalog',owner);
 assert.equal(a.code,200);assert.equal(a.payload.products.length,9);
 assert.ok(a.payload.products.every(p=>p.category==='ХАССП'&&!('weight' in p)));
 const b=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{revision:a.payload.revision,products:a.payload.products}});
 assert.equal(b.code,200);assert.equal(b.payload.products.length,9);
 const c=await req('get','/api/farukh-print/admin/catalog',owner);
 assert.equal(c.payload.revision,b.payload.revision);
 const invalid=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{revision:c.payload.revision,products:[{kind:'ready',name:'Bad',template:'unknown'}]}});
 assert.equal(invalid.code,400);
});


test('Catalog migration outage cannot turn a valid device into a login failure',async()=>{
 const broken={version:'broken-import',merge(){throw Error('Cloud catalog update failed')}};
 const {req,cloud}=makeApi(null,null,broken);
 const token='x'.repeat(43);
 cloud.set('farukh-print-devices.json',[{id:'paired',hash:crypto.createHash('sha256').update(token).digest('hex'),name:'Kitchen',revoked:false}]);
 const session=await req('get','/api/farukh-print/device/staff/session',{token});
 assert.equal(session.code,401); // device passed; no employee session supplied
 assert.notEqual(session.payload.error,'Не удалось подтвердить устройство.');
 const catalog=await req('get','/api/farukh-print/device/catalog',{token});
 assert.equal(catalog.code,503); // catalog remains fail closed, without denying login
 assert.equal(cloud.get('farukh-print-devices.json').length,1);
});


test('End-to-end catalog: owner changes reach two paired devices with prep date events, styles, and photos intact',async()=>{
 const {req}=makeApi(),owner={cookie:'fai_owner=ok'};
 const jpeg='data:image/jpeg;base64,AAAA';
 const ready={id:'roll-new',kind:'ready',name:'Ролл Премиум',category:'Новинки',composition:'рис, нори, форель',p:6.4,f:8.1,c:20,kcal:182,weight:230,tolerance:10,
   storage:'+2…+6 °C',hours:12,needsReview:false,photo:jpeg,labelStyle:'premium-ready-58x40'};
 const prep={id:'fish-new',kind:'prep',name:'Форель',storage:'0…+2 °C',hours:24,needsReview:false,prepEvent:'thawed',
   labelStyle:'premium-prep-30x20',photo:jpeg};
 const first=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{revision:0,products:[ready,prep]}});
 assert.equal(first.code,200,JSON.stringify(first.payload));
 assert.equal(first.payload.revision,1);
 assert.equal(first.payload.products[0].labelStyle,'premium-ready-58x40');
 assert.equal(first.payload.products[1].labelStyle,'premium-prep-30x20');
 assert.equal(first.payload.products[1].prepEvent,'thawed');
 const tokens=[];
 for(const name of ['Плазма — планшет','Точка 2 — телефон']){
   const invite=await req('post','/api/farukh-print/admin/pair',{...owner,body:{}});
   assert.equal(invite.code,200);
   const paired=await req('post','/api/farukh-print/device/pair',{body:{code:invite.payload.code,name}});
   assert.equal(paired.code,200);tokens.push(paired.payload.token);
 }
 for(const token of tokens){
   const r=await req('get','/api/farukh-print/device/catalog',{token});
   assert.equal(r.code,200);assert.equal(r.payload.revision,1);
   assert.deepEqual(r.payload.products,first.payload.products);
 }
 const changed=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{
   revision:1,products:[{...ready,weight:245,photo:'data:image/jpeg;base64,AQID'}, {...prep,hours:16,prepEvent:'opened',needsReview:true}]
 }});
 assert.equal(changed.code,200);assert.equal(changed.payload.revision,2);
 for(const token of tokens){
   const r=await req('get','/api/farukh-print/device/catalog',{token});
   assert.equal(r.code,200);
   assert.equal(r.payload.revision,2);
   assert.equal(r.payload.products.find(p=>p.id==='roll-new').weight,245);
   assert.equal(r.payload.products.find(p=>p.id==='roll-new').photo,'data:image/jpeg;base64,AQID');
   const fish=r.payload.products.find(p=>p.id==='fish-new');
   assert.equal(fish.hours,16);assert.equal(fish.prepEvent,'opened');assert.equal(fish.needsReview,true);
   assert.equal(fish.labelStyle,'premium-prep-30x20');
 }
 const stale=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{revision:1,products:[ready,prep]}});
 assert.equal(stale.code,409);
 const current=await req('get','/api/farukh-print/admin/catalog',owner);
 assert.equal(current.payload.revision,2);
});

test('Cloud rejects invalid type/style/event combinations instead of erasing template choices',async()=>{
 const {req}=makeApi(),owner={cookie:'fai_owner=ok'};
 const prep={id:'1',kind:'prep',name:'Морковь',hours:24,storage:'+2…+6 °C',needsReview:true};
 for(const record of [
  {...prep,prepEvent:'nonsense'},
  {...prep,labelStyle:'premium-ready-58x40'},
  {...prep,prepEvent:'<svg onload=evil()>'},
  {...prep,kind:'ready',prepEvent:'thawed'},
  {...prep,labelStyle:'unknown'}
 ]){
  const result=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{revision:0,products:[record]}});
  assert.equal(result.code,400,JSON.stringify(result.payload));
 }
});

test('Owner confirmed sync survives reloads; connected devices repair mismatched local revisions',async()=>{
 const fs=await import('node:fs/promises');
 const cloud=await fs.readFile(new URL('../public/print-control-cloud.js',import.meta.url),'utf8');
 const client=await fs.readFile(new URL('../public/farukh-print/print-sync.js',import.meta.url),'utf8');
 assert.match(cloud,/farukh-print:owner-cloud-agreed:v1/);
 assert.match(cloud,/const continued=accepted\?\.revision===rev/);
 assert.match(cloud,/remember\(rev,local,remoteProducts\)/);
 assert.match(cloud,/remember\(rev,remoteProducts,remoteProducts\)/);
 assert.match(client,/state\.revision!==cloudRev\|\|!localMatches/);
 assert.match(client,/JSON\.stringify\(current\)===JSON\.stringify\(state\.products\)/);
 assert.match(client,/sync\(cloudRev<0\)/);
});


test('2026 sushi prep drafts have 36 unique editable 30x20 stickers; proposed 12h is never approved SanPiN',async()=>{
 const {definitions,merge,proposedHours,version}=await import('../public/farukh-print/japanese-prep-catalog.js');
 assert.equal(definitions.length,36);
 assert.equal(new Set(definitions.map(d=>d.name.toLowerCase())).size,36);
 assert.ok(version.startsWith('japanese-prep-drafts-'));
 assert.equal(proposedHours,12);
 const initial=merge([]);
 assert.equal(initial.length,36);
 assert.ok(initial.every(p=>p.kind==='prep'&&p.hours===12&&p.storage==='+2…+6 °C'&&p.labelStyle==='premium-prep-30x20'&&p.needsReview===true));
 assert.ok(initial.every(p=>typeof p.recipeMemo==='string'&&p.recipeMemo.includes('НЕ срок, установленный СанПиН')));
 assert.equal(merge(initial).length,initial.length);
 const trout=initial.find(p=>p.name==='Форель');
 const tamago=initial.find(p=>p.name==='Омлет');
 const opened=initial.find(p=>p.name==='Такуан');
 assert.equal(trout.prepEvent,'thawed');
 assert.equal(tamago.prepEvent,'prepared');
 assert.equal(opened.prepEvent,'opened');
});
test('Prep import does not alter approved shelf life, owner photo, or disputed existing 48h spicy draft',async()=>{
 const catalog=await import('../public/farukh-print/japanese-prep-catalog.js');
 const approved={id:'owner-fish',kind:'prep',name:'Форель',storage:'+0…+2 °C',hours:6,needsReview:false,prepEvent:'thawed',photo:'data:image/jpeg;base64,AAAA'};
 const spicy={id:'owner-spicy',kind:'prep',name:'Соус спайси',storage:'+2…+6 °C',hours:48,needsReview:true,recipeMemo:'Рецептура владельца'};
 const needsFill={id:'owner-veg',kind:'prep',name:'Огурцы (нарезка)',storage:'',hours:null,needsReview:true};
 const out=catalog.merge([approved,spicy,needsFill]);
 assert.strictEqual(out[0],approved);
 assert.equal(out[1].hours,48);
 assert.equal(out[1].recipeMemo,'Рецептура владельца');
 assert.equal(out[2].name,'Огурцы (нарезка)');
 assert.equal(out[2].hours,12);
 assert.equal(out[2].needsReview,true);
 assert.equal(out.filter(x=>x.name==='Огурцы').length,0);
 assert.equal(out.filter(x=>x.name==='Форель').length,1);
 assert.deepEqual(catalog.merge(out),out);
});
test('Cloud publishes 36 proposals once, leaves deleted entries deleted, and rejects printing unapproved drafts',async()=>{
 const importPrep=await import('../public/farukh-print/japanese-prep-catalog.js');
 const {req,cloud}=makeApi(null,null,null,importPrep),owner={cookie:'fai_owner=ok'};
 const first=await req('get','/api/farukh-print/admin/catalog',owner);
 assert.equal(first.code,200);
 assert.equal(first.payload.revision,1);
 assert.equal(first.payload.products.length,36);
 assert.equal(first.payload.products.find(p=>p.name==='Форель').prepEvent,'thawed');
 assert.equal(first.payload.products.find(p=>p.name==='Соус спайси').needsReview,true);
 assert.ok(first.payload.appliedImports.includes(importPrep.version));
 const next=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{revision:first.payload.revision,products:first.payload.products.filter(p=>p.name!=='Грибы (нарезка)')}});
 assert.equal(next.code,200);
 const again=await req('get','/api/farukh-print/admin/catalog',owner);
 assert.equal(again.payload.revision,next.payload.revision);
 assert.equal(again.payload.products.length,35);
 assert.equal(again.payload.products.some(p=>p.name==='Грибы (нарезка)'),false);
 const pending=again.payload.products.find(p=>p.name==='Форель');
 assert.equal(pending.needsReview,true);
 // Print authorization separately checks needsReview, so display-only drafts
 // cannot be mistaken for approved thermal labels on any paired device.
 const staffApi=await import('node:fs/promises');
 const source=await staffApi.readFile(new URL('../print-staff-api.js',import.meta.url),'utf8');
 assert.match(source,/product\.needsReview===true/);
});


test('Universal label units and semifinished categories survive owner cloud validation',async()=>{
 const {products}=await import('../public/farukh-print/ready-catalog.js');
 const {req}=makeApi();
 const owner={cookie:'fai_owner=ok'};
 const item={...products[0],category:'Лимонады',name:'Лимонад клубника',weight:0.5,tolerance:0.05,weightUnit:'л',storage:'+2…+6 °C'};
 const one=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{revision:0,products:[item]}});
 assert.equal(one.code,200);
 assert.equal(one.payload.products[0].weightUnit,'л');
 assert.equal(one.payload.products[0].category,'Лимонады');
 const wrong=await req('put','/api/farukh-print/admin/catalog',{...owner,body:{revision:1,products:[{...item,weightUnit:'литров'}]}});
 assert.equal(wrong.code,400);
});
