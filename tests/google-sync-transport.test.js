import test from 'node:test';
import assert from 'node:assert/strict';
import {postGooglePacket} from '../public/google-sync-transport.js';
const ok={ok:true,status:200,json:async()=>({ok:true,pdfReady:true})};
test('lost response retries the identical recipe packet and returns confirmed success',async()=>{
 const bodies=[],waits=[];
 const result=await postGooglePacket({action:'sync',recipe:{id:'stable-id'},digest:'same-digest'},null,{
  request:async(url,options)=>{bodies.push(options.body);if(bodies.length<3)throw new TypeError('Failed to fetch');return ok},
  wait:async ms=>waits.push(ms)
 });
 assert.equal(result.pdfReady,true);assert.equal(bodies.length,3);
 assert.equal(new Set(bodies).size,1);assert.deepEqual(waits,[2000,6000]);
});
test('persistent network failure is bounded and never reports a successful save',async()=>{
 let calls=0;
 await assert.rejects(postGooglePacket({action:'sync'},null,{request:async()=>{calls++;throw new TypeError('Failed to fetch')},wait:async()=>{}}),
  e=>e.code==='GOOGLE_TRANSPORT_UNCONFIRMED'&&/не подтверждён/.test(e.message));
 assert.equal(calls,3);
});
test('Google application errors are preserved without blind retries',async()=>{
 let calls=0;
 await assert.rejects(postGooglePacket({},null,{request:async()=>{calls++;return {ok:false,status:502,json:async()=>({error:'Update script',code:'GOOGLE_PDF_NOT_CONFIRMED',documentSaved:true,documentUrl:'doc'})}}}),
  e=>e.code==='GOOGLE_PDF_NOT_CONFIRMED'&&e.documentSaved&&e.documentUrl==='doc');
 assert.equal(calls,1);
});
test('temporary HTML proxy response retries but an authentication response does not',async()=>{
 let calls=0;
 await postGooglePacket({},null,{request:async()=>++calls===1?{ok:false,status:503,json:async()=>{throw new SyntaxError('html')}}:ok,wait:async()=>{}});
 assert.equal(calls,2);
 calls=0;
 await assert.rejects(postGooglePacket({},null,{request:async()=>{calls++;return {ok:false,status:401,json:async()=>({error:'Войдите в кабинет'})}}}),/Войдите/);
 assert.equal(calls,1);
});
test('deleting a recipe during backoff cancels all further uploads',async()=>{
 const controller=new AbortController();let calls=0;
 await assert.rejects(postGooglePacket({},controller.signal,{
  request:async()=>{calls++;throw new TypeError('Failed to fetch')},wait:async()=>controller.abort()
 }),e=>e.name==='AbortError');
 assert.equal(calls,1);
});
test('timeout is retried and malformed successful response is never acknowledged',async()=>{
 let calls=0;
 await postGooglePacket({},null,{request:async()=>{if(++calls===1)throw new DOMException('Timeout','TimeoutError');return ok},wait:async()=>{}});
 assert.equal(calls,2);
 await assert.rejects(postGooglePacket({},null,{request:async()=>({ok:true,status:200,json:async()=>{throw new SyntaxError('html')}})}),
  e=>e.code==='GOOGLE_INVALID_RESPONSE');
});

test('connection loss while reading the response body also retries',async()=>{
 let calls=0;
 const result=await postGooglePacket({},null,{request:async()=>++calls===1?{ok:true,status:200,json:async()=>{throw new TypeError('Failed to fetch')}}:ok,wait:async()=>{}});
 assert.equal(calls,2);assert.equal(result.pdfReady,true);
});
