import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('four A4 designs edit actual inputs in document; never create bottom modal',async()=>{
 const [onepage,inline,css,html]=await Promise.all([
  source('public/ttk-one-page-a4.js'),source('public/ttk-inline-a4-editor.js'),
  source('public/ttk-direct-inline.css'),source('public/index.html')
 ]);
 assert.doesNotMatch(onepage,/document\.createElement\('dialog'\)|showModal\(/);
 assert.match(onepage,/setEditing\(true,target\)/);
 assert.match(onepage,/target\.focus\(\{preventScroll:true\}\)/);
 assert.match(onepage,/return \{dialog:null/);
 assert.match(css,/pointer-events:auto!important/);
 assert.match(css,/\.ttk-live-name-sample\{\s*display:none!important/);
 assert.match(css,/\.ttk-live-name \.ttk-live-control/);
 assert.match(html,/ttk-direct-inline\.css\?v=1/);
 assert.match(inline,/marker\.setAttribute\('role','checkbox'\)/);
 assert.match(inline,/editor\.dataset\.allergenOverrides=JSON\.stringify\(overrides\)/);
});

test('all four stages and reference matrix tables are in-place editable and write canonical recipe',async()=>{
 const s=await source('public/ttk-reference-layouts.js');
 assert.match(s,/cell\.contentEditable='plaintext-only'/);
 for(const id of ['card-prep','technology','card-serving','card-appearance',
  'card-taste','card-storage','card-protein','card-fat','card-carbs','card-kcal','card-safety']){
  assert.ok(s.includes("'"+id+"'"),'missing canonical source '+id);
 }
 assert.match(s,/!qualityTable\.contains\(document\.activeElement\)/);
 assert.match(s,/!nutritionTable\.contains\(document\.activeElement\)/);
 assert.match(s,/!storageTable\.contains\(document\.activeElement\)/);
 assert.match(s,/if\(document\.activeElement!==stageCards\[i\]\)/);
 assert.match(s,/yieldPieces=node\('select'/);
 assert.match(s,/nutrition\.querySelector\('\.ttk-live-section-head'\)/);
});
