import test from 'node:test';
import assert from 'node:assert/strict';
import {recognizePhrase} from '../public/browser-recognition.js';
import {nearestReminder} from '../public/home-context.js';
import {parseWorkbenchCommand} from '../public/workbench-voice.js';
class Recognition {constructor(){Recognition.last=this}start(){}stop(){this.onend?.()}abort(){this.aborted=true}}
test('Recognition sends only final speech and detaches callbacks',async()=>{const s=recognizePhrase({Recognition});const r=Recognition.last;r.onresult({results:[Object.assign([{transcript:'открой журнал уборки'}],{isFinal:true})]});s.stop();assert.equal(await s.promise,'открой журнал уборки');assert.equal(r.onresult,null);assert.equal(r.aborted,true)});
test('Cancellation rejects pending speech and prevents late command delivery',async()=>{const c=new AbortController();const s=recognizePhrase({Recognition,signal:c.signal});const r=Recognition.last;c.abort();await assert.rejects(s.promise,{name:'AbortError'});assert.equal(r.onend,null)});
test('Permission denial is actionable',async()=>{const s=recognizePhrase({Recognition});Recognition.last.onerror({error:'not-allowed'});await assert.rejects(s.promise,/Разреши микрофон/)});
test('Reminder skips completed and invalid dates and prioritizes overdue',()=>{const tasks=[{text:'done',done:true,due:'2026-10-19T10:00:00Z'},{text:'invalid',due:'x'},{text:'next',due:'2026-10-22T10:00:00Z'},{text:'late',due:'2026-10-20T10:00:00Z'}];assert.equal(nearestReminder(tasks,Date.parse('2026-10-21')).task.text,'late');assert.equal(nearestReminder(tasks,Date.parse('2026-10-21')).overdue,true);assert.equal(nearestReminder([]),null)});
test('Journal command selects cleaning without filling records',()=>{assert.deepEqual(parseWorkbenchCommand('Открой журнал уборки'),{type:'journal',kind:'cleaning'});assert.deepEqual(parseWorkbenchCommand('Открой журнал температур'),{type:'journal',kind:'temperature'})});
