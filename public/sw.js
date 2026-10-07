const CACHE='farrukh-chef-v19';
const SHELL=['/','/index.html','/north.css?v=22.0','/north.js?v=22.0','/manifest.webmanifest','/icon-192.svg','/icon-512.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(SHELL.map(x=>c.add(x)))).finally(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('farrukh-')&&k!==CACHE).map(k=>caches.delete(k))))])));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok)e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,r.clone())));return r}).catch(async()=>await caches.match(e.request)||await caches.match(u.pathname)||new Response('Нет подключения. Откройте приложение при доступном интернете.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})));
});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus'in c)return c.focus()}if(clients.openWindow)return clients.openWindow('/')}))});
