import test from 'node:test';
import assert from 'node:assert/strict';
import {YandexAssistantStore} from '../assistant-cloud-store.js';
test('Transient cloud API errors retry without replacing the confirmed state',async()=>{
 let calls=0;const store=new YandexAssistantStore(' token \n',async(url,options)=>{calls++;if(calls===1)return {ok:false,status:503};if(url.startsWith('https://cloud-api')){assert.equal(options.headers.Authorization,'OAuth token');return {ok:true,status:200,json:async()=>({href:'https://storage.test/state'})}}return {ok:true,json:async()=>({revision:12,recipes:[{name:'Филадельфия'}]})}});
 const state=await store.state();assert.equal(state.revision,12);assert.equal(state.recipes[0].name,'Филадельфия');assert.equal(calls,3);
});
test('Cloud connection failures do not become an empty recipe list',async()=>{
 let calls=0;const store=new YandexAssistantStore('token',async()=>{calls++;throw new TypeError('network failure')});await assert.rejects(()=>store.state(),TypeError);assert.equal(calls,2);
});
test('Invalid JSON remains an error and cannot initialize replacement state',async()=>{
 const store=new YandexAssistantStore('token',async url=>url.startsWith('https://cloud-api')?{ok:true,status:200,json:async()=>({href:'https://storage.test/state'})}:{ok:true,json:async()=>{throw new SyntaxError('invalid JSON')}});await assert.rejects(()=>store.state(),SyntaxError);
});
test('A failed download gets a fresh signed link before retrying',async()=>{
 let links=0;const downloads=[];
 const store=new YandexAssistantStore('token',async url=>{
  if(url.startsWith('https://cloud-api'))return {ok:true,status:200,json:async()=>({href:'https://storage.test/'+(++links)})};
  downloads.push(url);return links===1?{ok:false,status:503}:{ok:true,json:async()=>({revision:25,recipes:[{name:'Сохранённая карта'}]})};
 });
 assert.equal((await store.state()).revision,25);assert.deepEqual(downloads,['https://storage.test/1','https://storage.test/2']);
});
test('WebDAV fallback reads the same file and never resets it on a missing response',async()=>{
 for(const status of [200,404]){
  const store=new YandexAssistantStore('token',async(url,options)=>{
   if(url.startsWith('https://cloud-api'))return {ok:true,status:200,json:async()=>({href:'https://storage.test/file'})};
   if(url.startsWith('https://webdav.yandex.ru/')){assert.equal(url,'https://webdav.yandex.ru/FARRUKH_AI_STORAGE/FARRUKH_AI_V2/state.json');assert.equal(options.headers.Authorization,'OAuth token');assert.equal(options.redirect,'error');return {ok:status===200,status,json:async()=>({revision:30,recipes:[{name:'Карта'}]})}}
   return {ok:false,status:500};
  });
  if(status===200)assert.equal((await store.state()).revision,30);else await assert.rejects(()=>store.state(),e=>e.status===502);
 }
});
