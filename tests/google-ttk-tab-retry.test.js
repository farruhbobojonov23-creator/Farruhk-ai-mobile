import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/google-ttk.gs',import.meta.url),'utf8');
function harness(snapshots){
 let opened=0,closed=0;const waits=[];
 const context=vm.createContext({
  DocumentApp:{openById(id){assert.equal(id,'doc');const snapshot=snapshots[Math.min(opened++,snapshots.length-1)];
   return {getTab:id=>snapshot.direct?.(id)||null,getTabs:()=>snapshot.tabs||[],saveAndClose(){closed++}};}},
  Utilities:{sleep(ms){waits.push(ms)}}
 });
 vm.runInContext(source,context);
 return {context,waits,counts:()=>({opened,closed})};
}
const target={getId:()=> 'wanted',getChildTabs:()=>[],asDocumentTab:()=>({getBody:()=> 'correct-body'})};
test('receiver reopens a stale document until the newly created tab becomes visible',()=>{
 const h=harness([{}, {}, {direct:id=>id==='wanted'?target:null}]);
 assert.equal(h.context.openRecipeTab('doc','wanted').body,'correct-body');
 assert.deepEqual(h.counts(),{opened:3,closed:2});
 assert.deepEqual(h.waits,[250,500]);
});
test('receiver resolves the exact nested tab, never the first or active tab',()=>{
 const unrelated={getId:()=> 'other',getChildTabs:()=>[target],asDocumentTab(){throw Error('wrong tab')}};
 const h=harness([{tabs:[unrelated]}]);
 assert.equal(h.context.openRecipeTab('doc','wanted').body,'correct-body');
 assert.deepEqual(h.counts(),{opened:1,closed:0});
});
test('persistently missing tab fails safely after bounded retries without creating a duplicate',()=>{
 const h=harness([{}]);
 assert.throws(()=>h.context.openRecipeTab('doc','wanted'),/Google пока не открыл вкладку/);
 assert.deepEqual(h.counts(),{opened:5,closed:5});
 assert.deepEqual(h.waits,[250,500,1000,2000]);
});
test('invalid tab ID fails before opening or modifying a document',()=>{
 const h=harness([{}]);
 assert.throws(()=>h.context.openRecipeTab('doc',null),/идентификатор/);
 assert.deepEqual(h.counts(),{opened:0,closed:0});
});
test('sync uses safe tab resolution; project lookup closes DocumentApp before Docs API writes',()=>{
 assert.match(source,/const \{document,body\}=openRecipeTab\(documentId,tabId\)/);
 assert.match(source,/try\{DocumentApp\.openById\(documentId\)\.saveAndClose\(\)\}catch/);
 assert.match(source,/documentId=doc\.getId\(\);doc\.saveAndClose\(\)/);
});
