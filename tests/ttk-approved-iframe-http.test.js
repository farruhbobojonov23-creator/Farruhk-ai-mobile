import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

// This is the REAL Express entrypoint, not the static-file mock server used
// in browser smoke tests. The mock omits security headers and missed the
// ERR_BLOCKED_BY_RESPONSE bug on Android on 20 November 2026.
test('real server permits ONLY the Emerald A4 master in a same-origin iframe', {timeout:30000}, async()=>{
 const child=spawn(process.execPath,['server.js'],{
  cwd:root,
  env:{...process.env,PORT:'0',NODE_ENV:'test',GEMINI_API_KEY:''},
  stdio:['ignore','pipe','pipe']
 });
 let startupLog='';
 let stopWait;
 try{
  const port=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Express startup timed out: '+startupLog.slice(-1200))),16000);
   const finish=(fn,value)=>{clearTimeout(timer);child.stdout.off('data',onData);child.off('error',onError);child.off('exit',onExit);fn(value)};
   const onData=data=>{
    startupLog+=data.toString('utf8');
    const match=/FARRUHK? AI Mobile V[\d.]+: host=0\.0\.0\.0 port=(\d+)/i.exec(startupLog);
    if(match)finish(resolve,Number(match[1]));
   };
   const onError=e=>finish(reject,e);
   const onExit=code=>finish(reject,Error('Express exited '+code+': '+startupLog.slice(-1200)));
   child.stdout.on('data',onData);child.on('error',onError);child.on('exit',onExit);
  });
  const base='http://127.0.0.1:'+port;
  const request=async uri=>fetch(base+uri,{method:'HEAD',signal:AbortSignal.timeout(8000)});
  const master=await request('/ttk-approved-master.html?v=owner-master-20261120-frame');
  assert.equal(master.status,200,'approved A4 HTML is served');
  assert.equal(master.headers.get('x-frame-options'),'SAMEORIGIN','the signed-in editor must be allowed to frame its own A4 HTML');
  assert.equal(master.headers.get('content-security-policy'),"frame-ancestors 'self'",'other websites must not embed the master');
  assert.match(master.headers.get('content-type')||'',/text\/html/);
  const app=await request('/');
  assert.equal(app.headers.get('x-frame-options'),'DENY','main owner app remains protected');
  const js=await request('/ttk-approved-preview.js?v=4');
  assert.equal(js.status,200);
  assert.equal(js.headers.get('x-frame-options'),'DENY','all unrelated resources keep DENY');
 }finally{
  child.kill('SIGTERM');
  stopWait=new Promise(resolve=>child.once('exit',resolve));
  await Promise.race([stopWait,new Promise(resolve=>setTimeout(resolve,1800))]);
 }
});
