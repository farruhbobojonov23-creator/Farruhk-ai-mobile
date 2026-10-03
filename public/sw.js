const CACHE='farrukh-ai-mobile-v3-1-wakeword-live';
const ASSETS=['/','/index.html','/style.css','/app.js','/manifest.webmanifest','/icon-192.svg','/icon-512.svg'];

const WAKE_PATCH = String.raw`
;(()=>{
  const KEY='farrukh_wake_enabled';
  const WakeSR=window.SpeechRecognition||window.webkitSpeechRecognition;
  let rec=null,restartTimer=null,wanted=localStorage.getItem(KEY)==='true',mutedUntil=0;

  function hasWake(t){
    t=String(t||'').toLowerCase();
    return ['фаррух ai','фаррух аи','фаррух эй ай','фаррук ai','фарух ai'].some(x=>t.includes(x));
  }
  function stripWake(t){
    return String(t||'')
      .replace(/фаррух\s*эй\s*ай/ig,'')
      .replace(/фаррух\s*аи/ig,'')
      .replace(/фаррух\s*ai/ig,'')
      .replace(/фаррук\s*ai/ig,'')
      .replace(/фарух\s*ai/ig,'')
      .replace(/^[,.:;!?\s-]+/,'').trim();
  }
  function setVisual(on){
    document.body.classList.toggle('wake-listening',!!on);
    const s=document.getElementById('wakeStatus');
    if(s)s.textContent=on?'Слушаю фразу «Фаррух AI»':'Ожидание';
  }
  function schedule(ms=700){
    clearTimeout(restartTimer);
    if(!wanted||document.hidden)return;
    restartTimer=setTimeout(()=>{
      if(Date.now()<mutedUntil){schedule(mutedUntil-Date.now()+250);return;}
      try{rec&&rec.start()}catch(e){}
    },ms);
  }
  function stop(permanent=false){
    if(permanent)wanted=false;
    clearTimeout(restartTimer);
    try{rec&&rec.stop()}catch(e){}
    setVisual(false);
  }
  function answerCommand(cmd){
    if(!cmd){
      if(typeof speak==='function')speak('Слушаю.');
      schedule(1200);
      return;
    }
    if(typeof askAI==='function')askAI(cmd);
  }
  function start(){
    if(!WakeSR){
      alert('Постоянное распознавание речи не поддерживается в этом браузере. Открой FARRUKH AI в Chrome на Android.');
      wanted=false;localStorage.setItem(KEY,'false');syncToggle();return;
    }
    wanted=true;localStorage.setItem(KEY,'true');
    if(!rec){
      rec=new WakeSR();
      rec.lang='ru-RU';
      rec.continuous=true;
      rec.interimResults=true;
      rec.maxAlternatives=1;
      rec.onstart=()=>setVisual(true);
      rec.onend=()=>{setVisual(false);schedule();};
      rec.onerror=e=>{
        setVisual(false);
        if(e.error==='not-allowed'||e.error==='service-not-allowed'){
          wanted=false;localStorage.setItem(KEY,'false');syncToggle();
          alert('Разреши доступ к микрофону для FARRUKH AI.');
          return;
        }
        schedule(1200);
      };
      rec.onresult=e=>{
        if(Date.now()<mutedUntil)return;
        let heard='';
        for(let i=e.resultIndex;i<e.results.length;i++)heard+=(e.results[i][0].transcript||'')+' ';
        heard=heard.trim();
        if(!heard||!hasWake(heard))return;
        const cmd=stripWake(heard);
        try{rec.stop()}catch(err){}
        setTimeout(()=>answerCommand(cmd),120);
      };
    }
    try{rec.start()}catch(e){schedule();}
  }
  function syncToggle(){
    const t=document.getElementById('wakeWordToggle');
    if(t)t.checked=wanted;
    const s=document.getElementById('wakeStatus');
    if(s)s.textContent=wanted?'Включено':'Выключено';
  }
  function addUI(){
    if(document.getElementById('wakeWordToggle')){syncToggle();return;}
    const settings=document.querySelector('.settings');
    if(!settings)return;
    const style=document.createElement('style');
    style.textContent='.wake-listening{box-shadow:inset 0 0 0 1px rgba(80,255,150,.16)} .wake-note{font-size:11px;color:#7f9098;line-height:1.45;margin:-6px 0 10px}';
    document.head.appendChild(style);
    const wrap=document.createElement('div');
    wrap.innerHTML='<div class="line"><span>Фраза пробуждения</span><b id="wakeStatus">'+(wanted?'Включено':'Выключено')+'</b></div><label>Слушать «Фаррух AI» <input id="wakeWordToggle" type="checkbox" '+(wanted?'checked':'')+'></label><div class="wake-note">Работает, пока приложение открыто и экран активен. Скажи: «Фаррух AI, что у меня сегодня по задачам?»</div>';
    settings.appendChild(wrap);
    document.getElementById('wakeWordToggle').onchange=e=>{
      wanted=e.target.checked;
      localStorage.setItem(KEY,String(wanted));
      if(wanted)start();else stop(true);
      syncToggle();
    };
  }

  if(typeof speak==='function'){
    const originalSpeak=speak;
    speak=function(text){
      mutedUntil=Date.now()+Math.min(12000,1800+String(text||'').length*45);
      try{rec&&rec.stop()}catch(e){}
      originalSpeak(text);
      schedule(Math.max(1500,mutedUntil-Date.now()+250));
    };
  }

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){try{rec&&rec.stop()}catch(e){};setVisual(false);}
    else if(wanted)schedule(500);
  });

  setTimeout(()=>{
    addUI();
    if(wanted)start();
  },0);
})();
`;

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener('activate',e=>e.waitUntil(Promise.all([
  self.clients.claim(),
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
])));

self.addEventListener('fetch',e=>{
  if(e.request.url.includes('/api/'))return;

  const url=new URL(e.request.url);
  if(url.pathname==='/app.js'){
    e.respondWith(
      fetch(e.request).then(async r=>{
        const original=await r.text();
        const headers=new Headers(r.headers);
        headers.delete('content-length');
        headers.delete('content-encoding');
        const patched=new Response(original+'\n'+WAKE_PATCH,{status:r.status,statusText:r.statusText,headers});
        caches.open(CACHE).then(c=>c.put(e.request,patched.clone()));
        return patched;
      }).catch(()=>caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    fetch(e.request).then(r=>{
      const copy=r.clone();
      caches.open(CACHE).then(c=>c.put(e.request,copy));
      return r;
    }).catch(()=>caches.match(e.request))
  );
});
