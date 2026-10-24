import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrintRecoveryStore} from '../print-recovery-store.js';

function memory(){
 const data=new Map([['farukh-print-staff.json',[{id:'old-user'}]]]);
 return {data,storage:'yandex',read:async(n,f)=>structuredClone(data.has(n)?data.get(n):f),write:async(n,v)=>data.set(n,structuredClone(v)),transaction:async f=>f()};
}
test('Recovery preserves old generation and persists new users across restart',async()=>{
 const source=memory(),seed=[{id:'roll',name:'Ролл',photo:'test'}];
 const store=createPrintRecoveryStore(source,seed);await store.ready();
 assert.deepEqual(source.data.get('farukh-print-staff.json'),[{id:'old-user'}]);
 assert.deepEqual(await store.read('farukh-print-staff.json'),[]);
 assert.deepEqual((await store.read('farukh-print-catalog.json')).products,seed);
 await store.write('farukh-print-staff.json',[{id:'new-user'}]);
 const restarted=createPrintRecoveryStore(source,[]);await restarted.ready();
 assert.deepEqual(await restarted.read('farukh-print-staff.json'),[{id:'new-user'}]);
 assert.deepEqual((await restarted.read('farukh-print-catalog.json')).products,seed);
 source.data.delete('print-20261024-v1-farukh-print-staff.json');
 await assert.rejects(createPrintRecoveryStore(source,seed).ready(),{status:503});
});
test('Unreadable uploads cannot commit a recovery manifest or permit writes',async()=>{
 const source=memory();const originalRead=source.read;
 source.read=async(n,f)=>{if(source.data.has(n)&&n.startsWith('print-'))throw Object.assign(Error('cloud failure'),{status:502});return originalRead(n,f)};
 const store=createPrintRecoveryStore(source,[]);
 await assert.rejects(store.ready(),{status:502});
 assert.equal(source.data.has('print-20261024-v1-manifest.json'),false);
 assert.deepEqual(source.data.get('farukh-print-staff.json'),[{id:'old-user'}]);
});
