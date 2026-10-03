(()=>{
  'use strict';
  const VOICE_ID='ru_RU-dmitri-medium';
  const PIPER_MODULE='https://esm.sh/@mintplex-labs/piper-tts-web@1.0.5';
  let modPromise=null;
  let audio=null;
  let piperState='ready';
  const nativeSpeak=window.speechSynthesis?.speak?.bind(window.speechSynthesis);
  const nativeCancel=window.speechSynthesis?.cancel?.bind(window.speechSynthesis);

  function setStatus(text){
    document.querySelectorAll('[data-piper-status]').forEach(el=>el.textContent=text);
  }

  async function getPiper(){
    if(!modPromise){
      piperState='loading';
      setStatus('Загрузка голосовой модели…');
      modPromise=import(PIPER_MODULE).then(m=>{piperState='ready';setStatus('Готов · бесплатно');return m}).catch(err=>{piperState='fallback';setStatus('Резервный голос устройства');throw err});
    }
    return modPromise;
  }

  async function piperSpeak(text, utterance){
    try{
      if(audio){try{audio.pause()}catch{} audio=null;}
      const tts=await getPiper();
      const blob=await tts.predict({text:String(text||'').replace(/[*#_`]/g,''),voiceId:VOICE_ID});
      audio=new Audio(URL.createObjectURL(blob));
      audio.onplay=()=>{try{utterance?.onstart?.(new Event('start'))}catch{}};
      audio.onended=()=>{try{utterance?.onend?.(new Event('end'))}catch{};try{URL.revokeObjectURL(audio.src)}catch{};audio=null};
      audio.onerror=()=>{try{utterance?.onerror?.(new Event('error'))}catch{};audio=null};
      await audio.play();
    }catch(err){
      console.warn('Piper TTS unavailable, using device voice',err);
      piperState='fallback';
      setStatus('Резервный голос устройства');
      if(nativeSpeak&&utterance) nativeSpeak(utterance);
    }
  }

  if(window.speechSynthesis&&nativeSpeak){
    try{
      window.speechSynthesis.speak=function(utterance){
        const text=utterance?.text||'';
        if(!text) return nativeSpeak(utterance);
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
    badge.innerHTML='Бесплатный локальный голос Piper. <b data-piper-status>Готов · бесплатно</b>. При первом ответе модель может загрузиться (~63 МБ), затем браузер её кэширует.';
    const label=card.querySelector('label');
    if(label) label.insertAdjacentElement('afterend',badge); else card.appendChild(badge);
    const help=[...card.querySelectorAll('.help')].find(x=>x.textContent.includes('Синхронизация губ'));
    if(help) help.textContent='Основная озвучка — Piper Dmitri. Если Piper не запустится на устройстве, автоматически используется бесплатный системный голос.';
    const labelText=card.querySelector('label');
    if(labelText) labelText.childNodes.forEach(n=>{if(n.nodeType===Node.TEXT_NODE&&n.textContent.includes('голосом устройства'))n.textContent=' Озвучивать ответы бесплатным голосом'});
  }

  const obs=new MutationObserver(enhanceUI);
  obs.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('DOMContentLoaded',()=>{enhanceUI();setTimeout(enhanceUI,300)});
})();
