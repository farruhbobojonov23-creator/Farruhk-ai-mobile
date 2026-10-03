const CACHE='farrukh-ai-mobile-v3-4-yandex-disk';
const ASSETS=['/','/index.html','/style.css','/app.js','/manifest.webmanifest','/icon-192.svg','/icon-512.svg'];

const BUTTON_VOICE_PATCH=`
;(()=>{
  try{state.wakeWord=false;save();stopWakeWord(true);}catch(e){}
  try{
    const toggle=document.querySelector('#wakeWordToggle');
    if(toggle){toggle.checked=false;toggle.disabled=true;const label=toggle.closest('label');if(label)label.style.display='none';}
    const note=document.querySelector('.wake-note');
    if(note)note.textContent='Голосовой режим: нажми «Говорить». AI скажет «Слушаю, шеф» и начнёт слушать команду.';
  }catch(e){}

  const StableSR=window.SpeechRecognition||window.webkitSpeechRecognition;
  function startStableVoice(){
    try{state.wakeWord=false;save();stopWakeWord(true);}catch(e){}
    if(!StableSR){alert('Голосовой ввод лучше всего работает в Chrome на Android.');return;}

    const startMic=()=>{
      const r=new StableSR();
      r.lang='ru-RU';
      r.continuous=false;
      r.interimResults=false;
      const btn=document.querySelector('#talkBtn');
      if(btn)btn.textContent='🎙 Слушаю...';
      r.onresult=e=>{const text=e.results?.[0]?.[0]?.transcript||'';if(text)askAI(text);};
      r.onend=()=>{if(btn)btn.textContent='🎙 Говорить';};
      r.onerror=()=>{if(btn)btn.textContent='🎙 Говорить';};
      try{r.start();}catch(e){if(btn)btn.textContent='🎙 Говорить';}
    };

    if(state.tts && 'speechSynthesis' in window){
      speechSynthesis.cancel();
      const preset=voicePresets[voicePreset]||voicePresets.ai;
      const u=new SpeechSynthesisUtterance('Слушаю, шеф.');
      u.lang='ru-RU';
      const customRate=parseFloat(localStorage.getItem('farrukh_voice_rate')||'0');
      u.rate=customRate||preset.rate;
      u.pitch=preset.pitch;
      const chosen=getPreferredVoice(preset);if(chosen)u.voice=chosen;
      u.onend=startMic;
      u.onerror=startMic;
      speechSynthesis.speak(u);
    }else startMic();
  }

  const talk=document.querySelector('#talkBtn');if(talk)talk.onclick=startStableVoice;
  const wake=document.querySelector('#wakeBtn');if(wake)wake.onclick=startStableVoice;
})();`;

