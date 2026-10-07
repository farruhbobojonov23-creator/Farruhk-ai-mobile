import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {AssistantStore,ownerAuth,cleanState} from '../assistant-store.js';
import {installAssistantApi} from '../assistant-api.js';
import {parseTaskCommand,zonedDate,zonedToUtc} from '../public/task-commands.js';
import {parseLiveReports} from '../public/analytics-values.js';

const now=new Date('2026-10-07T18:00:00Z');
test('Russian relative days, priorities and weekday use the configured time zone',()=>{
  assert.equal(parseTaskCommand('Напомни завтра проверить рис',now).due,'2026-10-08T06:00:00.000Z');
  const tomorrow=parseTaskCommand('Напомни завтра в 10:00 проверить рис',now);
  assert.equal(tomorrow.due,'2026-10-08T07:00:00.000Z');assert.equal(tomorrow.text,'проверить рис');
  assert.equal(parseTaskCommand('Добавь задачу в пятницу проверить маркировки',now).due,'2026-10-09T06:00:00.000Z');
  assert.equal(parseTaskCommand('Добавь задачу проверить склад срочно',now).priority,'high');
  assert.equal(parseTaskCommand('Добавь задачу проверить склад срочно',now).text,'проверить склад');
  assert.equal(parseTaskCommand('Напомни в 20:00 проверить рис',now).due,'2026-10-08T17:00:00.000Z');
});
test('Other intents do not create tasks and invalid time is rejected',()=>{
  assert.equal(parseTaskCommand('Создай техкарту ролла',now),null);
  assert.equal(parseTaskCommand('Запиши заметку о закупке',now),null);
  assert.throws(()=>parseTaskCommand('Напомни в 99:99 проверить рис',now),/23:59/);
});
test('Dates preserve configured zone across UTC day boundary and DST gap is rejected',()=>{
  assert.equal(parseTaskCommand('Напомни завтра в 10:00 проверить рис',new Date('2026-10-07T22:30:00Z')).due,'2026-10-09T07:00:00.000Z');
  const wall=zonedDate(new Date('2026-10-08T07:00:00Z'),'Europe/Moscow');assert.equal(wall.getHours(),10);assert.equal(zonedToUtc(wall).toISOString(),'2026-10-08T07:00:00.000Z');
  assert.throws(()=>zonedToUtc(new Date(2026,2,29,2,30),'Europe/Berlin'),/перевода часов/);
});
test('Owner authentication fails closed and rejects wrong, tampered and expired tokens',()=>{
  assert.equal(ownerAuth({}).verify('anything'),false);
  assert.throws(()=>ownerAuth({}).login('anything'),{status:503});
  let time=100000;const auth=ownerAuth({password:'test-password',secret:'test-secret',now:()=>time});
  assert.throws(()=>auth.login('wrong'),{status:401});const token=auth.login('test-password');assert.equal(auth.verify(token),true);assert.equal(auth.verify(token+'x'),false);time+=8*86400000;assert.equal(auth.verify(token),false);
});
test('State survives process recreation; stale concurrent writes cannot replace newer data',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'farruh-store-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const store=new AssistantStore(dir),input={revision:0,tasks:[{id:'task-1',text:'Рис'}],memory:[],chat:[]};
  const outcomes=await Promise.allSettled([store.save(input),store.save({...input,tasks:[{text:'Конфликт'}]})]);
  assert.equal(outcomes[0].status,'fulfilled');assert.equal(outcomes[1].reason.status,409);
  const restarted=new AssistantStore(dir);assert.equal((await restarted.state()).tasks[0].text,'Рис');
  const backup=await restarted.backup();await restarted.save({revision:1,tasks:[]});
  const restored=await restarted.restore(backup.path,2);assert.equal(restored.tasks[0].text,'Рис');assert.equal(restored.revision,3);
  assert.equal((await restarted.backups()).length,2);assert.equal((await fs.stat(path.join(dir,'state.json'))).mode&0o777,0o600);
  await assert.rejects(()=>restarted.restore('../state.json',3),{status:400});
});
test('Corrupt storage is reported instead of silently resetting user data',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'farruh-corrupt-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));await fs.writeFile(path.join(dir,'state.json'),'broken');await assert.rejects(()=>new AssistantStore(dir).state(),SyntaxError);
  assert.equal(cleanState({tasks:[{text:'Рис',due:'not-a-date'}]}).tasks[0].due,null);
});
test('Empty cells and percentages cannot become revenue; ambiguous rows remain unknown',()=>{
  const report=row=>parseLiveReports({reports:[{title:'Отчёт',tables:[[row]]}]});
  assert.equal(report(['Выручка','1000',''])[0].value,1000);
  assert.equal(report(['Выручка','1000','20%'])[0].value,1000);
  assert.equal(report(['Выручка',''])[0],undefined);
  assert.equal(report(['Выручка','1000','2000'])[0],undefined);
});
test('API access rejects unauthenticated callers and cross-origin mutations',()=>{
  const oldPassword=process.env.ASSISTANT_PASSWORD,oldSecret=process.env.ASSISTANT_SESSION_SECRET;
  process.env.ASSISTANT_PASSWORD='test-password';process.env.ASSISTANT_SESSION_SECRET='test-secret';
  try{
    const middlewares=[],routes={};const app={use(fn){middlewares.push(fn)},get(p,...f){routes['GET '+p]=f},post(p,...f){routes['POST '+p]=f},put(){},delete(){}};
    const multer=()=>({single:()=>()=>{}});multer.memoryStorage=()=>({});installAssistantApi(app,{multer,ExcelJS:{}});
    const res={code:null,status(n){this.code=n;return this},json(){return this},sendStatus(n){this.code=n;return this}};let passed=false;
    const req={path:'/api/state',method:'GET',headers:{},get:()=> 'example.com'};
    middlewares[0](req,res,()=>passed=true);assert.equal(res.code,401);assert.equal(passed,false);
    const auth=ownerAuth({password:'test-password',secret:'test-secret'});req.headers.cookie='fai_owner='+auth.login('test-password');req.method='PUT';req.headers.origin='https://evil.example';middlewares[0](req,res,()=>passed=true);assert.equal(res.code,403);
    req.headers.origin='https://example.com';middlewares[0](req,res,()=>passed=true);assert.equal(passed,true);
  }finally{if(oldPassword===undefined)delete process.env.ASSISTANT_PASSWORD;else process.env.ASSISTANT_PASSWORD=oldPassword;if(oldSecret===undefined)delete process.env.ASSISTANT_SESSION_SECRET;else process.env.ASSISTANT_SESSION_SECRET=oldSecret}
});
test('Edits during in-flight sync schedule another save; conflict does not report success',async()=>{
  const source=await fs.readFile(new URL('../public/north.js',import.meta.url),'utf8');const fn=source.slice(source.indexOf('async function syncStateNow('),source.indexOf('function adoptRemote('));
  let finish,scheduled=0;const context=vm.createContext({syncBusy:false,syncConflict:false,bootstrapping:false,changeGeneration:1,savedGeneration:0,stateRevision:0,fetch:()=>new Promise(resolve=>finish=resolve),statePayload:()=>({}),AbortSignal,localStorage:{setItem(){},removeItem(){}},syncLabel(){},setTimeout(){},scheduleStateSync(){scheduled++},resolveConflict(){}});vm.runInContext(fn,context);
  const promise=context.syncStateNow();context.changeGeneration=2;assert.equal(await context.syncStateNow(),false);finish({ok:true,status:200,json:async()=>({state:{revision:1,updatedAt:'date'}})});await promise;assert.equal(scheduled,1);assert.equal(context.savedGeneration,1);
  context.fetch=async()=>({ok:false,status:409,json:async()=>({state:{revision:2}})});assert.equal(await context.syncStateNow(),false);assert.equal(context.syncConflict,true);
});

