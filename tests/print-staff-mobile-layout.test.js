import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const load=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Staff point editor uses a full-width location group and responsive two-column layout',async()=>{
 const css=await load('public/print-control.css');
 const source=await load('public/print-control-staff.js');
 assert.match(source,/const editPoint=multiPointPicker\(\);editPoint\.render\(points,userPoints\(user\)\)/);
 assert.match(source,/editBox\.append\(editName,editLogin,editPoint\.box,saveBtn,cancel\)/);
 assert.match(source,/const pointLabel=el\('div','pstaff-field pstaff-point-field'\)/);
 assert.match(source,/box\.setAttribute\('role','group'\)/);
 assert.doesNotMatch(source,/box\.style\.cssText=/);
 assert.doesNotMatch(source,/label\.style\.cssText=/);
 assert.match(css,/#print-control \.pstaff-inline-edit > \.pstaff-point-checks\s*\{\s*grid-column:1\/-1/);
 assert.match(css,/#print-control \.pstaff-inline-edit\s*\{\s*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/#print-control \.pstaff-point-checks\s*\{\s*display:grid/);
 assert.match(css,/#print-control \.pstaff-point-option input\[type="checkbox"\]/);
 assert.match(css,/width:20px;\s*min-width:20px;\s*max-width:20px;\s*height:20px/);
 assert.match(css,/@media\(max-width:530px\)\{\s*#print-control \.pstaff-inline-edit\s*\{\s*grid-template-columns:minmax\(0,1fr\)/);
});

test('New owner CSS and staff controls are cache-busted',async()=>{
 const html=await load('public/index.html');
 assert.match(html,/print-control\.css\?v=18/);
 assert.match(html,/print-control-staff\.js\?v=9/);
});
