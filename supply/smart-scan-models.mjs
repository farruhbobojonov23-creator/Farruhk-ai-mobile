// Experimental local-only model-pack bootstrap. No invoice bytes are sent to any endpoint.
// The signed web code pins each asset by exact size + SHA-256. Cache is separate from invoices.
const version='ocr5-cyrillic-ort1.31.1';
const npm='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/';
const hf='https://huggingface.co/PaddlePaddle/';
export const MODEL_PACK=Object.freeze({
 'ort.wasm.min.mjs':{url:npm+'ort.wasm.min.mjs',size:53725,sha256:'c21d9c326d453a4a61398270c804d5979e118540597cb0c07f7b3d64e6098234'},
 'ort-wasm-simd-threaded.mjs':{url:npm+'ort-wasm-simd-threaded.mjs',size:24738,sha256:'30ed0b5cd1182ede931fea448afb567d4dc705ec957af09f108a2be5f770dac3'},
 'ort-wasm-simd-threaded.wasm':{url:npm+'ort-wasm-simd-threaded.wasm',size:14848852,sha256:'4b884c203b0fa48d057be3332c65513ff85aa3c5bddd6946acc0fab7ecda001d'},
 'det.onnx':{url:hf+'PP-OCRv5_mobile_det_onnx/resolve/main/inference.onnx',size:4826518,sha256:'a431985659dc921974177a95adcfbb90fd9e51989a5e04d70d0b75f597b6e61d'},
 'rec.onnx':{url:hf+'cyrillic_PP-OCRv5_mobile_rec_onnx/resolve/main/inference.onnx',size:8048799,sha256:'5371ee1ddaa7983cc62d0818d99e982b6804638c85e4f960d59a574094e172e5'},
 'rec.yml':{url:hf+'cyrillic_PP-OCRv5_mobile_rec_onnx/resolve/main/inference.yml',size:6991,sha256:'5c76cc91fa98410178a09f498db10050d0ec1634a660053d3005ab7be581f501'}
});
export const MODEL_PACK_BYTES=Object.values(MODEL_PACK).reduce((a,b)=>a+b.size,0);
const hex=buf=>Array.from(new Uint8Array(buf),b=>b.toString(16).padStart(2,'0')).join('');
export async function verifyAsset(name,bytes){
 const spec=MODEL_PACK[name];if(!spec||bytes.byteLength!==spec.size||hex(await crypto.subtle.digest('SHA-256',bytes))!==spec.sha256)throw Error('Неверная контрольная сумма модели: '+name);
 return bytes;
}
export async function readModelPack({progress=()=>{},fetchAsset=(name,spec)=>fetch(spec.url,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'}),offline=false}={}){
 if(!globalThis.crypto?.subtle||!globalThis.WebAssembly)throw Error('WebView не поддерживает защищённую загрузку моделей');
 const cache=await caches.open('farukh-supply-models-'+version);const result={};let loaded=0;
 for(const [name,spec] of Object.entries(MODEL_PACK)){
  const key=new Request(new URL('/__farukh_models__/'+version+'/'+name,location.origin));
  let bytes;const saved=await cache.match(key);
  if(saved){try{bytes=await verifyAsset(name,await saved.arrayBuffer())}catch{await cache.delete(key)}}
  if(!bytes){if(offline)throw Error('Модель ещё не установлена: '+name);const res=await fetchAsset(name,spec);if(!res.ok)throw Error('Загрузка модели: '+name+' HTTP '+res.status);bytes=await verifyAsset(name,await res.arrayBuffer());await cache.put(key,new Response(bytes));}
  result[name]=bytes;loaded+=spec.size;progress({name,loaded,total:MODEL_PACK_BYTES});
 }
 return result;
}
export async function openModelSessions(pack){
 for(const [name,bytes] of Object.entries(pack))await verifyAsset(name,bytes);
 if(Object.keys(MODEL_PACK).some(n=>!pack[n]))throw Error('Неполный комплект моделей');
 const urls=[];const url=(name,mime)=>{const u=URL.createObjectURL(new Blob([pack[name]],{type:mime}));urls.push(u);return u;};
 try{
  const ort=await import(url('ort.wasm.min.mjs','text/javascript'));
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.logLevel='error';
  ort.env.wasm.wasmPaths={mjs:url('ort-wasm-simd-threaded.mjs','text/javascript')};
  ort.env.wasm.wasmBinary=pack['ort-wasm-simd-threaded.wasm'];
  const options={executionProviders:['wasm'],logSeverityLevel:3};
  let det,rec;try{det=await ort.InferenceSession.create(new Uint8Array(pack['det.onnx']),options);rec=await ort.InferenceSession.create(new Uint8Array(pack['rec.onnx']),options)}catch(e){if(det)await det.release();throw e;}
  return{ort,det,rec,dictionaryYaml:new TextDecoder().decode(pack['rec.yml']),dispose:async()=>{try{await Promise.all([det.release(),rec.release()])}finally{urls.forEach(u=>URL.revokeObjectURL(u))}}};
 }catch(e){urls.forEach(u=>URL.revokeObjectURL(u));throw e;}
}
