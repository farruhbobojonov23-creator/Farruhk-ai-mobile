import test from 'node:test';
import assert from 'node:assert/strict';
import {speakDeviceText,waitDeviceVoices,deviceChunks} from '../public/device-speech.js';
class Utterance{constructor(text){this.text=text}}
const a={name:'Русский A',lang:'ru-RU',localService:true},b={name:'Русский B',lang:'ru-RU',localService:true};
test('Device voices load asynchronously before selecting a voice',async()=>{
 let voices=[];const listeners=new Set();const synth={getVoices:()=>voices,addEventListener(_,fn){listeners.add(fn)},removeEventListener(_,fn){listeners.delete(fn)}};
 const pending=waitDeviceVoices(synth);voices=[a];for(const fn of listeners)fn();assert.deepEqual(await pending,[a]);assert.equal(listeners.size,0);
});
test('Failed Russian engine retries another installed voice with its matching language',async()=>{
 const heard=[],synth={getVoices:()=>[a,b],cancel(){},resume(){},speak(u){heard.push(u);queueMicrotask(()=>u.voice===a?u.onerror({error:'synthesis-failed'}):(u.onstart(),u.onend()))}};
 await speakDeviceText({synth,Utterance,text:'Фаррух Ака, я на связи.'});assert.equal(heard.length,2);assert.equal(heard[1].voice,b);assert.equal(heard[1].lang,b.lang);
});
test('Long device replies are split into bounded utterances without losing words',async()=>{
 const text='Проверить рис и маркировку. '.repeat(40).trim(),heard=[];
 const synth={getVoices:()=>[a],cancel(){},resume(){},speak(u){heard.push(u.text);queueMicrotask(()=>{u.onstart();u.onend()})}};
 await speakDeviceText({synth,Utterance,text});assert.ok(heard.every(t=>t.length<=170));assert.equal(heard.join(''),text);assert.deepEqual(deviceChunks(text),heard);
});
test('Speech that fails after starting is not duplicated with another voice',async()=>{
 let attempts=0;const synth={getVoices:()=>[a,b],cancel(){},resume(){},speak(u){attempts++;queueMicrotask(()=>{u.onstart();u.onerror({error:'synthesis-failed'})})}};
 await assert.rejects(()=>speakDeviceText({synth,Utterance,text:'Ответ'}),/Голос устройства не запустился/);assert.equal(attempts,1);
});
test('Stopping during voice loading removes pending events and rejects promptly',async()=>{
 const listeners=new Set(),controller=new AbortController();const synth={getVoices:()=>[],addEventListener(_,fn){listeners.add(fn)},removeEventListener(_,fn){listeners.delete(fn)}};
 const pending=waitDeviceVoices(synth,controller.signal);controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(listeners.size,0);
});
