import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('Production server starts and serves health and app assets without external services', {timeout:15000}, async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'fai-runtime-'));
  const child=spawn(process.execPath,['server.js'],{
    cwd:new URL('..',import.meta.url),
    env:{...process.env,PORT:'0',ASSISTANT_DATA_DIR:directory,YANDEX_DISK_TOKEN:'',TELEGRAM_BOT_TOKEN:'',GEMINI_API_KEY:'',VAPID_PUBLIC_KEY:'',VAPID_PRIVATE_KEY:''},
    stdio:['ignore','pipe','pipe']
  });
  t.after(async()=>{child.kill();await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));await fs.rm(directory,{recursive:true,force:true})});
  const port=await new Promise((resolve,reject)=>{
    let output='';
    child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/host=0\.0\.0\.0 port=(\d+)/);if(match)resolve(Number(match[1]))});
    child.once('error',reject);child.once('exit',code=>reject(Error('Server exited before listening: '+code)));
  });
  const base='http://127.0.0.1:'+port;
  const health=await fetch(base+'/healthz');assert.equal(health.status,200);assert.deepEqual(await health.json(),{ok:true});
  const page=await fetch(base+'/');assert.equal(page.status,200);const html=await page.text();assert.match(html,/DeviceStore/);
  const assets=new Set([...html.matchAll(/(?:src|href)=["'](\/[^"']+)["']/g)].map(m=>m[1]));
  for(const match of html.matchAll(/from\s+["'](\/[^"']+)["']/g))assets.add(match[1]);
  assert.ok(assets.size>5);
  for(const asset of assets){const response=await fetch(base+asset);assert.equal(response.status,200,asset);assert.doesNotMatch(response.headers.get('content-type')||'',/text\/html/,asset);await response.arrayBuffer()}
  const session=await fetch(base+'/api/auth/session');assert.equal(session.status,200);assert.equal(typeof (await session.json()).authenticated,'boolean');
});
