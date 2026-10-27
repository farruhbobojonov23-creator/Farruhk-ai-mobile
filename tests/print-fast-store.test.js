import test from 'node:test';
import assert from 'node:assert/strict';
import {acceleratePrintStore} from '../print-fast-store.js';

test('Online print validation reuses verified cloud data and transactions remain fresh',async()=>{
 const counts=new Map(),data=new Map([
  ['farukh-print-devices.json',[{id:'dev',revoked:false}]],
  ['farukh-print-staff-sessions.json',[{id:'session'}]],
  ['farukh-print-staff.json',[{id:'employee',active:true}]],
  ['farukh-print-catalog.json',{revision:1,products:[{id:'roll'}]}]
 ]);
 const source={storage:'yandex',
  read:async(name,fallback)=>{counts.set(name,(counts.get(name)||0)+1);return structuredClone(data.get(name)??fallback)},
  write:async(name,value)=>{data.set(name,structuredClone(value))},
  transaction:async(fn)=>fn()
 };
 const store=acceleratePrintStore(source);
 const names=[...data.keys()];
 for(const key of names)assert.ok(await store.read(key));
 for(const key of names)assert.ok(await store.read(key));
 for(const key of names)assert.equal(counts.get(key),1,'one backend read for '+key);
 const item=await store.read('farukh-print-staff.json');
 item[0].active=false; // Caller must not change cached verified identity.
 assert.equal((await store.read('farukh-print-staff.json'))[0].active,true);
 const fromTransaction=await store.transaction(async()=>store.read('farukh-print-staff.json'));
 assert.equal(fromTransaction[0].active,true);
 assert.equal(counts.get('farukh-print-staff.json'),2,'transaction bypasses cache');
 await store.write('farukh-print-staff.json',[{id:'employee',active:false}]);
 assert.equal((await store.read('farukh-print-staff.json'))[0].active,false,'revocation invalidates cache');
 assert.equal(counts.get('farukh-print-staff.json'),3);
 const fresh=await store.readUncached('farukh-print-staff.json');
 assert.equal(fresh[0].active,false);
 assert.equal(counts.get('farukh-print-staff.json'),4);
});

test('Fast cache preserves fail-closed behavior when online cloud lookup fails',async()=>{
 let fail=false,calls=0;
 const store=acceleratePrintStore({
  read:async()=>{calls++;if(fail)throw Error('Cloud unavailable');return [{id:'verified'}]},
  write:async()=>{},transaction:async fn=>fn()
 });
 assert.deepEqual(await store.read('farukh-print-devices.json'),[{id:'verified'}]);
 // Normal reads hit verified server-side RAM snapshot.
 assert.deepEqual(await store.read('farukh-print-devices.json'),[{id:'verified'}]);
 assert.equal(calls,1);
 // A fresh owner write invalidates the snapshot regardless of whether it succeeds.
 fail=true;
 await store.write('farukh-print-devices.json',[]);
 await assert.rejects(store.read('farukh-print-devices.json'),/Cloud unavailable/);
});
