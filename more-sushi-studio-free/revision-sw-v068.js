/* FARUKH REVISION PRO 0.6.8: offline app shell only, NOT private cloud data.
 * Intercepts only revision.html and its static assets. No Supabase REST/Auth
 * requests, workspace pages, other studio tools, or user information cached.
 */
const VERSION='0.6.8';
const CACHE='farukh-revision-offline-'+VERSION;
const CORE=[
 'revision.html','revision-integrity-v053.css','revision-integrity-v053.js',
 'revision-workflow-v054.css','revision-workflow-v054.js',
 'revision-fast-entry-v056.css','revision-fast-entry-v056.js',
 'revision-save-feedback-v057.css','revision-history-v064.css',
 'revision-store-table-v063.js','revision-chef-overview-v065.js',
 'revision-admin-v067.css','revision-admin-v067.js',
 'premium-motion.js','revision-neon-boot.css','revision-neon-boot.js',
 'farukh-revision-logo.svg'
];
const ALLOWED=new Set(CORE);
const appURL=new URL(self.registration.scope);
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  const outcomes=await Promise.allSettled(CORE.map(async file=>{
   const url=new URL(file,appURL).href;
   const res=await fetch(url,{cache:'reload'});
   if(!res.ok)throw Error(file+': HTTP '+res.status);
   await cache.put(url,res.clone());
  }));
  if(!outcomes.some((x,i)=>CORE[i]==='revision.html'&&x.status==='fulfilled'))
   throw Error('Missing the main offline page');
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('farukh-revision-offline-')&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
async function offlineFallback(cache,request,url){
 return await cache.match(request)||await cache.match(url.href,{ignoreSearch:true})||Response.error();
}
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==appURL.origin||!url.pathname.startsWith(appURL.pathname))return;
 const file=url.pathname.slice(appURL.pathname.length);
 if(!ALLOWED.has(file))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  if(file==='revision.html'){
   // Prefer fresh revision code when online; fall back immediately when offline.
   if(self.navigator?.onLine===false)return offlineFallback(cache,request,url);
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),1900);
   try{
    const response=await fetch(request,{signal:controller.signal});
    if(!response.ok)throw Error('HTTP '+response.status);
    await cache.put(request,response.clone()).catch(()=>{});
    return response;
   }catch{
    return offlineFallback(cache,request,url);
   }finally{clearTimeout(timer)}
  }
  const saved=await cache.match(request);
  if(saved)return saved;
  try{
   const res=await fetch(request);
   if(res.ok)await cache.put(request,res.clone()).catch(()=>{});
   return res;
  }catch{return offlineFallback(cache,request,url)}
 })());
});
