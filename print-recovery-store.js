import crypto from 'node:crypto';
import fs from 'node:fs';
import {httpError} from './assistant-store.js';
import * as photos from './public/farukh-print/catalog-photos.js';
import * as haccp from './public/farukh-print/haccp-catalog.js';
import * as ready from './public/farukh-print/ready-catalog.js';

// An explicitly enabled new generation leaves every old cloud file intact.
// Fresh envelopes prevent content deduplication onto an unreadable old blob.
export function createPrintRecoveryStore(source,initialProducts){
  const generation='20261024-v1',prefix='print-'+generation+'-';
  const manifest=prefix+'manifest.json';
  const initial={
    'farukh-print-catalog.json':{revision:1,products:initialProducts,appliedImports:[ready.version,photos.version,haccp.version],updatedAt:new Date().toISOString()},
    'farukh-print-devices.json':[], 'farukh-print-staff.json':[],
    'farukh-print-staff-sessions.json':[], 'farukh-print-staff-activity.json':[],
    'farukh-print-points.json':['Баумана 18','Плазма','Героев североморцев','Полярные зори']
  };
  let pending;
  const envelope=payload=>({format:'farukh-print-cloud-envelope-v1',nonce:crypto.randomUUID(),payload});
  const unpack=value=>{
    if(!value||value.format!=='farukh-print-cloud-envelope-v1'||!Object.hasOwn(value,'payload'))throw httpError(503,'Новая база не подтверждена.');
    return value.payload;
  };
  const checkName=name=>{if(!Object.hasOwn(initial,name))throw httpError(400,'Неизвестный файл базы печати.');return prefix+name};
  async function checkedWrite(name,payload){
    const wrapped=envelope(payload);
    await source.write(name,wrapped);
    const actual=await source.read(name,null);
    if(JSON.stringify(actual)!==JSON.stringify(wrapped))throw httpError(503,'Не удалось подтвердить запись новой базы.');
  }
  async function initialize(){
    const existing=await source.read(manifest,null);
    if(existing!==null){
      if(unpack(existing).generation!==generation)throw httpError(503,'Неверная версия новой базы.');
      // Never seed over an established generation, even if a file is missing.
      for(const name of Object.keys(initial))unpack(await source.read(checkName(name),null));
    }else{
      for(const [name,value] of Object.entries(initial))await checkedWrite(checkName(name),value);
      await checkedWrite(manifest,{generation});
    }
    console.info('[print-recovery] generation='+generation+' ready=true verifiedFiles=6');
  }
  const ensure=()=>pending||(pending=initialize().catch(e=>{pending=null;throw e}));
  return {
    storage:source.storage,
    ready:ensure,
    async read(name){await ensure();return unpack(await source.read(checkName(name),null))},
    async write(name,value){await ensure();await checkedWrite(checkName(name),value)},
    async transaction(fn){await ensure();return source.transaction(fn)}
  };
}

export function configuredPrintStore(source){
  if(process.env.FARUKH_PRINT_RECOVERY_GENERATION!=='20261024-v1')return source;
  if(source.storage!=='yandex')throw Error('Print recovery requires durable Yandex storage');
  const seed=JSON.parse(fs.readFileSync(new URL('./print-recovery-catalog.json',import.meta.url),'utf8'));
  const store=createPrintRecoveryStore(source,haccp.merge(photos.merge(ready.merge(seed))));
  void store.ready().catch(e=>console.error('[print-recovery] ready=false status='+(e.status||0)));
  return store;
}
