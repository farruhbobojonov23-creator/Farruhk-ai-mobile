import test from 'node:test';
import assert from 'node:assert/strict';
import {generateTemperatureSamples as generate} from '../public/temperature-generator.js';
import {validateHaccp,emptyHaccp,mergeHaccp} from '../public/haccp-model.js';
const equipment=[{id:'e',pointId:'p',name:'Холодильник',min:2,max:6}];
test('inclusive date range, decimal bounds and persistent sample provenance',()=>{
 const samples=generate({from:'2026-02-27',to:'2026-03-01',equipment,random:()=>0});
 assert.equal(samples.length,3);assert.equal(samples[2].day,'2026-03-01');assert.ok(samples.every(s=>s.value===2&&s.source==='sample'));
 const h=emptyHaccp();h.personalTemperatureSamples=samples;assert.deepEqual(validateHaccp(h).personalTemperatureSamples,samples);assert.equal(h.records.length,0);
});
test('saved examples and measured days never overwritten',()=>{
 const samples=generate({from:'2026-10-01',to:'2026-10-03',equipment,samples:[{equipmentId:'e',day:'2026-10-01'}],records:[{kind:'temperature',at:'2026-10-01T22:00:00Z',details:{equipmentId:'e'}}],random:()=>1});
 assert.equal(samples.length,1);assert.equal(samples[0].day,'2026-10-03');assert.equal(samples[0].value,6);
});
test('invalid dates, inverted ranges and unconfigured equipment rejected',()=>{
 for(const options of [{from:'2026-02-30',to:'2026-03-01'},{from:'2026-03-02',to:'2026-03-01'},{from:'2025-01-01',to:'2026-12-01'}])assert.throws(()=>generate({...options,equipment}));
 assert.throws(()=>generate({from:'2026-01-01',to:'2026-01-01',equipment:[{...equipment[0],min:null}]}));
});

test('backup merge restores samples without duplicates or factual records',()=>{
 const h=emptyHaccp();h.personalTemperatureSamples=generate({from:'2026-01-01',to:'2026-01-02',equipment});
 const restored=mergeHaccp(emptyHaccp(),h);assert.deepEqual(restored.personalTemperatureSamples,h.personalTemperatureSamples);assert.equal(mergeHaccp(restored,h).personalTemperatureSamples.length,2);assert.equal(restored.records.length,0);
});
