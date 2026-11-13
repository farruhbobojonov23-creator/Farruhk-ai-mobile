/* SHEF AI PREMIUM PWA install helper. Never stores auth tokens or project records. */
(() => {
 'use strict';
 let deferredInstall=null;
 const standalone=()=>window.matchMedia('(display-mode:standalone)').matches||navigator.standalone===true;
 const onAppleMobile=/iPad|iPhone|iPod/.test(navigator.userAgent);
 function statusText(){
   return standalone()?'Приложение открыто в отдельном окне.':
   'Для работы с рецептами и проектами требуется интернет; офлайн сохраняется только экран сообщения.';
 }
 function init(){
   const shell=document.querySelector('.top-actions');
   const settings=document.querySelector('#viewSettings');
   if(!shell)return;
   const button=document.createElement('button');
   button.id='shefInstallApp';button.type='button';button.className='btn btn-light shef-install-button';
   button.innerHTML='<span aria-hidden="true">↓</span> <span>Установить</span>';
   button.setAttribute('aria-haspopup','dialog');
   button.hidden=true;
   shell.prepend(button);
   const card=document.createElement('section');
   card.className='surface shef-pwa-panel';
   card.innerHTML='<div><div class="mini-label">PWA · МОБИЛЬНОЕ ПРИЛОЖЕНИЕ</div><h3>ШЕФ AI на главном экране</h3><p>Одна платформа на телефоне и компьютере, с отдельной иконкой и полноэкранным режимом.</p><small class="shef-pwa-status"></small></div><button type="button" class="btn btn-primary shef-pwa-install-secondary">Как установить</button>';
   if(settings)settings.append(card);
   const dlg=document.createElement('dialog');dlg.id='shefPwaDialog';
   dlg.setAttribute('aria-labelledby','shefPwaTitle');
   dlg.innerHTML='<div class="modal-head"><div><div class="mini-label">ШЕФ AI PREMIUM</div><h2 id="shefPwaTitle">Установка приложения</h2></div><button type="button" class="modal-close" aria-label="Закрыть">×</button></div><div class="modal-body"><p id="shefPwaHelp"></p></div><div class="modal-foot"><button type="button" class="btn btn-primary shef-pwa-close">Понятно</button></div>';
   document.body.append(dlg);
   const update=()=>{
    button.hidden=standalone()||!(deferredInstall||onAppleMobile);
    const status=card.querySelector('.shef-pwa-status');
    if(status)status.textContent=statusText();
    const label=card.querySelector('.shef-pwa-install-secondary');
    if(label)label.textContent=standalone()?'Информация':(deferredInstall?'Установить приложение':'Как установить');
   };
   const help=()=>{
    document.getElementById('shefPwaHelp').textContent=standalone()?
      'ШЕФ AI уже работает как установленное приложение. Для доступа к базе данных нужен интернет.':
      onAppleMobile?
       'Откройте ШЕФ AI в Safari, нажмите «Поделиться», затем выберите «На экран Домой» и подтвердите добавление.':
       'Откройте ШЕФ AI в Chrome, нажмите меню ⋮ и выберите «Установить приложение» (или «Добавить на главный экран», если предлагается). Если пункт пока не появился, проверьте подключение и обновите страницу.';
    dlg.showModal();
   };
   const install=async()=>{
    if(standalone())return help();
    if(!deferredInstall)return help();
    const event=deferredInstall;deferredInstall=null;update();
    try{await event.prompt();await event.userChoice;}
    catch{help();}
   };
   button.addEventListener('click',install);
   card.querySelector('.shef-pwa-install-secondary').addEventListener('click',install);
   dlg.querySelector('.modal-close').addEventListener('click',()=>dlg.close());
   dlg.querySelector('.shef-pwa-close').addEventListener('click',()=>dlg.close());
   window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();deferredInstall=event;update();
   });
   window.addEventListener('appinstalled',()=>{deferredInstall=null;update();});
   window.matchMedia('(display-mode:standalone)').addEventListener?.('change',update);
   update();
 }
 if('serviceWorker' in navigator && window.isSecureContext){
   window.addEventListener('load',()=>{
     navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(error=>{
       console.warn('SHEF AI PWA service worker not available:',error);
     });
   },{once:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
