/* SHEF AI PREMIUM - public assets only. Never cache Supabase, authentication or private API responses. */
const ASSET_CACHE='shef-ai-public-assets-spatial-20261114-v2';
const OFFLINE_PAGE='./offline.html';
const SHELL_FILES=[OFFLINE_PAGE,'./manifest.webmanifest','./icons/shef-ai-192.svg','./icons/shef-ai-512.svg','./icons/shef-ai-192.png','./icons/shef-ai-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(ASSET_CACHE).then(cache=>cache.addAll(SHELL_FILES)));
});
self.addEventListener('activate',event=>{
 event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('shef-ai-public-assets-')&&k!==ASSET_CACHE).map(k=>caches.delete(k)))),
  self.clients.claim()
 ]));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 // Auth, database, tokens and anything outside our own site must remain network-only.
 if(url.origin!==self.location.origin)return;
 // Navigation: never cache any logged-in HTML or sensitive response.
 if(req.mode==='navigate'){
  event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match(OFFLINE_PAGE)));
  return;
 }
 // Only static app assets; avoid caching dynamic service requests and browser auth traffic.
 if(!/\.(?:css|js|svg|png|webp|woff2?|ico)$/i.test(url.pathname))return;
 event.respondWith(fetch(req).then(response=>{
  if(response.ok&&response.type==='basic'){
   const copy=response.clone();
   event.waitUntil(caches.open(ASSET_CACHE).then(cache=>cache.put(req,copy)).catch(()=>{}));
  }
  return response;
 }).catch(()=>caches.match(req).then(hit=>hit||Response.error())));
});
