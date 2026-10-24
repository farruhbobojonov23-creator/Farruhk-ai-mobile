import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {guidanceFor,reviewExisting,guidanceNames,REFERENCES} from '../public/farukh-print/shelf-life-guidance.js';

test('All 14 not-yet-approved preparation records have source-specific questions, never invented expiry',async()=>{
 const source=JSON.parse(await fs.readFile(new URL('../print-recovery-catalog.json',import.meta.url),'utf8'));
 const unchecked=source.filter(p=>p.kind==='prep'&&(p.needsReview===true||!p.hours||!p.storage));
 for(const p of unchecked){
  const ref=guidanceFor(p.name);
  assert.ok(ref,'missing guidance for '+p.name);
  assert.ok(ref.question.length>40);
  assert.ok(ref.example.length>45);
  assert.equal(ref.hours,undefined);
  assert.equal(ref.needsReview,undefined);
 }
 assert.ok(unchecked.length>=14);
 assert.ok(guidanceNames.length>=14);
 for(const item of REFERENCES)assert.match(item.url,/^https:\/\//);
});
test('Previously approved cabbage and shrimp have conditional safety references, not silent edits',()=>{
 assert.match(reviewExisting('Капуста').question,/12 ч/);
 assert.match(reviewExisting('Креветка').question,/12 ч/);
 assert.equal(guidanceFor('Омлет'),null);
});
test('UI cannot publish suggested expiry merely by viewing an example',async()=>{
 const source=await fs.readFile(new URL('../public/print-control.js',import.meta.url),'utf8');
 assert.match(source,/function showGuidance\(p\)/);
 assert.match(source,/Примеры не вносятся в этикетку автоматически/);
 assert.doesNotMatch(source,/commit\(.*guidanceFor/);
});
