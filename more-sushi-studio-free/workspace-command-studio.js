/* FARRUH WORKSPACE PRO — a single compact header for the existing TTK studio. */
(function(){
 'use strict';
 if(!document.documentElement.classList.contains('ocean-app'))return;
 function mount(){
  document.documentElement.removeAttribute('data-studio-theme');
  document.title='MORE SUSHI STUDIO PRO · FARRUH WORKSPACE';
  const theme=document.querySelector('meta[name="theme-color"]');
  if(theme)theme.content='#f4f4f7';
  const breadcrumb=document.querySelector('.breadcrumb');
  if(breadcrumb)breadcrumb.textContent='FARRUH WORKSPACE / MORE SUSHI STUDIO';
  if(document.querySelector('.workspace-appbar'))return;
  const bar=document.createElement('div');bar.className='workspace-appbar';
  const back=document.createElement('a');back.className='workspace-appbar-back';back.href='./mobile.html';back.textContent='‹ Главная';
  const name=document.createElement('div');name.className='workspace-appbar-name';
  const title=document.createElement('b');title.textContent='MORE SUSHI STUDIO PRO';
  const sub=document.createElement('small');sub.textContent='Внутри FARRUH WORKSPACE';
  name.append(title,sub);
  const update=document.createElement('button');update.type='button';update.className='workspace-appbar-update';
  update.setAttribute('data-ocean-refresh','');update.textContent='↻ Обновить';
  bar.append(back,name,update);
  const auth=document.getElementById('auth');
  if(auth)auth.insertAdjacentElement('beforebegin',bar);else document.body.prepend(bar);
  document.querySelector('.ocean-bottomnav')?.remove();
  document.querySelector('.ocean-appbar')?.remove();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
