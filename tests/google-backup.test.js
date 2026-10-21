import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {installGoogleBackupApi} from '../google-backup-api.js';
import {makeGoogleBackupSnapshot,explainBackupEndpoint} from '../public/google-backup.js';

const endpoint='https://script.google.com/macros/s/AKfycbwABCDef12345678901234567890/exec';
const key='this-is-a-long-private-key-example';
function response(){
 return {statusCode:200,payload:null,headers:{},status(n){this.statusCode=n;return this},
 set(k,v){this.headers[k]=v;return this},json(d){this.payload=d;return this}};
}
function route(request){
 const routes={};
 installGoogleBackupApi({post:(path,fn)=>routes[path]=fn},{request});
 return routes['/api/backups/google-drive'];
}
async function invoke(handler,body){
 const res=response();
 await handler({body},res);
 return res;
}

test('Google backup bridge rejects unsafe destinations, missing credentials and unknown actions',async()=>{
 let calls=0;
 const handler=route(async()=>{calls++;throw Error('should never reach provider')});
 for(const body of [
  {endpoint:'http://127.0.0.1/escape',key,action:'check'},
  {endpoint:'https://evil.example/macros/s/AKfycbwABCDef12345678901234567890/exec',key,action:'check'},
  {endpoint,key:'short',action:'check'},
  {endpoint,key,action:'delete'}
 ]){
  const res=await invoke(handler,body);assert.equal(res.statusCode,400);
 }
 assert.equal(calls,0);
});

test('Snapshot contains all app data but no Google connection secrets',()=>{
 const state={revision:8,recipes:[{id:'1',name:'Суши'}],tasks:[{id:'1',text:'Проверка'}],
  haccp:{journal:[]},googleBackup:{endpoint,key},googleSync:{endpoint,key},googleDelivery:{item:'secret'}};
 const backup=makeGoogleBackupSnapshot(state);
 assert.equal(backup.version,1);
 assert.deepEqual(backup.state.recipes,state.recipes);
 assert.deepEqual(backup.state.tasks,state.tasks);
 assert.deepEqual(backup.state.haccp,state.haccp);
 assert.equal(backup.state.googleBackup,undefined);
 assert.equal(backup.state.googleSync,undefined);
 assert.equal(backup.state.googleDelivery,undefined);
 assert.ok(state.googleBackup.key,'Original IndexedDB state not mutated');
});

test('Google backup app bridge confirms file ID and accepts only read-only fetch/list and append-only backup',async()=>{
 const calls=[];
 const req=async(url,options)=>{
  assert.equal(url,endpoint);
  const body=JSON.parse(options.body);
  calls.push(body);
  const result=body.action==='backup'?{ok:true,id:'google_file_id_1234567890',name:'FARRUH_AI_backup_example.json',createdAt:new Date().toISOString()}:
   body.action==='list'?{ok:true,items:[{id:'google_file_id_1234567890',name:'Backup',createdAt:'2026-10-21T00:00:00Z',size:250}]}:
   body.action==='fetch'?{ok:true,snapshot:{version:1,state:{tasks:[],recipes:[]}}}:
   {ok:true,folderName:'FARRUH AI — резервные копии'};
  return {ok:true,json:async()=>result};
 };
 const handler=route(req);
 const snapshot=makeGoogleBackupSnapshot({revision:8,recipes:[],haccp:{},tasks:[]});
 for(const [body,check] of [
  [{endpoint,key,action:'check'},x=>assert.equal(x.payload.ok,true)],
  [{endpoint,key,action:'backup',snapshot},x=>assert.equal(x.payload.id,'google_file_id_1234567890')],
  [{endpoint,key,action:'list'},x=>assert.equal(x.payload.items.length,1)],
  [{endpoint,key,action:'fetch',backupId:'google_file_id_1234567890'},x=>assert.equal(x.payload.snapshot.version,1)]
 ]){const result=await invoke(handler,body);assert.equal(result.statusCode,200,'backup action: '+body.action+' reason: '+result.payload?.reason);check(result)}
 assert.deepEqual(calls.map(x=>x.action),['check','backup','list','fetch']);
 assert.equal(calls[1].snapshot.state.revision,8);
});

test('Server refuses secret-containing data and invalid archives without sending them to Google',async()=>{
 let calls=0;
 const handler=route(async()=>{calls++;throw Error('never')});
 const res=await invoke(handler,{endpoint,key,action:'backup',snapshot:{version:1,state:{tasks:[],googleSync:{key:'secret'}}}});
 assert.equal(res.statusCode,400);
 assert.equal(calls,0);
 const bad=await invoke(handler,{endpoint,key,action:'fetch',backupId:'../../important'});
 assert.equal(bad.statusCode,400);
});

