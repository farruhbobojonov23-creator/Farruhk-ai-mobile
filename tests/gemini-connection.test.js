import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('Gemini opt-in uses server-side key only and protects status under owner auth',async()=>{
 const [server,auth,page]=await Promise.all([
  readFile(new URL('../server.js',import.meta.url),'utf8'),
  readFile(new URL('../assistant-api.js',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8')
 ]);
 assert.match(server,/const geminiKey = String\(process\.env\.GEMINI_API_KEY\|\|''\)\.trim\(\)/);
 assert.match(server,/installVoiceApi\(app,\{key:geminiKey\}\)/);
 assert.match(server,/app\.get\('\/api\/ai\/status'/);
 assert.match(server,/['"]x-goog-api-key['"]:geminiKey/);
 assert.doesNotMatch(server,/:generateContent\?key=/,'Gemini key must never go in URL');
 assert.match(auth,/\|voice\|ai\|recipes/,'AI status is owner protected');
 assert.match(page,/d\.mode==='local-fallback'/);
 assert.match(page,/if\(!d\|\|typeof d\.reply!=='string'/);
 assert.doesNotMatch(page,/if\(d\.mode!=='online'\)/);
 assert.match(page,/geminiStatus\.textContent=d\.configured/);
});

test('Gemini model response reaches text and voice caller unchanged; local fallback is labelled',async()=>{
 const page=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const snippet=page.slice(page.indexOf('async function sendChat(message'),page.indexOf('const voice=createVoiceConversation'));
 assert.ok(snippet.includes('async function sendChat('));
 for(const response of [
  {mode:'gemini',reply:'Я помогу составить техкарту.'},
  {mode:'local-fallback',reply:'Могу открыть задачи.'},
  {mode:'local',reply:'Доступны базовые команды.'}
 ]){
  const displays=[],labels=new Map();
  const el=id=>{if(!labels.has(id))labels.set(id,{value:'',querySelector:()=>({disabled:false})});return labels.get(id)};
  const state={tasks:[],chat:[]};
  const context=vm.createContext({
   state,chatBusy:false,chatSaveTail:Promise.resolve(),$:el,
   notice(){},bubble(role,text){displays.push({role,text})},voiceCommands:{run:async()=>null},
   parseTaskCommand:()=>null,fetch:async()=>({ok:true,json:async()=>response}),
   save:async(change)=>{change(state)},
   AbortSignal,DOMException,crypto:{randomUUID:()=> 'unit'}
  });
  vm.runInContext(snippet,context);
  const output=await context.sendChat('Помоги мне', {voice:true});
  assert.match(output, response.mode==='gemini'?/Я помогу составить техкарту\./:/Gemini/);
  assert.equal(displays[1].role,'ai');
  assert.equal(displays[1].text,output);
  assert.ok(!output.includes('Разговорный ИИ пока не подключён')||response.mode==='local');
 }
});
