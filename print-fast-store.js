// FARUKH PRINT — bounded in-process read-through cache for verified cloud
// authorization. The bottleneck is remote storage reads, not Bluetooth.
//
// Security model:
// • The server still checks device + employee + approved catalog on EACH print.
// • Snapshots are never kept on the client's device.
// • Every successful owner write invalidates the corresponding snapshot.
// • All reads inside transactions bypass the cache, preventing stale writes.
// • Max snapshot age is 90 seconds, including if cloud refresh fails.
// • Background refresh is best-effort, stopping after kitchen inactivity.
// • An unavailable server cannot authorize printing (no offline fallback).
import {AsyncLocalStorage} from 'node:async_hooks';

const CLOUD_KEYS=new Set([
 'farukh-print-devices.json',
 'farukh-print-staff-sessions.json',
 'farukh-print-staff.json',
 'farukh-print-catalog.json'
]);
const MAX_AGE_MS=90_000;
const REFRESH_AFTER_MS=35_000;
const ACTIVE_FOR_MS=10*60_000;
const SWEEP_MS=35_000;
const clone=value=>value===undefined?undefined:structuredClone(value);

export function acceleratePrintStore(source){
 const transactionContext=new AsyncLocalStorage();
 const records=new Map();
 const generations=new Map();
 const invalidate=name=>{
  generations.set(name,(generations.get(name)||0)+1);
  records.delete(name);
 };
 const freshRead=(name,fallback)=>source.read(name,fallback);
 function refresh(name,fallback){
  let entry=records.get(name);
  if(entry?.inflight)return entry.inflight;
  const generation=generations.get(name)||0;
  const started=Date.now();
  const inFlight=Promise.resolve().then(()=>freshRead(name,fallback)).then(value=>{
   if((generations.get(name)||0)===generation){
    records.set(name,{value:clone(value),at:Date.now(),
     lastAccess:Math.max(started,entry?.lastAccess||started),inflight:null,fallback});
   }
   return clone(value);
  },error=>{
   // Do not continue serving a now-unverifiable snapshot after cloud loss.
   if((generations.get(name)||0)===generation)records.delete(name);
   throw error;
  });
  records.set(name,{...entry,inflight:inFlight,lastAccess:Date.now(),fallback});
  return inFlight;
 }
 const read=async(name,fallback)=>{
  if(!CLOUD_KEYS.has(name)||transactionContext.getStore())return freshRead(name,fallback);
  let item=records.get(name);
  const now=Date.now();
  if(item?.at && now-item.at<MAX_AGE_MS){
   item.lastAccess=now;
   if(now-item.at>REFRESH_AFTER_MS && !item.inflight)void refresh(name,item.fallback).catch(()=>{});
   return clone(item.value);
  }
  return clone(await refresh(name,fallback));
 };
 const timer=setInterval(()=>{
  const now=Date.now();
  for(const [name,item] of records){
   if(!item.at||item.inflight)continue;
   if(now-item.lastAccess>ACTIVE_FOR_MS){
    records.delete(name);
    continue;
   }
   if(now-item.at>=REFRESH_AFTER_MS)void refresh(name,item.fallback).catch(()=>{});
  }
 },SWEEP_MS);
 timer.unref?.(); // Tests and server shutdown must not hang on polling timer.
 return {
  ...source,
  read,
  readUncached:freshRead,
  async write(name,value){
   invalidate(name);
   try{return await source.write(name,value);}
   finally{invalidate(name);}
  },
  async transaction(fn){
   return source.transaction(()=>transactionContext.run(true,fn));
  },
  invalidate,
  cacheStats:()=>[...records].map(([name,e])=>({name,ageMs:e.at?Date.now()-e.at:null}))
 };
}
