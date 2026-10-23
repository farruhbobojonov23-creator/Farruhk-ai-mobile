// Fast, conservative PWA cache. A full download of 50+ assets during every
// release used to compete with Android WebView for network and CPU.
const CACHE='farrukh-arctic-sapphire-v63';
const CORE=['/','/index.html','/manifest.webmanifest','/icon-192.svg','/icon-512.svg'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE)
  .then(async cache=>{for(const url of CORE){try{await cache.add(url)}catch{/* offline upgrade: keep existing content */}}})
  .finally(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>event.waitUntil(Promise.all([
 self.clients.claim(),
 caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('farrukh-')&&k!==CACHE).map(k=>caches.delete(k))))
])));
const fallback=async request=>(await caches.match(request))||(request.mode==='navigate'?await caches.match('/index.html'):null)||
 new Response('Нет подключения. Откройте приложение при доступном интернете.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 const versioned=url.searchParams.has('v')&&/\.(?:js|css|svg|webp|png|jpg|jpeg)$/i.test(url.pathname);
 const save=async response=>{
  if(response.ok)event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,response.clone())).catch(()=>{}));
  return response;
 };
 if(versioned){
  // Asset URLs change with release numbers, so cached versions are safe.
  event.respondWith(caches.match(request).then(found=>found||fetch(request).then(save).catch(()=>fallback(request))));
 }else{
  // HTML and unversioned files must remain network-first to avoid stale code.
  event.respondWith(fetch(request).then(save).catch(()=>fallback(request)));
 }
});
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch{}e.waitUntil(self.registration.showNotification(d.title||'FARRUKH AI',{body:d.body||'Напоминание',tag:d.tag||'reminder',data:{url:'/?open=tasks'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus'in c){c.navigate('/?open=tasks');return c.focus()}}if(clients.openWindow)return clients.openWindow('/?open=tasks')}))});


