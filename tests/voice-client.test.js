import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const code=(await fs.readFile(new URL('../public/chef-voice.js',import.meta.url),'utf8')).replace('export function','function');
function setup({enabled=true,request,send,autoEnd=true}={}){
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},checked:true,value:'Sulafat'});return nodes.get(id)};node('voice-enabled').checked=enabled;
 const events=[],timers=new Set();let playback;
 class AudioContext{constructor(){events.push('audio-create');this.destination={}}async resume(){events.push('audio-resume')}async decodeAudioData(){events.push('decode');return {}}createBufferSource(){playback={connect(){},start(){events.push('play');if(autoEnd)queueMicrotask(()=>playback.onended?.())},stop(){events.push('stop')}};return playback}}
 const context=vm.createContext({document:{getElementById:node,addEventListener(){}},window:{AudioContext,addEventListener(){}},location:{hash:'#chat'},navigator:{mediaDevices:{getUserMedia(){throw Error('Text must not request microphone')}}},AbortController,setTimeout(fn){const id={fn};timers.add(id);return id},clearTimeout(id){timers.delete(id)},cancelAnimationFrame(){},queueMicrotask,fetch:request||(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(48)})),console});
 vm.runInContext(code,context);const voice=context.createVoiceConversation({send:send||(async()=>{events.push('send');return 'Привет'})});return {voice,node,events,timers};
}
test('Typed reply unlocks audio before asynchronous chat, then plays without microphone',async()=>{const app=setup();await app.voice.sendText('Привет');assert.ok(app.events.indexOf('audio-resume')<app.events.indexOf('send'));assert.ok(app.events.includes('play'));assert.equal(app.node('voice-panel').dataset.phase,'idle');assert.equal(app.timers.size,0)});
test('Disabling automatic voice sends chat without audio; manual replay remains available',async()=>{const app=setup({enabled:false});await app.voice.sendText('Привет');assert.deepEqual(app.events,['send']);await app.voice.read('Ответ');assert.ok(app.events.includes('play'))});
test('Stop while neural audio is pending prevents late playback and cleans timers',async()=>{let finish;const app=setup({request:()=>new Promise(resolve=>finish=resolve)});const pending=app.voice.read('Ответ');await new Promise(resolve=>setImmediate(resolve));app.voice.stop();finish({ok:true,arrayBuffer:async()=>new ArrayBuffer(48)});await pending;assert.equal(app.events.includes('play'),false);assert.equal(app.timers.size,0)});
test('Failed voice generation exposes an error while preserving the completed text response',async()=>{const app=setup({request:async()=>({ok:false,json:async()=>({error:'Голос временно недоступен'})})});await app.voice.sendText('Привет');assert.ok(app.events.includes('send'));assert.equal(app.node('voice-panel').dataset.phase,'error');assert.match(app.node('voice-status').textContent,/недоступен/);assert.equal(app.timers.size,0)});
