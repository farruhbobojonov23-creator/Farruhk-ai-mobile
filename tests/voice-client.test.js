import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const code=(await fs.readFile(new URL('../public/chef-voice.js',import.meta.url),'utf8')).replaceAll('export function','function');
function setup({enabled=true,request,send,autoEnd=true}={}){
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},checked:true,value:'Sulafat'});return nodes.get(id)};node('voice-enabled').checked=enabled;
 const events=[],timers=new Set();let playback;
 class AudioContext{constructor(){events.push('audio-create');this.destination={}}async resume(){events.push('audio-resume')}async decodeAudioData(){events.push('decode');return {}}createAnalyser(){return {fftSize:1024,connect(){},disconnect(){},getFloatTimeDomainData(data){data.fill(.1)}}}createBufferSource(){playback={connect(){},start(){events.push('play');if(autoEnd)queueMicrotask(()=>playback.onended?.())},stop(){events.push('stop')}};return playback}}
 const context=vm.createContext({document:{getElementById:node,addEventListener(){}},window:{AudioContext,addEventListener(){}},location:{hash:'#chat'},navigator:{mediaDevices:{getUserMedia(){throw Error('Text must not request microphone')}}},AbortController,setTimeout(fn){const id={fn};timers.add(id);return id},clearTimeout(id){timers.delete(id)},requestAnimationFrame(){return 1},cancelAnimationFrame(){},queueMicrotask,fetch:request||(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(48)})),console});
 vm.runInContext(code,context);const voice=context.createVoiceConversation({send:send||(async()=>{events.push('send');return 'Привет'})});return {voice,node,events,timers};
}
test('Typed reply unlocks audio before asynchronous chat, then plays without microphone',async()=>{const app=setup();await app.voice.sendText('Привет');assert.ok(app.events.indexOf('audio-resume')<app.events.indexOf('send'));assert.ok(app.events.includes('play'));assert.equal(app.node('voice-panel').dataset.phase,'idle');assert.equal(app.timers.size,0)});
test('Disabling automatic voice sends chat without audio; manual replay remains available',async()=>{const app=setup({enabled:false});await app.voice.sendText('Привет');assert.deepEqual(app.events,['send']);await app.voice.read('Ответ');assert.ok(app.events.includes('play'))});
test('Stop while neural audio is pending prevents late playback and cleans timers',async()=>{let finish;const app=setup({request:()=>new Promise(resolve=>finish=resolve)});const pending=app.voice.read('Ответ');await new Promise(resolve=>setImmediate(resolve));app.voice.stop();finish({ok:true,arrayBuffer:async()=>new ArrayBuffer(48)});await pending;assert.equal(app.events.includes('play'),false);assert.equal(app.timers.size,0)});
test('Failed voice generation exposes an error while preserving the completed text response',async()=>{const app=setup({request:async()=>({ok:false,json:async()=>({error:'Голос временно недоступен'})})});await app.voice.sendText('Привет');assert.ok(app.events.includes('send'));assert.equal(app.node('voice-panel').dataset.phase,'error');assert.match(app.node('voice-status').textContent,/недоступен/);assert.equal(app.timers.size,0)});

test('Short first speech segment preserves all text and prepares following audio during playback',async()=>{
 const text='Первое короткое предложение. '+ 'Длинный ответ с подробностями. '.repeat(60);
 let requests=0;
 const app=setup({autoEnd:false,request:async()=>{requests++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(48)}}});
 const context=vm.createContext({});vm.runInContext(code.slice(0,code.indexOf('function createVoiceConversation')),context);
 const chunks=context.speechChunks(text);assert.ok(chunks[0].length<=280);assert.equal(chunks.join(''),text);assert.ok(chunks.slice(1).every(c=>c.length<=1000));
 const playback=app.voice.read(text);await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,2);assert.ok(app.events.includes('play'));app.voice.stop();await playback;assert.equal(app.timers.size,0);
});

test('Voice-first home creates an explicit task locally and confirms only after persistence',async()=>{
 const {parseTaskCommand}=await import('../public/task-commands.js');
 const html=await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const fn=html.slice(html.indexOf('async function sendChat('),html.indexOf('const voice=createVoiceConversation'));
 let persisted=false;const state={tasks:[],chat:[]};
 const context=vm.createContext({state,chatBusy:false,chatSaveTail:Promise.resolve(),$(){return {value:'',querySelector(){return {disabled:false}}}},notice(){},bubble(){},parseTaskCommand,crypto:{randomUUID:()=> 'test-task'},DOMException,AbortSignal,fetch(){throw Error('Task command must not wait for Gemini')},save:async change=>{change(state);persisted=true}});
 vm.runInContext(fn,context);const reply=await context.sendChat('Добавь задачу проверить рис завтра в 10:00');assert.equal(persisted,true);assert.equal(state.tasks[0].text,'проверить рис');assert.match(reply,/Задача сохранена/);
});
