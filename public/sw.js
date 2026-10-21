const CACHE='farrukh-arctic-sapphire-v21';
const SHELL=['/home-context.js?v=76','/browser-recognition.js?v=76','/chef-voice.js?v=77','/workbench-voice.js?v=76','/preparation-board.js?v=67','/device-store.js?v=67','/','/index.html','/unified-ruby.css?v=76','/arctic-sapphire.css?v=2','/arctic-workspace.css?v=2','/arctic-home-finish.css?v=2','/arctic-approved-orb.css?v=1','/arctic-contrast-fix.css?v=1','/google-backup.js?v=3','/google-backup.css?v=1','/arctic-dialogs.css?v=2','/google-backup-setup.html','/google-backup.gs','/arctic-glass-orb.svg','/unified-workspace.js?v=68','/ruby-studio.js?v=78','/recipe-sheet.js?v=65','/haccp-ui.js?v=84','/temperature-grid-ui.js?v=68','/haccp-template-drafts.js?v=2','/haccp-auto-journals.js?v=2','/haccp-paper-layout.js?v=1','/haccp-paper-premium.css?v=5','/haccp-schedule.js?v=1','/haccp-plan.css?v=1','/temperature-grid-ui.js?v=65','/manifest.webmanifest','/icon-192.svg','/icon-512.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(SHELL.map(x=>c.add(x)))).finally(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('farrukh-')&&k!==CACHE).map(k=>caches.delete(k))))])));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok)e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,r.clone())));return r}).catch(async()=>await caches.match(e.request)||await caches.match(u.pathname)||new Response('Нет подключения. Откройте приложение при доступном интернете.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})));
});
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch{}e.waitUntil(self.registration.showNotification(d.title||'FARRUKH AI',{body:d.body||'Напоминание',tag:d.tag||'reminder',data:{url:'/?open=tasks'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus'in c){c.navigate('/?open=tasks');return c.focus()}}if(clients.openWindow)return clients.openWindow('/?open=tasks')}))});