test('Cloud storage persists state without local disk and surfaces failed cloud writes',async()=>{
  const {YandexAssistantStore}=await import('../assistant-cloud-store.js');const objects=new Map();
  const request=async(url,options={})=>{
    if(url.startsWith('https://cloud-api.yandex.net')){const u=new URL(url),name=u.searchParams.get('path');if(u.pathname.endsWith('/download'))return objects.has(name)?{ok:true,status:200,json:async()=>({href:'https://storage.test/download?path='+encodeURIComponent(name)})}:{ok:false,status:404,json:async()=>({message:'missing'})};if(u.pathname.endsWith('/upload'))return {ok:true,status:200,json:async()=>({href:'https://storage.test/upload?path='+encodeURIComponent(name)})};return {ok:true,status:201,json:async()=>({})}}
    const name=new URL(url).searchParams.get('path');if(options.method==='PUT'){objects.set(name,JSON.parse(options.body));return {ok:true,status:201}}return {ok:true,status:200,json:async()=>objects.get(name)};
  };
  const store=new YandexAssistantStore('test-token',request);await store.save({revision:0,tasks:[{text:'Рис'}]});const restarted=new YandexAssistantStore('test-token',request);assert.equal((await restarted.state()).storage,'yandex');assert.equal((await restarted.state()).tasks[0].text,'Рис');
  const failure=new YandexAssistantStore('test-token',async()=>({ok:false,status:500,json:async()=>({message:'failed'})}));await assert.rejects(()=>failure.state(),{status:500});
});

