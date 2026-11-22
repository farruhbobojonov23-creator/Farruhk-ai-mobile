/* MORE SUSHI STUDIO PRO: manual refresh of web content inside the installed APK.
   Refreshes HTML from Render without clearing credentials, locally saved content or
   Supabase documents. Native Android binary updates require a separately signed APK. */
(function(){
  'use strict';
  const KEY='more-sushi-web-refreshed-at-v1';
  const MAX_MS=12000;
  let busy=false;
  let note=null;

  function toast(message,kind){
    if(!note){
      note=document.createElement('div');
      note.className='ocean-refresh-toast';
      note.setAttribute('role','status');
      note.setAttribute('aria-live','polite');
      document.body.appendChild(note);
    }
    note.classList.remove('error');
    if(kind==='error')note.classList.add('error');
    note.textContent=message;
    note.classList.add('visible');
    window.clearTimeout(note._tid);
    note._tid=setTimeout(()=>note.classList.remove('visible'),3400);
  }

  function updateButtons(working){
    document.querySelectorAll('[data-ocean-refresh]').forEach(function(button){
      button.disabled=working;
      button.classList.toggle('refreshing',working);
      button.setAttribute('aria-busy',String(working));
    });
  }

  async function checkAndRefresh(){
    if(busy)return;
    busy=true;
    updateButtons(true);
    toast('Проверяем обновления на сервере…');
    const next=new URL(window.location.href);
    next.searchParams.set('_fresh',String(Date.now()));
    const abort=new AbortController();
    const timer=setTimeout(()=>abort.abort(),MAX_MS);
    try{
      const response=await fetch(next.href,{
        cache:'no-store',
        credentials:'same-origin',
        redirect:'follow',
        signal:abort.signal,
        headers:{'Cache-Control':'no-cache'}
      });
      if(!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('text/html'))
        throw new Error('Сервер не вернул страницу');
      // Never delete localStorage, cookies or the user's saved recipes.
      // Existing editor beforeunload hook will warn about unsaved work.
      sessionStorage.setItem(KEY,String(Date.now()));
      toast('Обновление найдено. Загружаем свежую версию…');
      window.location.assign(next.href);
      // If user cancels an unsaved-changes navigation, keep the button operable.
      setTimeout(function(){
        busy=false;
        updateButtons(false);
      },2400);
    }catch(error){
      toast('Нет связи с сервером. Данные сохранены, попробуй позже.', 'error');
      busy=false;
      updateButtons(false);
    }finally{
      clearTimeout(timer);
    }
  }

  document.addEventListener('click',function(event){
    const btn=event.target.closest('[data-ocean-refresh]');
    if(!btn)return;
    event.preventDefault();
    checkAndRefresh();
  });

  function showLastRefresh(){
    try{
      const last=Number(sessionStorage.getItem(KEY)||0);
      if(last>0 && Date.now()-last<16000)toast('Готово! Загружена свежая версия MORE SUSHI STUDIO.');
      if(last)sessionStorage.removeItem(KEY);
    }catch{}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showLastRefresh);
  else showLastRefresh();

  window.MoreSushiWebRefresh=checkAndRefresh;
})();