import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('public/index.html'),workspace=read('public/premium-workspace.js');
const royal=read('public/premium-royal-v2.js'),health=read('public/system-health.js');
const editor=read('public/site-visual-editor.js');
test('misleading ULTRA ADMIN category and every navigation link are removed',()=>{
 for(const source of [html,workspace,royal,health]){
  assert.doesNotMatch(source,/ultra-admin|ULTRA ADMIN|mountUltraAdmin/i);
 }
});
test('actual visual editor launches from existing owner settings',()=>{
 assert.match(html,/site-visual-editor\.css\?v=1/);
 assert.match(workspace,/mountVisualEditor/);
 assert.match(workspace,/Редактировать на экране/);
 assert.match(workspace,/visualEditor\?\.open\(\)/);
 assert.match(html,/await requireOwner\(\)/);
 assert.ok(html.indexOf('await requireOwner()')<html.indexOf('mountPremiumWorkspace({show,'));
});
test('real editing controls are wired to live DOM, reversible and stored',()=>{
 for(const token of ['selectFrom(event)','event.preventDefault()','stopImmediatePropagation()',
  "getRecord(selectedKey)","fontSize:'font-size'","fontFamily:'font-family'",
  "borderRadius:'border-radius'","r.label=name.value","r.hidden=!r.hidden",
  "r.styles[key]=control.value","localStorage.setItem(STORAGE_KEY,value)",
  "function cancel()","function restore(el)","applyRecords(draft)","Восстановить",
  "Сбросить все изменения","CSS.escape(root.id)"]){
  assert.ok(editor.includes(token),'Missing editing behavior: '+token);
 }
 assert.match(editor,/Коснитесь элемента/);
 assert.doesNotMatch(editor,/eval\(/);
});
test('the visual editor does not edit recipe forms or printed documents',()=>{
 assert.match(editor,/input,textarea,select,form,dialog,#editor/);
 assert.match(read('public/site-visual-editor.css'),/@media print/);
});
