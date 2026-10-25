// FARUKH PRINT — opt-in Android APK update notices.
// Automatic checking is allowed; APK installation is ALWAYS the user's action.
(()=>{'use strict';
const BASE='/farukh-print/download/';
const RELEASE='https://api.github.com/repos/farruhbobojonov23-creator/Farruhk-ai-mobile/releases/tags/farukh-print-current';
const match=/\bFarukhPrintAndroid\/(\d+)\b/.exec(navigator.userAgent);
const installed=match?Number(match[1]):null;
const root=document.getElementById('home');
if(!root)return;
const card=document.createElement('section');card.className='print-updates';
const title=document.createElement('strong');title.textContent='Версия и обновления';
const message=document.createElement('p');message.textContent='Проверяю доступность новой версии FARUKH PRINT…';
const actions=document.createElement('div');actions.className='print-update-actions';
const check=document.createElement('button');check.type='button';check.textContent='↻ Проверить';
const link=document.createElement('a');link.href=BASE;link.textContent='Скачать APK ↗';
actions.append(check,link);card.append(title,message,actions);
const end=root.querySelector('.app-foot');if(end)end.before(card);else root.append(card);
const KEY='farukh-print:update-cache:v1',INTERVAL=6*60*60*1000;
let busy=false,last=0;
function display(info){
 if(!info){message.textContent='Выпуск APK пока не опубликован. Страница загрузки доступна по кнопке.';return}
 if(installed!==null&&info.code>installed){
  message.textContent='Доступно обновление: '+info.version+'. Установлено №'+installed+'. Сначала сохрани локальную базу: у тестового APK может отличаться цифровая подпись.';
  link.textContent='Посмотреть обновление ↗';
 }else if(installed!==null){
  message.textContent='Установлена сборка №'+installed+' · новой версии не обнаружено.';
 }else message.textContent='Доступна '+info.version+'. Установку запускает только пользователь Android.';
}
async function checkVersion(force=false){
 if(busy||(!force&&Date.now()-last<INTERVAL))return;
 busy=true;check.disabled=true;
 try{
  if(!force){
   try{
    const saved=JSON.parse(localStorage.getItem(KEY)||'null');
    if(saved?.when&&Date.now()-saved.when<INTERVAL&&saved.info){
     display(saved.info);last=saved.when;return;
    }
   }catch{}
  }
  const res=await fetch(RELEASE,{headers:{Accept:'application/vnd.github+json'},cache:'no-store'});
  if(!res.ok)throw Error('Нет связи с сервером обновлений');
  const data=await res.json();
  const code=/^FARUKH_PRINT_VERSION_CODE=(\d+)$/m.exec(String(data.body||''));
  const asset=(data.assets||[]).find(a=>a.name==='FARUKH-PRINT-test.apk');
  const info=code&&asset?{code:Number(code[1]),version:data.name||data.tag_name}:null;
  display(info);
  last=Date.now();
  try{localStorage.setItem(KEY,JSON.stringify({when:last,info}))}catch{}
 }catch{
  message.textContent='Проверка обновлений недоступна. Попробуй снова или открой страницу APK.';
 }finally{check.disabled=false;busy=false}
}
check.addEventListener('click',()=>void checkVersion(true));
void checkVersion();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkVersion()});
})();
