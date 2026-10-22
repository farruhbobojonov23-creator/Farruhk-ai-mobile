// One utterance per session. Stop/cancel always detaches callbacks before aborting.
export function recognizePhrase({Recognition,signal,onText=()=>{},onStart=()=>{},timeoutMs=45000}){
 let recognition,settled=false,timer,resolve,reject,finalText='',interimText='';
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no});
 function finish(error,text){if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);if(recognition){recognition.onstart=recognition.onresult=recognition.onerror=recognition.onend=null;try{recognition.abort()}catch{}}error?reject(error):resolve(text)}
 function cancel(){finish(new DOMException('Разговор остановлен','AbortError'))}
 try{
  if(signal?.aborted){cancel();return {promise,stop:()=>{},cancel}}
  if(!Recognition)throw Error('Голосовые команды недоступны в этом браузере. Используй ввод текста или Chrome на Android.');
  recognition=new Recognition();recognition.lang='ru-RU';recognition.continuous=false;recognition.interimResults=true;recognition.maxAlternatives=1;
  recognition.onstart=onStart;
  recognition.onresult=e=>{const complete=[],preview=[];for(let i=0;i<e.results.length;i++){const r=e.results[i],text=r[0]?.transcript?.trim();if(text)(r.isFinal?complete:preview).push(text)}finalText=complete.join(' ');interimText=preview.join(' ');onText([finalText,interimText].filter(Boolean).join(' '))};
  recognition.onerror=e=>{const errors={'not-allowed':'Разреши микрофон для этого сайта в настройках браузера.','service-not-allowed':'Браузер запретил распознавание речи. Попробуй Chrome или ввод текста.','audio-capture':'Микрофон недоступен. Проверь подключение и разрешение.','network':'Сервис распознавания речи недоступен. Проверь интернет или введи команду текстом.','no-speech':'Речь не услышана. Нажми микрофон и повтори.'};finish(new Error(errors[e.error]||'Не удалось распознать речь. Повтори фразу.'))};
  recognition.onend=()=>finalText||interimText?finish(null,[finalText,interimText].filter(Boolean).join(' ')):finish(new Error('Не удалось разобрать фразу. Повтори или введи её текстом.'));
  signal?.addEventListener('abort',cancel,{once:true});timer=setTimeout(()=>finish(new Error('Время ожидания речи истекло. Начни разговор снова.')),timeoutMs);recognition.start();
 }catch(e){finish(e)}
 return {promise,stop:()=>{if(!settled)try{recognition.stop()}catch(e){finish(e)}},cancel};
}
