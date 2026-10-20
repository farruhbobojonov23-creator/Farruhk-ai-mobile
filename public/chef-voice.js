import {recognizePhrase} from '/browser-recognition.js?v=76';
import {speakDeviceText} from '/device-speech.js?v=1';
export function speechChunks(text){
 const clean=text.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*#_`]/g,'');
 const chunks=[];let rest=clean;
 while(rest.length){
  const limit=chunks.length?1000:280;
  if(rest.length<=limit){chunks.push(rest);break}
  const prefix=rest.slice(0,limit),ends=[...prefix.matchAll(/[.!?]\s+/g)];
  let cut=ends.length?ends[ends.length-1].index+ends[ends.length-1][0].length:prefix.lastIndexOf(' ')+1;
  if(cut<limit/3)cut=limit;
  chunks.push(rest.slice(0,cut));rest=rest.slice(cut);
 }
 return chunks;
}
export function createVoiceConversation({send}){
 const $=id=>document.getElementById(id),panel=$('voice-panel');
 let active=false,generation=0,phase='idle',context=null,stream=null,recorder=null,source=null,input=null,controller=null,timer=null,frame=null,lastReply='',finishPlayback=null,playFrame=null,deviceVoiceUntil=0,deviceSpeaking=false,browserMode=false,browserSession=null;
 function status(next,text){phase=next;panel.dataset.phase=next;$('voice-status').textContent=text;$('voice-start').hidden=active;$('voice-stop').hidden=!active;$('voice-send').hidden=next!=='listening'}
 function animateLevel(analyser){const data=new Float32Array(analyser.fftSize);const tick=()=>{analyser.getFloatTimeDomainData(data);let sum=0;for(const sample of data)sum+=sample*sample;panel.style?.setProperty('--voice-level',String(Math.min(1,Math.sqrt(sum/data.length)*8)));playFrame=requestAnimationFrame(tick)};playFrame=requestAnimationFrame(tick)}
 function resetLevel(){cancelAnimationFrame(playFrame);playFrame=null;panel.style?.setProperty('--voice-level','0')}
 function releaseMic(){clearTimeout(timer);cancelAnimationFrame(frame);timer=null;frame=null;if(input){input.disconnect();input=null}if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}}
 function stop(text='Разговор остановлен.'){browserSession?.cancel();browserSession=null;active=false;generation++;controller?.abort();controller=null;if(recorder){recorder.onstop=null;recorder.ondataavailable=null;if(recorder.state!=='inactive')recorder.stop();recorder=null}releaseMic();resetLevel();if(deviceSpeaking){window.speechSynthesis?.cancel();deviceSpeaking=false}if(source){source.onended=null;try{source.stop()}catch{}source=null}finishPlayback?.();finishPlayback=null;status('idle',text)}
 function fail(error,token){if(token!==generation)return;stop();status('error',error.name==='NotAllowedError'?'Разреши микрофон для этого сайта в настройках браузера.':error.message||'Не удалось начать разговор.');if(lastReply){$('voice-start').textContent='Начать разговор'}}
 async function unlock(){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('В браузере недоступно воспроизведение голоса.');context=context||new Audio();await context.resume()}
 async function json(url,body,signal){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});const data=await r.json();if(!r.ok)throw Error(data.error||'Ошибка голосового сервиса.');return data}
 async function encode(blob){const bytes=new Uint8Array(await blob.arrayBuffer());let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(value)}
 async function speakDevice(text,token){
  if(!active||token!==generation)return;
  deviceSpeaking=true;
  try{
   await speakDeviceText({synth:window.speechSynthesis,Utterance:window.SpeechSynthesisUtterance,text,signal:controller?.signal,onLevel:value=>panel.style?.setProperty('--voice-level',String(value)),onVoice:name=>status('speaking','Отвечаю голосом устройства: '+name)});
  }finally{deviceSpeaking=false;resetLevel()}
 }
 async function testDevice(){
  stop();const token=generation;active=true;lastReply='';
  try{await unlock();if(!active||token!==generation)return;controller=new AbortController();status('connecting','Проверяю голос устройства…');await speakDevice('Фаррух Ака, голос устройства работает. Я на связи.',token);if(token===generation)stop('Проверка завершена. Если слышишь голос, можно начать разговор.')}catch(e){fail(e,token)}
 }
 async function speak(text,token){
  if(browserMode||Date.now()<deviceVoiceUntil)return speakDevice(text,token);
  status('thinking','Готовлю голосовой ответ…');
  const chunks=speechChunks(text);
  const requestAudio=async chunk=>{
   try{
    if(!active||token!==generation)return {};
    const r=await fetch('/api/voice/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:chunk,voice:$('voice-choice').value}),signal:controller.signal});
    if(!r.ok){const d=await r.json();const error=Error(d.error||'Голос недоступен. Ответ сохранён текстом.');error.status=r.status;throw error}
    return {buffer:await context.decodeAudioData(await r.arrayBuffer())};
   }catch(error){return {error}}
  };
  let pending=chunks.length?requestAudio(chunks[0]):null;
  for(let i=0;i<chunks.length;i++){
   const result=await pending;
   if(!active||token!==generation)return;
   if(result.error){
    if(result.error.name==='AbortError')throw result.error;
    if(window.speechSynthesis&&window.SpeechSynthesisUtterance){
     // Avoid repeated quota requests; retry neural speech after a short cooldown.
     if(result.error.status===429||result.error.status===503)deviceVoiceUntil=Date.now()+300000;
     return speakDevice(chunks.slice(i).join(''),token);
    }
    throw result.error;
   }
   // Prepare one next segment while the current segment is audible.
   pending=i+1<chunks.length?requestAudio(chunks[i+1]):null;
   status('speaking','Отвечаю… Нажми «Остановить», чтобы прервать.');
   await context.resume();
   if(!active||token!==generation)return;
   await new Promise(resolve=>{finishPlayback=resolve;source=context.createBufferSource();source.buffer=result.buffer;const meter=context.createAnalyser();meter.fftSize=1024;source.connect(meter);meter.connect(context.destination);animateLevel(meter);source.onended=()=>{resetLevel();meter.disconnect();source=null;finishPlayback=null;resolve()};source.start()});
  }
 }
 async function read(text){
  stop();const token=generation;active=true;lastReply=text;
  try{await unlock();if(!active||token!==generation)return;controller=new AbortController();timer=setTimeout(()=>controller?.abort(),150000);await speak(text,token);if(token===generation)stop('Ответ озвучен.')}catch(e){fail(e,token)}
 }
 async function sendText(text){
  stop();
  if(!$('voice-enabled').checked)return send(text);
  const token=generation;active=true;lastReply='';
  // Unlock audio while the Send click/submit still has user activation.
  // No microphone permission is requested for text replies.
  let audioError=null;const ready=unlock().catch(e=>{audioError=e});
  controller=new AbortController();timer=setTimeout(()=>controller?.abort(),150000);
  status('thinking','Ассистент думает…');
  try{
   lastReply=await send(text,{signal:controller.signal});
   await ready;
   if(!active||token!==generation)return;
   if(audioError)throw audioError;
   if($('voice-enabled').checked)await speak(lastReply,token);
   if(token===generation)stop('Ответ получен. Нажми «Прослушать», чтобы повторить.');
  }catch(e){fail(e,token)}
 }
 async function processRecording(blob,token){
  try{
   if(!active||token!==generation)return;
   if(blob.size<500)throw Error('Запись слишком короткая. Попробуй ещё раз.');
   status('thinking','Распознаю твою речь…');
   controller=new AbortController();timer=setTimeout(()=>controller?.abort(),150000);
   const {text}=await json('/api/transcribe',{data:await encode(blob),mimeType:blob.type.split(';')[0]},controller.signal);
   if(!active||token!==generation)return;
   if(!text?.trim())throw Error('Не удалось разобрать фразу. Попробуй ещё раз.');
   await processText(text,token);
  }catch(e){fail(e,token)}
 }
 async function processText(text,token){
  if(!active||token!==generation)return;
  clearTimeout(timer);controller=new AbortController();timer=setTimeout(()=>controller?.abort(),150000);
  try{
   $('voice-transcript').textContent='Ты: '+text;status('thinking','Выполняю запрос…');
   lastReply=await send(text,{signal:controller.signal,voice:true});
   if(!active||token!==generation)return;
   if($('voice-enabled').checked)await speak(lastReply,token);clearTimeout(timer);timer=null;
   if(!active||token!==generation)return;
   if($('voice-auto').checked)await listen(token);else stop('Ответ завершён. Можно начать новый разговор.');
  }catch(e){fail(e,token)}
 }
 async function listenBrowser(token){
  if(!active||token!==generation)return;
  controller=new AbortController();status('connecting','Подключаю распознавание браузера…');
  browserSession=recognizePhrase({Recognition:window.SpeechRecognition||window.webkitSpeechRecognition,signal:controller.signal,onStart:()=>status('listening','Слушаю… После команды сделай паузу.'),onText:text=>{$('voice-transcript').textContent='Ты: '+text}});
  try{const text=await browserSession.promise;browserSession=null;if(active&&token===generation)await processText(text,token)}catch(e){fail(e,token)}
 }
 async function listen(token){
  if(browserMode)return listenBrowser(token);
  try{
   status('connecting','Подключаю микрофон…');
   const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
   if(!active||token!==generation){media.getTracks().forEach(t=>t.stop());return}
   stream=media;
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
   const r=new MediaRecorder(stream,mime?{mimeType:mime}:{});recorder=r;const chunks=[];
   r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
   r.onerror=()=>fail(Error('Не удалось записать микрофон.'),token);
   r.onstop=()=>{releaseMic();if(recorder===r)recorder=null;if(active&&token===generation)processRecording(new Blob(chunks,{type:r.mimeType}),token)};
   const analyser=context.createAnalyser();analyser.fftSize=1024;input=context.createMediaStreamSource(stream);input.connect(analyser);
   const samples=new Float32Array(analyser.fftSize),started=performance.now();let spoken=false,lastSound=started;
   const tick=()=>{
    if(!active||token!==generation||r.state!=='recording')return;
    analyser.getFloatTimeDomainData(samples);let energy=0;for(const v of samples)energy+=v*v;
    panel.style?.setProperty('--voice-level',String(Math.min(1,Math.sqrt(energy/samples.length)*8)));const now=performance.now();if(Math.sqrt(energy/samples.length)>.025){spoken=true;lastSound=now}
    if(spoken&&now-lastSound>1600){r.stop();return}
    if(!spoken&&now-started>12000){stop('Речь не услышана. Нажми «Начать разговор» и говори.');return}
    frame=requestAnimationFrame(tick);
   };
   r.start(250);status('listening','Слушаю… После фразы сделай небольшую паузу.');frame=requestAnimationFrame(tick);
   timer=setTimeout(()=>{if(r.state==='recording')r.stop()},45000);
  }catch(e){fail(e,token)}
 }
 async function start(){
  stop();const token=generation;active=true;lastReply='';
  try{
   await unlock();status('connecting','Проверяю голосовой сервис…');
   controller=new AbortController();timer=setTimeout(()=>controller?.abort(),20000);
   const r=await fetch('/api/voice/config',{signal:controller.signal});const config=await r.json();clearTimeout(timer);timer=null;
   if(!r.ok)throw Error(config.error||'Сервер недоступен.');browserMode=!config.configured;
   if(browserMode&&!(window.SpeechRecognition||window.webkitSpeechRecognition))throw Error('Голосовые команды недоступны в этом браузере. Используй Chrome на Android или введи команду текстом.');
   if(!browserMode&&(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder))throw Error('Браузер не поддерживает запись голоса.');
   if(active&&token===generation)await listen(token);
  }catch(e){fail(e,token)}
 }
 $('voice-start').onclick=start;$('voice-stop').onclick=()=>stop();$('voice-send').onclick=()=>{if(browserSession)browserSession.stop();else if(recorder?.state==='recording')recorder.stop()};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)stop('Разговор остановлен при сворачивании приложения.')});
 window.addEventListener('pagehide',()=>stop());
 return {start,stop,read,sendText,testDevice};
}
