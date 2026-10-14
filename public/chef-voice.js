export function createVoiceConversation({send}){
 const $=id=>document.getElementById(id),panel=$('voice-panel');
 let active=false,generation=0,phase='idle',context=null,stream=null,recorder=null,source=null,input=null,controller=null,timer=null,frame=null,lastReply='',finishPlayback=null;
 function status(next,text){phase=next;panel.dataset.phase=next;$('voice-status').textContent=text;$('voice-start').hidden=active;$('voice-stop').hidden=!active;$('voice-send').hidden=next!=='listening'}
 function releaseMic(){clearTimeout(timer);cancelAnimationFrame(frame);timer=null;frame=null;if(input){input.disconnect();input=null}if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}}
 function stop(text='Разговор остановлен.'){active=false;generation++;controller?.abort();controller=null;if(recorder){recorder.onstop=null;recorder.ondataavailable=null;if(recorder.state!=='inactive')recorder.stop();recorder=null}releaseMic();if(source){source.onended=null;try{source.stop()}catch{}source=null}finishPlayback?.();finishPlayback=null;status('idle',text)}
 function fail(error,token){if(token!==generation)return;stop();status('error',error.name==='NotAllowedError'?'Разреши микрофон для этого сайта в настройках браузера.':error.message||'Не удалось начать разговор.');if(lastReply){$('voice-start').textContent='Начать разговор'}}
 async function unlock(){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('В браузере недоступно воспроизведение голоса.');context=context||new Audio();await context.resume()}
 async function json(url,body,signal){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});const data=await r.json();if(!r.ok)throw Error(data.error||'Ошибка голосового сервиса.');return data}
 async function encode(blob){const bytes=new Uint8Array(await blob.arrayBuffer());let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(value)}
 async function speak(text,token){
  status('thinking','Готовлю голосовой ответ…');
  // Remove display markup, but do not silently truncate the spoken answer.
  const clean=text.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*#_`]/g,'');
  const chunks=clean.match(/[\s\S]{1,3000}(?:[.!?]\s|$)|[\s\S]{1,3000}/g)||[];
  for(const chunk of chunks){
   if(!active||token!==generation)return;
   const r=await fetch('/api/voice/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:chunk,voice:$('voice-choice').value}),signal:controller.signal});
   if(!r.ok){const d=await r.json();throw Error(d.error||'Голос недоступен. Ответ сохранён текстом.')}
   const buffer=await context.decodeAudioData(await r.arrayBuffer());
   if(!active||token!==generation)return;
   status('speaking','Отвечаю… Нажми «Остановить», чтобы прервать.');
   await context.resume();
   await new Promise(resolve=>{finishPlayback=resolve;source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);source.onended=()=>{source=null;finishPlayback=null;resolve()};source.start()});
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
   $('voice-transcript').textContent='Ты: '+text;status('thinking','Ассистент думает…');
   lastReply=await send(text,{signal:controller.signal,voice:true});
   if(!active||token!==generation)return;
   if($('voice-enabled').checked)await speak(lastReply,token);clearTimeout(timer);timer=null;
   if(!active||token!==generation)return;
   if($('voice-auto').checked)await listen(token);else stop('Ответ завершён. Можно начать новый разговор.');
  }catch(e){fail(e,token)}
 }
 async function listen(token){
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
    const now=performance.now();if(Math.sqrt(energy/samples.length)>.025){spoken=true;lastSound=now}
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
   if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Этот браузер не поддерживает запись голоса. Открой сайт в Chrome или Safari.');
   await unlock();status('connecting','Проверяю голосовой сервис…');
   controller=new AbortController();timer=setTimeout(()=>controller?.abort(),20000);
   const r=await fetch('/api/voice/config',{signal:controller.signal});const config=await r.json();clearTimeout(timer);timer=null;
   if(!r.ok)throw Error(config.error||'Сервер недоступен.');if(!config.configured)throw Error('На сервере не подключён голос Gemini.');
   if(active&&token===generation)await listen(token);
  }catch(e){fail(e,token)}
 }
 $('voice-start').onclick=start;$('voice-stop').onclick=()=>stop();$('voice-send').onclick=()=>{if(recorder?.state==='recording')recorder.stop()};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)stop('Разговор остановлен при сворачивании приложения.')});
 window.addEventListener('pagehide',()=>stop());window.addEventListener('hashchange',()=>{if(location.hash!=='#chat'&&active)stop()});
 return {start,stop,read,sendText};
}
