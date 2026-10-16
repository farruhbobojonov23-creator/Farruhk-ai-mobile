import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
// Only pinned public model chunks are proxied. Product photos remain in the browser.
export function installPhotoResources(app){
 const manifestPromise=fs.readFile(new URL('./public/vendor/background/resources.json',import.meta.url),'utf8').then(JSON.parse);
 const pending=new Map();
 app.get('/photo-resources/resources.json',async(req,res)=>{try{res.set('Cache-Control','public, max-age=86400').json(await manifestPromise)}catch{res.status(503).json({error:'Модель недоступна'})}});
 app.get('/photo-resources/:name',async(req,res)=>{
  const name=req.params.name;
  try{
   const manifest=await manifestPromise,chunk=Object.values(manifest).flatMap(v=>v.chunks).find(c=>c.name===name);
   if(!chunk||!/^[a-f0-9]{64}$/.test(name))return res.sendStatus(404);
   const file=path.join(os.tmpdir(),'farrukh-photo-model',name);
   try{await fs.access(file)}catch{
    if(!pending.has(name))pending.set(name,(async()=>{
     const response=await fetch('https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/'+name,{signal:AbortSignal.timeout(90000)});
     if(!response.ok)throw Error('Model download failed');
     const data=Buffer.from(await response.arrayBuffer());
     if(data.length!==chunk.offsets[1]-chunk.offsets[0]||crypto.createHash('sha256').update(data).digest('hex')!==chunk.hash)throw Error('Model chunk integrity check failed');
     await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data);
    })().finally(()=>pending.delete(name)));
    await pending.get(name);
   }
   res.set('Cache-Control','public, max-age=31536000, immutable');res.type('application/octet-stream');res.sendFile(file);
  }catch(e){console.error('[photo-model]',e.message);res.status(503).json({error:'Не удалось загрузить AI-модель. Повтори обработку при стабильном интернете.'})}
 });
}
