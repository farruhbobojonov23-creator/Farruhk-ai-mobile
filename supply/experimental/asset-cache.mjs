// Experimental cache for a version-pinned local OCR model pack.
// The signed web update must pin the manifest. No invoice or OCR result leaves the device.
export async function verifyBytes(bytes,expected){
 const a=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 if(a.byteLength!==expected.bytes)throw Error('Размер файла модели не совпадает');
 const digest=await crypto.subtle.digest('SHA-256',a);
 const hex=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 if(hex!==expected.sha256)throw Error('Контрольная сумма модели не совпадает');
 return a;
}
export function indexedCache(name='farukh-supply-models-v1'){
 let connection;
 const db=()=>connection??=new Promise((resolve,reject)=>{
  const r=indexedDB.open(name,1);
  r.onupgradeneeded=()=>r.result.createObjectStore('files');
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Кэш модели заблокирован'));
 }).catch(e=>{connection=null;throw e;});
 const op=async(mode,f)=>{const d=await db();return new Promise((resolve,reject)=>{
  const t=d.transaction('files',mode),r=f(t.objectStore('files'));
  t.oncomplete=()=>resolve(r.result);t.onerror=()=>reject(t.error||r.error);t.onabort=()=>reject(t.error||Error('Кэш модели недоступен'));
 });};
 return {get:k=>op('readonly',s=>s.get(k)),put:(k,v)=>op('readwrite',s=>s.put(v,k)),delete:k=>op('readwrite',s=>s.delete(k))};
}
export function createAssetReader(manifest,{cache,download,progress=()=>{}}){
 const pending=new Map();
 return async function read(name){
  const key=name.replace(/^\.\//,'');
  if(!Object.hasOwn(manifest.files,key))throw Error('Неизвестный файл модели');
  const spec=manifest.files[key],id=manifest.version+':'+key+':'+spec.sha256;
  if(pending.has(id))return pending.get(id);
  const job=(async()=>{
   let bytes=await cache.get(id);
   if(bytes){try{return await verifyBytes(bytes,spec)}catch{await cache.delete(id)}}
   progress(key);
   bytes=await verifyBytes(await download(key,spec),spec);
   await cache.put(id,bytes);
   return bytes;
  })().finally(()=>pending.delete(id));
  pending.set(id,job);
  return job;
 };
}
export function httpsDownloader(base){
 const root=new URL(base);
 if(root.protocol!=='https:')throw Error('Модели требуют HTTPS');
 return async(name,spec)=>{
  const target=new URL(name,root);
  if(target.origin!==root.origin||!target.pathname.startsWith(root.pathname))throw Error('Неверный адрес модели');
  const r=await fetch(target,{method:'GET',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error'});
  if(!r.ok)throw Error('Не удалось загрузить модель: '+r.status);
  const reader=r.body?.getReader();if(!reader)throw Error('Поток модели недоступен');
  const buffer=new Uint8Array(spec.bytes);let offset=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;if(offset+value.length>buffer.length)throw Error('Файл модели слишком большой');buffer.set(value,offset);offset+=value.length;}}finally{await reader.cancel().catch(()=>{});}
  if(offset!==spec.bytes)throw Error('Модель загружена не полностью');
  return buffer;
 };
}