test('Google errors do not report saved backups or wipe records',async()=>{
 const handler=route(async()=>({ok:false,status:500}));
 const snapshot=makeGoogleBackupSnapshot({tasks:[{text:'Кухня'}]});
 const res=await invoke(handler,{endpoint,key,action:'backup',snapshot});
 assert.equal(res.statusCode,502);
 assert.equal(res.payload.reason,'google-network');
 assert.match(res.payload.error,/Google/);
});


test('Connection diagnostics distinguish Drive folders, wrong key, non-public scripts and Google HTML login',async()=>{
 const folder='https://drive.google.com/drive/folders/1HghTLNfb-Om-nCVCAbjjWoOfBisKyYwn';
 const valid=route(async()=>({ok:true,json:async()=>({ok:true,folderName:'FARRUH AI — резервные копии'})}));
 const badFolder=await invoke(valid,{endpoint:folder,key,action:'check'});
 assert.equal(badFolder.statusCode,400);
 assert.equal(badFolder.payload.reason,'invalid-endpoint');
 assert.match(badFolder.payload.error,/Ссылка на папку Google Диска не подходит/);

 const invalidKey=await invoke(route(async()=>({ok:true,json:async()=>({ok:false,error:'Неверный ключ подключения Google.'})})),{endpoint,key,action:'check'});
 assert.equal(invalidKey.statusCode,502);
 assert.equal(invalidKey.payload.reason,'google-key');
 assert.match(invalidKey.payload.error,/Свойства скрипта/);
 assert.doesNotMatch(JSON.stringify(invalidKey.payload),new RegExp(key));

 const html=await invoke(route(async()=>({ok:true,headers:{get:()=> 'text/html; charset=utf-8'}})),{endpoint,key,action:'check'});
 assert.equal(html.statusCode,502);
 assert.equal(html.payload.reason,'google-html');
 assert.match(html.payload.error,/Веб-приложение/);

 const forbidden=await invoke(route(async()=>({ok:false,status:403})),{endpoint,key,action:'check'});
 assert.equal(forbidden.payload.reason,'google-access');
 const missing=await invoke(route(async()=>({ok:false,status:404})),{endpoint,key,action:'check'});
 assert.equal(missing.payload.reason,'google-not-found');
 const timeout=await invoke(route(async()=>{throw new Error('Sensitive '+key+' '+endpoint)}),{endpoint,key,action:'check'});
 assert.equal(timeout.payload.reason,'google-network');
 assert.doesNotMatch(JSON.stringify(timeout.payload),new RegExp(key));
 assert.doesNotMatch(JSON.stringify(timeout.payload),/AKfycbwABCDef/);
});

test('In-app backup remains opt-in with a documented one-time Google account authorization',async()=>{
 const [module,gs,html,page,server]=await Promise.all([
  readFile(new URL('../public/google-backup.js',import.meta.url),'utf8'),
  readFile(new URL('../public/google-backup.gs',import.meta.url),'utf8'),
  readFile(new URL('../public/google-backup-setup.html',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../server.js',import.meta.url),'utf8')
 ]);
 assert.match(module,/if\(!manual&&!c\.enabled\)return false/);
 assert.match(module,/if\(!manual&&Number\.isFinite\(last\)\&\&Date\.now\(\)-last<24\*3600\*1000\)return false/);
 assert.match(module,/validateDeviceState/);
 assert.match(module,/importData\(/);
 assert.match(gs,/BACKUP_CONNECTION_KEY/);
 assert.match(gs,/createFile\(/);
 assert.doesNotMatch(gs,/setTrashed\(/);
 assert.match(html,/initializeBackup/);
 assert.match(page,/mountGoogleDriveBackup/);
 assert.match(server,/installGoogleBackupApi\(app\)/);
});

test('Backup connection rejects Drive folder URLs with actionable guidance and accepts /exec web app',()=>{
 assert.match(explainBackupEndpoint('https://drive.google.com/drive/folders/1HghTLNfb-Om-nCVCAbjjWoOfBisKyYwn'),/папку Google Диска/);
 assert.match(explainBackupEndpoint('https://script.google.com/home/projects/hello'),/URL веб-приложения/);
 assert.equal(explainBackupEndpoint('https://script.google.com/macros/s/AKfycbwABCDef12345678901234567890/exec'),'');
});
