(()=>{
  'use strict';
  const VOICE_ID='ru_RU-dmitri-medium';
  const PIPER_MODULE='https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web/+esm';
  let modPromise=null;
  let audio=null;
  let piperState='idle';
  const nativeSpeak=window.speechSynthesis?.speak?.bind(window.speechSynthesis);
  const nativeCancel=window.speechSynthesis?.cancel?.bind(window.speechSynthesis);

  function setStatus(text){
    document.querySelectorAll('[data-piper-status]').forEach(el=>el.textContent=text);
  }
  function timeout(promise,ms,label='timeout'){
    return Promise.race([promise,new Promise((_,rej)=>setTimeout(()=>rej(new Error(label)),ms))]);
  }
  function nativeFallback(text, utterance){
    piperState='fallback';
    setStatus('Системный голос · бесплатно');
    if(!nativeSpeak) return;
    const u=utterance || new SpeechSynthesisUtterance(String(text||''));
    if(!u.lang)u.lang='ru-RU';
    try{nativeSpeak(u)}catch(e){console.warn('Native TTS failed',e)}
  }

  async function getPiper(){
    if(!modPromise){
      piperState='loading';
      setStatus('Подключение движка…');
      modPromise=timeout(import(PIPER_MODULE),12000,'Не загрузился модуль Piper').then(m=>{
        piperState='ready';setStatus('Движок готов');return m;
      }).catch(err=>{modPromise=null;throw err});
    }
    return modPromise;
  }

  async function piperSpeak(text, utterance){
    const clean=String(text||'').replace(/[*#_`]/g,'').trim();
    if(!clean)return;
    try{
      if(audio){try{audio.pause()}catch{} audio=null;}
      const tts=await getPiper();
      setStatus('Загрузка/подготовка голоса…');
      const wav=await timeout(tts.predict({text:clean,voiceId:VOICE_ID},p=>{
        if(p&&p.total){const pc=Math.max(0,Math.min(100,Math.round((p.loaded/p.total)*100)));setStatus(`Загрузка голоса ${pc}%`)}
      }),45000,'Piper не успел подготовить голос');
      const blob=wav instanceof Blob?wav:new Blob([wav],{type:'audio/wav'});
      const url=URL.createObjectURL(blob);
      audio=new Audio(url);
      audio.preload='auto';
      audio.onplay=()=>{piperState='playing';setStatus('Piper · говорит');try{utterance?.onstart?.(new Event('start'))}catch{}};
      audio.onended=()=>{piperState='ready';setStatus('Piper · готов');try{utterance?.onend?.(new Event('end'))}catch{};try{URL.revokeObjectURL(url)}catch{};audio=null};
      audio.onerror=()=>{try{URL.revokeObjectURL(url)}catch{};audio=null;nativeFallback(clean,utterance)};
      await timeout(audio.play(),8000,'Браузер заблокировал воспроизведение');
    }catch(err){
      console.warn('Piper TTS unavailable, using device voice',err);
      nativeFallback(clean,utterance);
    }
  }

  if(window.speechSynthesis&&nativeSpeak){
    try{
      window.speechSynthesis.speak=function(utterance){
        const text=utterance?.text||'';
        if(!text)return nativeSpeak(utterance);
        piperSpeak(text,utterance);
      };
      window.speechSynthesis.cancel=function(){
        if(audio){try{audio.pause()}catch{} audio=null;}
        nativeCancel?.();
      };
    }catch(err){console.warn('Cannot override speech synthesis',err)}
  }

  function enhanceUI(){
    const cards=[...document.querySelectorAll('.card')];
    const card=cards.find(c=>c.querySelector('h2')?.textContent?.includes('Подключения и голос'));
    if(!card||card.dataset.piperEnhanced)return;
    card.dataset.piperEnhanced='1';
    const aiMetric=card.querySelector('.metric');
    if(aiMetric){
      const voiceMetric=document.createElement('div');
      voiceMetric.className='metric';
      voiceMetric.innerHTML='<span>Голос</span><b>Piper · Dmitri</b>';
      aiMetric.insertAdjacentElement('afterend',voiceMetric);
    }
    const badge=document.createElement('p');
    badge.className='help';
    badge.innerHTML='Бесплатный Piper. Статус: <b data-piper-status>Не проверен</b>. При первом запуске модель загружается и сохраняется в браузере.';
    const label=card.querySelector('label');
    if(label)label.insertAdjacentElement('afterend',badge);else card.appendChild(badge);

    const test=document.createElement('button');
    test.type='button';test.className='secondary';test.textContent='▶ Проверить голос';
    test.style.marginTop='12px';
    test.onclick=()=>{
      setStatus('Проверка…');
      const u=new SpeechSynthesisUtterance('Фаррух Ака, голосовой помощник готов к работе.');
      u.lang='ru-RU';
      piperSpeak(u.text,u);
    };
    badge.insertAdjacentElement('afterend',test);

    const help=[...card.querySelectorAll('.help')].find(x=>x.textContent.includes('Синхронизация губ'));
    if(help)help.textContent='Основная озвучка — Piper Dmitri. Если Piper не запустится, автоматически включится бесплатный системный голос телефона.';
    const labelText=card.querySelector('label');
    if(labelText)labelText.childNodes.forEach(n=>{if(n.nodeType===Node.TEXT_NODE&&n.textContent.includes('голосом устройства'))n.textContent=' Озвучивать ответы бесплатным голосом'});
  }

  const obs=new MutationObserver(enhanceUI);
  obs.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('DOMContentLoaded',()=>{enhanceUI();setTimeout(enhanceUI,300)});
})();