const YANDEX_UI_PATCH=`
;(()=>{
  const pathInput=document.querySelector('#yandexDiskPath');
  const saveBtn=document.querySelector('#saveYandexDiskPath');
  const statusEl=document.querySelector('#yandexDiskStatus');
  if(!pathInput||!saveBtn||!statusEl)return;

  const saved=localStorage.getItem('farrukh_yandex_disk_path')||pathInput.value||'/FARRUKH_AI_STORAGE/';
  pathInput.value=saved;

  let connectBtn=document.querySelector('#connectYandexDisk');
  if(!connectBtn){
    connectBtn=document.createElement('button');
    connectBtn.id='connectYandexDisk';
    connectBtn.className='primary';
    connectBtn.textContent='Подключить Яндекс Диск';
    connectBtn.style.marginTop='8px';
    saveBtn.insertAdjacentElement('afterend',connectBtn);
  }

  let backupBtn=document.querySelector('#backupYandexDisk');
  if(!backupBtn){
    backupBtn=document.createElement('button');
    backupBtn.id='backupYandexDisk';
    backupBtn.textContent='Сделать резервную копию';
    backupBtn.style.cssText='width:100%;margin-top:8px;padding:12px;border-radius:14px;border:1px solid #244036;background:#102019;color:#78ffad;font-weight:700;';
    connectBtn.insertAdjacentElement('afterend',backupBtn);
  }

  function setStatus(text,ok=false){
    statusEl.textContent=text;
    statusEl.style.color=ok?'#77ffab':'#f4c66a';
  }
  function path(){
    let p=(pathInput.value||'/FARRUKH_AI_STORAGE/').trim();
    if(!p.startsWith('/'))p='/'+p;
    if(!p.endsWith('/'))p+='/';
    return p;
  }

  saveBtn.onclick=()=>{
    const p=path();
    pathInput.value=p;
    localStorage.setItem('farrukh_yandex_disk_path',p);
    setStatus('Путь сохранён: '+p,true);
  };

  async function checkYandex(){
    try{
      setStatus('Проверяю подключение…');
      const r=await fetch('/api/yandex/status');
      const d=await r.json();
      if(d.connected){
        setStatus('Яндекс Диск подключён. Можно создавать папки и резервные копии.',true);
        connectBtn.textContent='Создать рабочие папки';
        return true;
      }
      if(d.reason==='token_missing'){
        setStatus('Нужен безопасный токен Яндекс Диска на сервере Render.');
        connectBtn.textContent='Яндекс Диск не авторизован';
        return false;
      }
      setStatus('Не удалось подключиться к Яндекс Диску: '+(d.error||'ошибка'));
      return false;
    }catch(e){
      setStatus('Ошибка связи с сервером.');
      return false;
    }
  }

  connectBtn.onclick=async()=>{
    const connected=await checkYandex();
    if(!connected){
      alert('Код приложения уже готов. Осталось один раз добавить OAuth-токен Яндекс Диска в Render как YANDEX_DISK_TOKEN. Токен нельзя хранить прямо в браузере — это небезопасно.');
      return;
    }
    try{
      connectBtn.disabled=true;
      connectBtn.textContent='Создаю папки…';
      const r=await fetch('/api/yandex/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({basePath:path()})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||'Ошибка');
      setStatus('Готово: '+d.basePath+' — Menus, Photos, TechCards, Reports, Backups.',true);
      connectBtn.textContent='Папки готовы ✓';
    }catch(e){
      setStatus('Ошибка: '+e.message);
      connectBtn.textContent='Повторить подключение';
    }finally{connectBtn.disabled=false;}
  };

  backupBtn.onclick=async()=>{
    try{
      backupBtn.disabled=true;
      backupBtn.textContent='Сохраняю…';
      const backup={
        createdAt:new Date().toISOString(),
        tasks:state.tasks||[],
        projects:state.projects||[],
        knowledge:state.knowledge||'',
        settings:{voicePreset:localStorage.getItem('farrukh_voice_preset')||'ai'}
      };
      const fileName='farrukh-ai-backup-'+new Date().toISOString().slice(0,10)+'.json';
      const r=await fetch('/api/yandex/upload-json',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({basePath:path(),folder:'Backups',fileName,data:backup})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||'Ошибка');
      setStatus('Резервная копия сохранена: '+d.path,true);
      backupBtn.textContent='Резервная копия готова ✓';
    }catch(e){
      setStatus('Не удалось сохранить копию: '+e.message);
      backupBtn.textContent='Сделать резервную копию';
    }finally{backupBtn.disabled=false;}
  };

  checkYandex();
})();`;

self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([
  self.clients.claim(),
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
])));
self.addEventListener('fetch',e=>{
  if(e.request.url.includes('/api/')) return;
  const url=new URL(e.request.url);
  if(url.origin===self.location.origin && url.pathname==='/app.js'){
    e.respondWith(fetch(e.request).then(async r=>{
      const text=await r.text();
      return new Response(text+'\n'+BUTTON_VOICE_PATCH+'\n'+YANDEX_UI_PATCH,{status:r.status,statusText:r.statusText,headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store'}});
    }).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{
    const copy=r.clone();
    caches.open(CACHE).then(c=>c.put(e.request,copy));
    return r;
  }).catch(()=>caches.match(e.request)));
});