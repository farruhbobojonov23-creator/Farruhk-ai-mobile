// FARUKH PRINT: one action, automatic update checks, no silent APK installation.
(()=>{'use strict';
const BASE='/farukh-print/download/';
const RELEASE='https://api.github.com/repos/farruhbobojonov23-creator/Farruhk-ai-mobile/releases/tags/farukh-print-current';
const match=/\bFarukhPrintAndroid\/(\d+)\b/.exec(navigator.userAgent);
const installed=match?Number(match[1]):null;
const names={10:'1.4.3-test',11:'1.4.4-test',12:'1.4.5-test'};
const root=document.getElementById('home');
if(!root)return;
const card=document.createElement('section');card.className='print-updates';
const title=document.createElement('strong');title.textContent='Версия и обновления';
const versions=document.createElement('div');versions.className='print-update-versions';
const current=document.createElement('span');
current.textContent='Установлено: '+(installed===null?'версия определяется в Android':names[installed]||'сборка №'+installed);
const available=document.createElement('span');available.textContent='Доступно: проверяю…';
versions.append(current,available);
const message=document.createElement('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
message.textContent='Проверяю наличие обновлений…';
const actions=document.createElement('div');actions.className='print-update-actions';
const button=document.createElement('button');button.type='button';button.className='print-update-primary';
button.disabled=true;button.textContent='Проверяю версию…';
actions.append(button);card.append(title,versions,message,actions);
const end=root.querySelector('.app-foot');if(end)end.before(card);else root.append(card);
const KEY='farukh-print:update-cache:v2',INTERVAL=6*60*60*1000;
let busy=false,last=0,action=null;
function setButton(label,next=null){
 action=next;button.textContent=label;button.disabled=!next;
}
function display(info){
 if(!info){
  available.textContent='Доступно: —';
  message.textContent='Опубликованного обновления пока нет.';
  setButton('Нет доступных обновлений');return;
 }
 available.textContent='Доступно: '+info.version;
 if(installed===null){
  message.textContent='Версия установленного APK определяется только внутри Android-приложения.';
  setButton('Открой FARUKH PRINT на Android');return;
 }
 if(info.code>installed){
  message.textContent='Новая версия доступна. Откроется страница загрузки. Перед установкой сохрани JSON-базу: у тестовых APK могут отличаться подписи.';
  setButton('Обновить до '+info.version,'update');
 }else{
  message.textContent='Новых обновлений нет.';
  setButton('Актуальная версия');
 }
}
async function checkVersion(force=false){
 if(busy||(!force&&Date.now()-last<INTERVAL))return;
 busy=true;button.disabled=true;
 try{
  if(!force){
   try{
    const saved=JSON.parse(localStorage.getItem(KEY)||'null');
    if(saved?.when&&Date.now()-saved.when<INTERVAL&&saved.info){
     last=saved.when;display(saved.info);return;
    }
   }catch{}
  }
  message.textContent='Проверяю наличие обновлений…';
  const res=await fetch(RELEASE,{headers:{Accept:'application/vnd.github+json'},cache:'no-store'});
  if(!res.ok)throw Error('Ошибка сервера обновлений');
  const data=await res.json();
  const body=String(data.body||'');
  const code=/^FARUKH_PRINT_VERSION_CODE=(\d+)$/m.exec(body);
  const version=/^FARUKH_PRINT_VERSION_NAME=([^\r\n]+)$/m.exec(body);
  const asset=(data.assets||[]).find(a=>a.name==='FARUKH-PRINT-test.apk'&&a.browser_download_url?.startsWith('https://github.com/'));
  const parsed=code?Number(code[1]):0;
  const info=parsed>0&&asset?{code:parsed,version:version?.[1]||'сборка №'+parsed}:null;
  display(info);
  last=Date.now();
  try{localStorage.setItem(KEY,JSON.stringify({when:last,info}))}catch{}
 }catch{
  available.textContent='Доступно: неизвестно';
  message.textContent='Не удалось проверить обновления. Повтори проверку при подключении к интернету.';
  setButton('Повторить проверку','retry');
 }finally{busy=false;if(action)button.disabled=false}
}
button.addEventListener('click',()=>{
 if(busy||button.disabled)return;
 if(action==='retry')void checkVersion(true);
 else if(action==='update')window.location.assign(BASE);
});
void checkVersion();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkVersion()});
})();