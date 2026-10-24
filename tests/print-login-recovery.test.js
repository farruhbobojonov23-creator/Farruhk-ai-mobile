import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile(new URL('../public/farukh-print/print-staff.js',import.meta.url),'utf8');
const recheck=source.slice(source.indexOf('async function recheck(){'),source.indexOf('async function signin('));
function harness(status){
 const removed=[];
 const call=async()=>{if(status)throw Object.assign(Error('unavailable'),{status});return {staff:{name:'Chef',point:'Kitchen'}}};
 const storage={removeItem:k=>removed.push(k)};
 const build=new Function('call','localStorage','sessionStorage',`
 let paired=true,session='saved-session',staff=null,rechecking=false,busy=false;
 const SESSION='session',tell=()=>{},paint=()=>{},flushResults=()=>{};
 ${recheck}
 return {run:recheck,state:()=>({session,staff,rechecking})};`);
 return {api:build(call,storage,storage),removed};
}
test('Temporary outage preserves session but does not grant employee access',async()=>{
 const {api,removed}=harness(503);await api.run();
 assert.equal(api.state().session,'saved-session');assert.equal(api.state().staff,null);assert.equal(api.state().rechecking,false);assert.deepEqual(removed,[]);
});
test('Invalid credentials still clear session; successful recovery restores identity',async()=>{
 const denied=harness(401);await denied.api.run();assert.equal(denied.api.state().session,'');assert.ok(denied.removed.length);
 const recovered=harness(0);await recovered.api.run();assert.equal(recovered.api.state().staff.name,'Chef');
});
