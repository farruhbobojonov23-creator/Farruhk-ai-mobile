// Android/PWA diagnostics. No microphone is requested until the user taps the button.
export function inspectVoiceCapabilities({secure=true,media=false,recorder=false,browser=false,standalone=false}={}){
 return {
  secure:Boolean(secure),recording:Boolean(secure&&media&&recorder),
  browserSpeech:Boolean(browser),standalone:Boolean(standalone)
 };
}
export function mountVoiceDiagnostics(container,{win=window,nav=navigator}={}){
 const box=win.document.createElement('div');
 box.className='voice-diagnostics';
 const title=win.document.createElement('strong');title.textContent='Проверка Android и голосового ИИ';
 const status=win.document.createElement('p');status.className='small';status.setAttribute('role','status');
 const check=win.document.createElement('button');check.type='button';check.textContent='Проверить подключение и Android';
 const mic=win.document.createElement('button');mic.type='button';mic.textContent='Проверить микрофон';
 const micStatus=win.document.createElement('p');micStatus.className='small';micStatus.setAttribute('role','status');
 box.append(title,status,check,mic,micStatus);container.append(box);
 async function refresh(){
  const caps=inspectVoiceCapabilities({
   secure:win.isSecureContext!==false,
   media:Boolean(nav.mediaDevices?.getUserMedia),
   recorder:Boolean(win.MediaRecorder),
   browser:Boolean(win.SpeechRecognition||win.webkitSpeechRecognition),
   standalone:Boolean(win.matchMedia?.('(display-mode: standalone)').matches||nav.standalone)
  });
  let connection='Статус Gemini неизвестен';
  try{
   const response=await win.fetch('/api/voice/config',{cache:'no-store'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const config=await response.json();
   connection=config.configured?'Gemini: API-ключ задан, реальный голос проверяется разговором':'Gemini: API-ключ не задан, доступны команды браузера';
  }catch{connection='Gemini: сервер недоступен';}
  status.textContent=[
   connection,
   'Микрофон для записи: '+(caps.recording?'поддерживается':'недоступен'),
   'Распознавание браузера: '+(caps.browserSpeech?'доступно':'недоступно'),
   'Android-приложение: '+(caps.standalone?'открыто как PWA':'открыто в браузере'),
   !caps.secure?'Для микрофона нужен HTTPS.':null
  ].filter(Boolean).join(' · ');
 }
 check.onclick=()=>{status.textContent='Проверяю…';refresh()};
 mic.onclick=async()=>{
  mic.disabled=true;micStatus.textContent='Запрашиваю разрешение на микрофон…';
  try{
   if(!nav.mediaDevices?.getUserMedia)throw Error('Браузер не предоставляет доступ к микрофону.');
   const stream=await nav.mediaDevices.getUserMedia({audio:true});
   stream.getTracks().forEach(track=>track.stop());
   micStatus.textContent='Микрофон доступен. Можно нажать кнопку ИИ на главном экране.';
  }catch(error){
   micStatus.textContent=error.name==='NotAllowedError'?'Доступ к микрофону запрещён. Разреши его для сайта в настройках браузера.':
    'Микрофон не прошёл проверку: '+(error.message||'ошибка');
  }finally{mic.disabled=false}
 };
 refresh();
 return {refresh};
}
