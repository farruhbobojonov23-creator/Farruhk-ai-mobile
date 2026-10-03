const CACHE='farrukh-ai-mobile-v3-3-push-to-talk';
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
      return new Response(text+'\n'+BUTTON_VOICE_PATCH,{status:r.status,statusText:r.statusText,headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store'}});
    }).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{
    const copy=r.clone();
    caches.open(CACHE).then(c=>c.put(e.request,copy));
    return r;
  }).catch(()=>caches.match(e.request)));
});