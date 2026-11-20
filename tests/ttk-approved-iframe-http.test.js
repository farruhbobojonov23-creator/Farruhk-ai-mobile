import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('restored app blocks all embedded HTML, including retired Emerald page', {timeout:30000}, async()=>{
 const child=spawn(process.execPath,['server.js'],{
  cwd:root,env:{...process.env,PORT:'0',NODE_ENV:'test',GEMINI_API_KEY:''},stdio:['ignore','pipe','pipe']
 });
 let logs='';
 try{
  const port=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Server did not start: '+logs.slice(-1000))),16000);
   const success=(fn,v)=>{clearTimeout(timer);child.stdout.off('data',onData);child.off('error',onError);child.off('exit',onExit);fn(v);};
   const onData=data=>{logs+=data.toString();const m=/Mobile V[\d.]+: host=0\.0\.0\.0 port=(\d+)/i.exec(logs);if(m)success(resolve,Number(m[1]));};
   const onError=e=>success(reject,e);
   const onExit=code=>success(reject,Error('Server exited '+code));
   child.stdout.on('data',onData);child.on('error',onError);child.on('exit',onExit);
  });
  const base='http://127.0.0.1:'+port;
  for(const resource of ['/','/ttk-approved-master.html','/ttk-layouts.js?v=7']){
   const response=await fetch(base+resource,{method:'HEAD',signal:AbortSignal.timeout(8000)});
   // The '/' app shell can legitimately return 503 in NODE_ENV=test until
   // persistent startup is ready. Security headers must be set either way.
   assert.ok(response.status===200||(resource==='/'&&response.status===503),
    resource+' returned unexpected status '+response.status);
   assert.equal(response.headers.get('x-frame-options'),'DENY',resource+' must remain non-embeddable');
  }
 }finally{
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,1700))]);
 }
});