test('Explicit passwordless mode opens assistant APIs but retains origin protection',()=>{
  const previous=process.env.ASSISTANT_PASSWORDLESS;process.env.ASSISTANT_PASSWORDLESS='true';
  try{
    const middlewares=[],routes={};const app={use(fn){middlewares.push(fn)},get(p,...f){routes['GET '+p]=f},post(){},put(){},delete(){}};
    const multer=()=>({single:()=>()=>{}});multer.memoryStorage=()=>({});installAssistantApi(app,{multer,ExcelJS:{}});
    const req={path:'/api/state',method:'GET',headers:{},get:()=> 'example.com'};
    let data,passed=false;const res={code:null,status(n){this.code=n;return this},json(d){data=d;return this},sendStatus(n){this.code=n;return this}};
    routes['GET /api/auth/session'][0](req,res);assert.equal(data.authenticated,true);assert.equal(data.passwordless,true);
    middlewares[0](req,res,()=>passed=true);assert.equal(passed,true);
    passed=false;req.method='PUT';req.headers.origin='https://evil.example';middlewares[0](req,res,()=>passed=true);assert.equal(res.code,403);assert.equal(passed,false);
    req.headers.origin='https://example.com';middlewares[0](req,res,()=>passed=true);assert.equal(passed,true);
  }finally{if(previous===undefined)delete process.env.ASSISTANT_PASSWORDLESS;else process.env.ASSISTANT_PASSWORDLESS=previous}
});

test('Calendar reminders use UTC, escape text and fold UTF-8 lines',async()=>{
  const {taskCalendar}=await import('../public/task-calendar.js');
  const data=taskCalendar([{id:'task-1',text:'Рис, рыба; проверить\nхолодильник '+ 'я'.repeat(100),due:'2026-10-09T10:00:00+03:00'},{id:'done',text:'Done',done:true,due:'2026-10-09T10:00:00Z'}],new Date('2026-10-08T00:00:00Z'));
  assert.match(data,/DTSTART:20261009T070000Z/);assert.match(data,/TRIGGER:PT0S/);assert.match(data,/Рис\\, рыба\\; проверить\\n/);assert.equal(data.includes('UID:done'),false);
  for(const line of data.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
});

test('Fresh report context does not inherit archived totals or branches',async()=>{
  const source=await fs.readFile(new URL('../public/north.js',import.meta.url),'utf8');
  const fn=source.slice(source.indexOf('function analyticsHtml('),source.indexOf('async function loadAnalyticsData('));
  const context=vm.createContext({parseLiveReports:()=>[],uploadMetrics:()=>[],analyticsContext:null,esc:String,metricValue:(_,v)=>v});vm.runInContext(fn,context);
  const html=context.analyticsHtml({totalUnits:182,date:'03.10.2026',summary:'Old',branches:[{name:'Archive',units:182}]},{},{ok:true,authenticated:true,updatedAt:'2026-10-08T00:00:00Z'},null);
  assert.equal(context.analyticsContext.totalUnits,null);assert.equal(context.analyticsContext.summary,'');assert.equal(html.includes('Archive'),false);assert.equal(html.includes('182'),false);
});
