import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {installVoiceApi} from '../voice-api.js';

const withServer=async(app,fn)=>{
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 try{return await fn('http://127.0.0.1:'+server.address().port)}
 finally{await new Promise(resolve=>server.close(resolve))}
};
const wav=()=>{
 const bytes=Buffer.alloc(46);
 bytes.write('RIFF',0);bytes.writeUInt32LE(38,4);bytes.write('WAVE',8);
 bytes.write('fmt ',12);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);
 bytes.writeUInt32LE(24000,24);bytes.writeUInt32LE(48000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);
 bytes.write('data',36);bytes.writeUInt32LE(2,40);
 return bytes;
};

test('Gemini key absent: config does not claim voice is connected and speaking fails safely',async()=>{
 const app=express();app.use(express.json());installVoiceApi(app,{key:''});
 await withServer(app,async base=>{
  const cfg=await fetch(base+'/api/voice/config').then(r=>r.json());
  assert.equal(cfg.configured,false);
  assert.equal(cfg.model,null);
  const spoken=await fetch(base+'/api/voice/speak',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'Привет'})});
  assert.equal(spoken.status,503);
 });
});

test('Voice TTS uses Gemini 3.8 Interactions contract, returns WAV, and keeps key server-side',async()=>{
 let called=0,seen;
 const mock=async(url,options)=>{
  called++;seen={url,options,body:JSON.parse(options.body)};
  return {ok:true,json:async()=>({steps:[{type:'model_output',content:[{type:'audio',data:wav().toString('base64')}]}]})};
 };
 const app=express();app.use(express.json());installVoiceApi(app,{key:'server-secret',request:mock});
 await withServer(app,async base=>{
  const cfg=await fetch(base+'/api/voice/config').then(r=>r.json());
  assert.equal(cfg.configured,true);
  assert.ok(!JSON.stringify(cfg).includes('server-secret'));
  const res=await fetch(base+'/api/voice/speak',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'Добрый день!',voice:'Aoede'})});
  assert.equal(res.status,200);
  assert.match(res.headers.get('content-type'),/audio\/wav/);
  assert.equal(Buffer.from(await res.arrayBuffer()).subarray(0,4).toString(),'RIFF');
 });
 assert.equal(called,1);
 assert.equal(seen.url,'https://generativelanguage.googleapis.com/v1beta/interactions');
 assert.equal(seen.options.headers['x-goog-api-key'],'server-secret');
 assert.equal(seen.body.model,'gemini-3.8-flash-tts');
 assert.equal(seen.body.input[0].content[0].text,'Добрый день!');
 assert.equal(seen.body.response_format.type,'audio');
 assert.deepEqual(seen.body.generation_config.speech_config,[{voice:'Aoede'}]);
 assert.ok(!('contents' in seen.body));
});

test('Voice TTS reports quota and invalid provider audio without sending fake speech',async()=>{
 const app=express();app.use(express.json());installVoiceApi(app,{key:'secret',request:async()=>({ok:false,status:429,json:async()=>({error:{message:'quota'}})})});
 await withServer(app,async base=>{
  const res=await fetch(base+'/api/voice/speak',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'Привет'})});
  assert.equal(res.status,429);
  assert.match((await res.json()).error,/Лимит/);
 });
 const broken=express();broken.use(express.json());installVoiceApi(broken,{key:'secret',request:async()=>({ok:true,json:async()=>({steps:[]})})});
 await withServer(broken,async base=>{
  const res=await fetch(base+'/api/voice/speak',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'Привет'})});
  assert.equal(res.status,502);
  assert.match((await res.json()).error,/Текст ответа доступен/);
 });
});
