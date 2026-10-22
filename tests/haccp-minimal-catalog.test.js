import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {journalCards,journalGroups,journalIcon,russianRecordCount,russianJournalCount} from '../public/haccp-catalog-v2.js';
import {journalTypes} from '../public/haccp-model.js';

test('Minimal catalogue preserves all journal types and exactly one card for each',()=>{
 const keys=journalGroups.flatMap(x=>x.kinds);
 assert.equal(keys.length,Object.keys(journalTypes).length);
 assert.deepEqual([...new Set(keys)].sort(),Object.keys(journalTypes).sort());
 for(const kind of keys){
  assert.ok(journalCards[kind]?.description,kind+' missing description');
  assert.match(journalIcon(journalCards[kind].icon),/^<svg /,kind+' missing SVG icon');
 }
});
test('Russian record and section counter declension is correct',()=>{
 assert.equal(russianRecordCount(0),'0 записей');
 assert.equal(russianRecordCount(1),'1 запись');
 assert.equal(russianRecordCount(2),'2 записи');
 assert.equal(russianRecordCount(6),'6 записей');
 assert.equal(russianRecordCount(11),'11 записей');
 assert.equal(russianRecordCount(21),'21 запись');
 assert.equal(russianJournalCount(3),'3 журнала');
 assert.equal(russianJournalCount(4),'4 журнала');
});
test('Minimal design is isolated from A4 journal forms and downloaded data',()=>{
 const css=readFileSync(new URL('../public/haccp-minimal-v2.css',import.meta.url),'utf8');
 assert.match(css,/\[data-haccp-view="catalog"\]/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(css,/\.haccp-sheet\b|\.haccp-a4-table\b|\.haccp-record\b/);
 const js=readFileSync(new URL('../public/haccp-ui.js',import.meta.url),'utf8');
 assert.match(js,/for\(const group of journalGroups\)/);
 assert.match(js,/card\.dataset\.journal=kind/);
 assert.match(js,/tab=kind;build\(\)/);
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(html,/haccp-minimal-v2\.css\?v=3/);
 assert.match(html,/haccp-ui\.js\?v=107/);
});
