function aborted(){return new DOMException('Озвучивание остановлено','AbortError')}
export async function waitDeviceVoices(synth,signal){
 if(signal?.aborted)throw aborted();
 const ready=synth.getVoices()||[];if(ready.length)return ready;
 return new Promise((resolve,reject)=>{
  let timer;
  const cleanup=()=>{clearTimeout(timer);synth.removeEventListener?.('voiceschanged',changed);signal?.removeEventListener('abort',cancel)};
  const changed=()=>{const voices=synth.getVoices()||[];if(voices.length){cleanup();resolve(voices)}};
  const cancel=()=>{cleanup();reject(aborted())};
  synth.addEventListener?.('voiceschanged',changed);signal?.addEventListener('abort',cancel,{once:true});
  timer=setTimeout(()=>{cleanup();resolve(synth.getVoices()||[])},1800);changed();
 });
}
export function deviceChunks(text){
 const cleaned=String(text).replace(/[*#_`]/g,'').trim(),chunks=[];let rest=cleaned;
 while(rest.length){let cut=Math.min(rest.length,170);if(rest.length>cut){const prefix=rest.slice(0,cut),match=[...prefix.matchAll(/[.!?;:]\s+/g)].pop();const space=prefix.lastIndexOf(' ');if(match&&match.index>30)cut=match.index+match[0].length;else if(space>30)cut=space+1}chunks.push(rest.slice(0,cut));rest=rest.slice(cut)}
 return chunks;
}
function speakOnce({synth,Utterance,text,voice,signal,onLevel}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(aborted());
  let done=false,started=false,startTimer,resumeTimer,endTimer;
  const u=new Utterance(text);u.lang=voice?.lang||'ru-RU';if(voice)u.voice=voice;u.rate=.98;u.pitch=1;u.volume=1;
  function finish(error){if(done)return;done=true;clearTimeout(startTimer);clearTimeout(resumeTimer);clearTimeout(endTimer);signal?.removeEventListener('abort',cancel);u.onstart=u.onend=u.onerror=u.onboundary=null;onLevel?.(0);if(error){error.started=started;reject(error)}else resolve()}
  function cancel(){finish(aborted());synth.cancel()}
  u.onstart=()=>{started=true;clearTimeout(startTimer);onLevel?.(.18)};
  u.onboundary=()=>onLevel?.(.35);
  u.onend=()=>finish();u.onerror=e=>{const error=Error(e.error||'synthesis-failed');error.code=e.error;finish(error)};
  signal?.addEventListener('abort',cancel,{once:true});
  startTimer=setTimeout(()=>{const error=Error('synthesis-timeout');error.code='synthesis-timeout';finish(error);synth.cancel()},7000);
  endTimer=setTimeout(()=>{const error=Error('synthesis-timeout');error.code='synthesis-timeout';finish(error);synth.cancel()},45000);
  try{synth.resume?.();synth.speak(u);if(!done)resumeTimer=setTimeout(()=>{if(!done)synth.resume?.()},200)}catch(error){finish(error)}
 });
}
export async function speakDeviceText({synth,Utterance,text,signal,onLevel,onVoice}){
 if(!synth||!Utterance)throw Error('Браузер не поддерживает голос устройства. Открой приложение в другом браузере.');
 const voices=await waitDeviceVoices(synth,signal);
 if(signal?.aborted)throw aborted();
 if(!voices.length)throw Error('Браузер не видит установленные голоса. Добавь русский голос в настройках речи Windows и перезапусти браузер.');
 const ru=v=>/^ru(?:-|_|$)/i.test(v.lang||'');
 const ordered=[...voices.filter(v=>ru(v)&&v.localService),...voices.filter(v=>ru(v)&&!v.localService),...voices.filter(v=>v.localService&&v.default),...voices.filter(v=>v.localService)];
 const candidates=[...new Set(ordered)].slice(0,4);
 if(!candidates.length)candidates.push(...voices.filter(v=>v.default),voices[0]);
 let selected=null;
 for(const chunk of deviceChunks(text)){
  if(signal?.aborted)throw aborted();let lastError=null,spoken=false;
  const attempts=selected?[selected,...candidates.filter(v=>v!==selected)]:candidates;
  for(const voice of attempts){
   if(signal?.aborted)throw aborted();synth.cancel();synth.resume?.();
   try{onVoice?.(voice.name);await speakOnce({synth,Utterance,text:chunk,voice,signal,onLevel});selected=voice;spoken=true;break}catch(error){
    lastError=error;if(error.name==='AbortError')throw error;
    if(error.started||['not-allowed','audio-hardware'].includes(error.code))break;
   }
  }
  if(!spoken){const error=Error(lastError?.code==='not-allowed'?'Браузер блокирует звук. Нажми «Проверить голос устройства» в настройках.':'Голос устройства не запустился. Проверь русский голос в настройках речи Windows или попробуй другой браузер. Ответ сохранён в чате.');error.code=lastError?.code;throw error}
 }
}
